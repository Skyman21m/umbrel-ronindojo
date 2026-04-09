import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { xpubRescan, XpubRescanResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: XpubRescanResponse = {
  status: "ok",
};

const RequestBody = t.type({
  xpub: t.string,
  startidx: t.number,
  gap: t.number,
});

interface Response extends XpubRescanResponse {}

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.body,
        RequestBody.decode,
        either.mapLeft(() => badRequest("Correct request body not provided.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ xpub, startidx, gap }) =>
      pipe(
        useRealData
          ? pipe(
              xpubRescan(xpub, startidx, gap),
              taskEither.map((xpubRescanResponse) => xpubRescanResponse.data),
            )
          : pipe(taskEither.right(mockData), task.delay(5000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
