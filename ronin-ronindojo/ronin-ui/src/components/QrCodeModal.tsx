import React, { FC, useCallback } from "react";
import dynamic from "next/dynamic";
import { QRCodeCanvas } from "qrcode.react";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useSnackbar } from "./SnackbarContext";
import { copyText } from "../lib/client/copyText";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
  value: string;
  showText?: boolean;
}

export const QrCodeModal: FC<Props> = ({ open, onClose, value, showText }) => {
  const { callSnackbar } = useSnackbar();

  const handleCopy = useCallback(
    async (data: string) => {
      try {
        await copyText(data);
        callSnackbar("Copied to clipboard", "info");
      } catch (error) {
        callSnackbar(String(error), "error");
      }
    },
    [callSnackbar],
  );

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <div className="relative w-full aspect-square bg-border rounded-xl p-4 md:p-8 mx-auto my-4 transition-all">
        <QRCodeCanvas className="max-w-full max-h-full rounded-xl" size={800} bgColor="#FFFFFF" fgColor="#000000" level="H" includeMargin value={value} />
      </div>
      {showText && (
        <div className="relative">
          <input type="text" className="input-text pr-10" value={value} readOnly />
          <DocumentDuplicateIcon
            title="Copy to clipboard"
            onClick={() => handleCopy(value)}
            className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
          />
        </div>
      )}
    </Dialog>
  );
};
