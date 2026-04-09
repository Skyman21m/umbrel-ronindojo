import { useEffect } from "react";
import Router from "next/router";
import useSWR from "swr";
import { UrlObject } from "url";

type Url = UrlObject | string;

interface UseUser {
  redirectTo?: Url;
  redirectIfFound?: boolean;
}

interface User {
  isLoggedIn: boolean;
  user?: string;
}

export const useUser = ({ redirectTo = "", redirectIfFound = false }: UseUser = {}) => {
  const { data: user, mutate: mutateUser } = useSWR<User>("/auth/user");

  useEffect(() => {
    // if no redirect needed, just return (example: already on /dashboard)
    // if user data not yet there (fetch in progress, logged in or not) then don't do anything yet
    if (!redirectTo || !user) return;

    if (
      // If redirectTo is set, redirect if the user was not found.
      (redirectTo && !redirectIfFound && !user?.isLoggedIn) ||
      // If redirectIfFound is also set, redirect if the user was found
      (redirectIfFound && user?.isLoggedIn)
    ) {
      Router.push(redirectTo);
    }
  }, [user, redirectIfFound, redirectTo]);

  return { user, mutateUser };
};

type FormatBytesTo = "KB" | "MB" | "GB" | "KiB" | "MiB" | "GiB";

export const formatBytes = (bytes: number | null, format: FormatBytesTo): string => {
  if (bytes == null) {
    return "--";
  }

  let formattedBytes: number;

  switch (format) {
    case "KB":
      formattedBytes = bytes / 1000;
      return `${formattedBytes.toFixed(2)} kB`;
    case "MB":
      formattedBytes = bytes / 1000 / 1000;
      return `${formattedBytes.toFixed(2)} MB`;
    case "GB":
      formattedBytes = bytes / 1000 / 1000 / 1000;
      return `${formattedBytes.toFixed(2)} GB`;
    case "KiB":
      formattedBytes = bytes / 1024;
      return `${formattedBytes.toFixed(2)} kiB`;
    case "MiB":
      formattedBytes = bytes / 1024 / 1024;
      return `${formattedBytes.toFixed(2)} MiB`;
    case "GiB":
      formattedBytes = bytes / 1024 / 1024 / 1024;
      return `${formattedBytes.toFixed(2)} GiB`;
    default:
      return bytes.toString(10);
  }
};

export const BTCkBtoSatsByte = (BTCkB: number): number => {
  return BTCkB * 100000;
};
