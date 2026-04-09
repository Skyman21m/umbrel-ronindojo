import React, { FC, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { isAxiosError } from "axios";
import clsx from "clsx";
import { motion } from "framer-motion";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";

import { Response as PairingResponse } from "../pages/api/v2/dojo/pairing";
import { Response as PairingExplorerResponse } from "../pages/api/v2/dojo/pairing-explorer";
import { Response as AdminKeyResponse } from "../pages/api/v2/dojo/admin-key";
import { client } from "../apiClient";

import { useSnackbar } from "./SnackbarContext";
import { LinearLoader } from "./LinearLoader";
import { copyText } from "../lib/client/copyText";
import { ErrorResponse } from "../lib/server/errorResponse";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
}

type Action = "start" | "stop" | "restart";

const getActionStatus = (action: Action) => {
  switch (action) {
    case "restart":
      return "Restarting Dojo";
    case "start":
      return "Starting Dojo";
    case "stop":
      return "Stopping Dojo";
    default:
      throw new Error("Unknown action");
  }
};

const getActionSuccess = (action: Action) => {
  switch (action) {
    case "restart":
      return "Dojo restarted successfully";
    case "start":
      return "Dojo started successfully";
    case "stop":
      return "Dojo stopped successfully";
    default:
      throw new Error("Unknown action");
  }
};

export const ManageDojoDialog: FC<Props> = ({ open, onClose }) => {
  const { data: pairingData } = useSWR<PairingResponse>("/dojo/pairing");
  const { data: adminKeyData } = useSWR<AdminKeyResponse>("/dojo/admin-key");
  const { callSnackbar } = useSnackbar();

  const [displayValues, setDisplayValues] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);

  const handleClose = () => {
    setDisplayValues(false);
    onClose();
  };

  const handleAction = async (action: Action) => {
    setLoading(true);
    try {
      callSnackbar(getActionStatus(action), "info");
      await client.post(`/dojo/${action}`);

      callSnackbar(getActionSuccess(action), "success");
    } catch (error) {
      if (isAxiosError<ErrorResponse>(error)) {
        callSnackbar(error.response?.data.message ?? error.message, "error", true);
      } else {
        callSnackbar(String(error), "error", true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (data: string) => {
    try {
      await copyText(data);
      callSnackbar("Copied to clipboard", "info");
    } catch (error) {
      callSnackbar(String(error), "error");
    }
  };

  return (
    <Dialog title="Manage Samourai Dojo" open={open} onClose={loading ? undefined : handleClose} className="max-w-5xl">
      <div className="border-b border-border py-4">
        <div className="cursor-pointer inline-flex items-center" onClick={() => setDisplayValues((prevState) => !prevState)}>
          <div
            className={clsx([
              "mr-3 p-0.5 border w-14 h-7.5 transition-colors flex items-center rounded-full",
              displayValues ? "justify-end bg-secondary border-secondary" : "bg-black border-primary",
            ])}
          >
            <motion.div className="h-6 w-6 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
          </div>
          <div className="text-lg text-white">Display values</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-y-6 pt-3">
        <div>
          <div className="text-center">
            <a href={pairingData?.pairing.url.replace("/v2", "") ?? ""} target="_blank" rel="noreferrer" className="button">
              Open DMT in new tab
            </a>
          </div>
        </div>

        <div className="px-8 md:px-36">
          <div className="mb-3">
            <label className="block px-3 pb-1 text-sm text-paragraph">Dojo Maintenance Tool - URL</label>
            <div className="relative">
              <input
                type={displayValues ? "text" : "password"}
                className="input-text pr-12"
                value={pairingData?.pairing.url.replace("/v2", "") ?? ""}
                readOnly
              />
              <DocumentDuplicateIcon
                onClick={() => handleCopy(pairingData?.pairing.url.replace("/v2", "") ?? "")}
                className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="block px-3 pb-1 text-sm text-paragraph">Dojo Maintenance Tool - Admin key</label>
            <div className="relative">
              <input type={displayValues ? "text" : "password"} className="input-text pr-12" value={adminKeyData?.adminKey ?? ""} readOnly />
              <DocumentDuplicateIcon
                onClick={() => handleCopy(adminKeyData?.adminKey ?? "")}
                className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="my-2 flex flex-col md:flex-row items-center justify-center">
        <button className="button m-2" onClick={() => handleAction("start")} disabled={loading}>
          Start
        </button>
        <button className="button m-2" onClick={() => handleAction("stop")} disabled={loading}>
          Stop
        </button>
        <button className="button m-2" onClick={() => handleAction("restart")} disabled={loading}>
          Restart
        </button>
      </div>
      {loading && <LinearLoader />}
    </Dialog>
  );
};
