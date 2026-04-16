import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import morgan from "morgan";

export const withV2Middlewares = (handler: NextApiHandler) => (req: NextApiRequest, res: NextApiResponse) => {
  morgan(process.env.NODE_ENV === "production" ? "short" : "dev")(req, res, () => handler(req, res));
};
