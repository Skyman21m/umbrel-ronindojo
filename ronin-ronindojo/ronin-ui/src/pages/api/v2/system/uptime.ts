import { NextApiRequest, NextApiResponse } from "next";
import { either, ioEither } from "fp-ts";
import { pipe } from "fp-ts/function";
import { time, Systeminformation } from "systeminformation";
import { Boom } from "@hapi/boom";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorIO } from "../../../../lib/server/errorResponse";
import { sendSuccessIO } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { toBoomError } from "../../../../lib/server/to-boom-error";

export type Response = Systeminformation.TimeData;

const methods = "GET";

export const getUptime: ioEither.IOEither<Boom, Response> = ioEither.tryCatch(() => time(), toBoomError(500));

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): void => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    ioEither.fromEither,
    ioEither.chain(() => getUptime),
    ioEither.fold(sendErrorIO(res), sendSuccessIO(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
