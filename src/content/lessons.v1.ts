/**
 * Tóm tắt kiến thức theo từng KC — vai trò EXPLAIN trong vòng học
 * Explain → Practice → Post-check (LMS_hohulili lesson-section pattern,
 * adapted: thay vì tải theo khoá học, học liệu nằm ngay trong content pack
 * nên offline mặc định từ lần tải đầu).
 *
 * Toàn bộ nội dung do đội biên soạn (TEAM_AUTHORED) và giữ UNREVIEWED cho
 * đến khi có người duyệt chuyên môn được nêu tên; mọi bề mặt hiển thị phải
 * kèm nhãn nháp. Mỗi "lỗi thường gặp" bám đúng misconception mà engine chẩn
 * đoán trên KC đó.
 */

export interface LessonSummary {
  readonly kcId: string;
  readonly titleVi: string;
  /** 3–4 ý chính, mỗi ý một câu ngắn. */
  readonly keyPointsVi: readonly string[];
  readonly workedExampleVi: {
    readonly problem: string;
    readonly steps: readonly string[];
  };
  /** Lỗi hay gặp — khớp misconception catalog của engine. */
  readonly commonMistakeVi: string;
  readonly reviewState: 'UNREVIEWED';
}

export const LESSON_SUMMARIES: readonly LessonSummary[] = [
  {
    kcId: 'K01',
    titleVi: 'Ý nghĩa và biểu diễn phân số',
    keyPointsVi: [
      'Phân số a/b cho biết: chia cái toàn thể thành b phần bằng nhau, lấy a phần.',
      'Tử số (trên) là số phần được lấy; mẫu số (dưới) là tổng số phần bằng nhau.',
      'Mẫu số luôn khác 0 — không thể chia một vật thành 0 phần.',
    ],
    workedExampleVi: {
      problem:
        'Một chiếc bánh cắt thành 8 miếng bằng nhau, em ăn 3 miếng. Viết phân số chỉ phần bánh đã ăn.',
      steps: [
        'Tổng số phần bằng nhau là 8 → mẫu số là 8.',
        'Số phần đã ăn là 3 → tử số là 3.',
        'Phần bánh đã ăn là 3/8.',
      ],
    },
    commonMistakeVi:
      'Viết ngược tử và mẫu (8/3 thay vì 3/8). Hãy tự hỏi: "chia mấy phần?" — số đó nằm DƯỚI.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K02',
    titleVi: 'Phân số bằng nhau',
    keyPointsVi: [
      'Nhân CẢ tử và mẫu với cùng một số khác 0 thì giá trị phân số không đổi.',
      'Chia CẢ tử và mẫu cho cùng một số khác 0 cũng vậy.',
      'Kiểm tra bằng nhân chéo: a/b = c/d khi a×d = b×c.',
    ],
    workedExampleVi: {
      problem: 'Tìm số thích hợp: 2/3 = ?/12.',
      steps: [
        'Mẫu số đi từ 3 lên 12, tức là nhân với 4.',
        'Tử số phải nhân với CÙNG số đó: 2 × 4 = 8.',
        'Vậy 2/3 = 8/12. Kiểm tra: 2 × 12 = 24 = 3 × 8. Đúng.',
      ],
    },
    commonMistakeVi:
      'CỘNG cùng một số vào tử và mẫu (2/3 → 3/4) — sai, vì bằng nhau chỉ giữ được khi NHÂN hoặc CHIA, không phải cộng.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K03',
    titleVi: 'Rút gọn phân số',
    keyPointsVi: [
      'Rút gọn = chia cả tử và mẫu cho cùng một ước chung, giá trị không đổi.',
      'Phân số tối giản khi tử và mẫu không còn ước chung nào lớn hơn 1.',
      'Chia cho ước chung lớn nhất thì rút gọn được trong một bước.',
    ],
    workedExampleVi: {
      problem: 'Rút gọn 18/24 về phân số tối giản.',
      steps: [
        'Ước chung lớn nhất của 18 và 24 là 6.',
        'Chia cả hai: 18 ÷ 6 = 3 và 24 ÷ 6 = 4.',
        'Vậy 18/24 = 3/4; 3 và 4 không còn ước chung nên đã tối giản.',
      ],
    },
    commonMistakeVi:
      'Chỉ chia tử hoặc chỉ chia mẫu. Phải chia CẢ HAI cho cùng một số thì giá trị mới được giữ nguyên.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K04',
    titleVi: 'Quy đồng mẫu số',
    keyPointsVi: [
      'Quy đồng = đưa các phân số về CÙNG mẫu số mà không đổi giá trị từng phân số.',
      'Chọn mẫu số chung (thường là mẫu số chung nhỏ nhất của các mẫu).',
      'Nhân tử và mẫu của mỗi phân số với thừa số phụ tương ứng.',
    ],
    workedExampleVi: {
      problem: 'Quy đồng 1/4 và 5/6.',
      steps: [
        'Mẫu số chung nhỏ nhất của 4 và 6 là 12.',
        '1/4 = (1×3)/(4×3) = 3/12 (thừa số phụ 3).',
        '5/6 = (5×2)/(6×2) = 10/12 (thừa số phụ 2).',
      ],
    },
    commonMistakeVi:
      'Đổi mẫu số nhưng quên nhân tử số theo cùng thừa số phụ — phân số bị đổi giá trị mà không nhận ra.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K05',
    titleVi: 'So sánh phân số',
    keyPointsVi: [
      'Cùng mẫu số: phân số nào tử lớn hơn thì lớn hơn.',
      'Khác mẫu số: quy đồng về cùng mẫu rồi mới so sánh tử.',
      'Có thể so sánh nhanh với mốc 1/2 hoặc 1 khi phù hợp.',
    ],
    workedExampleVi: {
      problem: 'So sánh 3/4 và 5/7.',
      steps: [
        'Quy đồng: mẫu chung 28 → 3/4 = 21/28 và 5/7 = 20/28.',
        'So tử: 21 > 20.',
        'Vậy 3/4 > 5/7.',
      ],
    },
    commonMistakeVi:
      'So sánh thẳng tử với tử, mẫu với mẫu khi mẫu khác nhau (thấy 5 > 3 vội kết luận 5/7 > 3/4) — phải cùng mẫu mới so được.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K06',
    titleVi: 'Phép tính với phân số',
    keyPointsVi: [
      'Cộng, trừ: phải CÙNG mẫu số trước (quy đồng), rồi cộng/trừ tử, giữ nguyên mẫu.',
      'Nhân: tử nhân tử, mẫu nhân mẫu; nên rút gọn trước khi nhân.',
      'Chia: nhân với phân số đảo ngược của số chia.',
    ],
    workedExampleVi: {
      problem: 'Tính 1/2 + 1/3.',
      steps: [
        'Quy đồng: mẫu chung 6 → 1/2 = 3/6 và 1/3 = 2/6.',
        'Cộng tử, giữ mẫu: 3/6 + 2/6 = 5/6.',
      ],
    },
    commonMistakeVi:
      'Cộng thẳng tử với tử, mẫu với mẫu (1/2 + 1/3 = 2/5) — mẫu số là "đơn vị đo", phải cùng đơn vị mới cộng được.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K07',
    titleVi: 'Ý nghĩa và thứ tự của tỉ số',
    keyPointsVi: [
      'Tỉ số của a và b (b ≠ 0) là a : b, viết được thành phân số a/b.',
      'THỨ TỰ quan trọng: tỉ số "của nam so với nữ" khác tỉ số "của nữ so với nam".',
      'Đại lượng đứng trước trong câu là tử; đại lượng so với là mẫu.',
    ],
    workedExampleVi: {
      problem: 'Lớp có 18 nam và 12 nữ. Tìm tỉ số của số nữ so với số nam.',
      steps: [
        '"Số nữ so với số nam" → nữ đứng trước: 12 : 18.',
        'Viết thành phân số và rút gọn: 12/18 = 2/3.',
      ],
    },
    commonMistakeVi:
      'Đảo ngược thứ tự (viết 18/12 khi được hỏi nữ so với nam). Đọc kỹ đại lượng nào "so với" đại lượng nào.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K08',
    titleVi: 'Các tỉ số bằng nhau',
    keyPointsVi: [
      'Hai tỉ số bằng nhau khi hai phân số tương ứng bằng nhau.',
      'Nhân hoặc chia cả hai vế của tỉ số với cùng một số khác 0 thì tỉ số không đổi.',
      'Kiểm tra bằng nhân chéo giống phân số bằng nhau.',
    ],
    workedExampleVi: {
      problem: 'Hỏi 6 : 9 và 10 : 15 có bằng nhau không?',
      steps: [
        'Rút gọn từng tỉ số: 6/9 = 2/3 và 10/15 = 2/3.',
        'Hai kết quả bằng nhau → 6 : 9 = 10 : 15.',
        'Kiểm tra chéo: 6 × 15 = 90 = 9 × 10. Đúng.',
      ],
    },
    commonMistakeVi:
      'Cộng thêm cùng một số vào hai vế (6:9 → 7:10) rồi cho là "vẫn bằng" — tỉ số chỉ giữ nguyên khi NHÂN/CHIA.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K09',
    titleVi: 'Tỉ lệ thức',
    keyPointsVi: [
      'Tỉ lệ thức là ĐẲNG THỨC giữa hai tỉ số: a/b = c/d.',
      'Tính chất cơ bản: a×d = b×c (tích chéo bằng nhau).',
      'Muốn khẳng định bốn số lập thành tỉ lệ thức, phải KIỂM TRA tích chéo, không đoán.',
    ],
    workedExampleVi: {
      problem: 'Bốn số 3, 4, 9, 12 có lập thành tỉ lệ thức 3/4 = 9/12 không?',
      steps: [
        'Tính tích chéo: 3 × 12 = 36 và 4 × 9 = 36.',
        'Hai tích bằng nhau → 3/4 = 9/12 là tỉ lệ thức đúng.',
      ],
    },
    commonMistakeVi:
      'Khẳng định hai tỉ số bằng nhau mà không kiểm chứng tích chéo — "nhìn có vẻ bằng" không phải là chứng minh.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K10',
    titleVi: 'Tìm giá trị chưa biết trong tỉ lệ thức',
    keyPointsVi: [
      'Từ a/b = c/d suy ra a×d = b×c — dùng tích chéo để lập phương trình.',
      'Số chưa biết = tích của hai số chéo với nó, chia cho số còn lại.',
      'Luôn thử lại kết quả vào tỉ lệ thức ban đầu.',
    ],
    workedExampleVi: {
      problem: 'Tìm x biết x/6 = 10/15.',
      steps: [
        'Tích chéo: x × 15 = 6 × 10.',
        'x × 15 = 60 → x = 60 ÷ 15 = 4.',
        'Thử lại: 4/6 = 2/3 và 10/15 = 2/3. Đúng.',
      ],
    },
    commonMistakeVi:
      'Nhân chéo xong bỏ dở — quên bước CHIA cho số còn lại (dừng ở x×15 = 60 rồi lấy x = 60). Phải hoàn tất phép chia.',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K11',
    titleVi: 'Đại lượng tỉ lệ thuận',
    keyPointsVi: [
      'Hai đại lượng tỉ lệ thuận khi thương của chúng luôn KHÔNG ĐỔI: y = k×x.',
      'Đại lượng này tăng bao nhiêu lần, đại lượng kia tăng bấy nhiêu lần.',
      'Giải bằng cách tìm hệ số k hoặc lập tỉ lệ thức giữa hai cặp giá trị.',
    ],
    workedExampleVi: {
      problem: 'Mua 3 quyển vở hết 21 000 đồng. Hỏi mua 5 quyển cùng loại hết bao nhiêu?',
      steps: [
        'Số vở và số tiền tỉ lệ thuận. Giá một quyển: 21 000 ÷ 3 = 7 000 đồng.',
        'Mua 5 quyển: 5 × 7 000 = 35 000 đồng.',
      ],
    },
    commonMistakeVi:
      'Áp dụng tỉ lệ thuận cho hai đại lượng không thực sự tỉ lệ (không kiểm tra thương có không đổi hay không).',
    reviewState: 'UNREVIEWED',
  },
  {
    kcId: 'K12',
    titleVi: 'Đại lượng tỉ lệ nghịch',
    keyPointsVi: [
      'Hai đại lượng tỉ lệ nghịch khi TÍCH của chúng luôn không đổi: x×y = a.',
      'Đại lượng này tăng bao nhiêu lần thì đại lượng kia GIẢM bấy nhiêu lần.',
      'Phân biệt với tỉ lệ thuận: thuận giữ nguyên THƯƠNG, nghịch giữ nguyên TÍCH.',
    ],
    workedExampleVi: {
      problem:
        '6 công nhân làm xong một việc trong 10 ngày. Hỏi 4 công nhân (năng suất như nhau) làm xong trong bao lâu?',
      steps: [
        'Số người và số ngày tỉ lệ nghịch: tích không đổi = 6 × 10 = 60 (ngày-người).',
        'Với 4 người: số ngày = 60 ÷ 4 = 15 ngày.',
      ],
    },
    commonMistakeVi:
      'Giải như tỉ lệ thuận (ít người hơn → ít ngày hơn). Ít người hơn phải làm LÂU hơn — kiểm tra chiều tăng/giảm trước khi lập phép tính.',
    reviewState: 'UNREVIEWED',
  },
];

const byKc = new Map(LESSON_SUMMARIES.map((lesson) => [lesson.kcId, lesson]));

export function lessonForKc(kcId: string): LessonSummary | undefined {
  return byKc.get(kcId);
}
