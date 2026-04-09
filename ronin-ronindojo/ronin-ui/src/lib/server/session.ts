import { withIronSessionSsr, withIronSessionApiRoute } from "iron-session/next";
import getConfig from "next/config";

import { HOUR } from "../../const";
import { NextApiHandler } from "next";

export interface SessionData {
  isLoggedIn: boolean;
  username: string;
}

declare module "iron-session" {
  interface IronSessionData {
    user?: SessionData;
  }
}

const { serverRuntimeConfig } = getConfig();

const COOKIE_NAME = "ronin-ui-auth-session";
const MAX_AGE = serverRuntimeConfig.COOKIE_MAX_AGE || (2 * HOUR) / 1000; // 2 hours in seconds

const config = {
  password: serverRuntimeConfig.JWT_SECRET,
  cookieName: COOKIE_NAME,
  ttl: MAX_AGE,
  cookieOptions: {
    secure: false,
  },
};

export const withSessionSsr = <P extends Record<string, unknown> = Record<string, unknown>>(handler: any) => {
  return withIronSessionSsr<P>(handler, config);
};

export const withSessionApi = (handler: NextApiHandler) => {
  return withIronSessionApiRoute(handler, config);
};
