import { promises as fs } from "fs";
import { NextApiRequest, NextApiResponse } from "next";
import { pipe } from "fp-ts/function";
import { either, task, taskEither, string } from "fp-ts";

import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { useRealData } from "../../../../lib/common";

const TOR_DATA_DIR = process.env.TOR_DATA_DIR || "/var/lib/tor";

export interface Response {
  url: string | null;
}

export const getMempoolUrl: task.Task<Response> = pipe(
  useRealData
    ? pipe(
        taskEither.tryCatch(() => fs.readFile(`${TOR_DATA_DIR}/hsv3mempool/hostname`, "utf8"), toBoomError(503)),
        taskEither.map(string.trim),
        taskEither.chain((dojoUrl) => (dojoUrl.includes(".onion") ? taskEither.right(dojoUrl) : taskEither.left(new Error("Mempool URL could not be read")))),
        taskEither.mapLeft((err) => {
          console.error("getMempoolUrl():", err);
          return err;
        }),
        taskEither.fold(
          () => task.of(null),
          (val) => task.of(val),
        ),
      )
    : task.of("ksbvkjsdbvjhbsvkbsdjvsiudgvdisgv.onion"),
  task.map((result) => ({ url: result })),
);

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<ErrorResponse | Response>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chainTaskK(() => getMempoolUrl),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
