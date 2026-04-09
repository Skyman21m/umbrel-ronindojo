import { NextApiRequest, NextApiResponse } from "next";
import { either, taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";

import packageJson from "../../../../package.json";

import { isMethodAllowed } from "../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../middlewares/v2";
import { withSessionApi } from "../../../lib/server/session";

const { version } = packageJson;

interface VersionInfo {
  remoteVersion: string;
  currentVersion: string;
  needsUpdate: boolean;
  changelogUrl?: string | null;
}

export interface Response {
  roninUi: VersionInfo;
  roninDojo: VersionInfo;
}

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chain(() =>
      taskEither.right({
        roninDojo: {
          currentVersion: process.env.DOJO_VERSION_TAG || "1.28.2",
          remoteVersion: process.env.DOJO_VERSION_TAG || "1.28.2",
          needsUpdate: false,
          changelogUrl: null,
        },
        roninUi: {
          currentVersion: version,
          remoteVersion: version,
          needsUpdate: false,
          changelogUrl: null,
        },
      }),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
