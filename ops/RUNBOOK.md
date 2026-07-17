# NekoPath production runbook

Canonical URL: `https://nekopath.holilihu.online`

## Inventory

- GCP project: `the-wiii-lab-500306`
- zone: `asia-southeast1-c`
- VM: `nekopath-production`
- static IP: `34.142.197.144`
- application directory: `/opt/nekopath`
- Cloudflare Worker: `nekopath-edge`
- HTTPS origin: `https://nekopath-origin.34-142-197-144.sslip.io`
- recovery Pages URL: `https://nekopath-vaic.pages.dev`

Do not copy API keys or local `.env` files to this host. The current release runs the deterministic core and mock LLM profile; external inference is admitted only through a server-side secret after its own evaluation gate.

## Connect and inspect

```powershell
gcloud compute ssh nekopath-production `
  --project=the-wiii-lab-500306 `
  --zone=asia-southeast1-c
```

```bash
cd /opt/nekopath
git rev-parse HEAD
sudo docker compose -f ops/compose.yml ps
sudo docker compose -f ops/compose.yml logs --tail=100 app caddy
curl -fsS https://nekopath-origin.34-142-197-144.sslip.io/api/healthz
curl -fsSI https://nekopath.holilihu.online/api/healthz
```

Expected: both services are `healthy`; origin health JSON has `"status":"ok"`; canonical response has `X-NekoPath-Edge: cloudflare`.

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

The Docker build is the release gate: it runs typecheck, tests and the PWA production build before creating the runtime image. Do not use `--no-cache` unless cache corruption is established.

## Back up SQLite

This short procedure stops only the application container so the SQLite file is copied consistently. Caddy may return a temporary 502 during the stop window.

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

Use a known-good immutable commit. Database migrations must remain backward compatible for this 48-hour release; restore the matching backup if a later migration is not backward compatible.

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

Record the backup timestamp and release commit in the AI collaboration log.

## Edge recovery

The canonical hostname belongs to the Cloudflare Worker custom-domain binding; do not create a competing DNS record manually.

If the VPS cannot be recovered before judging:

1. remove the `nekopath.holilihu.online` custom-domain binding from Worker `nekopath-edge`;
2. add `nekopath.holilihu.online` back to Pages project `nekopath-vaic` as its custom domain;
3. wait for the Pages domain to become active and smoke test the local-first recovery artifact.

To return to full-stack, deploy the reviewed `main` Worker configuration from `edge/wrangler.jsonc`, then verify the canonical health endpoint and secure login flow.

## Versioning & releases

- **Semver + Conventional Commits.** `feat:` bumps minor, `fix:` bumps patch,
  breaking changes bump major (none expected during the event).
- **Single branch `main`**; short-lived PR branches are deleted after merge.
- **Tags mark judgeable snapshots only**: `v0.x.y` for internal milestones,
  `checkpoint-1`, `checkpoint-2`, `v1.0.0-vaic-final` per the master plan.
  Tag only commits whose CI gate is green and that are (or will be) deployed.
- The running build shows `v<version> + <commit>` in "Dữ liệu & ngoại tuyến"
  → "Thông tin phiên bản" (injected at build time), so any screenshot or bug
  report identifies its exact source commit.

## CI/CD

- `ci.yml` gates every PR and main push: format, lint, typecheck, tests,
  deterministic eval, production build + PWA artifact integrity; uploads
  `dist` for 7 days. Actions pinned to full commit SHAs; `contents: read`.
- `deploy.yml` is **manual** (`workflow_dispatch`): auths to GCP with the
  `GCP_SA_KEY` repository secret, then runs the exact RUNBOOK deploy over IAP
  SSH and smokes the canonical URL. To enable it once: create a service
  account with Compute OS Login + IAP-secured tunnel access, download its
  JSON key, and add it as the `GCP_SA_KEY` secret. Until that secret exists,
  deploys stay manual per the section above (identical commands).
