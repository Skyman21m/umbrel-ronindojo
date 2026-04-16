import { promises as fs } from "fs";
import { taskEither, string } from "fp-ts";
import { Boom, serverUnavailable } from "@hapi/boom";
import { pipe } from "fp-ts/function";

import { getValue } from "./config-utils";
import { DOJO_ENV_PATH, NODE_CONFIG_PATH } from "../../const";
import { toBoomError } from "./to-boom-error";

const TOR_DATA_DIR = process.env.TOR_DATA_DIR || "/var/lib/tor";

export const getDojoUrl: taskEither.TaskEither<Boom, string> = pipe(
  taskEither.tryCatch(() => fs.readFile(`${TOR_DATA_DIR}/hsv3dojo/hostname`, "utf8"), toBoomError(503)),
  taskEither.map(string.trim),
  taskEither.chain((dojoUrl) => (dojoUrl.includes(".onion") ? taskEither.right(dojoUrl) : taskEither.left(serverUnavailable("Dojo URL could not be read")))),
);

const getValueFromNodeConfig = getValue(NODE_CONFIG_PATH);

export const getDojoApiKey: taskEither.TaskEither<Boom, string> =
  process.env.NODE_API_KEY
    ? taskEither.right(process.env.NODE_API_KEY)
    : getValueFromNodeConfig("NODE_API_KEY");

export const getDojoAdminKey: taskEither.TaskEither<Boom, string> =
  process.env.NODE_ADMIN_KEY
    ? taskEither.right(process.env.NODE_ADMIN_KEY)
    : getValueFromNodeConfig("NODE_ADMIN_KEY");

export const getDojoVersion: taskEither.TaskEither<Boom, string> =
  process.env.DOJO_VERSION_TAG
    ? taskEither.right(process.env.DOJO_VERSION_TAG)
    : getValueFromNodeConfig("DOJO_VERSION_TAG");
