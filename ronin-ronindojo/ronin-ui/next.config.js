const { userInfo } = require("os");
const withSvgr = require("@newhighsco/next-plugin-svgr");
const crypto = require("crypto");

// In Docker/production, env vars come from Docker Compose — no .env file needed
let jwtSecret = process.env.JWT_SECRET;
let versionCheck = process.env.VERSION_CHECK || "production";
let cookieMaxAge = parseInt(process.env.COOKIE_MAX_AGE || "7200", 10);

// Fall back to .env file for local development
if (!jwtSecret) {
  const dotenv = require("dotenv");
  const dotenvResult = dotenv.config();
  if (dotenvResult.error) {
    throw dotenvResult.error;
  }
  jwtSecret = dotenvResult.parsed["JWT_SECRET"];
  versionCheck = dotenvResult.parsed["VERSION_CHECK"] || versionCheck;
  cookieMaxAge = parseInt(dotenvResult.parsed["COOKIE_MAX_AGE"] || "7200", 10);
}

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET has to be 32 characters or longer");
}

const ContentSecurityPolicy = `
  default-src data: 'self';
  media-src data: 'self';
  script-src 'self' 'unsafe-inline';
  child-src 'self';
  style-src 'unsafe-inline' 'self';
  font-src 'self';
  frame-ancestors *
`;

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=()",
  },
];

const fs = require("fs");

// In production (Docker), the RSA keypair is generated at first startup by
// entrypoint.sh and persisted in /app/data/. This ensures each Umbrel
// installation has its own unique keypair instead of sharing the build-time key.
// In development, fall back to generating a keypair at build time.
let keyPair;
if (process.env.RSA_PRIVATE_KEY_PATH && fs.existsSync(process.env.RSA_PRIVATE_KEY_PATH)) {
  keyPair = {
    privateKey: fs.readFileSync(process.env.RSA_PRIVATE_KEY_PATH, "utf8"),
    publicKey: fs.readFileSync(process.env.RSA_PUBLIC_KEY_PATH, "utf8"),
  };
} else {
  keyPair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
}

/**
 * @type {import("next").NextConfig}
 **/
const nextConfig = withSvgr({
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  serverRuntimeConfig: {
    encryptionPrivateKey: keyPair.privateKey,
    JWT_SECRET: jwtSecret,
    VERSION_CHECK: versionCheck,
    COOKIE_MAX_AGE: cookieMaxAge,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.output.publicPath = "";
    }
    return { ...config, experiments: { asyncWebAssembly: true, layers: true } };
  },
  publicRuntimeConfig: {
    encryptionPublicKey: keyPair.publicKey,
    username: process.env.RONIN_UI_USERNAME || "umbrel",
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/push-tx",
        destination: "/tools/push-tx",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/logs",
        destination: "/logs/node",
      },
    ];
  },
  async headers() {
    if (process.env.NODE_ENV === "development") return [];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
});

module.exports = nextConfig;
