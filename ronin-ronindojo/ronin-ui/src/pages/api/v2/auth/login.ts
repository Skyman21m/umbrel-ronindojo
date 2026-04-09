import { NextApiRequest, NextApiResponse } from "next";
import { unauthorized } from "@hapi/boom";
import { taskEither, either, json, string, boolean } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { NonEmptyString } from "io-ts-types/NonEmptyString";

import { withSessionApi, SessionData } from "../../../../lib/server/session";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { readDataFile, writeDataFile } from "../../../../lib/server/dataFile";
import { decryptString } from "../../../../lib/server/decryptString";
import { useRealData } from "../../../../lib/common";

const RequestBody = t.type({
  password: NonEmptyString,
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
        either.mapLeft(() => unauthorized("Password cannot be empty")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain((parsedCredentials) =>
      pipe(
        // Authenticate using the Dojo admin key instead of OS password
        string.Eq.equals(parsedCredentials.password, process.env.NODE_ADMIN_KEY || ""),
        boolean.fold(
          () => taskEither.left(unauthorized("Incorrect password")),
          () =>
            pipe(
              taskEither.right({ isLoggedIn: true, username: process.env.RONIN_UI_USERNAME || "umbrel" }),
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
      ),
    ),
    taskEither.chainFirst(() =>
      pipe(
        readDataFile,
        taskEither.fold(
          () => writeDataFile({ initialized: true }),
          () => taskEither.right(undefined),
        ),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
