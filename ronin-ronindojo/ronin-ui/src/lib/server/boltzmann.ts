import { Worker } from "worker_threads";

import { serverUnavailable, boomify } from "@hapi/boom";
import { taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";
import { type TxosInput } from "@samouraiwallet/boltzmann";
import { type WorkerResult } from "./boltzmann-worker";

export const computeBoltzmann = (txos: TxosInput) => {
  return pipe(
    taskEither.tryCatch(
      () =>
        new Promise<WorkerResult>((resolve, reject) => {
          // eslint-disable-next-line unicorn/relative-url-style
          const worker = new Worker(new URL("./boltzmann-worker.ts", import.meta.url), { workerData: txos });

          worker.once("message", (result: WorkerResult) => {
            resolve(result);
            worker.terminate();
          });
          worker.once("error", (error) => {
            reject(error);
            worker.terminate();
          });
          worker.once("exit", (code) => {
            if (code !== 0) reject(serverUnavailable(`Boltzmann worker stopped with exit code ${code}`));
          });
        }),
      (error) => boomify(error as Error),
    ),
    taskEither.flatMapEither((result) => result),
  );
};
