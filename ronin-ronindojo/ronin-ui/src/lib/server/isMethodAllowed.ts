import { NextApiRequest } from "next";
import { string, either, readonlyArray } from "fp-ts";
import { pipe } from "fp-ts/function";
import { Boom, methodNotAllowed } from "@hapi/boom";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const stringToArrayString = (str: string | string[]): string[] => {
  if (Array.isArray(str)) return str;

  return [str];
};

export const isMethodAllowed =
  (methods: HTTPMethod | HTTPMethod[]) =>
  (req: NextApiRequest): either.Either<Boom, null> =>
    pipe(
      methods,
      stringToArrayString,
      readonlyArray.elem(string.Eq)(req.method as HTTPMethod)
        ? () => either.right(null)
        : () => either.left(methodNotAllowed("Method not allowed", undefined, methods)),
    );
