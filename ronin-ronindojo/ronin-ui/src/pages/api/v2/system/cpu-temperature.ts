import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { cpuTemperature, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.CpuTemperatureData = { main: 42, cores: [], max: 42 };

export type Response = Systeminformation.CpuTemperatureData;

const methods = "GET";

export const getCpuTemperature = pipe(
  useRealData ? taskEither.tryCatch(() => cpuTemperature(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)),
);

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getCpuTemperature),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
