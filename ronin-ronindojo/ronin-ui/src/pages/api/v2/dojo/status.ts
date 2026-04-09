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
import { dojoStatus, StatusResponse } from "../../../../lib/server/dojoApi";

const mockData: StatusResponse = {
  uptime: "001:04:27:58",
  memory: "96 MiB",
  ws: {
    clients: 0,
    sessions: 0,
    max: 0,
  },
  blocks: 780003,
  indexer: {
    type: "local_indexer",
    url: null,
    maxHeight: 780003,
  },
};

const methods = "GET";

export const getDojoStatus = pipe(
  useRealData
    ? pipe(
        dojoStatus,
        taskEither.map((statusResponse) => statusResponse.data),
      )
    : pipe(taskEither.right(mockData), task.delay(2000)),
);

const handler = (req: NextApiRequest, res: NextApiResponse<StatusResponse | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getDojoStatus),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
