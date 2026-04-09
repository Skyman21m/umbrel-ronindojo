import React, { SyntheticEvent, useEffect, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import { SubmitHandler, useForm } from "react-hook-form";
import { isAxiosError } from "axios";
import useSWR from "swr";
import isHexadecimal from "validator/lib/isHexadecimal";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { pipe } from "fp-ts/function";
import { task, taskEither } from "fp-ts";

import { pageTransition } from "../../animations";
import { ErrorMessage } from "../../components/ErrorMessage";
import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { withSessionSsr } from "../../lib/server/session";
import { client } from "../../apiClient";
import { Response as TxInfoResponse, getTxInfo } from "../api/v2/dojo/tx-info";
import { satsToBTC } from "../../lib/common";
import { LinearLoader } from "../../components/LinearLoader";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "../api/v2/ronindojo/status";
import { MINUTE } from "../../const";
import { DojoStatusBoxDisplay } from "../../components/DojoStatusBoxDisplay";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { PageProps } from "../../types";
import { ADDRESS_PAGE, BOLTZMANN_PAGE, TRANSACTION_PAGE } from "../../routes";

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

interface FormData {
  txId: string;
}

const TransactionTool: NextPage<Props> = ({ roninDojoStatus, ssrTxInfo }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({ reValidateMode: "onSubmit", defaultValues: { txId: ssrTxInfo?.txid ?? undefined } });

  const [txData, setTxData] = useState<TxInfoResponse | null>(ssrTxInfo);
  const [error, setError] = useState<string | null>(null);

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });

  const handleClear = (event: SyntheticEvent) => {
    event.preventDefault();
    reset({ txId: "" });
    setTxData(null);
    setError(null);
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const jsonData = await client.get(`/dojo/tx-info?txId=${data.txId}`);

      setTxData(jsonData.data);
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
      setTxData(null);
    }
  }, [isSubmitting]);

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box mb-4">
        <h1 className="text-primary font-primary mb-6">TRANSACTION TOOL</h1>
        <p className="text-paragraph mb-4">Display information about a desired transaction.</p>
        <div className="box bg-black w-full mb-6 relative">
          <form onSubmit={handleSubmit(onSubmit)} className="xl:flex items-center" autoComplete="off">
            <div className="w-3/6 flex items-center mr-4">
              <input
                type="text"
                placeholder="Transaction ID"
                disabled={isSubmitting || Boolean(txData)}
                className="xl:w-full resize-none rounded-3xl bg-border border-none text-paragraph font-mono disabled:cursor-not-allowed disabled:text-gray-500"
                {...register("txId", { required: true, validate: { isHexadecimal: (val) => isHexadecimal(val) } })}
              />
            </div>
            <div>
              {txData ? (
                <button type="reset" onClick={handleClear} className="button mt-4 xl:mt-0">
                  Check another
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="button mt-4 xl:mt-0">
                  Check
                </button>
              )}
            </div>
          </form>

          <DojoStatusBoxDisplay roninDojoStatus={roninDojoStatusData?.status ?? "OK"} />
        </div>

        <ErrorMessage
          errors={[
            error,
            errors.txId?.type === "required" ? "Transaction ID is required" : null,
            errors.txId?.type === "isHexadecimal" ? "Invalid transaction ID" : null,
          ]}
        />

        {isSubmitting && <LinearLoader />}
      </div>

      {txData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="bg-surface box mb-4">
            <div className="xl:grid xl:grid-cols-2 gap-6 mb-4">
              <div className="bg-black box mb-4 xl:mb-0">
                <h2 className="text-white font-primary text-xl mb-3">GENERAL INFO</h2>

                <div className="text-white font-primary text-l mb-3">
                  <div>
                    First-seen date:{" "}
                    <span className="font-mono text-secondary">
                      {txData.created ? `${DateTime.fromSeconds(txData.created, { zone: "UTC" }).toFormat("yyyy-MM-dd HH:mm")} UTC` : "-"}
                    </span>
                  </div>
                  <div>
                    Found in:{" "}
                    <span className="font-mono text-secondary">
                      {txData.block ? `Block ${txData.block.height} (${txData.confirmations} confirmations)` : "Mempool"}
                    </span>
                  </div>
                  <div>
                    Amount:{" "}
                    <span className="font-mono text-secondary">{satsToBTC(txData.outputs.reduce((acc, output) => acc + output.value, txData.fees))} BTC</span>
                  </div>
                  <div>
                    Fees: <span className="font-mono text-secondary">{txData.fees} sats</span>
                  </div>
                  <div>
                    Feerate: <span className="font-mono text-secondary">{txData.vfeerate} sats/vbyte</span>
                  </div>
                  <div>
                    Number of inputs: <span className="font-mono text-secondary">{txData.inputs.length}</span>
                  </div>
                  <div>
                    Number of outputs: <span className="font-mono text-secondary">{txData.outputs.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-black box flex-1 mb-4 xl:mb-0">
                <h2 className="text-white font-primary text-xl mb-3">TECHNICAL INFO</h2>

                <div className="text-white font-primary text-l mb-3">
                  <div>
                    Virtual size: <span className="font-mono text-secondary">{txData.vsize} vbytes</span>
                  </div>
                  <div>
                    Raw size: <span className="font-mono text-secondary">{txData.size} bytes</span>
                  </div>
                  <div>
                    Transaction version: <span className="font-mono text-secondary">{txData.version}</span>
                  </div>
                  <div>
                    nLockTime:{" "}
                    <span className="font-mono text-secondary">
                      {txData.locktime < 500000000
                        ? `Block ${txData.locktime}`
                        : `${DateTime.fromSeconds(txData.locktime, { zone: "UTC" }).toFormat("yyyy-MM-dd HH:mm")} UTC`}
                    </span>
                  </div>
                </div>

                <Link href={BOLTZMANN_PAGE + "?txid=" + txData.txid} prefetch={false} className="button mt-4">
                  Analyze with Boltzmann
                </Link>
              </div>

              <div className="mb-4 bg-black box">
                <h2 className="text-white font-primary text-xl mb-3">INPUTS</h2>
                <div>
                  {txData.inputs.map((input) => (
                    <div key={input.n} className="flex flex-wrap items-center mb-6 xl:mb-2">
                      <ArrowRightIcon className="text-green-600 h-6 w-6 mr-1" />
                      <Link
                        prefetch={false}
                        href={TRANSACTION_PAGE + "?txid=" + input.outpoint?.txid}
                        className="ellipsis flex-1 font-mono text-secondary h-6 hover:text-primary transition-colors"
                        data-content-start={input.outpoint?.txid.slice(0, 32)}
                        data-content-end={input.outpoint?.txid.slice(-32)}
                      ></Link>
                      <span className="font-mono text-white">#{input.outpoint?.vout}</span>

                      <span className="flex-1 text-white text-right w-1/4">{satsToBTC(input.outpoint?.value ?? 0)}&nbsp;BTC</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 bg-black box">
                <h2 className="text-white font-primary text-xl mb-3">OUTPUTS</h2>
                <div>
                  {txData.outputs.map((output) => (
                    <div key={output.n} className="flex flex-wrap items-center mb-6 xl:mb-2">
                      <ArrowRightIcon className="text-primary h-6 w-6 mr-1" />

                      {output.address ? (
                        <Link
                          href={ADDRESS_PAGE + "?addr=" + output.address}
                          prefetch={false}
                          className="ellipsis flex-1 font-mono text-secondary h-6 hover:text-primary transition-colors"
                          data-content-start={output.address.slice(0, output.address.length / 2)}
                          data-content-end={output.address.slice(-1 * (output.address.length / 2))}
                        ></Link>
                      ) : (
                        <span className="flex-1 font-mono text-white h-6">{output.type}</span>
                      )}

                      <span className="flex-1 text-white text-right w-1/4">{satsToBTC(output.value)}&nbsp;BTC</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

type SsrProps = PageProps<{
  roninDojoStatus: RoninDojoHealth;
  ssrTxInfo: TxInfoResponse;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  const roninDojoStatus = await getRoninDojoStatus();
  let ssrTxInfo: TxInfoResponse | null = null;

  if (roninDojoStatus === "OK" && ctx.query.txid && typeof ctx.query.txid === "string") {
    ssrTxInfo = await pipe(
      getTxInfo(ctx.query.txid),
      taskEither.getOrElseW(() => task.of(null)),
    )();
  }

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Transaction Tool",
      roninDojoStatus,
      ssrTxInfo,
    },
  };
});

export default TransactionTool;
