import React, { SyntheticEvent, useEffect, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { isAxiosError } from "axios";
import { SubmitHandler, useForm } from "react-hook-form";
import useSWR from "swr";
import { QrCodeIcon } from "@heroicons/react/24/outline";
import { task, taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";

import { pageTransition } from "../../animations";
import { SuccessMessage } from "../../components/SuccessMessage";
import { LinearLoader } from "../../components/LinearLoader";
import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { Transaction } from "../../components/Transaction";
import { UTXO } from "../../components/UTXO";
import { withSessionSsr } from "../../lib/server/session";
import { client } from "../../apiClient";
import { AddressInfoResponse, AddressRescanResponse, WalletResponse } from "../../lib/server/dojoApi";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { isBitcoinAddress } from "../../lib/common";
import { ErrorMessage } from "../../components/ErrorMessage";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "../api/v2/ronindojo/status";
import { DojoStatusBoxDisplay } from "../../components/DojoStatusBoxDisplay";
import { MINUTE } from "../../const";
import { QrCodeModal } from "../../components/QrCodeModal";
import { PageProps } from "../../types";
import { getAddressInfo } from "../api/v2/dojo/address-info";
import { getWalletInfo } from "../api/v2/dojo/wallet";

const Dialog = dynamic(() => import("../../components/Dialog"), { ssr: false });

const getAddressTypeString = (addressType: AddressInfoResponse["type"]): string => {
  switch (addressType) {
    case "hd":
      return "Derived from an XPUB";
    case "loose":
      return "Loose address";
    default:
      return "-";
  }
};

interface FormData {
  addressText: string;
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const AddressTool: NextPage<Props> = ({ roninDojoStatus, ssrAddressData, ssrWalletData }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    getValues,
  } = useForm<FormData>({ defaultValues: { addressText: ssrAddressData?.address ?? undefined } });
  const [error, setError] = useState<string | null>(null);
  const [addressData, setAddressData] = useState<AddressInfoResponse | null>(ssrAddressData);
  const [walletData, setWalletData] = useState<WalletResponse | null>(ssrWalletData);

  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [rescanLoading, setRescanLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [openRescanDialog, setOpenRescanDialog] = useState<boolean>(false);
  const [openQrModal, setOpenQrModal] = useState<boolean>(false);

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });

  const getWalletData = async (address: string, importAddress = false) => {
    setImportLoading(true);

    try {
      const walletDataResponse = await client.get<WalletResponse>(`/dojo/wallet?active=${address}`);

      if (importAddress) {
        const addressInfoResponse = await client.get<AddressInfoResponse>(`/dojo/address-info?address=${address}`);
        setAddressData(addressInfoResponse.data);

        setSuccessMessage(`Address ${address} imported successfully`);
        setTimeout(() => setSuccessMessage(null), 5000);
      }

      setWalletData(walletDataResponse.data);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      setImportLoading(false);
    }
  };

  const handleRescan = async (event: SyntheticEvent) => {
    event.preventDefault();

    if (!addressData) return;

    setOpenRescanDialog(false);
    setRescanLoading(true);

    try {
      await client.post<AddressRescanResponse>("/dojo/address-rescan", {
        address: addressData.address,
      });

      await handleSubmit(onSubmit)();

      setSuccessMessage(`Rescan completed successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    } finally {
      setRescanLoading(false);
    }
  };

  const handleClear = () => {
    reset({ addressText: "" });
    setError(null);
    setAddressData(null);
    setWalletData(null);
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const addressInfoResponse = await client.get<AddressInfoResponse>(`/dojo/address-info?address=${data.addressText}`);
      setAddressData(addressInfoResponse.data);

      if (addressInfoResponse.data.type !== "untracked") {
        await getWalletData(data.addressText, false);
      }
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    }
  };

  useEffect(() => {
    if (isSubmitting) {
      setError(null);
      setSuccessMessage(null);
    }
  }, [isSubmitting]);

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box mb-4">
        <h1 className="text-primary font-primary mb-6">ADDRESS TOOL</h1>
        <p className="text-paragraph mb-4">
          Check if an address is tracked by your Dojo. Import and track a new address. Rescan the full history of an address.
        </p>
        <div className="box bg-black w-full mb-6 relative">
          <form onSubmit={handleSubmit(onSubmit)} className="xl:flex items-center" autoComplete="off">
            <div className="w-3/6 flex items-center mr-4">
              <input
                type="text"
                placeholder="Address to check"
                disabled={isSubmitting || Boolean(addressData)}
                className="xl:w-full rounded-3xl bg-border border-none text-paragraph font-mono disabled:cursor-not-allowed disabled:text-gray-500"
                {...register("addressText", { required: true, validate: { isBitcoinAddress: (val) => isBitcoinAddress(val) || isBitcoinAddress(val, true) } })}
              />
            </div>
            {addressData ? (
              <div>
                <button key="reset" type="button" onClick={handleClear} disabled={isSubmitting || rescanLoading} className="button mr-4 mt-4 xl:mt-0">
                  Check another
                </button>
                {walletData && (
                  <button
                    key="rescan"
                    type="button"
                    onClick={() => setOpenRescanDialog(true)}
                    disabled={isSubmitting || rescanLoading}
                    className="button mt-4 xl:mt-0"
                  >
                    Rescan
                  </button>
                )}
              </div>
            ) : (
              <div>
                <button key="submit" type="submit" disabled={isSubmitting} className="button mt-4 xl:mt-0">
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
            errors.addressText?.type === "required" ? "Address is required." : null,
            errors.addressText?.type === "isBitcoinAddress" ? "Address has to be a valid bitcoin address." : null,
          ]}
        />

        {(isSubmitting || rescanLoading) && <LinearLoader />}
      </div>

      <div>
        {addressData && addressData.type === "untracked" && (
          <div className="w-full">
            <div className="box bg-black relative w-full h-5/6 mb-6">
              <div>
                <div>
                  <h2 className="text-white font-primary text-l mb-3">
                    This address isn't tracked by your Dojo.
                    <br />
                    Do you want to import <span className="font-mono text-secondary">{addressData.address}</span> and track its activity?
                  </h2>
                </div>
                <div>
                  <button onClick={() => getWalletData(addressData.address, true)} disabled={importLoading} className="button">
                    Import address
                  </button>
                </div>
              </div>
              {importLoading && <LinearLoader className="mt-6" />}
            </div>
          </div>
        )}
        {addressData && walletData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <div className="mt-4">
              <div className="box bg-surface w-full   mb-6">
                <div className="xl:grid xl:grid-cols-2 gap-6">
                  <div className="bg-black box mb-4 xl:mb-0 md:flex xl:block 2xl:flex justify-between items-center">
                    <div>
                      <h2 className="text-white font-primary text-xl mb-3">GENERAL INFO</h2>
                      <div className="text-white font-primary text-l mb-3">
                        <div>
                          Balance: <span className="font-mono text-secondary">{addressData.balance} BTC</span>
                        </div>
                        <div>
                          Number of Txs: <span className="font-mono text-secondary">{addressData.n_tx}</span>
                        </div>
                        <div>
                          Number of UTXOs: <span className="font-mono text-secondary">{addressData.utxo.length}</span>
                        </div>
                        <div>
                          Segwit: <span className="font-mono text-secondary">{addressData.segwit ? <span>&#10003;</span> : "-"}</span>
                        </div>
                        <div>
                          Address type: <span className="font-mono text-secondary">{getAddressTypeString(addressData.type)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <button className="button" onClick={() => setOpenQrModal(true)}>
                        Show QR <QrCodeIcon className="inline-block w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {addressData.type === "hd" && (
                    <div className="bg-black box">
                      <h2 className="text-white font-primary text-xl mb-3">DERIVATION INFO</h2>
                      <h2 className="text-white font-primary text-l mb-3">
                        <div>
                          Derivation path: <span className="font-mono text-secondary">{addressData.path}</span>
                        </div>
                        <div>
                          Derived from: <span className="font-mono text-secondary">{addressData.xpub}</span>
                        </div>
                      </h2>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="box bg-surface w-full mb-6">
              <div className="xl:grid xl:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-white font-primary text-xl mb-3">MOST RECENT TRANSACTIONS</h2>
                  <div>
                    {walletData.txs.map((item) => (
                      <div key={item.hash}>
                        <Transaction txid={item.hash} amount={item.result ?? 0} blockHeight={item.block_height ?? 0} dateInSeconds={item.time} />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-white font-primary text-xl mb-3">UNSPENT UTXOS</h2>
                  <div>
                    {walletData.unspent_outputs.length > 0 ? (
                      walletData.unspent_outputs.map((item) => (
                        <div key={`${item.tx_hash}-${item.tx_output_n}`}>
                          <UTXO txid={item.tx_hash} amount={item.value} address={item.addr} confirmations={item.confirmations} />
                        </div>
                      ))
                    ) : (
                      <div>
                        <h4 className="text-white font-primary text-l mb-3">There are no unspent transaction inputs for this address.</h4>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      <Dialog
        title="Do you want to rescan this address?"
        open={openRescanDialog}
        onClose={() => setOpenRescanDialog(false)}
        className="max-w-2xl"
        actions={
          <>
            <button onClick={handleRescan} className="button mr-4">
              Rescan
            </button>
            <button onClick={() => setOpenRescanDialog(false)} className="button">
              Cancel
            </button>
          </>
        }
      ></Dialog>
      <QrCodeModal open={openQrModal} onClose={() => setOpenQrModal(false)} value={getValues().addressText} />
    </motion.div>
  );
};

type SsrProps = PageProps<{
  roninDojoStatus: RoninDojoHealth;
  ssrAddressData: AddressInfoResponse | null;
  ssrWalletData: WalletResponse | null;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  const roninDojoStatus = await getRoninDojoStatus();

  let ssrAddressData: AddressInfoResponse | null = null;
  let ssrWalletData: WalletResponse | null = null;

  if (roninDojoStatus === "OK" && ctx.query.addr && typeof ctx.query.addr === "string") {
    ssrAddressData = await pipe(
      getAddressInfo(ctx.query.addr),
      taskEither.getOrElseW(() => task.of(null)),
    )();

    if (ssrAddressData && ssrAddressData.type !== "untracked") {
      ssrWalletData = await pipe(
        getWalletInfo({ active: ctx.query.addr }),
        taskEither.getOrElseW(() => task.of(null)),
      )();
    }
  }

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Address Tool",
      roninDojoStatus,
      ssrAddressData,
      ssrWalletData,
    },
  };
});

export default AddressTool;
