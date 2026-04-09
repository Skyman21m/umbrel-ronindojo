import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as D from "io-ts/Decoder";
import { badRequest } from "@hapi/boom";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { RONINDOJO_FUNCTIONS } from "../../../../const";
import { unlockSudo } from "../../../../lib/server/sudo";
import { decryptString } from "../../../../lib/server/decryptString";

interface Response {
  status: "ok";
}

const RequestBody = D.struct({
  password: pipe(
    D.string,
    D.parse((s) =>
      pipe(
        decryptString(s),
        either.mapLeft(() => D.error(s, "cannot decrypt password")),
      ),
    ),
  ),
});

const methods = "POST";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    either.chain(() =>
      pipe(
        req.body,
        RequestBody.decode,
        either.mapLeft(() => badRequest("Incorrect request payload.")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain(({ password }) =>
      pipe(useRealData ? unlockSudo({ command: `. ${RONINDOJO_FUNCTIONS}; _mempool_uninstall` })(password) : pipe(taskEither.right(null), task.delay(2000))),
    ),
    taskEither.fold(sendErrorTask(res), () => sendSuccessTask(res)({ status: "ok" })),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
