import { NextApiRequest, NextApiResponse } from "next";
import { either, taskEither, task, option, readonlyArray, string } from "fp-ts";
import { pipe, constFalse } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { getNetworkInfo } from "../../../../lib/server/bitcoind";

const mockData: Response = {
  enabled: true,
};

export interface Response {
  enabled: boolean | null;
}

export const getBloomFilterCapability: task.Task<Response> = pipe(
  useRealData
    ? pipe(
        getNetworkInfo,
        taskEither.map((networkInfo) =>
          pipe(networkInfo["localservicesnames"], option.fromNullable, option.fold(constFalse, readonlyArray.elem(string.Eq)("BLOOM"))),
        ),
        taskEither.matchW(
          () => ({ enabled: null }),
          (result) => ({ enabled: result }),
        ),
      )
    : pipe(task.of(mockData), task.delay(2000)),
);

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chainTaskK(() => getBloomFilterCapability),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
