import { access } from "fs/promises";
import { constants } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../../middlewares/v2";
import { useRealData } from "../../../../../lib/common";
import { withSessionApi } from "../../../../../lib/server/session";
import { DOJO_UPGRADE_LOCK } from "../../../../../const";

export interface Response {
  status: "running" | "not_running";
}

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chainW(() =>
      pipe(
        useRealData
          ? pipe(
              taskEither.tryCatch(
                () => access(DOJO_UPGRADE_LOCK, constants.F_OK),
                (e) => e,
              ),
              taskEither.matchW(
                () => either.right("not_running" as const),
                () => either.right("running" as const),
              ),
            )
          : pipe(taskEither.right("not_running" as const), task.delay(2000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), (status) => sendSuccessTask(res)({ status })),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
