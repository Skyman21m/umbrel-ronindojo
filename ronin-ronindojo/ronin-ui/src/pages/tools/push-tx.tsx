import React, { useEffect, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import { isAxiosError } from "axios";
import { useForm, SubmitHandler } from "react-hook-form";
import isHexadecimal from "validator/lib/isHexadecimal";
import { motion } from "framer-motion";
import useSWR from "swr";

import { PushTxResponse } from "../../lib/server/dojoApi";
import { redirectUnathorized } from "../../lib/server/redirectUnathorized";
import { client } from "../../apiClient";
import { withSessionSsr } from "../../lib/server/session";
import { pageTransition } from "../../animations";
import { ErrorMessage } from "../../components/ErrorMessage";
import { SuccessMessage } from "../../components/SuccessMessage";
import { LinearLoader } from "../../components/LinearLoader";
import { DojoStatusBoxDisplay } from "../../components/DojoStatusBoxDisplay";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "../api/v2/ronindojo/status";
import { MINUTE } from "../../const";
import { ErrorResponse } from "../../lib/server/errorResponse";
import { PageProps } from "../../types";

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

interface FormData {
  txHex: string;
}

const PushTxPage: NextPage<Props> = ({ layoutTitle, roninDojoStatus }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const res = await client.post<PushTxResponse>(`/dojo/push-tx`, new URLSearchParams({ tx: data.txHex }));

      setSuccess(`Transaction sent successfully.\n Your transaction has been relayed with TX ID ${res.data.data}`);
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
      setSuccess(null);
    }
  }, [isSubmitting]);

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box">
        <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
        <h2 className="text-white font-primary text-xl mb-3">Send Transaction</h2>
        <p className="text-paragraph mb-12">Send a signed transaction to the Bitcoin network using your Dojo.</p>
        <div className="box bg-black relative">
          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
            <textarea
              placeholder="Signed transaction in HEX format"
              rows={12}
              className="w-full resize-none rounded-3xl bg-border border-none text-paragraph font-mono mb-8"
              {...register("txHex", { required: true, validate: { isHexadecimal: (val) => isHexadecimal(val) } })}
            />
            <div className="mb-2 flex justify-center">
              <button type="submit" disabled={isSubmitting} className="button">
                Send TX
              </button>
            </div>
          </form>

          <SuccessMessage message={success} />

          <ErrorMessage
            errors={[
              error,
              errors.txHex?.type === "required" ? "Transaction HEX is required" : null,
              errors.txHex?.type === "isHexadecimal" ? "Please provide a transaction in a valid HEX format" : null,
            ]}
          />
          <DojoStatusBoxDisplay roninDojoStatus={roninDojoStatusData?.status ?? "OK"} />
        </div>
        {isSubmitting && <LinearLoader className="mt-4" />}
      </div>
    </motion.div>
  );
};

type SsrProps = PageProps<{
  withLayout: true; // necessary workaround
  roninDojoStatus: RoninDojoHealth;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Push TX",
      roninDojoStatus: await getRoninDojoStatus(),
    },
  };
});

export default PushTxPage;
