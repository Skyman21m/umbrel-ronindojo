import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { currentLoad, Systeminformation } from "systeminformation";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: Systeminformation.CurrentLoadData = {
  avgLoad: 0.23,
  currentLoad: 4.326328800988875,
  currentLoadUser: 2.595797280593325,
  currentLoadSystem: 1.73053152039555,
  currentLoadNice: 0,
  currentLoadIdle: 95.67367119901112,
  currentLoadIrq: 0,
  currentLoadSteal: 2.8757658,
  currentLoadGuest: 1.87564758,
  rawCurrentLoad: 350,
  rawCurrentLoadUser: 210,
  rawCurrentLoadSystem: 140,
  rawCurrentLoadNice: 0,
  rawCurrentLoadIdle: 7740,
  rawCurrentLoadIrq: 0,
  rawCurrentLoadSteal: 2.857658,
  rawCurrentLoadGuest: 1.986865,
  cpus: [
    {
      load: 13.725490196078432,
      loadUser: 7.8431372549019605,
      loadSystem: 5.88235294117647,
      loadNice: 0,
      loadIdle: 86.27450980392157,
      loadIrq: 0,
      loadSteal: 2.67575,
      loadGuest: 1.785,
      rawLoad: 140,
      rawLoadUser: 80,
      rawLoadSystem: 60,
      rawLoadNice: 0,
      rawLoadIdle: 880,
      rawLoadIrq: 0,
      rawLoadSteal: 2.778768,
      rawLoadGuest: 1.76464,
    },
  ],
};

export type Response = Systeminformation.CurrentLoadData;

const methods = "GET";

export const getCurrentLoad = pipe(
  useRealData ? taskEither.tryCatch(() => currentLoad(), toBoomError(503)) : pipe(taskEither.right(mockData), task.delay(2000)),
);

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getCurrentLoad),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
