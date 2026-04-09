import { NextApiRequest, NextApiResponse } from "next";
import { taskEither } from "fp-ts";
import { Boom } from "@hapi/boom";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";

export interface Response {
  version: string;
}

export const getRoninDojoVersion: taskEither.TaskEither<Boom, Response> =
  taskEither.right({ version: "2.4.1-umbrel" });

const handler = (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  res.status(200).json({ version: "2.4.1-umbrel" });
  return Promise.resolve();
};

export default withV2Middlewares(withSessionApi(handler));
