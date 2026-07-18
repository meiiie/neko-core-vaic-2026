import { describe, expect, it } from 'vitest';
import { parseExcelRows, parseWordText, QuestionImportError } from './question-import.ts';

describe('question file parsing', () => {
  it('reads the Vietnamese Excel template and reports invalid rows before import', () => {
    const result = parseExcelRows(
      [
        ['Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án đúng', 'Độ khó'],
        ['Phân số nào bằng 2/3?', '4/6', '4/5', '6/8', 'A', 'Dễ'],
        ['Câu thiếu đáp án đúng', '1/2', '2/3', null, null, 'Khó'],
      ],
      'MEDIUM',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      sourceIndex: 2,
      correctChoiceId: 'a',
      difficulty: 'EASY',
      valid: true,
    });
    expect(result[1]).toMatchObject({ sourceIndex: 3, valid: false });
    expect(result[1]?.issues).toContain('Chưa xác định được đáp án đúng.');
  });

  it('reads numbered Word questions with a starred answer or an answer line', () => {
    const result = parseWordText(`
      1. Phân số nào bằng 2/3?
      A. 4/5
      B. *4/6
      C. 6/8

      2. Điền số thích hợp: 3/5 = ?/20
      A. 10  B. 12  C. 15
      Đáp án: B
      Giải thích: Nhân cả tử và mẫu với 4.
    `);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ correctChoiceId: 'b', valid: true });
    expect(result[1]).toMatchObject({
      correctChoiceId: 'b',
      explanation: 'Nhân cả tử và mẫu với 4.',
      valid: true,
    });
  });

  it('rejects a spreadsheet without the required columns', () => {
    expect(() =>
      parseExcelRows([
        ['Tiêu đề', 'Nội dung'],
        ['A', 'B'],
      ]),
    ).toThrowError(QuestionImportError);
  });
});
