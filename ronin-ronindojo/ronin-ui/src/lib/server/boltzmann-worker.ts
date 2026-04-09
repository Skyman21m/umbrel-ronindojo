import { parentPort, workerData, isMainThread } from "worker_threads";
import { Boltzmann, BoltzmannResultJson, type TxosInput, TooManyTxosError, TimeoutError } from "@samouraiwallet/boltzmann";
import { either } from "fp-ts";
import { Boom, badData } from "@hapi/boom";

export type WorkerResult = either.Either<Boom<string>, BoltzmannResultJson>;

if (!isMainThread) {
  const boltzmann = new Boltzmann({ maxDuration: 30, maxTxos: 24 });
  try {
    const boltzmannResult = boltzmann.process(workerData as TxosInput);
    parentPort?.postMessage(either.right(boltzmannResult.toJSON()) satisfies WorkerResult);
  } catch (error) {
    if (error instanceof TooManyTxosError) {
      parentPort?.postMessage(either.left(badData("Too many txos")) satisfies WorkerResult);
    }

    if (error instanceof TimeoutError) {
      parentPort?.postMessage(either.left(badData("Timeout limit reached")) satisfies WorkerResult);
    }
  }

  parentPort?.close();
}
