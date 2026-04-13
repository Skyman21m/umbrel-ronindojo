#!/bin/sh
set -e

# Initialize Dojo conf files in the persistent data dir if they don't exist.
# These files are read/written by Ronin-UI settings page.
# Defaults match the values set in docker-compose.yml.

if [ -n "$NODE_CONFIG_PATH" ] && [ ! -f "$NODE_CONFIG_PATH" ]; then
  printf "NODE_PANDOTX_PUSH=on\nNODE_PANDOTX_PROCESS=on\n" > "$NODE_CONFIG_PATH"
fi

if [ -n "$BITCOIND_CONFIG_PATH" ] && [ ! -f "$BITCOIND_CONFIG_PATH" ]; then
  printf "BITCOIND_MEMPOOL_EXPIRY=336\nBITCOIND_PERSIST_MEMPOOL=on\nBITCOIND_BAN_KNOTS=off\n" > "$BITCOIND_CONFIG_PATH"
fi

exec node server.js
