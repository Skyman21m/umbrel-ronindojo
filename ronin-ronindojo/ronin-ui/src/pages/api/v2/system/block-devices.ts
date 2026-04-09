import { blockDevices, Systeminformation } from "systeminformation";
import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { useRealData } from "../../../../lib/common";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.BlockDevicesData[] = [
  {
    name: "nvme0n1",
    type: "disk",
    fsType: "NTFS",
    mount: "",
    size: 1024209543168,
    physical: "SSD",
    uuid: "",
    label: "",
    model: "SAMSUNG xxxxxxxxxxxx-xxxx",
    serial: "... serial ...",
    removable: false,
    protocol: "nvme",
    identifier: "",
  },
];

type Response = Systeminformation.BlockDevicesData[];

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => (useRealData ? taskEither.tryCatch(() => blockDevices(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)))),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
