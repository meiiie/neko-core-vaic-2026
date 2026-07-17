# Design QA — sidebar điều hướng phẳng

- Source visual truth: `labs/ux-audit/sidebar-2026-07-18/selected-flat-active-reference.png`
- Implementation screenshots:
  - Desktop: `labs/ux-audit/sidebar-2026-07-18/implementation-desktop.png`
  - Mobile drawer: `labs/ux-audit/sidebar-2026-07-18/implementation-mobile.png`
- Viewport: desktop 1440 × 1024; mobile 390 × 844; DPR 1.
- State: hồ sơ học sinh Bình, route `/student/path`, mục “Lộ trình học” đang chọn; drawer mobile đang mở.

## Full-view comparison evidence

Reference và bản render desktop đã được mở trong cùng một lượt so sánh. Bản triển khai giữ đúng cấu trúc của phương án đã chọn: thương hiệu ở đầu sidebar, hai nhóm điều hướng “Học tập”/“Thiết bị”, tài khoản cố định ở cuối, và active state là một mảng màu phẳng. Tỷ lệ sidebar sau sửa là 288/1440 = 20%, gần tỷ lệ khoảng 20,8% của reference; phần nội dung chính không bị đổi ngoài phạm vi yêu cầu sidebar.

## Focused region comparison evidence

- Active row: nền `rgb(232, 242, 238)`, chữ `rgb(0, 94, 85)`, weight 700, radius 8 px, `box-shadow: none`, `border: 0`. Không có thanh cạnh, gradient, badge hay hiệu ứng 3D.
- Typography: nhãn nhóm 14/20 semibold; mục điều hướng 16/24; mục active dùng 700. Font hiện hữu của sản phẩm được giữ để không tạo drift ngoài phạm vi.
- Spacing/layout: hàng điều hướng cao tối thiểu 48 px, padding 12 × 16 px; header dùng cùng nhịp 72 px với top chrome; sidebar desktop rộng 288 px.
- Colors/tokens: active, pressed và active ink dùng semantic tokens riêng; màu đảm bảo active state rõ mà không dựa vào elevation.
- Image/asset quality: tiếp tục dùng `BrandMark` hiện hữu, không thay bằng emoji, CSS art hay placeholder.
- Copy/content: thứ tự và nhãn phản ánh công việc học sinh: Hôm nay → Kiểm tra thích ứng → Lộ trình học → Luyện tập → Bài được giao; CTA cuối là “Đổi hồ sơ”.
- Footer: DOM measurement xác nhận toàn bộ “Học sinh • Lớp 7A” hiển thị (`scrollWidth <= clientWidth`).
- Mobile: drawer 288 px, viewport không tràn ngang (`scrollWidth = 390`), body khóa cuộn khi mở, trạng thái active và focus-visible đều rõ.

## Findings

- Không còn finding P0, P1 hoặc P2.
- Không có lỗi console trong lượt render desktop và mobile cuối.

## Comparison history

1. Lượt đầu phát hiện P2 ở footer: sidebar 256 px làm phụ đề hồ sơ bị ellipsis.
   - Evidence: `labs/ux-audit/sidebar-2026-07-18/implementation-desktop-initial-256.png`.
   - Fix: đổi token `--sidebar-width` từ 16 rem sang 18 rem; không giảm cỡ chữ hay rút ngắn copy.
   - Post-fix evidence: `labs/ux-audit/sidebar-2026-07-18/implementation-desktop.png`; phụ đề hiển thị đầy đủ và tỷ lệ sidebar khớp reference hơn.
2. Lượt so sánh sau sửa không phát hiện P0/P1/P2; không cần thêm thay đổi trực quan.

## Primary interactions tested

- Đăng nhập bằng tài khoản mẫu Lê Thanh Bình.
- Điều hướng tới `/student/path` và xác nhận đúng mục active.
- Mở drawer mobile, xác nhận `aria-expanded="true"`, focus vào route hiện tại và body scroll lock.
- Unit test xác nhận Escape đóng drawer, hoàn trả focus và khôi phục body overflow.

## Implementation checklist

- [x] Active state phẳng, không thanh cạnh hay chiều sâu giả.
- [x] Nhãn và thứ tự điều hướng phù hợp vai trò học sinh.
- [x] Touch target tối thiểu 48 px.
- [x] Footer không cắt thông tin hồ sơ.
- [x] Không tràn ngang ở 390 px.
- [x] Console không có lỗi trong các state đã chụp.

## Follow-up polish

- Không có P3 cần chặn release này.

final result: passed
