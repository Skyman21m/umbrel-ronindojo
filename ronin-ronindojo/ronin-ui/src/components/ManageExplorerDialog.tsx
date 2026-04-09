import React, { FC, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import clsx from "clsx";
import { motion } from "framer-motion";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";

import { Response as PairingExplorerResponse } from "../pages/api/v2/dojo/pairing-explorer";

import { useSnackbar } from "./SnackbarContext";
import { copyText } from "../lib/client/copyText";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ManageExplorerDialog: FC<Props> = ({ open, onClose }) => {
  const { data: pairingExplorerData } = useSWR<PairingExplorerResponse>("/dojo/pairing-explorer");
  const { callSnackbar } = useSnackbar();

  const [displayValues, setDisplayValues] = useState<boolean>(false);

  const handleClose = () => {
    setDisplayValues(false);
    onClose();
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
    <Dialog title="Manage BTC-RPC Explorer" open={open} onClose={handleClose} className="max-w-5xl">
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
            <a href={pairingExplorerData?.pairing.url} target="_blank" rel="noreferrer" className="button">
              Open Explorer in new tab
            </a>
          </div>
        </div>

        <div className="px-8 md:px-36">
          <div className="mb-3">
            <label className="block px-3 pb-1 text-sm text-paragraph">Explorer URL</label>
            <div className="relative">
              <input type={displayValues ? "text" : "password"} className="input-text pr-12" value={pairingExplorerData?.pairing.url ?? ""} readOnly />
              <DocumentDuplicateIcon
                onClick={() => handleCopy(pairingExplorerData?.pairing.url ?? "")}
                className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
              />
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
