import { GetServerSidePropsContext, InferGetServerSidePropsType, NextPage } from "next";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React, { FC, SyntheticEvent, useRef, useState } from "react";
import { motion } from "framer-motion";
import { pipe, flow, constNull } from "fp-ts/function";
import { taskEither, readonlyArray, task, option, record, console as fpConsole } from "fp-ts";
import clsx from "clsx";

import { withSessionSsr } from "../lib/server/session";
import { PageProps } from "../types";
import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { pageTransition } from "../animations";
import { LinearLoader } from "../components/LinearLoader";
import { client } from "../apiClient";
import { Response as PruneCacheResponse } from "./api/v2/ronindojo/prune-cache";
import { delay } from "../lib/common";
import { useSnackbar } from "../components/SnackbarContext";
import { getDockerode } from "../lib/server/docker";
import { formatBytes } from "../lib/client";
import { getIndexerType, Response as IndexerTypeResponse } from "./api/v2/ronindojo/indexer-type";
import { encryptString } from "../lib/client/encryptString";
import { isAxiosError } from "axios";
import { ErrorResponse } from "../lib/server/errorResponse";
import { CircularLoader } from "../components/CircularLoader";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const TroubleshootingPage: NextPage<Props> = ({ layoutTitle, dockerCacheSize, indexerType }) => {
  const [fulcrumDialogOpen, setFulcrumDialogOpen] = useState(false);
  const [dockerDialogOpen, setDockerDialogOpen] = useState(false);
  const [torDialogOpen, setTorDialogOpen] = useState(false);

  const dockerNeedsClearing = dockerCacheSize != null && dockerCacheSize > 1000000000; // 1GB

  return (
    <>
      <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
        <div className="bg-black box">
          <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
          <p className="text-paragraph mb-6">Experiencing problems with your RoninDojo? Let's try to fix them.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className={clsx("box bg-surface text-white flex flex-col items-start", indexerType?.type !== "Fulcrum" && "disabled")}>
              <h3 className="font-bold text-lg mb-3">Fulcrum database is corrupted</h3>
              <p className="text-paragraph text-sm mb-3">Had a power outage and now your Fulcrum database is corrupted? Erase all data and resync Fulcrum.</p>
              <div className="flex-1 w-full flex items-end justify-end">
                <button className="button small" disabled={indexerType?.type !== "Fulcrum"} onClick={() => setFulcrumDialogOpen(true)}>
                  Erase and resync
                </button>
              </div>
            </div>

            <div className={clsx("box bg-surface text-white flex flex-col items-start", !dockerNeedsClearing && "disabled")}>
              <h3 className="font-bold text-lg mb-3">Disk is running out of space</h3>
              <p className="text-paragraph text-sm mb-3">Is your disk running out of available space?</p>
              {dockerNeedsClearing ? (
                <p className="text-paragraph text-sm mb-3">
                  You can reclaim <strong>{formatBytes(dockerCacheSize, "GB")}</strong> by clearing Docker build cache
                </p>
              ) : (
                <p className="text-paragraph text-sm mb-3">Docker build cache size is below 1GB right now. No need to clear cache.</p>
              )}
              <div className="flex-1 w-full flex items-end justify-end">
                <button className="button small" onClick={() => setDockerDialogOpen(true)} disabled={!dockerNeedsClearing}>
                  Clear docker cache
                </button>
              </div>
            </div>

            <div className="box bg-surface text-white flex flex-col items-start">
              <h3 className="font-bold text-lg mb-3">Ronin UI not accessible over Tor</h3>
              <p className="text-paragraph text-sm mb-3">Having problems with accessing Ronin UI over Tor?</p>
              <div className="flex-1 w-full flex items-end justify-end">
                <button className="button small" onClick={() => setTorDialogOpen(true)}>
                  Restart Tor
                </button>
              </div>
            </div>
          </div>
          <div className="text-white text-center text-sm">
            Didn't find a solution to your issue?{" "}
            <a
              className="text-secondary hover:text-secondary-alpha transition-colors cursor-pointer"
              href="https://ronindojo.io/en/support"
              target="_blank"
              rel="noreferrer"
            >
              Contact our support
            </a>
          </div>
        </div>
      </motion.div>
      <ClearFulcrumDialog open={fulcrumDialogOpen} onClose={() => setFulcrumDialogOpen(false)} />
      <ClearDockerDialog open={dockerDialogOpen} onClose={() => setDockerDialogOpen(false)} dockerCacheSize={dockerCacheSize} />
      <RestartTorDialog open={torDialogOpen} onClose={() => setTorDialogOpen(false)} />
    </>
  );
};

const ClearFulcrumDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"confirm" | "loading">("confirm");
  const [loading, setLoading] = useState<boolean>(false);
  const { callSnackbar } = useSnackbar();

  const handleClose = () => {
    setStep("confirm");
    onClose();
  };

  const handleEraseFulcrum = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const password = inputRef.current?.value ?? "";

    try {
      const data = await encryptString(
        JSON.stringify({
          password,
        }),
      );
      await client.post("/auth/login", data, { headers: { "Content-Type": "text/plain" } });
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        callSnackbar(error_.response?.data.message ?? error_.message, "error");
      } else {
        callSnackbar(String(error_), "error");
      }
      return;
    } finally {
      setLoading(false);
    }

    setStep("loading");

    try {
      const encryptedPassword = await encryptString(password);
      await client.post("/ronindojo/clear-fulcrum", { password: encryptedPassword });

      callSnackbar("Fulcrum database erased and Dojo restarted. Check your RoninDojo dashboard for the Fulcrum syncing status.", "success");
      handleClose();
    } catch (error) {
      if (isAxiosError<ErrorResponse>(error)) {
        callSnackbar(error.response?.data.message ?? error.message, "error");
      } else {
        console.error(error);
        callSnackbar("Fulcrum database erase failed. See Ronin backend logs for details", "error", true);
      }
      setStep("confirm");
    }
  };

  return (
    <>
      <Dialog
        className="max-w-2xl"
        title="Erase Fulcrum database"
        open={open && step === "confirm"}
        onClose={handleClose}
        actions={
          <>
            <button onClick={handleClose} className="button small secondary mr-3" disabled={loading}>
              Cancel
            </button>
            <button form="eraseFulcrumPasswordForm" type="submit" className="button small" disabled={loading}>
              Erase Fulcrum database {loading && <CircularLoader color="primary" className="h-4 w-4" />}
            </button>
          </>
        }
      >
        <p className="text-paragraph">
          Are you sure you want to erase Fulcrum database? Your wallet data will stay intact but it will take a couple of days to resync Fulcrum.
        </p>

        <form id="eraseFulcrumPasswordForm" onSubmit={handleEraseFulcrum} className="w-4/5 mx-auto my-4">
          <label htmlFor="eraseFulcrumPassword" className="block text-white text-lg ml-3 mb-2">
            Password
          </label>
          <input id="eraseFulcrumPassword" type="password" className="input-text" ref={inputRef} autoFocus />
        </form>
      </Dialog>

      <Dialog className="max-w-2xl" open={open && step === "loading"}>
        <p className="text-paragraph mb-4">Removing Fulcrum database and restarting Dojo</p>
        <LinearLoader />
      </Dialog>
    </>
  );
};

const ClearDockerDialog: FC<{ open: boolean; onClose: () => void; dockerCacheSize: number | null }> = ({ open, onClose, dockerCacheSize }) => {
  const router = useRouter();
  const [step, setStep] = useState<"confirm" | "loading">("confirm");
  const { callSnackbar } = useSnackbar();

  const handleClose = () => {
    setStep("confirm");
    onClose();
  };

  const handleClearCache = async () => {
    setStep("loading");

    try {
      const { data } = await client.get<PruneCacheResponse>("/ronindojo/prune-cache");

      if (data.status == "ok") client.post("/ronindojo/prune-cache");

      const awaitPruneComplete = async (): Promise<void> => {
        await delay(5000);
        const { data } = await client.get<PruneCacheResponse>("/ronindojo/prune-cache");

        if (data.status === "running") return awaitPruneComplete();
      };

      await awaitPruneComplete();
      callSnackbar(`Success. ${formatBytes(dockerCacheSize, "GB")} of Docker build cache now removed from disk`, "success");
      router.replace(router.asPath);
    } catch (error) {
      console.error(error);
      callSnackbar("Docker cache clearing failed. See Ronin backend logs for details", "error", true);
    }
    handleClose();
  };

  return (
    <>
      <Dialog
        className="max-w-2xl"
        title="Clear Docker cache"
        open={open && step === "confirm"}
        onClose={handleClose}
        actions={
          <>
            <button onClick={handleClose} className="button small secondary mr-3">
              Cancel
            </button>
            <button onClick={handleClearCache} className="button small">
              Clear Docker cache
            </button>
          </>
        }
      >
        <p className="text-paragraph">
          Are you sure you want to clear Docker cache? This will not delete any Dojo data but might make your next RoninDojo update a little slower.
        </p>
      </Dialog>

      <Dialog className="max-w-2xl" open={open && step === "loading"}>
        <p className="text-paragraph mb-4">Clearing Docker cache, please wait</p>
        <LinearLoader />
      </Dialog>
    </>
  );
};

const RestartTorDialog: FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"confirm" | "loading">("confirm");
  const [loading, setLoading] = useState<boolean>(false);
  const { callSnackbar } = useSnackbar();

  const handleClose = () => {
    setStep("confirm");
    onClose();
  };

  const handleRestartTor = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    const password = inputRef.current?.value ?? "";

    try {
      const data = await encryptString(
        JSON.stringify({
          password,
        }),
      );
      await client.post("/auth/login", data, { headers: { "Content-Type": "text/plain" } });
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        callSnackbar(error_.response?.data.message ?? error_.message, "error");
      } else {
        callSnackbar(String(error_), "error");
      }
      return;
    } finally {
      setLoading(false);
    }

    setStep("loading");

    try {
      const encryptedPassword = await encryptString(password);
      await client.post("/ronindojo/restart-tor", { password: encryptedPassword });

      callSnackbar("Your system Tor has been restarted. Try accessing Ronin UI over Tor in a few minutes.", "success");
      handleClose();
    } catch (error) {
      if (isAxiosError<ErrorResponse>(error)) {
        callSnackbar(error.response?.data.message ?? error.message, "error");
      } else {
        console.error(error);
        callSnackbar("Tor restart failed. See Ronin backend logs for details", "error", true);
      }
      setStep("confirm");
    }
  };

  return (
    <>
      <Dialog
        className="max-w-2xl"
        title="Restart Tor"
        open={open && step === "confirm"}
        onClose={handleClose}
        actions={
          <>
            <button onClick={handleClose} className="button small secondary mr-3" disabled={loading}>
              Cancel
            </button>
            <button form="eraseFulcrumPasswordForm" type="submit" className="button small" disabled={loading}>
              Restart Tor {loading && <CircularLoader color="primary" className="h-4 w-4" />}
            </button>
          </>
        }
      >
        <p className="text-paragraph">Are you sure you want to restart Tor on your RoninDojo system? Please confirm this with your password.</p>

        <form id="eraseFulcrumPasswordForm" onSubmit={handleRestartTor} className="w-4/5 mx-auto my-4">
          <label htmlFor="eraseFulcrumPassword" className="block text-white text-lg ml-3 mb-2">
            Password
          </label>
          <input id="eraseFulcrumPassword" type="password" className="input-text" ref={inputRef} autoFocus />
        </form>
      </Dialog>

      <Dialog className="max-w-2xl" open={open && step === "loading"}>
        <p className="text-paragraph mb-4">Restarting Tor on your RoninDojo system</p>
        <LinearLoader />
      </Dialog>
    </>
  );
};

type SsrProps = PageProps<{
  withLayout: true;
  dockerCacheSize: number | null;
  indexerType: IndexerTypeResponse;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const dockerCacheSize = await pipe(
    getDockerode,
    taskEither.fromIO,
    taskEither.chain((docker) =>
      taskEither.tryCatch(
        () => docker.df(),
        (error) => error,
      ),
    ),
    taskEither.map((dfResult) => dfResult as Record<string, any>),
    taskEither.map(
      flow(
        record.lookup("BuildCache"),
        option.map((buildCacheArr) => buildCacheArr as { Size: number; Shared: boolean }[]),
        option.map(readonlyArray.filter((item) => !item.Shared)),
        option.map(readonlyArray.reduce(0, (prev, curr) => prev + curr.Size)),
        option.toNullable,
      ),
    ),
    taskEither.orElseFirstIOK(fpConsole.error),
    taskEither.getOrElseW(() => task.fromIO(constNull)),
  )();

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Troubleshooting",
      dockerCacheSize: dockerCacheSize,
      indexerType: await getIndexerType(),
    },
  };
});

export default TroubleshootingPage;
