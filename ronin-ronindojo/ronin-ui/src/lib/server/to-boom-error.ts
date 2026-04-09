import { Boom, boomify } from "@hapi/boom";

export const toBoomError =
  (statusCode: number = 500) =>
  (error: unknown): Boom =>
    boomify(new Error(String(error)), { statusCode });
