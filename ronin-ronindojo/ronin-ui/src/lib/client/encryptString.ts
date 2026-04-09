import getConfig from "next/config";

const { publicRuntimeConfig } = getConfig();

export const encryptString = async (str: string): Promise<string> => {
  const { pki, util } = await import("node-forge");

  const pubkey = pki.publicKeyFromPem(publicRuntimeConfig.encryptionPublicKey);

  const bytes = pubkey.encrypt(str, "RSA-OAEP");

  return util.encode64(bytes);
};
