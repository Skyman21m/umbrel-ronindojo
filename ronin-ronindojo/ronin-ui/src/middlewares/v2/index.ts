import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import cors from "cors";
import morgan from "morgan";

export const withV2Middlewares = (handler: NextApiHandler) => (req: NextApiRequest, res: NextApiResponse) => {
  morgan(process.env.NODE_ENV === "production" ? "short" : "dev")(req, res, () => cors({ origin: false })(req, res, () => handler(req, res)));
};
