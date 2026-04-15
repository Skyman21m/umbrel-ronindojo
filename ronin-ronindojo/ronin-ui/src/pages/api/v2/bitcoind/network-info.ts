import { NextApiRequest, NextApiResponse } from "next";
import { task, taskEither, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { NetworkInfo, getNetworkInfo } from "../../../../lib/server/bitcoind";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData = {
  subversion: "/Satoshi:27.0.0/",
} as NetworkInfo;

export type Response = NetworkInfo;

export const getRDNetworkInfo = pipe(useRealData ? getNetworkInfo : pipe(taskEither.right(mockData), task.delay(2000)));

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getRDNetworkInfo),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
