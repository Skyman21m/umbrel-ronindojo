import { NextApiRequest, NextApiResponse } from "next";
import { badRequest } from "@hapi/boom";
import { taskEither, either, task } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { HexString } from "../../../../lib/common/types";
import { pushTx } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

const mockData = {
  status: "ok" as const,
  data: "<txid>",
};

const RequestBody = t.type({
  tx: HexString,
});

interface Response {
  status: "ok";
  data: string;
}

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
    taskEither.chain(({ tx }) =>
      pipe(
        useRealData
          ? pipe(
              pushTx(tx),
              taskEither.map((pushTxResponse) => pushTxResponse.data),
            )
          : pipe(taskEither.right(mockData), task.delay(5000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
