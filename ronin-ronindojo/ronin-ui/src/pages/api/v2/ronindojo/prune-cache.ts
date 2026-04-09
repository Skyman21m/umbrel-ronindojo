import { constants } from "fs";
import { access } from "fs/promises";
import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { $ } from "execa";

import { HTTPMethod, isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { DOCKER_PRUNE_LOCK } from "../../../../const";

const enum Status {
  OK = "ok",
  RUNNING = "running",
}

export interface Response {
  status: Status;
}

const execPrune = pipe(
  taskEither.tryCatch(
    () =>
      $({
        shell: "/bin/bash",
        stdout: "inherit",
        stderr: "inherit",
      })`touch ${DOCKER_PRUNE_LOCK}; docker builder prune --force --all; rm ${DOCKER_PRUNE_LOCK}`,
    toBoomError(500),
  ),
  taskEither.map(() => ({ status: Status.OK })),
);

const getPruneStatus = pipe(
  taskEither.tryCatch(
    () => access(DOCKER_PRUNE_LOCK, constants.F_OK),
    (e) => e,
  ),
  taskEither.matchW(
    () => either.right({ status: Status.OK }),
    () => either.right({ status: Status.RUNNING }),
  ),
);

const methods = ["GET", "POST"] as HTTPMethod[];

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => {
      switch (req.method) {
        case "GET":
          return pipe(useRealData ? getPruneStatus : pipe(taskEither.right({ status: Status.OK }), task.delay(200)));
        case "POST":
          return pipe(useRealData ? execPrune : pipe(taskEither.right({ status: Status.RUNNING }), task.delay(10000)));
        default:
          throw new Error("Absurd");
      }
    }),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
