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
import { getIndexerType, IndexerType } from "./indexer-type";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { Boom } from "@hapi/boom";
import { useRealData } from "../../../../lib/common";

const TOR_DATA_DIR = process.env.TOR_DATA_DIR || "/var/lib/tor";

export interface Response {
  url: string | null;
}

const matchIndexer = (indexerType: IndexerType): taskEither.TaskEither<Boom, string | null> => {
  switch (indexerType) {
    case "Fulcrum":
      return pipe(taskEither.tryCatch(() => fs.readFile(`${TOR_DATA_DIR}/hsv3fulcrum/hostname`, "utf8"), toBoomError(503)), taskEither.map(string.trim));
    case "Electrs":
      return pipe(taskEither.tryCatch(() => fs.readFile(`${TOR_DATA_DIR}/hsv3electrs/hostname`, "utf8"), toBoomError(503)), taskEither.map(string.trim));
    default:
      return taskEither.right(null);
  }
};

export const getIndexerUrl: task.Task<Response> = pipe(
  useRealData
    ? pipe(
        getIndexerType,
        task.chain((indexerType) =>
          pipe(
            matchIndexer(indexerType.type),
            taskEither.mapLeft((err) => {
              console.error("getIndexerUrl():", err);
              return err;
            }),
            taskEither.fold(
              () => task.of(null),
              (val) => task.of(val),
            ),
          ),
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
    taskEither.chainTaskK(() => getIndexerUrl),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
