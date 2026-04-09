import { NextApiRequest, NextApiResponse } from "next";
import { Boom } from "@hapi/boom";
import { number, task, taskEither, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { getBestBlockHash, getBlockHeader, BlockHeader } from "../../../../lib/server/bitcoind";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

export type Response = BlockHeader[];

const mockData: BlockHeader[] = [
  {
    hash: "svjshjsdkvshbcjsdbvjsvdjdsbvkbsdkvbdskvb",
    confirmations: 0,
    height: 720586,
    version: 1,
    versionHex: "jksbdvksb",
    merkleroot: "ksjdbvjsvbj",
    time: 1638253335,
    mediantime: 63576537465,
    nonce: 625476254,
    bits: "sjgvcjsdvcjdsc",
    difficulty: 5124613653,
    chainwork: "shdvbjsdvjsdjd",
    nTx: 2017,
    previousblockhash: "skdvbksdbvkdbsvsdkvbdsvksjlackdnlsvsdn",
    nextblockhash: null,
  },
  {
    hash: "skdvbksdbvkdbsvsdkvbdsvksjlackdnlsvsdn",
    confirmations: 1,
    height: 720585,
    version: 1,
    versionHex: "jksbdvksb",
    merkleroot: "ksjdbvjsvbj",
    time: 1638252335,
    mediantime: 63576537465,
    nonce: 625476254,
    bits: "sjgvcjsdvcjdsc",
    difficulty: 5124613653,
    chainwork: "shdvbjsdvjsdjd",
    nTx: 1847,
    previousblockhash: "sivgisvofivhsobsigblsigbsbisdvisdgvsv",
    nextblockhash: "svjshjsdkvshbcjsdbvjsvdjdsbvkbsdkvbdskvb",
  },
  {
    hash: "sivgisvofivhsobsigblsigbsbisdvisdgvsv",
    confirmations: 2,
    height: 720584,
    version: 1,
    versionHex: "dfbdbdfbdfb",
    merkleroot: "ksjdbvjsvbj",
    time: 1638243335,
    mediantime: 63576537465,
    nonce: 625476254,
    bits: "sjgvcjsdvcjdsc",
    difficulty: 5124613653,
    chainwork: "sdvsvbdsbsdb",
    nTx: 2001,
    previousblockhash: "aoůfiafaůfohafbaiavbabvkabvkavbaskvb",
    nextblockhash: "skdvbksdbvkdbsvsdkvbdsvksjlackdnlsvsdn",
  },
];

const BLOCK_COUNT = 3;

const getSequenceBlockHeaders = (blockhash: string, num: number, arr: BlockHeader[] = []): taskEither.TaskEither<Boom, BlockHeader[]> =>
  pipe(
    number.Eq.equals(num, 0)
      ? taskEither.right(arr)
      : pipe(
          getBlockHeader(blockhash),
          taskEither.chain((blockHeader) => getSequenceBlockHeaders(blockHeader.previousblockhash, num - 1, [...arr, blockHeader])),
        ),
  );

const methods = "GET";

export const getLastBlocks = pipe(
  useRealData
    ? pipe(
        getBestBlockHash,
        taskEither.chain((bestblockhash) => getSequenceBlockHeaders(bestblockhash, BLOCK_COUNT)),
      )
    : pipe(taskEither.right(mockData), task.delay(2000)),
);

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getLastBlocks),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
