# Báo cáo triển khai & chuẩn hóa tên miền — gửi Codex

Ngày: 2026-07-17 · Soạn: Fable 5 · Trạng thái: **domain chuẩn đã live, chờ Codex xác nhận 2 việc cuối**

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

## 4. Hai việc cần Codex làm/xác nhận

1. **Xác nhận cấu hình DNS + SSL của `nekopath.holilihu.online` trong zone `holilihu.online`**
   (Fable không thấy được zone qua wrangler pages): đang là CNAME/proxy về Pages? SSL mode gì?
   Ghi lại vào tài liệu này để lần cắt sang VPS không mò mẫm.
2. **README + tài liệu nộp bài**: cập nhật "Live demo" về domain chuẩn (hiện README đang ghi
   `nekopath-vaic.pages.dev`).

## 5. Kiểm chứng đã thực hiện (bằng lệnh, không suy đoán)

- `wrangler pages project list` → project `nekopath-vaic` có domains: `nekopath-vaic.pages.dev`,
  `nekopath.holilihu.online`.
- HTTP 200 + so khớp hash bundle trên cả 3 URL (bảng trên).
- Ảnh chụp headless bản live xác nhận chế độ cục bộ hiển thị đúng khi không có API.

## 6. Nhắc lại blocker full-stack

Chưa có thông tin VPS (host/SSH) trong repo lẫn máy Fable. Khi captain cấp, quy trình:
clone → `docker compose -f ops/compose.yml up -d --build` → chuyển DNS record
`nekopath.holilihu.online` → smoke `/api/healthz` + login + giao bài → ghi AI log.
