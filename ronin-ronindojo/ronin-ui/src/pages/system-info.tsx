import React, { SyntheticEvent, useCallback, useMemo, useState } from "react";
import { GetServerSideProps, GetServerSidePropsContext, NextPage } from "next";
import useSWR from "swr";
import { Systeminformation } from "systeminformation";
import { Duration } from "luxon";
import { motion } from "framer-motion";
import { option, task, apply } from "fp-ts";
import { pipe } from "fp-ts/function";

import { MINUTE, SECOND } from "../const";
import { formatBytes } from "../lib/client";
import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { withSessionSsr } from "../lib/server/session";
import { boxParentTransition, boxTransition, pageTransition } from "../animations";
import { ProgressBar } from "../components/ProgressBar";
import { getCpuTemperature, Response as CPuTempResponse } from "./api/v2/system/cpu-temperature";
import { getCurrentLoad, Response as CurrentLoadResponse } from "./api/v2/system/current-load";
import { getMemoryData, Response as MemoryDataResponse } from "./api/v2/system/memory";
import { getNetworkInterfaceData, Response as NetworkInterfaceResponse } from "./api/v2/system/network-interface";
import { getFsSizeData, Response as FsSizeResponse } from "./api/v2/system/fs-size";
import { getUptime, Response as UptimeResponse } from "./api/v2/system/uptime";
import { RebootRoninDojo } from "../components/RebootRoninDojo";
import { PageProps } from "../types";

type Action = null | "reboot" | "shut down";

interface Props {
  layoutTitle: string;
  ssrCpuTemperature: Systeminformation.CpuTemperatureData | null;
  ssrCurrentLoad: Systeminformation.CurrentLoadData | null;
  ssrMemoryData: Systeminformation.MemData | null;
  ssrNetworkInterfaceData: Systeminformation.NetworkInterfacesData | null;
  ssrFsSizeData: Systeminformation.FsSizeData[] | null;
  ssrUptime: Systeminformation.TimeData | null;
}

const SystemInfo: NextPage<Props> = ({ layoutTitle, ssrCpuTemperature, ssrCurrentLoad, ssrMemoryData, ssrNetworkInterfaceData, ssrFsSizeData, ssrUptime }) => {
  const [action, setAction] = useState<Action>(null);
  const { data: cpuTemperature } = useSWR<CPuTempResponse | null>("/system/cpu-temperature", { refreshInterval: 5 * SECOND, fallbackData: ssrCpuTemperature });
  const { data: cpuLoadData } = useSWR<CurrentLoadResponse | null>("/system/current-load", {
    refreshInterval: 5 * SECOND,
    fallbackData: ssrCurrentLoad,
  });
  const { data: fsSizeData } = useSWR<FsSizeResponse | null>("/system/fs-size", {
    refreshInterval: MINUTE,
    fallbackData: ssrFsSizeData,
  });
  const { data: memoryData } = useSWR<MemoryDataResponse | null>("/system/memory", {
    refreshInterval: 5 * SECOND,
    fallbackData: ssrMemoryData,
  });

  const { data: networkInterfaceData } = useSWR<NetworkInterfaceResponse | null>("/system/network-interface", {
    refreshInterval: 10 * MINUTE,
    fallbackData: ssrNetworkInterfaceData,
  });

  const { data: timeData } = useSWR<UptimeResponse | null>("/system/uptime", {
    refreshInterval: MINUTE,
    fallbackData: ssrUptime,
  });

  const uptimeObject = useMemo(() => {
    return Duration.fromObject({ seconds: Number(timeData?.uptime ?? 0) })
      .shiftTo("days", "hours", "minutes")
      .normalize()
      .toObject();
  }, [timeData?.uptime]);

  const handleOpenConfirmModal = useCallback(
    (action: Action) => (event: SyntheticEvent) => {
      setAction(action);
    },
    [],
  );

  return (
    <motion.div className="container h-full min-h-full" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box">
        <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
        <p className="text-paragraph">Here is all the information regarding your RoninDojo system. You can use panel to monitor and manage your RoninDojo.</p>

        <motion.div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8" variants={boxParentTransition} animate="visible" initial="hidden">
          <motion.div className="box bg-black" variants={boxTransition}>
            <h3 className="text-white font-primary text-xl mb-3">System</h3>
            <dl className="text-white mb-3">
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">Uptime</dt>
                <dd>{timeData ? `${uptimeObject.days} days, ${uptimeObject.hours} hours, ${Math.round(uptimeObject?.minutes ?? 0)} minutes` : "-- minutes"}</dd>
              </div>
            </dl>
            <div className="xl:flex items-center justify-end">
              <button onClick={handleOpenConfirmModal("reboot")} className="button m-3">
                Reboot
              </button>
              <button onClick={handleOpenConfirmModal("shut down")} className="button">
                Shut down
              </button>
            </div>
          </motion.div>

          <motion.div className="box bg-black" variants={boxTransition}>
            <h3 className="text-white font-primary text-xl mb-3">CPU</h3>
            <dl className="text-white">
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">Temperature</dt>
                <dd>{cpuTemperature?.main.toFixed(1) ?? "--"} °C</dd>
              </div>
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">Current load</dt>
                <dd>{cpuLoadData?.currentLoad.toFixed(2) ?? "--"} %</dd>
              </div>
            </dl>
          </motion.div>

          <motion.div className="box bg-black xl:col-span-2" variants={boxTransition}>
            <h3 className="text-white font-primary text-xl mb-3">File System</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-lightGrey table-rounded">
                <thead>
                  <tr className="text-left text-white text-sm">
                    <th className="p-2">Name</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Size</th>
                    <th className="p-2">Used</th>
                    <th className="p-2">Used&nbsp;%</th>
                    <th className="p-2">Mount</th>
                  </tr>
                </thead>
                <motion.tbody
                  className="divide-y divide-surface"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.2, delayChildren: 1 } } }}
                  initial="hidden"
                  animate="visible"
                >
                  {fsSizeData?.map((fsData) => (
                    <motion.tr key={fsData.fs} variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }}>
                      <td className="p-2 bg-border">{fsData.fs}</td>
                      <td className="p-2 bg-border">{fsData.type}</td>
                      <td className="p-2 bg-border">{formatBytes(fsData.size, "GiB")}</td>
                      <td className="p-2 bg-border">{formatBytes(fsData.used, "GiB")}</td>
                      <td className="p-2 bg-border">{fsData.use}&nbsp;%</td>
                      <td className="p-2 bg-border">{fsData.mount}</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </motion.div>

          <motion.div className="box bg-black" variants={boxTransition}>
            <h3 className="text-white font-primary text-xl mb-3">Memory</h3>

            <div className="flex items-center text-white mb-2">
              <div className="w-1/6 text-sm font-bold">RAM</div>
              <ProgressBar progress={((memoryData?.active ?? 0) / (memoryData?.total ?? 1)) * 100} />
              <div className="w-1/6 font-bold text-center">{(((memoryData?.active ?? 0) / (memoryData?.total ?? 1)) * 100).toFixed(0)}%</div>
            </div>
            <div className="flex items-center text-white mb-8">
              <div className="w-1/6 text-sm font-bold">SWAP</div>
              <ProgressBar progress={((memoryData?.swapused ?? 0) / (memoryData?.swaptotal ?? 1)) * 100} />
              <div className="w-1/6 font-bold text-center">{(((memoryData?.swapused ?? 0) / (memoryData?.swaptotal ?? 1)) * 100).toFixed(0)}%</div>
            </div>

            <div className="flex items-center justify-between">
              <dl className="text-white flex-1">
                <div className="flex items-center mb-2">
                  <dt className="w-1/2 mr-8 text-sm font-bold">RAM Total</dt>
                  <dd>{formatBytes(memoryData?.total ?? 0, "GiB")}</dd>
                </div>
                <div className="flex items-center mb-2">
                  <dt className="w-1/2 mr-8 text-sm font-bold">RAM Free</dt>
                  <dd>{formatBytes(memoryData?.available ?? 0, "GiB")}</dd>
                </div>
                <div className="flex items-center mb-2">
                  <dt className="w-1/2 mr-8 text-sm font-bold">RAM Used</dt>
                  <dd>{formatBytes(memoryData?.active ?? 0, "GiB")}</dd>
                </div>
              </dl>

              <dl className="text-white flex-1">
                <div className="flex items-center mb-2">
                  <dt className="w-1/2 mr-8 text-sm font-bold">SWAP Total</dt>
                  <dd>{formatBytes(memoryData?.swaptotal ?? 0, "GiB")}</dd>
                </div>
                <div className="flex items-center mb-2">
                  <dt className="w-1/2 mr-8 text-sm font-bold">SWAP Free</dt>
                  <dd>{formatBytes(memoryData?.swapfree ?? 0, "GiB")}</dd>
                </div>
                <div className="flex items-center mb-2">
                  <dt className="w-1/2 mr-8 text-sm font-bold">SWAP Used</dt>
                  <dd>{formatBytes(memoryData?.swapused ?? 0, "GiB")}</dd>
                </div>
              </dl>
            </div>
          </motion.div>

          <motion.div className="box bg-black" variants={boxTransition}>
            <h3 className="text-white font-primary text-xl mb-3">Network interface</h3>
            <dl className="text-white">
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">Name</dt>
                <dd>{networkInterfaceData?.ifaceName ?? "--"}</dd>
              </div>
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">Type</dt>
                <dd>{networkInterfaceData?.type ?? "--"}</dd>
              </div>
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">IPv4</dt>
                <dd>{networkInterfaceData?.ip4 ?? "--"}</dd>
              </div>
              <div className="flex items-center mb-2">
                <dt className="w-1/5 mr-8 text-sm font-bold">IPv4 Subnet</dt>
                <dd>{networkInterfaceData?.ip4subnet ?? "--"}</dd>
              </div>
            </dl>
          </motion.div>
        </motion.div>
      </div>

      <RebootRoninDojo action={action} setAction={setAction} />
    </motion.div>
  );
};

export const getServerSideProps = withSessionSsr<PageProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const [ssrCpuTemperature, ssrCurrentLoad, ssrMemoryData, ssrNetworkInterfaceData, ssrFsSizeData] = await apply.sequenceT(task.ApplyPar)(
    getCpuTemperature,
    getCurrentLoad,
    getMemoryData,
    getNetworkInterfaceData,
    getFsSizeData,
  )();

  const systemUptime = getUptime();

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "System Info",
      ssrCpuTemperature: pipe(ssrCpuTemperature, option.fromEither, option.toNullable),
      ssrCurrentLoad: pipe(ssrCurrentLoad, option.fromEither, option.toNullable),
      ssrMemoryData: pipe(ssrMemoryData, option.fromEither, option.toNullable),
      ssrNetworkInterfaceData: pipe(ssrNetworkInterfaceData, option.fromEither, option.toNullable),
      ssrFsSizeData: pipe(ssrFsSizeData, option.fromEither, option.toNullable),
      ssrUptime: pipe(systemUptime, option.fromEither, option.toNullable),
    },
  };
});

export default SystemInfo;
