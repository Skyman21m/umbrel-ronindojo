import { NextApiRequest, NextApiResponse } from "next";
import { taskEither, task, either, option, readonlyArray as ROA } from "fp-ts";
import { pipe, flow } from "fp-ts/function";

import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { useRealData } from "../../../../lib/common";
import { withSessionApi } from "../../../../lib/server/session";
import { getContainerInfo, Response as ContainerInfoResponse } from "../dojo/containers";

const mockData: Response = { type: "Fulcrum" };

export type IndexerType = "Addrindexrs" | "Electrs" | "Fulcrum" | null;

export interface Response {
  type: IndexerType;
}

const translateIndexerType = (containerInfoData: ContainerInfoResponse | null | undefined): IndexerType =>
  pipe(
    containerInfoData,
    option.fromNullable,
    option.map(
      flow(
        ROA.reduce(null as IndexerType, (str, container) => {
          const name = container.Names.join("").toLowerCase();
          if (name.includes("fulcrum")) return "Fulcrum";
          if (name.includes("electrs")) return "Electrs";
          if (name.includes("indexer")) return "Addrindexrs";
          return str;
        }),
      ),
    ),
    option.toNullable,
  );

export const getIndexerType: task.Task<Response> = pipe(
  useRealData
    ? pipe(
        getContainerInfo,
        taskEither.map(translateIndexerType),
        taskEither.match(
          () => ({ type: null }),
          (result) => ({ type: result }),
        ),
      )
    : pipe(task.of(mockData), task.delay(2000)),
);

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<ErrorResponse | Response>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.chainTaskK(() => getIndexerType),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
