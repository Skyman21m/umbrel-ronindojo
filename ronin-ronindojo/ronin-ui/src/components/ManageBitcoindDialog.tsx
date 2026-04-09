import React, { FC, useState } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import clsx from "clsx";
import { motion } from "framer-motion";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";

import { useSnackbar } from "./SnackbarContext";
import { Response as CredentialsResponse } from "../pages/api/v2/bitcoind/credentials";
import { copyText } from "../lib/client/copyText";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ManageBitcoindDialog: FC<Props> = ({ open, onClose }) => {
  const { callSnackbar } = useSnackbar();
  const [displayValues, setDisplayValues] = useState<boolean>(false);

  const handleClose = () => {
    setDisplayValues(false);
    onClose();
  };

  const { data: credentialsData } = useSWR<CredentialsResponse>("/bitcoind/credentials");

  const handleCopy = async (data: string) => {
    try {
      await copyText(data);
      callSnackbar("Copied to clipboard", "info");
    } catch (error) {
      callSnackbar(String(error), "error");
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-3xl" title="Bitcoin Core credentials">
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

      <div className="w-4/5 my-8 mx-auto">
        <div className="mb-3">
          <label className="block px-3 pb-1 text-sm text-paragraph">RPC user</label>
          <div className="relative">
            <input type={displayValues ? "text" : "password"} className="input-text pr-12" defaultValue={credentialsData?.rpc.userName ?? ""} readOnly />
            <DocumentDuplicateIcon
              onClick={() => handleCopy(credentialsData?.rpc.userName ?? "")}
              className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block px-3 pb-1 text-sm text-paragraph">RPC password</label>
          <div className="relative">
            <input type={displayValues ? "text" : "password"} className="input-text pr-12" defaultValue={credentialsData?.rpc.password ?? ""} readOnly />
            <DocumentDuplicateIcon
              onClick={() => handleCopy(credentialsData?.rpc.password ?? "")}
              className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block px-3 pb-1 text-sm text-paragraph">Tor v3 URL</label>
          <div className="relative">
            <input type={displayValues ? "text" : "password"} className="input-text pr-12" defaultValue={credentialsData?.rpc.url ?? ""} readOnly />
            <DocumentDuplicateIcon
              onClick={() => handleCopy(credentialsData?.rpc.url ?? "")}
              className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};
