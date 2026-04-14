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

exec node server.js
