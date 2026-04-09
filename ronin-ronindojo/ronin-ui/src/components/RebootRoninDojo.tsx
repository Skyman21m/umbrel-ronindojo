import React, { FC, Fragment, SyntheticEvent, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { isAxiosError } from "axios";

import { LinearLoader } from "./LinearLoader";
import { CircularLoader } from "./CircularLoader";
import { useSnackbar } from "./SnackbarContext";
import { ErrorMessage } from "./ErrorMessage";
import { client } from "../apiClient";
import { delay } from "../lib/common";
import { SECOND } from "../const";
import { ErrorResponse } from "../lib/server/errorResponse";
import { encryptString } from "../lib/client/encryptString";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

type Action = null | "reboot" | "shut down";
type Step = "confirm" | "password";

type GeneralStatus = null | "Stopping bitcoind" | "Stopping Dojo";
type RebootStatus = GeneralStatus | "Rebooting device" | "Reboot initiated, reload this page in a few minutes";
type ShutdownStatus = GeneralStatus | "Shutting down device" | "Shutdown initiated. You can unplug your device in a few minutes.";

type ActionStatus = RebootStatus | ShutdownStatus;

interface Props {
  action: Action;
  setAction: (action: Action) => void;
}

export const RebootRoninDojo: FC<Props> = ({ action, setAction }) => {
  const { callSnackbar } = useSnackbar();
  const [status, setStatus] = useState<ActionStatus>(null);
  const [step, setStep] = useState<Step>("confirm");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCloseConfirmModal = () => {
    setStep("confirm");
    setError(null);
    setAction(null);
  };

  const shutDownDojo = useCallback(async () => {
    setStatus("Stopping Dojo");
    await client.post("/dojo/stop").catch((error_) => {
      console.log(error_);
    });
  }, []);

  const handleReboot = async (encryptedData: string) => {
    handleCloseConfirmModal();
    try {
      await shutDownDojo();
      setStatus("Rebooting device");
      // only log error
      client.post("/system/reboot", encryptedData, { headers: { "Content-Type": "text/plain" } });
      await delay(5 * SECOND);
      setStatus("Reboot initiated, reload this page in a few minutes");
    } catch (error_) {
      setStatus(null);
      if (isAxiosError<ErrorResponse>(error_)) {
        callSnackbar(error_.response?.data.message ?? error_.message, "error");
      } else {
        callSnackbar(String(error_), "error");
      }
    }
  };

  const handleShutdown = async (encryptedData: string) => {
    handleCloseConfirmModal();
    try {
      await shutDownDojo();
      setStatus("Shutting down device");
      // only log error
      client.post("/system/shutdown", encryptedData, { headers: { "Content-Type": "text/plain" } });
      await delay(5 * SECOND);
      setStatus("Shutdown initiated. You can unplug your device in a few minutes.");
    } catch (error_) {
      setStatus(null);
      if (isAxiosError<ErrorResponse>(error_)) {
        callSnackbar(error_.response?.data.message ?? error_.message, "error");
      } else {
        callSnackbar(String(error_), "error");
      }
    }
  };

  const handleConfirm = () => {
    setStep("password");
  };

  const handleSubmitPassword = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const password = inputRef.current?.value ?? "";

    if (password.length === 0) {
      return setError("Password is required");
    }

    setLoading(true);

    const encryptedData = await encryptString(
      JSON.stringify({
        password,
      }),
    );

    try {
      await client.post("/auth/login", encryptedData, { headers: { "Content-Type": "text/plain" } });
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        return setError(error_.response?.data.message ?? error_.message);
      }
      return setError(String(error_));
    } finally {
      setLoading(false);
    }

    if (action === "reboot") {
      handleReboot(encryptedData);
    }
    if (action === "shut down") {
      handleShutdown(encryptedData);
    }
  };

  return (
    <Fragment>
      <Dialog
        open={Boolean(action) && step === "confirm"}
        onClose={handleCloseConfirmModal}
        title={`Do you want to ${action} RoninDojo?`}
        className="max-w-3xl"
        actions={
          <>
            <button onClick={handleConfirm} className="button mr-3">
              Yes, {action}
            </button>
            <button onClick={handleCloseConfirmModal} className="button">
              Cancel
            </button>
          </>
        }
      >
        <p className="text-paragraph mb-4">Are you sure you want to {action} your RoninDojo?</p>
        {action === "shut down" && (
          <p className="text-paragraph">
            Shutting down RoninDojo will stop all running systems. To gain access to the RoninUI after shutdown, power should be re-applied manually to the
            node.
          </p>
        )}
      </Dialog>

      <Dialog
        open={step === "password"}
        onClose={handleCloseConfirmModal}
        title={`Confirm ${action} with password`}
        className="max-w-2xl"
        actions={
          <>
            <button form="rebootPasswordForm" type="submit" className="button" disabled={loading}>
              Confirm {loading && <CircularLoader className="h-6 w-6" color="primary" />}
            </button>
          </>
        }
      >
        <form id="rebootPasswordForm" onSubmit={handleSubmitPassword} className="w-4/5 mx-auto my-4">
          <label htmlFor="rebootPassword" className="block text-white text-lg ml-3 mb-2">
            Password
          </label>
          <input id="rebootPassword" type="password" className="input-text" ref={inputRef} autoFocus />
        </form>
        <ErrorMessage errors={[error]} />
      </Dialog>

      <Dialog open={Boolean(status)} className="max-w-2xl">
        <div className="text-paragraph mb-4">{status}</div>
        <LinearLoader />
      </Dialog>
    </Fragment>
  );
};
