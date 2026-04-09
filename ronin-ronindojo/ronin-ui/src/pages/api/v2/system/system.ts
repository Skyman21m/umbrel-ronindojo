import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { system, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.SystemData = {
  manufacturer: "Apple Inc.",
  model: "MacBookPro13,2",
  version: "1.0",
  serial: "C01xxxxxxxx",
  uuid: "F87654-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  sku: "Mac-99878xxxx...",
  virtual: false,
};

type Response = Systeminformation.SystemData;

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => pipe(useRealData ? taskEither.tryCatch(() => system(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)))),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
