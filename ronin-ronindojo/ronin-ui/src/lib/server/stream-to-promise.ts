import { Boom } from "@hapi/boom";
import { taskEither } from "fp-ts";

import { toBoomError } from "./to-boom-error";

const streamToPromise = (stream: NodeJS.ReadableStream, encoding: BufferEncoding = "utf8"): Promise<string> => {
  stream.setEncoding(encoding);

  return new Promise((resolve, reject) => {
    let data = "";

    stream.on("data", (chunk) => (data += chunk));
    stream.on("end", () => resolve(data));
    stream.on("error", (error) => reject(error));
  });
};

export const readStream = (stream: NodeJS.ReadableStream, encoding: BufferEncoding = "utf8"): taskEither.TaskEither<Boom, string> =>
  taskEither.tryCatch(() => streamToPromise(stream, encoding), toBoomError(500));
