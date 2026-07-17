# Báo cáo triển khai & chuẩn hóa tên miền — gửi Codex

Ngày: 2026-07-17 · Soạn: Fable 5, xác minh: Codex · Trạng thái: **VPS full-stack đã sẵn sàng; chờ cắt một DNS record từ Pages sang VPS**

## 1. Kết luận nhanh

- **Domain chuẩn duy nhất: `https://nekopath.holilihu.online`** — đã được gắn vào project
  Cloudflare Pages `nekopath-vaic` (custom domain có sẵn trong project) và **đang phục vụ đúng
  bản build mới nhất**.
- Tình trạng "2 bản deployment khác nhau" **đã chấm dứt** tại thời điểm báo cáo: cả ba URL dưới
  đây trả về cùng một bundle `assets/index-CQWqmXmz.js` (build của commit `4cced7c`, chính là
  `origin/main` hiện tại):

| URL | Vai trò | Trạng thái |
|---|---|---|
| `nekopath.holilihu.online` | **CANONICAL — dùng cho mọi truyền thông/nộp bài** | 200, bundle `index-CQWqmXmz` |
| `nekopath-vaic.pages.dev` | Production Pages gốc (giữ làm hạ tầng, không quảng bá) | 200, cùng bundle |
| `fable-pwa-shell.nekopath-vaic.pages.dev` | Preview alias theo branch (chỉ nội bộ) | 200, cùng bundle |

## 2. Bản đang live chứa gì (commit `4cced7c`, main)

Đăng nhập tài khoản mẫu theo vai trò → sidebar workspace; học sinh: bài kiểm tra thích ứng,
vòng luyện tập mastery-driven (misconception notes + hint 3 bậc), bài được giao, lộ trình; giáo
viên: tổng quan lớp, nhóm can thiệp, ngân hàng câu hỏi, giao bài; sync outbox kiểu LMS; LLM
harness L1 (mock profile). Vì Pages là static không có API, app tự chuyển **chế độ cục bộ**
(recovery artifact đúng contract): thông điệp trung thực + 5 hồ sơ local, toàn bộ lõi chẩn
đoán/luyện tập/dashboard chạy đầy đủ trên thiết bị.

## 3. Quy ước từ bây giờ (đề nghị thống nhất)

1. **Mọi nơi hiển thị URL** (README, slide, video, form nộp bài, platform BTC) chỉ dùng
   `https://nekopath.holilihu.online`. Không đưa `*.pages.dev` ra ngoài.
2. **Chỉ deploy production từ `main`**: `npx wrangler pages deploy dist
   --project-name=nekopath-vaic --branch=main`. Preview alias theo branch chỉ để review nội bộ.
3. Khi VPS full-stack sẵn sàng (image + `ops/compose.yml` + `ops/Caddyfile` đã trỏ đúng
   `nekopath.holilihu.online` trong repo): **cắt DNS của đúng record này sang VPS**. Cùng
   origin nên service worker/IndexedDB của người dùng giữ nguyên; app tự "tỉnh dậy" với API
   thật (login server, giao bài, sync) mà không cần deploy lại client. Pages giữ nguyên làm
   recovery: nếu VPS sự cố, trỏ DNS về Pages là sản phẩm vẫn sống ở chế độ cục bộ.

## 4. DNS và TLS đã xác minh

Kiểm tra ngày 2026-07-17 cho thấy:

| Hạng mục | Trạng thái xác minh |
|---|---|
| Zone | `holilihu.online`, authoritative nameserver: `courtney.ns.cloudflare.com` và `marek.ns.cloudflare.com` |
| Record được tạo ban đầu | `CNAME nekopath → nekopath-vaic.pages.dev`, TTL Auto; ảnh cấu hình do captain cung cấp ghi nhận `DNS only` tại thời điểm tạo |
| Phân giải công khai hiện tại | A: `104.21.41.24`, `172.67.159.16`; AAAA: `2606:4700:3031::6815:2918`, `2606:4700:3031::ac43:9f10` |
| Pages custom domain | `active`; domain verification `active` |
| Chứng thư | `active`, HTTP validation, Google Trust Services (`CN=WE1`), hostname `nekopath.holilihu.online` |
| Hiệu lực chứng thư quan sát | 2026-07-17 10:08:37Z → 2026-10-15 11:08:34Z; Cloudflare/Pages tự quản lý gia hạn |
| Kết nối kiểm tra | HTTP 200, `server: cloudflare`, TLS 1.3, HTTP/3 được quảng bá qua `alt-svc` |
| Zone SSL/TLS encryption mode | **Chưa quan sát được**: Wrangler OAuth hiện có Pages access nhưng Cloudflare Zone Settings API trả 403. Không suy đoán Flexible/Full/Strict từ chứng thư edge. |

Lưu ý: địa chỉ A/AAAA là edge Cloudflare và không chứng minh riêng trạng thái nút proxy của record.
Trước khi cắt sang VPS, người vận hành phải mở Cloudflare Dashboard, chụp lại record hiện hành và
đặt SSL/TLS mode thành **Full (strict)** sau khi Caddy đã cấp chứng thư hợp lệ; không chuyển DNS nếu
`/api/healthz`, đăng nhập, giao bài và đồng bộ chưa qua smoke test trực tiếp trên VPS.

README và baseline UX đã được đổi sang domain chuẩn. Các URL `*.pages.dev` chỉ còn xuất hiện trong
tài liệu vận hành với vai trò origin/recovery hoặc preview nội bộ.

## 5. Kiểm chứng đã thực hiện (bằng lệnh, không suy đoán)

- `wrangler pages project list` → project `nekopath-vaic` có domains: `nekopath-vaic.pages.dev`,
  `nekopath.holilihu.online`.
- HTTP 200 + so khớp hash bundle trên cả 3 URL (bảng trên).
- Ảnh chụp headless bản live xác nhận chế độ cục bộ hiển thị đúng khi không có API.

## 6. VPS full-stack đã triển khai

| Hạng mục | Giá trị |
|---|---|
| GCP project | `the-wiii-lab-500306` |
| VM | `nekopath-production` · `asia-southeast1-c` · `e2-medium` · Debian 12 |
| IP tĩnh | `34.142.197.144` (`nekopath-production-ip`) |
| Disk | 20 GB persistent disk; dữ liệu SQLite và chứng thư Caddy dùng Docker named volume |
| Quyền máy | Không gắn service account, không OAuth scope; Shielded VM bật Secure Boot, vTPM và integrity monitoring |
| Network | Tag `nekopath-web`; public ingress chỉ dành cho TCP 80/443 và UDP 443 qua rule riêng |
| Release | `main` tại commit `3a83c50b706ad868d5bb7158d8e0c0968c006af7` |
| Runtime | Docker Engine 29.6.2 · Docker Compose 5.3.1 · `app` + `caddy` |

Các gate đã đạt trước cutover:

- local: format, lint, typecheck, 66 test, 23 deterministic eval, production build;
- container build: typecheck, 43 test, PWA production build;
- runtime: cả `app` và `caddy` đều `healthy`, `/api/healthz` trả 200;
- functional smoke: frontend + manifest, directory 5 tài khoản mẫu, từ chối sai mật khẩu,
  cookie `HttpOnly`/`Secure`/`SameSite=Lax`, phiên giáo viên, roster 40 học sinh, bank 12 câu,
  phiên học sinh, RBAC 403 và danh sách bài được giao.

## 7. Cutover còn lại

Wrangler OAuth không có quyền `DNS Write`, còn bridge Chrome lỗi trước khi mở Dashboard. Captain cần sửa
duy nhất record `nekopath` trong Cloudflare DNS:

1. thay `CNAME nekopath → nekopath-vaic.pages.dev` bằng `A nekopath → 34.142.197.144`;
2. đặt **DNS only** và TTL Auto trong lúc Caddy lấy chứng thư;
3. sau khi HTTPS origin được xác minh, có thể bật proxy và đặt SSL/TLS thành **Full (strict)**.

Rollback tức thời nếu origin gặp sự cố: trả record về
`CNAME nekopath → nekopath-vaic.pages.dev`; Pages vẫn giữ nguyên recovery artifact local-first.
Các lệnh deploy, kiểm tra, backup và rollback chi tiết nằm ở `ops/RUNBOOK.md`.
