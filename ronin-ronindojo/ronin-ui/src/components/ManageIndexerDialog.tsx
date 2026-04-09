import React, { FC, SyntheticEvent, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSWRConfig } from "swr";
import { PlusCircleIcon, MinusCircleIcon } from "@heroicons/react/24/outline";
import { isAxiosError } from "axios";

import { ReactComponent as ElectrumIcon } from "../components/icons/dashboard_icons/electrum_server.svg";
import { ReactComponent as IndexerIcon } from "../components/icons/dashboard_icons/samourai_indexer.svg";
import { useSnackbar } from "./SnackbarContext";
import { IndexerType } from "../pages/api/v2/ronindojo/indexer-type";
import { client } from "../apiClient";
import { SECOND } from "../const";
import { ErrorResponse } from "../lib/server/errorResponse";
import { LinearLoader } from "./LinearLoader";
import { CircularLoader } from "./CircularLoader";
import { ErrorMessage } from "./ErrorMessage";
import { delay } from "../lib/common";
import { encryptString } from "../lib/client/encryptString";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

interface Props {
  open: boolean;
  onClose: () => void;
  indexerType: IndexerType | undefined;
}

const enum Step {
  status,
  switch,
  password,
  running,
}

type Indexer = "addrindexrs" | "electrs" | "fulcrum";

type Status = null | "updating configuration";

export const ManageIndexerDialog: FC<Props> = ({ open, onClose, indexerType }) => {
  const { callSnackbar } = useSnackbar();
  const { mutate } = useSWRConfig();
  const [step, setStep] = useState<Step>(Step.status);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<Status>(null);
  const [chosenIndexer, setChosenIndexer] = useState<null | Indexer>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setStep(Step.status);
    setLoading(false);
    setError(null);
    setStatus(null);
    setChosenIndexer(null);
    onClose();
  };

  const setPasswordStep = (indexer: Indexer) => () => {
    setChosenIndexer(indexer);
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

    await handleSubmit(chosenIndexer!, encryptedPassword);
  };

  const handleSubmit = async (indexer: Indexer, password: string) => {
    setStep(Step.running);
    setStatus("updating configuration");

    try {
      await client.post("/ronindojo/switch-indexer", { type: indexer, password: password });

      client.post("/dojo/upgrade", null);
      await delay(2 * SECOND);
      await mutate("/dojo/upgrade/status");
      handleClose();

      callSnackbar(`Running Dojo upgrade. Indexer ${indexer} will be installed`, "success");
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
      <Dialog open={open && step === Step.status} onClose={handleClose} className="max-w-3xl" title="Manage Indexer">
        <p className="text-paragraph text-lg mb-6">
          You have <strong className="text-white">{indexerType ?? "--"}</strong> configured as your Dojo indexer.
        </p>

        <div className="flex items-center justify-center">
          <button className="button mx-2" onClick={() => setStep(Step.switch)}>
            Switch to different indexer
          </button>
        </div>
      </Dialog>

      <Dialog open={open && step === Step.switch} onClose={handleClose} className="max-w-6xl" title="Switch Indexer">
        <div className="w-full flex divide-x divide-border mt-3">
          <div className="flex-1 px-4">
            <div className="text-white">
              <div className="mb-6 flex items-center justify-center">
                <div className="w-28 h-28 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
                  <IndexerIcon width={80} height={80} className="fill-current" />
                </div>
              </div>
              <h3 className="mb-6 text-2xl text-center font-primary">Addrindexrs</h3>
              <ul className="mb-12">
                <li className="leading-6 text-green-600">
                  <PlusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Initial sync takes only around 24 hours</span>
                </li>
                <li className="leading-6 text-green-600">
                  <PlusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Very fast even for deep wallets</span>
                </li>
                <li className="leading-6 text-red-600">
                  <MinusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">No Electrum server capabilities</span>
                </li>
              </ul>
              <div className="flex items-center justify-center">
                <button onClick={setPasswordStep("addrindexrs")} className="button" disabled={indexerType === "Addrindexrs"}>
                  {indexerType === "Addrindexrs" ? "Already installed" : "Install Addrindexrs"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 px-4">
            <div className="text-white">
              <div className="mb-6 flex items-center justify-center">
                <div className="w-28 h-28 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
                  <ElectrumIcon width={100} height={100} className="fill-current" />
                </div>
              </div>
              <h3 className="mb-6 text-2xl text-center font-primary">Electrs</h3>
              <ul className="mb-12">
                <li className="leading-6 text-green-600">
                  <PlusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Fully featured electrum server</span>
                </li>
                <li className="leading-6 text-green-600">
                  <PlusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Initial sync takes only around 24 hours</span>
                </li>
                <li className="leading-6 text-red-600">
                  <MinusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Very slow for deep wallets</span>
                </li>
              </ul>
              <div className="flex items-center justify-center">
                <button onClick={setPasswordStep("electrs")} className="button" disabled={indexerType === "Electrs"}>
                  {indexerType === "Electrs" ? "Already installed" : "Install Electrs"}
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 px-4">
            <div className="text-white">
              <div className="mb-6 flex items-center justify-center">
                <div className="w-28 h-28 bg-black border border-primary shadow-primary text-white rounded-full flex items-center justify-center">
                  <ElectrumIcon width={100} height={100} className="fill-current" />
                </div>
              </div>
              <h3 className="mb-6 text-2xl text-center font-primary">Fulcrum</h3>
              <ul className="mb-12">
                <li className="leading-6 text-green-600">
                  <PlusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Fully featured electrum server</span>
                </li>
                <li className="leading-6 text-green-600">
                  <PlusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Incomparable performance</span>
                </li>
                <li className="leading-6 text-red-600">
                  <MinusCircleIcon className="inline-block align-middle h-6 w-6" />
                  <span className="inline-block ml-3">Initial sync can take a few days</span>
                </li>
              </ul>
              <div className="flex items-center justify-center">
                <button onClick={setPasswordStep("fulcrum")} className="button" disabled={indexerType === "Fulcrum"}>
                  {indexerType === "Fulcrum" ? "Already installed" : "Install Fulcrum"}
                </button>
              </div>
            </div>
          </div>
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
