#!/usr/bin/env bash
# Finds the "ispindel" D1 database (creates it if CREATE=1) and writes its id into wrangler.toml.
# Used by the GitHub workflows; needs CLOUDFLARE_API_TOKEN.
set -euo pipefail
cd "$(dirname "$0")/.."
find_id() { npx wrangler d1 list --json | jq -r '.[] | select(.name == "ispindel") | .uuid'; }
id=$(find_id)
if [ -z "$id" ] && [ "${CREATE:-0}" = 1 ]; then
  npx wrangler d1 create ispindel
  id=$(find_id)
fi
[ -n "$id" ] || { echo "::error::D1 database 'ispindel' not found"; exit 1; }
echo "D1 ispindel: $id"
sed -i "s/^database_id = .*/database_id = \"$id\"/" wrangler.toml
