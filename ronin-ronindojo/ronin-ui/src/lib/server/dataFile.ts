import { promises as fs, constants } from "fs";
import { Boom, internal } from "@hapi/boom";
import { task, either, taskEither, json } from "fp-ts";
import { pipe, flow } from "fp-ts/function";
import * as t from "io-ts";

import { RONIN_UI_DATA_FILE } from "../../const";
import { toBoomError } from "./to-boom-error";

export const DataFile = t.intersection([
  t.type({
    initialized: t.boolean,
  }),
  t.partial({
    password: t.string,
  }),
]);

export type DataFile = t.TypeOf<typeof DataFile>;

interface FSError extends Error {
  code: string;
}

export const dataFileExists: task.Task<boolean> = pipe(
  taskEither.tryCatch(() => fs.access(RONIN_UI_DATA_FILE, constants.F_OK | constants.R_OK | constants.W_OK), either.toError),
  taskEither.mapLeft((err) => {
    if ((err as FSError).code !== "ENOENT") {
      console.error(err);
    }
    return err;
  }),
  taskEither.fold(
    () => task.of(false),
    () => task.of(true),
  ),
);

export const readDataFile: taskEither.TaskEither<Boom, DataFile> = pipe(
  taskEither.tryCatch(() => fs.readFile(RONIN_UI_DATA_FILE, { encoding: "utf8" }), toBoomError(500)),
  taskEither.chainEitherK((data) =>
    pipe(
      json.parse(data),
      either.mapLeft(toBoomError(500)),
      either.chain(
        flow(
          DataFile.decode,
          either.mapLeft(() => internal("Data file does not have correct contents")),
        ),
      ),
    ),
  ),
);

export const writeDataFile = (data: DataFile): taskEither.TaskEither<Boom, void> =>
  pipe(
    json.stringify(data),
    either.mapLeft(toBoomError(500)),
    taskEither.fromEither,
    taskEither.chain((stringData) => taskEither.tryCatch(() => fs.writeFile(RONIN_UI_DATA_FILE, stringData, { encoding: "utf8" }), toBoomError(500))),
  );

export const deleteDataFile: taskEither.TaskEither<Boom, void> = taskEither.tryCatch(() => fs.unlink(RONIN_UI_DATA_FILE), toBoomError(500));
