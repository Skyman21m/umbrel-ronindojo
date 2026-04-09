import os from "os";
import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, either, string, json } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { NonEmptyString } from "io-ts-types/NonEmptyString";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { Password } from "../../../../lib/common/types";
import { withSessionApi } from "../../../../lib/server/session";
import { setUserPassword } from "../../../../lib/server/roninDojoCredentials";
import { verifyUserPassword } from "../../../../lib/server/sudo";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { decryptString } from "../../../../lib/server/decryptString";

const RequestBody = t.type({
  currentPassword: NonEmptyString,
  newPassword: Password,
  repeatNewPassword: Password,
});

interface Response {
  status: "ok";
}

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() => decryptString(req.body)),
    either.chain((decrypted) => pipe(json.parse(decrypted), either.mapLeft(toBoomError(500)))),
    either.chain((payload) =>
      pipe(
        RequestBody.decode(payload),
        either.mapLeft(() => badRequest("Incorrect request payload provided")),
      ),
    ),
    either.chainFirst(({ newPassword }) =>
      /^\w*$/g.test(newPassword) ? either.right(null) : either.left(badRequest("Password must contain only letters and digits")),
    ),
    either.chainFirst((reqBody) =>
      string.Eq.equals(reqBody.newPassword, reqBody.repeatNewPassword) ? either.right(null) : either.left(badRequest("New passwords do not match")),
    ),
    taskEither.fromEither,
    taskEither.chainFirst(({ currentPassword }) =>
      pipe(
        verifyUserPassword(currentPassword),
        taskEither.mapLeft(() => badRequest("Old password does not match")),
      ),
    ),
    taskEither.chainFirst((reqBody) => setUserPassword(reqBody.newPassword, reqBody.currentPassword)),
    taskEither.map((reqBody) => ({ isLoggedIn: true, username: os.userInfo().username, password: reqBody.newPassword })),
    taskEither.chainFirst((userData) =>
      pipe(
        () => {
          req.session.user = userData;
        },
        taskEither.fromIO,
        taskEither.chain(() => taskEither.tryCatch(() => req.session.save(), toBoomError(500))),
      ),
    ),
    taskEither.fold(sendErrorTask(res), () => sendSuccessTask(res)({ status: "ok" })),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
