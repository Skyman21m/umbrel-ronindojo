import { NextApiRequest, NextApiResponse } from "next";
import { either, taskEither, task, apply, option, readonlyArray as ROA } from "fp-ts";
import { pipe, flow, constFalse, constTrue } from "fp-ts/function";

import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { isUserAuthorized } from "../../../../lib/server/isUserAuthorized";
import { isDockerRunning, listContainers } from "../../../../lib/server/docker";
import { getRDBlockchainInfo } from "../bitcoind/blockchain-info";
import { getDojoStatus } from "../dojo/status";
import { getRaceTaskEither } from "../../../../lib/server/raceTaskEither";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { useRealData } from "../../../../lib/common";

type RoninDojoStatus = {
  dockerRunning: boolean;
  docker: {
    bitcoindRunning: boolean;
    nodejsRunning: boolean;
    indexerRunning: boolean;
  };
  dojo: {
    ibdFinished: boolean;
    dojoSynced: boolean;
    indexerSynced: boolean;
  };
};

const getRoninDojoServiceStatus: task.Task<RoninDojoStatus> = apply.sequenceS(task.ApplyPar)({
  dockerRunning: isDockerRunning,
  docker: pipe(
    listContainers,
    task.chain((containersEither) =>
      apply.sequenceS(task.ApplyPar)({
        // On Umbrel, Bitcoin is managed externally — always consider it running
        bitcoindRunning: task.of(true),
        nodejsRunning: pipe(
          containersEither,
          either.map(
            flow(
              ROA.findFirst((container) =>
                container.Names.join("").includes("nodejs") || container.Names.join("").includes("_node_"),
              ),
              option.map((container) => container.State.toLowerCase() === "running"),
              option.getOrElse(constFalse),
            ),
          ),
          either.getOrElse(constFalse),
          task.of,
        ),
        indexerRunning: pipe(
          containersEither,
          either.map(
            flow(
              ROA.findFirst(
                (container) =>
                  container.Names.join("").includes("indexer") || container.Names.join("").includes("electrs") || container.Names.join("").includes("fulcrum"),
              ),
              option.map((container) => container.State.toLowerCase() === "running"),
              option.getOrElse(constFalse),
            ),
          ),
          either.getOrElse(constFalse),
          task.of,
        ),
      }),
    ),
  ),
  dojo: pipe(
    apply.sequenceT(task.ApplyPar)(getRDBlockchainInfo, getRaceTaskEither(getDojoStatus)),
    task.chain(([blockchainInfoEither, dojoStatusEither]) =>
      apply.sequenceS(task.ApplyPar)({
        ibdFinished: pipe(
          blockchainInfoEither,
          either.fold(constFalse, (blockchainInfo) => blockchainInfo.initialblockdownload === false),
          task.of,
        ),
        dojoSynced: pipe(
          blockchainInfoEither,
          either.chain((blockchainInfo) =>
            pipe(
              dojoStatusEither,
              either.map((dojoStatus) => blockchainInfo.blocks - 3 <= (dojoStatus?.blocks ?? 0)),
            ),
          ),
          either.getOrElse(constTrue),
          task.of,
        ),
        indexerSynced: pipe(
          blockchainInfoEither,
          either.chain((blockchainInfo) =>
            pipe(
              dojoStatusEither,
              either.map((dojoStatus) => blockchainInfo.blocks - 3 <= (dojoStatus?.indexer?.maxHeight ?? 0)),
            ),
          ),
          either.getOrElse(constTrue),
          task.of,
        ),
      }),
    ),
  ),
});

export type RoninDojoHealth =
  | "OK"
  | "DOCKER_NOT_RUNNING"
  | "BITCOIND_NOT_RUNNING"
  | "NODEJS_NOT_RUNNING"
  | "INDEXER_NOT_RUNNING"
  | "IBD_NOT_FINISHED"
  | "DOJO_NOT_SYNCED"
  | "INDEXER_NOT_SYNCED";

const getRoninDojoHealth = (rdStatusData: RoninDojoStatus): RoninDojoHealth =>
  pipe(
    rdStatusData,
    either.right,
    either.chainFirstW(({ dockerRunning }) => (dockerRunning ? either.right(null) : either.left("DOCKER_NOT_RUNNING" as const))),
    either.chainFirstW(({ docker }) => (docker.bitcoindRunning ? either.right(null) : either.left("BITCOIND_NOT_RUNNING" as const))),
    either.chainFirstW(({ docker }) => (docker.nodejsRunning ? either.right(null) : either.left("NODEJS_NOT_RUNNING" as const))),
    either.chainFirstW(({ docker }) => (docker.indexerRunning ? either.right(null) : either.left("INDEXER_NOT_RUNNING" as const))),
    either.chainFirstW(({ dojo }) => (dojo.ibdFinished ? either.right(null) : either.left("IBD_NOT_FINISHED" as const))),
    either.chainFirstW(({ dojo }) => (dojo.dojoSynced ? either.right(null) : either.left("DOJO_NOT_SYNCED" as const))),
    either.chainFirstW(({ dojo }) => (dojo.indexerSynced ? either.right(null) : either.left("INDEXER_NOT_SYNCED" as const))),
    either.match(
      (err) => err,
      () => "OK" as const,
    ),
  );

export const getRoninDojoStatus: task.Task<RoninDojoHealth> = pipe(useRealData ? pipe(getRoninDojoServiceStatus, task.map(getRoninDojoHealth)) : task.of("OK"));

export type RoninDojoStatusResponse = {
  status: RoninDojoHealth;
};

const methods = "GET";

const handler = (req: NextApiRequest, res: NextApiResponse<RoninDojoStatusResponse | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => isUserAuthorized(req)),
    taskEither.fromEither,
    taskEither.fold(sendErrorTask(res), () =>
      pipe(
        getRoninDojoStatus,
        task.chain((status) => sendSuccessTask(res)({ status })),
      ),
    ),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
