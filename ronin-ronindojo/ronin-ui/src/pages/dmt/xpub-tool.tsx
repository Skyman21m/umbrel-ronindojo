import React, { Fragment, SyntheticEvent, useEffect, useState } from "react";
import { NextPage, GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import dynamic from "next/dynamic";
import { useForm, SubmitHandler } from "react-hook-form";
import { isAxiosError } from "axios";
import useSWR from "swr";
import { motion } from "framer-motion";
import { QrCodeIcon } from "@heroicons/react/24/outline";

import { pageTransition } from "../../animations";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SuccessMessage } from "../../components/SuccessMessage";
import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { Transaction } from "../../components/Transaction";
import { UTXO } from "../../components/UTXO";
import { withSessionSsr } from "../../lib/server/session";
import { client } from "../../apiClient";
import {
  XpubInfoResponse,
  XpubRescanResponse,
  WalletResponse,
  XpubDeleteResponse,
  XpubImportResponse,
  XpubImportStatusResponse,
  XpubImportStatusFalse,
  XpubImportStatusTrue,
} from "../../lib/server/dojoApi";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { delay, satsToBTC } from "../../lib/common";
import { LinearLoader } from "../../components/LinearLoader";
import { useSnackbar } from "../../components/SnackbarContext";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "../api/v2/ronindojo/status";
import { MINUTE } from "../../const";
import { DojoStatusBoxDisplay } from "../../components/DojoStatusBoxDisplay";
import { QrCodeModal } from "../../components/QrCodeModal";
import { PageProps } from "../../types";

const Dialog = dynamic(() => import("../../components/Dialog"), { ssr: false });

const xpubRegex = /^(xpub|ypub|zpub)/i;

const getXpubSegwitType = (xpub: string) => {
  if (xpub.startsWith("zpub")) return "bip84" as const;
  if (xpub.startsWith("ypub")) return "bip49" as const;

  return null;
};

const getImportStatus = async (xpub: string): Promise<XpubImportStatusResponse> => {
  const { data } = await client.get<XpubImportStatusTrue | XpubImportStatusFalse>(`/dojo/xpub-import-status?xpub=${xpub}`);

  return data;
};

interface FormData {
  xpubText: string;
}

interface RescanFormValues {
  rescanIndex: number;
  rescanGap: number;
}

interface RetypeFormValues {
  segwit: "bip44" | "bip49" | "bip84";
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const XpubTool: NextPage<Props> = ({ roninDojoStatus }) => {
  const {
    register: xpubRegister,
    handleSubmit: xpubHandleSubmit,
    formState: { errors: xpubErrors, isSubmitting: xpubIsSubmitting },
    reset: xpubReset,
    getValues: xpubGetValues,
  } = useForm<FormData>();
  const {
    register: rescanRegister,
    handleSubmit: rescanHandleSubmit,
    formState: { errors: rescanErrors },
    reset: rescanReset,
  } = useForm<RescanFormValues>({
    defaultValues: {
      rescanIndex: 0,
      rescanGap: 100,
    },
  });
  const {
    register: retypeRegister,
    handleSubmit: retypeHandleSubmit,
    formState: { errors: retypeErrors },
    reset: retypeReset,
  } = useForm<RetypeFormValues>({
    defaultValues: {
      segwit: "bip44",
    },
  });
  const { callSnackbar } = useSnackbar();
  const [loading, setLoading] = useState<boolean>(false);
  const [xpubData, setXpubData] = useState<XpubInfoResponse | null>(null);
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openRescanDialog, setOpenRescanDialog] = useState<boolean>(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
  const [openRetypeDialog, setOpenRetypeDialog] = useState<boolean>(false);
  const [openQrModal, setOpenQrModal] = useState<boolean>(false);

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });

  const getWalletData = async (xpub: string) => {
    try {
      const walletDataResponse = await client.get<WalletResponse>(`/dojo/wallet?active=${xpub}`);

      setWalletData(walletDataResponse.data);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    }
  };

  const onXpubSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const xpubInfoResponse = await client.get<XpubInfoResponse>(`/dojo/xpub-info?xpub=${data.xpubText}`);
      setXpubData(xpubInfoResponse.data);

      if (xpubInfoResponse.data.tracked) {
        await getWalletData(data.xpubText);
      }
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRescan: SubmitHandler<RescanFormValues> = async (data) => {
    setOpenRescanDialog(false);
    setLoading(true);

    try {
      client.post<XpubRescanResponse>("/dojo/xpub-rescan", {
        xpub: xpubGetValues().xpubText,
        startidx: data.rescanIndex,
        gap: data.rescanGap,
      });

      await delay(2000);

      const getRecursiveXpubStatus = async (xpub: string): Promise<void> => {
        const xpubImportStatus = await getImportStatus(xpub);

        if (xpubImportStatus.data.import_in_progress) {
          callSnackbar(`Rescanning XPUB. Hits detected: ${xpubImportStatus.data.hits}`, "info");

          await delay(6000);

          return await getRecursiveXpubStatus(xpub);
        } else {
          callSnackbar(`XPUB rescan complete`, "success");
        }
      };

      await getRecursiveXpubStatus(xpubGetValues().xpubText);

      await xpubHandleSubmit(onXpubSubmit)();

      setSuccessMessage(`Rescan completed successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      rescanReset();
    }
  };

  const handleDelete = async (event: SyntheticEvent) => {
    event.preventDefault();

    setOpenDeleteDialog(false);
    setLoading(true);

    try {
      await client.post<XpubDeleteResponse>("/dojo/xpub-delete", {
        xpub: xpubGetValues().xpubText,
      });

      handleClear();

      setSuccessMessage(`XPUB deleted successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: SyntheticEvent) => {
    setLoading(true);

    try {
      client.post<XpubImportResponse>("/dojo/xpub-import", {
        xpub: xpubGetValues().xpubText,
        type: "restore",
        segwit: getXpubSegwitType(xpubGetValues().xpubText),
        force: true,
      });

      await delay(2000);

      const getRecursiveXpubStatus = async (xpub: string): Promise<void> => {
        const xpubImportStatus = await getImportStatus(xpub);

        if (xpubImportStatus.data.import_in_progress) {
          callSnackbar(`Importing XPUB. Hits detected: ${xpubImportStatus.data.hits}`, "info");

          await delay(6000);

          return await getRecursiveXpubStatus(xpub);
        } else {
          callSnackbar(`XPUB import complete`, "success");
        }
      };

      await getRecursiveXpubStatus(xpubGetValues().xpubText);

      await xpubHandleSubmit(onXpubSubmit)();
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetype: SubmitHandler<RetypeFormValues> = async (data) => {
    setLoading(true);
    setOpenRetypeDialog(false);

    try {
      client.post<XpubImportResponse>("/dojo/xpub-import", {
        xpub: xpubGetValues().xpubText,
        type: "restore",
        segwit: data.segwit === "bip44" ? null : data.segwit,
        force: true,
      });

      console.log(data);

      await delay(2000);

      const getRecursiveXpubStatus = async (): Promise<void> => {
        const xpubImportStatus = await getImportStatus(xpubGetValues().xpubText);

        if (xpubImportStatus.data.import_in_progress) {
          callSnackbar(`Reimporting XPUB. Hits detected: ${xpubImportStatus.data.hits}`, "info");

          await delay(6000);

          return getRecursiveXpubStatus();
        } else {
          callSnackbar(`XPUB import complete`, "success");
        }
      };

      await getRecursiveXpubStatus();

      await xpubHandleSubmit(onXpubSubmit)();
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      retypeReset();
    }
  };

  const handleClear = () => {
    xpubReset();
    rescanReset();
    retypeReset();
    setError(null);
    setXpubData(null);
    setWalletData(null);
  };

  useEffect(() => {
    if (xpubIsSubmitting) {
      setError(null);
    }
  }, [xpubIsSubmitting]);

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box mb-4">
        <h1 className="text-primary font-primary mb-6">XPUB TOOL</h1>
        <p className="text-paragraph mb-4">Check if an XPUB is tracked by your Dojo. Import and track a new XPUB or rescan the full history of an XPUB</p>
        <div className="box bg-black mb-6 relative">
          <form onSubmit={xpubHandleSubmit(onXpubSubmit)} className="xl:flex items-center" autoComplete="off">
            <div className="w-3/6 flex items-center mr-4">
              <input
                type="text"
                placeholder="XPUB to check"
                disabled={xpubIsSubmitting || Boolean(xpubData)}
                className="xl:w-full rounded-3xl bg-border border-none text-paragraph font-mono disabled:cursor-not-allowed disabled:text-gray-500"
                {...xpubRegister("xpubText", { required: true, validate: { isXpub: (val) => xpubRegex.test(val) } })}
              />
            </div>
            {xpubData ? (
              <div className="">
                <button key="clear" type="button" onClick={handleClear} disabled={xpubIsSubmitting || loading} className="button mr-4">
                  Check Another
                </button>
                {xpubData.tracked && (
                  <button key="rescan" type="button" onClick={() => setOpenRescanDialog(true)} disabled={xpubIsSubmitting || loading} className="button mr-4">
                    Rescan
                  </button>
                )}
                {xpubData.tracked && (
                  <button key="delete" type="button" onClick={() => setOpenDeleteDialog(true)} disabled={xpubIsSubmitting || loading} className="button mr-4">
                    Delete
                  </button>
                )}
                {xpubData.tracked && (
                  <button
                    key="retype"
                    type="button"
                    onClick={() => setOpenRetypeDialog(true)}
                    disabled={xpubIsSubmitting || loading}
                    className="button xl:mt-4"
                  >
                    Retype
                  </button>
                )}
              </div>
            ) : (
              <div>
                <button type="submit" disabled={xpubIsSubmitting} className="button mt-6 xl:mt-0">
                  Check
                </button>
              </div>
            )}
          </form>

          <DojoStatusBoxDisplay roninDojoStatus={roninDojoStatusData?.status ?? "OK"} />
        </div>

        <SuccessMessage message={successMessage} />

        <ErrorMessage
          errors={[
            error,
            xpubErrors.xpubText?.type === "required" ? "XPUB is required" : null,
            xpubErrors.xpubText?.type === "isXpub" ? "Please provide a valid XPUB" : null,
          ]}
        />

        {(xpubIsSubmitting || loading) && <LinearLoader />}
      </div>

      {xpubData && !xpubData.tracked && (
        <div className="bg-surface box xl:flex items-center mb-4">
          <div className="text-white font-primary text-l mr-3">
            This XPUB isn't tracked by your Dojo.
            <br />
            Do you want to import{" "}
            <span
              className="font-mono text-secondary ellipsis"
              data-content-start={xpubGetValues().xpubText.slice(0, xpubGetValues().xpubText.length / 2)}
              data-content-end={xpubGetValues().xpubText.slice(-1 * (xpubGetValues().xpubText.length / 2))}
            />{" "}
            and track its activity?
          </div>
          <button className="button mt-4 xl:mt-0" onClick={handleImport} disabled={loading}>
            Import XPUB
          </button>
        </div>
      )}

      {xpubData && walletData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="bg-surface box mb-4">
            <div className="xl:grid xl:grid-cols-2 gap-6">
              <div className="bg-black box md:flex xl:block 2xl:flex justify-between items-center">
                <div>
                  <h2 className="text-white font-primary text-xl mb-3">GENERAL INFO</h2>

                  <div className="text-white font-primary text-l mb-3">
                    <div>
                      Derivation type: <span className="font-mono text-secondary">{xpubData.derivation}</span>
                    </div>
                    <div>
                      Balance: <span className="font-mono text-secondary">{satsToBTC(xpubData.balance)} BTC</span>
                    </div>
                    <div>
                      Number of Txs: <span className="font-mono text-secondary">{xpubData.n_tx}</span>
                    </div>
                    <div>
                      Number of UTXOs: <span className="font-mono text-secondary">{walletData.unspent_outputs.length}</span>
                    </div>
                    <div>
                      Tracked since: <span className="font-mono text-secondary">{xpubData.created}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <button className="button" onClick={() => setOpenQrModal(true)}>
                    Show QR <QrCodeIcon className="inline-block w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="bg-black box mt-6 xl:mt-0">
                <h2 className="text-white font-primary text-xl mb-3">XPUB DERIVATION INFO</h2>
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-white font-primary text-l">
                      <div>
                        Account: <span className="font-mono text-secondary">{xpubData.account}</span>
                      </div>
                      <div className="mt-2">First unused indices:</div>
                      <div className="ml-2">
                        External: <span className="font-mono text-secondary">{xpubData.unused.external}</span>
                      </div>
                      <div className="ml-2">
                        Internal: <span className="font-mono text-secondary">{xpubData.unused.internal}</span>
                      </div>
                    </div>

                    <div className="text-white font-primary text-l">
                      <div>
                        Depth: <span className="font-mono text-secondary">{xpubData.depth}</span>
                      </div>
                      <div className="mt-2">Last derived indices:</div>
                      <div className="ml-2">
                        External: <span className="font-mono text-secondary">{xpubData.derived.external}</span>
                      </div>
                      <div className="ml-2">
                        Internal: <span className="font-mono text-secondary">{xpubData.derived.internal}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface box">
            <div className="xl:grid xl:grid-cols-2 gap-6">
              <div>
                <h2 className="text-white font-primary text-xl mb-3">MOST RECENT TRANSACTIONS</h2>
                {walletData.txs.map((item) => (
                  <div key={item.hash}>
                    <Transaction txid={item.hash} amount={item.result ?? 0} blockHeight={item.block_height ?? 0} dateInSeconds={item.time} />
                  </div>
                ))}
              </div>

              <div>
                <h2 className="text-white font-primary text-xl mb-3">UNSPENT TX OUTPUTS</h2>
                <div>
                  {walletData.unspent_outputs.length > 0 ? (
                    walletData.unspent_outputs.map((item) => (
                      <div key={`${item.tx_hash}-${item.tx_output_n}`}>
                        <UTXO txid={item.tx_hash} amount={item.value} address={item.addr} confirmations={item.confirmations} />
                      </div>
                    ))
                  ) : (
                    <h4 className="text-white font-primary text-l mb-3">There are no unspent transaction outputs for this address.</h4>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <Dialog
        title="Rescan XPUB?"
        open={openRescanDialog}
        onClose={() => setOpenRescanDialog(false)}
        className="max-w-2xl"
        actions={
          <Fragment>
            <button type="submit" form="rescanForm" className="button mr-4">
              Rescan
            </button>
            <button onClick={() => setOpenRescanDialog(false)} className="button">
              Cancel
            </button>
          </Fragment>
        }
      >
        <form onSubmit={rescanHandleSubmit(handleRescan)} id="rescanForm" autoComplete="off">
          <>
            <p className="text-paragraph mb-3">Define the starting index and lookahead value:</p>
            <div className="flex">
              <div className="mr-4">
                <input
                  type="text"
                  className="w-full resize-none rounded-3xl bg-border border-none text-paragraph font-mono mb-8"
                  inputMode="numeric"
                  {...rescanRegister("rescanIndex", {
                    valueAsNumber: true,
                    validate: { isNumeric: (val) => !Number.isNaN(val), zeroOrGreater: (val) => val >= 0 },
                  })}
                />
              </div>
              <div>
                <input
                  type="text"
                  className="w-full resize-none rounded-3xl bg-border border-none text-paragraph font-mono mb-8"
                  inputMode="numeric"
                  {...rescanRegister("rescanGap", {
                    valueAsNumber: true,
                    validate: { isNumeric: (val) => !Number.isNaN(val), zeroOrGreater: (val) => val >= 0 },
                  })}
                />
              </div>
            </div>
          </>
        </form>
      </Dialog>

      <Dialog
        title="Delete XPUB?"
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        className="max-w-2xl"
        actions={
          <Fragment>
            <button onClick={handleDelete} className="button mr-4">
              Yes, delete
            </button>
            <button onClick={() => setOpenDeleteDialog(false)} className="button">
              Cancel
            </button>
          </Fragment>
        }
      >
        <p className="text-paragraph">Do you want to stop tracking this XPUB and delete if from database?</p>
      </Dialog>

      <Dialog
        title="Retype XPUB?"
        open={openRetypeDialog}
        onClose={() => setOpenRetypeDialog(false)}
        className="max-w-2xl"
        actions={
          <Fragment>
            <button type="submit" form="retypeForm" className="button mr-4">
              Retype
            </button>
            <button onClick={() => setOpenRetypeDialog(false)} className="button">
              Cancel
            </button>
          </Fragment>
        }
      >
        <form onSubmit={retypeHandleSubmit(handleRetype)} id="retypeForm" autoComplete="off">
          <>
            <p className="text-paragraph mb-3">Do you want to retype this XPUB?</p>
            <div className="flex">
              <div className="mr-4 flex items-center">
                <input type="radio" id="bip44" className="mr-2" value="bip44" {...retypeRegister("segwit")} />
                <label htmlFor="bip44" className="text-white cursor-pointer">
                  BIP44 (XPUB)
                </label>
              </div>
              <div className="mr-4 flex items-center">
                <input type="radio" id="bip49" className="mr-2" value="bip49" {...retypeRegister("segwit")} />
                <label htmlFor="bip49" className="text-white cursor-pointer">
                  BIP49 (YPUB)
                </label>
              </div>
              <div className=" flex items-center">
                <input type="radio" id="bip84" className="mr-2" value="bip84" {...retypeRegister("segwit")} />
                <label htmlFor="bip84" className="text-white cursor-pointer">
                  BIP84 (ZPUB)
                </label>
              </div>
            </div>
          </>
        </form>
      </Dialog>

      <QrCodeModal open={openQrModal} onClose={() => setOpenQrModal(false)} value={xpubGetValues().xpubText} />
    </motion.div>
  );
};

type SsrProps = PageProps<{
  roninDojoStatus: RoninDojoHealth;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "XPUB Tool",
      roninDojoStatus: await getRoninDojoStatus(),
    },
  };
});

export default XpubTool;
