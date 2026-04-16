#!/bin/sh
set -e

# Initialize Dojo conf files in the persistent data dir if they don't exist.
# These files are read/written by Ronin-UI settings page.
# Defaults match the values set in docker-compose.yml.

if [ ! -f "/app/data/docker-node.conf" ]; then
  printf "NODE_PANDOTX_PUSH=on\nNODE_PANDOTX_PROCESS=on\n" > "/app/data/docker-node.conf"
fi

if [ ! -f "/app/data/docker-bitcoind.conf" ]; then
  printf "BITCOIND_MEMPOOL_EXPIRY=336\nBITCOIND_PERSIST_MEMPOOL=on\nBITCOIND_BAN_KNOTS=off\n" > "/app/data/docker-bitcoind.conf"
fi

# Initialize ronin-ui.dat on first run.
# No password stored — login falls back to APP_PASSWORD (Umbrel default credential).
# When user changes password in Settings, the new password is written here.
if [ ! -f "/app/data/ronin-ui.dat" ]; then
  printf '{"initialized":true}' > "/app/data/ronin-ui.dat"
fi

# Generate RSA keypair on first run (unique per installation).
# On RoninOS the keypair was generated at build time, but since we distribute
# a shared Docker image via ghcr.io, all installations would share the same key.
# Generating at runtime ensures each Umbrel instance has its own keypair.
if [ ! -f "/app/data/rsa-private.pem" ]; then
  node -e "
    const crypto = require('crypto');
    const fs = require('fs');
    const kp = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    fs.writeFileSync('/app/data/rsa-private.pem', kp.privateKey);
    fs.writeFileSync('/app/data/rsa-public.pem', kp.publicKey);
  "
fi
export RSA_PRIVATE_KEY_PATH=/app/data/rsa-private.pem
export RSA_PUBLIC_KEY_PATH=/app/data/rsa-public.pem

exec node server.js
