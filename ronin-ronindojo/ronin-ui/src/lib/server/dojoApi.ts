import http from "http";
import { URLSearchParams } from "url";
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Boom, serverUnavailable } from "@hapi/boom";
import { taskEither } from "fp-ts";
import { pipe } from "fp-ts/function";

import { HexString, WalletParamsCodec, XpubImportParamsCodec } from "../common/types";
import { getDojoAdminKey, getDojoUrl } from "./dojoCredentials";
import { MINUTE, SECOND } from "../../const";
import { recordToSearchParamsString } from "../common";

type BlocksRescanParams = {
  fromHeight: number;
  toHeight: number;
};

type XpubRescanParams = {
  startidx: number;
  gap: number;
};

const DOJO_API = {
  AUTH: {
    POST: {
      LOGIN: "/auth/login",
      REFRESH: "/auth/refresh",
    },
  },
  STATUS: {
    GET: {
      API_STATUS: "/status",
    },
  },
  SUPPORT: {
    GET: {
      PAIRING: "/support/pairing",
      PAIRING_EXPLORER: "/support/pairing/explorer",
      ADDRESS_INFO: (addr: string) => `/support/address/${addr}/info`,
      ADDRESS_RESCAN: (addr: string) => `/support/address/${addr}/rescan`,
      XPUB_INFO: (xpub: string) => `/support/xpub/${xpub}/info`,
      XPUB_RESCAN: (xpub: string, params: XpubRescanParams) => `/support/xpub/${xpub}/rescan?${recordToSearchParamsString(params)}`,
      XPUB_IMPORT_STATUS: (xpub: string) => `/xpub/${xpub}/import/status`,
      XPUB_DELETE: (xpub: string) => `/support/xpub/${xpub}/delete`,
    },
  },
  BLOCKS: {
    GET: {
      RESCAN: (params: BlocksRescanParams) => `/tracker/support/rescan?${recordToSearchParamsString(params)}`,
    },
  },
  XPUB_IMPORT: "/xpub",
  PUSHTX: { POST: { PUSHTX: "/pushtx/" } },
  TX: (txId: string) => `/tx/${txId}?fees=1`,
  WALLET: (params: WalletParamsCodec) => `/wallet/?${WalletParamsCodec.encode(params)}`,
  FEES: "/fees",
};

export interface AuthResponse {
  authorizations: {
    access_token: string;
    refresh_token: string;
  };
}

export interface StatusResponse {
  uptime: string;
  memory: string;
  ws: {
    clients: number;
    sessions: number;
    max: number;
  };
  blocks: number;
  indexer: {
    type: "local_bitcoind" | "local_indexer" | "third_party_explorer";
    url: null | string;
    maxHeight: number;
  };
}

export interface PushTxStatusResponse {
  status: string;
  data: {
    uptime: number;
    memory: number;
    bitcoind: {
      up: boolean;
      conn: number;
      blocks: number;
      version: number;
      protocolversion: number;
      relayfee: number;
      testnet: boolean;
    };
    push: { count: number; amount: number };
  };
}

export interface PushTxScheduleStatusResponse {
  status: string;
  data: { nbTxs: number; txs: unknown[] };
}

export interface PushTxResponse {
  status: "ok";
  data: string;
}

export interface PushTxErrorResponse {
  status: "error";
  error:
    | string
    | {
        message: string;
        code: string;
      };
}

export interface AddressInfoResponse {
  address: string;
  tracked: boolean;
  type: "untracked" | "hd" | "loose";
  balance: number;
  xpub: string | null;
  path: string | null;
  segwit: boolean | null;
  n_tx: number;
  txids: string[];
  utxo: {
    txid: string;
    vout: number;
    amount: number;
  }[];
}

export interface ErrorResponse {
  status: "error";
  error: string;
}

export interface AddressRescanResponse {
  status: string;
}

export interface XpubInfoResponse {
  xpub: string;
  tracked: boolean;
  balance: number;
  unused: {
    external: number;
    internal: number;
  };
  derived: {
    external: number;
    internal: number;
  };
  n_tx: number;
  derivation: string;
  account: number;
  depth: number;
  created: string;
}

export interface XpubRescanResponse {
  status: "ok";
}

export interface XpubDeleteResponse {
  status: "ok";
}

export interface BlocksRescanResponse {
  status: string;
  fromHeight: number;
  toHeight: number;
}

export interface TxInfoResponse {
  txid: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  inputs: {
    n: number;
    seq: number;
    outpoint?: {
      txid: string;
      vout: number;
      value: number;
      scriptpubkey: string;
    };
    sig: string;
    witness: string[];
  }[];
  outputs: {
    n: number;
    value: number;
    scriptpubkey: string;
    type: string;
    address?: string;
  }[];
  created?: number;
  block?: {
    height: number;
    hash: string;
    time: number;
  };
  fees: number;
  feerate: number;
  vfeerate: number;
}

export interface WalletResponse {
  wallet: {
    final_balance: number;
  };
  info: {
    latest_block: {
      height: number;
      hash: string;
      time: number;
    };
    fees: {
      "2": number;
      "4": number;
      "6": number;
      "12": number;
      "24": number;
    };
  };
  addresses: {
    address: string;
    pubkey?: string;
    final_balance: number;
    account_index: number;
    change_index: number;
    n_tx?: number;
  }[];
  txs: {
    block_height?: number;
    hash: string;
    version: number;
    locktime: number;
    result?: number;
    balance: number;
    time: number;
    inputs: {
      vin: number;
      prev_out: {
        txid: string;
        vout: number;
        value: number;
        xpub: {
          m: string;
          path: string;
        };
        addr?: string;
        pubkey?: string;
      };
      sequence: number;
    }[];
    out: {
      n: number;
      value: number;
      addr?: string;
      pubkey: string;
      xpub: {
        m: string;
        path: string;
      };
    }[];
  }[];
  unspent_outputs: {
    tx_hash: string;
    tx_output_n: number;
    tx_version: number;
    tx_locktime: number;
    value: number;
    script: string;
    addr: string;
    pubkey?: string;
    confirmations: number;
    xpub: {
      m: string;
      path: string;
    };
  }[];
}

export interface PairingResponse {
  pairing: {
    type: string;
    version: string;
    apikey: string;
  };
}

export interface PairingExporerResponse {
  pairing: {
    type: string;
    url: string;
    key: string | null | undefined;
  };
}

export interface FeesResponse {
  "2": number;
  "4": number;
  "6": number;
  "12": number;
  "24": number;
}

export interface XpubImportResponse {
  status: "ok";
}

export interface XpubImportStatusFalse {
  status: "ok";
  data: {
    import_in_progress: false;
  };
}

export interface XpubImportStatusTrue {
  status: "ok";
  data: {
    import_in_progress: true;
    status: "rescan" | "import";
    hits: number;
  };
}

export type XpubImportStatusResponse = XpubImportStatusFalse | XpubImportStatusTrue;

const dojoApi: AxiosInstance = axios.create({ baseURL: process.env.DOJO_API_URL || "http://172.29.1.3/v2/", timeout: 30 * SECOND, httpAgent: new http.Agent({ keepAlive: true }) });

// PushTx must go through nginx (not directly to node) as /pushtx/ is only exposed via nginx
const pushTxApi: AxiosInstance = axios.create({ baseURL: process.env.PUSHTX_URL || "http://nginx/v2/", timeout: 30 * SECOND, httpAgent: new http.Agent({ keepAlive: true }) });

let accessToken: string | null = null;

// Function that will be called to refresh authorization
const refreshAuthLogic = async () => {
  return pipe(
    logInDojo,
    taskEither.map(({ data }) => {
      accessToken = data.authorizations.access_token;
    }),
    taskEither.getOrElse((err) => {
      throw err;
    }),
  )();
};

// Use interceptor to inject the token to requests
dojoApi.interceptors.request.use(async (request) => {
  if (request.url?.includes(DOJO_API.AUTH.POST.LOGIN)) {
    return request;
  }

  if (accessToken && request.headers) {
    request.headers["Authorization"] = `Bearer ${accessToken}`;
  }

  return request;
});

const isUnAuthorizedError = (error: AxiosError): boolean => {
  return (error.config && error.response && error.response.status === 401) || false;
};

const shouldRetry = (config: InternalAxiosRequestConfig): boolean => {
  return !config.url?.includes(DOJO_API.AUTH.POST.LOGIN);
};

const authInterceptor = async (error: AxiosError) => {
  if (isUnAuthorizedError(error) && shouldRetry(error.config as InternalAxiosRequestConfig)) {
    await refreshAuthLogic();

    return dojoApi.request(error.config as InternalAxiosRequestConfig);
  }
  // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
  return Promise.reject(error);
};

dojoApi.interceptors.response.use(null, authInterceptor);

const logInDojo = pipe(
  getDojoAdminKey,
  taskEither.chain((adminKey) =>
    pipe(
      taskEither.tryCatch(
        () =>
          dojoApi.post<string, AxiosResponse<AuthResponse>>(DOJO_API.AUTH.POST.LOGIN, new URLSearchParams({ apikey: adminKey }), {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          } satisfies AxiosRequestConfig),
        (e) => {
          console.error("Dojo auth error", e);
          return e as AxiosError<{ message: string }>;
        },
      ),
      taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.message || e.message)),
    ),
  ),
);

/**
 * POST
 * @description Push TX to bitcoin network: https://github.com/Samourai-Wallet/samourai-dojo/blob/master/doc/POST_pushtx.md
 * @param txHex {string}
 */
export const pushTx = (txHex: HexString): taskEither.TaskEither<Boom, AxiosResponse<PushTxResponse>> =>
  pipe(
    accessToken ? taskEither.right(accessToken) : pipe(logInDojo, taskEither.map(({ data }) => { accessToken = data.authorizations.access_token; return accessToken as string; })),
    taskEither.chain((token) =>
      pipe(
        taskEither.tryCatch(
          () =>
            pushTxApi.post<string, AxiosResponse<PushTxResponse>>(`${DOJO_API.PUSHTX.POST.PUSHTX}?at=${token}`, new URLSearchParams({ tx: txHex }), {
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }),
          (e) => {
            console.error("pushtx error", e);
            return e as AxiosError<PushTxErrorResponse>;
          },
        ),
        taskEither.mapLeft((e) =>
          serverUnavailable(typeof e.response?.data?.error === "string" ? e.response?.data?.error : e.response?.data?.error?.message || e.message),
        ),
      ),
    ),
  );

export const addressInfo = (address: string) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<AddressInfoResponse>(DOJO_API.SUPPORT.GET.ADDRESS_INFO(address)),
      (e) => {
        console.error("addressInfo error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const addressRescan = (address: string) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<AddressRescanResponse>(DOJO_API.SUPPORT.GET.ADDRESS_RESCAN(address)),
      (e) => {
        console.error("addressRescan error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const xpubInfo = (xpub: string) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<XpubInfoResponse>(DOJO_API.SUPPORT.GET.XPUB_INFO(xpub)),
      (e) => {
        console.error("xpubInfo error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const xpubRescan = (xpub: string, startidx: number, gap: number) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<XpubRescanResponse>(DOJO_API.SUPPORT.GET.XPUB_RESCAN(xpub, { startidx, gap })),
      (e) => {
        console.error("xpubRescan error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const xpubDelete = (xpub: string) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<XpubDeleteResponse>(DOJO_API.SUPPORT.GET.XPUB_DELETE(xpub)),
      (e) => {
        console.error("xpubDelete error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const blocksRescan = (fromHeight: number, toHeight: number) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<BlocksRescanResponse>(DOJO_API.BLOCKS.GET.RESCAN({ fromHeight, toHeight })),
      (e) => {
        console.error("blocksRescan error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const txInfo = (txId: string) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<TxInfoResponse>(DOJO_API.TX(txId)),
      (e) => {
        console.error("txInfo error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const wallet = (params: WalletParamsCodec) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<WalletResponse>(DOJO_API.WALLET(params)),
      (e) => {
        console.error("wallet error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const pairing = pipe(
  taskEither.tryCatch(
    () => dojoApi.get<PairingResponse>(DOJO_API.SUPPORT.GET.PAIRING),
    (e) => {
      console.error("pairing info error", e);
      return e as AxiosError<ErrorResponse>;
    },
  ),
  taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  taskEither.chain((pairingResponse) =>
    pipe(
      getDojoUrl,
      taskEither.map((dojoUrl) => ({
        ...pairingResponse,
        data: { ...pairingResponse.data, pairing: { ...pairingResponse.data.pairing, url: `http://${dojoUrl}/v2` } },
      })),
    ),
  ),
);

export const pairingExplorer = pipe(
  taskEither.tryCatch(
    () => dojoApi.get<PairingExporerResponse>(DOJO_API.SUPPORT.GET.PAIRING_EXPLORER),
    (e) => {
      console.error("pairing explorer error", e);
      return e as AxiosError<ErrorResponse>;
    },
  ),
  taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
);

export const fees = pipe(
  taskEither.tryCatch(
    () => dojoApi.get<FeesResponse>(DOJO_API.FEES),
    (e) => {
      console.error("fees error", e);
      return e as AxiosError<ErrorResponse>;
    },
  ),
  taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
);

export const xpubImport = (params: XpubImportParamsCodec) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.post<string, AxiosResponse<XpubImportResponse>>(DOJO_API.XPUB_IMPORT, XpubImportParamsCodec.encode(params)),
      (e) => {
        console.error("xpubImport error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const xpubImportStatus = (xpub: string) =>
  pipe(
    taskEither.tryCatch(
      () => dojoApi.get<XpubImportStatusResponse>(DOJO_API.SUPPORT.GET.XPUB_IMPORT_STATUS(xpub)),
      (e) => {
        console.error("xpubImportStatus error", e);
        return e as AxiosError<ErrorResponse>;
      },
    ),
    taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
  );

export const dojoStatus = pipe(
  taskEither.tryCatch(
    () => dojoApi.get<string, AxiosResponse<StatusResponse>>(DOJO_API.STATUS.GET.API_STATUS, { timeout: 2 * MINUTE }),
    (e) => {
      console.error("dojoStatus error", e);
      return e as AxiosError<ErrorResponse>;
    },
  ),
  taskEither.mapLeft((e) => serverUnavailable(e.response?.data?.error || e.message)),
);
