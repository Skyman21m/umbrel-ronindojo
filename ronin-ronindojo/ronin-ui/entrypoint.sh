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

# Generate default password on first run if ronin-ui.dat doesn't exist.
# Password is stored in ronin-ui.dat and shown as "default credentials".
if [ ! -f "/app/data/ronin-ui.dat" ]; then
  DEFAULT_PWD=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 16)
  printf '{"initialized":true,"password":"%s"}' "$DEFAULT_PWD" > "/app/data/ronin-ui.dat"
fi

exec node server.js
