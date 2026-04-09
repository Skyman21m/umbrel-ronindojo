import fs, { promises as fsPromises } from "fs";
import { http, https } from "follow-redirects";
import { taskEither } from "fp-ts";

import { toBoomError } from "./to-boom-error";

const download = (url: string, dest: string) =>
  new Promise<void>((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const getRequest = url.startsWith("https") ? https.get : http.get;

    const req = getRequest(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(`Request failed with status code ${response.statusCode}`);
      }

      response.pipe(file);
    });

    file.on("finish", () =>
      file.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }),
    );

    req.on("error", (err) => {
      fsPromises.unlink(dest);
      return reject(err);
    });

    file.on("error", (err) => {
      fsPromises.unlink(dest);
      return reject(err);
    });
  });

export const downloadFile = (url: string, dest: string) => taskEither.tryCatch(() => download(url, dest), toBoomError(500));
