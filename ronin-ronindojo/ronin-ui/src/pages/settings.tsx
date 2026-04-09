import React from "react";
import { GetServerSideProps, GetServerSidePropsContext, InferGetServerSidePropsType, NextPage } from "next";
import { motion } from "framer-motion";
import { pipe } from "fp-ts/function";
import { task, taskEither, apply } from "fp-ts";
import * as D from "io-ts/Decoder";

import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { withSessionSsr } from "../lib/server/session";
import { pageTransition } from "../animations";
import { PageProps } from "../types";
import { ChangePassword } from "../components/settings/ChangePassword";
import { DojoSettings } from "../components/settings/DojoSettings";
import { getValues } from "../lib/server/config-utils";
import { BITCOIND_CONFIG_PATH, NODE_CONFIG_PATH } from "../const";

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const SettingsPage: NextPage<Props> = ({ layoutTitle, settings }) => {
  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-black box">
        <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DojoSettings settings={settings} />
          <ChangePassword />
        </div>
      </div>
    </motion.div>
  );
};

const BooleanFromConfigValue: D.Decoder<unknown, boolean> = pipe(
  D.string,
  D.parse((s) => {
    if (s === "on") return D.success(true);
    if (s === "off") return D.success(false);
    return D.failure(s, "BooleanFromConfigValue");
  }),
);

const NumberFromString: D.Decoder<unknown, number> = pipe(
  D.string,
  D.parse((s) => {
    const parsed = Number(s);
    if (Number.isNaN(parsed)) return D.failure(s, "NumberFromString");
    return D.success(parsed);
  }),
);

const bitcoindSettings = D.partial({
  BITCOIND_MEMPOOL_EXPIRY: NumberFromString,
  BITCOIND_PERSIST_MEMPOOL: BooleanFromConfigValue,
  BITCOIND_BAN_KNOTS: BooleanFromConfigValue,
});
const nodeSettings = D.partial({ NODE_PANDOTX_PUSH: BooleanFromConfigValue, NODE_PANDOTX_PROCESS: BooleanFromConfigValue });

export type DojoSettingsData = D.TypeOf<typeof bitcoindSettings> & D.TypeOf<typeof nodeSettings>;

type SsrProps = PageProps<{
  withLayout: true; // necessary workaround
  settings: DojoSettingsData;
}>;

export const getServerSideProps: GetServerSideProps<SsrProps> = withSessionSsr(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  const settings: DojoSettingsData = await pipe(
    apply.sequenceT(taskEither.ApplyPar)(getValues(BITCOIND_CONFIG_PATH)(bitcoindSettings), getValues(NODE_CONFIG_PATH)(nodeSettings)),
    taskEither.map(([a, b]) => ({ ...a, ...b })),
    taskEither.tapError((err) => taskEither.right(console.error(err))),
    taskEither.getOrElseW(() => task.of({})),
  )();

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Settings",
      settings,
    },
  };
});

export default SettingsPage;
