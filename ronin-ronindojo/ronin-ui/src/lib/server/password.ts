import crypto from "crypto";
import { promisify } from "util";
import { Boom } from "@hapi/boom";
import { taskEither } from "fp-ts";

import { toBoomError } from "./to-boom-error";
import { NonEmptyString } from "io-ts-types";

const scrypt = promisify(crypto.scrypt);
const randomBytes = promisify(crypto.randomBytes);

const deriveKey = async (password: string, salt: string): Promise<Buffer> => {
  return (await scrypt(password, salt, 64)) as Buffer;
};

const hash = async (password: string): Promise<NonEmptyString> => {
  const random = await randomBytes(16);
  const salt = random.toString("hex");
  const derivedKey = await deriveKey(password, salt);

  return `${salt}:${derivedKey.toString("hex")}` as NonEmptyString;
};

const compare = async (password: string, hashedPassword: string): Promise<boolean> => {
  const [salt, key] = hashedPassword.split(":");
  const derivedKey = await deriveKey(password, salt);

  return crypto.timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
};

export const hashPassword = (password: string): taskEither.TaskEither<Boom, NonEmptyString> => taskEither.tryCatch(() => hash(password), toBoomError(503));

export const comparePasswords =
  (password: string) =>
  (hashedPassword: string): taskEither.TaskEither<Boom, boolean> =>
    taskEither.tryCatch(() => compare(password, hashedPassword), toBoomError(503));
