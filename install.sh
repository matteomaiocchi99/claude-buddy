#!/usr/bin/env bash
# Installa la skill /buddy in ~/.claude/skills/buddy.
# Non tocca nient'altro: né settings.json, né lo stato di un pet già schiuso.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/skills/buddy"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/buddy"
FORCE="${1:-}"

command -v node >/dev/null 2>&1 || { echo "buddy: serve Node (>= 18)"; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || { echo "buddy: serve Node >= 18, trovato $(node --version)"; exit 1; }

if [ -e "$DEST" ] && [ "$FORCE" != "--force" ]; then
  echo "buddy: $DEST esiste già. Rilancia con --force per sovrascriverlo."
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"

# Prova di funzionamento: se l'engine non gira, meglio saperlo adesso.
node "$DEST/engine/buddy.mjs" peek >/dev/null

echo "buddy: installato in $DEST"
echo "       lancia /buddy in Claude Code, oppure:"
echo "       node \"$DEST/engine/buddy.mjs\" card"
