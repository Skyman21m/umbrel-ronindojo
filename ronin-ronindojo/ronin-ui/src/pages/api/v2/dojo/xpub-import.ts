import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { XpubImportParamsCodec } from "../../../../lib/common/types";
import { xpubImport, XpubImportResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: XpubImportResponse = {
  status: "ok",
};

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<XpubImportResponse | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.body,
        XpubImportParamsCodec.decode,
        either.mapLeft(() => badRequest("Correct request body not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain((params) =>
      pipe(
        useRealData
          ? pipe(
              xpubImport(params),
              taskEither.map((xpubImportResponse) => xpubImportResponse.data),
            )
          : pipe(taskEither.right(mockData), task.delay(5000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
