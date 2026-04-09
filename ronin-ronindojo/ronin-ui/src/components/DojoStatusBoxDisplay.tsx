import React, { FC } from "react";
import { RoninDojoHealth } from "../pages/api/v2/ronindojo/status";

interface Props {
  roninDojoStatus: RoninDojoHealth;
}

export const DojoStatusBoxDisplay: FC<Props> = ({ roninDojoStatus }) => {
  if (roninDojoStatus === "OK") return null;

  return (
    <div className="absolute top-0 bottom-0 left-0 right-0 w-full flex items-center justify-center backdrop-blur-sm">
      <h4 className="font-primary text-white text-2xl text-center">
        {roninDojoStatus === "DOCKER_NOT_RUNNING" && "Docker is not running, please restart your device."}
        {(["NODEJS_NOT_RUNNING", "BITCOIND_NOT_RUNNING", "INDEXER_NOT_RUNNING"] as RoninDojoHealth[]).includes(roninDojoStatus) &&
          "Your Dojo appears not to be running. Please start your Dojo first."}
        {roninDojoStatus === "IBD_NOT_FINISHED" && "Initial block download not finished. Please wait until your bitcoin node is fully synced."}
        {roninDojoStatus === "DOJO_NOT_SYNCED" && "Dojo not fully synced. Please wait until your dojo tracker is fully synced."}
        {roninDojoStatus === "INDEXER_NOT_SYNCED" && "Indexer not fully synced. Please wait until your indexer is fully synced."}
      </h4>
    </div>
  );
};
