import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { mem, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.MemData = {
  total: 67092135936,
  free: 65769291776,
  used: 53228441600,
  active: 30324951040,
  available: 66059640832,
  buffers: 63213568,
  cached: 800124928,
  slab: 268804096,
  buffcache: 1132142592,
  swaptotal: 8589930496,
  swapused: 4589930496,
  swapfree: 4589930496,
  writeback: 8757576675,
  dirty: 785754685,
};

export type Response = Systeminformation.MemData;

const methods = "GET";

export const getMemoryData = pipe(useRealData ? taskEither.tryCatch(() => mem(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)));

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getMemoryData),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
