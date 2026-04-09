#!/bin/sh

set -ex

cd "$(dirname "$0")/.."

VERSION=$(grep '"version"' package.json | sed -n -e 's/^.*"version".*: "\(.*\)".*/\1/p')
FILENAME=ronin-ui-v"$VERSION".tar.gz

rm -rf .next
pnpm run build
tar -czvf "$FILENAME" .next public update-scripts .env.example LICENSE package.json pnpm-lock.yaml pm2.config.js next.config.js

chmod 0644 "$FILENAME"

gpg --output "$FILENAME.sig" --detach-sign "$FILENAME"

chmod 0644 "$FILENAME.sig"

sha256sum "$FILENAME"
