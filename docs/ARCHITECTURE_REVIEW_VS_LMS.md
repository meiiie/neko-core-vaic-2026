# Đánh giá kiến trúc NekoPath — đối chiếu LMS_hohulili

Trạng thái: đánh giá nội bộ theo yêu cầu trưởng nhóm, 2026-07-18 (ICT)  
Phương pháp: đọc trực tiếp mã nguồn hai hệ thống, số đo lấy từ repo tại ngày đánh giá.

## 0. Kết luận trước

Cảm nhận của trưởng nhóm đúng ở đúng chỗ: **tổ chức mã nguồn** của NekoPath non hơn
LMS_hohulili khoảng 2–3 bậc trưởng thành — hệ quả tất yếu của 48 giờ với 3 luồng làm việc
song song. Nhưng cần tách bạch: **kiến trúc sản phẩm** (local-first, engine tất định chạy
trên thiết bị) của NekoPath lại *đúng bài toán hơn* chính LMS nếu đem LMS đi giải đề
này. Tệ ở lớp vỏ tổ chức code — không tệ ở lõi.

## 1. Đối chiếu từng tầng (số liệu thật)

| Tầng | LMS_hohulili | NekoPath hôm nay | Chênh lệch |
|---|---|---|---|
| Backend | Java/Spring, **modular monolith theo bounded context**: `academic`, `assessment`, `identity`, `course_authoring`, `learning_delivery`, `communication`, `competency_mapping`, `shared` — mỗi context có tầng `application/…` (DDD) | **`server/app.ts` 894 dòng**: mọi endpoint + SQL inline trong một file Fastify | LMS hơn hẳn. Đây là khoảng cách lớn nhất |
| Frontend layering | Angular: feature module + **service layer riêng từng feature** (`enrollment.service`, `student-assignment.service`…), admin có `presentation/` tách bạch | React feature folders; tầng `src/services` đã hình thành (8 module + test: sync, lessons, llm, evidence-hydration…) nhưng còn fetch inline rải rác trong component | LMS hơn; NekoPath đang hội tụ đúng hướng |
| Design system | Component primitives dùng chung (`app-button`, `app-icon`…), SCSS theo từng component | **5** shared components; **`global.css` 4 187 dòng** một file — CSS chết từng tích tụ và phải dọn tay | LMS hơn rõ |
| Quy trình | **spec-kit SDD** (`.specify/` templates, workflows, memory; `specs/001-…`), **CodeRabbit** review tự động, docs-site riêng, worktrees song song | `docs/` plans + AGENTS.md lanes; CI gate đầy đủ; chưa có SDD pipeline, chưa có review bot | LMS hơn về quy trình nội dung; CI/CD hai bên tương đương |
| Offline | Online-first + **tải khoá học về để offline** (download button từng khoá) | **Local-first thật**: engine chẩn đoán/lộ trình chạy trên thiết bị, precache toàn app 0,82 MB, outbox idempotent + transaction nguyên tử + cách ly xung đột | **NekoPath hơn** — và đây là ràng buộc số 1 của đề |
| Ràng buộc tài nguyên | Bundle Angular + backend Java cần hạ tầng đáng kể | JS khởi tạo 79,8 KB gzip, `node:sqlite` không native dep, một VM nhỏ | **NekoPath hơn** cho ngữ cảnh vùng khó |
| Minh bạch AI | AI assistant module trong backend | Engine tất định giải thích từng kết luận bằng ID bằng chứng, quyền abstain, eval suite công khai 29 test | **NekoPath hơn** cho bài toán chấm điểm được |

## 2. Ba khoản nợ tổ chức mã lớn nhất của NekoPath

1. **`server/app.ts` 894 dòng** — mọi domain (auth, questions, assignments, lessons,
   events, sync) chung một file, SQL trong handler. LMS xử lý cùng khối lượng bằng 8
   bounded context. Rủi ro: xung đột merge liên tục (đã xảy ra cả ngày 18/07), khó test
   từng phần.
2. **`global.css` 4 187 dòng** — một stylesheet cho toàn ứng dụng; ba đời UI cũ từng để
   lại CSS chết phải dọn tay. LMS scope style theo component.
3. **Fetch inline trong component** — một phần đã vào `src/services` (chuẩn), phần còn
   rải trong page components; hai kiểu cùng tồn tại là mầm lệch chuẩn.

## 3. Kế hoạch hấp thụ (đã cân giờ với hạn nộp)

**Ngay (đã làm trong ngày 18/07):**
- Quy tắc: mọi network call đi qua `src/services/*` hoặc `features/*/­*-api.ts`; không
  fetch inline trong component mới. Đã chuyển PUT học liệu về `services/lessons.saveLesson`.
- Quy tắc: không thêm CSS mới vào `global.css` cho surface mới — file style theo feature
  (Vite import) kể từ giờ.
- Delivery rules riêng đã ở `ENGINEERING_STANDARDS.md`.

**Cửa sổ yên tĩnh đầu tiên sau checkpoint (1–2 giờ, thuần cơ học):**
- Tách `server/app.ts` → `server/routes/{auth,questions,assignments,lessons,events}.ts`
  + helpers dùng chung; app.ts chỉ còn đăng ký. KHÔNG làm lúc đội đang merge mỗi 5 phút —
  file-move sẽ đánh nhau với mọi nhánh đang mở.
- Tách `global.css` theo surface (`auth.css`, `shell.css`, `student.css`, `teacher.css`).

**Sau sự kiện (theo hình mẫu LMS):**
- Bounded context modules cho server như LMS (`identity`, `content`, `assessment`,
  `teacher-intelligence`).
- Primitives dùng chung (`Button`, `Panel`, `StatusLabel`) thay class-name conventions.
- spec-kit SDD + CodeRabbit lên repo (LMS đã chứng minh giá trị).
- Registry image bất biến + staging (đã liệt kê trong ENGINEERING_STANDARDS §4).

## 4. Điều KHÔNG nên sao chép từ LMS cho bài toán này

- Backend Java/Spring: đúng cho LMS đa tenant; sai cho ràng buộc "chạy được ở vùng khó,
  một VM nhỏ, offline là mặc định" của đề bài.
- Online-first + tải-về-offline: mô hình đó coi offline là ngoại lệ; đề bài coi offline
  là thường thái — local-first của NekoPath là lựa chọn đúng và là điểm ăn điểm chính.
