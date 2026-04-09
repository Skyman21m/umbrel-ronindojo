import { NextApiRequest, NextApiResponse } from "next";
import { pipe } from "fp-ts/function";
import { apply, either, task, taskEither, tuple } from "fp-ts";
import * as t from "io-ts";
import { NonEmptyString } from "io-ts-types/NonEmptyString";
import { badRequest } from "@hapi/boom";

import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { useRealData } from "../../../../lib/common";
import { computeBoltzmann } from "../../../../lib/server/boltzmann";
import { txInfo, TxInfoResponse } from "../../../../lib/server/dojoApi";
import { decodeScript } from "../../../../lib/server/bitcoind";

const RequestBody = t.type({
  txid: NonEmptyString,
});

export interface Response {
  nbCmbn: number;
  matLnkCombinations: number[][] | null;
  matLnkProbabilities: number[][] | null;
  entropy: number;
  dtrmLnksById: [number, number][];
  dtrmLnks: [string, string][];
  txos: {
    inputs: [string, number][];
    outputs: [string, number][];
  };
  fees: number;
  intraFees: {
    feesMaker: number;
    feesTaker: number;
    hasFees: boolean;
  };
  efficiency: number | null;
  nbCmbnPrfctCj: string | null;
  nbTxosPrfctCj: {
    nbIns: number;
    nbOuts: number;
  };
}

const normalizeInputs = (inputs: TxInfoResponse["inputs"]) => {
  const normalizedInputs: [string, number][] = [];

  for (const input of inputs) {
    if (input.outpoint) {
      normalizedInputs.push([input.outpoint.scriptpubkey, input.outpoint.value]);
    }
  }

  return normalizedInputs;
};

const normalizeOutputs = (outputs: TxInfoResponse["outputs"]) => {
  const normalizedOutputs: [string, number][] = [];

  for (const output of outputs) {
    normalizedOutputs.push([output.address ?? output.scriptpubkey, output.value]);
  }

  return normalizedOutputs;
};

const getTxos = (txid: string) =>
  pipe(
    txInfo(txid),
    taskEither.map(({ data }) => ({
      inputs: normalizeInputs(data.inputs),
      outputs: normalizeOutputs(data.outputs),
    })),
    taskEither.flatMap(({ inputs, outputs }) =>
      apply.sequenceS(taskEither.ApplyPar)({
        inputs: taskEither.sequenceArray(
          inputs.map(([scriptpubkey, value]) =>
            pipe(
              decodeScript(scriptpubkey),
              taskEither.map((decodedScript) => [decodedScript.address ?? scriptpubkey, value] as [string, number]),
            ),
          ),
        ),
        outputs: taskEither.right(outputs),
      }),
    ),
    // dirty hack because sequenceArray returns readonly Array
    taskEither.map(({ inputs, outputs }) => ({ inputs: [...inputs], outputs })),
  );

export const getBoltzmann = (txid: string) =>
  useRealData ? pipe(getTxos(txid), taskEither.chain(computeBoltzmann)) : pipe(taskEither.right(mockData), task.delay(1000));

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        RequestBody.decode(req.body),
        either.mapLeft(() => badRequest("Incorrect request payload.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ txid }) => getBoltzmann(txid)),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));

const mockData = {
  nbCmbn: 3,
  matLnkCombinations: [
    [3, 1],
    [3, 1],
    [3, 1],
    [2, 2],
  ],
  matLnkProbabilities: [
    [1, 0.3333333333333333],
    [1, 0.3333333333333333],
    [1, 0.3333333333333333],
    [0.6666666666666666, 0.6666666666666666],
  ],
  entropy: 1.584962500721156,
  dtrmLnksById: [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  dtrmLnks: [
    ["bc1qrt7rkpswpgmcag7txzf6ps9mvepwgndshqdx6d", "3K2PhMfZHZZzvvW4GwmNnJzVPn1CedZVAi"],
    [
      "512102864f70990fc3077272c69142002b01c633cc3358d9c7e1ee01093720ec55795d2103e73272dac05fa598e88b8d6ba316554c9bbf0336feed7d9e64960d0cf5e119792102020202020202020202020202020202020202020202020202020202020202020253ae",
      "3K2PhMfZHZZzvvW4GwmNnJzVPn1CedZVAi",
    ],
    [
      "512102612128767b7fc5fe7290f694d181d897182bcbee7074b436c7d128743c6ab02b21039074e04be054a2b1631e71591886114379f13213260dcec70439604d3d9e1d002102020202020202020202020202020202020202020202020202020202020202020253ae",
      "3K2PhMfZHZZzvvW4GwmNnJzVPn1CedZVAi",
    ],
  ],
  txos: {
    inputs: [
      ["3K2PhMfZHZZzvvW4GwmNnJzVPn1CedZVAi", 136423],
      ["bc1qndwhntf80jv90kkkgvs67vp48hhpxeetrk9f5m", 547],
    ],
    outputs: [
      ["bc1qrt7rkpswpgmcag7txzf6ps9mvepwgndshqdx6d", 128391],
      [
        "512102864f70990fc3077272c69142002b01c633cc3358d9c7e1ee01093720ec55795d2103e73272dac05fa598e88b8d6ba316554c9bbf0336feed7d9e64960d0cf5e119792102020202020202020202020202020202020202020202020202020202020202020253ae",
        796,
      ],
      [
        "512102612128767b7fc5fe7290f694d181d897182bcbee7074b436c7d128743c6ab02b21039074e04be054a2b1631e71591886114379f13213260dcec70439604d3d9e1d002102020202020202020202020202020202020202020202020202020202020202020253ae",
        796,
      ],
      ["bc1qxnxax28xs0zz4m6erakvycu33np8zmf0jzvm6m", 547],
    ],
  },
  fees: 6440,
  intraFees: {
    feesMaker: 0,
    feesTaker: 0,
    hasFees: false,
  },
  efficiency: 0.42857142857142855,
  nbCmbnPrfctCj: "7",
  nbTxosPrfctCj: {
    nbIns: 2,
    nbOuts: 4,
  },
} satisfies Response;
