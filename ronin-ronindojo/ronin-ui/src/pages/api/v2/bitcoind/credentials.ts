import { NextApiRequest, NextApiResponse } from "next";
import { apply, either, taskEither, task } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { getBitcoindV3Url } from "../../../../lib/server/bitcoind";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { getValue } from "../../../../lib/server/config-utils";
import { BITCOIND_CONFIG_PATH } from "../../../../const";

const mockData: Response = {
  rpc: {
    userName: "bitcoindMockUsername",
    password: "bitcoindRpcPassword",
    url: "mockbitcoindv3toraddressabcdabcdabcdabcdabcd.onion",
  },
};

export interface Response {
  rpc: {
    userName: string;
    password: string;
    url: string;
  };
}

const getValueFromBitcoindConfig = getValue(BITCOIND_CONFIG_PATH);

const getRpcCredentials = apply.sequenceS(taskEither.ApplyPar)({
  userName: getValueFromBitcoindConfig("BITCOIND_RPC_USER"),
  password: getValueFromBitcoindConfig("BITCOIND_RPC_PASSWORD"),
  url: getBitcoindV3Url,
});

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() =>
      pipe(
        useRealData
          ? pipe(
              getRpcCredentials,
              taskEither.map((rpcCredentials) => ({ rpc: rpcCredentials })),
            )
          : pipe(taskEither.right(mockData), task.delay(2000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
