import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { WalletParamsCodec } from "../../../../lib/common/types";
import { wallet, WalletResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

interface Response extends WalletResponse {}

export const getWalletInfo = (params: WalletParamsCodec) =>
  useRealData
    ? pipe(
        wallet(params),
        taskEither.map((xpubInfoResponse) => xpubInfoResponse.data),
      )
    : pipe(taskEither.right(mockData), task.delay(2000));

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.query,
        WalletParamsCodec.decode,
        either.mapLeft(() => badRequest("Correct request query not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain((params) => getWalletInfo(params)),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));

const mockData: WalletResponse = {
  wallet: {
    final_balance: 100000000,
  },
  info: {
    latest_block: {
      height: 100000,
      hash: "abcdef",
      time: 1000000000,
    },
    fees: {
      "2": 181,
      "4": 150,
      "6": 150,
      "12": 111,
      "24": 62,
    },
  },
  addresses: [
    {
      address: "xpubABCDEF -or- 1xAddress",
      pubkey: "04Pubkey -or- inexistant attribute",
      final_balance: 100000000,
      account_index: 0,
      change_index: 0,
      n_tx: 0,
    },
  ],
  txs: [
    {
      block_height: 100000,
      hash: "a7b1932c8589702ba4c90846595e6c09cdcfda1d2036fcc8c5ba24ef10db0a28",
      version: 1,
      locktime: 0,
      result: -10000,
      balance: 90000,
      time: 1400000000,
      inputs: [
        {
          vin: 1,
          prev_out: {
            txid: "abcdef",
            vout: 2,
            value: 20000,
            xpub: {
              m: "xpubABCDEF",
              path: "M/0/3",
            },
            addr: "1xAddress",
            pubkey: "04Pubkey",
          },
          sequence: 4294967295,
        },
      ],
      out: [
        {
          n: 2,
          value: 10000,
          addr: "1xAddress",
          pubkey: "03Pubkey",
          xpub: {
            m: "xpubABCDEF",
            path: "M/1/5",
          },
        },
      ],
    },
    {
      block_height: 100000,
      hash: "cfd0f677389f68f30608f6746de637ae7bf4f12b59ef8c238cedf14f782efef6",
      version: 1,
      locktime: 0,
      result: -10000,
      balance: 90000,
      time: 1400000000,
      inputs: [
        {
          vin: 1,
          prev_out: {
            txid: "abcdef",
            vout: 2,
            value: 20000,
            xpub: {
              m: "xpubABCDEF",
              path: "M/0/3",
            },
            addr: "1xAddress",
            pubkey: "04Pubkey",
          },
          sequence: 4294967295,
        },
      ],
      out: [
        {
          n: 2,
          value: 10000,
          addr: "1xAddress",
          pubkey: "03Pubkey",
          xpub: {
            m: "xpubABCDEF",
            path: "M/1/5",
          },
        },
      ],
    },
  ],
  unspent_outputs: [
    {
      tx_hash: "abcdefskjdvnsdlvadlnklsnvlsdv",
      tx_output_n: 2,
      tx_version: 1,
      tx_locktime: 0,
      value: 10000,
      script: "abcdef",
      addr: "1xAddress",
      confirmations: 10000,
      xpub: {
        m: "xpubABCDEF",
        path: "M/1/5",
      },
    },
    {
      tx_hash: "abcdefskjdvnsdlvadlnklsnvlsdv",
      tx_output_n: 3,
      tx_version: 1,
      tx_locktime: 0,
      value: 15000,
      script: "abcdef",
      addr: "1xAddress",
      confirmations: 10000,
      xpub: {
        m: "xpubABCDEF",
        path: "M/1/5",
      },
    },
    {
      tx_hash: "abcdefsldjnvksljdvn",
      tx_output_n: 2,
      tx_version: 1,
      tx_locktime: 0,
      value: 65365800,
      script: "abcdef",
      addr: "1xAddress",
      pubkey: "03Pubkey -or- inexistant attribute",
      confirmations: 10000,
      xpub: {
        m: "xpubABCDEF",
        path: "M/1/5",
      },
    },
  ],
};
