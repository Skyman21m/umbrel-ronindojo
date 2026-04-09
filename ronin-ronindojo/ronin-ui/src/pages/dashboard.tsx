import { GetServerSidePropsContext, InferGetServerSidePropsType, NextPage } from "next";
import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { DateTime, Duration, DurationLikeObject } from "luxon";
import clsx from "clsx";
import { task, apply, either, readonlyArray } from "fp-ts";
import { constFalse, constNull, flow, pipe } from "fp-ts/function";
import useSWR from "swr";
import Dockerode from "dockerode";
import { ExclamationCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { withSessionSsr } from "../lib/server/session";
import { MINUTE, SECOND } from "../const";
import { formatBytes } from "../lib/client";
import { getContainerInfo, Response as ContainerInfoResponse } from "./api/v2/dojo/containers";
import { ManageButton } from "../components/ManageButton";
import { ManageDojoDialog } from "../components/ManageDojoDialog";
import { ManageExplorerDialog } from "../components/ManageExplorerDialog";
import { FeesResponse, StatusResponse } from "../lib/server/dojoApi";
import { MempoolInfo, BlockHeader } from "../lib/server/bitcoind";

import { ReactComponent as DojoIcon } from "../components/icons/dashboard_icons/dojo.svg";
import { ReactComponent as BitcoinIcon } from "../components/icons/dashboard_icons/bitcoin.svg";
import { ReactComponent as RoninDojoIcon } from "../components/icons/dashboard_icons/ronin_backend.svg";
import { ReactComponent as IndexerIcon } from "../components/icons/dashboard_icons/samourai_indexer.svg";
import { ReactComponent as ElectrumIcon } from "../components/icons/dashboard_icons/electrum_server.svg";
import { ReactComponent as MempoolIcon } from "../components/icons/dashboard_icons/mempool.svg";
import { ReactComponent as ExplorerIcon } from "../components/icons/dashboard_icons/rpc_explorer.svg";
import { ReactComponent as BlockIcon } from "../components/icons/general_icons/block.svg";
import { ReactComponent as ExpandIcon } from "../components/icons/general_icons/expand.svg";
import { ReactComponent as CompressIcon } from "../components/icons/general_icons/compress.svg";
import { ProgressBar } from "../components/ProgressBar";
import { getDojoStatus } from "./api/v2/dojo/status";
import { getRDBlockchainInfo, Response as BlockchainInfoResponse } from "./api/v2/bitcoind/blockchain-info";
import { getRDMempoolInfo } from "./api/v2/bitcoind/mempool-info";
import { getCpuTemperature, Response as CPuTempResponse } from "./api/v2/system/cpu-temperature";
import { getCurrentLoad, Response as CurrentLoadResponse } from "./api/v2/system/current-load";
import { getMemoryData, Response as MemoryDataResponse } from "./api/v2/system/memory";
import { getUptime, Response as UptimeResponse } from "./api/v2/system/uptime";
import { getLastBlocks, Response as LastBlocksResponse } from "./api/v2/bitcoind/last-blocks";
import { getFees } from "./api/v2/dojo/fees";
import { getRoninDojoVersion, Response as RoninDojoVersionResponse } from "./api/v2/ronindojo/version";
import { ManageRoninDojoDialog } from "../components/ManageRoninDojoDialog";
import { ManageBitcoindDialog } from "../components/ManageBitcoindDialog";
import { ContainerStatusIndicator } from "../components/ContainerStatusIndicator";
import { getRaceTask, getRaceTaskEither } from "../lib/server/raceTaskEither";
import { getIndexerType, IndexerType, Response as IndexerTypeResponse } from "./api/v2/ronindojo/indexer-type";
import { getFsSizeData } from "./api/v2/system/fs-size";
import { ManageIndexerDialog } from "../components/ManageIndexerDialog";
import { ManageMempoolDialog } from "../components/ManageMempoolDialog";
import { PageProps } from "../types";
import { TROUBLESHOOTING } from "../routes";

const getIbdStatus = (initialblockdownload?: boolean) => {
  if (initialblockdownload == null) return "--";

  return initialblockdownload ? "IN PROGRESS" : "FINISHED";
};

const getMempoolStatus = (isMempoolInstalled: null | boolean, isMempoolRunning: boolean) => {
  if (isMempoolInstalled == null) return "--";

  if (isMempoolInstalled) {
    return isMempoolRunning ? "Running" : "Stopped";
  } else {
    return "Not installed";
  }
};

const containerAnimationVariants: Variants = {
  hidden: {
    transition: {
      staggerChildren: 0.2,
      staggerDirection: -1,
      when: "afterChildren",
    },
  },
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemAnimationVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    transition: {
      duration: 0.3,
    },
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

const nameIncludes = (container: { Names: string[] }, pattern: string) =>
  container.Names.some((n) => n.toLowerCase().includes(pattern));

const getBlockTime = (blockHeader: BlockHeader): string => {
  const seconds = DateTime.utc().toSeconds() - blockHeader.time;
  const duration = Duration.fromObject({ seconds: seconds }).shiftTo("days", "hours", "minutes", "seconds", "milliseconds");

  if (duration.days) {
    return `${duration.days} days`;
  }

  if (duration.hours) {
    return `${duration.hours} hours`;
  }

  if (duration.minutes) {
    return `${duration.minutes} minutes`;
  }

  return `${duration.seconds} seconds`;
};

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const DashboardPage: NextPage<Props> = ({
  dojoStatus,
  containerInfo,
  blockchainInfo,
  ssrMempoolInfo,
  ssrLastBlocks,
  ssrCurrentLoad,
  ssrTemperatureData,
  ssrMemory,
  ssrUptime,
  ssrFees,
  ssrRoninDojoVersion,
  indexerType,
  fsUseOver95,
}) => {
  const [showRoninDojoDialog, setShowRoninDojoDialog] = useState<boolean>(false);
  const [showDojoDialog, setShowDojoDialog] = useState<boolean>(false);
  const [showExplorerDialog, setShowExplorerDialog] = useState<boolean>(false);
  const [showBitcoindDialog, setShowBitcoindDialog] = useState<boolean>(false);
  const [showIndexerDialog, setShowIndexerDialog] = useState<boolean>(false);
  const [showMempoolDialog, setShowMempoolDialog] = useState<boolean>(false);
  const [showAllContainers, setShowAllContainers] = useState<boolean>(false);

  const { data: containerInfoData } = useSWR<ContainerInfoResponse | null>("/dojo/containers", {
    refreshInterval: 20 * SECOND,
    fallbackData: containerInfo,
  });

  const isDbRunning = Boolean(containerInfoData?.find((c) => nameIncludes(c, "db"))?.State.toLowerCase() === "running");
  const isNodejsRunning = Boolean(containerInfoData?.find((c) => nameIncludes(c, "nodejs") || nameIncludes(c, "_node_") || nameIncludes(c, "_node-"))?.State.toLowerCase() === "running");
  const isBitcoindRunning = true; // On Umbrel, Bitcoin is managed externally
  const isIndexerRunning = Boolean(
    containerInfoData
      ?.find((c) => nameIncludes(c, "indexer") || nameIncludes(c, "electrs") || nameIncludes(c, "fulcrum"))
      ?.State.toLowerCase() === "running",
  );
  const isMempoolInstalled = containerInfoData ? containerInfoData.some((c) => nameIncludes(c, "mempool_db") || nameIncludes(c, "mempool-db")) : null;
  const isMempoolRunning = Boolean(containerInfoData?.find((c) => nameIncludes(c, "mempool_db") || nameIncludes(c, "mempool-db"))?.State.toLowerCase() === "running");

  const isExplorerRunning = Boolean(containerInfoData?.find((c) => nameIncludes(c, "explorer"))?.State.toLowerCase() === "running");

  const { data: dojoStatusData } = useSWR<StatusResponse | null>(isNodejsRunning ? "/dojo/status" : null, {
    refreshInterval: 10 * SECOND,
    fallbackData: dojoStatus,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (retryCount >= 10) return;
      setTimeout(() => revalidate({ retryCount }), 5 * SECOND);
    },
  });

  const { data: cpuTempData } = useSWR<CPuTempResponse | null>("/system/cpu-temperature", { refreshInterval: 5 * SECOND, fallbackData: ssrTemperatureData });

  const { data: cpuLoadData } = useSWR<CurrentLoadResponse | null>("/system/current-load", {
    refreshInterval: 5 * SECOND,
    fallbackData: ssrCurrentLoad,
  });

  const { data: memoryData } = useSWR<MemoryDataResponse | null>("/system/memory", {
    refreshInterval: 5 * SECOND,
    fallbackData: ssrMemory,
  });

  const { data: uptimeData } = useSWR<UptimeResponse | null>("/system/uptime", {
    refreshInterval: MINUTE,
    fallbackData: ssrUptime,
  });

  const { data: blockchainInfoData } = useSWR<BlockchainInfoResponse | null>(isBitcoindRunning ? "/bitcoind/blockchain-info" : null, {
    refreshInterval: 30 * SECOND,
    fallbackData: blockchainInfo,
  });

  const { data: lastBlockData } = useSWR<LastBlocksResponse | null>(isBitcoindRunning ? "/bitcoind/last-blocks" : null, {
    refreshInterval: 30 * SECOND,
    fallbackData: ssrLastBlocks,
  });

  const { data: mempoolInfo } = useSWR<MempoolInfo | null>(isBitcoindRunning ? "/bitcoind/mempool-info" : null, {
    refreshInterval: MINUTE,
    fallbackData: ssrMempoolInfo,
  });

  const { data: recommendedFeesData } = useSWR<FeesResponse | null>(isNodejsRunning ? "/dojo/fees" : null, {
    refreshInterval: 3 * MINUTE,
    fallbackData: ssrFees,
  });

  const { data: indexerTypeResponse } = useSWR<IndexerTypeResponse | null>("ronindojo/indexer-type", {
    fallbackData: { type: indexerType },
    refreshInterval: 5 * MINUTE,
  });

  const systemUptimeObject = Duration.fromObject({ seconds: Number(uptimeData?.uptime ?? 0) })
    .shiftTo("days", "hours", "minutes")
    .normalize()
    .toObject();

  const uptimeArray = dojoStatusData?.uptime ? dojoStatusData?.uptime.split(":") : [0, 0, 0, 0];

  const durationObj: DurationLikeObject = {
    days: uptimeArray.length === 4 ? Number(uptimeArray[0]) : 0,
    hours: uptimeArray.length === 4 ? Number(uptimeArray[1]) : Number(uptimeArray[0]),
    minutes: uptimeArray.length === 4 ? Number(uptimeArray[2]) : Number(uptimeArray[1]),
    seconds: uptimeArray.length === 4 ? Number(uptimeArray[3]) : Number(uptimeArray[2]),
  };

  const dojoUptimeObject = Duration.fromObject(durationObj).shiftTo("days", "hours", "minutes").normalize().toObject();

  const syncProgress = Number(blockchainInfoData ? (100 * blockchainInfoData.verificationprogress).toFixed(3) : 0);

  const memoryUsed = memoryData ? ((memoryData.active + memoryData.swapused) / (memoryData.total + memoryData.swaptotal)) * 100 : 0;

  const dojoTrackerProgress = Math.min(
    100,
    blockchainInfoData && dojoStatusData ? Number(((100 / blockchainInfoData.blocks ?? 1) * dojoStatusData.blocks ?? 1).toFixed(2)) : 0,
  );
  const indexerProgress = Math.min(
    100,
    blockchainInfoData && dojoStatusData && dojoStatusData.indexer?.maxHeight != null ? Number(((100 / blockchainInfoData.blocks ?? 1) * dojoStatusData.indexer.maxHeight).toFixed(2)) : 0,
  );

  return (
    <motion.div className="container" variants={containerAnimationVariants} initial="hidden" animate="visible" exit="hidden">
      {isBitcoindRunning && isDbRunning && !isNodejsRunning && blockchainInfoData?.initialblockdownload && (
        <motion.div className="box bg-surface w-full mb-4 flex items-center" variants={itemAnimationVariants}>
          <ExclamationCircleIcon className="inline-block h-8 w-8 text-secondary mr-3" />
          <span className="text-lg text-white font-primary font-light">
            Your RoninDojo is now in the state of Initial Block Download (IBD). All unnecessary services have been stopped to speed up this process.
            <br /> Once IBD is complete all services will automatically resume.
          </span>
        </motion.div>
      )}

      {fsUseOver95 && (
        <motion.div className="box bg-surface w-full mb-4 flex items-center" variants={itemAnimationVariants}>
          <ExclamationTriangleIcon className="inline-block h-8 w-8 text-yellow-600 mr-3" />
          <span className="text-lg text-white font-primary font-light">
            Your disk appears to be running out of space. Head to the{" "}
            <Link href={TROUBLESHOOTING} className="transition-colors text-secondary hover:text-secondary-alpha">
              Troubleshooting
            </Link>{" "}
            section to free up some space by deleting Docker build cache.
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 grid-rows-5 gap-4">
        <motion.div className="box bg-surface row-span-5 relative" variants={itemAnimationVariants}>
          <h2 className="text-primary font-primary mb-6">Dojo</h2>

          <div className="flex items-center justify-between mb-7">
            <div className="flex flex-col items-center">
              <h3 className="text-white font-primary text-3xl">{dojoTrackerProgress}%</h3>
              <span className="text-base font-mono text-secondary">Synchronized</span>
            </div>
            <div className="w-14 h-14 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
              <DojoIcon width={40} height={40} className="fill-current" />
            </div>
          </div>
          <div className="mb-6">
            <ProgressBar progress={dojoTrackerProgress} />
          </div>

          <div className="flex flex-col items-start mb-8">
            <span className="mb-3 text-lightGrey text-base">Uptime</span>
            <h3 className="text-lighterGrey text-2xl font-primary">
              {dojoStatusData
                ? `${dojoUptimeObject.days} days, ${dojoUptimeObject.hours} hours, ${Math.round(dojoUptimeObject.minutes ?? 0)} minutes`
                : "-- minutes"}
            </h3>
          </div>

          {containerInfoData && (
            <div className="relative">
              <table className="w-full text-lightGrey table-rounded">
                <thead>
                  <tr className="text-left text-white text-sm">
                    <th className="px-5 py-2 text-paragraph font-normal text-base">Container</th>
                    <th className="px-5 py-2 text-paragraph font-normal text-base">State</th>
                    <th className="px-5 py-2 text-paragraph font-normal text-base">Status</th>
                  </tr>
                </thead>
                <motion.tbody
                  className="divide-y divide-surface"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2, delayChildren: 0.5 } } }}
                  initial="hidden"
                  animate="visible"
                >
                  {containerInfoData.slice(0, showAllContainers ? containerInfoData.length : 4).map((container) => (
                    <motion.tr
                      key={container.Id}
                      variants={{
                        hidden: { opacity: 0, transition: { duration: 0.2 } },
                        visible: { opacity: 1, transition: { duration: 0.2 } },
                      }}
                    >
                      <td className="p-5 bg-border text-sm text-paragraph">{container.Names.join("").replace("/", "")}</td>
                      <td
                        className={clsx([
                          "p-5",
                          "bg-border",
                          "text-base",
                          "font-mono",
                          container.State.toLowerCase() === "running" ? "text-secondary" : "text-primary",
                        ])}
                      >
                        {container.State}
                      </td>
                      <td className="p-5 bg-border text-sm text-paragraph">{container.Status}</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
              <AnimatePresence mode="wait">
                {showAllContainers ? (
                  <motion.div
                    key="compress"
                    className="absolute top-2 right-2"
                    onClick={() => setShowAllContainers(false)}
                    variants={{
                      hidden: { opacity: 0, transition: { duration: 0.1 } },
                      visible: { opacity: 1, transition: { duration: 0.1 } },
                    }}
                    initial={false}
                    animate="visible"
                    exit="hidden"
                  >
                    <CompressIcon className="cursor-pointer w-6 h-6 text-paragraph fill-current hover:text-white transition-colors" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="expand"
                    className="absolute top-2 right-2"
                    onClick={() => setShowAllContainers(true)}
                    variants={{
                      hidden: { opacity: 0, transition: { duration: 0.1 } },
                      visible: { opacity: 1, transition: { duration: 0.1 } },
                    }}
                    initial={false}
                    animate="visible"
                    exit="hidden"
                  >
                    <ExpandIcon className="cursor-pointer w-6 h-6 text-paragraph fill-current hover:text-white transition-colors" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <ContainerStatusIndicator running={isDbRunning} />
          <ManageButton onClick={() => setShowDojoDialog(true)} />
        </motion.div>

        <motion.div className="box bg-surface row-span-5 relative" variants={itemAnimationVariants}>
          <h2 className="text-primary font-primary mb-6">Bitcoin Core</h2>
          <div className="flex items-center justify-between mb-7">
            <div className="flex flex-col items-center">
              <h3 className="text-white font-primary text-3xl">{syncProgress}%</h3>
              <span className="text-base font-mono text-secondary">Synchronized</span>
            </div>
            <div className="w-14 h-14 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
              <BitcoinIcon width={40} height={40} className="fill-current" />
            </div>
          </div>
          <div className="mb-6">
            <ProgressBar progress={syncProgress} />
          </div>
          <div className="grid grid-cols-6 gap-2 gap-y-8 mb-7">
            <div className="flex flex-col items-center justify-center col-span-2">
              <div className="mb-3 text-lightGrey text-base">Mempool Size</div>
              <div className="text-lighterGrey text-2xl font-primary">{formatBytes(mempoolInfo?.usage || 0, "MiB")}</div>
            </div>

            <div className="flex flex-col items-center justify-center col-span-2">
              <div className="mb-3 text-lightGrey text-base">Mempool TXs</div>
              <div className="text-lighterGrey text-2xl font-primary">{mempoolInfo?.size || 0}</div>
            </div>

            <div className="flex flex-col items-center justify-center col-span-2">
              <div className="mb-3 text-lightGrey text-base">Block height</div>
              <div className="text-lighterGrey text-2xl font-primary">{blockchainInfoData?.blocks || 0}</div>
            </div>

            <div className="flex flex-col items-center justify-center col-span-3">
              <div className="mb-3 text-lightGrey text-base">Size on disk</div>
              <div className="text-lighterGrey text-2xl font-primary">{formatBytes(blockchainInfoData?.size_on_disk ?? null, "GiB")}</div>
            </div>

            <div className="flex flex-col items-center justify-center col-span-3" title="Initial Block Download">
              <div className="mb-3 text-lightGrey text-base">IBD status</div>
              <div className="text-lighterGrey text-2xl font-primary">{getIbdStatus(blockchainInfoData?.initialblockdownload)}</div>
            </div>
          </div>
          {lastBlockData && (
            <>
              <div className="mb-3 text-lightGrey text-base mb-5">Latest blocks</div>
              <motion.div
                className="rounded-xl divide-y divide-surface overflow-hidden mb-6"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2, delayChildren: 0.5 } } }}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <AnimatePresence>
                  {lastBlockData.map((blockHeader) => (
                    <motion.div
                      key={blockHeader.height}
                      className="p-5 flex items-center justify-between bg-border"
                      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}
                    >
                      <div className="text-secondary">
                        <BlockIcon className="w-8 fill-current" />
                      </div>
                      <div className="px-4">
                        <div className="text-2xl text-lighterGrey font-primary">Block {blockHeader.height}</div>
                        <div className="text-secondary font-mono">{blockHeader.nTx} transactions</div>
                      </div>
                      <div
                        className="text-sm self-end text-lightGrey flex-1 text-right"
                        title={DateTime.fromSeconds(blockHeader.time, { zone: "UTC" }).toRFC2822() ?? undefined}
                      >
                        {getBlockTime(blockHeader)} ago
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            </>
          )}
          {recommendedFeesData && (
            <>
              <div className="mb-3 text-lightGrey text-base mb-5">Recommended fees</div>
              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 rounded-xl overflow-hidden divide-y md:divide-x md:divide-y-0 divide-surface mb-2"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2, delayChildren: 0.5 } } }}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <motion.div
                  className="bg-border text-center py-4"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}
                >
                  <div className="text-lightGrey">Low priority</div>
                  <div className="text-white text-xl">
                    {recommendedFeesData["24"]} <span className="text-xs text-paragraph">sat/vB</span>
                  </div>
                </motion.div>

                <motion.div
                  className="bg-border text-center py-4"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}
                >
                  <div className="text-lightGrey">Medium priority</div>
                  <div className="text-white text-xl">
                    {recommendedFeesData["6"]} <span className="text-xs text-paragraph">sat/vB</span>
                  </div>
                </motion.div>

                <motion.div
                  className="bg-border text-center py-4"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}
                >
                  <div className="text-lightGrey">High priority</div>
                  <div className="text-white text-xl">
                    {recommendedFeesData["2"]} <span className="text-xs text-paragraph">sat/vB</span>
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
          <ContainerStatusIndicator running={isBitcoindRunning} />
          <ManageButton onClick={() => setShowBitcoindDialog(true)} />
        </motion.div>

        <motion.div className="box bg-surface row-span-3 relative" variants={itemAnimationVariants}>
          <h2 className="text-primary font-primary mb-6">RoninDojo</h2>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-start">
              <span className="text-lg text-paragraph">Uptime</span>
              <h3 className="text-white font-primary text-2xl">
                {uptimeData
                  ? `${systemUptimeObject.days} days, ${systemUptimeObject.hours} hours, ${Math.round(systemUptimeObject.minutes ?? 0)} minutes`
                  : "-- minutes"}
              </h3>
            </div>
            <div className="w-14 h-14 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center flex-shrink-0">
              <RoninDojoIcon width={40} height={40} className="fill-current" />
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-start">
              <span className="text-lg text-paragraph">Version</span>
              <h3 className="text-white font-primary text-2xl">{ssrRoninDojoVersion?.version}</h3>
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-start">
              <span className="text-lg text-paragraph">CPU temp</span>
              <h3 className="text-white font-primary text-2xl">{cpuTempData?.main?.toFixed(1) ?? "--"}°C</h3>
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-start">
              <span className="text-lg text-paragraph">CPU load</span>
              <h3 className="text-white font-primary text-2xl">{cpuLoadData?.currentLoad.toFixed(0)}%</h3>
            </div>
            <div className="w-3/5">
              <ProgressBar progress={cpuLoadData?.currentLoad ?? 0} />
            </div>
          </div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-start">
              <span className="text-lg text-paragraph">Memory used</span>
              <h3 className="text-white font-primary text-2xl">{memoryUsed.toFixed(0)}%</h3>
            </div>
            <div className="w-3/5">
              <ProgressBar progress={memoryUsed} />
            </div>
          </div>
          <ManageButton onClick={() => setShowRoninDojoDialog(true)} />
        </motion.div>

        <motion.div className="box bg-surface row-span-2" variants={itemAnimationVariants}>
          <h2 className="text-primary font-primary mb-6">Indexer</h2>

          <div className="flex items-center justify-between mb-7">
            <div className="flex flex-col items-center">
              {indexerProgress > 0 ? (
                <>
                  <h3 className="text-white font-primary text-3xl">{indexerProgress}%</h3>
                  <span className="text-base font-mono text-secondary">Synchronized</span>
                </>
              ) : (
                <h3 className="text-white font-primary text-3xl">{isIndexerRunning ? "Synchronizing..." : "Stopped"}</h3>
              )}
            </div>
            <div className="w-14 h-14 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
              {indexerType === "Electrs" || indexerType === "Fulcrum" ? (
                <ElectrumIcon width={40} height={40} className="fill-current" />
              ) : (
                <IndexerIcon width={40} height={40} className="fill-current" />
              )}
            </div>
          </div>

          {indexerProgress > 0 && (
            <div className="mb-6">
              <ProgressBar progress={indexerProgress} />
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col items-start">
              <span className="text-lg text-paragraph">Type</span>
              <h3 className="text-white font-primary text-2xl">{indexerTypeResponse?.type}</h3>
            </div>
          </div>
          <ContainerStatusIndicator running={isIndexerRunning} />
          <ManageButton onClick={() => setShowIndexerDialog(true)} />
        </motion.div>

        <motion.div className="box bg-surface row-span-2" variants={itemAnimationVariants}>
          <h2 className="text-primary font-primary mb-6">BTC-RPC Explorer</h2>

          <div className="flex items-center justify-between mb-7">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-white font-primary text-3xl">Status</h3>
                <div className="text-lightGrey">Click the button below to show your BTC-RPC Explorer details.</div>
              </div>
              <div className="w-14 h-14 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
                <ExplorerIcon width={40} height={40} className="fill-current" />
              </div>
            </div>
          </div>

          <div
            className={clsx([
              "absolute top-0 right-0 border-b border-l border-primary px-2 py-0.5 font-mono text-base",
              isExplorerRunning ? "text-secondary" : "text-primary",
            ])}
          >
            &#9679; {isExplorerRunning ? "Running" : "Stopped"}
          </div>
          <ManageButton onClick={() => setShowExplorerDialog(true)} />
        </motion.div>

        <motion.div className="box bg-surface row-span-2" variants={itemAnimationVariants}>
          <h2 className="text-primary font-primary mb-6">Mempool Space</h2>

          <div className="flex items-center justify-between mb-7">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-white font-primary text-3xl">Status</h3>
                <div className="text-lightGrey">Click the button below to manage your Mempool Space.</div>
              </div>
              <div className="w-14 h-14 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
                <MempoolIcon width={40} height={40} className="fill-current" />
              </div>
            </div>
          </div>

          <div
            className={clsx([
              "absolute top-0 right-0 border-b border-l border-primary px-2 py-0.5 font-mono text-base",
              isMempoolInstalled && isMempoolRunning ? "text-secondary" : "text-primary",
            ])}
          >
            &#9679; {getMempoolStatus(isMempoolInstalled, isMempoolRunning)}
          </div>
          <ManageButton onClick={() => setShowMempoolDialog(true)} />
        </motion.div>
      </div>
      <ManageDojoDialog open={showDojoDialog} onClose={() => setShowDojoDialog(false)} />
      <ManageRoninDojoDialog open={showRoninDojoDialog} onClose={() => setShowRoninDojoDialog(false)} />
      <ManageBitcoindDialog open={showBitcoindDialog} onClose={() => setShowBitcoindDialog(false)} />
      <ManageIndexerDialog open={showIndexerDialog} onClose={() => setShowIndexerDialog(false)} indexerType={indexerTypeResponse?.type} />
      <ManageMempoolDialog open={showMempoolDialog} onClose={() => setShowMempoolDialog(false)} isMempoolInstalled={isMempoolInstalled} />
      <ManageExplorerDialog open={showExplorerDialog} onClose={() => setShowExplorerDialog(false)} />
    </motion.div>
  );
};

type SsrProps = PageProps<{
  blockchainInfo: BlockchainInfoResponse | null;
  dojoStatus: StatusResponse | null;
  containerInfo: Dockerode.ContainerInfo[] | null;
  ssrMempoolInfo: MempoolInfo | null;
  ssrLastBlocks: LastBlocksResponse | null;
  ssrCurrentLoad: CurrentLoadResponse | null;
  ssrTemperatureData: CPuTempResponse | null;
  ssrMemory: MemoryDataResponse | null;
  ssrUptime: UptimeResponse | null;
  ssrFees: FeesResponse | null;
  ssrRoninDojoVersion: RoninDojoVersionResponse | null;
  indexerType: IndexerType | null;
  fsUseOver95: boolean;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const [
    blockchainInfo,
    dojoStatus,
    containerInfo,
    mempoolInfo,
    ssrLastBlocks,
    ssrCurrentLoad,
    ssrTemperatureData,
    ssrMemory,
    ssrFees,
    ssrRoninDojoVersion,
    indexerType,
    fsSize,
  ] = await apply.sequenceT(task.ApplyPar)(
    getRaceTaskEither(getRDBlockchainInfo),
    getRaceTaskEither(getDojoStatus),
    getRaceTaskEither(getContainerInfo),
    getRaceTaskEither(getRDMempoolInfo),
    getRaceTaskEither(getLastBlocks),
    getRaceTaskEither(getCurrentLoad),
    getRaceTaskEither(getCpuTemperature),
    getRaceTaskEither(getMemoryData),
    getRaceTaskEither(getFees),
    getRaceTaskEither(getRoninDojoVersion),
    getRaceTask(getIndexerType),
    getFsSizeData,
  )();

  const systemUptimeData = getUptime();

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Dashboard",
      blockchainInfo: pipe(blockchainInfo, either.getOrElseW(constNull)),
      dojoStatus: pipe(dojoStatus, either.getOrElseW(constNull)),
      containerInfo: pipe(containerInfo, either.getOrElseW(constNull)),
      ssrMempoolInfo: pipe(mempoolInfo, either.getOrElseW(constNull)),
      ssrLastBlocks: pipe(ssrLastBlocks, either.getOrElseW(constNull)),
      ssrCurrentLoad: pipe(ssrCurrentLoad, either.getOrElseW(constNull)),
      ssrTemperatureData: pipe(ssrTemperatureData, either.getOrElseW(constNull)),
      ssrMemory: pipe(ssrMemory, either.getOrElseW(constNull)),
      ssrUptime: pipe(systemUptimeData, either.getOrElseW(constNull)),
      ssrFees: pipe(ssrFees, either.getOrElseW(constNull)),
      ssrRoninDojoVersion: pipe(ssrRoninDojoVersion, either.getOrElseW(constNull)),
      indexerType: indexerType?.type,
      fsUseOver95: pipe(fsSize, either.map(flow(readonlyArray.some((disk) => disk.mount === "/mnt/usb" && disk.use > 95))), either.getOrElseW(constFalse)),
    },
  };
});

export default DashboardPage;
