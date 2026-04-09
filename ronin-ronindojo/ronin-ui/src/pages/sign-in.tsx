import React, { useState, useEffect, useCallback } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { isAxiosError } from "axios";
import { useForm, SubmitHandler } from "react-hook-form";
import { taskEither, task } from "fp-ts";
import { pipe } from "fp-ts/function";

import { redirectAuthorized } from "../lib/server/redirectAuthorized";
import { DASHBOARD_PAGE } from "../routes";
import { client } from "../apiClient";
import { withSessionSsr } from "../lib/server/session";
import { useUser } from "../lib/client";
import { ErrorMessage } from "../components/ErrorMessage";
import { readDataFile } from "../lib/server/dataFile";
import { LayoutSimple } from "../components/LayoutSimple";
import { CircularLoader } from "../components/CircularLoader";
import { PageProps } from "../types";
import { encryptString } from "../lib/client/encryptString";

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const SignIn: NextPage<Props> = ({ reinitialize }) => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ password: string }>();
  const [isRouteChanging, setIsRouteChanging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { mutateUser } = useUser({
    redirectTo: DASHBOARD_PAGE,
    redirectIfFound: true,
  });

  const routeChangeStart = useCallback(() => {
    setIsRouteChanging(true);
  }, []);

  useEffect(() => {
    router.events.on("routeChangeStart", routeChangeStart);

    return () => {
      router.events.off("routeChangeStart", routeChangeStart);
    };
  }, [router, routeChangeStart]);

  const onSubmit: SubmitHandler<{ password: string }> = async (data) => {
    setError(null);

    try {
      const encrypted = await encryptString(
        JSON.stringify({
          password: data.password,
        }),
      );
      await mutateUser(client.post("/auth/login", encrypted, { headers: { "Content-Type": "text/plain" } }));
    } catch (error_) {
      if (isAxiosError<{ message: string }>(error_)) {
        setError(error_.response?.data.message ?? error_.message);
      } else {
        setError(String(error_));
      }
    }
  };

  useEffect(() => {
    if (isSubmitting) setError(null);
  }, [isSubmitting]);

  return (
    <LayoutSimple title="Sign-in">
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <h2 className="py-8 text-5xl font-primary text-white text-center">Sign In</h2>
        <div className="w-full lg:w-96 mx-auto mb-8">
          <input
            type="password"
            autoFocus
            placeholder="Password"
            className="block px-4 py-3 rounded-full bg-border text-paragraph text-lg w-full border-none focus:ring-primary transition"
            {...register("password", { required: true })}
          />
        </div>
        <div className="w-full lg:w-96 mx-auto mb-8">
          <button type="submit" disabled={isSubmitting || isRouteChanging} className="button w-full">
            Sign In {(isSubmitting || isRouteChanging) && <CircularLoader className="h-6 w-6" color="primary" />}
          </button>
        </div>
        {reinitialize && <div className="w-full lg:w-96 mx-auto bg-border text-secondary p-4 rounded mb-8">Use your SSH password to log into RoninDojo</div>}
      </form>

      <ErrorMessage errors={[error, errors.password?.type === "required" ? "Password is required" : null]} />

      <div className="w-full lg:w-3/5 mx-auto mb-8 mt-5 text-lg text-paragraph text-center">
        Having trouble logging into your RoninDojo?{" "}
        <a href="https://t.me/RoninDojoNode" target="_blank" rel="noreferrer" className="font-bold text-paragraph hover:text-white transition-colors">
          Contact Support
        </a>
      </div>
    </LayoutSimple>
  );
};

type SsrProps = PageProps<{
  reinitialize: boolean;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectAuthorized(ctx);

  if ("redirect" in serverSideProps) {
    return serverSideProps;
  }

  const isDataFileValid = await pipe(
    readDataFile,
    taskEither.match(
      () => false,
      () => true,
    ),
  )();

  return {
    ...serverSideProps,
    props: {
      withLayout: false,
      reinitialize: !isDataFileValid,
    },
  };
});

export default SignIn;
