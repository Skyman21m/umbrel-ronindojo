import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, task, either, boolean, io, random } from "fp-ts";
import { pipe, flow } from "fp-ts/function";
import * as t from "io-ts";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { xpubImportStatus, XpubImportStatusResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

const mockDataFalse: XpubImportStatusResponse = {
  status: "ok",
  data: {
    import_in_progress: false,
  },
};

const mockDataTrue: XpubImportStatusResponse = {
  status: "ok",
  data: {
    import_in_progress: true,
    status: "rescan",
    hits: 1143,
  },
};

const getMockData: io.IO<XpubImportStatusResponse> = pipe(
  random.randomBool,
  io.map(
    flow(
      boolean.foldW(
        () => mockDataFalse,
        () => mockDataTrue,
      ),
    ),
  ),
);

const RequestQuery = t.type({
  xpub: t.string,
});

export type Response = XpubImportStatusResponse;

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.query,
        RequestQuery.decode,
        either.mapLeft(() => badRequest("Correct request query not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ xpub }) =>
      pipe(
        useRealData
          ? pipe(
              xpubImportStatus(xpub),
              taskEither.map((xpubImportStatusResponse) => xpubImportStatusResponse.data),
            )
          : pipe(getMockData, taskEither.rightIO, task.delay(2000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
