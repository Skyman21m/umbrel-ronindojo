import { promises as fs } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { either, taskEither, string } from "fp-ts";
import { pipe } from "fp-ts/function";

import { isMethodAllowed } from "../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../middlewares/v2";
import { withSessionApi } from "../../../lib/server/session";
import { RONIN_UI_TOR_HOSTNAME } from "../../../const";
import { toBoomError } from "../../../lib/server/to-boom-error";

export interface Response {
  torUrl: string;
}

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() =>
      pipe(
        string.Eq.equals(process.env.NODE_ENV, "production")
          ? taskEither.tryCatch(() => fs.readFile(RONIN_UI_TOR_HOSTNAME, "utf8"), toBoomError(500))
          : taskEither.right("r2emfxedbtex6dybgojzvj5byqiwfncgkp5byfia57cumv4e3ygg2nyd.onion"),
      ),
    ),
    taskEither.map(string.trim),
    taskEither.map((onionAddress) => ({ torUrl: `http://${onionAddress}` })),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
