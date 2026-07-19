# Kịch bản video demo — NekoPath (VAIC 2026) · bản 2, 19/07

Trạng thái: kịch bản quay chính thức cho bài nộp checkpoint 48h  
Ràng buộc BTC: video tối đa 5 phút, thể hiện sản phẩm thực sự hoạt động dưới góc nhìn người dùng cuối  
Sản phẩm quay: https://nekopath.holilihu.online (bản production, không quay localhost)

Khác bản 1: hệ thống nay đã có (và ĐƯỢC PHÉP quay) — video bài giảng + PDF do giáo viên tải lên
phát thật trên trang học sinh và ghim được ngoại tuyến; upload kéo-thả có đọc thời lượng/poster
ngay trên máy cô; trợ lý Neko trả lời bằng ChatGPT stream thật hoặc Gemma chạy ngay trong trình
duyệt; sinh biến thể câu hỏi bằng LLM đóng khung schema.

## 0. Việc PHẢI làm xong TRƯỚC khi bấm quay (không làm trong video)

1. **Cập nhật shell**: mở trang, bấm "Cập nhật ngay" nếu được hỏi, tải lại một lần.
2. **Đăng nhập ChatGPT cho Cô Hà** (một lần, ~1 phút):
   - Neko dock → Nguồn AI → **ChatGPT** → cửa sổ đăng nhập OpenAI mở ra → đăng nhập như bình thường.
   - Sau bước cuối, trình duyệt mở **trang localhost báo lỗi "This site can't be reached"** —
     **đó là bước cuối bình thường, không phải lỗi của mình**: bôi đen **toàn bộ địa chỉ** trên
     thanh URL của trang đó (bắt đầu `http://localhost:1455/auth/callback?code=…`), Ctrl+C.
   - Quay lại tab NekoPath: trong banner "Phiên đăng nhập ChatGPT đang chờ hoàn tất" có **ô nhập
     mới** với gợi ý `http://localhost:1455/auth/callback?code=…` — **Ctrl+V dán vào đó** → bấm
     **"Hoàn tất đăng nhập"** → dòng trạng thái chuyển "ChatGPT đã kết nối." Mã chỉ sống ~10
     phút: nếu bị từ chối, bấm "Mở lại trang đăng nhập" làm lại từ đầu.
3. **Tải trước Gemma** (nếu muốn quay cảnh offline-AI): chọn "Gemma · trên thiết bị", hỏi một câu
   bất kỳ, để thanh "Đang tải Gemma trên thiết bị… %" chạy hết (~600MB, một lần duy nhất).
4. Đăng nhập thử đủ 5 hồ sơ để dữ liệu đã nằm trên máy quay: An, Bình, Chi, Minh, Cô Hà.
5. Chuẩn bị 1 file video ngắn đã nén (MP4, < 60MB) và 1 PDF thật để quay cảnh upload.
6. DevTools (F12) → Network → biết chỗ bật **Offline**; thu nhỏ DevTools cho gọn khung hình.
7. Cửa sổ 1440×900, profile gọn gàng; thu tiếng thuyết minh riêng (~140 từ/phút).

Dữ liệu 4 học sinh mẫu (engine tính thật từ event — nếu màn hình ra khác kịch bản, giữ kết quả
thật và chỉnh lời thoại, không dàn dựng số liệu):

| Học sinh | Bằng chứng gieo sẵn | Kết quả engine |
|---|---|---|
| An | Sai Tỉ lệ thức (K10); 2 bằng chứng sai độc lập ở Phân số bằng nhau (K02) | Gốc K02, đường bù K02 → … → K10 |
| Bình | Cùng sai K10; K02 vững; 2 bằng chứng sai ở Tỉ số (K07) | Gốc K07 — cùng lỗi bề mặt, khác gốc |
| Chi | Bằng chứng mâu thuẫn | "Cần thêm bằng chứng" + một câu phân biệt |
| Minh | Tiên quyết vững, K10 đúng lại | Tiến nhanh + lịch ôn giãn cách |

## 1. Dòng thời gian 5 phút

### Cảnh 1 — Vấn đề + đăng nhập không mật khẩu (0:00 – 0:25)

Màn hình: trang đăng nhập.

> Một giáo viên, bốn mươi học sinh, bốn mươi trình độ. Ở vùng khó, mạng lúc có lúc không.
> NekoPath tìm đúng lỗ hổng kiến thức gốc của từng em — và chỉ cần mạng khi đồng bộ.

Thao tác: gõ "ngoc an" không dấu → chọn Trần Ngọc An → Đăng nhập.

> Học sinh chỉ cần nhớ tên mình — không email, không mật khẩu.

### Cảnh 2 — An: chẩn đoán gốc + bài học có video của cô (0:25 – 1:15)

Thao tác: Hôm nay → Kế hoạch của em → chỉ vào nhãn chẩn đoán và đường bù → mở bài học
"Phân số bằng nhau".

> An vừa sai một bài tỉ lệ thức. NekoPath không dừng ở "sai": hai bằng chứng độc lập cho thấy gốc
> rễ nằm ở phân số bằng nhau — lớp dưới. Lộ trình bù chỉ gồm kỹ năng thực sự cần.

Cuộn xuống "Video và tài liệu của bài": **bấm play video của cô** (3–4 giây có tiếng), chỉ vào
dòng ghi công "Nguyễn Thu Hà", bấm **"Lưu ngoại tuyến"** → nút chuyển "Đã lưu ✓".

> Bài học kèm video và phiếu PDF do chính cô giáo tải lên. Em bấm một nút để ghim về máy —
> từ giờ mở được cả khi mất mạng.

### Cảnh 3 — Bình: cùng lỗi, khác gốc (1:15 – 1:40)

Đổi hồ sơ → Bình → Kế hoạch của em.

> Bình sai đúng bài đó — nhưng bằng chứng chỉ về hướng khác: em đảo thứ tự khi lập tỉ số. Cùng
> một lỗi trên giấy, hai nguyên nhân, hai lộ trình. Một bài giảng chung cho cả lớp không làm được
> điều này.

### Cảnh 4 — Chi: dám nói "chưa biết" (1:40 – 2:05)

Đổi hồ sơ → Chi → "Cần thêm bằng chứng" → làm một câu phân biệt trong Kiểm tra thích ứng.

> Với Chi, bằng chứng mâu thuẫn. NekoPath từ chối dán nhãn — nó hỏi thêm đúng một câu được chọn
> để phân biệt hai giả thuyết. Không gán nhãn sai cho một đứa trẻ.

### Cảnh 5 — Minh: giỏi thì không bị giữ lại (2:05 – 2:25)

Đổi hồ sơ → Minh.

> Minh vững nền tảng — hệ thống cho em tiến thẳng lên bài khó hơn, và tự đặt lịch ôn giãn cách
> để kiến thức không rơi rụng. Học không dừng ở "đạt".

### Cảnh 6 — Cô Hà: dashboard + tải học liệu cho lớp (2:25 – 3:20)

Đổi hồ sơ → Cô Hà → Tổng quan lớp → Bài học cần ôn.

> Phía cô: hệ thống gom các em sai gần giống nhau theo từng bài, đề xuất gói câu ôn để cô duyệt
> trước khi giao. Điểm ưu tiên minh bạch từ số liệu — không hộp đen — và cô có toàn quyền ghi đè.

Mở **Học liệu** → chọn kỹ năng → **kéo-thả file video** vào vùng nhận: thẻ xem trước hiện
**poster + thời lượng đọc từ chính file, ngay trên máy cô** → giữ "Phát cho học sinh ngay" →
Tải lên (thanh % chạy).

> Cô kéo thả video bài giảng của chính mình. Máy cô tự đọc thời lượng và ảnh bìa — không cần
> server xử lý video. Một lựa chọn duy nhất: phát cho lớp ngay, hay giữ nháp.

### Cảnh 7 — Sự thật ngoại tuyến (3:20 – 4:05) · QUAY LIỀN MỘT MẠCH

Đổi hồ sơ → An → DevTools → **Offline** → mở lại bài học K02: tóm tắt vẫn đọc được, **video đã
ghim vẫn phát** → làm một câu Luyện tập → chỉ dòng "Ngoại tuyến — bài làm lưu trên thiết bị" →
bật mạng → dòng chuyển "Đã đồng bộ vừa xong".

> Giờ tắt mạng hoàn toàn. Chẩn đoán, lộ trình, bài học, cả video đã ghim — vẫn chạy, vì toàn bộ
> nằm trên thiết bị. Bài làm xếp hàng, có mạng là tự đồng bộ, không trùng lặp. Mạng là tiện
> nghi, không phải điều kiện.

### Cảnh 8 — AI đứng đúng chỗ (4:05 – 4:50)

Đổi hồ sơ → Cô Hà → mở Neko dock (Nguồn AI đang là ChatGPT · đã kết nối).

Hỏi: "Hôm nay nên dạy lại gì cho lớp?" — câu trả lời **stream từng chữ**, kèm dòng nguồn
"Kiểm tra Tổng quan lớp · đã đối chiếu".

> Trợ lý Neko trả lời bằng mô hình ngôn ngữ thật — nhưng mọi con số phải đi qua công cụ đọc dữ
> liệu hệ thống, lệch là bị thay bằng bản tính máy.

Bấm chip **"Sinh biến thể câu hỏi cho K02"** → hiện bản nháp câu hỏi mới, nhãn UNREVIEWED.

> LLM được đóng khung: sinh biến thể bài tập theo schema và danh mục lỗi thường gặp đã biên
> soạn — bản nháp chỉ thành câu hỏi thật khi cô duyệt. Không có mạng? Gemma 3 chạy ngay trong
> trình duyệt, tải một lần dùng offline.

### Cảnh 9 — Kết trung thực (4:50 – 5:00)

Màn hình: dashboard giáo viên.

> Lát cắt chương trình là bản đối chiếu GDPT 2018 đang chờ giáo viên chuyên môn duyệt — đó là
> bước tiếp theo của chúng tôi. NekoPath — nekopath punto holilihu punto online.

## 2. Câu được phép và câu cấm khi thuyết minh

Được phép (có bằng chứng trong repo/production):

1. "Video bài giảng và phiếu PDF do giáo viên tải lên, phát cho lớp, ghim ngoại tuyến từng máy."
2. "Máy của cô tự đọc thời lượng và ảnh bìa video trước khi tải lên — không cần server xử lý."
3. "Chẩn đoán chạy cục bộ, có quyền từ chối khi thiếu bằng chứng; LLM không quyết định đáp án,
   mastery hay lộ trình."
4. "Sinh biến thể bài tập theo schema, nhãn lỗi chỉ được lấy từ danh mục đã biên soạn, luôn là
   bản nháp chờ cô duyệt."
5. "Gemma 3 chạy ngay trong trình duyệt, tải một lần, dùng ngoại tuyến."
6. "Lát cắt Toán đối chiếu GDPT 2018, đang chờ giáo viên chuyên môn duyệt."

Cấm tuyệt đối:

- "Bao phủ CTGDPT 2018" / "bao phủ Toán 5–7".
- "AI tìm chính xác nguyên nhân" (engine trả giả thuyết có bằng chứng, có abstention).
- "Tiết kiệm X% thời gian" / "tăng Y% kết quả" (chưa pilot).
- Nói video có phụ đề/transcript nếu file quay chưa có (hệ thống ghi rõ "chưa có transcript").
- Mọi câu "SOTA", "thông minh hơn giáo viên", "tự động dạy thay".

## 3. Ghi chú kỹ thuật

- OBS 1080p/30fps, bật highlight con trỏ; quay rời từng cảnh rồi ghép, TRỪ cảnh 7 (offline) phải
  liền một mạch.
- Tổng 4:30–5:00. Nếu thiếu giờ: cắt cảnh 5 (Minh) trước, rồi rút cảnh 3 (Bình) còn một câu.
- Engine là thật: kết quả lệch kịch bản thì đổi lời thoại, không đổi số liệu.
- ChatGPT stream phụ thuộc mạng lúc quay — nếu chậm, quay lại cảnh đó; đừng tua nhanh giữa chừng
  (BTC soi cắt ghép).
