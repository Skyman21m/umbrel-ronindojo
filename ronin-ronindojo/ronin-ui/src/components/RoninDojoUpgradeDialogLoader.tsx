import React, { FC, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";

import { SECOND } from "../const";
import { LinearLoader } from "./LinearLoader";
import { Response as RoninDojoUpgradeStatusResponse } from "../pages/api/v2/ronindojo/upgrade/status";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

export const RoninDojoUpgradeDialogLoader: FC = () => {
  const prevStatus = useRef<RoninDojoUpgradeStatusResponse["status"] | null | undefined>(null);
  const { data: dojoUpgradeStatusData } = useSWR<RoninDojoUpgradeStatusResponse | null>("/ronindojo/upgrade/status", { refreshInterval: 15 * SECOND });

  useEffect(() => {
    if (dojoUpgradeStatusData?.status === "not_running" && prevStatus.current === "running") {
      window.location.reload();
    }

    prevStatus.current = dojoUpgradeStatusData?.status;
  }, [dojoUpgradeStatusData?.status]);

  if (dojoUpgradeStatusData?.status !== "running") return null;

  return (
    <Dialog open={true} className="max-w-2xl">
      <div className="text-paragraph mb-4">RoninDojo upgrade in progress</div>
      <LinearLoader />
    </Dialog>
  );
};
