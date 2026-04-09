import { NextApiRequest, NextApiResponse } from "next";
import { taskEither } from "fp-ts";
import { Boom } from "@hapi/boom";
import { withV2Middlewares } from "../../../middlewares/v2";
import { withSessionApi } from "../../../lib/server/session";

export interface Response {
  status: "ok";
}

export const fetchRemoteVersion: taskEither.TaskEither<Boom, never> =
  taskEither.left({ isBoom: true, output: { statusCode: 501, payload: { error: "Not available on Umbrel" } } } as unknown as Boom);

const handler = (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  res.status(501).json({ error: "Not available on Umbrel" });
  return Promise.resolve();
};

export default withV2Middlewares(withSessionApi(handler));
