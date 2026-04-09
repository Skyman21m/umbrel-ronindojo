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
import { upgradeDojo } from "../../../../../lib/server/dojo-execute";

interface Response {
  status: "ok";
}

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => pipe(useRealData ? upgradeDojo : pipe(taskEither.right(null), task.delay(2000)))),
    taskEither.fold(sendErrorTask(res), () => sendSuccessTask(res)({ status: "ok" })),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
