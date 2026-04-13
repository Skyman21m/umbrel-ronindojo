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
    ├── docker-compose.yml           ← 8 services (voir ci-dessous)
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
| `ronin-ui` | `ghcr.io/skyman21m/ronin-ui:2.6.0` | Dashboard Next.js (interface graphique) |

Toutes les images sont **publiques** sur `ghcr.io/skyman21m/`.

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
APP_PASSWORD          ← mot de passe Umbrel = NODE_ADMIN_KEY Dojo
APP_SEED              ← seed aléatoire = NODE_API_KEY Dojo
APP_DATA_DIR          ← /home/umbrel/umbrel/app-data/ronin-ronindojo/
APP_BITCOIN_NODE_IP   ← IP du container Bitcoin Core d'Umbrel
APP_BITCOIN_RPC_PORT  ← port RPC Bitcoin (généralement 8332)
APP_BITCOIN_RPC_USER  ← username RPC Bitcoin
APP_BITCOIN_RPC_PASS  ← password RPC Bitcoin
APP_BITCOIN_ZMQ_RAWTX_PORT    ← 28333
APP_BITCOIN_ZMQ_HASHBLOCK_PORT ← 28334
APP_BITCOIN_P2P_PORT  ← port P2P Bitcoin
```

### Restart vs Réinstallation
- **Restart** (clic droit → restart sur l'icône Umbrel) : recharge l'image Docker depuis ghcr.io. Suffisant pour les changements de **code Ronin-UI**.
- **Réinstallation** (désinstaller + réinstaller) : retélécharge le `docker-compose.yml` depuis GitHub. Nécessaire pour les changements de **variables d'environnement, config services, permissions**.
- **IMPORTANT** : Toujours pusher sur GitHub avant de réinstaller, sinon le docker-compose sera l'ancienne version.

### Données persistées (volumes)
```
/home/umbrel/umbrel/app-data/ronin-ronindojo/data/
├── mysql/       ← base de données Dojo (transactions, xpubs trackés)
├── tor/         ← clés hidden services .onion (perdues si désinstallation)
├── electrs/     ← index Electrs (plusieurs heures à reconstruire)
├── soroban/     ← peerstore Soroban
└── ronin-ui/    ← données session Ronin-UI
```
**La désinstallation supprime ces volumes** — Electrs et Dojo doivent resynchroniser depuis zéro (plusieurs heures).

---

## Ronin-UI — Architecture technique

Ronin-UI est une app **Next.js** avec SSR (Server-Side Rendering). Le backend Node.js tourne dans le container `ronin-ui` et fait des appels API vers :
- **Dojo API** (`http://node:8080/`) — statut, transactions, xpubs
- **Bitcoin RPC** — info blockchain, mempool
- **Docker socket** (`/var/run/docker.sock`) — statut et logs des containers
- **Système** — CPU, RAM, uptime

### Authentification
- Login : `umbrel` / `APP_PASSWORD` (mot de passe Umbrel)
- Cookie de session (Iron Session)
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
| Page 404 après vidage navigateur | Cookie de session corrompu | Vider toutes les données du site `192.168.1.30` dans le navigateur |
| `docker: permission denied` | Groupe docker non actif dans la session | Utiliser `sg docker -c "..."` |

---

## État actuel (2026-04-13)

- App fonctionnelle sur Umbrel Home
- Tous les services running (node, nginx, db, tor, electrs, explorer, soroban, ronin-ui)
- Dashboard Ronin-UI complet : Dojo 100%, Bitcoin Core 100%, Indexer 100%
- Recommended fees OK, uptime Dojo OK, derniers blocs OK
- Logs fonctionnels
- Chasse aux bugs en cours (synchro terminée)
- URL .onion BTC-RPC Explorer générée par Tor mais affichage dans UI à vérifier
