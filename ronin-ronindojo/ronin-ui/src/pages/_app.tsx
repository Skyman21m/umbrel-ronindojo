import React from "react";
import { AppProps } from "next/app";
import Head from "next/head";
import dynamic from "next/dynamic";
import { SWRConfig } from "swr";
import { AnimatePresence } from "framer-motion";

import "typeface-hammersmith-one";
import "typeface-pt-mono";
import "../styles.css";

import { fetcher } from "../apiClient";
import { SnackbarContextProvider } from "../components/SnackbarContext";
import { Layout } from "../components/Layout";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { PageProps } from "../types";
import { DojoUpgradeDialogLoader } from "../components/DojoUpgradeDialogLoader";
import { RoninDojoUpgradeDialogLoader } from "../components/RoninDojoUpgradeDialogLoader";

const PageProgress = dynamic(() => import("../components/PageProgress"), { ssr: false });

export default function MyApp(props: AppProps<PageProps>) {
  const { Component, pageProps, router } = props;

  return (
    <React.Fragment>
      <Head>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <title>RoninDojo</title>
      </Head>
      <PageProgress />
      <SWRConfig value={{ fetcher }}>
        <SnackbarContextProvider>
          {pageProps.withLayout ? (
            <Layout title={pageProps.layoutTitle}>
              <ErrorBoundary>
                <AnimatePresence mode="wait">
                  <Component {...pageProps} key={router.route} />
                </AnimatePresence>
                <DojoUpgradeDialogLoader />
                <RoninDojoUpgradeDialogLoader />
              </ErrorBoundary>
            </Layout>
          ) : (
            <ErrorBoundary>
              <Component {...pageProps} />
            </ErrorBoundary>
          )}
        </SnackbarContextProvider>
      </SWRConfig>
    </React.Fragment>
  );
}
