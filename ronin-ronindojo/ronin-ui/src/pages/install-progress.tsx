import React, { useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import Link from "next/link";
import useSWR from "swr";
import { pipe } from "fp-ts/function";
import { taskEither, record } from "fp-ts";

import { withSessionSsr } from "../lib/server/session";
import { ErrorMessage } from "../components/ErrorMessage";
import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { DojoImageBuildStatus, getDojoImageBuildStatus } from "../lib/server/docker";
import { SuccessMessage } from "../components/SuccessMessage";
import { DASHBOARD_PAGE } from "../routes";
import { SECOND } from "../const";
import { DockerImageProgess } from "../components/DockerImageProgess";
import { LayoutSimple } from "../components/LayoutSimple";
import { PageProps } from "../types";

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const SignIn: NextPage<Props> = ({ imageBuildStatus }) => {
  const [error, setError] = useState<string | null>(null);

  const { data: dojoImageBuildStatus } = useSWR<DojoImageBuildStatus>("/dojo/image-status", {
    fallbackData: imageBuildStatus,
    refreshInterval: 30 * SECOND,
    onError: (err) => setError(String(err)),
  });

  const allImagesInstalled = pipe(
    dojoImageBuildStatus!,
    record.every((image) => image === "ready"),
  );

  return (
    <LayoutSimple title="Initialization">
      <div className="mb-4">
        <h2 className="py-8 text-5xl font-primary text-white text-center">Initialization</h2>
        <p className="text-paragraph text-lg">
          Please wait while your RoninDojo is installing.
          <br />
          This can take some time so be sure to grab a cup of coffee or listen your favorite bitcoin podcast in the meantime.
        </p>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 grid-flow-row-dense gap-2 box bg-surface text-white mb-4">
        <DockerImageProgess ready={dojoImageBuildStatus!["bitcoind"] === "ready"} />
        <div className="col-span-2">Bitcoin Core</div>

        <DockerImageProgess ready={dojoImageBuildStatus!["db"] === "ready"} />
        <div className="col-span-2">Database</div>

        <DockerImageProgess ready={dojoImageBuildStatus!["nodejs"] === "ready"} />
        <div className="col-span-2">Node.js</div>

        <DockerImageProgess ready={dojoImageBuildStatus!["nginx"] === "ready"} />
        <div className="col-span-2">Nginx</div>

        <DockerImageProgess ready={dojoImageBuildStatus!["indexer"] === "ready"} />
        <div className="col-span-2">Indexer</div>

        <DockerImageProgess ready={dojoImageBuildStatus!["tor"] === "ready"} />
        <div className="col-span-2">Tor</div>

        <DockerImageProgess ready={dojoImageBuildStatus!["explorer"] === "ready"} />
        <div className="col-span-2">BTC-RPC Explorer</div>

      </div>

      {allImagesInstalled && (
        <>
          <div className="mb-4">
            <SuccessMessage message="All Docker images have been built sucessfully. You can now continue to use your RoninDojo." />
          </div>
          <div className="text-center">
            <Link href={DASHBOARD_PAGE} className="button">
              Take me to the Dashboard
            </Link>
          </div>
        </>
      )}

      <ErrorMessage errors={[error]} />
    </LayoutSimple>
  );
};

type SsrProps = PageProps<{
  imageBuildStatus: DojoImageBuildStatus;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const imageBuildStatus = await pipe(
    getDojoImageBuildStatus,
    taskEither.getOrElse((err) => {
      throw err;
    }),
  )();

  return {
    ...serverSideProps,
    props: {
      withLayout: false,
      imageBuildStatus,
    },
  };
});

export default SignIn;
