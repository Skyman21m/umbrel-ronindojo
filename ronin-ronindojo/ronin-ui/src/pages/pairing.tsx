import React, { FC, useState } from "react";
import { NextPage, InferGetServerSidePropsType, GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import dynamic from "next/dynamic";
import router from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import useSWR from "swr";
import semver from "semver";
import { QRCodeCanvas } from "qrcode.react";
import { constFalse, constNull, pipe } from "fp-ts/function";
import { apply, boolean, either, task, taskEither } from "fp-ts";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";

import { PageProps } from "../types";
import { MINUTE } from "../const";
import { getRoninDojoStatus, RoninDojoHealth, RoninDojoStatusResponse } from "./api/v2/ronindojo/status";
import { getIndexerType, Response as IndexerTypeResponse } from "./api/v2/ronindojo/indexer-type";
import { getPairing, Response as PairingResponse } from "./api/v2/dojo/pairing";
import { getIndexerUrl, Response as IndexerUrlResponse } from "./api/v2/ronindojo/indexer-url";
import { getRoninDojoVersion, Response as VersionResponse } from "./api/v2/ronindojo/version";
import { getNetworkInterfaceData, Response as NetworkInterfaceResponse } from "./api/v2/system/network-interface";
import { getContainerInfo, Response as ContainerInfoResponse } from "./api/v2/dojo/containers";
import { withSessionSsr } from "../lib/server/session";
import { redirectUnathorized } from "../lib/server/redirectUnathorized";
import { getRaceTask, getRaceTaskEither } from "../lib/server/raceTaskEither";
import { copyText } from "../lib/client/copyText";
import { pageTransition } from "../animations";
import { useSnackbar } from "../components/SnackbarContext";
import { DojoStatusBoxDisplay } from "../components/DojoStatusBoxDisplay";
import { ReactComponent as DojoIcon } from "../components/icons/dashboard_icons/dojo.svg";
import { ReactComponent as ElectrumIcon } from "../components/icons/dashboard_icons/electrum_server.svg";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

const urlToTcpUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;

  return `tcp://${url}:50001`;
};

type Props = InferGetServerSidePropsType<typeof getServerSideProps>;

const PairingPage: NextPage<Props> = ({
  layoutTitle,
  roninDojoStatus,
  indexerType,
  dojoPairing,
  indexerUrl,
  roninDojoVersion,
  networkInterface,
  containerInfo,
}) => {
  const { callSnackbar } = useSnackbar();
  const [dojoDialogOpen, setDojoDialogOpen] = useState<boolean>(false);
  const [electrumDialogOpen, setElectrumDialogOpen] = useState<boolean>(false);
  const [displayLocalValues, setDisplayLocalValues] = useState<boolean>(false);

  const { data: containerInfoData, mutate: mutateContainerInfo } = useSWR<ContainerInfoResponse | null>("/dojo/containers", {
    refreshInterval: MINUTE,
    fallbackData: containerInfo,
  });

  const { data: roninDojoStatusData } = useSWR<RoninDojoStatusResponse>("/ronindojo/status", {
    refreshInterval: MINUTE,
    fallbackData: { status: roninDojoStatus },
  });
  const { data: indexerTypeData } = useSWR<IndexerTypeResponse>(roninDojoStatus === "OK" && "/ronindojo/indexer-type", {
    fallbackData: indexerType,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const { data: dojoPairingData } = useSWR<PairingResponse | null>(roninDojoStatus === "OK" && "/dojo/pairing", {
    fallbackData: dojoPairing,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const { data: indexerUrlData } = useSWR<IndexerUrlResponse | null>(roninDojoStatus === "OK" && indexerType?.type != null && "/ronindojo/indexer-url", {
    fallbackData: indexerUrl,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const indexerPairingUnavailable = indexerTypeData?.type === "Addrindexrs" || indexerTypeData?.type == null;

  const handleCopy = async (data: string) => {
    if (data) {
      try {
        await copyText(data);
        callSnackbar("Copied to clipboard", "info");
      } catch (error) {
        callSnackbar(String(error), "error");
      }
    }
  };

  return (
    <motion.div className="container" variants={pageTransition} initial="initial" animate="animate" exit="initial">
      <div className="bg-surface box">
        <h1 className="text-primary font-primary mb-6">{layoutTitle}</h1>
        <p className="text-paragraph mb-6">Choose your pairing type</p>
        <div className="relative grid grid-cols-1 lg:grid-cols-3 grid-flow-row-dense gap-6">
          <div className="box bg-black flex flex-col items-center">
            <div className="text-center mb-6 flex-1 w-full">
              <h4 className="text-white text-xl font-bold mb-4">Samourai Dojo</h4>
              <div className="w-20 h-20 mb-6 bg-black border border-primary shadow-primary text-white rounded-full inline-flex items-center justify-center">
                <DojoIcon width={60} height={60} className="fill-current" />
              </div>
              <p className="text-paragraph mb-6">Pair your Samourai Wallet with your Dojo</p>
            </div>
            <div className="text-center w-full">
              <button className="button" onClick={() => setDojoDialogOpen(true)}>
                Pair now
              </button>
            </div>
          </div>
          <div className="box bg-black flex flex-col items-center">
            <div className="text-center mb-6 flex-1 w-full">
              <h4 className="text-white text-xl font-bold mb-4">Electrum server</h4>
              <div className="w-20 h-20 mb-6 bg-black border border-primary shadow-primary text-white rounded-full inline-flex items-center justify-center">
                <ElectrumIcon width={60} height={60} className="fill-current" />
              </div>
              {indexerTypeData?.type == null && <p className="text-primary mb-6">Couldn't determine indexer type. Please try again later.</p>}
              {indexerTypeData?.type === "Addrindexrs" && (
                <p className="text-primary mb-6">
                  Pairing is not possible with addrindexrs. Please switch to Electrs or Fulcrum to enable electrum server capabilities.
                </p>
              )}
              {(indexerTypeData?.type === "Electrs" || indexerTypeData?.type === "Fulcrum") && (
                <p className="text-paragraph mb-6">Pair a wallet with electrum protocol capabilities with your electrum server</p>
              )}
            </div>
            <div className="text-center w-full">
              <button className="button" onClick={() => setElectrumDialogOpen(true)} disabled={indexerPairingUnavailable}>
                {indexerPairingUnavailable ? "Not available" : "Pair now"}
              </button>
            </div>
          </div>
          <DojoStatusBoxDisplay roninDojoStatus={roninDojoStatusData?.status ?? "OK"} />
        </div>
      </div>

      <DojoPairingDialog dojoDialogOpen={dojoDialogOpen} setDojoDialogOpen={setDojoDialogOpen} dojoPairingData={dojoPairingData} />

      <Dialog open={electrumDialogOpen} onClose={() => setElectrumDialogOpen(false)} title="Pair to Electrum server" className="max-w-3xl">
        <div className="relative w-full md:w-4/5 xl:w-3/5 aspect-square mb-6 mt-4 bg-border rounded-xl p-4 sm:p-8 mx-auto transition-all">
          <QRCodeCanvas
            className="max-w-full max-h-full rounded-xl"
            size={800}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="H"
            includeMargin
            value={urlToTcpUrl(indexerUrlData?.url) ?? ""}
          />
          <div className="absolute top-1/2 left-1/2 z-10 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary p-4 border-4 border-white hidden sm:block">
            <ElectrumIcon className="w-20 h-20 lg:w-16 lg:h-16 text-white fill-current" />
          </div>
        </div>

        {indexerTypeData?.type && networkInterface && roninDojoVersion?.version && semver.gte(roninDojoVersion.version, "2.0.1") && (
          <div className="border-t border-border py-4">
            <div className="cursor-pointer inline-flex items-center" onClick={() => setDisplayLocalValues((state) => !state)}>
              <div className="text-white">Use Tor</div>
              <div
                className={clsx([
                  "mx-3 p-0.5 border w-14 h-7.5 transition-colors flex items-center rounded-full bg-black border-primary",
                  displayLocalValues && "justify-end ",
                ])}
              >
                <motion.div className="h-6 w-6 rounded-full bg-white" transition={{ duration: 0.2 }} layout />
              </div>
              <div className="text-white">Use local network</div>
            </div>
          </div>
        )}

        <div className="relative p-1">
          <div className="w-full mb-6">
            <label className="block px-3 pb-1 text-sm text-paragraph">Hostname</label>
            <div className="relative">
              <input type="text" className="input-text pr-12" value={displayLocalValues ? networkInterface?.ip4 ?? "" : indexerUrlData?.url ?? ""} readOnly />
              <DocumentDuplicateIcon
                onClick={() => handleCopy(displayLocalValues ? networkInterface?.ip4 ?? "" : indexerUrlData?.url ?? "")}
                className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
              />
            </div>
          </div>

          <div className="w-full">
            <label className="block px-3 pb-1 text-sm text-paragraph">
              Port {displayLocalValues ? <span className="inline-block px-1 rounded text-xs bg-border">SSL</span> : ""}
            </label>
            <div className="relative">
              <input type="text" className="input-text pr-12" value={displayLocalValues ? "50002" : "50001"} readOnly />
              <DocumentDuplicateIcon
                onClick={() => handleCopy(displayLocalValues ? "50002" : "50001")}
                className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {displayLocalValues && indexerTypeData?.type !== "Fulcrum" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="absolute top-0 bottom-0 left-0 right-0 w-full flex items-center justify-center backdrop-blur-sm"
              >
                <h3 className="font-primary text-white text-xl text-center">
                  Switch your indexer to Fulcrum to be able to connect to your Electrum server via local network
                </h3>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Dialog>
    </motion.div>
  );
};

interface DojoPairingDialogProps {
  dojoDialogOpen: boolean;
  setDojoDialogOpen: (val: boolean) => void;
  dojoPairingData: PairingResponse | null | undefined;
}

const DojoPairingDialog: FC<DojoPairingDialogProps> = ({ dojoDialogOpen, setDojoDialogOpen, dojoPairingData }) => {
  const { callSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState<"QR" | "JSON">("QR");

  const handleCopy = async (data: string) => {
    if (data) {
      try {
        await copyText(data);
        callSnackbar("Copied to clipboard", "info");
      } catch (error) {
        callSnackbar(String(error), "error");
      }
    }
  };

  const onClose = () => {
    setActiveTab("QR");
    setDojoDialogOpen(false);
  };

  return (
    <Dialog open={dojoDialogOpen} onClose={onClose} title="Pair to Dojo" className="max-w-3xl">
      <div className="flex justify-center mt-2 mb-4">
        <div className="inline-block">
          <a
            className={clsx([
              "cursor-pointer text-center block transition-colors font-primary hover:text-white hover:drop-shadow-menuItem text-xl mx-4 capitalize whitespace-nowrap",
              activeTab === "QR" ? "text-white" : "text-menuText",
              activeTab === "QR" && "drop-shadow-menuItem",
            ])}
            onClick={() => setActiveTab("QR")}
          >
            QR Code
          </a>
          {activeTab === "QR" && <motion.div className="mx-4 border-b-2 border-primary" layoutId="underline"></motion.div>}
        </div>
        <div className="inline-block">
          <a
            className={clsx([
              "cursor-pointer text-center block transition-colors font-primary hover:text-white hover:drop-shadow-menuItem text-xl mx-4 capitalize whitespace-nowrap",
              activeTab === "JSON" ? "text-white" : "text-menuText",
              activeTab === "JSON" && "drop-shadow-menuItem",
            ])}
            onClick={() => setActiveTab("JSON")}
          >
            JSON
          </a>
          {activeTab === "JSON" && <motion.div className="mx-4 border-b-2 border-primary" layoutId="underline"></motion.div>}
        </div>
      </div>
      <div className="relative">
        <motion.div variants={{ active: { opacity: 1 }, inactive: { opacity: 0 } }} animate={activeTab === "QR" ? "active" : "inactive"}>
          <div className="relative w-full md:w-4/5 xl:w-3/5 aspect-square mb-6 mt-4 bg-border rounded-xl p-4 sm:p-8 mx-auto transition-all">
            <QRCodeCanvas
              className="max-w-full max-h-full rounded-xl"
              size={800}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
              includeMargin
              value={JSON.stringify(dojoPairingData ?? {})}
            />
            <div className="absolute top-1/2 left-1/2 z-10 transform -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary p-4 border-4 border-white hidden sm:block">
              <DojoIcon className="w-20 h-20 lg:w-16 lg:h-16 text-white fill-current" />
            </div>
          </div>
        </motion.div>
        <motion.div
          variants={{ active: { opacity: 1 }, inactive: { opacity: 0 } }}
          animate={activeTab === "JSON" ? "active" : "inactive"}
          className="absolute top-1/2 -translate-y-1/2 w-full mb-4"
        >
          <textarea
            value={JSON.stringify(dojoPairingData ?? {}, null, 2)}
            className="border border-none bg-border rounded p-2 font-mono text-secondary text-sm resize-none w-full h-64"
            readOnly
            disabled
          />
          <DocumentDuplicateIcon
            onClick={() => handleCopy(JSON.stringify(dojoPairingData))}
            className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
          />
        </motion.div>
      </div>
      <div className="w-full mb-6">
        <label htmlFor="dojoUrl" className="block px-3 pb-1 text-sm text-paragraph">
          Dojo Pairing - URL
        </label>
        <div className="relative">
          <input id="dojoUrl" type="text" className="input-text pr-12" value={dojoPairingData?.pairing.url} readOnly />
          <DocumentDuplicateIcon
            onClick={() => handleCopy(dojoPairingData?.pairing.url ?? "")}
            className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
          />
        </div>
      </div>

      <div className="w-full mb-6">
        <label htmlFor="dojoApiKey" className="block px-3 pb-1 text-sm text-paragraph">
          Dojo Pairing - API Key
        </label>
        <div className="relative">
          <input id="dojoApiKey" type="text" className="input-text pr-12" value={dojoPairingData?.pairing.apikey} readOnly />
          <DocumentDuplicateIcon
            onClick={() => handleCopy(dojoPairingData?.pairing.apikey ?? "")}
            className="absolute top-2 right-2 h-6 w-6 ml-6 text-secondary cursor-pointer hover:text-secondary-alpha transition-colors"
          />
        </div>
      </div>
    </Dialog>
  );
};

type SsrProps = PageProps<{
  withLayout: true; // necessary workaround
  roninDojoStatus: RoninDojoHealth;
  indexerType: IndexerTypeResponse;
  dojoPairing: PairingResponse | null;
  indexerUrl: IndexerUrlResponse | null;
  roninDojoVersion: VersionResponse | null;
  networkInterface: NetworkInterfaceResponse | null;
  containerInfo: ContainerInfoResponse | null;
}>;

export const getServerSideProps = withSessionSsr<SsrProps>(async (ctx: GetServerSidePropsContext) => {
  const serverSideProps = await redirectUnathorized(ctx);

  if ("redirect" in serverSideProps) return serverSideProps;

  const containerInfo = await getContainerInfo();

  const [roninDojoStatus, indexerType, dojoPairing, indexerUrl, roninDojoVersion, networkInterface] = await apply.sequenceT(task.ApplyPar)(
    getRoninDojoStatus,
    getIndexerType,
    pipe(
      getRaceTaskEither(getPairing),
      taskEither.getOrElseW(() => task.fromIO(constNull)),
    ),
    getRaceTask(getIndexerUrl),
    pipe(
      getRaceTaskEither(getRoninDojoVersion),
      taskEither.getOrElseW(() => task.fromIO(constNull)),
    ),
    pipe(
      getRaceTaskEither(getNetworkInterfaceData),
      taskEither.getOrElseW(() => task.fromIO(constNull)),
    ),
  )();

  return {
    ...serverSideProps,
    props: {
      withLayout: true,
      layoutTitle: "Pairing",
      roninDojoStatus,
      indexerType,
      dojoPairing,
      indexerUrl,
      roninDojoVersion,
      networkInterface,
      containerInfo: pipe(containerInfo, either.getOrElseW(constNull)),
    },
  } satisfies GetServerSidePropsResult<SsrProps>;
});

export default PairingPage;
