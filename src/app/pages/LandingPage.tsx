import { Link } from 'react-router-dom';
import { BrandMark } from '../../components/BrandMark';

/**
 * Public introduction shown at "/" before sign-in, styled as an industrial
 * studio page: warm-black ground, monospace uppercase display type, vermilion
 * accent, giant numbered sections and a scrolling capability ticker. Claims
 * mirror what the implementation demonstrates. Signed-in sessions never see
 * this page — the root route redirects them into their workspace.
 *
 * Deliberate exception to the product's reduced-motion rule: the landing's
 * ambience animates regardless of prefers-reduced-motion (product owner's
 * call); the workspace behind sign-in keeps full reduced-motion discipline.
 */

function LandingBackdrop() {
  return (
    <div className="landing-backdrop" aria-hidden="true">
      <svg
        className="landing-backdrop-map"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <g className="backdrop-cluster backdrop-cluster-1">
          <path className="backdrop-edge backdrop-flow" d="M 146 190 L 300 122" />
          <path className="backdrop-edge backdrop-flow" d="M 306 122 L 452 208" />
          <path className="backdrop-edge backdrop-edge-review" d="M 458 208 L 590 150" />
          <circle className="backdrop-node" cx="140" cy="192" r="7" />
          <circle className="backdrop-node backdrop-node-pulse" cx="303" cy="120" r="7" />
          <circle className="backdrop-node" cx="455" cy="210" r="7" />
          <circle className="backdrop-node-open" cx="596" cy="148" r="7" />
          <circle className="backdrop-ripple" cx="303" cy="120" r="7" />
          <circle className="backdrop-traveler backdrop-traveler-b" r="5" />
        </g>

        <g className="backdrop-cluster backdrop-cluster-2">
          <path className="backdrop-edge backdrop-flow" d="M 1176 142 L 1296 258" />
          <path className="backdrop-edge backdrop-flow" d="M 1290 262 L 1108 320" />
          <path className="backdrop-edge backdrop-edge-review" d="M 1108 326 L 1246 428" />
          <circle className="backdrop-node backdrop-node-pulse" cx="1172" cy="138" r="7" />
          <circle className="backdrop-node" cx="1300" cy="260" r="7" />
          <circle className="backdrop-node" cx="1104" cy="322" r="7" />
          <circle className="backdrop-node-open" cx="1250" cy="432" r="7" />
          <circle className="backdrop-ripple backdrop-ripple-late" cx="1172" cy="138" r="7" />
        </g>

        <g className="backdrop-cluster backdrop-cluster-3">
          <path className="backdrop-edge backdrop-flow" d="M 656 642 L 796 726" />
          <path className="backdrop-edge backdrop-flow" d="M 802 724 L 946 662" />
          <circle className="backdrop-node" cx="650" cy="640" r="7" />
          <circle className="backdrop-node backdrop-node-pulse" cx="800" cy="728" r="7" />
          <circle className="backdrop-node" cx="950" cy="660" r="7" />
          <circle className="backdrop-ripple backdrop-ripple-later" cx="800" cy="728" r="7" />
        </g>

        <g>
          <path
            className="backdrop-edge backdrop-flow backdrop-edge-long"
            d="M 80 480 C 400 420, 700 520, 1000 460 S 1360 420, 1420 470"
          />
          <circle className="backdrop-traveler" r="5.5" />
        </g>

        {/* Sine/cosine plot; the ball runs the sine curve end to end. */}
        <g className="backdrop-graph" transform="translate(110, 590)">
          <line className="backdrop-axis" x1="0" y1="100" x2="420" y2="100" />
          <line className="backdrop-axis" x1="0" y1="-10" x2="0" y2="210" />
          <path
            className="backdrop-sine"
            d="M 0 100 C 25 30, 75 30, 100 100 S 175 170, 200 100 S 275 30, 300 100 S 375 170, 400 100"
          />
          <path
            className="backdrop-cosine"
            d="M 0 40 C 35 40, 65 160, 100 160 S 165 40, 200 40 S 265 160, 300 160 S 365 40, 400 40"
          />
          <circle className="backdrop-graph-ball" r="8" />
        </g>

        <g className="backdrop-desk">
          <g transform="translate(660, 78) rotate(-24)">
            <g className="backdrop-tool backdrop-tool-pencil">
              <rect x="0" y="0" width="96" height="14" rx="3" />
              <path d="M 96 0 L 114 7 L 96 14 Z" />
              <rect x="-13" y="0" width="13" height="14" rx="3" />
              <line x1="30" y1="0" x2="30" y2="14" />
            </g>
          </g>
          <g transform="translate(120, 320) rotate(9)">
            <g className="backdrop-tool backdrop-tool-ruler">
              <rect x="0" y="0" width="170" height="30" rx="4" />
              <line x1="22" y1="0" x2="22" y2="9" />
              <line x1="44" y1="0" x2="44" y2="14" />
              <line x1="66" y1="0" x2="66" y2="9" />
              <line x1="88" y1="0" x2="88" y2="14" />
              <line x1="110" y1="0" x2="110" y2="9" />
              <line x1="132" y1="0" x2="132" y2="14" />
              <line x1="154" y1="0" x2="154" y2="9" />
            </g>
          </g>
          <g transform="translate(1270, 620) rotate(-12)">
            <g className="backdrop-tool backdrop-tool-protractor">
              <path d="M -72 0 A 72 72 0 0 1 72 0 Z" />
              <line x1="0" y1="0" x2="0" y2="-58" />
              <line x1="-36" y1="0" x2="-29" y2="-50" />
              <line x1="36" y1="0" x2="29" y2="-50" />
            </g>
          </g>
        </g>

        <g className="backdrop-layer backdrop-drift-b">
          <text className="backdrop-glyph" x="250" y="440">
            ¾
          </text>
          <text className="backdrop-glyph" x="700" y="150">
            √
          </text>
          <text className="backdrop-glyph" x="950" y="240">
            a : b
          </text>
          <text className="backdrop-glyph" x="560" y="810">
            ½
          </text>
          <text className="backdrop-glyph" x="1348" y="520">
            π
          </text>
          <text className="backdrop-glyph" x="850" y="560">
            ×
          </text>
          <text className="backdrop-glyph" x="104" y="840">
            =
          </text>
          <text className="backdrop-glyph" x="1150" y="820">
            ÷
          </text>
          <text className="backdrop-glyph" x="640" y="360">
            %
          </text>
        </g>
      </svg>
      <img
        className="landing-watermark"
        src="/brand/nekopath-mark-v1-512.png"
        alt=""
        decoding="async"
        loading="lazy"
      />
    </div>
  );
}

const TICKER_ITEMS = [
  'Chẩn đoán gốc rễ',
  'Hỏi thêm khi thiếu bằng chứng',
  'Lộ trình cá nhân theo bằng chứng',
  'Hoạt động ngoại tuyến',
  'Giáo viên ra quyết định',
  'Toán 7 · GDPT 2018',
  'PWA cài được trên thiết bị',
];

const HOW_IT_WORKS = [
  {
    title: 'Tìm đúng lỗ hổng gốc',
    body:
      'Đúng/sai, cách làm và dấu hiệu hiểu nhầm được ghi nhận tách bạch. Hệ thống lần theo ' +
      'đồ thị kiến thức nền để chỉ ra lỗ hổng sớm nhất có thể can thiệp — không chỉ chấm điểm câu trả lời.',
  },
  {
    title: 'Không đoán khi thiếu bằng chứng',
    body:
      'Khi bằng chứng chưa đủ hoặc mâu thuẫn, NekoPath dừng lại và hỏi thêm đúng một câu phân biệt ' +
      'thay vì gán nhãn sai cho học sinh. Một hiểu nhầm chỉ được gọi tên khi xuất hiện ở hai bài độc lập.',
  },
  {
    title: 'Giáo viên ra quyết định',
    body:
      'Bảng điều khiển nhóm cả lớp theo nhu cầu, xếp ưu tiên minh bạch trong ngân sách 15 phút của ' +
      'giáo viên. Mỗi kết luận đều mở ngược được xuống từng câu trả lời phía sau nó.',
  },
];

const STUDENT_CAPABILITIES = [
  'Kiểm tra thích ứng với số câu hỏi giới hạn, chọn câu tiếp theo theo lượng thông tin thu được',
  'Lộ trình học nêu rõ lý do của từng bước, không bắt học lại phần đã vững',
  'Bài đọc tóm tắt theo kỹ năng mở được cả khi mất mạng',
  'Luyện tập theo mức độ thành thạo với thang gợi ý ba bậc',
  'Lịch sử học theo tài khoản — đổi thiết bị vẫn khôi phục được',
];

const TEACHER_CAPABILITIES = [
  'Tổng quan lớp nhóm theo nhu cầu, tính từ dữ liệu đồng bộ thật',
  'Truy vết bằng chứng từng học sinh xuống tận câu trả lời',
  'Hàng chờ xác minh các hiểu nhầm hệ thống nghi ngờ',
  'Tự soạn câu hỏi và học liệu, xuất bản dưới tên giáo viên',
  'Giao bài với hạn nộp và chính sách làm lại, theo dõi tiến độ',
];

const OFFLINE_CARDS = [
  {
    title: 'Hoạt động khi mất mạng',
    body:
      'Sau lần tải đầu, chẩn đoán, lộ trình, bài đọc và luyện tập chạy từ bộ nhớ thiết bị. ' +
      'Sự kiện học xếp hàng chờ và tự đồng bộ khi có mạng, chống ghi trùng.',
  },
  {
    title: 'Dữ liệu được tôn trọng',
    body:
      'Phiên làm việc dùng cookie an toàn thay vì token trong bộ nhớ trình duyệt; thiết bị ' +
      'chỉ giữ hồ sơ đã rút gọn, không bao giờ lưu mật khẩu ngoại tuyến.',
  },
  {
    title: 'Trợ lý chỉ thuật lại',
    body:
      'Trợ lý Neko diễn giải kết quả mà lõi chẩn đoán đã tính xong — không bao giờ tự ' +
      'quyết định đáp án, mức thành thạo hay lộ trình học của học sinh.',
  },
];

const HONEST_NOTES = [
  'Sản phẩm được xây trong 48 giờ cho VAIC 2026; danh sách lớp và sự kiện học là dữ liệu mẫu, không phải hồ sơ học sinh thật.',
  'Lát cắt Toán 7 được soạn theo định hướng GDPT 2018 nhưng còn chờ giáo viên toán được nêu tên duyệt chính thức.',
  'Đăng nhập bằng cách chọn tên trong danh sách lớp là cơ chế trình diễn, không phải ranh giới định danh bảo mật cho trường học thật.',
  'Chưa có khẳng định nào về hiệu quả học tập đã kiểm chứng — đánh giá hiện tại chạy trên bộ dữ liệu tổng hợp được công khai.',
];

function EvidenceDemoCard() {
  return (
    <figure className="landing-hero-card">
      <span className="landing-card-seal" aria-hidden="true">
        <BrandMark size={34} />
      </span>
      <figcaption className="landing-demo-tag">
        Minh họa cách NekoPath lập luận từ bằng chứng
      </figcaption>
      <dl className="landing-demo-signals">
        <div>
          <dt>Câu trả lời</dt>
          <dd>So sánh 3/4 và 5/6 — chọn sai</dd>
        </div>
        <div>
          <dt>Cách làm</dt>
          <dd>Trình bày hợp lệ, sai ở bước quy đồng</dd>
        </div>
        <div>
          <dt>Dấu hiệu lặp lại</dt>
          <dd>Cộng thẳng hai mẫu số · thấy ở 2 bài độc lập</dd>
        </div>
      </dl>
      <div className="landing-demo-verdict">
        <p className="landing-demo-label">Chẩn đoán</p>
        <p className="landing-demo-headline">Gốc rễ: Quy đồng mẫu số</p>
        <div className="landing-demo-path" aria-label="Lộ trình đề xuất">
          <span className="landing-demo-step">Quy đồng mẫu số</span>
          <span className="landing-demo-arrow" aria-hidden="true">
            →
          </span>
          <span className="landing-demo-step">So sánh phân số</span>
          <span className="landing-demo-arrow" aria-hidden="true">
            →
          </span>
          <span className="landing-demo-step">Tỉ lệ thức</span>
        </div>
      </div>
      <p className="landing-demo-abstain">
        Khi chưa đủ bằng chứng, hệ thống trả lời <strong>«Cần thêm bằng chứng»</strong> và hỏi thêm
        một câu phân biệt thay vì gán nhãn vội.
      </p>
    </figure>
  );
}

/**
 * Eased scroll to an in-page section. Hand-rolled with requestAnimationFrame
 * because Chromium ignores `scroll-behavior: smooth` when the OS requests
 * reduced motion, and the landing deliberately keeps its motion (see the
 * page comment above). Duration scales with distance so far sections glide
 * rather than jump.
 */
function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const headerOffset = 72;
  const startY = window.scrollY;
  const endY = target.getBoundingClientRect().top + startY - headerOffset;
  const distance = endY - startY;
  const duration = Math.min(1400, Math.max(600, Math.abs(distance) * 0.45));
  const startTime = performance.now();
  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const frame = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration);
    window.scrollTo({ top: startY + distance * easeInOutCubic(t), behavior: 'instant' });
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.history.replaceState(null, '', `#${id}`);
}

export function LandingPage() {
  return (
    <div className="landing">
      <LandingBackdrop />
      <header className="landing-header">
        <div className="landing-header-inner">
          <span className="brand-lockup">
            <BrandMark size={32} />
            NekoPath
          </span>
          <nav className="landing-nav" aria-label="Điều hướng trang giới thiệu">
            <a href="#how-it-works" onClick={(e) => scrollToSection(e, 'how-it-works')}>
              Cách hoạt động
            </a>
            <a href="#workspaces" onClick={(e) => scrollToSection(e, 'workspaces')}>
              Không gian
            </a>
            <a href="#honesty" onClick={(e) => scrollToSection(e, 'honesty')}>
              Cam kết
            </a>
          </nav>
          <Link className="landing-btn landing-btn-solid" to="/login">
            Đăng nhập
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-badge">VAIC 2026 · Giáo dục &amp; Đào tạo · Neko Core</p>
            <h1>
              Trợ giảng thích ứng
              <br />
              <em>cho lớp học đa trình độ</em>
            </h1>
            <p className="landing-lead">
              NekoPath lần theo lỗi sai của học sinh về đúng lỗ hổng kiến thức gốc, hỏi thêm khi
              chưa đủ bằng chứng, và trao cho giáo viên một kế hoạch can thiệp vừa với 15 phút trên
              lớp.
            </p>
            <div className="landing-cta">
              <Link className="landing-btn landing-btn-solid" to="/login">
                Đăng nhập để bắt đầu
              </Link>
              <a
                className="landing-btn landing-btn-ghost"
                href="#how-it-works"
                onClick={(e) => scrollToSection(e, 'how-it-works')}
              >
                Xem cách hoạt động <span aria-hidden="true">→</span>
              </a>
            </div>
            <p className="landing-scroll-hint" aria-hidden="true">
              Cuộn
            </p>
          </div>
          <EvidenceDemoCard />
        </section>

        <div className="landing-ticker" aria-hidden="true">
          <div className="landing-ticker-track">
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
              <span key={`${item}-${index}`} className="landing-ticker-item">
                <span className="landing-ticker-star">✦</span>
                {item}
              </span>
            ))}
          </div>
        </div>

        <section id="how-it-works" className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-num">01</span>
            <h2>Chẩn đoán gốc rễ, trung thực với bằng chứng</h2>
          </div>
          <div className="landing-grid landing-grid-3">
            {HOW_IT_WORKS.map((step, index) => (
              <article key={step.title} className="landing-card">
                <span className="landing-step-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workspaces" className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-num">02</span>
            <h2>Học sinh học đúng bước, giáo viên nắm cả lớp</h2>
          </div>
          <div className="landing-grid landing-grid-2">
            <article className="landing-card">
              <h3>Dành cho học sinh</h3>
              <ul>
                {STUDENT_CAPABILITIES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="landing-card">
              <h3>Dành cho giáo viên</h3>
              <ul>
                {TEACHER_CAPABILITIES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-num">03</span>
            <h2>Cục bộ trước, đồng bộ sau</h2>
          </div>
          <div className="landing-grid landing-grid-3">
            {OFFLINE_CARDS.map((card) => (
              <article key={card.title} className="landing-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="honesty" className="landing-section">
          <div className="landing-section-head">
            <span className="landing-section-num">04</span>
            <h2>Nói đúng những gì đã làm</h2>
          </div>
          <div className="landing-honesty-card">
            <ul className="landing-honesty-list">
              {HONEST_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="brand-lockup">
            <BrandMark size={28} />
            NekoPath
          </span>
          <nav className="landing-footer-links" aria-label="Liên kết chân trang">
            <Link to="/login">Đăng nhập</Link>
            <a
              href="https://github.com/meiiie/neko-core-vaic-2026"
              target="_blank"
              rel="noreferrer"
            >
              Mã nguồn (MIT)
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
