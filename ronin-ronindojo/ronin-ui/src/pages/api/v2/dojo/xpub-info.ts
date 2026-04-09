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
import { xpubInfo, XpubInfoResponse } from "../../../../lib/server/dojoApi";
import { withSessionApi } from "../../../../lib/server/session";

const mockData: XpubInfoResponse = {
  xpub: "xpubabcdegfhajkvbaldvbsdjvhksdvbjdhvkshvjsdnav",
  tracked: true,
  balance: 1000,
  unused: {
    external: 1234,
    internal: 127,
  },
  derived: {
    external: 1270,
    internal: 180,
  },
  n_tx: 1,
  derivation: "BIP84",
  account: 0,
  depth: 3,
  created: "Sun Feb 14 2021 20:30:47",
};

const RequestQuery = t.type({
  xpub: t.string,
});

interface Response extends XpubInfoResponse {}

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
              xpubInfo(xpub),
              taskEither.map((xpubInfoResponse) => xpubInfoResponse.data),
            )
          : pipe(taskEither.right(mockData), task.delay(2000)),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
