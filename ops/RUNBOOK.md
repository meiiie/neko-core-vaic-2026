# NekoPath VPS runbook

Canonical URL: `https://nekopath.holilihu.online`

Production inventory:

- GCP project: `the-wiii-lab-500306`
- zone: `asia-southeast1-c`
- VM: `nekopath-production`
- static IP: `34.142.197.144`
- application directory: `/opt/nekopath`
- recovery origin: `https://nekopath-vaic.pages.dev`

Do not copy API keys or local `.env` files to this host. The current release runs the deterministic
core and mock LLM profile; external inference is admitted only through a server-side secret after
its own evaluation gate.

## Connect

```powershell
gcloud compute ssh nekopath-production `
  --project=the-wiii-lab-500306 `
  --zone=asia-southeast1-c
```

## Inspect

```bash
cd /opt/nekopath
git rev-parse HEAD
sudo docker compose -f ops/compose.yml ps
sudo docker compose -f ops/compose.yml logs --tail=100 app caddy
curl -fsS https://nekopath.holilihu.online/api/healthz
```

Expected: both services are `healthy`; health JSON has `"status":"ok"`.

## Deploy a reviewed main commit

```bash
cd /opt/nekopath
git fetch origin main
git checkout main
git pull --ff-only origin main
sudo docker compose -f ops/compose.yml build app
sudo docker compose -f ops/compose.yml up -d
sudo docker compose -f ops/compose.yml ps
```

Build is the release gate: the Dockerfile runs typecheck, tests and the PWA production build before
creating the runtime image. Do not use `--no-cache` unless cache corruption is established.

## Back up SQLite

This short procedure stops only the application container so the SQLite file is copied consistently.
Caddy may return a temporary 502 during the stop window.

```bash
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo install -d -m 0700 /var/backups/nekopath
cd /opt/nekopath
sudo docker compose -f ops/compose.yml stop app
sudo tar -C /var/lib/docker/volumes/ops_nekopath-data/_data \
  -czf "/var/backups/nekopath/data-${stamp}.tgz" .
sudo docker compose -f ops/compose.yml start app
sudo docker compose -f ops/compose.yml ps
```

## Roll back code

Use a known-good immutable commit. Database migrations must remain backward compatible for this
48-hour release; restore the matching backup if a later migration is not backward compatible.

```bash
cd /opt/nekopath
git fetch origin
git checkout --detach <known-good-commit>
sudo docker compose -f ops/compose.yml up -d --build app
sudo docker compose -f ops/compose.yml ps
```

## Restore SQLite

```bash
cd /opt/nekopath
sudo docker compose -f ops/compose.yml stop app
sudo rm -rf /var/lib/docker/volumes/ops_nekopath-data/_data/*
sudo tar -C /var/lib/docker/volumes/ops_nekopath-data/_data \
  -xzf /var/backups/nekopath/<backup>.tgz
sudo docker compose -f ops/compose.yml start app
```

Restore only a backup whose timestamp and release commit are recorded in the AI collaboration log.

## DNS recovery

If the VPS is not recoverable before judging, change the Cloudflare DNS record back to:

```text
CNAME  nekopath  nekopath-vaic.pages.dev  TTL Auto
```

The canonical hostname remains unchanged. Cloudflare Pages then serves the local-first recovery
artifact, while VPS repair continues off the critical path.
