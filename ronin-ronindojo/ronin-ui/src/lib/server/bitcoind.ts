import { RPCClient } from "@samouraiwallet/bitcoin-rpc";
import { Boom, serverUnavailable } from "@hapi/boom";
import { option, io, taskEither, apply, string } from "fp-ts";
import { pipe } from "fp-ts/function";

import { getValue } from "./config-utils";
import { BITCOIND_CONFIG_PATH } from "../../const";
import { toBoomError } from "./to-boom-error";
import { execAndGetResultFromTor } from "./docker";

const BITCOIND_RPC_HOST = process.env.BITCOIND_RPC_HOST || "127.0.0.1";
const BITCOIND_RPC_PORT = Number.parseInt(process.env.BITCOIND_RPC_PORT || "28256", 10);

interface RpcCredentials {
  BITCOIND_RPC_USER: string;
  BITCOIND_RPC_PASSWORD: string;
}

export interface MempoolInfo {
  loaded: boolean;
  size: number;
  bytes: number;
  usage: number;
  maxmempool: number;
  mempoolminfee: number;
  minrelaytxfee: number;
  unbroadcastcount: number;
}

export interface BlockHeader {
  hash: string;
  confirmations: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  nTx: number;
  previousblockhash: string;
  nextblockhash: string | null;
}

export type BlockchainInfo = {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
  pruneheight: number;
  automatic_pruning: boolean;
  prune_target_size: number;
} & Record<string, any>;

export type NetworkInfo = {
  version: number;
  subversion: string;
  protocolversion: number;
  localservices: string;
  localservicesnames: string[];
  localrelay: boolean;
  timeoffset: number;
  connections: number;
  connections_in: number;
  connections_out: number;
  networkactive: boolean;
  networks: {
    name: string;
    limited: boolean;
    reachable: boolean;
    proxy: string;
    proxy_randomize_credentials: boolean;
  }[];
  relayfee: number;
  incrementalfee: number;
  localaddresses: {
    address: string;
    port: number;
    score: number;
  }[];
  warnings: string;
};

export type DecodeScript = {
  asm: string;
  type: string;
  desc: string;
  address?: string;
};

type RpcClient = option.Option<RPCClient>;

let rpcClient: RpcClient = option.none;

const createBitcoindRpcClient =
  ({ BITCOIND_RPC_USER, BITCOIND_RPC_PASSWORD }: RpcCredentials): io.IO<RPCClient> =>
  () => {
    const client = new RPCClient({ host: BITCOIND_RPC_HOST, port: BITCOIND_RPC_PORT, username: BITCOIND_RPC_USER, password: BITCOIND_RPC_PASSWORD });

    rpcClient = option.some(client);

    return client;
  };

export const getBitcoindV3Url: taskEither.TaskEither<Boom, string> = pipe(
  execAndGetResultFromTor({ Cmd: ["cat", "/var/lib/tor/hsv3bitcoind/hostname"] }),
  taskEither.map(string.trim),
  taskEither.chain((bitcoind) =>
    bitcoind.includes(".onion") ? taskEither.right(bitcoind) : taskEither.left(serverUnavailable("Bitcoind URL could not be read")),
  ),
);

const getValueFromBitcoindConfig = getValue(BITCOIND_CONFIG_PATH);

const getRpcCredentials: taskEither.TaskEither<Boom, RpcCredentials> =
  process.env.BITCOIND_RPC_USER && process.env.BITCOIND_RPC_PASSWORD
    ? taskEither.right({
        BITCOIND_RPC_USER: process.env.BITCOIND_RPC_USER,
        BITCOIND_RPC_PASSWORD: process.env.BITCOIND_RPC_PASSWORD,
      })
    : apply.sequenceS(taskEither.ApplyPar)({
        BITCOIND_RPC_USER: getValueFromBitcoindConfig("BITCOIND_RPC_USER"),
        BITCOIND_RPC_PASSWORD: getValueFromBitcoindConfig("BITCOIND_RPC_PASSWORD"),
      });

const getBitcoindRpcClient = pipe(
  rpcClient,
  option.fold(
    () =>
      pipe(
        getRpcCredentials,
        taskEither.chainW((credentials) => pipe(createBitcoindRpcClient(credentials), taskEither.fromIO)),
      ),
    taskEither.right,
  ),
  taskEither.mapLeft(toBoomError(503)),
);

// https://developer.bitcoin.org/reference/rpc/getblockchaininfo.html
export const getBlockchainInfo: taskEither.TaskEither<Boom, BlockchainInfo> = pipe(
  getBitcoindRpcClient,
  taskEither.chain((client) => taskEither.tryCatch(() => client.getblockchaininfo() as Promise<BlockchainInfo>, toBoomError(503))),
);

// https://developer.bitcoin.org/reference/rpc/getbestblockhash.html
export const getBestBlockHash: taskEither.TaskEither<Boom, string> = pipe(
  getBitcoindRpcClient,
  taskEither.chain((client) => taskEither.tryCatch(() => client.getbestblockhash(), toBoomError(503))),
);

// https://developer.bitcoin.org/reference/rpc/getmempoolinfo.html
export const getMemmpoolInfo: taskEither.TaskEither<Boom, MempoolInfo> = pipe(
  getBitcoindRpcClient,
  taskEither.chain((client) => taskEither.tryCatch(() => client.getmempoolinfo() as unknown as Promise<MempoolInfo>, toBoomError(503))),
);

// https://developer.bitcoin.org/reference/rpc/getblockcount.html
export const getBlockCount: taskEither.TaskEither<Boom, number> = pipe(
  getBitcoindRpcClient,
  taskEither.chain((client) => taskEither.tryCatch(() => client.getblockcount(), toBoomError(503))),
);

// https://developer.bitcoin.org/reference/rpc/getblockheader.html
export const getBlockHeader = (blockhash: string): taskEither.TaskEither<Boom, BlockHeader> =>
  pipe(
    getBitcoindRpcClient,
    taskEither.chain((client) =>
      taskEither.tryCatch(() => client.getblockheader({ blockhash, verbose: true }) as unknown as Promise<BlockHeader>, toBoomError(503)),
    ),
  );

// https://developer.bitcoin.org/reference/rpc/getnetworkinfo.html
export const getNetworkInfo: taskEither.TaskEither<Boom, NetworkInfo> = pipe(
  getBitcoindRpcClient,
  taskEither.chain((client) => taskEither.tryCatch(() => client.getnetworkinfo() as Promise<NetworkInfo>, toBoomError(503))),
);

// https://developer.bitcoin.org/reference/rpc/decodescript.html
export const decodeScript = (script: string): taskEither.TaskEither<Boom, DecodeScript> =>
  pipe(
    getBitcoindRpcClient,
    taskEither.chain((client) =>
      taskEither.tryCatch(() => client.raw({ method: "decodescript", params: [script] }) as unknown as Promise<DecodeScript>, toBoomError(503)),
    ),
  );
