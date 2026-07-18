# Kịch bản video demo — NekoPath (VAIC 2026)

Trạng thái: kịch bản quay chính thức cho bài nộp checkpoint 48h  
Ràng buộc BTC: video tối đa 5 phút, thể hiện sản phẩm thực sự hoạt động dưới góc nhìn người dùng cuối  
Nguồn cấu trúc: bốn câu chuyện demo trong `CURRICULUM_MAPPING_RESEARCH_AND_APPROVAL_PLAN.md` mục 32  
Sản phẩm quay: https://nekopath.holilihu.online (bản production, không quay localhost)

## 1. Chuẩn bị trước khi quay

1. Trình duyệt Chrome, cửa sổ 1440×900, profile sạch (không bookmark bar, không extension icon).
2. Mở https://nekopath.holilihu.online, Ctrl+Shift+R một lần để chắc chắn nhận bản mới nhất.
3. Đăng nhập thử một vòng cả năm tài khoản để dữ liệu IndexedDB đã sẵn trên máy quay:
   - Học sinh: **Trần Ngọc An** (`an@`), **Bình** (`binh@`), **Chi** (`chi@`), **Minh** (`minh@`).
   - Giáo viên: **Nguyễn Thu Hà** (`co.ha@`).
4. Chuẩn bị DevTools (F12) → tab Network → dropdown "No throttling / Offline" cho cảnh ngoại tuyến;
   thu nhỏ DevTools về mép dưới để khung hình gọn.
5. Thu tiếng thuyết minh riêng (hoặc phụ đề); tốc độ đọc chuẩn ~140 từ/phút — lời thoại dưới đây đã
   được đo cho từng cảnh.
6. Không quay: console DevTools (trừ cảnh offline), tab khác, thông tin cá nhân trên máy.

Bản chất dữ liệu bốn học sinh mẫu (để người quay hiểu điều sắp diễn ra — engine tính thật từ event,
không có kịch bản màn hình):

| Học sinh | Sự kiện gieo sẵn | Kết quả engine |
|---|---|---|
| An | Sai Tỉ lệ thức (K10); 2 bằng chứng sai độc lập ở **Phân số bằng nhau (K02)**; K01, K07 vững | Chẩn đoán gốc K02, đường bù K02 → … → K10 |
| Bình | Cùng sai K10; K02 vững; 2 bằng chứng sai ở **Thứ tự tỉ số (K07)** | Chẩn đoán gốc K07 — cùng lỗi bề mặt, khác gốc |
| Chi | Bằng chứng mâu thuẫn (K02: 1 đúng 1 sai; K07: 1 sai 1 đúng) | `Cần thêm bằng chứng` + một câu phân biệt |
| Minh | Mọi tiên quyết vững; K10 sai một lần rồi đúng hai lần | `Sẵn sàng tiến nhanh` (fast path) |

## 2. Kịch bản theo dòng thời gian

### Cảnh 1 — Vấn đề (0:00 – 0:30)

Màn hình: trang đăng nhập NekoPath (đã là cảnh sản phẩm, không dùng slide chèn).

> Một giáo viên, bốn mươi học sinh, và bốn mươi trình độ khác nhau. Ở vùng sâu, mạng lúc có lúc
> không. NekoPath là trợ giảng thích ứng cho lớp học đó: tìm đúng lỗ hổng kiến thức gốc của từng
> em, và chỉ cần mạng khi đồng bộ.

Thao tác: chạm ô "Bạn là ai?", danh sách lớp thả xuống, gõ "ngoc an" không dấu, chọn Trần Ngọc An,
bấm Đăng nhập. Nhấn mạnh bằng lời:

> Học sinh lớp 7 ở điểm trường chỉ cần nhớ tên mình — không email, không mật khẩu.

### Cảnh 2 — Cùng lỗi, khác gốc: An (0:30 – 1:20)

Màn hình: trang Hôm nay của An → mở "Lộ trình học".

> An vừa sai một bài tỉ lệ thức. Nhưng NekoPath không dừng ở "sai". Nhìn vào bằng chứng: hai câu
> độc lập cho thấy An hiểu nhầm phân số bằng nhau theo kiểu cộng thêm. Gốc rễ nằm ở kiến thức lớp
> dưới — và lộ trình bù chỉ gồm những kỹ năng thực sự cần, kèm lý do cho từng bước.

Thao tác: chỉ chuột vào nhãn trạng thái, số bằng chứng, và đường K02 → K10 trên trang lộ trình.
Bấm "Ôn tóm tắt" ở bước 1 để mở tài liệu tóm tắt kiến thức (ý chính, ví dụ có lời giải, lỗi
thường gặp) rồi nói:

> Mỗi bước có sẵn tài liệu tóm tắt nằm ngay trong ứng dụng — đọc được cả khi mất mạng — trước khi
> em bắt tay vào luyện tập.

### Cảnh 3 — Cùng lỗi, khác gốc: Bình (1:20 – 1:50)

Thao tác: Đổi hồ sơ → đăng nhập Bình → mở Lộ trình học.

> Bình sai đúng bài đó. Nhưng bằng chứng của Bình chỉ về hướng khác: em nắm chắc phân số, lại đảo
> thứ tự khi lập tỉ số. Cùng một lỗi trên giấy — hai nguyên nhân khác nhau — hai lộ trình khác
> nhau. Đây là điều một bài giảng chung cho cả lớp không làm được.

### Cảnh 4 — Dám nói "chưa biết": Chi (1:50 – 2:25)

Thao tác: Đổi hồ sơ → Chi → trang Hôm nay hiển thị "Cần thêm bằng chứng" → mở Kiểm tra thích ứng,
làm một câu phân biệt.

> Với Chi, bằng chứng đang mâu thuẫn. NekoPath từ chối gán nhãn — nó hỏi thêm đúng một câu được
> chọn để phân biệt hai giả thuyết, thay vì dán nhãn sai cho một đứa trẻ.

### Cảnh 5 — Học sinh giỏi không bị giữ lại: Minh (2:25 – 2:50)

Thao tác: Đổi hồ sơ → Minh → trang Hôm nay / Lộ trình hiển thị fast path.

> Minh đã vững toàn bộ nền tảng. Hệ thống cho em tiến thẳng tới bài chuyển giao khó hơn — không
> bắt em ngồi ôn lại thứ đã biết.

### Cảnh 6 — Bảng điều khiển giáo viên (2:50 – 3:45)

Thao tác: Đổi hồ sơ → Cô Hà → Tổng quan lớp → Nhóm cần hỗ trợ.

> Phía cô Hà: bốn mươi học sinh, ba mươi hai em đủ dữ liệu, tám em cần thêm câu hỏi. Mười hai em —
> ba mươi phần trăm sĩ số — cùng đủ bằng chứng về một lỗ hổng: phân số bằng nhau. Điểm ưu tiên
> minh bạch: số học sinh nhân số kỹ năng bị chặn phía sau, không phải một con số hộp đen. Cô chọn
> can thiệp nhóm mười hai phút, giao bài kiểm tra lại, và có toàn quyền ghi đè máy.

Thao tác phụ (nếu còn thời lượng): mở Giao bài, tạo bài giao nhanh cho nhóm.

### Cảnh 7 — Sự thật ngoại tuyến (3:45 – 4:30)

Thao tác: quay lại tài khoản học sinh (An) → DevTools Network → **Offline** → làm một câu Luyện
tập → chỉ vào dòng trạng thái sidebar "Ngoại tuyến — bài làm lưu trên thiết bị" → làm xong, bật
mạng lại → dòng trạng thái chuyển "n thay đổi chờ đồng bộ" rồi "Đã đồng bộ vừa xong".

> Giờ tắt mạng hoàn toàn. Chẩn đoán, lộ trình, luyện tập — vẫn chạy, vì toàn bộ engine nằm ngay
> trên thiết bị. Bài làm xếp hàng ở hộp thư đi, và khi có mạng trở lại, đồng bộ tự động, không
> trùng lặp. Mạng là tiện nghi, không phải điều kiện.

### Cảnh 8 — AI ở đâu, và lời kết trung thực (4:30 – 5:00)

Màn hình: quay lại dashboard giáo viên; nếu máy quay đã tải Gemma, mở Neko dock hỏi một câu tóm tắt
lớp; nếu không, giữ nguyên dashboard.

> AI của NekoPath là một mô hình học sinh xác suất cộng một bộ máy quyết định bị ràng buộc bởi đồ
> thị kiến thức — chạy hoàn toàn cục bộ, tái tạo được, và có quyền nói "chưa đủ bằng chứng". Mô
> hình ngôn ngữ, kể cả Gemma chạy ngay trong trình duyệt, chỉ diễn đạt kết quả đã tính — không bao
> giờ quyết định đáp án hay lộ trình. Lát cắt chương trình hiện là bản đối chiếu GDPT 2018 đang
> chờ giáo viên chuyên môn duyệt — và đó chính là bước tiếp theo của chúng tôi.
> NekoPath — nekopath.holilihu.online.

## 3. Câu được phép và câu cấm khi thuyết minh

Được phép (đã có bằng chứng tương ứng trong repo):

1. "Chẩn đoán chạy cục bộ, có quyền từ chối khi thiếu bằng chứng; mô hình ngôn ngữ không thay đổi
   quyết định."
2. "Mỗi câu hỏi trong demo truy được tới kỹ năng, yêu cầu cần đạt và nguồn chương trình."
3. "Lát cắt Toán được biên soạn đối chiếu GDPT 2018, đang chờ giáo viên chuyên môn duyệt."
4. "Mỗi kỹ năng có tài liệu tóm tắt do đội biên soạn, nằm sẵn trong ứng dụng và mở được khi mất
   mạng." (KHÔNG nói "video" — video là lộ trình phát triển, chưa có trong MVP.)

Cấm tuyệt đối (chưa có gate hoặc pilot tương ứng):

- "Bao phủ CTGDPT 2018" / "bao phủ Toán lớp 5–7".
- "AI tìm chính xác nguyên nhân" (engine trả giả thuyết có bằng chứng, có abstention).
- "Tiết kiệm X% thời gian giáo viên" / "tăng Y% kết quả học tập".
- "Đánh giá năng lực theo CTGDPT" (chưa có rubric được duyệt).
- Mọi câu có "SOTA", "thông minh hơn giáo viên", "tự động dạy thay".

## 4. Ghi chú kỹ thuật

- Quay bằng OBS hoặc trình quay màn hình hệ điều hành, 1080p, 30fps; con trỏ chuột bật highlight.
- Mỗi cảnh quay rời rồi ghép; giữ tổng thời lượng 4:30 – 5:00.
- Cảnh offline phải quay liền một mạch (tắt mạng → làm bài → bật mạng → đồng bộ) để không bị nghi
  cắt ghép.
- Nếu một cảnh cho kết quả khác kịch bản (engine là thật, không phải mô phỏng), giữ nguyên kết quả
  thật và điều chỉnh lời thoại — không dàn dựng lại số liệu.
