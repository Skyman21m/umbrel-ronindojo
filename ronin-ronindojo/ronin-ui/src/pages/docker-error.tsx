import React, { useCallback, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import dynamic from "next/dynamic";
import { isAxiosError } from "axios";

import { withSessionSsr } from "../lib/server/session";
import { ErrorMessage } from "../components/ErrorMessage";
import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { isDockerRunning } from "../lib/server/docker";
import { DASHBOARD_PAGE } from "../routes";
import { client } from "../apiClient";
import { LinearLoader } from "../components/LinearLoader";
import { LayoutSimple } from "../components/LayoutSimple";
import { ErrorResponse } from "../lib/server/errorResponse";
import { PageProps } from "../types";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const SignIn: NextPage<Props> = () => {
  const [isRebooting, setIsRebooting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleReboot = useCallback(async () => {
    try {
      setIsRebooting(true);
      // only log error
      client.post("/system/reboot");
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    }
  }, []);

  return (
    <LayoutSimple title="Docker Error">
      <div className="box bg-surface">
        <h2 className="text-4xl font-primary text-white mb-3">Docker is not running</h2>
        <p className="text-paragraph text-lg mb-3">
          It appers that Docker is not running on your RoninDojo.
          <br />
          That could be caused by experiencing an unknown error in your system.
          <br />
          Restarting your device might fix the problem.
          <br />
          If this error repeats, please contact support.
        </p>
        <h4 className="text-white text-xl mb-6">Please restart your RoninDojo.</h4>
        <div className="text-right">
          <button className="button" onClick={() => handleReboot()}>
            Restart RoninDojo
          </button>
        </div>
      </div>

      <ErrorMessage errors={[error]} />

      <div className="w-full lg:w-3/5 mx-auto mb-8 mt-5 text-lg text-paragraph text-center">
        Having trouble logging into your RoninDojo?{" "}
        <a href="https://t.me/RoninDojoNode" target="_blank" rel="noreferrer" className="font-bold text-paragraph hover:text-white transition-colors">
          Contact Support
        </a>
      </div>

      <Dialog open={isRebooting} className="max-w-2xl">
        <div className="text-paragraph mb-4">Restart initiated, reload this page in a few minutes.</div>
        <LinearLoader />
      </Dialog>
    </LayoutSimple>
  );
};

export const getServerSideProps = withSessionSsr<PageProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const dockerRunning = await isDockerRunning();

  if (dockerRunning) {
    return {
      redirect: {
        permanent: false,
        destination: DASHBOARD_PAGE,
      },
    };
  }

  return {
    ...serverSideProps,
    props: {
      withLayout: false,
    },
  };
});

export default SignIn;
