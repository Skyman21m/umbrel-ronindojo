import stream from "stream";
import Dockerode, { Exec } from "dockerode";
import { Boom } from "@hapi/boom";
import { taskEither, task, io, array, either, record, option, string, boolean } from "fp-ts";
import { constFalse, constTrue, pipe, flow } from "fp-ts/function";
import * as t from "io-ts";

import { readStream } from "./stream-to-promise";
import { toBoomError } from "./to-boom-error";
import { useRealData } from "../common";

export const getDockerode: io.IO<Dockerode> = io.of(new Dockerode({ socketPath: "/var/run/docker.sock" }));

// Container name patterns to match — on Umbrel containers are named ronin-ronindojo_<service>_1
const CONTAINER_NAME_PATTERNS = [
  "nginx", "node", "nodejs", "bitcoind", "indexer", "db",
  "tor", "explorer", "mempool", "fulcrum", "electrs", "soroban"
];

export const ContainersCodec = t.keyof({
  nginx: null,
  nodejs: null,
  node: null,
  bitcoind: null,
  indexer: null,
  db: null,
  tor: null,
  explorer: null,
  mempool_db: null,
  mempool_api: null,
  mempool_web: null,
  fulcrum: null,
  electrs: null,
  soroban: null,
});

type ContainersCodec = t.TypeOf<typeof ContainersCodec>;

interface Options {
  Cmd: string[];
  Env?: string[];
}

export const demuxStream =
  (container: Dockerode.Container) =>
  (dockerStream: stream.Duplex | NodeJS.ReadableStream): stream.PassThrough => {
    const logStream = new stream.PassThrough();

    container.modem.demuxStream(dockerStream, logStream, logStream);

    dockerStream.on("end", () => {
      logStream.end();
    });

    return logStream;
  };

// Find a container by matching a pattern in its name
export const findContainerByName = (dockerode: Dockerode, pattern: string): taskEither.TaskEither<Boom, Dockerode.Container> =>
  pipe(
    taskEither.tryCatch(() => dockerode.listContainers({ all: true }), toBoomError(503)),
    taskEither.chain((containers) => {
      const found = containers.find((c) => c.Names.some((n) => n.toLowerCase().includes(pattern.toLowerCase())));
      if (found) {
        return taskEither.right(dockerode.getContainer(found.Id));
      }
      // Fallback: try direct name lookup
      return taskEither.right(dockerode.getContainer(pattern));
    }),
  );

export const execAndGetResult =
  (containerName: string) =>
  (options: Options): taskEither.TaskEither<Boom, string> =>
    pipe(
      getDockerode,
      taskEither.fromIO,
      taskEither.chain((dockerode) => findContainerByName(dockerode, containerName)),
      taskEither.chain((container) =>
        pipe(
          taskEither.tryCatch(() => container.exec({ ...options, AttachStdout: true, AttachStderr: true }), toBoomError(503)),
          taskEither.chain((exec: Exec) =>
            pipe(
              taskEither.tryCatch(() => exec.start({ Tty: false }), toBoomError(503)),
              taskEither.map(demuxStream(container)),
              taskEither.chain(readStream),
            ),
          ),
        ),
      ),
    );

export const execAndGetResultFromTor = execAndGetResult(process.env.DOCKER_TOR_CONTAINER || "tor");

export const listContainers = pipe(
  getDockerode,
  taskEither.fromIO,
  taskEither.chain((dockerode) => taskEither.tryCatch(() => dockerode.listContainers({ all: true }), toBoomError(503))),
  taskEither.map(array.filter((containerInfo) => {
    const name = containerInfo.Names.join("").toLowerCase();
    return name.includes("ronin-ronindojo") && CONTAINER_NAME_PATTERNS.some(pattern => name.includes(pattern));
  })),
);

export const isDockerRunning: task.Task<boolean> = pipe(
  useRealData
    ? pipe(
        getDockerode,
        taskEither.fromIO,
        taskEither.chain((docker) => pipe(taskEither.tryCatch(() => docker.ping(), either.toError))),
        taskEither.match(constFalse, constTrue),
      )
    : task.of(true),
);

export type DojoImageStatus = "ready" | "none";

export type DojoImageTagName = string;

type RequiredDojoImages = "nodejs" | "explorer" | "bitcoind" | "tor" | "nginx" | "db" | "indexer";

export type DojoImageBuildStatus = Readonly<Record<RequiredDojoImages, DojoImageStatus>>;

const dojoImageStatus: Readonly<Record<RequiredDojoImages, Array<string>>> = {
  nodejs: ["dojo-nodejs", "skyman21m/dojo-nodejs"],
  explorer: ["dojo-explorer", "skyman21m/dojo-explorer"],
  bitcoind: ["bitcoind", "bitcoin-knots", "umbrel-bitcoin"],
  tor: ["dojo-tor", "skyman21m/dojo-tor"],
  nginx: ["dojo-nginx", "skyman21m/dojo-nginx"],
  db: ["dojo-db", "skyman21m/dojo-db"],
  indexer: ["dojo-indexer", "dojo-electrs", "dojo-fulcrum", "skyman21m/dojo-electrs"],
};

export const getDojoImages: taskEither.TaskEither<Boom, Dockerode.ImageInfo[]> = pipe(
  getDockerode,
  taskEither.fromIO,
  taskEither.chain((docker) =>
    taskEither.tryCatch(() => docker.listImages(), toBoomError(500)),
  ),
);

export const getDojoImageBuildStatus: taskEither.TaskEither<Boom, DojoImageBuildStatus> = useRealData
  ? pipe(
      getDojoImages,
      taskEither.map((builtImages) =>
        pipe(
          dojoImageStatus,
          record.map(
            flow(
              array.some((imagePattern) =>
                pipe(
                  builtImages,
                  array.findFirst((item) => item.RepoTags?.some(tag => tag.includes(imagePattern)) ?? false),
                  option.fold(constFalse, constTrue),
                ),
              ),
              boolean.match(
                () => "none" as DojoImageStatus,
                () => "ready" as DojoImageStatus,
              ),
            ),
          ),
          // On Umbrel, Bitcoin is managed externally — always mark it as ready
          (status) => ({ ...status, bitcoind: "ready" as DojoImageStatus }),
        ),
      ),
    )
  : pipe(
      dojoImageStatus,
      record.map(() => "ready" as DojoImageStatus),
      taskEither.right,
      taskEither.mapLeft(toBoomError(500)),
    );

export const allDojoImagesBuilt: task.Task<boolean> = pipe(
  useRealData
    ? pipe(
        getDojoImageBuildStatus,
        taskEither.map(record.every((dojoImageStatus) => string.Eq.equals(dojoImageStatus, "ready"))),
        taskEither.getOrElse(() => task.of(false as boolean)),
      )
    : task.of(true),
);
