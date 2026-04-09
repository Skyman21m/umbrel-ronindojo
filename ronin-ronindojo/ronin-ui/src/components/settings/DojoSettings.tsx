import React, { FC, FormEvent, useState } from "react";
import { useRouter } from "next/router";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { motion } from "framer-motion";
import clsx from "clsx";
import { isAxiosError } from "axios";
import { InformationCircleIcon } from "@heroicons/react/20/solid";

import { client } from "../../apiClient";
import { ErrorMessage } from "../ErrorMessage";
import { useSnackbar } from "../SnackbarContext";
import { LinearLoader } from "../LinearLoader";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { type DojoSettingsData } from "../../pages/settings";
import { Tooltip } from "../Tooltip";

interface Props {
  settings: DojoSettingsData;
}

export const DojoSettings: FC<Props> = ({ settings }) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty },
    setValue,
    reset,
  } = useForm<DojoSettingsData>({
    defaultValues: {
      ...settings,
    },
  });
  const router = useRouter();
  const { callSnackbar } = useSnackbar();
  const [apiError, setApiError] = useState<string | null>(null);

  const onSubmit: SubmitHandler<DojoSettingsData> = async (data) => {
    try {
      await client.patch("/dojo/settings", data);
      callSnackbar("Dojo settings saved successfully, restarting Dojo", "success");
      await client.post("/dojo/restart");
      callSnackbar("Dojo restarted successfully", "success");
      router.reload();
    } catch (error) {
      if (isAxiosError<ErrorResponse>(error)) {
        setApiError(error.response?.data.message ?? error.message);
      } else {
        setApiError(String(error));
      }
    }
  };

  const onReset = (event: FormEvent) => {
    event.preventDefault();
    reset();
  };

  return (
    <div className="box bg-surface">
      <h2 className="text-white font-primary text-xl mb-3">Dojo settings</h2>
      <div className="grid grid-flow-row auto-cols-max grid-cols-1 gap-4 mb-4">
        <form onSubmit={handleSubmit(onSubmit)} onReset={onReset} autoComplete="off" id="dojoSettingsForm">
          <div className="mb-8">
            <h3 className="text-white text-lg font-bold">Bitcoin Core</h3>
            <div className="mb-4">
              <label
                className={clsx("text-sm", settings.BITCOIND_MEMPOOL_EXPIRY == null ? "text-gray-400" : "text-white", "inline-block", "mb-2")}
                htmlFor="BITCOIND_MEMPOOL_EXPIRY"
              >
                Bitcoind mempool expiry (hours){" "}
                <Tooltip title="The number of hours before a transaction in the mempool expires. This is the maximum time a transaction can be in the mempool before it is removed.">
                  <InformationCircleIcon className="inline-block ml-1 h-5 w-5 text-secondary cursor-pointer hover:text-white transition-colors" />
                </Tooltip>
              </label>
              <input
                id="BITCOIND_MEMPOOL_EXPIRY"
                className="px-4 py-3 rounded-full bg-border text-paragraph text-lg w-full border-none focus:ring-primary transition"
                type="number"
                {...register("BITCOIND_MEMPOOL_EXPIRY", { required: true, min: 24, max: 336, valueAsNumber: true })}
                disabled={settings.BITCOIND_MEMPOOL_EXPIRY == null || isSubmitting}
              />
            </div>
            <div className="mb-4">
              <Controller
                control={control}
                name="BITCOIND_PERSIST_MEMPOOL"
                render={({ field }) => (
                  <div
                    className="cursor-pointer inline-flex items-center"
                    onClick={() => (field.value == null ? void 0 : setValue("BITCOIND_PERSIST_MEMPOOL", !field.value, { shouldDirty: true }))}
                  >
                    <input id="BITCOIND_PERSIST_MEMPOOL" type="hidden" {...field} value={String(field.value)} />
                    <label className={clsx("text-sm", field.value == null ? "text-gray-400" : "text-white")} htmlFor="BITCOIND_PERSIST_MEMPOOL">
                      Persist mempool on restart{" "}
                      <Tooltip title="If enabled, the mempool will be persisted to disk. This is useful if you want to keep transactions in the mempool after a restart.">
                        <InformationCircleIcon className="inline-block ml-1 h-5 w-5 text-secondary cursor-pointer hover:text-white transition-colors" />
                      </Tooltip>
                    </label>
                    <div
                      className={clsx([
                        "ml-3 p-0.5 border w-10 h-4.5 transition-colors flex items-center rounded-full",
                        field.value == null
                          ? "bg-gray-500 border-gray-500"
                          : field.value
                            ? "justify-end bg-secondary border-secondary"
                            : "bg-black border-primary",
                      ])}
                    >
                      <motion.div className="h-4 w-4 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
                    </div>
                  </div>
                )}
              />
            </div>
            <div className="mb-4">
              <Controller
                control={control}
                name="BITCOIND_BAN_KNOTS"
                render={({ field }) => (
                  <div
                    className="cursor-pointer inline-flex items-center"
                    onClick={() => (field.value == null ? void 0 : setValue("BITCOIND_BAN_KNOTS", !field.value, { shouldDirty: true }))}
                  >
                    <input id="BITCOIND_BAN_KNOTS" type="hidden" {...field} value={String(field.value)} />
                    <label className={clsx("text-sm", field.value == null ? "text-gray-400" : "text-white")} htmlFor="BITCOIND_BAN_KNOTS">
                      Ban Knots connections{" "}
                      <Tooltip title="Actively disconnect and ban connections to Bitcoin Knots. This helps to stay connected to nodes that will relay privacy preserving transactions.">
                        <InformationCircleIcon className="inline-block ml-1 h-5 w-5 text-secondary cursor-pointer hover:text-white transition-colors" />
                      </Tooltip>
                    </label>
                    <div
                      className={clsx([
                        "ml-3 p-0.5 border w-10 h-4.5 transition-colors flex items-center rounded-full",
                        field.value == null
                          ? "bg-gray-500 border-gray-500"
                          : field.value
                            ? "justify-end bg-secondary border-secondary"
                            : "bg-black border-primary",
                      ])}
                    >
                      <motion.div className="h-4 w-4 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
          <div>
            <h3 className="text-white text-lg font-bold">Dojo</h3>
            <div className="mb-4">
              <Controller
                control={control}
                name="NODE_PANDOTX_PUSH"
                render={({ field }) => (
                  <div
                    className="cursor-pointer inline-flex items-center"
                    onClick={() => (field.value == null ? void 0 : setValue("NODE_PANDOTX_PUSH", !field.value, { shouldDirty: true }))}
                  >
                    <input id="NODE_PANDOTX_PUSH" type="hidden" {...field} value={String(field.value)} />
                    <label className={clsx("text-sm", field.value == null ? "text-gray-400" : "text-white")} htmlFor="NODE_PANDOTX_PUSH">
                      Push transactions using Soroban - PandoTx{" "}
                      <Tooltip title="Use Soroban network to relay this node's transactions in order to preserve privacy.">
                        <InformationCircleIcon className="inline-block ml-1 h-5 w-5 text-secondary cursor-pointer hover:text-white transition-colors" />
                      </Tooltip>
                    </label>
                    <div
                      className={clsx([
                        "ml-3 p-0.5 border w-10 h-4.5 transition-colors flex items-center rounded-full",
                        field.value == null
                          ? "bg-gray-500 border-gray-500"
                          : field.value
                            ? "justify-end bg-secondary border-secondary"
                            : "bg-black border-primary",
                      ])}
                    >
                      <motion.div className="h-4 w-4 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
                    </div>
                  </div>
                )}
              />
            </div>
            <div className="mb-4">
              <Controller
                control={control}
                name="NODE_PANDOTX_PROCESS"
                render={({ field }) => (
                  <div
                    className="cursor-pointer inline-flex items-center"
                    onClick={() => (field.value == null ? void 0 : setValue("NODE_PANDOTX_PROCESS", !field.value, { shouldDirty: true }))}
                  >
                    <input id="NODE_PANDOTX_PROCESS" type="hidden" {...field} value={String(field.value)} />
                    <label className={clsx("text-sm", field.value == null ? "text-gray-400" : "text-white")} htmlFor="NODE_PANDOTX_PROCESS">
                      Process transactions received via Soroban - PandoTx{" "}
                      <Tooltip title="Relay transactions received over Soroban network to the Bitcoin network.">
                        <InformationCircleIcon className="inline-block ml-1 h-5 w-5 text-secondary cursor-pointer hover:text-white transition-colors" />
                      </Tooltip>
                    </label>
                    <div
                      className={clsx([
                        "ml-3 p-0.5 border w-10 h-4.5 transition-colors flex items-center rounded-full",
                        field.value == null
                          ? "bg-gray-500 border-gray-500"
                          : field.value
                            ? "justify-end bg-secondary border-secondary"
                            : "bg-black border-primary",
                      ])}
                    >
                      <motion.div className="h-4 w-4 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        </form>
        <ErrorMessage
          errors={[
            apiError,
            errors.BITCOIND_MEMPOOL_EXPIRY?.type === "required" ? "Bitcoind Mempool Expiry is required" : null,
            errors.BITCOIND_MEMPOOL_EXPIRY?.type === "min" ? "Bitcoind Mempool Expiry must be at least 24 hours" : null,
            errors.BITCOIND_MEMPOOL_EXPIRY?.type === "max" ? "Bitcoind Mempool Expiry must be at most 336 hours" : null,
          ]}
        />
        {isSubmitting && <LinearLoader />}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button className="small button" type="submit" form="dojoSettingsForm" disabled={!isDirty || isSubmitting}>
          Save and restart Dojo
        </button>
        <button className="secondary small button" type="reset" form="dojoSettingsForm" disabled={!isDirty || isSubmitting}>
          Reset changes
        </button>
      </div>
    </div>
  );
};
