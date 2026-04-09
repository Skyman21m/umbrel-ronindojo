import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { useRealData } from "../../../../lib/common";
import { fees, FeesResponse } from "../../../../lib/server/dojoApi";

const mockData: FeesResponse = {
  "2": 181,
  "4": 150,
  "6": 150,
  "12": 111,
  "24": 62,
};

const methods = "GET";

export const getFees = pipe(
  useRealData
    ? pipe(
        fees,
        taskEither.map((feesResponse) => feesResponse.data),
      )
    : pipe(taskEither.right(mockData), task.delay(2000)),
);

const handler = (req: NextApiRequest, res: NextApiResponse<FeesResponse | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getFees),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
