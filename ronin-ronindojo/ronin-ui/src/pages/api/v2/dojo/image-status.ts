import { pipe } from "fp-ts/function";
import { either, taskEither } from "fp-ts";
import { DojoImageBuildStatus, getDojoImageBuildStatus } from "../../../../lib/server/docker";
import { NextApiRequest, NextApiResponse } from "next";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";

export type Response = DojoImageBuildStatus;

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() => getDojoImageBuildStatus),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
