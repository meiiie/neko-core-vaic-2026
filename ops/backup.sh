#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

revision=${1:-manual}
if [[ ! $revision =~ ^[0-9a-f]{7,40}$ ]]; then
  revision=manual
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir=${NEKOPATH_BACKUP_DIR:-/var/backups/nekopath}
container_path="/app/server/data/.backup-${stamp}.sqlite"
host_path="${backup_dir}/data-${stamp}-${revision:0:7}.sqlite"
compose=(sudo docker compose -f ops/compose.yml)

sudo install -d -m 0700 "$backup_dir"

# A recovery deploy must never be blocked by the broken container it is
# about to replace: skip the snapshot loudly when the app cannot exec.
if ! "${compose[@]}" exec -T app node -e "process.exit(0)" >/dev/null 2>&1; then
  echo "backup.sh: app container not running — skipping pre-deploy snapshot (recovery deploy)" >&2
  exit 0
fi

cleanup() {
  "${compose[@]}" exec -T app rm -f \
    "$container_path" "${container_path}-wal" "${container_path}-shm" \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

"${compose[@]}" exec -T app node --input-type=module - "$container_path" \
  < ops/sqlite-backup.mjs

container_id=$("${compose[@]}" ps -q app)
test -n "$container_id"
sudo docker cp "${container_id}:${container_path}" "$host_path"
sudo chmod 0600 "$host_path"
sudo gzip -f "$host_path"
sudo test -s "${host_path}.gz"

printf '%s\n' "${host_path}.gz"
