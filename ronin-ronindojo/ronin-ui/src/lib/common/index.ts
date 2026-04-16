export const useRealData = process.env.NODE_ENV === "production" || process.env.USE_REAL_DATA === "true";

// Safety check: refuse to run with mock data in a Docker container (production environment)
if (!useRealData && typeof window === "undefined" && process.env.HOSTNAME) {
  throw new Error("FATAL: USE_REAL_DATA is not enabled but this appears to be a production container. Refusing to start with mock data.");
}

export const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

export const satsToBTC = (sats: number) => sats / 100000000;

const MAINNET_REGEX = /\b(bc(0([02-9ac-hj-np-z]{39}|[02-9ac-hj-np-z]{59})|1[02-9ac-hj-np-z]{8,87})|[13][1-9A-HJ-NP-Za-km-z]{25,35})\b/;
const TESTNET_REGEX = /\b(tb(0([02-9ac-hj-np-z]{39}|[02-9ac-hj-np-z]{59})|1[02-9ac-hj-np-z]{8,87})|[2mn][1-9A-HJ-NP-Za-km-z]{25,39})\b/;

export const isBitcoinAddress = (address: string, testnet = false): boolean => {
  return testnet ? TESTNET_REGEX.test(address) : MAINNET_REGEX.test(address);
};

export const recordToSearchParamsString = (params: Record<string, boolean | null | number | string | ReadonlyArray<string>>) => {
  // @ts-ignore
  return new URLSearchParams(params).toString();
};
