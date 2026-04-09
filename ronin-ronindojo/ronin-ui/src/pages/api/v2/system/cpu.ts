import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { cpu, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.CpuData = {
  manufacturer: "Intel®",
  brand: "Core™ i9-9900",
  vendor: "GenuineIntel",
  family: "6",
  model: "158",
  stepping: "13",
  revision: "",
  voltage: "",
  speed: 3.1,
  speedMin: 0.8,
  speedMax: 5,
  governor: "powersave",
  cores: 16,
  physicalCores: 8,
  processors: 1,
  socket: "LGA1151",
  cache: { l1d: 262144, l1i: 262144, l2: 2, l3: 16 },
  flags: "",
  virtualization: true,
};

type Response = Systeminformation.CpuData;

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => pipe(useRealData ? taskEither.tryCatch(() => cpu(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)))),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
