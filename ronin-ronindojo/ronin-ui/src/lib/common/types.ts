import * as t from "io-ts";
import isURL from "validator/lib/isURL";
import isBase64 from "validator/lib/isBase64";
import isHexadecimal from "validator/lib/isHexadecimal";
import { NonEmptyString } from "io-ts-types/NonEmptyString";

// new io-ts API
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";
import { flow } from "fp-ts/function";
import { isBitcoinAddress, recordToSearchParamsString } from "./index";

/*
 * New io-ts API codecs start
 */

const walletParamsDecoder = D.partial({
  active: D.string,
  new: D.string,
  bip49: D.string,
  bip84: D.string,
  pubkey: D.string,
});

type WalletParams = D.TypeOf<typeof walletParamsDecoder>;

const walletParamsEncoder: E.Encoder<string, WalletParams> = {
  encode: flow(recordToSearchParamsString),
};

export const WalletParamsCodec: C.Codec<unknown, string, WalletParams> = C.make(walletParamsDecoder, walletParamsEncoder);

export type WalletParamsCodec = C.TypeOf<typeof WalletParamsCodec>;

const xpubImportParamsDecoder = D.struct({
  xpub: D.string,
  type: D.literal("new", "restore"),
  segwit: D.nullable(D.literal("bip49", "bip84")),
  force: D.nullable(D.boolean),
});

type XpubImportParams = D.TypeOf<typeof xpubImportParamsDecoder>;

const xpubImportParamsEncoder: E.Encoder<string, XpubImportParams> = {
  encode: flow(recordToSearchParamsString),
};

export const XpubImportParamsCodec: C.Codec<unknown, string, XpubImportParams> = C.make(xpubImportParamsDecoder, xpubImportParamsEncoder);

export type XpubImportParamsCodec = C.TypeOf<typeof XpubImportParamsCodec>;

/*
 * New io-ts API codecs end
 */

interface XpubStringBrand {
  readonly XpubString: unique symbol;
}

export const XpubString = t.brand(t.string, (s): s is t.Branded<string, XpubStringBrand> => s.startsWith("xpub"), "XpubString");

export type XpubString = t.TypeOf<typeof XpubString>;

interface YpubStringBrand {
  readonly YpubString: unique symbol;
}

export const YpubString = t.brand(t.string, (s): s is t.Branded<string, YpubStringBrand> => s.startsWith("ypub"), "YpubString");

export type YpubString = t.TypeOf<typeof YpubString>;

interface ZpubStringBrand {
  readonly ZpubString: unique symbol;
}

export const ZpubString = t.brand(t.string, (s): s is t.Branded<string, ZpubStringBrand> => s.startsWith("zpub"), "ZpubString");

export type ZpubString = t.TypeOf<typeof ZpubString>;

export const ExtendedPublicKeyString = t.union([XpubString, YpubString, ZpubString]);

export type ExtendedPublicKeyString = t.TypeOf<typeof ExtendedPublicKeyString>;

interface UrlStringBrand {
  readonly UrlString: unique symbol;
}

export const UrlString = t.brand(
  t.string,
  (s): s is t.Branded<string, UrlStringBrand> => isURL(s, { protocols: ["http", "https"], require_protocol: true }),
  "UrlString",
);

export type UrlString = t.TypeOf<typeof UrlString>;

interface PasswordBrand {
  readonly Password: unique symbol;
}

export const Password = t.brand(NonEmptyString, (s: string): s is t.Branded<NonEmptyString, PasswordBrand> => s.length >= 8, "Password");

export type Password = t.TypeOf<typeof Password>;

interface BitcoinAddressBrand {
  readonly BitcoinAddress: unique symbol;
}

export const BitcoinAddress = t.brand(
  NonEmptyString,
  (s: string): s is t.Branded<NonEmptyString, BitcoinAddressBrand> => isBitcoinAddress(s),
  "BitcoinAddress",
);

export type BitcoinAddress = t.TypeOf<typeof BitcoinAddress>;

interface Base64StringBrand {
  readonly Base64String: unique symbol;
}

export const Base64String = t.brand(NonEmptyString, (s: string): s is t.Branded<NonEmptyString, Base64StringBrand> => isBase64(s), "Base64String");

export type Base64String = t.TypeOf<typeof Base64String>;

interface HexStringBrand {
  readonly HexString: unique symbol;
}

export const HexString = t.brand(NonEmptyString, (s: string): s is t.Branded<NonEmptyString, HexStringBrand> => isHexadecimal(s), "HexString");

export type HexString = t.TypeOf<typeof HexString>;
