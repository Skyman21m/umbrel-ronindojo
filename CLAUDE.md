# CLAUDE.md — RoninDojo Umbrel App

Guide complet pour Claude Code sur ce projet. À lire en priorité à chaque nouvelle session.

---

## Contexte du projet

L'objectif est de packager **RoninDojo** (Samourai Dojo backend) comme une **app Umbrel Community Store**, afin de faire tourner un Dojo complet sur un **Umbrel Home** (Intel N100, x86_64) connecté au Bitcoin Node existant d'Umbrel (Bitcoin Knots).

L'expérience cible : identique à une installation RoninOS sur RPI dédié — dashboard complet Ronin-UI, pairing Samourai Wallet, indexer Electrs, explorateur BTC-RPC, Soroban pour CoinJoin.

---

## Utilisateur

- Non-développeur, apprend en faisant
- Umbrel Home sur le réseau local : `192.168.1.30` (port app : `8099`)
- SSH : `umbrel@192.168.1.30` (mot de passe = mot de passe Umbrel)
- Utilise GitHub Desktop pour la gestion Git
- Communique en français
- Préfère être guidé directement, sans micro-management condescendant

---

## Structure du repo

```
umbrel-ronindojo/
├── CLAUDE.md                        ← ce fichier
├── README.md
├── umbrel-app-store.yml             ← config du community app store Umbrel
└── ronin-ronindojo/                 ← l'app (ID = [store-id]-[app-id])
    ├── umbrel-app.yml               ← fiche de l'app pour le store Umbrel
    ├── docker-compose.yml           ← 11 services (voir ci-dessous)
    ├── exports.sh                   ← déclaration du port
    ├── icon.png                     ← icône de l'app
    └── ronin-ui/                    ← code source Ronin-UI (Next.js)
        ├── Dockerfile
        ├── src/
        │   ├── pages/
        │   ├── components/
        │   └── lib/
        └── ...
```

---

## Services Docker (docker-compose.yml)

| Service | Image | Rôle |
|---------|-------|------|
| `app_proxy` | (injecté par Umbrel) | Reverse proxy Umbrel, auth, HTTPS |
| `db` | `ghcr.io/skyman21m/dojo-db:1.7.0` | MariaDB — données indexées Dojo |
| `tor` | `ghcr.io/skyman21m/dojo-tor:1.23.0` | Hidden services .onion |
| `node` | `ghcr.io/skyman21m/dojo-nodejs:1.28.2` | Cœur Dojo — API backend Samourai |
| `nginx` | `ghcr.io/skyman21m/dojo-nginx:1.9.0` | Reverse proxy interne Dojo |
| `electrs` | `ghcr.io/skyman21m/dojo-electrs:1.2.0` | Indexeur Electrum (Electrs) |
| `explorer` | `ghcr.io/skyman21m/dojo-explorer:3.5.1` | BTC-RPC Explorer |
| `soroban` | `ghcr.io/skyman21m/dojo-soroban:0.4.2` | Réseau P2P PandoTx / CoinJoin |
| `mempool_db` | `mariadb:10.5.8` | MariaDB — base de données Mempool Space |
| `mempool_api` | `mempool/backend:v2.4.0` | API backend Mempool Space |
| `mempool_web` | `mempool/frontend:v2.4.0` | Frontend web Mempool Space |
| `ronin-ui` | `ghcr.io/skyman21m/ronin-ui:2.6.0` | Dashboard Next.js (interface graphique) |

Toutes les images custom sont **publiques** sur `ghcr.io/skyman21m/`. Les images Mempool sont les images officielles `mempool/*` de Docker Hub.

---

## Images Docker — Comment elles ont été créées

Les images `samouraiwallet/dojo-*` ont été **supprimées de Docker Hub** après l'affaire Samourai Wallet (avril 2024). Elles ont été rebuildées depuis les Dockerfiles du repo source RoninDojo (disponible uniquement via Gitea .onion).

**Build et push :**
```bash
# Depuis le dossier ronin-ronindojo/ronin-ui/
sg docker -c "docker build -t ghcr.io/skyman21m/ronin-ui:2.6.0 . 2>&1"
sg docker -c "docker push ghcr.io/skyman21m/ronin-ui:2.6.0"
```

Note : `docker` nécessite `sg docker -c "..."` car l'utilisateur `rd` n'est pas dans le groupe docker de façon permanente dans cette session.

---

## Ronin-UI — Spécificités

Ronin-UI est une interface **Next.js** conçue pour tourner sur RoninOS (bare-metal). Elle n'avait pas d'image Docker officielle. On a créé notre propre image depuis le code source.

### Fixes appliqués (tous dans le commit `5040204`) :

#### docker-compose.yml
- **`DOJO_API_URL: http://node:8080/`** — sans le `/v2/` de trailing (le code Dojo l'ajoute lui-même dans les routes). L'original avait `http://172.29.1.3/v2/` (réseau fixe RoninOS).
- **`chmod -R 700 /var/lib/tor`** au lieu de `755` — Tor refuse de démarrer si les dossiers hidden services ont des permissions trop ouvertes.

#### src/lib/server/docker.ts
- **`findContainerByName()`** exporté et utilise un pattern matching — les containers Umbrel ont des noms préfixés (`ronin-ronindojo_node_1` au lieu de `/node`).
- **`bitcoind: "ready" as DojoImageStatus`** — Bitcoin est géré par Umbrel, pas dans notre stack. On force toujours `ready`.

#### src/pages/dashboard.tsx
- **`nameIncludes()`** — helper pour matcher les noms de containers Umbrel (préfixés).
- **`isBitcoindRunning = true`** — Bitcoin Core est externe à notre app.
- **`ContainerStatusIndicator`** utilise `isBitcoindRunning` (plus de recherche par nom `/bitcoind`).

#### src/pages/api/v2/ronindojo/status.ts
- **`constTrue`** au lieu de `constFalse` pour `dojoSynced` et `indexerSynced` quand l'API Dojo est injoignable (timeout/ECONNREFUSED). Évite le message "Dojo not fully synced" qui bloquait tous les outils (XPUB Tool, Transaction Tool, etc.) quand l'API Dojo mettait trop de temps à répondre sur Umbrel.

#### src/enums.ts
- Noms de containers adaptés aux noms réels Umbrel : `node`, `tor`, `db`, `electrs`, `soroban`, `mempool_api`.
- Retirés : `bitcoind`, `whirlpool`, `fulcrum`, `pm2` (non présents dans notre stack).

#### src/pages/api/v2/logs/[id].ts
- Utilise `findContainerByName()` au lieu de `dockerode.getContainer(id)` pour les logs.

#### src/pages/logs/[container].tsx
- Retiré le filtre `pm2` (non présent sur Umbrel).

---

## Fonctionnement d'Umbrel — Points clés

### Comment Umbrel installe une app
1. Lit `umbrel-app.yml` pour le store
2. Clone le repo GitHub
3. Injecte les variables d'environnement (`APP_PASSWORD`, `APP_SEED`, `APP_BITCOIN_NODE_IP`, etc.)
4. Fusionne 3 docker-compose : `common.yml` (réseau) + `app_proxy.yml` (proxy) + notre `docker-compose.yml`
5. Lance via `docker compose up`

### Variables d'environnement Umbrel disponibles
```
APP_PASSWORD          ← mot de passe login Ronin-UI (affiché dans popup "Default credentials")
APP_SEED              ← secret unique par app = NODE_ADMIN_KEY + NODE_API_KEY Dojo
APP_DATA_DIR          ← /home/umbrel/umbrel/app-data/ronin-ronindojo/
APP_BITCOIN_NODE_IP   ← IP du container Bitcoin Core d'Umbrel
APP_BITCOIN_RPC_PORT  ← port RPC Bitcoin (généralement 8332)
APP_BITCOIN_RPC_USER  ← username RPC Bitcoin
APP_BITCOIN_RPC_PASS  ← password RPC Bitcoin
APP_BITCOIN_ZMQ_RAWTX_PORT    ← 28333
APP_BITCOIN_ZMQ_HASHBLOCK_PORT ← 28334
APP_BITCOIN_P2P_PORT  ← port P2P Bitcoin
```

**Comment Umbrel génère APP_PASSWORD et APP_SEED :**
Les deux sont des HMAC-SHA256 (hash hex 64 chars) dérivés du seed global Umbrel avec un identifiant unique par app :
- `APP_SEED` = `HMAC-SHA256(umbrel_seed, "app-ronin-ronindojo-seed")`
- `APP_PASSWORD` = `HMAC-SHA256(umbrel_seed, "app-ronin-ronindojo-seed-APP_PASSWORD")`

Ce sont des valeurs déterministes, fixes, uniques par installation.

### Restart vs Réinstallation
- **Restart** (clic droit → restart sur l'icône Umbrel) : recharge l'image Docker depuis ghcr.io. Suffisant pour les changements de **code Ronin-UI**.
- **Réinstallation** (désinstaller + réinstaller) : retélécharge le `docker-compose.yml` depuis GitHub. Nécessaire pour les changements de **variables d'environnement, config services, permissions**.
- **IMPORTANT** : Toujours pusher sur GitHub avant de réinstaller, sinon le docker-compose sera l'ancienne version.

### Données persistées (volumes)
```
/home/umbrel/umbrel/app-data/ronin-ronindojo/data/
├── mysql/        ← base de données Dojo (transactions, xpubs trackés)
├── tor/          ← clés hidden services .onion (perdues si désinstallation)
├── electrs/      ← index Electrs (plusieurs heures à reconstruire)
├── soroban/      ← peerstore Soroban
├── ronin-ui/     ← données session Ronin-UI + fichiers conf Settings
├── mempool-db/   ← base de données Mempool Space
└── mempool-api/  ← cache Mempool Space
```
**La désinstallation supprime ces volumes** — Electrs et Dojo doivent resynchroniser depuis zéro (plusieurs heures).

---

## Ronin-UI — Architecture technique

Ronin-UI est une app **Next.js** avec SSR (Server-Side Rendering). Le backend Node.js tourne dans le container `ronin-ui` et fait des appels API vers :
- **Dojo API** (`http://node:8080/`) — statut, transactions, xpubs
- **Bitcoin RPC** — info blockchain, mempool
- **Docker socket** (`/var/run/docker.sock`) — statut et logs des containers
- **Système** — CPU, RAM, uptime

### Authentification — Architecture

**Deux systèmes séparés :**

| Fonction | Valeur | Source | Visible où |
|----------|--------|--------|------------|
| Login Ronin-UI | `APP_PASSWORD` | Variable d'env Umbrel | Popup "Default credentials" Umbrel |
| Admin Key Dojo (API/pairing) | `APP_SEED` = `NODE_ADMIN_KEY` | Variable d'env Umbrel | Page Pairing Ronin-UI |

**Flux login :**
1. `login.ts` lit `/app/data/ronin-ui.dat` pour un mot de passe custom
2. Si pas de password custom → fallback sur `APP_PASSWORD` (env var)
3. Comparaison après déchiffrement RSA (clé générée au build Next.js)
4. Session via cookie Iron Session

**Changement de mot de passe :**
- `change-password.ts` vérifie l'ancien mot de passe (même logique : `ronin-ui.dat` puis `APP_PASSWORD`)
- Écrit le nouveau dans `ronin-ui.dat` : `{"initialized":true,"password":"nouveauMotDePasse"}`
- Le login utilisera désormais le mot de passe custom

**Comparaison avec RoninOS classique :**
- Sur RPI : un seul mot de passe pour tout (login UI = sudo Linux = admin key). Généré par `_rand_passwd 69` (69 chars alphanumériques aléatoires)
- Sur Umbrel : login et admin key séparés. Login = `APP_PASSWORD`, admin key = `APP_SEED`. Pas de `sudo` dans le container.

**Fichiers modifiés pour l'auth :**
- `login.ts` — vérifie `ronin-ui.dat` puis `APP_PASSWORD`
- `change-password.ts` — vérifie ancien mot de passe, écrit nouveau dans `ronin-ui.dat`
- `set-password.ts` — idem (utilisé par la page setup)
- `entrypoint.sh` — crée `ronin-ui.dat` avec `{"initialized":true}` (sans password = fallback `APP_PASSWORD`)

- Si cookie corrompu dans le navigateur → page 404 ou redirect `/install-progress`
- Solution : vider les données du site `192.168.1.30` dans le navigateur (pas juste les cookies, tout le site data)

### API endpoints principaux
- `GET /api/v2/dojo/status` — statut Dojo (blocks, uptime, indexer)
- `GET /api/v2/ronindojo/status` — health check global (détermine les messages d'erreur dans les outils)
- `GET /api/v2/bitcoind/blockchain-info` — info blockchain Bitcoin
- `GET /api/v2/logs/[id]` — logs d'un container (pattern matching sur le nom)
- `GET /api/v2/system/*` — CPU, RAM, température, uptime

### Problème ECONNREFUSED intermittent
Sur Umbrel, le container `node` (Dojo) peut refuser des connexions par intermittence, surtout pendant la synchro. Les appels `/api/v2/dojo/status` retournent parfois 503. C'est pour ça que :
- `constTrue` est utilisé dans `ronindojo/status.ts` (évite les faux "not synced")
- SWR côté client garde les données précédentes même si un appel échoue

---

## Source du code RoninDojo

Le code source n'est **plus sur GitHub** (depuis l'affaire Samourai Wallet, avril 2024). Disponible uniquement via Gitea sur un serveur .onion (Tor).

5 repos disponibles :
- **ronindojo** — scripts d'orchestration shell (v2.4.1)
- **dojo** — containers Docker Dojo (v2.4.1) — source principale
- **Ronin-UI** — interface Next.js (v2.6.0) — source de notre image
- **RoninOS** — OS custom hardware dédié (non pertinent pour Umbrel)
- **monorepo** — v3.0.0-beta.1 bare-metal (trop récent/instable)

Pour mettre à jour, il faut télécharger le ZIP depuis Tor Browser, rebuilder les images et les pousser sur ghcr.io.

---

## Workflow de développement

### Modifier le code Ronin-UI
1. Éditer les fichiers dans `ronin-ronindojo/ronin-ui/src/`
2. Builder l'image : `sg docker -c "docker build -t ghcr.io/skyman21m/ronin-ui:2.6.0 . 2>&1 | tail -20"`
3. Pusher : `sg docker -c "docker push ghcr.io/skyman21m/ronin-ui:2.6.0"`
4. Committer et pusher sur GitHub
5. Sur Umbrel : clic droit → restart sur l'icône RoninDojo

### Modifier le docker-compose
1. Éditer `ronin-ronindojo/docker-compose.yml`
2. Committer et pusher sur GitHub
3. Sur Umbrel : désinstaller + réinstaller l'app (les volumes sont perdus !)
4. OU appliquer le patch en SSH : `sudo sed -i 's|ancien|nouveau|' /home/umbrel/umbrel/app-data/ronin-ronindojo/docker-compose.yml` puis restart

### Pusher sur GitHub
```bash
cd /home/rd/Documents/GitHub/umbrel-ronindojo
git add <fichiers>
git commit -m "fix: description du changement"
git push origin main
```

---

## Problèmes connus et solutions

| Problème | Cause | Solution |
|----------|-------|----------|
| "Dojo not fully synced" intermittent dans les outils | API Dojo ECONNREFUSED → `constFalse` | Fix appliqué : `constTrue` dans `ronindojo/status.ts` |
| Tor en restart loop | `chmod 755` au lieu de `700` sur les hidden services | Fix appliqué dans docker-compose |
| Barres de progression à 0% | `DOJO_API_URL` avec `/v2/` en trop | Fix appliqué dans docker-compose |
| Logs ne marchent pas | `getContainer(id)` cherche nom exact, Umbrel préfixe les noms | Fix appliqué : `findContainerByName()` avec pattern matching |
| Push TX → erreur 404 | `/pushtx/` n'est exposé que via nginx, pas sur `node:8080` direct | Fix appliqué : `pushTxApi` pointe vers `http://nginx/v2/` avec token en query param |
| Page 404 après vidage navigateur | Cookie de session corrompu | Vider toutes les données du site `192.168.1.30` dans le navigateur |
| `docker: permission denied` | Groupe docker non actif dans la session | Utiliser `sg docker -c "..."` |
| Settings : boutons ne répondent pas | Fichiers conf absents sur Umbrel | Fix appliqué : `entrypoint.sh` crée les fichiers dans `/app/data/` |
| Mempool Space "Not installed" | Scripts shell RoninOS absents sur Umbrel | Fix appliqué : 3 services Mempool intégrés dans docker-compose |
| Container names mismatch après update docker-compose | Docker Compose v1/v2 naming inconsistant | Fix appliqué : `container_name:` fixe dans docker-compose pour ronin-ui et tor |
| PandoTx "No available Soroban node found" | Variables SOROBAN_ANNOUNCE manquantes dans service node | Fix appliqué : ajout SOROBAN_ANNOUNCE + SOROBAN_ANNOUNCE_KEY_MAIN/TEST dans node |
| Tor SocksPolicy rejette connexions PandoTx | SocksPolicy hardcodée à 172.28.0.0/16 (réseau RoninOS) | Fix appliqué : tor-restart.sh monté en volume avec `accept 0.0.0.0/0` |
| Containers en root (user: "0:0") | Volumes créés en root par Docker | Fix appliqué : exports.sh crée les dossiers en 1000:1000 avant le lancement, images rebuildées avec UID 1000 |

---

## État actuel (2026-04-15)

- App fonctionnelle sur Umbrel Home
- 13 containers running (node, nginx, db, tor, electrs, explorer, soroban, ronin-ui, mempool_db, mempool_api, mempool_web, app_proxy, tor_server)
- Dashboard Ronin-UI complet : Dojo 100%, Bitcoin Core 100%, Indexer 100%
- Recommended fees OK, uptime Dojo OK, derniers blocs OK
- Logs fonctionnels
- Push TX fonctionnel via PandoTx (Soroban/Tor) — 150+ pairs trouvés sur le réseau
- Settings page : boutons fonctionnels (fix entrypoint.sh + conf files dans /app/data/)
- Mempool Space : intégré et running, URL .onion générée par Tor
- Soroban/PandoTX : fonctionnel, rejoint le réseau P2P, trouve les pairs via bootstrap nodes
- Sécurité : tor, node, electrs, soroban en user 1000:1000 (plus de root). Ronin-ui en root avec restrictions (cap_drop ALL, no-new-privileges)

---

## Settings page — Fix appliqué

La page Settings de Ronin-UI lit/écrit des fichiers `.conf` sur le disque pour les toggles PandoTX et Bitcoin (mempool expiry, etc.). Sur RoninOS ces fichiers existent à `~/dojo/docker/my-dojo/conf/`. Sur Umbrel ce chemin n'existe pas.

**Fix :**
- `src/const.ts` : chemins conf redirigés vers `/app/data/docker-node.conf` et `/app/data/docker-bitcoind.conf` (volume persistant)
- `entrypoint.sh` : script qui crée ces fichiers au démarrage du container si absents, avec les valeurs par défaut (PandoTX activé)
- `Dockerfile` : utilise `entrypoint.sh` au lieu de `CMD ["node", "server.js"]` directement

**Limitation :** les toggles Settings modifient les fichiers conf mais le container `node` (Dojo) lit ses env vars depuis `docker-compose.yml`, pas depuis ces fichiers. Les changements ne sont donc pas appliqués à Dojo sans restart manuel. Pour rendre les toggles vraiment fonctionnels, il faudrait que Ronin-UI redémarre le container `node` via le Docker socket après chaque changement.

---

## Soroban / PandoTX — Fonctionnel

**Architecture :**
- Ronin-UI ne parle pas directement à Soroban
- Flux : Ronin-UI → nginx → node (Dojo) → Soroban → bootstrap nodes via Tor
- Communication node↔soroban via NATS IPC (port 4322) et DNS Docker (`NET_DOJO_SOROBAN_IPV4: soroban`)
- Soroban utilise son propre Tor interne (127.0.0.1:9050) pour atteindre les bootstrap nodes .onion
- Le container `node` contacte les pairs distants via `socks5h://tor:9050` (le Tor de Dojo)

**Bugs corrigés pour faire fonctionner PandoTx :**

1. **Variables manquantes dans le service `node`** — `SOROBAN_ANNOUNCE`, `SOROBAN_ANNOUNCE_KEY_MAIN`, `SOROBAN_ANNOUNCE_KEY_TEST` n'étaient pas dans le service `node`. Sans elles, `keys.index.js` définissait `sorobanKeyAnnounce = undefined`, et `directoryList(undefined)` retournait null → "No available Soroban node found" même avec 150+ pairs dans le répertoire Soroban.

2. **SocksPolicy Tor trop restrictive** — Le `restart.sh` de l'image Tor hardcodait `--SocksPolicy "accept 172.28.0.0/16"` (réseau fixe RoninOS). Sur Umbrel, les containers ont des IPs différentes → le container `node` ne pouvait pas utiliser le proxy SOCKS de Tor pour contacter les pairs distants. Fix : montage d'un `tor-restart.sh` modifié avec `--SocksPolicy "accept 0.0.0.0/0"`.

**Flux PandoTx détaillé :**
```
1. node reçoit la TX via POST /pushtx/
2. node appelle http://soroban:4242/rpc → directoryList("soroban.cluster.mainnet.nodes")
3. Soroban retourne la liste des pairs (150+ nœuds .onion)
4. node choisit un pair au hasard
5. node se connecte au pair via socks5h://tor:9050 (proxy Tor de Dojo)
6. node envoie la TX au pair distant
7. Le pair distant broadcast la TX sur le réseau Bitcoin
```

**Bootstrap nodes :** 5 adresses .onion hardcodées — tous actifs et joignables (vérifié via curl depuis le container Soroban).

---

## Mempool Space — Intégration

Sur RoninOS, Mempool Space est un composant optionnel installé via des scripts shell (`_mempool_conf` dans `functions.sh`). Ces scripts n'existent pas sur Umbrel, et le dialog d'installation dans Ronin-UI demandait un mot de passe `sudo` Linux qui n'a pas de sens sur Umbrel.

**Fix : intégration directe dans docker-compose.yml** (pas de scripts shell, pas de sudo)

3 services ajoutés, basés sur le fichier `overrides/mempool.install.yaml` du repo source Dojo :
- `mempool_db` — MariaDB 10.5.8 (base de données dédiée à Mempool)
- `mempool_api` — `mempool/backend:v2.4.0` (connecté à Bitcoin RPC + Electrs + mempool_db)
- `mempool_web` — `mempool/frontend:v2.4.0` (frontend web)

**Config Tor :**
- `MEMPOOL_INSTALL: "on"` dans le service `tor` → active la génération du hidden service
- `NET_MEMPOOL_WEB_IPV4: mempool_web` → le script `restart.sh` de Tor crée `/var/lib/tor/hsv3mempool/` avec le hostname .onion
- Ronin-UI lit l'URL .onion via `execAndGetResultFromTor({ Cmd: ["cat", "/var/lib/tor/hsv3mempool/hostname"] })`

**Détection automatique par Ronin-UI :**
- Le dashboard cherche un container nommé `mempool_db` ou `mempool-db` via le Docker socket
- Si trouvé → affiche "Running" + lien .onion
- Si absent → affiche "Not installed"

**Source des versions :**
- Versions trouvées dans `/home/rd/Documents/GitHub/ronindojo-source/dojo/dojo/docker/my-dojo/.env` :
  - `MEMPOOL_API_VERSION_TAG=2.4.0`
  - `MEMPOOL_WEB_VERSION_TAG=2.4.0`
  - `MEMPOOL_DB_VERSION_TAG=10.5.8`

**Limitation restante :**
Les boutons install/uninstall dans le dialog Mempool de Ronin-UI ne sont pas fonctionnels (ils appellent des scripts shell RoninOS absents). Mais puisque Mempool est désormais permanent dans le docker-compose, ces boutons sont inutiles. Un fix cosmétique serait de les masquer.

---

## Nommage des containers Docker — Attention

Docker Compose v1 (`docker-compose`) nomme les containers avec **underscores** : `ronin-ronindojo_ronin-ui_1`
Docker Compose v2 (`docker compose`) nomme avec **tirets** : `ronin-ronindojo-ronin-ui-1`

Le format utilisé dépend du contexte (installation fraîche vs curl + restart). Pour éviter les problèmes, les containers référencés par d'autres (`ronin-ui` et `tor`) utilisent `container_name:` dans le docker-compose pour forcer le nom :
- `container_name: ronin-ronindojo_ronin-ui_1` → référencé par `APP_HOST`
- `container_name: ronin-ronindojo_tor_1` → référencé par `DOCKER_TOR_CONTAINER`

---

## Appliquer des changements docker-compose sans réinstaller

Pour tester des changements de docker-compose sans perdre les volumes (réinstallation) :
```bash
# 1. Télécharger le nouveau docker-compose depuis GitHub
sudo curl -s https://raw.githubusercontent.com/Skyman21m/umbrel-ronindojo/main/ronin-ronindojo/docker-compose.yml -o /home/umbrel/umbrel/app-data/ronin-ronindojo/docker-compose.yml

# 2. Restart l'app depuis l'interface Umbrel
```
Cette méthode recrée tous les containers avec les nouvelles variables/services tout en préservant les volumes de données.

**Chemin du docker-compose sur l'Umbrel :**
- Fichier actif : `/home/umbrel/umbrel/app-data/ronin-ronindojo/docker-compose.yml`
- Cache app store : `/home/umbrel/umbrel/app-stores/skyman21m-umbrel-ronindojo-github-*/ronin-ronindojo/docker-compose.yml`

**Note :** `docker restart` ne relit PAS les env vars — seul un restart via Umbrel ou `docker compose up -d --force-recreate` applique les changements.

---

## Sécurité — Containers non-root

**Standard Umbrel : tous les containers en `user: "1000:1000"`** (UID/GID de l'utilisateur `umbrel`).

**Problème résolu :** Docker crée les sous-dossiers de volumes en `root:root` s'ils n'existent pas. Les containers en UID 1000 ne peuvent pas y écrire → crash au démarrage.

**Solution :** `exports.sh` (exécuté par Umbrel avant `docker compose up`) crée tous les dossiers avec `mkdir -p` et `chown -R 1000:1000`.

**Images rebuildées avec UID 1000:1000 :**
- `dojo-tor:1.23.0` — build arg `TOR_LINUX_UID=1000 TOR_LINUX_GID=1000`
- `dojo-nodejs:1.28.2` — Dockerfile custom (`dockerfiles/Dockerfile.node`) : user `node` natif UID 1000, sans group tor séparé
- `dojo-electrs:1.2.0` — build arg `ELECTRS_LINUX_UID=1000 ELECTRS_LINUX_GID=1000`
- `dojo-soroban:0.4.2` — Dockerfile custom (`dockerfiles/Dockerfile.soroban`) : un seul user `soroban` UID 1000 pour Tor interne + Soroban

**Tor SocksPolicy :** l'image Tor originale hardcode `--SocksPolicy "accept 172.28.0.0/16"` dans `restart.sh`. Sur Umbrel (réseau différent), le container `node` ne peut pas utiliser le proxy SOCKS. Fix : `tor-restart.sh` monté en volume avec `--SocksPolicy "accept 0.0.0.0/0"`. Le fichier doit être exécutable dans Git et le `command:` utilise `bash /restart.sh` pour contourner les problèmes de permissions d'exécution.

**État par container :**

| Container | User | Restrictions |
|-----------|------|-------------|
| `tor` | 1000:1000 | — |
| `node` | 1000:1000 | — |
| `electrs` | 1000:1000 | — |
| `soroban` | 1000:1000 | — |
| `ronin-ui` | 0:0 (root) | `cap_drop: ALL`, `cap_add: CHOWN/SETUID/SETGID/DAC_OVERRIDE/FOWNER`, `no-new-privileges:true` |
| `db` | (MariaDB interne) | — |
| `nginx` | (nginx interne) | — |
| `explorer` | (Dockerfile USER) | — |
| `mempool_*` | 1000:1000 | — |

**Pourquoi ronin-ui reste root :** il monte `/var/run/docker.sock` pour lister les containers, lire les logs, vérifier les statuts. Le Docker socket appartient à `root:docker` (GID variable selon l'hôte). Sans root, pas d'accès au socket.

**Commandes de rebuild des images :**
```bash
# Tor
sg docker -c "docker build --build-arg TOR_LINUX_UID=1000 --build-arg TOR_LINUX_GID=1000 -t ghcr.io/skyman21m/dojo-tor:1.23.0 /home/rd/Documents/GitHub/ronindojo-source/dojo/dojo/docker/my-dojo/tor"

# Node (Dockerfile custom)
sg docker -c "docker build -f /home/rd/Documents/GitHub/umbrel-ronindojo/ronin-ronindojo/dockerfiles/Dockerfile.node -t ghcr.io/skyman21m/dojo-nodejs:1.28.2 /home/rd/Documents/GitHub/ronindojo-source/dojo/dojo"

# Electrs
sg docker -c "docker build --build-arg ELECTRS_LINUX_UID=1000 --build-arg ELECTRS_LINUX_GID=1000 -t ghcr.io/skyman21m/dojo-electrs:1.2.0 /home/rd/Documents/GitHub/ronindojo-source/dojo/dojo/docker/my-dojo/electrs"

# Soroban (Dockerfile custom)
sg docker -c "docker build -f /home/rd/Documents/GitHub/umbrel-ronindojo/ronin-ronindojo/dockerfiles/Dockerfile.soroban -t ghcr.io/skyman21m/dojo-soroban:0.4.2 /home/rd/Documents/GitHub/ronindojo-source/dojo/dojo/docker/my-dojo/soroban"
```

---

## Migration non-root — Pièges rencontrés et leçons apprises

Le passage des containers de `user: "0:0"` (root) à `user: "1000:1000"` a été le chantier le plus complexe du projet. Voici les 7 problèmes rencontrés dans l'ordre, pour éviter de retomber dans les mêmes pièges.

### 1. Les images Dojo avaient des UIDs custom

Les images originales utilisaient des UIDs spécifiques (tor=1104, electrs=1106, soroban=1111). On ne peut pas juste mettre `user: "1000:1000"` dans le docker-compose — les fichiers internes de l'image (scripts, binaires) appartiennent aux UIDs custom et deviennent inaccessibles.

**Solution :** rebuilder les images avec `--build-arg *_LINUX_UID=1000 --build-arg *_LINUX_GID=1000`.

### 2. Conflits d'UID à 1000 dans les Dockerfiles

**Node :** le Dockerfile original créait un group `tor` avec `TOR_LINUX_GID`. Si on passe GID 1000, ça conflicter avec le group `node` natif (déjà GID 1000 dans `node:22-alpine`).

**Soroban :** le Dockerfile crée deux users (`tor` puis `soroban`). Les deux ne peuvent pas avoir UID 1000.

**Solution :** Dockerfiles custom (`dockerfiles/Dockerfile.node` et `dockerfiles/Dockerfile.soroban`) qui éliminent les conflits — node sans group tor séparé, soroban avec un seul user pour Tor interne + Soroban.

### 3. Docker crée les volumes en root

Quand le docker-compose monte `${APP_DATA_DIR}/data/tor:/var/lib/tor` et que le sous-dossier `data/tor` n'existe pas, Docker le crée en `root:root`. Le container en UID 1000 ne peut pas y écrire → crash au démarrage.

**Tentative échouée — container `init` :** un container Alpine en root avec `depends_on: condition: service_completed_successfully` qui fait le `chown` puis s'arrête. Résultat : l'installation Umbrel échoue complètement (le flux d'installation ne supporte pas ce pattern).

**Solution qui fonctionne — `exports.sh` :** ce script est exécuté par Umbrel **avant** `docker compose up`. On y crée les dossiers avec `mkdir -p` + `chown -R 1000:1000`.

### 4. `exports.sh` — variable non définie

Le script était sourcé dans un contexte strict (`set -u`) avant que `APP_DATA_DIR` ne soit définie → `APP_DATA_DIR: unbound variable` → installation échoue à 1%.

**Solution :** guard avec `if [ -n "${APP_DATA_DIR:-}" ]`.

### 5. `tor-restart.sh` monté en volume — permission denied

On monte `tor-restart.sh` en volume pour overrider le `restart.sh` interne (SocksPolicy corrigée). Mais Umbrel copie le fichier depuis le repo GitHub **sans le flag exécutable** → le container ne peut pas l'exécuter → restart loop "permission denied".

**Solution :** `chmod +x` dans Git (`git update-index --chmod=+x`) + `command: "bash /restart.sh"` dans le docker-compose pour contourner le problème.

### 6. ronin-ui — cap_drop trop restrictif

ronin-ui reste en `user: "0:0"` (Docker socket). On a ajouté `cap_drop: ALL` pour limiter les droits, mais avec seulement `CHOWN/SETUID/SETGID` rajoutés, root ne pouvait plus écrire dans les fichiers owned par UID 1000. Il manquait `DAC_OVERRIDE` (bypasser les permissions fichiers) et `FOWNER`.

**Solution :** ajouter `DAC_OVERRIDE` et `FOWNER` à `cap_add`.

### 7. Nommage des containers — underscores vs tirets

Docker Compose v1 utilise des underscores (`ronin-ronindojo_ronin-ui_1`), v2 des tirets (`ronin-ronindojo-ronin-ui-1`). Le format change selon le contexte (installation fraîche vs `curl` + restart). `APP_HOST` et `DOCKER_TOR_CONTAINER` doivent pointer vers le bon nom sinon l'app est inaccessible.

**Solution :** `container_name:` dans le docker-compose pour forcer un nom fixe, indépendant de la version de Docker Compose.
