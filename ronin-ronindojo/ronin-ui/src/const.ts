import path from "path";
import { tmpdir, homedir } from "os";

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

const HOME_DIR = homedir();
const TMP_DIR = tmpdir();

export const DOJO_DIR_PATH = path.join(HOME_DIR, "dojo", "docker", "my-dojo");
export const DOJO_EXEC_PATH = path.join(DOJO_DIR_PATH, "dojo.sh");
export const NODE_CONFIG_PATH = process.env.NODE_CONFIG_PATH || path.join(DOJO_DIR_PATH, "conf", "docker-node.conf");
export const BITCOIND_CONFIG_PATH = process.env.BITCOIND_CONFIG_PATH || path.join(DOJO_DIR_PATH, "conf", "docker-bitcoind.conf");
export const EXPLORER_CONFIG_PATH = process.env.EXPLORER_CONFIG_PATH || path.join(DOJO_DIR_PATH, "conf", "docker-explorer.conf");
export const DOJO_ENV_PATH = path.join(DOJO_DIR_PATH, ".env");
export const PM2_LOG_PATH = path.join(process.cwd(), "logs", "combined.log");
export const RONIN_UI_DATA_FILE = path.join(process.cwd(), "ronin-ui.dat");
export const RONINDOJO_DIR = path.join(HOME_DIR, "RoninDojo");
export const RONINDOJO_FUNCTIONS = path.join(RONINDOJO_DIR, "Scripts", "functions.sh");
export const RONINDOJO_UPGRADE_SCRIPT = path.join(RONINDOJO_DIR, "Scripts", "Api", "System", "ronindojo-upgrade.sh");
export const RONINDOJO_CONFIG_DIR = path.join(HOME_DIR, ".config", "RoninDojo");
export const RONINDOJO_INFO_JSON = path.join(RONINDOJO_CONFIG_DIR, "info.json");
export const RONIN_UI_TOR_HOSTNAME = path.join(RONINDOJO_CONFIG_DIR, "data", "ronin-ui-tor-hostname");
export const RONINDOJO_USER_CONF_JSON = path.join(RONINDOJO_CONFIG_DIR, "user.conf");

export const DOJO_UPGRADE_LOCK = path.resolve(TMP_DIR, "ronindojo-dojo-upgrade.lock");
export const RONINDOJO_UPGRADE_LOCK = path.resolve(TMP_DIR, "ronindojo-upgrade.lock");
export const DOCKER_PRUNE_LOCK = path.resolve(TMP_DIR, "docker-builder-prune.lock");
