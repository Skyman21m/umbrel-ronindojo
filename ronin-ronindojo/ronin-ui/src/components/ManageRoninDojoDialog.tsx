import React, { FC, useState, Fragment } from "react";
import dynamic from "next/dynamic";
import { QRCodeCanvas } from "qrcode.react";
import useSWR from "swr";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { Response as TorUrlResponse } from "../pages/api/v2/tor-url";

import { ReactComponent as RoninDojoIcon } from "../components/icons/dashboard_icons/ronin_backend.svg";
import { useSnackbar } from "./SnackbarContext";
import { copyText } from "../lib/client/copyText";
import { RebootRoninDojo } from "./RebootRoninDojo";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
}

type Action = null | "reboot" | "shut down";

export const ManageRoninDojoDialog: FC<Props> = ({ open, onClose }) => {
  const [action, setAction] = useState<Action>(null);
  const { callSnackbar } = useSnackbar();

  const { data: torUrlData } = useSWR<TorUrlResponse>("/tor-url", {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const handleCopy = async (data: string) => {
    try {
      await copyText(data);
      callSnackbar("Copied to clipboard", "info");
    } catch (error) {
      callSnackbar(String(error), "error");
    }
  };

  const handleAction = async (action: Action) => {
    onClose();
    setAction(action);
  };

  return (
    <Fragment>
      <Dialog open={open} onClose={onClose} className="max-w-6xl" title="Manage RoninDojo">
        <div className="relative w-full md:w-3/5 lg:w-2/5 aspect-square bg-border rounded-xl p-4 md:p-8 mx-auto my-4 transition-all">
          <QRCodeCanvas
            className="max-w-full max-h-full rounded-xl"
            size={800}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="H"
            includeMargin
            value={torUrlData?.torUrl ?? ""}
          />
          <div className="absolute top-1/2 left-1/2 z-10 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary p-4 border-4 border-white hidden md:block">
            <RoninDojoIcon className="w-20 h-20 text-white fill-current" />
          </div>
        </div>

        <div className="w-full lg:w-3/5 mb-8 mx-auto">
          <label className="block px-3 pb-1 text-sm text-paragraph">Ronin UI URL</label>
          <div className="relative">
            <input type="text" className="input-text pr-12" defaultValue={torUrlData?.torUrl ?? ""} readOnly />
            <DocumentDuplicateIcon
              onClick={() => handleCopy(torUrlData?.torUrl ?? "")}
              className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-center">
          <button className="button mx-2" onClick={() => handleAction("reboot")}>
            Reboot device
          </button>
          <button className="button mx-2" onClick={() => handleAction("shut down")}>
            Shut down device
          </button>
        </div>
      </Dialog>

      <RebootRoninDojo action={action} setAction={setAction} />
    </Fragment>
  );
};
