import React, { FC } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";

import { SECOND, MINUTE } from "../const";
import { LinearLoader } from "./LinearLoader";
import { RoninDojoStatusResponse } from "../pages/api/v2/ronindojo/status";
import { Response as DojoUpgradeStatusResponse } from "../pages/api/v2/dojo/upgrade/status";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

export const DojoUpgradeDialogLoader: FC = () => {
  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse | null>("/ronindojo/status", { refreshInterval: MINUTE });
  const { data: dojoUpgradeStatusData } = useSWR<DojoUpgradeStatusResponse | null>(
    roninDojoStatusData && roninDojoStatusData.status !== "DOCKER_NOT_RUNNING" ? "/dojo/upgrade/status" : null,
    { refreshInterval: 15 * SECOND },
  );

  if (dojoUpgradeStatusData?.status !== "running") return null;

  return (
    <Dialog open={true} className="max-w-2xl">
      <div className="text-paragraph mb-4">Dojo upgrade in progress</div>
      <LinearLoader />
    </Dialog>
  );
};
