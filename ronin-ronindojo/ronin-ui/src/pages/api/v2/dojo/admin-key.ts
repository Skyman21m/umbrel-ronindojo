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
import { getDojoAdminKey } from "../../../../lib/server/dojoCredentials";

const mockData: Response = {
  adminKey: "randomAdminKeyjkbdsjv",
};

export interface Response {
  adminKey: string;
}

export const getAdminKey = useRealData
  ? pipe(
      getDojoAdminKey,
      taskEither.map((adminKey) => ({ adminKey })),
    )
  : pipe(taskEither.right(mockData), task.delay(2000));

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getAdminKey),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
