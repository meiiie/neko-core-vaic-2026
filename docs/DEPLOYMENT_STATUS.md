# NekoPath deployment status

Ngày xác minh: 2026-07-18 (v0.8.0) · Trạng thái: **production full-stack đang live, release
qua pipeline**.

Từ v0.8.0, mọi release đi qua GitHub Actions (`gh workflow run deploy.yml` — keyless WIF,
IAP tunnel, tuần tự hoá, smoke test tự động); SSH tay chỉ còn là break-glass có báo cáo. Xem
`docs/ENGINEERING_STANDARDS.md`.

## Canonical production route

`https://nekopath.holilihu.online` là URL duy nhất dùng trong README, slide, video demo và form nộp bài.

```text
Browser
  → Cloudflare Worker custom domain (nekopath-edge)
  → HTTPS origin: nekopath-origin.34-142-197-144.sslip.io
  → Caddy + NekoPath app trên GCP VM
```

- Worker version đang live: `2738e858-6bde-4e1c-bd46-32c461f55276`.
- Worker thêm header `X-NekoPath-Edge: cloudflare`; đây là dấu hiệu kiểm tra routing nhanh.
- Cloudflare quản lý DNS record và chứng thư edge cho custom domain. Không tự tạo A/CNAME song song cho hostname `nekopath`.
- Origin dùng hostname `sslip.io` có chứng thư riêng; Caddy **không** cấp/chấm dứt TLS cho hostname canonical nữa.
- `https://nekopath-vaic.pages.dev` vẫn giữ làm recovery artifact local-first, nhưng không quảng bá ra ngoài.

## Hạ tầng GCP

| Hạng mục | Giá trị |
|---|---|
| Project | `the-wiii-lab-500306` |
| VM | `nekopath-production` · `asia-southeast1-c` · `e2-medium` · Debian 12 |
| IP tĩnh | `34.142.197.144` (`nekopath-production-ip`) |
| Ứng dụng | `/opt/nekopath` · Docker Compose (`app`, `caddy`) |
| Lưu trữ | 20 GB persistent disk; SQLite và Caddy state dùng Docker named volumes |
| Network | Public TCP 80/443 + UDP 443; SSH chỉ đi qua IAP tới đúng VM |
| CD identity | GitHub OIDC → Workload Identity Federation; không có GCP JSON key |
| Backup trước cutover | `/var/backups/nekopath/data-pre-cutover-20260717.tgz` |

Không copy FPT/API key hoặc `.env` cá nhân lên host. Bản hiện tại chạy deterministic core và mock LLM profile; chỉ bật inference server-side sau gate đánh giá riêng.

## Bằng chứng kiểm tra sau cutover

Smoke test trực tiếp trên canonical domain đã đạt:

- `GET /api/healthz` → `200`, `status: ok`;
- header `X-NekoPath-Edge: cloudflare` có mặt;
- password sai bị từ chối (`401`);
- giáo viên `co.ha` đăng nhập thành công;
- cookie có `HttpOnly`, `Secure`, `SameSite=Lax`;
- phiên `/api/auth/me` và `POST /api/auth/logout` hoạt động (`200`).

Gate tại v0.8.0: lint, format, typecheck, 167 application/integration tests, 29 deterministic
eval tests và production build đều đạt (`npm run verify`); CI Linux xanh trên đúng SHA release;
deploy v0.8.0 chạy trọn qua pipeline với smoke test canonical URL tự động.

## Quy ước vận hành

1. Production chỉ xuất phát từ `main`; không deploy preview branch lên hostname canonical.
2. Sau mỗi thay đổi server/ops: deploy VM trước, smoke test origin, rồi smoke test canonical URL.
3. Không đổi `nekopath.holilihu.online` trong tài liệu hoặc pitch. Chỉ đổi route phía sau hostname khi recovery cần thiết.
4. Mọi thay đổi hạ tầng, source commit, smoke result và rollback phải ghi vào AI collaboration log.

## Brand and metadata release (2026-07-18 ICT)

- Source release: `94e0e9f` (`fix(ops): preserve deployed build provenance`), after brand commit `b3ff0c7`.
- GitHub Actions CI run `29601836947` passed: format, lint, typecheck, tests, deterministic evaluations, production PWA build and artifact integrity.
- The VM rebuilt the release in Docker: `56/56` application tests passed, the PWA precache contains 16 entries / 683.45 KiB, and both `app` and `caddy` returned healthy.
- Production artifact provenance was checked inside the running container: the client bundle embeds `94e0e9f`, rather than a fallback `dev` label.
- Canonical smoke checks passed at `https://nekopath.holilihu.online`: HTTP 200; `X-NekoPath-Edge: cloudflare`; `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`; canonical, Open Graph and Twitter metadata; manifest and NekoPath PWA icons; PNG logo mark and 1200x630 social share image.

The no-index policy is intentional: this public judging demo contains synthetic classroom data and is not presented as a real school service or public curriculum resource.

## Keyless CD and access hardening (2026-07-18 ICT)

- PR [#13](https://github.com/meiiie/neko-core-vaic-2026/pull/13) replaced the missing JSON-key
  secret with GitHub OIDC → Google Workload Identity Federation. The provider is restricted to the
  immutable repository/owner IDs, `main`, `workflow_dispatch` and the exact deploy workflow path.
- Production deploy runs
  [29638155768](https://github.com/meiiie/neko-core-vaic-2026/actions/runs/29638155768) and
  [29638420458](https://github.com/meiiie/neko-core-vaic-2026/actions/runs/29638420458) passed OIDC
  authentication, IAP/OS Login, the Docker release gate and canonical smoke checks. The deployed
  artifact was verified to contain its source commit.
- The deploy service account has no user-managed keys. OS Login is enabled only on
  `nekopath-production`; an allow rule admits IAP's `35.235.240.0/20` range at priority 900, then a
  VM-tag-scoped deny rule blocks all other port-22 traffic at priority 1000. Direct SSH timed out,
  while IAP SSH and canonical HTTPS remained healthy.
- Every future deploy creates a no-downtime SQLite Online Backup snapshot first. The snapshot is
  integrity-checked, compressed, root-only and named with UTC time plus source commit. A live
  production-path smoke generated an 18,266-byte archive without stopping the app. An isolated
  restore then recovered a 131,072-byte database, passed `quick_check` and opened all nine tables;
  its temporary container, volume and files were removed afterward.

## Recovery

Nếu VM/origin không thể khôi phục kịp thời, giữ nguyên canonical hostname nhưng thực hiện theo thứ tự:

1. Gỡ Worker custom-domain binding cho `nekopath.holilihu.online` trong Cloudflare;
2. thêm lại hostname vào Pages project `nekopath-vaic` làm custom domain;
3. chờ Cloudflare xác nhận active, rồi smoke test trang Pages và local-first mode.

Không thêm một A/CNAME thủ công khi Worker custom domain còn tồn tại. Khi chuyển lại Worker, deploy lại `edge/wrangler.jsonc`; Cloudflare sẽ quản lý record/certificate. Chi tiết vận hành còn lại ở `ops/RUNBOOK.md`.
