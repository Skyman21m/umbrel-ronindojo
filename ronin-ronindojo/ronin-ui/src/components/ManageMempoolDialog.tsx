import React, { FC, SyntheticEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";
import useSWR, { useSWRConfig } from "swr";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { isAxiosError } from "axios";
import { QRCodeCanvas } from "qrcode.react";

import { useSnackbar } from "./SnackbarContext";
import { Response as MempoolUrlResponse } from "../pages/api/v2/ronindojo/mempool-url";
import { copyText } from "../lib/client/copyText";
import { client } from "../apiClient";
import { ErrorResponse } from "../lib/server/errorResponse";
import { LinearLoader } from "./LinearLoader";
import { MINUTE, SECOND } from "../const";
import { CircularLoader } from "./CircularLoader";
import { ErrorMessage } from "./ErrorMessage";
import { delay } from "../lib/common";
import { encryptString } from "../lib/client/encryptString";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
  isMempoolInstalled: null | boolean;
}

const enum Step {
  status,
  password,
  running,
}

type Status = null | "updating configuration";

type Action = "install" | "uninstall";

export const ManageMempoolDialog: FC<Props> = ({ open, onClose, isMempoolInstalled }) => {
  const { callSnackbar } = useSnackbar();
  const { mutate } = useSWRConfig();
  const [action, setAction] = useState<Action | null>(null);
  const [step, setStep] = useState<Step>(Step.status);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const { data: mempoolUrlData } = useSWR<MempoolUrlResponse>(isMempoolInstalled ? "/ronindojo/mempool-url" : null);

  const mempoolUrl = mempoolUrlData ? `http://${mempoolUrlData?.url}` : "";

  const handleCopy = async (data: string) => {
    try {
      await copyText(data);
      callSnackbar("Copied to clipboard", "info");
    } catch (error_) {
      callSnackbar(String(error_), "error");
    }
  };

  const handleClose = () => {
    setStep(Step.status);
    setAction(null);
    setLoading(false);
    setError(null);
    setStatus(null);
    onClose();
  };

  const setPasswordStep = (action: Action) => () => {
    setAction(action);
    setStep(Step.password);
  };

  const handleSubmitPassword = async (event: SyntheticEvent) => {
    event.preventDefault();
    setError(null);
    const password = inputRef.current?.value ?? "";

    if (password.length === 0) {
      return setError("Password is required");
    }

    setLoading(true);

    try {
      const data = await encryptString(
        JSON.stringify({
          password,
        }),
      );
      await client.post("/auth/login", data, { headers: { "Content-Type": "text/plain" } });
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        return setError(error_.response?.data.message ?? error_.message);
      }
      return setError(String(error_));
    } finally {
      setLoading(false);
    }

    const encryptedPassword = await encryptString(password);

    await handleSubmit(action!, encryptedPassword);
  };

  const handleSubmit = async (action: Action, password: string) => {
    setStep(Step.running);
    setStatus("updating configuration");

    try {
      if (action === "install") await client.post("/ronindojo/mempool-install", { password });
      if (action === "uninstall") await client.post("/ronindojo/mempool-uninstall", { password });

      client.post("/dojo/upgrade", null, { timeout: 30 * MINUTE });
      await delay(2 * SECOND);
      await mutate("/dojo/upgrade/status");
      handleClose();

      callSnackbar(`Running Dojo upgrade. Mempool visualizer will be ${action}ed`, "info");
    } catch (error_) {
      setStatus(null);
      if (isAxiosError<ErrorResponse>(error_)) {
        callSnackbar(error_.response?.data.message ?? error_.message, "error");
      } else {
        callSnackbar(String(error_), "error");
      }
    }
  };

  return (
    <>
      <Dialog open={open && step === Step.status} onClose={handleClose} className="max-w-5xl" title="Mempool Space">
        <div className="w-4/5 mx-auto my-8">
          <p className="text-lightGrey text-lg mb-2">
            The Mempool Visualizer that comes with your RoninDojo provides a visual representation of the current state of your node’s mempool. Having a local
            version of mempool.space running over Tor allows you to query block and transaction data without leaking any private information to third party
            servers.
          </p>
          <p className="text-lightGrey text-lg">
            For more information on how to install mempool space read our{" "}
            <a
              className="text-secondary underline hover:text-primary transition-colors"
              href="https://wiki.ronindojo.io/en/setup/mempool-visualizer"
              target="_blank"
              rel="noreferrer"
            >
              documentation here
            </a>
            .
          </p>
        </div>

        {Boolean(mempoolUrl) && (
          <>
            <div className="relative w-full md:w-3/5 lg:w-2/5 aspect-square bg-border rounded-xl p-4 md:p-8 mx-auto my-4 transition-all">
              <QRCodeCanvas
                className="max-w-full max-h-full rounded-xl"
                size={800}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="H"
                includeMargin
                value={mempoolUrl}
              />
            </div>

            <div className="w-4/5 my-8 mx-auto">
              <div className="mb-3">
                <label className="block px-3 pb-1 text-sm text-paragraph">Mempool Space URL</label>
                <div className="relative">
                  <input type="text" className="input-text pr-12" defaultValue={mempoolUrl} readOnly />
                  <DocumentDuplicateIcon
                    onClick={() => handleCopy(mempoolUrl)}
                    className="absolute top-2 right-2 h-6 w-6 ml-6 text-white cursor-pointer hover:text-secondary transition-colors"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mb-4 flex items-center justify-center">
          {isMempoolInstalled == null && (
            <button className="button mx-2" disabled>
              Install Mempool visualizer
            </button>
          )}
          {isMempoolInstalled === false && (
            <button onClick={setPasswordStep("install")} className="button mx-2">
              Install Mempool visualizer
            </button>
          )}
          {isMempoolInstalled === true && (
            <button onClick={setPasswordStep("uninstall")} className="button mx-2">
              Uninstall Mempool visualizer
            </button>
          )}
        </div>
      </Dialog>

      <Dialog
        open={open && step === Step.password}
        onClose={handleClose}
        title={`Confirm with password`}
        className="max-w-2xl"
        actions={
          <button className="button" onClick={handleSubmitPassword} disabled={loading}>
            Confirm {loading && <CircularLoader className="h-6 w-6" color="primary" />}
          </button>
        }
      >
        <form onSubmit={handleSubmitPassword} className="w-4/5 mx-auto my-4">
          <label htmlFor="rebootPassword" className="block text-white text-lg ml-3 mb-2">
            Password
          </label>
          <input id="rebootPassword" type="password" className="input-text" ref={inputRef} autoFocus />
        </form>
        <ErrorMessage errors={[error]} />
      </Dialog>

      <Dialog open={open && step === Step.running && Boolean(status)} className="max-w-2xl">
        <div className="text-paragraph mb-4">{status}</div>
        <LinearLoader />
      </Dialog>
    </>
  );
};
