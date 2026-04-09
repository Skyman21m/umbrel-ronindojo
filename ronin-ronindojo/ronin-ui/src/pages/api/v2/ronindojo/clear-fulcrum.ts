import { NextApiRequest, NextApiResponse } from "next";
import { pipe } from "fp-ts/function";
import { boolean, either, string, task, taskEither } from "fp-ts";
import * as D from "io-ts/Decoder";
import { $ } from "execa";
import { badRequest, unauthorized } from "@hapi/boom";

import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { stopDojo, startDojo } from "../../../../lib/server/dojo-execute";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { decryptString } from "../../../../lib/server/decryptString";
import { verifyUserPassword } from "../../../../lib/server/sudo";

const RequestBody = D.struct({
  password: pipe(
    D.string,
    D.parse((s) =>
      pipe(
        decryptString(s),
        either.mapLeft(() => D.error(s, "cannot decrypt password")),
      ),
    ),
  ),
});

export interface Response {
  status: "ok";
}

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        RequestBody.decode(req.body),
        either.mapLeft(() => badRequest("Incorrect request payload.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ password }) =>
      pipe(
        useRealData
          ? verifyUserPassword(password)
          : pipe(
              string.Eq.equals(password, "testtest"),
              boolean.fold(
                () => taskEither.left(unauthorized("Incorrect password")),
                () => taskEither.right(null),
              ),
            ),
      ),
    ),
    taskEither.chain(() =>
      useRealData
        ? pipe(
            stopDojo,
            taskEither.chain(() =>
              taskEither.tryCatch(
                () =>
                  $({
                    shell: "/bin/bash",
                    stdout: "inherit",
                    stderr: "inherit",
                  })`docker container rm fulcrum && docker volume rm my-dojo_data-fulcrum`,
                toBoomError(500),
              ),
            ),
            taskEither.chain(() => startDojo),
            taskEither.map(() => ({ status: "ok" }) as const),
          )
        : pipe(taskEither.right({ status: "ok" } as const), task.delay(8000)),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
