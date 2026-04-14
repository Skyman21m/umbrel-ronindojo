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

# Initialize ronin-ui.dat with APP_PASSWORD as the default login password.
# APP_PASSWORD is shown to users in Umbrel's "Default credentials" popup.
# NODE_ADMIN_KEY (APP_SEED) is separate and used only for Dojo API.
if [ ! -f "/app/data/ronin-ui.dat" ]; then
  printf '{"initialized":true,"password":"%s"}' "${APP_PASSWORD}" > "/app/data/ronin-ui.dat"
fi

exec node server.js
