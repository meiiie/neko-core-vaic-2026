# Audit kỹ thuật: đối chiếu đề bài VAIC 2026

Ngày audit: 2026-07-18 (ICT) · Phương pháp: đọc mã nguồn + kiểm chứng trực tiếp trên
production (https://nekopath.holilihu.online) + số đo thực · Phiên bản audit: v0.7.0

Tài liệu này đối chiếu **từng yêu cầu trong đề bài chính thức** với hiện thực của NekoPath,
kèm bằng chứng kiểm chứng được. Các giới hạn được ghi trung thực ở mục 3.

## 1. Ma trận yêu cầu → hiện thực → bằng chứng

### 1.1. "Chẩn đoán nguyên nhân gốc rễ của lỗ hổng kiến thức từng học sinh (ví dụ: sai Toán lớp 7 do chênh lệch về phân số so với lớp 5)"

| Hiện thực | Bằng chứng |
|---|---|
| Engine chẩn đoán tất định `diagnose()` trong `src/domain/`: tìm gốc actionable được bằng chứng hỗ trợ trên DAG tiên quyết, tách riêng đúng/sai, tính hợp lệ của phương pháp và misconception; cần 2 item độc lập trước khi gọi tên một mẫu lỗi; có quyền từ chối kết luận (`NEEDS_MORE_EVIDENCE`) | Kiểm chứng sống trên production: học sinh **An sai bài tỉ lệ thức lớp 7 (K10) → gốc được chẩn đoán là "Phân số bằng nhau" (K02, kiến thức lớp 4–6)** — trùng khớp nghĩa đen với ví dụ trong đề bài. Học sinh **Bình** cùng lỗi bề mặt → gốc khác (K07 Thứ tự tỉ số). Học sinh **Chi** bằng chứng mâu thuẫn → hệ thống từ chối kết luận và hỏi một câu phân biệt |
| Learner model kiểu Bayesian Knowledge Tracing (tham số phiên bản hoá), chọn câu theo độ lợi thông tin trong ngân sách 3 câu | Bộ eval công khai `tests/eval/`: 29/29 test; root top-1 83,3%; **0 kết luận sai mà không abstain** (safety gate); baseline tốt nhất chỉ 50% |

### 1.2. "Tạo lộ trình thực hành cá nhân hóa để lấp đầy chính xác lỗ hổng đó, thay vì chỉ chấm điểm đúng/sai"

| Hiện thực | Bằng chứng |
|---|---|
| Path planner trả **đường bù tối thiểu hợp lệ** từ gốc tới mục tiêu lớp: giữ lại đúng các KC thiếu bằng chứng/chưa vững, bỏ qua phần đã nắm chắc, không bao giờ nhảy cóc tiên quyết chưa đạt | Live: lộ trình của An = 4 bước K02 → K10 kèm lý do từng bước; **Minh** (nền vững) đi fast-path sang bài chuyển giao thay vì bị giữ lại — đúng vế "học sinh mạnh bị giữ lại" của đề bài |
| Luyện tập theo mastery với **thang gợi ý 3 mức** (khái niệm → bước có hướng dẫn → lời giải), post-check; mỗi câu trả lời ghi kèm misconception và tính hợp lệ phương pháp — không chỉ đúng/sai | Live: trang Luyện tập **từ chối chọn bài khi chưa đủ bằng chứng** ("Chưa xác định được phần cần luyện") thay vì phát bài ngẫu nhiên; màn hình hoàn thành kiểm tra nói thật trạng thái bằng chứng (sửa ngày 18/07) |

### 1.3. "Bảng điều khiển giáo viên là bắt buộc: tự động nhóm học sinh theo nhu cầu, đề xuất ai cần trợ giúp trước, phát hiện khoảng trống toàn lớp để dạy lại"

| Hiện thực | Bằng chứng |
|---|---|
| Nhóm tự động theo gốc actionable + nhóm "cần đánh giá thêm" (không gán nhãn khi thiếu bằng chứng) | Live `/teacher/class`: 4 nhóm xếp hạng, mẫu số bằng chứng hiển thị (`12/12 đã đủ dữ liệu`) |
| "Ai cần trợ giúp trước": điểm ưu tiên **minh bạch** `số học sinh × số kỹ năng bị chặn phía sau`, phân bổ vào **kế hoạch 15 phút** của giáo viên | Live `/teacher`: kế hoạch trong 15 phút với từng hành động kèm phút + điểm; công thức được ghi ngay trên giao diện, không phải hộp đen |
| Khoảng trống toàn lớp: chỉ báo khi ≥3 học sinh **và** ≥30% sĩ số cùng đủ bằng chứng về một gốc → gợi ý dạy lại cả lớp | Live: "12/40 học sinh (30%) cùng gặp khó khăn ở Phân số bằng nhau → cân nhắc ôn lại cho cả lớp" |
| Giáo viên giữ quyền quyết định: override chẩn đoán có lý do bắt buộc, lưu append-only, tự chạy lại nhóm | `TeacherOverrideForm`; kiểm thử trong bộ test ứng dụng |

### 1.4. Ràng buộc: "hoạt động ngoại tuyến hoặc trên băng thông thấp"

| Hiện thực | Số đo (18/07) |
|---|---|
| PWA precache toàn bộ shell + mọi trang | **36 file, 0,82 MB** chưa nén (~0,3 MB truyền tải) — sau lần tải đầu, toàn bộ điều hướng chạy không mạng |
| JS khởi tạo | **79,77 KB gzip** (ngân sách nội bộ 150 KB) |
| Font hệ thống, không webfont | **0 KB** tải thêm; dấu tiếng Việt render gốc |
| Engine chẩn đoán/lộ trình/luyện tập chạy **trên thiết bị** (IndexedDB event log) | Đã kiểm chứng airplane-mode trong Playwright production suite |
| Đồng bộ outbox idempotent, backoff mũ; **ghi event + hàng đợi trong một transaction** (chống mất bài khi crash); **cách ly xung đột** cùng-ID-khác-nội-dung phía máy chủ | Thêm ngày 18/07; test hai phía; trạng thái đồng bộ hiển thị thường trực ở sidebar |
| Gemma in-browser (WebLLM) là **opt-in**: chunk 6 MB nằm ngoài precache, chỉ CacheFirst khi người dùng chủ động tải; AI cốt lõi không cần model | Kiểm tra manifest `dist/sw.js`: 0 mục webllm trong precache |
| Độ trễ máy chủ production | TTFB shell 0,37s; API 0,54–0,56s (qua Cloudflare edge → GCP asia-southeast1) |

### 1.5. Ràng buộc: "nội dung phù hợp Chương trình GDPT 2018"

| Hiện thực | Giới hạn trung thực |
|---|---|
| Mọi KC trong lát cắt (phân số → tỉ số → tỉ lệ thức, truy hồi lớp 4) đều có anchor nguồn + locator tới văn bản chương trình; phạm vi và loại trừ được trưởng nhóm chốt trong `CURRICULUM_SCOPE_DECISIONS.md` | Lát cắt ở **Mức A — đối chiếu nguồn, chờ duyệt chuyên môn**: nội dung giữ `UNREVIEWED`, không claim "bao phủ GDPT 2018". Lộ trình lên Mức B nằm trong `CURRICULUM_MAPPING_RESEARCH_AND_APPROVAL_PLAN` |

### 1.6. Tiền đề của đề bài: "app hiện tại đưa bài theo thứ tự cố định, bỏ qua vai trò giáo viên"

NekoPath được thiết kế ngược lại cả hai vế: không có "danh sách bài cố định" ở bất kỳ đâu —
mọi bước học đều dẫn xuất từ bằng chứng tại thời điểm đó; và giáo viên là người ra quyết định
cuối (ngân sách chú ý, override, giao bài), hệ thống chỉ đề xuất kèm lý do kiểm tra được.

## 2. Vấn đề phát hiện trong audit và cách xử lý

| Vấn đề | Mức | Xử lý |
|---|---|---|
| Production chạy `936f2b1`, đứng sau HEAD v0.7.0 | Vận hành | Deploy lại trong phiên audit này; healthz đối chiếu SHA |
| Màn hình hoàn thành kiểm tra tuyên bố "đã đủ bằng chứng" kể cả khi trạng thái là `NEEDS_MORE_EVIDENCE` | Trung thực sản phẩm | **Đã sửa 18/07** (copy theo trạng thái thật) — phát hiện nhờ kiểm chứng thực chiến với học sinh chưa có bằng chứng |
| Khoảng hở crash giữa ghi event và xếp hàng đồng bộ; trùng ID khác nội dung bị bỏ qua lặng lẽ | Toàn vẹn dữ liệu | **Đã sửa 18/07** (transaction nguyên tử + bảng `sync_conflicts`) |
| Không phát hiện vấn đề độ trễ máy chủ hoặc bundle | — | Số đo ở mục 1.4 |

## 3. Giới hạn còn lại (không che giấu)

1. Runtime demo dùng lát cắt 6/12 KC của content graph; nội dung `UNREVIEWED` cho đến khi có
   người duyệt chuyên môn được nêu tên.
2. Nhãn held-out độc lập và pilot học sinh thật chưa có — mọi metric là development evidence.
3. Endpoint danh bạ lớp không xác thực — chấp nhận được với dữ liệu mẫu, bắt buộc thay trước
   khi nhập roster thật (đã ghi trong scope decisions, mục 31.2 của kế hoạch).
4. Đồng bộ chưa có content-pack versioning/migration đầy đủ (backlog P1).
