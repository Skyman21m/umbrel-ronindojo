import { NextApiRequest } from "next";
import { either } from "fp-ts";
import { pipe } from "fp-ts/function";
import { Boom, unauthorized } from "@hapi/boom";

export const isUserAuthorized = (req: NextApiRequest): either.Either<Boom, string | object> =>
  pipe(req.session.user, either.fromNullable(unauthorized("User not authenticated")));
