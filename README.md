# RoninDojo for Umbrel

Umbrel community app that runs [Samourai Dojo](https://ronindojo.io) on your Umbrel node.

## What's included

| Service | Description |
|---------|-------------|
| **Dojo** (node) | Backend API for Samourai Wallet — transaction tracking, XPUB management |
| **Electrs** | Electrum server for fast address/UTXO lookups |
| **Explorer** | Block explorer (btc-rpc-explorer) |
| **Tor** | Hidden services for private wallet connections |
| **Soroban** | Decentralized transaction broadcasting (PandoTx) |

## How it works

This app connects to your **existing Umbrel Bitcoin Node** — it does not run its own.
All wallet connections go through Tor hidden services for privacy.

## Install on Umbrel

1. Open your Umbrel dashboard
2. Go to **App Store** → **Community App Stores**
3. Add this repository URL
4. Install **RoninDojo**

## Requirements

- Umbrel with **Bitcoin Node** installed and fully synced
- At least 50 GB of free storage (for Electrs indexing)

## Status

Phase 1: Dojo backend + admin interface — **current**
Phase 2: Ronin-UI full dashboard — planned
