import { monoid, task, taskEither } from "fp-ts";
import { Boom } from "@hapi/boom";
import { pipe } from "fp-ts/function";

import { SECOND } from "../../const";
import { toBoomError } from "./to-boom-error";

export const getRaceTask = <A extends any>(t: task.Task<A>): task.Task<A | null> =>
  pipe([t, pipe(task.of(null), task.delay(10 * SECOND))], monoid.concatAll(task.getRaceMonoid()));

export const getRaceTaskEither = <A extends any>(tE: taskEither.TaskEither<Boom, A>): taskEither.TaskEither<Boom, A | null> =>
  pipe([tE, pipe(taskEither.right(null), task.delay(10 * SECOND), taskEither.mapLeft(toBoomError(500)))], monoid.concatAll(task.getRaceMonoid()));
