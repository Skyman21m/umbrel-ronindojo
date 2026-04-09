import React, { useEffect, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import { motion } from "framer-motion";
import { useForm, SubmitHandler } from "react-hook-form";
import { isAxiosError } from "axios";
import useSWR from "swr";
import { option } from "fp-ts";
import { pipe } from "fp-ts/function";

import { pageTransition } from "../../animations";
import { client } from "../../apiClient";

import { LinearLoader } from "../../components/LinearLoader";
import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { withSessionSsr } from "../../lib/server/session";
import { getRDBlockchainInfo, Response as BlockchainInfoResponse } from "../api/v2/bitcoind/blockchain-info";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SuccessMessage } from "../../components/SuccessMessage";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "../api/v2/ronindojo/status";
import { MINUTE } from "../../const";
import { DojoStatusBoxDisplay } from "../../components/DojoStatusBoxDisplay";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { PageProps } from "../../types";

interface FormData {
  fromHeight: number;
  toHeight: number;
}

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const PushTxPage: NextPage<Props> = ({ ssrBlockchainInfo, roninDojoStatus }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormData>({
    reValidateMode: "onSubmit",
    defaultValues: { fromHeight: (ssrBlockchainInfo?.blocks ?? 700000) - 24, toHeight: ssrBlockchainInfo?.blocks ?? 700000 },
  });

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      await client.post("/dojo/blocks-rescan", {
        fromHeight: data.fromHeight,
        toHeight: data.toHeight,
      });
      setSuccess(`Successfully rescanned blocks from height ${data.fromHeight} to ${data.toHeight}`);
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
      setSuccess(null);
      setError(null);
    }
  }, [isSubmitting]);

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box mb-4">
        <h1 className="text-primary font-primary mb-6">BLOCK RESCAN</h1>
        <p className="text-paragraph mb-4">Force the Tracker to rescan a small range of blocks</p>
        <div>
          <div className="xl:w-4/5 w-full">
            <div className="box bg-black relative w-full">
              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6" autoComplete="off">
                <div>
                  <label htmlFor="fromHeight" className="block text-white text-xl ml-3 mb-2">
                    From height:
                  </label>
                  <input
                    type="text"
                    id="fromHeight"
                    inputMode="numeric"
                    className="w-full rounded-3xl bg-border border-none text-paragraph font-mono"
                    {...register("fromHeight", {
                      required: true,
                      valueAsNumber: true,
                      validate: { isNumeric: (val) => !Number.isNaN(val), greaterThanZero: (val) => val > 0 },
                    })}
                  />
                </div>

                <div className="">
                  <label htmlFor="toHeight" className="block text-white text-xl ml-3 mb-2">
                    To height:
                  </label>
                  <input
                    type="text"
                    id="toHeight"
                    inputMode="numeric"
                    className="w-full rounded-3xl bg-border border-none text-paragraph font-mono"
                    {...register("toHeight", {
                      required: true,
                      valueAsNumber: true,
                      validate: { isNumeric: (val) => !Number.isNaN(val), greaterThanFromHeight: (val) => val > getValues().fromHeight },
                    })}
                  />
                </div>

                <div className="xl:flex xl:items-end">
                  <button type="submit" disabled={isSubmitting} className="button xl:translate-y-2">
                    Rescan
                  </button>
                </div>
              </form>

              <SuccessMessage message={success} />

              <ErrorMessage
                errors={[
                  error,
                  errors.fromHeight?.type === "required" ? `"From height" is required.` : null,
                  errors.fromHeight?.type === "isNumeric" ? `"From height" must be a number.` : null,
                  errors.fromHeight?.type === "greaterThanZero" ? `"From height" must be greater than zero.` : null,
                  errors.toHeight?.type === "required" ? `"To height" is required.` : null,
                  errors.toHeight?.type === "isNumeric" ? `"To height" must be a number.` : null,
                  errors.toHeight?.type === "greaterThanFromHeight" ? `"To height" must be greater than "From height".` : null,
                ]}
              />

              {isSubmitting && <LinearLoader />}
              <DojoStatusBoxDisplay roninDojoStatus={roninDojoStatusData?.status ?? "OK"} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

type SsrProps = PageProps<{
  ssrBlockchainInfo: BlockchainInfoResponse | null;
  roninDojoStatus: RoninDojoHealth;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const ssrBlockchainInfo = await getRDBlockchainInfo();

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Rescan Blocks",
      ssrBlockchainInfo: pipe(ssrBlockchainInfo, option.fromEither, option.toNullable),
      roninDojoStatus: await getRoninDojoStatus(),
    },
  };
});

export default PushTxPage;
