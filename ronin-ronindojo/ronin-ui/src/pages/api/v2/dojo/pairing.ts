import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { Boom } from "@hapi/boom";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { useRealData } from "../../../../lib/common";
import { pairing } from "../../../../lib/server/dojoApi";

const mockData: Response = {
  pairing: {
    url: "http://mockdojourlversion3tor.onion/v2",
    type: "dojo.api",
    version: "0.10.0",
    apikey: "aBHkjbKJVKbjskchvKJBjhsv",
  },
  explorer: {
    type: "btc_rpc_explorer",
    url: "http://mockexplorerversion3tor.onion",
  },
};

export interface Response {
  pairing: {
    url: string;
    type: string;
    version: string;
    apikey: string;
  };
  explorer?: {
    type: string;
    url: string;
  };
}

export const getPairing: taskEither.TaskEither<Boom, Response> = useRealData
  ? pipe(
      pairing,
      taskEither.map((pairingResponse) => pairingResponse.data),
    )
  : pipe(taskEither.right(mockData), task.delay(2000));

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getPairing),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
