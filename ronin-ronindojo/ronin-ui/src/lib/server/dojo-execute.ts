import { execa, $ } from "execa";
import { constNull, pipe } from "fp-ts/function";
import { taskEither } from "fp-ts";

import { DOJO_DIR_PATH, DOJO_EXEC_PATH, DOJO_UPGRADE_LOCK } from "../../const";
import { toBoomError } from "./to-boom-error";

export const startDojo = pipe(
  taskEither.tryCatch(
    () => execa(DOJO_EXEC_PATH, ["start"], { cwd: DOJO_DIR_PATH, shell: "/bin/bash", stdout: "inherit", stderr: "inherit" }),
    toBoomError(500),
  ),
  taskEither.map(constNull),
);

export const stopDojo = pipe(
  taskEither.tryCatch(
    () => execa(DOJO_EXEC_PATH, ["stop"], { cwd: DOJO_DIR_PATH, shell: "/bin/bash", stdout: "inherit", stderr: "inherit" }),
    toBoomError(500),
  ),
  taskEither.map(constNull),
);

export const restartDojo = pipe(
  taskEither.tryCatch(
    () => execa(DOJO_EXEC_PATH, ["restart"], { cwd: DOJO_DIR_PATH, shell: "/bin/bash", stdout: "inherit", stderr: "inherit" }),
    toBoomError(500),
  ),
  taskEither.map(constNull),
);

export const upgradeDojo = pipe(
  taskEither.tryCatch(
    () =>
      $({
        cwd: DOJO_DIR_PATH,
        shell: "/bin/bash",
        stdout: "inherit",
        stderr: "inherit",
      })`touch ${DOJO_UPGRADE_LOCK}; bash ${DOJO_EXEC_PATH} upgrade --auto --nolog; rm ${DOJO_UPGRADE_LOCK}`,
    toBoomError(500),
  ),
  taskEither.map(constNull),
);
