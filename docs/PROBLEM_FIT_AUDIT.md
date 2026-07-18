# Audit kỹ thuật: đối chiếu đề bài VAIC 2026

Ngày cập nhật: 2026-07-18 (ICT) · Phiên bản: v0.7.0 · Phạm vi: mã nguồn trên `main`,
kiểm thử tự động và bản build cục bộ bằng Node 24.18.0.

## Kết luận

NekoPath **đã đạt hợp đồng kỹ thuật của hai yêu cầu cốt lõi**:

1. không dừng ở chấm đúng/sai mà chẩn đoán gốc kiến thức theo bằng chứng, kể cả khi hai học
   sinh cùng sai ở mục tiêu lớp 7;
2. tạo lộ trình bù đắp khác nhau từ gốc đã xác định tới mục tiêu, đồng thời từ chối kết luận khi
   bằng chứng chưa đủ.

Kết luận này là bằng chứng kỹ thuật có thể tái lập, **không phải** bằng chứng rằng sản phẩm đã cải
thiện kết quả học tập ngoài lớp học thật. Nội dung, nhãn đánh giá và dữ liệu hiện vẫn là bản nháp
hoặc tổng hợp như nêu ở mục Giới hạn.

## 1. Chẩn đoán hổng kiến thức gốc

| Điều cần chứng minh | Hiện thực | Bằng chứng chạy được |
|---|---|---|
| Cùng lỗi bề mặt có thể có gốc khác nhau | `diagnose()` dùng DAG tiên quyết, bằng chứng trực tiếp, xác suất thành thạo, tính hợp lệ phương pháp và mẫu sai; không suy gốc chỉ từ mã câu hiện tại | `server/adaptive-contract.test.ts`: ba học sinh đều sai hai câu K10. Bằng chứng nền thứ nhất tạo gốc K02; bằng chứng thứ hai tạo gốc K07; trường hợp chỉ có K10 trả `NEEDS_MORE_EVIDENCE` |
| Không đoán khi dữ liệu thưa hoặc mâu thuẫn | Kết quả có trạng thái `NEEDS_MORE_EVIDENCE`, câu hỏi phân biệt trong ngân sách và nhánh chuyển giáo viên khi hết ngân sách | `tests/eval/core.test.ts`, `src/app/adapters/hero-tutor.test.ts` và test đầu-cuối phía trên |
| Không gọi tên mẫu sai từ một quan sát đơn lẻ | Một misconception chỉ được đánh dấu là được nhiều câu hỗ trợ sau ít nhất hai item độc lập | `inferMisconceptionHypotheses()` và test “only marks a misconception pattern supported after two distinct items” |
| Không trộn bằng chứng giữa tài khoản | API chỉ đọc/ghi event của học sinh đã xác thực; một dòng khác chủ sở hữu làm hỏng toàn bộ snapshot thay vì nhận một phần | `server/app.test.ts`, `src/services/evidence-hydration.test.ts`, `src/app/adapters/hero-tutor.test.ts` |

Hai gốc trong test đầu-cuối đều nhắm cùng K10:

- học sinh 1: `K02 → K08 → K09 → K10`;
- học sinh 2: `K07 → K08 → K09 → K10`;
- học sinh 3: chưa có gốc và chưa có lộ trình vì chỉ có lỗi bề mặt.

Đây là khác biệt bản chất so với baseline “surface skill”, vốn luôn trả K10, và baseline đường cố
định, vốn luôn trả cùng một tiên quyết. So sánh được công khai trong `tests/eval/baselines.test.ts`.

## 2. Lộ trình luyện tập cá nhân hóa

`planPracticePath()` lấy gốc đã có bằng chứng và tìm đường hợp lệ trên DAG. Đường đồ thị vẫn được
giữ để giải thích; danh sách luyện tập chỉ giữ gốc, mục tiêu và các nút chưa vững/chưa đủ bằng
chứng. Vì vậy hai em có cùng bài sai không bị ép đi cùng một danh sách bài.

Luồng dữ liệu đã khép kín:

```text
Giáo viên giao câu hỏi
  → học sinh trả lời
  → máy chủ chấm và trả event có cấu trúc
  → trình duyệt lưu event đã xác nhận trước khi hiện bước tiếp theo
  → lần mở sau tải toàn bộ lịch sử đúng tài khoản
  → chuẩn hóa ID câu trong ngân hàng và câu trực tiếp
  → chẩn đoán lại, tạo lộ trình và chọn câu luyện tiếp theo
```

Các điểm kiểm chứng chính:

- `server/adaptive-contract.test.ts` đi xuyên qua Fastify thật và SQLite in-memory, không mock API;
- `AssignmentsPage.test.tsx` buộc lưu event máy chủ trước khi hiển thị hành động tiếp theo;
- `evidence-hydration.test.ts` chỉ nhận snapshot đầy đủ, có phân trang;
- `practice-selection.test.ts` tính câu đã làm trong bài giao vào tiến độ luyện tập;
- event được gộp append-only/idempotent; cùng ID nhưng nội dung khác bị cách ly, không ghi đè.

## 3. Góc nhìn giáo viên

Dashboard giáo viên hiện lấy dữ liệu từ máy chủ và **không thay event log rỗng bằng nhóm tổng hợp
giả**. Từ các câu trả lời đã lưu, hệ thống:

- nhóm theo gốc cần ôn, kiểm tra thêm hoặc cần giáo viên xem xét;
- hiển thị câu sai, lựa chọn của học sinh, đáp án đúng, thời gian và bài được giao;
- cho mở “Căn cứ của từng học sinh” để xem quyết định, số câu trả lời và từng lỗi trước khi giao bài;
- cho giáo viên điều chỉnh gợi ý với lý do bắt buộc; điều chỉnh không sửa lịch sử bằng chứng;
- đề xuất gói câu hỏi và người nhận cụ thể, nhưng giáo viên là người xác nhận giao.

Test đầu-cuối cũng kiểm tra bảng giáo viên có hai nhóm K02/K07 riêng và học sinh thiếu dữ liệu chỉ
nằm trong nhóm kiểm tra/xem xét, không bị xếp vào nhóm dạy lại.

## 4. Ngoại tuyến, băng thông thấp và toàn vẹn dữ liệu

| Khả năng | Trạng thái hiện tại |
|---|---|
| Shell và các route đã build | PWA build thành công; 45 mục precache, khoảng 814 KiB theo lần build audit này |
| JS khởi tạo | chunk chính khoảng 80 KiB gzip; WebLLM khoảng 2,1 MiB gzip là opt-in và nằm ngoài precache |
| Chẩn đoán/lộ trình học sinh | Chạy bằng TypeScript thuần trên thiết bị từ event log IndexedDB; không cần API mô hình |
| Mất mạng sau khi đã vào thiết bị | Hồ sơ đã xác nhận và dữ liệu cục bộ vẫn mở được; event nằm trong outbox và đồng bộ lại idempotent |
| Dữ liệu máy chủ khi trở lại mạng | Tải theo trang, chỉ merge sau snapshot đầy đủ, bỏ qua trạng thái không sẵn sàng thay vì chặn khởi động cục bộ |
| Tác vụ bắt buộc trực tuyến | Đăng nhập mới, tạo/giao bài, sửa học liệu và nhận dữ liệu máy chủ mới |

Repo chưa có Playwright harness hoặc lệnh `test:e2e`; tài liệu này không dùng một smoke test thủ
công để thay cho bằng chứng tự động. Test tích hợp Fastify + SQLite là cổng đầu-cuối hiện có.

## 5. Chương trình và nội dung

DAG JSON được phiên bản hóa, có nguồn/anchor và giới hạn lát cắt phân số–tỉ số–tỉ lệ thức. Tuy
nhiên các cạnh, câu hỏi, đáp án, gợi ý và cách diễn đạt can thiệp vẫn mang trạng thái
`UNREVIEWED` cho đến khi có người duyệt chuyên môn được nêu tên. Mô hình ngôn ngữ chỉ được giải
thích kết quả đã tính; không được đổi cạnh, đáp án, mastery, ưu tiên hoặc nhãn eval.

## 6. Kết quả kiểm tra tại thời điểm audit

Chạy bằng Node 24.18.0:

| Cổng | Kết quả |
|---|---:|
| `npm run format:check` | đạt |
| `npm run lint` | đạt |
| `npm run typecheck` | đạt |
| `npm run test -- --maxWorkers=1` | 31 file, 167 test đạt |
| `npm run eval` | 6 file, 29 test đạt |
| `npm run build` | đạt, tạo PWA artifacts |
| GitHub Actions `gate` của PR đầu-cuối | đạt |

Bộ eval tổng hợp hiện báo root top-1 83,3%, 0 kết luận tự tin nhưng sai và baseline luôn trả lời tốt
nhất 50%. Đây là development evidence công khai, không phải held-out benchmark.

## 7. Giới hạn còn lại

1. Chưa có pilot học sinh thật, đo learning gain, kiểm tra công bằng hoặc nhãn held-out do một
   người độc lập sở hữu.
2. Nội dung và quan hệ chương trình chưa được giáo viên Toán có tên duyệt; chỉ được mô tả ở Mức A.
3. Tài khoản/danh bạ hiện phục vụ walkthrough với dữ liệu mẫu; cơ chế một chạm không phải ranh
   giới bảo mật cho roster thật.
4. Trải nghiệm offline không thể nhận bài giao hoặc học liệu mới cho tới khi kết nối trở lại.
5. Audit này xác minh source/CI cục bộ; không khẳng định production đang chạy đúng commit mới nhất.

Vì vậy cách phát biểu chính xác là: **NekoPath đã triển khai và kiểm thử được cơ chế chẩn đoán gốc
và lộ trình cá nhân hóa theo bằng chứng; bước tiếp theo là duyệt chuyên môn và đánh giá độc lập với
học sinh thật.**
