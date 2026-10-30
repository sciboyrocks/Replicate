#!/bin/zsh
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Install Node.js 22 LTS or newer from https://nodejs.org, then reopen this file.'
  read '?Press Return to close.'
  exit 1
fi
if [ ! -d node_modules/next ]; then
  npm ci || exit 1
fi
printf '\nReplicate runs locally at http://127.0.0.1:3000\nKeep this window open. Press Control-C to stop.\n\n'
npm run dev
