import React, { useMemo, useRef, useState, useLayoutEffect, useCallback, useEffect } from "react";
import { GetServerSidePropsContext, InferGetServerSidePropsType, NextPage } from "next";
import Router, { useRouter } from "next/router";
import Link from "next/link";
import { AxiosError } from "axios";
import useSWR from "swr";
import clsx from "clsx";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import Dockerode from "dockerode";
import { pipe } from "fp-ts/function";
import { task, taskEither } from "fp-ts";

import { Logs } from "../../enums";
import { SECOND } from "../../const";
import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { withSessionSsr } from "../../lib/server/session";
import { useSnackbar } from "../../components/SnackbarContext";
import { pageTransition } from "../../animations";
import { LinearLoader } from "../../components/LinearLoader";
import { CircularLoader } from "../../components/CircularLoader";
import { copyText } from "../../lib/client/copyText";
import { listContainers } from "../../lib/server/docker";
import { PageProps } from "../../types";
import { getLogs, RequestParams as GetLogsRequestParams } from "../api/v2/logs/[id]";

const TAIL = "500";

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const LogsPage: NextPage<Props> = ({ layoutTitle, ssrDojoContainers, logs }) => {
  const router = useRouter();
  const { container } = router.query;

  const { callSnackbar } = useSnackbar();
  const [loadInProgress, setLoadInProgress] = useState<boolean>(false);
  const [stickToBottom, setStickToBottom] = useState<boolean>(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const logOptions = useMemo(() => Object.entries(Logs), []);

  const filteredLogOptions = useMemo(
    () =>
      logOptions.filter(([containerLabel, containerName]) => {
        return containerName === "pm2" || Boolean(ssrDojoContainers?.find((dockerContainer) => dockerContainer.Names.join("").includes(containerName)));
      }),
    [logOptions, ssrDojoContainers],
  );

  const { data, isValidating } = useSWR(container && !loadInProgress ? `/logs/${container}?tail=${TAIL}` : null, {
    refreshInterval: 5 * SECOND,
    onError: (error) => {
      if (error instanceof AxiosError && error.response?.status === 401) {
        return;
      } else {
        console.error(error);
        callSnackbar("Unable to get logs. Please check that your Dojo is running", "error");
      }
    },
    fallbackData: {
      logs: logs,
    },
  });

  const progressStart = useCallback(
    (href: string) => {
      if (router.asPath.includes("/logs") && href.includes("/logs")) {
        setLoadInProgress(true);
      }
    },
    [router.asPath],
  );

  const progressFinish = useCallback(() => {
    setLoadInProgress(false);
  }, []);

  useEffect(() => {
    Router.events.on("routeChangeStart", progressStart);
    Router.events.on("routeChangeComplete", progressFinish);
    Router.events.on("routeChangeError", progressFinish);

    return () => {
      Router.events.off("routeChangeStart", progressStart);
      Router.events.off("routeChangeComplete", progressFinish);
      Router.events.off("routeChangeError", progressFinish);
    };
  }, [progressStart, progressFinish]);

  useLayoutEffect(() => {
    if (textareaRef.current && stickToBottom) {
      textareaRef.current.scrollTop = textareaRef.current?.scrollHeight ?? 0;
    }
  }, [stickToBottom, data?.logs, container]);

  const handleCopyLogs = async () => {
    if (data) {
      try {
        await copyText(data.logs);
        callSnackbar("Copied to clipboard", "info");
      } catch (err) {
        callSnackbar(String(err), "error");
      }
    }
  };

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box">
        {loadInProgress && (
          <div className="absolute top-8 right-8">
            <CircularLoader color="primary" className="h-6 w-6" />
          </div>
        )}
        <div className="flex flex-col">
          <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
          <div className="overflow-x-auto mb-4 flex flex-col lg:flex-row">
            {filteredLogOptions.map(([containerLabel, containerName]) => (
              <div className="inline-block" key={containerName}>
                <Link
                  href={`/logs/${containerName}`}
                  className={clsx([
                    "text-center block transition-colors font-primary hover:text-white hover:drop-shadow-menuItem text-xl mx-8 capitalize whitespace-nowrap",
                    container === containerName ? "text-white" : "text-menuText",
                    container === containerName && "drop-shadow-menuItem",
                  ])}
                >
                  {containerLabel}
                </Link>
                {container === containerName && <motion.div className="mx-8 border-b-2 border-primary" layoutId="underline"></motion.div>}
              </div>
            ))}
          </div>
          <div className="box bg-black mb-6 flex-1 relative">
            <textarea
              value={data?.logs}
              ref={textareaRef}
              disabled
              className="w-full bg-transparent border-none font-mono text-secondary text-sm resize-none min-h-[50vh]"
            />
            {isValidating && (
              <div className="absolute bottom-0 left-0 w-full">
                <LinearLoader />
              </div>
            )}
          </div>
          <div className="flex justify-end flex-shrink-0">
            <div className="cursor-pointer inline-flex items-center" onClick={() => setStickToBottom((prevState) => !prevState)}>
              <div className="text-sm text-white">Stick to bottom</div>
              <div
                className={clsx([
                  "ml-3 p-0.5 border w-10 h-4.5 transition-colors flex items-center rounded-full",
                  stickToBottom ? "justify-end bg-secondary border-secondary" : "bg-black border-primary",
                ])}
              >
                <motion.div className="h-4 w-4 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
              </div>
            </div>

            <DocumentDuplicateIcon
              onClick={handleCopyLogs}
              className="h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

type SsrProps = PageProps<{
  withLayout: true; // necessary workaround
  ssrDojoContainers: Dockerode.ContainerInfo[] | null;
  logs: string;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  const loadDojoContainers = pipe(
    listContainers,
    taskEither.getOrElseW(() => task.of(null)),
  );

  const loadLogs = pipe(
    { id: ctx.query["container"], tail: TAIL },
    GetLogsRequestParams.decode,
    taskEither.fromEither,
    taskEither.chainW(getLogs),
    taskEither.getOrElse(() => task.of("")),
  );

  const [ssrDojoContainers, logs] = await Promise.all([loadDojoContainers(), loadLogs()]);

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Logs",
      ssrDojoContainers: ssrDojoContainers,
      logs: logs,
    },
  };
});

export default LogsPage;
