import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { getMemmpoolInfo, MempoolInfo } from "../../../../lib/server/bitcoind";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: MempoolInfo = {
  loaded: true,
  size: 13547,
  bytes: 31485635,
  usage: 39485635,
  maxmempool: 404856353,
  mempoolminfee: 0.00021,
  minrelaytxfee: 0.00011,
  unbroadcastcount: 20,
};

const methods = "GET";

export const getRDMempoolInfo = pipe(useRealData ? getMemmpoolInfo : pipe(taskEither.right(mockData), task.delay(2000)));

const handler = (req: NextApiRequest, res: NextApiResponse<MempoolInfo | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getRDMempoolInfo),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
