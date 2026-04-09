import { NextApiRequest, NextApiResponse } from "next";
import { either, io } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { ErrorResponse, sendErrorIO } from "../../../../lib/server/errorResponse";
import { sendSuccessIO } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";

interface Response {
  isLoggedIn: boolean;
}

const methods = "POST";

const destroySession =
  (req: NextApiRequest): io.IO<void> =>
  () =>
    req.session.destroy();

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): void => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.fold(sendErrorIO(res), () =>
      pipe(
        destroySession(req),
        io.chain(() => sendSuccessIO(res)({ isLoggedIn: false })),
      ),
    ),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
