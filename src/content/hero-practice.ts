/**
 * Practice question content for the hero demo KCs.
 *
 * Every question binds to an item ID that ALREADY exists in HERO_ITEMS
 * (`K0X-CHECK-1/2`), so recorded answers feed the same BKT mastery state the
 * diagnosis uses — the practice loop moves the learner along the real path.
 *
 * Review state: UNREVIEWED (like all hero demo content). Distractors map to
 * named misconceptions; hints follow the 3-level ladder from the product
 * contract: conceptual cue → guided substep → bottom-out worked step.
 */

export interface PracticeChoice {
  readonly id: string;
  readonly label: string;
  /** Misconception behind this wrong choice; undefined on the correct choice. */
  readonly misconceptionTag?: string;
  /** One-sentence Vietnamese note shown when the learner picks this choice. */
  readonly noteVi?: string;
}

export interface PracticeQuestion {
  readonly itemId: string;
  readonly kcId: string;
  readonly promptVi: string;
  readonly choices: readonly PracticeChoice[];
  readonly correctChoiceId: string;
  /** 3-level hint ladder: [conceptual cue, guided substep, worked step]. */
  readonly hints: readonly [string, string, string];
  /** Shown after a correct answer. */
  readonly explanationVi: string;
  readonly hypothesisLabel: string;
}

const LABEL = 'Câu hỏi luyện tập demo, chưa được giáo viên duyệt';

export const PRACTICE_QUESTIONS: readonly PracticeQuestion[] = [
  // ---------- K01 — Ý nghĩa phân số ----------
  {
    itemId: 'K01-CHECK-1',
    kcId: 'K01',
    promptVi:
      'Một hình chữ nhật được chia thành 8 phần bằng nhau, tô màu 3 phần. Phân số chỉ phần đã tô màu là?',
    choices: [
      { id: 'a', label: '3/8' },
      {
        id: 'b',
        label: '8/3',
        misconceptionTag: 'NUMERATOR_DENOMINATOR_SWAP',
        noteVi: 'Em đang đặt tổng số phần lên trên. Tử số là phần được tô, mẫu số là tổng số phần.',
      },
      {
        id: 'c',
        label: '3/5',
        misconceptionTag: 'PART_TO_PART',
        noteVi: 'Em đang so phần tô với phần không tô. Mẫu số phải là TẤT CẢ các phần bằng nhau.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Phân số gồm: phần được chọn (tử số) trên tổng số phần bằng nhau (mẫu số).',
      'Đếm: có tất cả bao nhiêu phần bằng nhau? Bao nhiêu phần được tô màu?',
      'Tổng cộng 8 phần bằng nhau, tô 3 phần → phân số là 3/8.',
    ],
    explanationVi: 'Tử số 3 = số phần được tô; mẫu số 8 = tổng số phần bằng nhau.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K01-CHECK-2',
    kcId: 'K01',
    promptVi: 'Phân số 5/6 diễn tả điều gì?',
    choices: [
      { id: 'a', label: 'Chia một đơn vị thành 6 phần bằng nhau và lấy 5 phần' },
      {
        id: 'b',
        label: 'Chia một đơn vị thành 5 phần bằng nhau và lấy 6 phần',
        misconceptionTag: 'NUMERATOR_DENOMINATOR_SWAP',
        noteVi: 'Mẫu số (dưới) cho biết chia thành mấy phần; tử số (trên) cho biết lấy mấy phần.',
      },
      {
        id: 'c',
        label: '5 đơn vị lớn và 6 đơn vị nhỏ',
        misconceptionTag: 'WHOLE_NUMBER_THINKING',
        noteVi:
          'Phân số không phải là hai số đếm riêng lẻ — nó là một giá trị: 5 phần trong 6 phần.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Mẫu số nói cách chia, tử số nói cách lấy.',
      'Số 6 nằm dưới — vậy đơn vị được chia thành mấy phần bằng nhau?',
      'Chia thành 6 phần bằng nhau (mẫu số 6), lấy 5 phần (tử số 5) → 5/6.',
    ],
    explanationVi: 'Mẫu số 6: chia thành 6 phần bằng nhau. Tử số 5: lấy 5 phần trong số đó.',
    hypothesisLabel: LABEL,
  },

  // ---------- K02 — Phân số bằng nhau ----------
  {
    itemId: 'K02-CHECK-1',
    kcId: 'K02',
    promptVi: 'Phân số nào bằng 2/3?',
    choices: [
      { id: 'a', label: '4/6' },
      {
        id: 'b',
        label: '4/5',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi:
          'Em đang cộng 2 vào cả tử và mẫu. Cộng thêm làm ĐỔI giá trị — phải NHÂN cả tử và mẫu với cùng một số.',
      },
      {
        id: 'c',
        label: '2/6',
        misconceptionTag: 'SCALE_ONE_PART_ONLY',
        noteVi:
          'Em chỉ nhân mẫu số. Muốn giá trị không đổi phải nhân cả tử VÀ mẫu với cùng một số.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Hai phân số bằng nhau khi nhân (hoặc chia) cả tử và mẫu với cùng một số khác 0.',
      'Thử nhân cả tử và mẫu của 2/3 với 2 — em được phân số nào?',
      '2/3 = (2×2)/(3×2) = 4/6. Cả tử và mẫu cùng nhân 2 nên giá trị không đổi.',
    ],
    explanationVi: 'Nhân cả tử và mẫu của 2/3 với 2: 2×2=4, 3×2=6 → 4/6 = 2/3.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K02-CHECK-2',
    kcId: 'K02',
    promptVi: 'Điền số thích hợp: 3/5 = ?/20',
    choices: [
      { id: 'a', label: '12' },
      {
        id: 'b',
        label: '18',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi:
          'Em lấy 20−5=15 rồi cộng 15 vào tử. Quan hệ giữa hai phân số bằng nhau là NHÂN, không phải cộng.',
      },
      {
        id: 'c',
        label: '3',
        misconceptionTag: 'SCALE_ONE_PART_ONLY',
        noteVi: 'Em giữ nguyên tử số trong khi mẫu đã nhân 4 — như vậy giá trị đã thay đổi.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Mẫu số đã được nhân với bao nhiêu để từ 5 thành 20?',
      '5 × 4 = 20, vậy tử số cũng phải nhân với 4.',
      '3/5 = (3×4)/(5×4) = 12/20 → số cần điền là 12.',
    ],
    explanationVi: 'Mẫu 5→20 là nhân 4, nên tử 3 cũng nhân 4: 3×4 = 12.',
    hypothesisLabel: LABEL,
  },

  // ---------- K07 — Ý nghĩa và thứ tự của tỉ số ----------
  {
    itemId: 'K07-CHECK-1',
    kcId: 'K07',
    promptVi: 'Lớp 7A có 15 bạn nam và 20 bạn nữ. Tỉ số giữa số bạn nam so với số bạn nữ là?',
    choices: [
      { id: 'a', label: '15 : 20' },
      {
        id: 'b',
        label: '20 : 15',
        misconceptionTag: 'RATIO_ORDER_REVERSED',
        noteVi: 'Thứ tự trong tỉ số rất quan trọng: "nam so với nữ" thì số nam phải đứng trước.',
      },
      {
        id: 'c',
        label: '15 : 35',
        misconceptionTag: 'PART_TO_WHOLE_CONFUSION',
        noteVi:
          'Em đang so số nam với TỔNG cả lớp. Đề bài hỏi nam so với nữ — hai bộ phận với nhau.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tỉ số a : b so sánh đại lượng NÓI TRƯỚC với đại lượng NÓI SAU.',
      '"Nam so với nữ" — số nào được nói trước? Số đó đứng đầu.',
      'Nam 15, nữ 20, nam nói trước → tỉ số là 15 : 20.',
    ],
    explanationVi: '"Nam so với nữ": nam (15) đứng trước, nữ (20) đứng sau → 15 : 20.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K07-CHECK-2',
    kcId: 'K07',
    promptVi: 'Tỉ số 2 : 5 giữa số bút đỏ và số bút xanh nghĩa là gì?',
    choices: [
      { id: 'a', label: 'Cứ 2 bút đỏ thì có 5 bút xanh' },
      {
        id: 'b',
        label: 'Cứ 5 bút đỏ thì có 2 bút xanh',
        misconceptionTag: 'RATIO_ORDER_REVERSED',
        noteVi: 'Em đã đảo thứ tự: 2 : 5 là đỏ so với xanh, nên số bút đỏ được nói trước.',
      },
      {
        id: 'c',
        label: 'Bút đỏ chiếm 2 phần trong tổng 5 phần',
        misconceptionTag: 'PART_TO_WHOLE_CONFUSION',
        noteVi: '2 : 5 là đỏ so với xanh. Nếu so với tổng thì bút đỏ chiếm 2 phần trong 7 phần.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tỉ số mô tả quan hệ "cứ … thì …" giữa hai đại lượng.',
      'Nếu có 4 bút đỏ thì theo tỉ số 2 : 5 sẽ có bao nhiêu bút xanh?',
      '2 : 5 nghĩa là cứ 2 đỏ thì 5 xanh; gấp đôi lên: 4 đỏ thì 10 xanh — quan hệ nhân, không phải cộng.',
    ],
    explanationVi: 'Tỉ số 2 : 5 là quan hệ nhân: cứ 2 bút đỏ tương ứng 5 bút xanh.',
    hypothesisLabel: LABEL,
  },

  // ---------- K08 — Các tỉ số bằng nhau ----------
  {
    itemId: 'K08-CHECK-1',
    kcId: 'K08',
    promptVi: 'Hoàn thành để được hai tỉ số bằng nhau: 3 : 4 = 9 : ?',
    choices: [
      { id: 'a', label: '12' },
      {
        id: 'b',
        label: '10',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em lấy 9−3=6 rồi cộng 6 vào 4. Tỉ số bằng nhau khi cả hai vế cùng NHÂN một số.',
      },
      {
        id: 'c',
        label: '16',
        misconceptionTag: 'WRONG_SCALE_FACTOR',
        noteVi: 'Em nhân 4 với 4. Hệ số nhân phải lấy từ cặp đã biết: 3→9 là nhân 3.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tìm xem vế trái đã được nhân với bao nhiêu để thành vế phải.',
      '3 × ? = 9 — vậy 4 cũng phải nhân với đúng số đó.',
      '3→9 là nhân 3, nên 4×3 = 12. Tỉ số 3 : 4 = 9 : 12.',
    ],
    explanationVi: '3 nhân 3 được 9, nên 4 cũng nhân 3: 4×3 = 12.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K08-CHECK-2',
    kcId: 'K08',
    promptVi: 'Tỉ số nào dưới đây bằng tỉ số 6 : 10?',
    choices: [
      { id: 'a', label: '3 : 5' },
      {
        id: 'b',
        label: '12 : 16',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi:
          'Em cộng 6 vào cả hai vế (6+6 : 10+6). Phải nhân hoặc chia cả hai vế với cùng một số.',
      },
      {
        id: 'c',
        label: '6 : 5',
        misconceptionTag: 'SCALE_ONE_PART_ONLY',
        noteVi: 'Em chỉ chia vế phải cho 2. Cả hai vế phải cùng chia 2.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Có thể CHIA cả hai vế của tỉ số cho cùng một số khác 0.',
      'Chia cả 6 và 10 cho 2 — em được tỉ số nào?',
      '6 : 10 = (6÷2) : (10÷2) = 3 : 5.',
    ],
    explanationVi: 'Chia cả hai vế cho 2: 6÷2 = 3 và 10÷2 = 5 → 3 : 5.',
    hypothesisLabel: LABEL,
  },

  // ---------- K09 — Định nghĩa tỉ lệ thức ----------
  {
    itemId: 'K09-CHECK-1',
    kcId: 'K09',
    promptVi: 'Đẳng thức nào dưới đây là một tỉ lệ thức đúng?',
    choices: [
      { id: 'a', label: '2/3 = 8/12' },
      {
        id: 'b',
        label: '2/3 = 6/8',
        misconceptionTag: 'UNVERIFIED_EQUALITY',
        noteVi:
          'Kiểm tra bằng nhân chéo: 2×8 = 16 nhưng 3×6 = 18 — hai tích khác nhau nên không bằng.',
      },
      {
        id: 'c',
        label: '3/2 = 2/3',
        misconceptionTag: 'NUMERATOR_DENOMINATOR_SWAP',
        noteVi: 'Đảo tử và mẫu tạo ra giá trị khác (3/2 > 1 còn 2/3 < 1), không phải tỉ lệ thức.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tỉ lệ thức là đẳng thức giữa HAI tỉ số có cùng giá trị.',
      'Dùng nhân chéo: a/b = c/d đúng khi a×d = b×c.',
      'Với 2/3 = 8/12: 2×12 = 24 và 3×8 = 24 — hai tích bằng nhau nên đây là tỉ lệ thức.',
    ],
    explanationVi: '2×12 = 24 = 3×8 nên 2/3 = 8/12 là tỉ lệ thức đúng.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K09-CHECK-2',
    kcId: 'K09',
    promptVi: 'Trong tỉ lệ thức a/b = c/d (b, d ≠ 0), tính chất nào luôn đúng?',
    choices: [
      { id: 'a', label: 'a × d = b × c' },
      {
        id: 'b',
        label: 'a + d = b + c',
        misconceptionTag: 'ADDITIVE_COMPARISON',
        noteVi:
          'Tổng chéo không bảo toàn: 2/3 = 4/6 nhưng 2+6 = 8 ≠ 3+4 = 7... hãy thử lại: 8 ≠ 7.',
      },
      {
        id: 'c',
        label: 'a − b = c − d',
        misconceptionTag: 'ADDITIVE_COMPARISON',
        noteVi: 'Hiệu không bảo toàn: 2/3 = 4/6 nhưng 2−3 = −1 còn 4−6 = −2.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tính chất cơ bản của tỉ lệ thức liên quan tới hai TÍCH chéo.',
      'Lấy ví dụ 2/3 = 4/6 rồi thử từng đáp án xem cái nào đúng.',
      'Với 2/3 = 4/6: 2×6 = 12 = 3×4 — tích chéo bằng nhau. Đó là a×d = b×c.',
    ],
    explanationVi: 'Tính chất cơ bản của tỉ lệ thức: tích chéo bằng nhau, a×d = b×c.',
    hypothesisLabel: LABEL,
  },

  // ---------- K10 — Tìm giá trị chưa biết trong tỉ lệ thức ----------
  {
    itemId: 'K10-CHECK-1',
    kcId: 'K10',
    promptVi: 'Tìm x biết x/12 = 3/4.',
    choices: [
      { id: 'a', label: 'x = 9' },
      {
        id: 'b',
        label: 'x = 11',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em lấy 12−4=8 rồi cộng 8 vào 3. Hai vế của tỉ lệ thức liên hệ bằng phép NHÂN.',
      },
      {
        id: 'c',
        label: 'x = 36',
        misconceptionTag: 'INCOMPLETE_CROSS_MULTIPLY',
        noteVi: 'Em nhân chéo 12×3 nhưng quên chia cho 4. x = (12×3)÷4.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Mẫu số 4 đã được nhân với bao nhiêu để thành 12?',
      '4×3 = 12, vậy tử số 3 cũng nhân 3. Hoặc dùng tích chéo: x×4 = 12×3.',
      'x = (12×3)÷4 = 36÷4 = 9.',
    ],
    explanationVi: 'Cách 1: 4→12 là nhân 3 nên x = 3×3 = 9. Cách 2: x = (12×3)÷4 = 9.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K10-CHECK-2',
    kcId: 'K10',
    promptVi: 'Mua 5 mét vải hết 80.000 đồng. Hỏi mua 8 mét vải cùng loại hết bao nhiêu tiền?',
    choices: [
      { id: 'a', label: '128.000 đồng' },
      {
        id: 'b',
        label: '110.000 đồng',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi:
          'Em cộng thêm 30.000 cho 3 mét như thể mỗi mét 10.000. Hãy tìm giá MỘT mét trước: 80.000÷5.',
      },
      {
        id: 'c',
        label: '83.000 đồng',
        misconceptionTag: 'WHOLE_NUMBER_THINKING',
        noteVi:
          'Em cộng 3 (số mét tăng thêm) vào số tiền. Tiền và số mét là hai đại lượng tỉ lệ, không cộng thẳng.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Số tiền tỉ lệ thuận với số mét vải: lập tỉ lệ thức 80.000/5 = ?/8.',
      'Tìm giá 1 mét: 80.000 ÷ 5 = 16.000 đồng.',
      'Giá 1 mét 16.000 → 8 mét: 16.000×8 = 128.000 đồng.',
    ],
    explanationVi: '1 mét giá 80.000÷5 = 16.000 đồng; 8 mét: 16.000×8 = 128.000 đồng.',
    hypothesisLabel: LABEL,
  },

  // ---------- Guided pool extensions (-CHECK-1b) ----------
  // These add a SECOND guided-practice variant per KC so the streak gate can
  // rotate numeric instances. They share the same -CHECK-1 numeric template
  // root, are part of the UNREVIEWED hero demo set, and need teacher review
  // before any pilot release.
  {
    itemId: 'K01-CHECK-1b',
    kcId: 'K01',
    promptVi:
      'Một bánh được cắt thành 6 phần bằng nhau, bạn Nam ăn 2 phần. Phân số chỉ phần bánh còn lại là?',
    choices: [
      { id: 'a', label: '4/6' },
      {
        id: 'b',
        label: '2/6',
        misconceptionTag: 'PART_TO_PART',
        noteVi: 'Em đang lấy phần đã ăn. Đề hỏi phần CÒN LẠI: 6 phần trừ đi 2 phần ăn.',
      },
      {
        id: 'c',
        label: '4/2',
        misconceptionTag: 'NUMERATOR_DENOMINATOR_SWAP',
        noteVi: 'Em đang đặt phần còn lại lên trên và tổng số phần xuống dưới theo nhầm chiều.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Phần còn lại = tổng số phần trừ phần đã ăn.',
      'Tổng 6 phần, ăn 2 phần — còn lại mấy phần? Phân số có mẫu số bằng tổng số phần bằng nhau.',
      'Còn lại 6−2 = 4 phần trong tổng 6 phần → phân số 4/6.',
    ],
    explanationVi: 'Còn lại 6−2 = 4 phần trên tổng 6 phần → 4/6.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K02-CHECK-1b',
    kcId: 'K02',
    promptVi: 'Phân số nào bằng 1/2?',
    choices: [
      { id: 'a', label: '3/6' },
      {
        id: 'b',
        label: '2/3',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em cộng 1 vào cả tử và mẫu (1+1 : 2+1). Phải nhân cả tử và mẫu với cùng một số.',
      },
      {
        id: 'c',
        label: '1/3',
        misconceptionTag: 'SCALE_ONE_PART_ONLY',
        noteVi: 'Em chỉ nhân mẫu số. Muốn giá trị không đổi phải nhân cả tử VÀ mẫu.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Nhân cả tử và mẫu của 1/2 với cùng một số khác 0.',
      'Thử nhân cả tử và mẫu với 3 — em được phân số nào?',
      '1/2 = (1×3)/(2×3) = 3/6.',
    ],
    explanationVi: 'Nhân cả tử và mẫu của 1/2 với 3: 1×3 = 3, 2×3 = 6 → 3/6 = 1/2.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K07-CHECK-1b',
    kcId: 'K07',
    promptVi: 'Hộp có 8 bút đỏ và 12 bút xanh. Tỉ số giữa số bút xanh so với số bút đỏ là?',
    choices: [
      { id: 'a', label: '12 : 8' },
      {
        id: 'b',
        label: '8 : 12',
        misconceptionTag: 'RATIO_ORDER_REVERSED',
        noteVi: 'Đề hỏi "xanh so với đỏ" — số xanh được nói trước, phải đứng đầu.',
      },
      {
        id: 'c',
        label: '12 : 20',
        misconceptionTag: 'PART_TO_WHOLE_CONFUSION',
        noteVi: 'Em đang so số xanh với tổng. Đề hỏi hai bộ phận với nhau: xanh và đỏ.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      '"Xanh so với đỏ": số nào nói trước đứng đầu.',
      'Xanh 12 nói trước, đỏ 8 nói sau.',
      'Xanh 12, đỏ 8, xanh nói trước → 12 : 8.',
    ],
    explanationVi: '"Xanh so với đỏ": xanh (12) đứng trước, đỏ (8) đứng sau → 12 : 8.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K08-CHECK-1b',
    kcId: 'K08',
    promptVi: 'Tỉ số nào dưới đây bằng tỉ số 4 : 6?',
    choices: [
      { id: 'a', label: '2 : 3' },
      {
        id: 'b',
        label: '8 : 10',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em cộng 4 vào cả hai vế (4+4 : 6+4). Tỉ số bằng nhau khi cùng NHÂN hoặc CHIA một số.',
      },
      {
        id: 'c',
        label: '4 : 3',
        misconceptionTag: 'SCALE_ONE_PART_ONLY',
        noteVi: 'Em chỉ chia vế phải. Cả hai vế phải cùng chia 2.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Có thể CHIA cả hai vế của tỉ số cho cùng một số khác 0.',
      'Chia cả 4 và 6 cho 2 — em được tỉ số nào?',
      '4 : 6 = (4÷2) : (6÷2) = 2 : 3.',
    ],
    explanationVi: 'Chia cả hai vế cho 2: 4÷2 = 2 và 6÷2 = 3 → 2 : 3.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K09-CHECK-1b',
    kcId: 'K09',
    promptVi: 'Đẳng thức nào dưới đây là một tỉ lệ thức đúng?',
    choices: [
      { id: 'a', label: '3/4 = 9/12' },
      {
        id: 'b',
        label: '3/4 = 6/9',
        misconceptionTag: 'UNVERIFIED_EQUALITY',
        noteVi: 'Nhân chéo: 3×9 = 27 nhưng 4×6 = 24 — hai tích khác nhau, không bằng.',
      },
      {
        id: 'c',
        label: '4/3 = 3/4',
        misconceptionTag: 'NUMERATOR_DENOMINATOR_SWAP',
        noteVi: 'Đảo tử và mẫu tạo giá trị khác (4/3 > 1 còn 3/4 < 1), không phải tỉ lệ thức.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tỉ lệ thức là đẳng thức giữa hai tỉ số có cùng giá trị.',
      'Dùng nhân chéo: a/b = c/d đúng khi a×d = b×c.',
      'Với 3/4 = 9/12: 3×12 = 36 = 4×9 — hai tích bằng nhau nên đây là tỉ lệ thức.',
    ],
    explanationVi: '3×12 = 36 = 4×9 nên 3/4 = 9/12 là tỉ lệ thức đúng.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K10-CHECK-1b',
    kcId: 'K10',
    promptVi: 'Tìm x biết 6/x = 2/5.',
    choices: [
      { id: 'a', label: 'x = 15' },
      {
        id: 'b',
        label: 'x = 12',
        misconceptionTag: 'INCOMPLETE_CROSS_MULTIPLY',
        noteVi: 'Em nhân chéo 6×5 = 30 nhưng quên chia cho 2. x = (6×5)÷2.',
      },
      {
        id: 'c',
        label: 'x = 11',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em lấy 6−2=4 rồi cộng vào 5. Hai vế của tỉ lệ thức liên hệ bằng phép NHÂN.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Dùng nhân chéo: 6×5 = 2×x.',
      '2×x = 30, vậy x = ?',
      'x = 30÷2 = 15.',
    ],
    explanationVi: 'Nhân chéo 6×5 = 2×x → 30 = 2x → x = 15.',
    hypothesisLabel: LABEL,
  },

  // ---------- Guided pool third variant (-CHECK-1c) ----------
  // A third guided-practice variant per KC so the anti-guessing accuracy gate
  // (≈80% distinct-correct + a final 2-correct streak) has enough items to
  // distinguish genuine mastery from lucky guessing. Same -CHECK-1 numeric
  // template root; UNREVIEWED, needs teacher review before pilot.
  {
    itemId: 'K01-CHECK-1c',
    kcId: 'K01',
    promptVi:
      'Một dải băng được chia thành 10 phần bằng nhau, tô màu 7 phần. Phân số chỉ phần ĐÃ TÔ MÀU là?',
    choices: [
      { id: 'a', label: '7/10' },
      {
        id: 'b',
        label: '10/7',
        misconceptionTag: 'NUMERATOR_DENOMINATOR_SWAP',
        noteVi: 'Em đặt tổng số phần lên trên. Tử số là phần được tô, mẫu số là tổng số phần.',
      },
      {
        id: 'c',
        label: '7/3',
        misconceptionTag: 'PART_TO_PART',
        noteVi: 'Em so phần tô với phần không tô. Mẫu số phải là TẤT CẢ phần bằng nhau.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Phân số có tử số = phần được chọn, mẫu số = tổng số phần bằng nhau.',
      'Tổng cộng có mấy phần bằng nhau? Mấy phần được tô màu?',
      '10 phần bằng nhau, tô 7 phần → phân số là 7/10.',
    ],
    explanationVi: 'Tử số 7 = phần được tô; mẫu số 10 = tổng số phần bằng nhau.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K02-CHECK-1c',
    kcId: 'K02',
    promptVi: 'Phân số nào bằng 5/7?',
    choices: [
      { id: 'a', label: '10/14' },
      {
        id: 'b',
        label: '10/12',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em cộng 5 vào cả tử và mẫu. Cộng làm ĐỔI giá trị — phải NHÂN.',
      },
      {
        id: 'c',
        label: '5/14',
        misconceptionTag: 'SCALE_ONE_PART_ONLY',
        noteVi: 'Em chỉ nhân mẫu số. Phải nhân cả tử VÀ mẫu với cùng một số.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Nhân cả tử và mẫu của 5/7 với cùng một số khác 0.',
      'Thử nhân cả tử và mẫu với 2 — em được phân số nào?',
      '5/7 = (5×2)/(7×2) = 10/14.',
    ],
    explanationVi: 'Nhân cả tử và mẫu của 5/7 với 2: 5×2 = 10, 7×2 = 14 → 10/14 = 5/7.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K07-CHECK-1c',
    kcId: 'K07',
    promptVi: 'Lớp 6B có 10 bạn nam và 15 bạn nữ. Tỉ số giữa số bạn nam so với TỔNG SỐ bạn trong lớp là?',
    choices: [
      { id: 'a', label: '10 : 25' },
      {
        id: 'b',
        label: '10 : 15',
        misconceptionTag: 'PART_TO_WHOLE_CONFUSION',
        noteVi: 'Đề hỏi nam so với TỔNG lớp, không phải nam so với nữ. Tổng lớp là 10+15.',
      },
      {
        id: 'c',
        label: '15 : 10',
        misconceptionTag: 'RATIO_ORDER_REVERSED',
        noteVi: 'Em đảo thứ tự và nhầm đại lượng. Nam nói trước, tổng lớp nói sau.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      '"Nam so với tổng lớp": số nam so với tổng số bạn.',
      'Tổng số bạn trong lớp là bao nhiêu? Số nam đứng đầu tỉ số.',
      'Nam 10, tổng 10+15 = 25 → tỉ số 10 : 25.',
    ],
    explanationVi: 'Tổng lớp 10+15 = 25; "nam so với tổng" → 10 : 25.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K08-CHECK-1c',
    kcId: 'K08',
    promptVi: 'Hoàn thành để được hai tỉ số bằng nhau: 5 : 7 = 15 : ?',
    choices: [
      { id: 'a', label: '21' },
      {
        id: 'b',
        label: '17',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em lấy 15−5=10 rồi cộng 10 vào 7. Tỉ số bằng nhau khi cùng NHÂN.',
      },
      {
        id: 'c',
        label: '35',
        misconceptionTag: 'WRONG_SCALE_FACTOR',
        noteVi: 'Em nhân 7 với 5. Hệ số nhân phải lấy từ cặp đã biết: 5→15 là nhân 3.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Tìm xem vế trái đã được nhân với bao nhiêu để thành vế phải.',
      '5 × ? = 15 — vậy 7 cũng phải nhân với số đó.',
      '5→15 là nhân 3, nên 7×3 = 21. Tỉ số 5 : 7 = 15 : 21.',
    ],
    explanationVi: '5 nhân 3 được 15, nên 7 cũng nhân 3: 7×3 = 21.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K09-CHECK-1c',
    kcId: 'K09',
    promptVi: 'Đẳng thức nào dưới đây KHÔNG phải là tỉ lệ thức?',
    choices: [
      { id: 'a', label: '4/6 = 5/8' },
      {
        id: 'b',
        label: '2/5 = 6/15',
        misconceptionTag: 'UNVERIFIED_EQUALITY',
        noteVi: 'Đây LÀ tỉ lệ thức: 2×15 = 30 = 5×6. Đề hỏi câu KHÔNG phải tỉ lệ thức.',
      },
      {
        id: 'c',
        label: '3/4 = 9/12',
        misconceptionTag: 'UNVERIFIED_EQUALITY',
        noteVi: 'Đây LÀ tỉ lệ thức: 3×12 = 36 = 4×9. Đề hỏi câu KHÔNG phải tỉ lệ thức.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Dùng nhân chéo để kiểm tra từng đáp án: a/b = c/d đúng khi a×d = b×c.',
      'Đề hỏi câu KHÔNG phải tỉ lệ thức — tìm câu có tích chéo KHÔNG bằng nhau.',
      'Với 4/6 và 5/8: 4×8 = 32 nhưng 6×5 = 30 → KHÔNG bằng, nên đây không là tỉ lệ thức.',
    ],
    explanationVi: '4×8 = 32 ≠ 6×5 = 30 nên 4/6 = 5/8 không phải tỉ lệ thức.',
    hypothesisLabel: LABEL,
  },
  {
    itemId: 'K10-CHECK-1c',
    kcId: 'K10',
    promptVi: 'Tìm x biết x/15 = 4/5.',
    choices: [
      { id: 'a', label: 'x = 12' },
      {
        id: 'b',
        label: 'x = 19',
        misconceptionTag: 'ADDITIVE_EQUIVALENCE',
        noteVi: 'Em lấy 15−5=10 rồi cộng vào 4. Hai vế tỉ lệ thức liên hệ bằng phép NHÂN.',
      },
      {
        id: 'c',
        label: 'x = 60',
        misconceptionTag: 'INCOMPLETE_CROSS_MULTIPLY',
        noteVi: 'Em nhân chéo 15×4 = 60 nhưng quên chia cho 5. x = (15×4)÷5.',
      },
    ],
    correctChoiceId: 'a',
    hints: [
      'Mẫu số 5 đã được nhân với bao nhiêu để thành 15?',
      '5×3 = 15, vậy tử số 4 cũng nhân 3. Hoặc nhân chéo: x×5 = 15×4.',
      'x = (15×4)÷5 = 60÷5 = 12.',
    ],
    explanationVi: 'Cách 1: 5→15 là nhân 3 nên x = 4×3 = 12. Cách 2: x = (15×4)÷5 = 12.',
    hypothesisLabel: LABEL,
  },
];

export function practiceQuestionsForKc(kcId: string): PracticeQuestion[] {
  return PRACTICE_QUESTIONS.filter((question) => question.kcId === kcId);
}

export function practiceQuestionByItem(itemId: string): PracticeQuestion | undefined {
  return PRACTICE_QUESTIONS.find((question) => question.itemId === itemId);
}
