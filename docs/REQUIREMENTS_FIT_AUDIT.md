# Audit kỹ thuật: đối chiếu 3 yêu cầu hệ thống NekoPath

Ngày cập nhật: 2026-07-19 (ICT) · Phiên bản nguồn: `main` tại `c60dfb8`
(bao gồm PR #33 — adaptive multimedia learning plan) · Phạm vi: mã nguồn,
kiểm thử tự động (304 test, 36 eval) và bản build cục bộ bằng Node 24.18.0.

Tài liệu này đối chiếu nguồn với **3 nhóm yêu cầu hệ thống** (trải nghiệm học tập
thích ứng, trợ lý cho giáo viên, công nghệ AI an toàn) — khác phạm vi với
`docs/PROBLEM_FIT_AUDIT.md` vốn đối chiếu với văn bản đề bài VAIC 2026.

## Kết luận

NekoPath hoàn thành **khoảng 85%** khối lượng yêu cầu hệ thống, với phân bố:

| Nhóm yêu cầu | Mức hoàn thành | Ghi chú |
|---|---:|---|
| 1. Trải nghiệm học tập thích ứng (offline-first, đa phương tiện) | ~95% | Mạnh nhất |
| 2. Trợ lý cho giáo viên (dashboard) | ~90% | Còn 1 gap nhóm "tự học vẫn sai" |
| 3. Công nghệ AI an toàn & chống ảo giác | ~70% | Đóng khung mạnh nhưng thiếu 1 vai trò LLM |

Đánh giá này dựa trên bằng chứng kỹ thuật có thể tái lập (file:line, test). Nó
**không** là bằng chứng sản phẩm đã cải thiện kết quả học tập ngoài lớp học thật;
nội dung và nhãn đánh giá hiện vẫn là bản nháp hoặc tổng hợp như nêu ở mục Giới hạn.

---

## Yêu cầu 1 — Trải nghiệm học tập thích ứng (offline-first & đa phương tiện)

### 1.1 Chẩn đoán nguyên nhân gốc (root-cause diagnosis)

| Điều cần chứng minh | Hiện thực | Bằng chứng chạy được |
|---|---|---|
| Khi sai, truy ngược đồ thị tiên quyết tìm lỗ hổng lớp dưới | `diagnose()` duyệt `ancestorIds()` trên DAG, lọc `evidencedGaps` rồi `actionable` (prereq đã vững) | `src/domain/core.ts:553` (diagnose), `:128` (ancestorIds); `server/adaptive-contract.test.ts` |
| Không đoán khi bằng chứng thưa/mâu thuẫn | Trạng thái `NEEDS_MORE_EVIDENCE` + reason `COMPETING_ROOTS`/`INSUFFICIENT_DIRECT_EVIDENCE` | `src/domain/core.ts:573-651`; `tests/eval/core.test.ts` ("chi" profile) |
| Đi ngược lên prerequisites khi gap chưa có câu hỏi | `selectUpstreamProbe()` BFS lên incoming edges, chỉ gom evidence, không tự phong root | `src/domain/core.ts` (PR #33); `tests/eval/core.test.ts` (+21 dòng) |
| Cho phép `CHECK` items làm probe, không chỉ `DIAGNOSTIC` | `item.role === 'DIAGNOSTIC' \|\| 'CHECK'` | `src/domain/core.ts:433` |

### 1.2 Lộ trình phục hồi đa phương tiện

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| Lộ trình tối giản per-student | `planPracticePath()` chỉ giữ gốc + target + nút chưa vững/chưa đủ bằng chứng | `src/domain/core.ts:494` |
| Phân phối video ngắn + PDF đúng KC hổng | `selectResourcesForStep()` lấy 1 EXPLAIN (video ngắn nhất) + 1 SUMMARY (PDF nhỏ nhất), lọc grade band | `src/app/adapters/resource-selection.ts:21` |
| Resource có vai trò sư phạm | `role: EXPLAIN \| WORKED_EXAMPLE \| SUMMARY` + `kind: PDF \| VIDEO` + `gradeMin/Max` | `src/storage/db.ts:74` |
| Projection diagnosis → steps có phase | `deriveStudentLearningPlan()` với phase `EXPLAIN → GUIDED_PRACTICE → POST_CHECK → DONE` | `src/app/adapters/student-learning-plan.ts:136` |

### 1.3 Học không gián đoạn (local-first PWA)

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| Metadata resource tự mirror như lessons | `refreshResources()` clear + bulkPut vào Dexie | `src/services/resources.ts:18` |
| File chỉ cache khi học sinh chủ động (60MB không tự tải) | `saveResourceOffline()` explicit, UI hiện dung lượng | `src/services/resources.ts:80`; `src/features/student/LessonResources.tsx:74` |
| Toàn vẹn file (SHA-256), phát hiện đầy ổ | `isResourceCachedWithHash()` verify + evict; `QuotaExceededError → 'NO_SPACE'` | `src/services/resources.ts:54,96` |
| Download cả lộ trình (tuần tự, idempotent, retry partial) | `buildOfflinePlanManifest()` + `downloadOfflinePlan()` | `src/services/offline-plan.ts`; 6 test |
| Server streaming Range (seek video) | `/api/resources/:id/file` hỗ trợ `Range`, 206/416 | `server/app.ts:1490` |
| MIME allowlist + size limit | 60 MB, `application/pdf`, `video/mp4`, `video/webm` | `server/app.ts:41` |
| Sync tiến độ khi có mạng lại | outbox idempotent + `recordAnswerWithReview` | `src/services/sync.ts` |

**Còn lại (~5%, không chặn):**
- `saveResourceOffline` đọc cả `arrayBuffer` để hash, không báo tiến độ từng file lớn — học sinh
  mạng yếu không thấy "30/60 MB".
- `transcriptVi` là tùy chọn server-side; nếu giáo viên quên, UI fallback thẳng thông báo
  "chưa có transcript" (đúng tinh thần trung thực nhưng trải nghiệm xấu).

---

## Yêu cầu 2 — Trợ lý cho giáo viên (teacher dashboard)

### 2.1 Tự động gom nhóm

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| Gom nhóm theo lỗ hổng gốc chung | `groupForTeacher()` bucket theo `root:<kcId>` | `src/domain/core.ts:764` |
| Nhóm kiểm tra nhanh / xem xét giáo viên / sẵn sàng tiến | Trạng thái `QUICK_CHECK`, `TEACHER_REVIEW`, `READY_TO_ADVANCE` | `src/domain/core.ts:764`; `src/domain/model.ts:143` |
| Lỗ hổng toàn lớp (>50% sai) | `detectClassWideGaps()` | `src/domain/core.ts:833` |
| **Nhóm "tự học video/PDF vẫn sai"** | **Chưa có** — grouping chỉ theo root gap, chưa correlate `RESOURCE_VIEWED` với wrong-answer | Gap, xem "Còn lại" |

### 2.2 Gợi ý ưu tiên + bằng chứng chi tiết

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| Đề xuất nhóm/cá nhân cần can thiệp trước | `allocateTeacherAttention()` — knapsack 0/1 với ngân sách 15 phút | `src/domain/core.ts:888` |
| Bằng chứng dữ liệu chi tiết per-learner | `wrongQuestions` với selected/correct choice, occurredAt, assignment title | `server/teacher-dashboard.ts:282-319` |
| Mở "Căn cứ của từng học sinh" | API `/api/teacher/classes/:classId/students/:studentId` + `TeacherStudentDetailPage` | `server/app.ts:423` |

### 2.3 Ghi đè chuyên môn

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| Giáo viên chỉnh sửa lộ trình học | `applyTeacherOverride()` (`SET_ROOT`/`NEEDS_MORE_EVIDENCE`) không mutate evidence | `src/domain/core.ts:716` |
| Override có lý do bắt buộc, append-only | `POST /api/teacher/overrides` + `teacherOverrideSchema` | `server/app.ts:456,134` |
| Giao thêm bài per-group | `recommendedQuestionIds` + tool `giao_bai` (cần xác nhận) | `server/teacher-dashboard.ts:331`; `src/services/agent/tools.ts:433` |

**Còn lại (~10%):**
- Gap chính: nhóm "đã xem video/PDF nhưng vẫn sai". Hệ thống đã ghi `RESOURCE_VIEWED` event
  (`buildResourceViewedRecord`) và đã có `wrongAnswerRate` per group, nhưng `groupForTeacher`
  chưa dùng tín hiệu này để tách một nhóm riêng. Đây là gap **sư phạm ý nghĩa**: một học sinh
  xem video 3 lần mà vẫn sai đáng lẽ phải nổi bật cho giáo viên.

---

## Yêu cầu 3 — Công nghệ AI an toàn & chống ảo giác

### 3.1 Đồ thị tất định (knowledge tracing)

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| Knowledge Tracing theo đồ thị cố định | BKT (`computeMastery`) + `topologicalOrder` reject cycle | `src/domain/core.ts:287,99` |
| Lộ trình rõ ràng, giải thích được | `DiagnosisResult.reasonCodes`, `evidenceEventIds`, `pathKcIds` | `src/domain/model.ts:104` |

### 3.2 LLM đóng khung

Yêu cầu nêu 2 vai trò LLM: (a) diễn giải tiếng Việt, (b) sinh biến thể bài tập theo schema.
Cả hai đã triển khai; (b) hoàn thành 19/07/2026.

| Điều cần chứng minh | Hiện thực | Bằng chứng |
|---|---|---|
| LLM chỉ diễn giải, không quyết định đáp án/mastery/đường | Comment `AGENTS.md`: "A model may explain a computed result but may not change curriculum edges, answer keys, mastery state, priority, or eval labels." | `AGENTS.md` |
| Guarding 3 lớp | (1) tool fail → fallback deterministic; (2) câu cần evidence mà không gọi tool → từ chối; (3) `isGrounded()` kiểm số liệu + KC anchor, lệch → thay bằng `composeCollectedEvidence` | `src/services/agent/loop.ts:265-296` |
| Tool chỉ đọc, không tự sinh | `de_xuat_bai_tap` lọc câu hỏi **đã có** trong DB; `giao_bai` cần xác nhận | `src/services/agent/tools.ts:351,433` |
| Rule router deterministic khi offline | `routeRuleQuestion()` không cần LLM | `src/services/agent/rule-router.ts` |
| **Sinh biến thể bài tập theo schema** | Tool `sinh_bien_the_bai_tap` (client) + `POST /api/ai/variants` (server, 19/07): grounding HAI PHÍA cùng một schema Zod và danh mục 11 misconception đã biên soạn; `reviewState` bị server ghi đè `UNREVIEWED` bất kể model trả gì; không tự lưu — chỉ thành câu hỏi khi giáo viên duyệt qua ngân hàng câu hỏi. Backend: OpenAI key hoặc phiên ChatGPT của chính giáo viên (Codex App Server); output sai schema/tag bịa → 502, không bao giờ đến học sinh | `src/services/agent/tools.ts:443-603`, `server/ai/variants.ts`, test hai phía |

---

## Giới hạn chung (áp dụng cho cả 3 nhóm)

1. Chưa có pilot học sinh thật, đo learning gain, kiểm tra công bằng hoặc nhãn held-out do
   một người độc lập sở hữu.
2. Nội dung và quan hệ chương trình chưa được giáo viên Toán có tên duyệt; các cạnh, item,
   resource vẫn `UNREVIEWED`.
3. Tài khoản/danh bạ phục vụ walkthrough với dữ liệu mẫu; cơ chế một chạm không phải ranh
   giới bảo mật cho roster thật.
4. Trải nghiệm offline không thể nhận bài giao hoặc học liệu mới cho tới khi kết nối trở lại.
5. Audit này xác minh source/CI cục bộ; không khẳng định production đang chạy đúng commit mới nhất.

Cách phát biểu chính xác: **NekoPath đã triển khai và kiểm thử được ~90% khối lượng yêu cầu
hệ thống; gap chính còn lại là nhóm tự học vẫn sai cho giáo viên, cùng các giới hạn chung
ở trên (chưa pilot thật, nội dung chưa được giáo viên Toán có tên duyệt).**
