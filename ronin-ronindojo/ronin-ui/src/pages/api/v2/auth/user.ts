import { NextApiRequest, NextApiResponse } from "next";
import { either, option } from "fp-ts";
import { pipe } from "fp-ts/function";

import { withSessionApi } from "../../../../lib/server/session";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { ErrorResponse, sendErrorIO } from "../../../../lib/server/errorResponse";
import { sendSuccessIO } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";

interface Response {
  isLoggedIn: boolean;
  username?: string;
}

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): void => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.map(() =>
      pipe(
        req.session.user,
        option.fromNullable,
        option.map((sessionData) => ({ isLoggedIn: sessionData.isLoggedIn, username: sessionData.username })),
        option.getOrElse(() => ({
          isLoggedIn: false,
        })),
      ),
    ),
    either.fold(sendErrorIO(res), sendSuccessIO(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
