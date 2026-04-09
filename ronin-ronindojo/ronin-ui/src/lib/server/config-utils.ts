import { promises as fs } from "fs";
import { Boom, internal } from "@hapi/boom";
import { taskEither, either, readonlyArray, string, boolean } from "fp-ts";
import { flow, pipe } from "fp-ts/function";
import { Decoder } from "io-ts/Decoder";
import dotenv from "dotenv";

type ConfigValueInput = string | number | boolean | undefined | null;

export const getValue =
  (path: string) =>
  (key: string): taskEither.TaskEither<Boom, string> =>
    pipe(
      taskEither.tryCatch(
        () => fs.readFile(path, "utf8"),
        () => internal(`Unable to read ${path}`),
      ),
      taskEither.flatMapEither(
        flow(
          string.split(/\r?\n/),
          readonlyArray.map(string.trim),
          // Filter out commented lines
          readonlyArray.filter(flow(string.startsWith("#"), boolean.BooleanAlgebra.not)),
          readonlyArray.findFirst(string.includes(`${key}=`)),
          either.fromOption(() => internal(`${key} was not found in ${path}`)),
          either.map(string.replace(`${key}=`, "")),
          either.map(string.trim),
          // eslint-disable-next-line unicorn/prefer-string-replace-all
          either.map(string.replace(/["']/g, "")),
        ),
      ),
    );

export const getValues =
  (path: string) =>
  <A extends unknown>(decoder: Decoder<unknown, A>) =>
    pipe(
      taskEither.tryCatch(
        () => fs.readFile(path, "utf8"),
        () => internal(`Unable to read ${path}`),
      ),
      taskEither.map(dotenv.parse),
      taskEither.flatMapEither(flow(decoder.decode)),
    );

export const setValues =
  (path: string) =>
  (values: Record<string, ConfigValueInput>): taskEither.TaskEither<Boom, void> =>
    pipe(
      taskEither.tryCatch(
        () => fs.readFile(path, "utf8"),
        () => internal(`Unable to read ${path}`),
      ),
      taskEither.map(
        flow(
          string.split(/\r?\n/),
          readonlyArray.map((line) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith("#")) return line;

            const [name, ...valueParts] = trimmedLine.split("=");
            if (values[name.trim()] != null) {
              let val = values[name.trim()];

              if (typeof val === "boolean") {
                val = val ? "on" : "off";
              }

              return `${name}=${val}`;
            }
            return line;
          }),
        ),
      ),
      taskEither.map((updatedLines) => updatedLines.join("\n")),
      taskEither.flatMap((updatedLines) =>
        taskEither.tryCatch(
          () => fs.writeFile(path, updatedLines, "utf8"),
          () => internal(`Unable to write ${path}`),
        ),
      ),
    );
