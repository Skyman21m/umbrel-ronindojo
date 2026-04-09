import os from "os";
import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, either, string, json } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { NonEmptyString } from "io-ts-types/NonEmptyString";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { writeDataFile } from "../../../../lib/server/dataFile";
import { Password } from "../../../../lib/common/types";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { SessionData, withSessionApi } from "../../../../lib/server/session";
import { setUserPassword } from "../../../../lib/server/roninDojoCredentials";
import { verifyUserPassword } from "../../../../lib/server/sudo";
import { decryptString } from "../../../../lib/server/decryptString";

const RequestBody = t.type({
  oldPassword: NonEmptyString,
  newPassword: Password,
  repeatPassword: Password,
});

export interface Response extends SessionData {}

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => decryptString(req.body)),
    either.chain((decrypted) => pipe(json.parse(decrypted), either.mapLeft(toBoomError(500)))),
    either.chain((payload) =>
      pipe(
        RequestBody.decode(payload),
        either.mapLeft(() => badRequest("Password needs to be at least 8 characters long")),
      ),
    ),
    either.chainFirst(({ newPassword }) =>
      /^\w*$/g.test(newPassword) ? either.right(null) : either.left(badRequest("Password must contain only letters and digits")),
    ),
    either.chainFirst(({ newPassword, repeatPassword }) =>
      string.Eq.equals(newPassword, repeatPassword) ? either.right(null) : either.left(badRequest("Passwords do not match")),
    ),
    taskEither.fromEither,
    taskEither.chainFirst(({ oldPassword }) =>
      pipe(
        verifyUserPassword(oldPassword),
        taskEither.mapLeft(() => badRequest("Old password does not match")),
      ),
    ),
    taskEither.chain(({ oldPassword, newPassword }) =>
      pipe(
        setUserPassword(newPassword, oldPassword),
        taskEither.chainFirst(() => pipe(writeDataFile({ initialized: true }))),
        taskEither.map(() => ({ isLoggedIn: true, username: os.userInfo().username })),
        taskEither.chainFirst((userData) =>
          pipe(
            () => {
              req.session.user = userData;
            },
            taskEither.fromIO,
            taskEither.chain(() => taskEither.tryCatch(() => req.session.save(), toBoomError(500))),
          ),
        ),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
