import React, { FC, Fragment, SyntheticEvent, useCallback, useState, useEffect, PropsWithChildren } from "react";
import Head from "next/head";
import Image from "next/legacy/image";
import Router from "next/router";
import dynamic from "next/dynamic";
import clsx from "clsx";
import useSWR, { useSWRConfig } from "swr";
import { isAxiosError } from "axios";
import { motion } from "framer-motion";
import {
  ArrowPathIcon,
  BookmarkIcon,
  BookmarkSquareIcon,
  ArrowsRightLeftIcon,
  QrCodeIcon,
  ExclamationTriangleIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";
import semver from "semver";

import { ReactComponent as DashboardIcon } from "../components/icons/nav_icons/dashboard_tab.svg";
import { ReactComponent as LogsIcon } from "../components/icons/nav_icons/logs_tab.svg";
import { ReactComponent as PushtxIcon } from "../components/icons/nav_icons/push_tx_tab.svg";
import { ReactComponent as SettingsIcon } from "../components/icons/nav_icons/settings_tab.svg";
import { ReactComponent as SystemIcon } from "../components/icons/nav_icons/systems_tab.svg";
import { ReactComponent as MaintenanceIcon } from "../components/icons/nav_icons/maintenace_tab.svg";
import { ReactComponent as SignoutIcon } from "../components/icons/nav_icons/signout_tab.svg";
import { ReactComponent as CloseIcon } from "../components/icons/general_icons/close.svg";
import { ReactComponent as MenuIcon } from "../components/icons/general_icons/hamburger_nav.svg";
import { ReactComponent as BoltzmannIcon } from "../components/icons/dashboard_icons/boltzmann.svg";

import packageJson from "../../package.json";
import * as routes from "../routes";
import { MenuItem } from "./MenuItem";
import { DropDownMenuItem } from "./DropDownMenuItem";
import { LinearLoader } from "./LinearLoader";
import { useUser } from "../lib/client";
import { client } from "../apiClient";
import { SIGNIN_PAGE } from "../routes";
import { Response as VersionResponse } from "../pages/api/v2/version";

const Dialog = dynamic(() => import("../components/Dialog"), { ssr: false });

import mainImage from "../../public/background.jpg";
import { MINUTE, SECOND } from "../const";
import { ErrorResponse } from "../lib/server/errorResponse";
import { delay } from "../lib/common";
import { encryptString } from "../lib/client/encryptString";
import { CircularLoader } from "./CircularLoader";
import { ErrorMessage } from "./ErrorMessage";

const { version } = packageJson;

const debounce = (func: () => void, timeout = 300) => {
  let timer: NodeJS.Timeout | undefined;
  return (...args: any) => {
    if (timer) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
      }, timeout);
    } else {
      func.apply(this, args);
    }
  };
};

interface Props {
  readonly title: string;
}

const dojoMaintenanceItems = [
  {
    path: routes.XPUB_PAGE,
    icon: <BookmarkSquareIcon className="w-6 h-6" />,
    title: "XPUB Tool",
  },
  {
    path: routes.TRANSACTION_PAGE,
    icon: <ArrowsRightLeftIcon className="w-6 h-6" />,
    title: "Transaction Tool",
  },
  {
    path: routes.ADDRESS_PAGE,
    icon: <BookmarkIcon className="w-6 h-6" />,
    title: "Address Tool",
  },
  {
    path: routes.RESCAN_PAGE,
    icon: <ArrowPathIcon className="w-6 h-6" />,
    title: "Rescan Blocks",
  },
];

const toolsItems = [
  {
    path: routes.PUSHTX_PAGE,
    icon: <PushtxIcon className="fill-current w-6 h-6" />,
    title: "Push TX",
  },
  {
    path: routes.BOLTZMANN_PAGE,
    icon: <BoltzmannIcon className="fill-current w-6 h-6" />,
    title: "Boltzmann",
  },
];

const socialUrls = {
  twitter: "https://twitter.com/ronindojoUI",
  telegram: "https://t.me/RoninDojoNode",
  gitlab: "https://code.samourai.io/ronindojo",
  wiki: "https://wiki.ronindojo.io/",
};

const menuAnimationVariants = {
  closed: {},
  open: {
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.2,
    },
  },
};

type UpdateState = "none" | "started" | "success" | "error";

export const Layout: FC<PropsWithChildren<Props>> = ({ title, children }) => {
  const { user, mutateUser } = useUser({ redirectTo: SIGNIN_PAGE });
  const [blur, setBlur] = useState(true);
  const [updateState, setUpdateState] = useState<UpdateState>("none");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [roninDojoUpdateDialogOpen, setRoninDojoUpdateDialogOpen] = useState<boolean>(false);
  const { data: versionData } = useSWR<VersionResponse>("/version", {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const handleCloseMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // Listen for events that change route/page layout and close menu
  useEffect(() => {
    const debounceCloseMenu = debounce(handleCloseMenu);

    window.addEventListener("resize", debounceCloseMenu);
    Router.events.on("routeChangeStart", handleCloseMenu);

    return () => {
      window.removeEventListener("resize", debounceCloseMenu);
      Router.events.off("routeChangeStart", handleCloseMenu);
    };
  }, [handleCloseMenu]);

  const handleLogout = useCallback(
    async (event: SyntheticEvent) => {
      event.preventDefault();
      await mutateUser(client.post("/auth/logout"));
    },
    [mutateUser],
  );

  const handleUiUpdate = useCallback(async (event: SyntheticEvent) => {
    event.preventDefault();
    setUpdateState("started");

    try {
      await client.post("/update-ronin-ui", undefined, { timeout: 30 * MINUTE });
      await delay(10 * SECOND);
      setUpdateState("success");
    } catch (error) {
      setUpdateState("error");
      if (isAxiosError<ErrorResponse>(error)) {
        setUpdateError(error.response?.data.message ?? error.message);
      } else {
        setUpdateError(String(error));
      }
    }
  }, []);

  return (
    <Fragment>
      <Head>
        <title>{`${title} - RoninDojo`}</title>
      </Head>

      <div className="grid grid-areas-layout-slim xl:grid-areas-layout-wide grid-cols-layout-slim xl:grid-cols-layout-wide grid-rows-layout-slim xl:grid-rows-layout-wide h-full">
        <motion.aside
          className="bg-surface fixed xl:static top-0 bottom-0 right-full max-h-full w-[20rem] xl:w-auto overflow-y-auto shadow-2xl xl:shadow-none z-10 flex flex-col xl:grid-in-sidebar"
          variants={{ closed: { x: "0%", transition: { duration: 0.3 } }, open: { x: "100%", transition: { duration: 0.3 } } }}
          initial={false}
          animate={menuOpen ? "open" : "closed"}
        >
          <div className="flex flex-shrink-0 items-center justify-center p-1 bg-black h-20">
            <div className="flex items-center">
              <img src="/logo/RoninDojo-01f.svg" width={50} height={50} alt="" className="w-12 mr-1" />
              <h4 className="text-4xl font-primary text-white">RoninDojo</h4>
            </div>
            <CloseIcon
              className="xl:hidden cursor-pointer text-secondary hover:text-white fill-current transition-colors w-10 h-10 ml-3"
              onClick={() => setMenuOpen(false)}
            />
          </div>
          <nav className="flex-1">
            <motion.ul className="w-full" initial="closed" animate="open" variants={menuAnimationVariants}>
              <MenuItem path={routes.DASHBOARD_PAGE} icon={<DashboardIcon className="fill-current w-6 h-6" />} title="Dashboard" />
              <MenuItem path={routes.LOGS_PAGE} icon={<LogsIcon className="fill-current w-6 h-6" />} title="Logs" />
              <DropDownMenuItem icon={<AdjustmentsHorizontalIcon className="w-6 h-6" />} title="Maintenance" items={dojoMaintenanceItems} />
              <DropDownMenuItem icon={<MaintenanceIcon className="fill-current w-6 h-6" />} title="Tools" items={toolsItems} />
              <MenuItem path={routes.PAIRING} icon={<QrCodeIcon className="w-6 h-6" />} title="Pairing" />
              <MenuItem path={routes.SYSINFO_PAGE} icon={<SystemIcon className="fill-current w-6 h-6" />} title="System Info" />
              <MenuItem path={routes.SETTINGS_PAGE} icon={<SettingsIcon className="fill-current w-6 h-6" />} title="Settings" />
              <MenuItem path={routes.TROUBLESHOOTING} icon={<ExclamationTriangleIcon className="w-6 h-6" />} title="Troubleshooting" />
            </motion.ul>
          </nav>
          <div className="my-7 px-4">
            {user?.isLoggedIn && (
              <a
                href="#"
                onClick={handleLogout}
                className="flex items-center p-2 font-primary text-lg transition-colors text-menuText hover:text-white hover:drop-shadow-menuItem ease-linear"
              >
                <span className="mr-5 ml-2">
                  <SignoutIcon className="fill-current w-6 h-6" />
                </span>
                <span>Sign out</span>
              </a>
            )}
          </div>
        </motion.aside>
        <header className="grid-in-header bg-black pl-4 pr-4 border-b border-border border-l flex items-center justify-between relative">
          <MenuIcon
            className="xl:hidden cursor-pointer text-lightGrey hover:text-white fill-current transition-colors w-10 h-10"
            onClick={() => setMenuOpen(true)}
          />
          <img src="/logo/RoninDojo-01f.svg" width={50} height={50} alt="" className="w-12 mr-1 xl:hidden" />
          <div className="w-10 xl:hidden" />
        </header>
        <main className="grid-in-main overflow-x-hidden overflow-y-auto">
          <div className="fixed left-0 xl:left-[20rem] top-20 bottom-12 right-0 -z-10">
            <Image
              alt=""
              src={mainImage}
              quality={90}
              layout="fill"
              objectFit="cover"
              objectPosition="center"
              placeholder="blur"
              onLoadingComplete={() => setBlur(false)}
              className={clsx(["filter transition duration-500", blur && "blur-2xl"])}
            />
          </div>
          {versionData?.roninDojo?.needsUpdate && (
            <div className="bg-surface p-3 border-b border-border text-paragraph font-primary relative">
              <strong className="text-white">New version of RoninDojo is available.</strong> Current version is {versionData.roninDojo.currentVersion}.{" "}
              <a onClick={() => setRoninDojoUpdateDialogOpen(true)} className="text-secondary underline hover:text-primary transition-colors cursor-pointer">
                Click here to update to {versionData.roninDojo.remoteVersion}
              </a>
              .
            </div>
          )}
          {versionData && versionData.roninUi.needsUpdate && (
            <div className="bg-surface p-3 border-b border-border text-paragraph font-primary relative">
              <strong className="text-white">New version of RoninUI is available.</strong> Current version is {versionData.roninUi.currentVersion}.{" "}
              {versionData.roninUi.changelogUrl && (
                <a
                  href={versionData.roninUi.changelogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary underline hover:text-primary transition-colors"
                >
                  Check the changelog
                </a>
              )}{" "}
              or{" "}
              <a href="#" onClick={handleUiUpdate} className="text-secondary underline hover:text-primary transition-colors">
                Click here to update to {versionData.roninUi.remoteVersion}
              </a>
              .
            </div>
          )}
          <div className="px-4 py-8">{children}</div>
        </main>
        <footer className="grid-in-footer flex items-center justify-between pl-4 pr-4 bg-black border-t border-border">
          <div className="text-left text-primary font-primary text-sm">RoninDojo v{versionData?.roninDojo.currentVersion ?? ""}</div>
          <div className="text-right text-primary font-primary text-sm">Ronin UI v{version}</div>
        </footer>
      </div>
      <Dialog title="Updating Ronin UI" open={updateState !== "none"} className="max-w-3xl">
        {updateState === "started" && (
          <div>
            <div className="text-paragraph mb-4">Updating Ronin UI. This can take a few minutes...</div>
            <LinearLoader />
          </div>
        )}
        {updateState === "error" && (
          <div className="text-paragraph">
            <div className="mb-2">Error has been encountered during update.</div>
            <div className="p-2 border border-border mb-2 text-primary font-mono">{updateError}</div>
            <div>
              <a
                className="cursor-pointer text-secondary hover:text-primary transition-colors"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Reload this page
              </a>{" "}
              and try again.
            </div>
          </div>
        )}
        {updateState === "success" && (
          <div className="text-paragraph">
            Update has been successful.{" "}
            <a
              className="cursor-pointer text-secondary hover:text-primary transition-colors"
              onClick={() => {
                window.location.reload();
              }}
            >
              Reload this page
            </a>{" "}
            to see the new changes.
          </div>
        )}
      </Dialog>
      <RoninDojoUpgradeDialog open={roninDojoUpdateDialogOpen} onClose={() => setRoninDojoUpdateDialogOpen(false)} versionData={versionData} />
    </Fragment>
  );
};

type RoninDojoUpgradeDialogProps = {
  open: boolean;
  onClose: () => void;
  versionData: VersionResponse | undefined;
};

const RoninDojoUpgradeDialog: FC<RoninDojoUpgradeDialogProps> = ({ open, onClose, versionData }) => {
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = React.createRef<HTMLInputElement>();

  const handleClose = () => {
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const password = inputRef.current?.value ?? "";

    if (password.length === 0) {
      return setError("Password is required");
    }

    setLoading(true);

    try {
      const data = await encryptString(
        JSON.stringify({
          password,
        }),
      );
      await client.post("/auth/login", data, { headers: { "Content-Type": "text/plain" } });

      const encryptedPassword = await encryptString(password);

      client.post("/ronindojo/upgrade", { password: encryptedPassword });

      await delay(2 * SECOND);
      await mutate("/ronindojo/upgrade/status");
      handleClose();
    } catch (error_) {
      if (isAxiosError<ErrorResponse>(error_)) {
        return setError(error_.response?.data.message ?? error_.message);
      }
      return setError(String(error_));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      title="Upgrade RoninDojo"
      open={open}
      onClose={handleClose}
      className="max-w-3xl"
      actions={
        versionData && semver.gte(versionData.roninDojo.currentVersion, "2.0.0") ? (
          <button className="button" type="submit" form="ronindojo-upgrade-form" disabled={loading}>
            Upgrade RoninDojo {loading && <CircularLoader className="h-6 w-6" color="primary" />}
          </button>
        ) : undefined
      }
    >
      {versionData ? (
        semver.lt(versionData.roninDojo.currentVersion, "2.0.0") ? (
          <div>
            <p className="text-lightGrey mb-6">
              Your current version is {versionData.roninDojo.currentVersion}. RoninDojo will not be able to update to new version without reflashing.
            </p>
            <p className="text-lightGrey mb-6">
              Please{" "}
              <a
                className="text-secondary hover:text-primary transition-colors"
                href="https://wiki.ronindojo.io/en/setup/v2_0_0-upgrade"
                target="_blank"
                rel="noreferrer"
              >
                follow our guide
              </a>{" "}
              on how to flash the system with the latest image and re-pair your wallet with Dojo.
            </p>
          </div>
        ) : (
          <>
            <p className="text-lightGrey text-lg mb-2">Insert your RoninDojo password to start the upgrade process.</p>
            <form id="ronindojo-upgrade-form" onSubmit={handleSubmit} className="w-4/5 mx-auto my-4">
              <label htmlFor="upgradePassword" className="block text-white text-lg ml-3 mb-2">
                Password
              </label>
              <input id="upgradePassword" type="password" className="input-text" ref={inputRef} autoFocus />
            </form>
            <ErrorMessage errors={[error]} />
          </>
        )
      ) : (
        ""
      )}
    </Dialog>
  );
};
