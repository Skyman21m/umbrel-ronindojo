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
import { writeDataFile } from "../../../../lib/server/dataFile";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { decryptString } from "../../../../lib/server/decryptString";
import { comparePasswords, hashPassword } from "../../../../lib/server/password";
import { RONIN_UI_DATA_FILE } from "../../../../const";
import { promises as fs } from "fs";

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
      newPassword.length >= 8 ? either.right(null) : either.left(badRequest("Password must be at least 8 characters long")),
    ),
    either.chainFirst((reqBody) =>
      string.Eq.equals(reqBody.newPassword, reqBody.repeatNewPassword) ? either.right(null) : either.left(badRequest("New passwords do not match")),
    ),
    taskEither.fromEither,
    taskEither.chainFirst(({ currentPassword }) =>
      pipe(
        taskEither.tryCatch(
          async () => {
            let storedPassword = process.env.APP_PASSWORD || "";
            let isHashed = false;
            try {
              const data = await fs.readFile(RONIN_UI_DATA_FILE, "utf8");
              const parsed = JSON.parse(data);
              if (parsed.password) {
                storedPassword = parsed.password;
                isHashed = storedPassword.includes(":");
              }
            } catch {}
            if (isHashed) {
              const match = await comparePasswords(currentPassword)(storedPassword)();
              if (match._tag !== "Right" || !match.right) throw new Error("mismatch");
            } else {
              if (currentPassword !== storedPassword) throw new Error("mismatch");
            }
          },
          () => badRequest("Old password does not match"),
        ),
      ),
    ),
    taskEither.chain((reqBody) =>
      pipe(
        hashPassword(reqBody.newPassword),
        taskEither.mapLeft(() => badRequest("Failed to hash password")),
        taskEither.chain((hashedPassword) => writeDataFile({ initialized: true, password: hashedPassword })),
        taskEither.map(() => ({ isLoggedIn: true, username: process.env.RONIN_UI_USERNAME || "umbrel" })),
      ),
    ),
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
