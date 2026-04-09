import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { addressInfo, AddressInfoResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: AddressInfoResponse = {
  address: "bc1qv478wpscra4gsqnzhnkwcznw2vav5j7qkw6gls",
  tracked: true,
  type: "hd",
  balance: 1000,
  xpub: "xpubadvcksdhbvkjsbdkvdsvjsdbsklndfvndfjvvnadbjks",
  path: "m/0/0/82",
  segwit: true,
  n_tx: 1,
  txids: ["klsdjifwkbevlnsjhkdbvdsksdkvjbds"],
  utxo: [
    {
      txid: "ksbvjhbjdjshdbjsdbdjsjhdvbhdjsv",
      vout: 0,
      amount: 1000,
    },
  ],
};

const RequestQuery = t.type({
  address: t.string,
});

export const getAddressInfo = (address: string) =>
  useRealData
    ? pipe(
        addressInfo(address),
        taskEither.map((addressInfoResponse) => addressInfoResponse.data),
      )
    : pipe(taskEither.right(mockData), task.delay(2000));

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<AddressInfoResponse | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.query,
        RequestQuery.decode,
        either.mapLeft(() => badRequest("Correct request query not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ address }) => getAddressInfo(address)),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
