import { NextApiRequest, NextApiResponse } from "next";
import { unauthorized } from "@hapi/boom";
import { taskEither, either, json } from "fp-ts";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { NonEmptyString } from "io-ts-types/NonEmptyString";

import { withSessionApi, SessionData } from "../../../../lib/server/session";
import { isMethodAllowed } from "../../../../lib/server/isMethodAllowed";
import { ErrorResponse, sendErrorTask } from "../../../../lib/server/errorResponse";
import { sendSuccessTask } from "../../../../lib/server/successResponse";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { toBoomError } from "../../../../lib/server/to-boom-error";
import { readDataFile, writeDataFile } from "../../../../lib/server/dataFile";
import { decryptString } from "../../../../lib/server/decryptString";
import { comparePasswords, hashPassword } from "../../../../lib/server/password";
import { RONIN_UI_DATA_FILE } from "../../../../const";
import { promises as fs } from "fs";

const RequestBody = t.type({
  password: NonEmptyString,
});

export interface Response extends SessionData {}

const methods = "POST";

// Rate limiting: track failed attempts per IP
const MAX_ATTEMPTS = 5;
const BASE_LOCKOUT_MS = 60 * 1000; // 1 minute
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

const getClientIp = (req: NextApiRequest): string =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

const checkRateLimit = (req: NextApiRequest): either.Either<ReturnType<typeof unauthorized>, void> => {
  const ip = getClientIp(req);
  const record = failedAttempts.get(ip);
  if (record && record.lockedUntil > Date.now()) {
    const waitSec = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return either.left(unauthorized(`Too many failed attempts. Try again in ${waitSec}s`));
  }
  return either.right(undefined);
};

const recordFailedAttempt = (req: NextApiRequest): void => {
  const ip = getClientIp(req);
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    // Exponential backoff: 1min, 2min, 4min, 8min... capped at 30min
    const multiplier = Math.min(Math.pow(2, Math.floor(record.count / MAX_ATTEMPTS) - 1), 30);
    record.lockedUntil = Date.now() + BASE_LOCKOUT_MS * multiplier;
  }
  failedAttempts.set(ip, record);
};

const clearFailedAttempts = (req: NextApiRequest): void => {
  const ip = getClientIp(req);
  failedAttempts.delete(ip);
};

const handler = (req: NextApiRequest, res: NextApiResponse<Response | ErrorResponse>): Promise<void> => {
  return pipe(
    isMethodAllowed(methods)(req),
    either.chain(() => checkRateLimit(req)),
    either.chain(() => decryptString(req.body)),
    either.chain((decrypted) => pipe(json.parse(decrypted), either.mapLeft(toBoomError(500)))),
    either.chain((payload) =>
      pipe(
        RequestBody.decode(payload),
        either.mapLeft(() => unauthorized("Password cannot be empty")),
      ),
    ),
    taskEither.fromEither,
    taskEither.chain((parsedCredentials) =>
      pipe(
        taskEither.tryCatch(
          async () => {
            // Check ronin-ui.dat for custom password first
            try {
              const data = await fs.readFile(RONIN_UI_DATA_FILE, "utf8");
              const parsed = JSON.parse(data);
              if (parsed.password) {
                // Hashed passwords use "salt:hex" format (contains ":")
                const isHashed = parsed.password.includes(":");
                if (isHashed) {
                  const match = await comparePasswords(parsedCredentials.password)(parsed.password)();
                  if (match._tag === "Right" && match.right) {
                    return { matched: true };
                  }
                  return { matched: false };
                }
                // Legacy plaintext password — compare directly, then rehash
                if (parsedCredentials.password === parsed.password) {
                  // Migrate: rehash the plaintext password for next time
                  const hashResult = await hashPassword(parsedCredentials.password)();
                  if (hashResult._tag === "Right") {
                    await fs.writeFile(RONIN_UI_DATA_FILE, JSON.stringify({ initialized: true, password: hashResult.right }), "utf8");
                  }
                  return { matched: true };
                }
                return { matched: false };
              }
            } catch {}
            // Fallback to APP_PASSWORD (Umbrel default credential — not hashed by us)
            return { matched: parsedCredentials.password === (process.env.APP_PASSWORD || "") };
          },
          toBoomError(500),
        ),
        taskEither.chain((result: { matched: boolean }) =>
          result.matched
            ? pipe(
                taskEither.fromIO(() => clearFailedAttempts(req)),
                taskEither.chain(() => taskEither.right({ isLoggedIn: true, username: process.env.RONIN_UI_USERNAME || "umbrel" })),
                taskEither.chainFirst((userData) =>
                  pipe(
                    () => {
                      req.session.user = userData;
                    },
                    taskEither.fromIO,
                    taskEither.chain(() => taskEither.tryCatch(() => req.session.save(), toBoomError(500))),
                  ),
                ),
              )
            : pipe(
                taskEither.fromIO(() => recordFailedAttempt(req)),
                taskEither.chain(() => taskEither.left(unauthorized("Incorrect password"))),
              ),
        ),
      ),
    ),
    taskEither.chainFirst(() =>
      pipe(
        readDataFile,
        taskEither.fold(
          () => writeDataFile({ initialized: true }),
          () => taskEither.right(undefined),
        ),
      ),
    ),
    taskEither.fold(sendErrorTask(res), sendSuccessTask(res)),
  )();
};

export default withV2Middlewares(withSessionApi(handler));
