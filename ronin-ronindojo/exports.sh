# Port pour le reverse proxy nginx (interface web Dojo)
# C'est sur ce port que l'app est accessible dans Umbrel
export APP_RONINDOJO_NGINX_PORT="8080"

# Derive distinct passwords per service to avoid single-secret-compromises-all
if [ -n "${APP_PASSWORD:-}" ]; then
  export APP_RONINDOJO_DB_PASSWORD="${APP_PASSWORD}_dojodb"
  export APP_RONINDOJO_MEMPOOL_DB_PASSWORD="${APP_PASSWORD}_mempooldb"
fi

# Create data directories with correct ownership (1000:1000 = umbrel)
# Docker would create them as root if they don't exist
if [ -n "${APP_DATA_DIR:-}" ]; then
  mkdir -p "${APP_DATA_DIR}/data/tor" "${APP_DATA_DIR}/data/mysql" "${APP_DATA_DIR}/data/electrs" "${APP_DATA_DIR}/data/soroban" "${APP_DATA_DIR}/data/ronin-ui" "${APP_DATA_DIR}/data/mempool-db" "${APP_DATA_DIR}/data/mempool-api"
  chown -R 1000:1000 "${APP_DATA_DIR}/data" 2>/dev/null || true
fi
