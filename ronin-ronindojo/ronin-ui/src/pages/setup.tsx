import React, { useEffect, useState } from "react";
import { GetServerSideProps, InferGetServerSidePropsType, NextPage } from "next";
import { useRouter } from "next/router";
import clsx from "clsx";
import { isAxiosError } from "axios";
import { SubmitHandler, useForm } from "react-hook-form";
import { motion, AnimatePresence, Variants, Transition } from "framer-motion";
import { taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";
import { DocumentDuplicateIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

import { dataFileExists, writeDataFile } from "../lib/server/dataFile";
import { client } from "../apiClient";
import { useUser } from "../lib/client";
import { copyText } from "../lib/client/copyText";
import { DASHBOARD_PAGE, INSTALL_PROGRESS } from "../routes";
import { ErrorMessage } from "../components/ErrorMessage";
import { getRoninDojoCredentials, InfoFile, isPnPUser } from "../lib/server/roninDojoCredentials";
import { LayoutSimple } from "../components/LayoutSimple";
import { useSnackbar } from "../components/SnackbarContext";
import { ErrorResponse } from "../lib/server/errorResponse";
import { PageProps } from "../types";
import { encryptString } from "../lib/client/encryptString";

const setupVarians: Variants = {
  enter: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const setupTransition: Transition = {
  opacity: { duration: 0.2 },
};

interface FormData {
  newPassword: string;
  repeatPassword: string;
}

const enum Steps {
  Welcome,
  RootPassword,
  UserPassword,
}

const Setup: NextPage<InferGetServerSidePropsType<typeof getServerSideProps>> = ({ credentials }) => {
  const router = useRouter();
  const { callSnackbar } = useSnackbar();
  const [step, setStep] = useState<Steps>(Steps.Welcome);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState<boolean>(false);
  const [rootCredentialsBackedUp, setRootCredentialsBackedUp] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { mutateUser } = useUser({
    redirectTo: DASHBOARD_PAGE,
    redirectIfFound: true,
  });

  const rootCredentials = credentials.user.find((user) => user.name === "root");
  const userCredentials = credentials.user.find((user) => user.name === "ronindojo");

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    reValidateMode: "onSubmit",
  });

  const handleCopy = async (data: string) => {
    try {
      await copyText(data);
      callSnackbar("Copied to clipboard", "info");
    } catch (error_) {
      callSnackbar(String(error_), "error");
    }
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const encrypted = await encryptString(
        JSON.stringify({
          oldPassword: userCredentials?.password,
          newPassword: data.newPassword,
          repeatPassword: data.repeatPassword,
        }),
      );
      await mutateUser(client.post("/auth/set-password", encrypted, { headers: { "Content-Type": "text/plain" } }));

      router.push(INSTALL_PROGRESS);
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
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
    <LayoutSimple title="Setup">
      <h2 className="py-8 text-5xl font-primary text-white text-center">Setup</h2>
      <div className="w-full flex items-center justify-center">
        <AnimatePresence initial={false} mode="wait">
          {step === Steps.Welcome && (
            <motion.div
              className="w-full"
              key={Steps.Welcome}
              variants={setupVarians}
              transition={setupTransition}
              initial="enter"
              animate="animate"
              exit="exit"
            >
              <div className="w-full md:w-4/5 mx-auto box bg-surface">
                <h2 className="font-primary text-white text-3xl mb-2">Welcome to RoninDojo</h2>
                <p className="text-paragraph text-lg mb-5">
                  Your RoninDojo is being set up right now.
                  <br />
                  There are several steps to complete in order to access your RoninDojo.
                </p>

                <ul className="list-disc text-white list-inside text-lg mb-5">
                  <li>Backup your root password</li>
                  <li>Set up your user password</li>
                </ul>

                <div className="text-right">
                  <a
                    onClick={() => setStep(Steps.RootPassword)}
                    className="font-primary text-white text-xl cursor-pointer hover:text-secondary transition-colors"
                  >
                    Let's start
                  </a>
                </div>
              </div>
            </motion.div>
          )}
          {step === Steps.RootPassword && (
            <motion.div
              className="w-full"
              key={Steps.RootPassword}
              variants={setupVarians}
              transition={setupTransition}
              initial="enter"
              animate="animate"
              exit="exit"
            >
              <div className="w-full md:w-4/5 mx-auto box bg-surface">
                <h2 className="font-primary text-white text-3xl mb-2">Root credentials</h2>
                <p className="text-paragraph text-lg mb-5">These are your Root user credentials, be sure to backup them and store in a safe place.</p>

                <div className="mb-5">
                  <div className="flex justify-center items-center flex-col lg:flex-row text-white mb-2">
                    <div className="font-mono mr-2 w-full lg:w-1/3">username:</div>
                    <div className="w-full relative">
                      <input
                        className="w-full bg-surface border-border border text-paragraph font-mono rounded"
                        type="text"
                        defaultValue={rootCredentials?.name}
                        disabled
                      />
                      <DocumentDuplicateIcon
                        onClick={() => handleCopy(rootCredentials?.name ?? "")}
                        className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center items-center flex-col lg:flex-row text-white mb-2">
                    <div className="font-mono mr-2 w-full lg:w-1/3">password:</div>
                    <div className="w-full relative">
                      <input
                        className="w-full bg-surface border-border border text-paragraph font-mono rounded"
                        type="text"
                        defaultValue={rootCredentials?.password}
                        disabled
                      />
                      <DocumentDuplicateIcon
                        onClick={() => handleCopy(rootCredentials?.password ?? "")}
                        className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center items-center mb-5">
                  <input
                    className="mr-2 cursor-pointer"
                    id="rootCredentialsBackedUp"
                    type="checkbox"
                    checked={rootCredentialsBackedUp}
                    onChange={() => setRootCredentialsBackedUp((prevState) => !prevState)}
                  />
                  <label className="text-white cursor-pointer" htmlFor="rootCredentialsBackedUp">
                    I have backed up Root user credentials
                  </label>
                </div>

                <div className="text-right">
                  <a
                    onClick={() => (rootCredentialsBackedUp ? setStep(Steps.UserPassword) : () => {})}
                    className={clsx([
                      "font-primary text-xl cursor-pointer transition-colors",
                      rootCredentialsBackedUp ? "text-white hover:text-secondary " : "text-paragraph cursor-not-allowed",
                    ])}
                  >
                    Continue
                  </a>
                </div>
              </div>
            </motion.div>
          )}
          {step === Steps.UserPassword && (
            <motion.form
              className="w-full"
              key={Steps.UserPassword}
              onSubmit={handleSubmit(onSubmit)}
              variants={setupVarians}
              transition={setupTransition}
              initial="enter"
              animate="animate"
              exit="exit"
              autoComplete="off"
            >
              <div className="w-full md:w-4/5 mx-auto box bg-surface">
                <h2 className="font-primary text-white text-3xl mb-2">User credentials</h2>
                <p className="text-paragraph text-lg mb-5">
                  Setup your RoninDojo user password.
                  <br />
                  This password will be used to access your RoninDojo via browser and SSH, be sure back it up properly.
                </p>

                <div className="flex justify-center items-center flex-col lg:flex-row text-white mb-2">
                  <div className="font-mono mr-2 w-full lg:w-1/3">username:</div>
                  <div className="w-full relative">
                    <input
                      type="text"
                      className="w-full bg-surface border-border border text-paragraph font-mono rounded"
                      defaultValue={userCredentials?.name ?? ""}
                      disabled
                    />
                    <DocumentDuplicateIcon
                      onClick={() => handleCopy(userCredentials?.name ?? "")}
                      className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                    />
                  </div>
                </div>
                <div className="flex justify-center items-center flex-col lg:flex-row text-white mb-2">
                  <div className="font-mono mr-2 w-full lg:w-1/3">password:</div>
                  <div className="w-full relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password - Minimum 8 characters"
                      className="w-full bg-border border-none text-paragraph font-mono rounded"
                      {...register("newPassword", {
                        required: true,
                        minLength: 8,
                        validate: { characters: (val) => /^\w*$/g.test(val) },
                      })}
                    />
                    {showPassword ? (
                      <EyeSlashIcon
                        onClick={() => setShowPassword(false)}
                        className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                      />
                    ) : (
                      <EyeIcon
                        onClick={() => setShowPassword(true)}
                        className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                      />
                    )}
                  </div>
                </div>
                <div className="flex justify-center items-center flex-col lg:flex-row text-white mb-5">
                  <div className="font-mono mr-2 w-full lg:w-1/3">repeat password:</div>
                  <div className="w-full relative">
                    <input
                      type={showPasswordRepeat ? "text" : "password"}
                      placeholder="Repeat password"
                      className="w-full bg-border border-none text-paragraph font-mono rounded"
                      {...register("repeatPassword", {
                        required: true,
                        minLength: 8,
                        validate: { samePassword: (val) => getValues().newPassword === val },
                      })}
                    />
                    {showPasswordRepeat ? (
                      <EyeSlashIcon
                        onClick={() => setShowPasswordRepeat(false)}
                        className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                      />
                    ) : (
                      <EyeIcon
                        onClick={() => setShowPasswordRepeat(true)}
                        className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-white transition-colors"
                      />
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <button type="submit" className="font-primary text-xl cursor-pointer transition-colors text-white hover:text-secondary">
                    Finish
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <ErrorMessage
        className="mt-5"
        errors={[
          error,
          errors.newPassword?.type === "required" ? "Password is required" : null,
          errors.newPassword?.type === "minLength" ? "Password needs to be at least 8 characters long" : null,
          errors.newPassword?.type === "characters" ? "Password must contain only letters and digits" : null,
          errors.repeatPassword?.type === "required" ? "Password confirmation is required" : null,
          errors.repeatPassword?.type === "minLength" ? "Password confirmation needs to be at least 8 characters long" : null,
          errors.repeatPassword?.type === "samePassword" ? "Passwords do not match" : null,
        ]}
      />

      <div className="w-full lg:w-3/5 mx-auto mb-8 mt-5 text-lg text-paragraph text-center">
        Having trouble setting up your RoninDojo?{" "}
        <a href="https://t.me/RoninDojoNode" target="_blank" rel="noreferrer" className="font-bold text-paragraph hover:text-white transition-colors">
          Contact Support
        </a>
      </div>
    </LayoutSimple>
  );
};

type SsrProps = PageProps<{
  credentials: InfoFile;
}>;

export const getServerSideProps: GetServerSideProps<SsrProps> = async () => {
  const dataFile = await dataFileExists();

  if (dataFile) {
    return {
      redirect: {
        permanent: false,
        destination: "/",
      },
    };
  }

  const isPnP = await isPnPUser();

  if (!isPnP) {
    await writeDataFile({ initialized: true })();

    return {
      redirect: {
        permanent: false,
        destination: "/sign-in",
      },
    };
  }

  const credentials = await pipe(
    getRoninDojoCredentials,
    taskEither.getOrElse((err) => {
      throw err;
    }),
  )();

  return {
    props: {
      withLayout: false,
      credentials,
    },
  };
};

export default Setup;
