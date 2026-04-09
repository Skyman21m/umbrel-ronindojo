import crypto from "crypto";
import getConfig from "next/config";
import { either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { Boom } from "@hapi/boom";
import { toBoomError } from "./to-boom-error";

const { serverRuntimeConfig } = getConfig();

export const decryptString = (str: string): either.Either<Boom, string> =>
  pipe(
    either.tryCatch(
      () =>
        crypto.privateDecrypt({ key: serverRuntimeConfig.encryptionPrivateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, Buffer.from(str, "base64")),
      toBoomError(500),
    ),
    either.map((buf) => buf.toString("utf8")),
  );
