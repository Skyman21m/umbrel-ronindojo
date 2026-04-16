import { NextApiRequest, NextApiResponse } from "next";
import { withV2Middlewares } from "../../../../middlewares/v2";
import { withSessionApi } from "../../../../lib/server/session";

const handler = (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  res.status(501).json({ error: "Not available on Umbrel" });
  return Promise.resolve();
};

export default withV2Middlewares(withSessionApi(handler));
