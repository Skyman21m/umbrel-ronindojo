import { ExecaError, execa, Options as ExecaOptions } from "execa";
import { internal, unauthorized } from "@hapi/boom";
import { taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";

type SudoOpts = {
  command: string;
  execaOptions?: ExecaOptions;
};

export const verifyUserPassword = (password: string) =>
  taskEither.tryCatch(
    () =>
      execa("sudo", ["--stdin", "--reset-timestamp", "echo 'login'"], {
        stdout: "inherit",
        stderr: "inherit",
        input: password,
        shell: "/bin/bash",
      }),
    () => unauthorized("Incorrect sudo password"),
  );

export const sudo = (options: SudoOpts) => (password: string) =>
  pipe(
    verifyUserPassword(password),
    taskEither.chain(() =>
      taskEither.tryCatch(
        () =>
          execa("sudo", ["--stdin", "--preserve-env", "bash", "-c", options.command], {
            ...options.execaOptions,
            stdout: "inherit",
            stderr: "inherit",
            input: password,
          }),
        (err) => internal((err as ExecaError).shortMessage),
      ),
    ),
  );

export const unlockSudo = (options: SudoOpts) => (password: string) =>
  pipe(
    verifyUserPassword(password),
    taskEither.chain(() =>
      taskEither.tryCatch(
        () =>
          execa("sudo", ["--stdin", "--preserve-env", "bash", "-c", options.command], {
            ...options.execaOptions,
            stdout: "inherit",
            stderr: "inherit",
            input: password,
          }),
        (err) => internal((err as ExecaError).shortMessage),
      ),
    ),
  );
