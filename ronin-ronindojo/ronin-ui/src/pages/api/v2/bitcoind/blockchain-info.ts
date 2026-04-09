import { NextApiRequest, NextApiResponse } from "next";
import { task, taskEither, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { BlockchainInfo, getBlockchainInfo } from "../../../../lib/server/bitcoind";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: BlockchainInfo = {
  chain: "chain",
  blocks: 780003,
  headers: 780003,
  bestblockhash: "abababababababababskdvbksdbvkjdsbvkjdsvbksbv",
  difficulty: 454587975685988974,
  mediantime: 4682287764,
  verificationprogress: 0.9999996438857644,
  initialblockdownload: false,
  chainwork: "chainwork",
  size_on_disk: 567357563002,
  pruned: false,
  pruneheight: 67567365,
  automatic_pruning: false,
  prune_target_size: 57436534,
  softforks: [
    {
      id: "xxxx",
      version: 23,
      reject: {
        status: true,
      },
    },
  ],
  bip9_softforks: {
    xxxx: {
      status: "xxxx",
      bit: 24,
      startTime: 23453634,
      timeout: 37563,
      since: 6356,
      statistics: {
        period: 23,
        threshold: 23,
        elapsed: 23,
        count: 23,
        possible: 23,
      },
    },
  },
  warnings: "warnings",
};

export type Response = BlockchainInfo;

export const getRDBlockchainInfo = pipe(useRealData ? getBlockchainInfo : pipe(taskEither.right(mockData), task.delay(2000)));

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getRDBlockchainInfo),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
