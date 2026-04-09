import os from "os";
import { constants, promises as fs } from "fs";
import { taskEither, task, either, json, ioEither } from "fp-ts";
import { pipe, flow, constNull } from "fp-ts/function";
import * as t from "io-ts";
import { Boom, serverUnavailable } from "@hapi/boom";

import { RONINDOJO_INFO_JSON } from "../../const";
import { toBoomError } from "./to-boom-error";
import { useRealData } from "../common";
import { execa, ExecaChildProcess } from "execa";

const InfoFile = t.type({
  user: t.array(
    t.type({
      name: t.union([t.literal("ronindojo"), t.literal("root")]),
      password: t.string,
    }),
  ),
});

export type InfoFile = t.TypeOf<typeof InfoFile>;

const mockData: InfoFile = {
  user: [
    {
      name: "ronindojo",
      password: "fakeRandomPassword",
    },
    {
      name: "root",
      password: "fakeRandomRootPassword",
    },
  ],
};

export const isPnPUser: task.Task<boolean> = pipe(
  useRealData
    ? pipe(
        taskEither.tryCatch(() => fs.access(RONINDOJO_INFO_JSON, constants.R_OK), either.toError),
        taskEither.fold(
          () => task.of(false),
          () => task.of(true),
        ),
      )
    : task.of(true),
);

export const getRoninDojoCredentials: taskEither.TaskEither<Boom, InfoFile> = pipe(
  useRealData
    ? pipe(
        taskEither.tryCatch(() => fs.readFile(RONINDOJO_INFO_JSON, { encoding: "utf8" }), toBoomError(500)),
        taskEither.chainEitherK(
          flow(
            json.parse,
            either.mapLeft(toBoomError(500)),
            either.chain(
              flow(
                InfoFile.decode,
                either.mapLeft(() => serverUnavailable("info.json does not have correct contents")),
              ),
            ),
          ),
        ),
      )
    : taskEither.right(mockData),
);

const setPassword = (username: string, oldPassword: string, newPassword: string): ExecaChildProcess<string> => {
  const passwd = execa("passwd", [username], { stdout: "inherit", stderr: "inherit" });

  passwd.stdin?.write(`${oldPassword}\n`);
  passwd.stdin?.write(`${newPassword}\n`);
  passwd.stdin?.write(`${newPassword}\n`);

  passwd.stdin?.end();

  return passwd;
};

export const setUserPassword = (newPassword: string, oldPassword: string): taskEither.TaskEither<Boom, any> =>
  pipe(
    useRealData
      ? pipe(
          ioEither.tryCatch(() => os.userInfo({ encoding: "utf8" }), toBoomError(500)),
          ioEither.map((userInfo) => userInfo.username),
          taskEither.fromIOEither,
          taskEither.chain((username) => taskEither.tryCatch(() => setPassword(username, oldPassword, newPassword), toBoomError(500))),
          taskEither.map(constNull),
        )
      : pipe(taskEither.right(null), task.delay(100)),
  );
