import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, either, task, apply } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as D from "io-ts/Decoder";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { setValues } from "../../../../lib/server/config-utils";
import { BITCOIND_CONFIG_PATH, NODE_CONFIG_PATH } from "../../../../const";

const mockData = {
  status: "ok" as const,
};

const RequestBody = D.partial({
  BITCOIND_MEMPOOL_EXPIRY: D.number,
  BITCOIND_PERSIST_MEMPOOL: D.boolean,
  BITCOIND_BAN_KNOTS: D.boolean,
  NODE_PANDOTX_PUSH: D.boolean,
  NODE_PANDOTX_PROCESS: D.boolean,
});

type DojoSettingsData = D.TypeOf<typeof RequestBody>;

interface Response {
  status: "ok";
}

const setBitcoinConfigValues = setValues(BITCOIND_CONFIG_PATH);
const setNodeConfigValues = setValues(NODE_CONFIG_PATH);

const setSettings = (data: DojoSettingsData) =>
  apply.sequenceT(taskEither.ApplyPar)(
    setBitcoinConfigValues({
      BITCOIND_MEMPOOL_EXPIRY: data.BITCOIND_MEMPOOL_EXPIRY,
      BITCOIND_PERSIST_MEMPOOL: data.BITCOIND_PERSIST_MEMPOOL,
      BITCOIND_BAN_KNOTS: data.BITCOIND_BAN_KNOTS,
    }),
    setNodeConfigValues({ NODE_PANDOTX_PUSH: data.NODE_PANDOTX_PUSH, NODE_PANDOTX_PROCESS: data.NODE_PANDOTX_PROCESS }),
  );

const methods = "PATCH";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.body,
        RequestBody.decode,
        either.mapLeft(() => badRequest("Correct request body not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain((data) =>
      pipe(
        useRealData
          ? pipe(
              setSettings(data),
              taskEither.map(() => ({ status: "ok" as const })),
            )
          : pipe(taskEither.right(mockData), task.delay(5000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
