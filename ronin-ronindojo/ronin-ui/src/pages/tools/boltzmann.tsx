import React, { SyntheticEvent, useEffect, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import Link from "next/link";
import clsx from "clsx";
import { isAxiosError } from "axios";
import { useForm, SubmitHandler } from "react-hook-form";
import isHexadecimal from "validator/lib/isHexadecimal";
import { motion } from "framer-motion";
import useSWR from "swr";
import { Sankey, SankeyNode, SankeyLink } from "reaviz";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { task, taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";

import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { client } from "../../apiClient";
import { withSessionSsr } from "../../lib/server/session";
import { pageTransition } from "../../animations";
import { ErrorMessage } from "../../components/ErrorMessage";
import { LinearLoader } from "../../components/LinearLoader";
import { DojoStatusBoxDisplay } from "../../components/DojoStatusBoxDisplay";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "../api/v2/ronindojo/status";
import { getBoltzmann, Response as BoltzmannResponse } from "../api/v2/ronindojo/boltzmann";
import { MINUTE } from "../../const";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { PageProps } from "../../types";
import { transformBoltzmannDataForSankey } from "../../lib/client/transformBoltzmannData";
import { TRANSACTION_PAGE } from "../../routes";

const getColor = (probability: number) => {
  if (probability === 100) return "#d90000";
  if (probability > 50) return "#dede37";
  return "#009b00";
};

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

interface FormData {
  txId: string;
}

const BoltzmannPage: NextPage<Props> = ({ layoutTitle, roninDojoStatus, ssrBoltzmannResult, ssrTxid }) => {
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ defaultValues: { txId: ssrTxid ?? undefined } });
  const [boltzmannData, setBoltzmannData] = useState<BoltzmannResponse | null>(ssrBoltzmannResult);
  const [displayResult, setDisplayResult] = useState<"graph" | "table">("graph");
  const [error, setError] = useState<string | null>(null);

  const sankeyData = boltzmannData ? transformBoltzmannDataForSankey(boltzmannData) : null;

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const res = await client.post<BoltzmannResponse>(`/ronindojo/boltzmann`, { txid: data.txId });

      setBoltzmannData(res.data);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    }
  };

  const handleClear = (event: SyntheticEvent) => {
    event.preventDefault();
    reset({ txId: "" });
    setBoltzmannData(null);
    setError(null);
  };

  useEffect(() => {
    if (isSubmitting) {
      setError(null);
    }
  }, [isSubmitting]);

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box">
        <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
        <h2 className="text-white font-primary text-xl mb-3">Boltzmann Calculator</h2>
        <p className="text-paragraph mb-12">Know your coin privacy.</p>
        <div className="box bg-black w-full mb-6 relative">
          <h3 className="text-white font-primary text-xl">Analyze transaction</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="xl:flex items-center" autoComplete="off">
            <div className="w-3/6 flex items-center mr-4">
              <input
                type="text"
                placeholder="Transaction ID"
                disabled={isSubmitting || Boolean(boltzmannData)}
                className="xl:w-full resize-none rounded-3xl bg-border border-none text-paragraph font-mono disabled:cursor-not-allowed disabled:text-gray-500"
                {...register("txId", { required: true, validate: { isHexadecimal: (val) => isHexadecimal(val) } })}
              />
            </div>
            <div>
              {boltzmannData ? (
                <button type="reset" onClick={handleClear} className="button mt-4 xl:mt-0">
                  Analyze another
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting} className="button mt-4 xl:mt-0">
                  Analyze
                </button>
              )}
            </div>
          </form>

          <DojoStatusBoxDisplay roninDojoStatus={roninDojoStatusData?.status ?? "OK"} />
        </div>
        {isSubmitting && <LinearLoader className="mt-4" />}

        <ErrorMessage
          errors={[
            error,
            errors.txId?.type === "required" ? "Missing transaction ID" : null,
            errors.txId?.type === "isHexadecimal" ? "Invalid transaction ID" : null,
          ]}
        />

        {boltzmannData && sankeyData && (
          <div className="box bg-black w-full mb-6 relative">
            <div className="flex flex-col lg:flex-row">
              <div className="flex-1">
                <h3 className="text-white font-primary text-xl">Transaction Data</h3>
                <p className="text-paragraph py-4">The data below shows your transaction entropy and number of combinations.</p>
                <dl className="mb-6">
                  <div className="px-4 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm/6 font-bold text-white">Number of combinations:</dt>
                    <dd className="mt-1 text-sm/6 text-paragraph sm:col-span-2 sm:mt-0">{boltzmannData.nbCmbn}</dd>
                  </div>
                  <div className="px-4 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm/6 font-bold text-white">Transaction entropy:</dt>
                    <dd className="mt-1 text-sm/6 text-paragraph sm:col-span-2 sm:mt-0">{boltzmannData.entropy} bits</dd>
                  </div>
                  <div className="px-4 py-1 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                    <dt className="text-sm/6 font-bold text-white">Transaction efficiency:</dt>
                    <dd className="mt-1 text-sm/6 text-paragraph sm:col-span-2 sm:mt-0">{boltzmannData.efficiency ?? "N/A"}</dd>
                  </div>
                </dl>
                <div className="text-white text-lg">
                  {boltzmannData.dtrmLnks.length === 0 ? (
                    boltzmannData.matLnkProbabilities?.length === 0 ? null : (
                      <div>
                        <CheckCircleIcon className="w-6 h-6 mr-1 inline-block text-green-700" /> Found <strong>zero</strong> deterministic links
                      </div>
                    )
                  ) : (
                    <>
                      <div className="mb-2">
                        <ExclamationTriangleIcon className="w-6 h-6 mr-1 inline-block text-yellow-500" /> Found <strong>{boltzmannData.dtrmLnks.length}</strong>{" "}
                        deterministic links:
                      </div>
                      {boltzmannData.dtrmLnks.map(([input, output]) => (
                        <div key={input + output} className="text-xs mb-2 grid grid-cols-11">
                          <span className="overflow-ellipsis overflow-hidden col-span-5">{input}</span> <span className="text-center">&rarr;</span>{" "}
                          <span className="overflow-ellipsis overflow-hidden col-span-5">{output}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
                <Link href={TRANSACTION_PAGE + "?txid=" + getValues().txId} prefetch={false} className="button mt-16">
                  Show in Transaction Tool
                </Link>
              </div>
              <div className="flex-1 overflow-hidden">
                {boltzmannData ? (
                  <div className="max-w-full">
                    <div className="justify-center mb-4 flex flex-col lg:flex-row">
                      <div className="inline-block">
                        <a
                          onClick={() => setDisplayResult("graph")}
                          className={clsx([
                            "cursor-pointer text-center block transition-colors font-primary hover:text-white hover:drop-shadow-menuItem text-xl mx-8 capitalize whitespace-nowrap",
                            displayResult === "graph" ? "text-white" : "text-menuText",
                            displayResult === "graph" && "drop-shadow-menuItem",
                          ])}
                        >
                          Graph
                        </a>
                        {displayResult === "graph" && <motion.div className="mx-8 border-b-2 border-primary" layoutId="underline"></motion.div>}
                      </div>
                      <div className="inline-block">
                        <a
                          onClick={() => setDisplayResult("table")}
                          className={clsx([
                            "cursor-pointer text-center block transition-colors font-primary hover:text-white hover:drop-shadow-menuItem text-xl mx-8 capitalize whitespace-nowrap",
                            displayResult === "table" ? "text-white" : "text-menuText",
                            displayResult === "table" && "drop-shadow-menuItem",
                          ])}
                        >
                          Table
                        </a>
                        {displayResult === "table" && <motion.div className="mx-8 border-b-2 border-primary" layoutId="underline"></motion.div>}
                      </div>
                    </div>
                    <div className="bg-border rounded-xl p-4 relative w-full aspect-video">
                      {displayResult === "graph" && (
                        <Sankey
                          margins={[0, 2]}
                          nodeWidth={10}
                          nodePadding={6}
                          nodeSort={() => 0}
                          nodes={sankeyData.nodes.map((sankeyNode) => (
                            <SankeyNode className="sankey-node" title={sankeyNode.name} id={sankeyNode.name} key={sankeyNode.name} tooltip={null} />
                          ))}
                          links={sankeyData.links.map((sankeyLink) => (
                            <SankeyLink
                              source={sankeyLink.source}
                              target={sankeyLink.target}
                              value={sankeyLink.value}
                              key={sankeyLink.source + sankeyLink.target}
                              style={{
                                stroke: getColor(sankeyLink.value),
                              }}
                            />
                          ))}
                        />
                      )}
                      {displayResult === "table" && boltzmannData.matLnkProbabilities && boltzmannData.matLnkProbabilities.length > 0 && (
                        <div className="overflow-x-auto ">
                          <table className="table-auto w-full">
                            <thead>
                              <tr className="text-center text-white text-sm border-b border-secondary">
                                <th />
                                {boltzmannData.matLnkProbabilities[0].map((_, inputIndex) => (
                                  <th key={String(inputIndex)} className="p-2">
                                    IN.{inputIndex}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {boltzmannData.matLnkProbabilities.map((output, outputIndex) => (
                                <tr key={String(outputIndex)}>
                                  <td className="text-white font-bold border-r border-secondary w-16 px-4 py-2">OUT.{outputIndex}</td>
                                  {output.map((input, inputIndex) => (
                                    <td
                                      key={outputIndex + "-" + inputIndex}
                                      className="p-2 text-center font-bold"
                                      style={{ color: getColor(Number((input * 100).toFixed(0))) }}
                                    >
                                      {(input * 100).toFixed(0)}%
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

type SsrProps = PageProps<{
  withLayout: true; // necessary workaround
  roninDojoStatus: RoninDojoHealth;
  ssrBoltzmannResult: BoltzmannResponse | null;
  ssrTxid: string | null;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  const roninDojoStatus = await getRoninDojoStatus();
  let ssrBoltzmannResult: BoltzmannResponse | null = null;
  let ssrTxid: string | null = null;

  if (roninDojoStatus === "OK" && ctx.query.txid && typeof ctx.query.txid === "string") {
    ssrBoltzmannResult = await pipe(
      getBoltzmann(ctx.query.txid),
      taskEither.getOrElseW(() => task.of(null)),
    )();
    ssrTxid = ctx.query.txid;
  }

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Boltzmann",
      roninDojoStatus,
      ssrBoltzmannResult,
      ssrTxid,
    },
  };
});

export default BoltzmannPage;
