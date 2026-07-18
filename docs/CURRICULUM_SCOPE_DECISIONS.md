# Quyết định phạm vi curriculum — đã được trưởng nhóm duyệt

Trạng thái: QUYẾT ĐỊNH CHÍNH THỨC của trưởng nhóm Neko Core, ngày 2026-07-18 (ICT)  
Nguồn đề xuất: `E:\Downloads\CURRICULUM_MAPPING_RESEARCH_AND_APPROVAL_PLAN.md` (đồng nghiệp soạn,
các mục 12, 20 và 33)  
Phạm vi hiệu lực: hackathon VAIC 2026 và giai đoạn ngay sau đó

Ghi chú trung thực quan trọng: các quyết định dưới đây là quyết định **phạm vi và nguyên tắc kiến
trúc** — thuộc thẩm quyền trưởng nhóm. Chúng KHÔNG thay thế việc duyệt chuyên môn nội dung: mọi
KC, cạnh tiên quyết, item và lời văn vẫn giữ `review_state = UNREVIEWED` cho đến khi có người
duyệt chuyên môn được nêu tên. Claim công khai giữ ở Mức A ("lát cắt đối chiếu nguồn, chờ duyệt").

## 1. Quyết định phạm vi nội dung (mục 12)

| # | Quyết định | Kết luận |
|---|---|---|
| 1 | Scope lát cắt | **DUYỆT**: phân số → tỉ số → tỉ lệ thức lớp 5–7, truy hồi phân số lớp 4 |
| 2 | Tỉ số phần trăm lớp 5–6 | **LOẠI TRỪ** khỏi claim của lát cắt; ghi rõ trong mọi mô tả coverage |
| 3 | Số hữu tỉ, hàm số/đồ thị, bài toán "phân số của một số", đổi đơn vị | **LOẠI TRỪ** khỏi lát cắt hiện tại |
| 4 | Bốn phép tính phân số (K06) | **GIỮ MỘT KC** trong MVP; việc tách cộng/trừ và nhân/chia là ứng viên khi mở rộng item bank |
| 5 | Tách Curriculum Outcome và Knowledge Component | **DUYỆT** nguyên tắc hai lớp dữ liệu |
| 6 | JSON có phiên bản là source of truth; SQLite chỉ là mirror | **DUYỆT**; chưa migrate bảng curriculum vào SQLite trước hạn nộp |
| 7 | Ba item/KC (diagnostic, guided practice, post-check) | **DUYỆT làm gate Mức B**; hiện trạng chưa đạt được ghi nhận trung thực |
| 8 | Bản quyền nội dung | **DUYỆT**: chỉ team-authored/licensed; không scrape SGK |
| 9 | Dữ liệu học sinh thật | **CHƯA THU THẬP** trong giai đoạn này |
| 10 | Mức claim mục tiêu | **Mức B**; hiện tại ở Mức A và mọi phát ngôn phải ghi rõ |
| 11 | Backlog | **P0 sau hackathon**; P1/P2 chưa triển khai |

## 2. Quyết định trình bày và dữ liệu (mục 20)

- **DUYỆT** sửa ví dụ: số hữu tỉ thuộc lớp 7; không dùng hàm số làm ví dụ graph.
- **DUYỆT** đường truy vết chuẩn `item/resource → KC → outcome → source`.
- **DUYỆT** mã outcome nội bộ dạng `NKP.CT2018.*` với `code_authority = NEKOPATH`,
  `is_official_code = 0`; không trình bày như mã của Bộ GDĐT.
- **DUYỆT** năm thành tố năng lực Toán làm taxonomy tham chiếu; KHÔNG đánh giá phẩm chất/attitude
  trong MVP.
- **DUYỆT** không dùng sao năng lực hoặc "Completed x/y" khi chưa có rubric/policy được duyệt.
- **DUYỆT** dashboard dùng trạng thái bằng chứng + mẫu số + bất định; không nhãn "yếu/chưa đạt".
- **DUYỆT** explainability chỉ dùng fact/ID/review; không xuất chain-of-thought.

## 3. Quyết định kiến trúc AI và vận hành (mục 33)

- **DUYỆT** định vị AI: BKT-like probabilistic learner model + graph-constrained decision engine
  + LLM tùy chọn có guardrail (đã đưa vào README).
- **DUYỆT** không dùng thuật ngữ DKT; threshold demo không phải chuẩn của Bộ.
- **DUYỆT** Root Cause Engine bốn trạng thái với quyền abstain.
- **DUYỆT** objective optimizer MVP là `MIN_KC` có ràng buộc bằng chứng.
- **DUYỆT** công thức ưu tiên hiện tại (`số học sinh × số KC bị chặn`) và cách hiện factor;
  không thêm "risk/confidence" chưa hiệu chuẩn.
- **DUYỆT** ngưỡng class-wide gap demo `>=3 học sinh` và `>=30% sĩ số` (policy demo, có thể
  điều chỉnh sau pilot).
- **DUYỆT** tách metric development synthetic khỏi metric pilot/impact.
- **DUYỆT** conflict quarantine + ghi event/outbox nguyên tử là điều kiện trước pilot offline
  thật — **ĐÃ TRIỂN KHAI** ngày 2026-07-18 (bảng `sync_conflicts` phía máy chủ, trạng thái
  `CONFLICT` phía thiết bị, transaction IndexedDB duy nhất cho event + hàng đợi).
- **DUYỆT** security/privacy P0 (mục 31.2) là điều kiện trước khi nhập roster thật; endpoint
  directory không xác thực chỉ chấp nhận được với dữ liệu mẫu.

## 4. Việc vẫn KHÔNG làm trước hạn nộp (giữ nguyên mục 13)

- Không migrate bảng curriculum vào SQLite; không đánh dấu node/edge/item `ACCEPTED`.
- Không nhập hàng loạt SGK/PDF/video; không thu thập dữ liệu học sinh thật.
- Không sinh cạnh tiên quyết bằng LLM.
- Không tuyên bố "bao phủ Toán lớp 5–7" hay "bao phủ CTGDPT 2018".
