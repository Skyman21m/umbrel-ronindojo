import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { fsSize, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.FsSizeData[] = [
  {
    fs: "/dev/md2",
    type: "ext4",
    size: 972577361920,
    used: 59142635520,
    available: 49142635520,
    use: 6.08,
    mount: "/",
    rw: null,
  },
  {
    fs: "/dev/sda1",
    type: "ext4",
    size: 872112541920,
    used: 59142635520,
    available: 49142635520,
    use: 6.08,
    mount: "/mnt",
    rw: null,
  },
];

export type Response = Systeminformation.FsSizeData[];

const methods = "GET";

export const getFsSizeData = pipe(useRealData ? taskEither.tryCatch(() => fsSize(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)));

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getFsSizeData),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
