import mammoth from 'mammoth';
import readXlsxFile, { type Row } from 'read-excel-file/node';

export type ImportedDifficulty = 'UNSPECIFIED' | 'EASY' | 'MEDIUM' | 'HARD';

export interface ImportedQuestionDraft {
  sourceIndex: number;
  prompt: string;
  choices: { id: string; label: string }[];
  correctChoiceId: string;
  hints: string[];
  explanation: string;
  difficulty: ImportedDifficulty;
  valid: boolean;
  issues: string[];
}

export interface QuestionImportPreview {
  fileName: string;
  format: 'DOCX' | 'XLSX';
  totalCount: number;
  validCount: number;
  invalidCount: number;
  questions: ImportedQuestionDraft[];
}

export class QuestionImportError extends Error {
  readonly code: 'UNSUPPORTED_FILE' | 'INVALID_TEMPLATE' | 'EMPTY_FILE' | 'UNREADABLE_FILE';

  constructor(
    code: 'UNSUPPORTED_FILE' | 'INVALID_TEMPLATE' | 'EMPTY_FILE' | 'UNREADABLE_FILE',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function cellText(value: Row[number]): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizedLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function importedDifficulty(value: string, fallback: ImportedDifficulty): ImportedDifficulty {
  const normalized = normalizedLabel(value);
  if (normalized === 'easy' || normalized === 'de') return 'EASY';
  if (normalized === 'medium' || normalized === 'trung binh' || normalized === 'vua') {
    return 'MEDIUM';
  }
  if (normalized === 'hard' || normalized === 'kho') return 'HARD';
  if (normalized === 'unspecified' || normalized === 'chua phan loai') return 'UNSPECIFIED';
  return fallback;
}

function validateDraft(
  draft: Omit<ImportedQuestionDraft, 'valid' | 'issues'>,
  extraIssues: readonly string[] = [],
): ImportedQuestionDraft {
  const issues = [...extraIssues];
  if (draft.prompt.length < 8) issues.push('Nội dung câu hỏi cần có ít nhất 8 ký tự.');
  if (draft.prompt.length > 500) issues.push('Nội dung câu hỏi vượt quá 500 ký tự.');
  if (draft.choices.length < 2) issues.push('Cần có ít nhất 2 phương án trả lời.');
  if (draft.choices.length > 5) issues.push('Chỉ hỗ trợ tối đa 5 phương án trả lời.');
  if (draft.choices.some((choice) => !choice.label || choice.label.length > 200)) {
    issues.push('Mỗi phương án phải có nội dung và không vượt quá 200 ký tự.');
  }
  if (!draft.choices.some((choice) => choice.id === draft.correctChoiceId)) {
    issues.push('Chưa xác định được đáp án đúng.');
  }
  if (draft.explanation.length > 500) issues.push('Giải thích vượt quá 500 ký tự.');
  return { ...draft, valid: issues.length === 0, issues };
}

function headerIndex(headers: readonly string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

export function parseExcelRows(
  rows: readonly Row[],
  defaultDifficulty: ImportedDifficulty = 'UNSPECIFIED',
): ImportedQuestionDraft[] {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) throw new QuestionImportError('EMPTY_FILE', 'File Excel không có dữ liệu.');

  const headers = headerRow.map((value) => normalizedLabel(cellText(value)));
  const promptColumn = headerIndex(headers, ['cau hoi', 'noi dung cau hoi', 'question']);
  const correctColumn = headerIndex(headers, ['dap an dung', 'dap an', 'correct answer']);
  const choiceColumns = ['a', 'b', 'c', 'd', 'e'].map((key) =>
    headerIndex(headers, [`dap an ${key}`, `phuong an ${key}`, key]),
  );
  const difficultyColumn = headerIndex(headers, ['do kho', 'difficulty']);
  const explanationColumn = headerIndex(headers, ['giai thich', 'explanation']);
  const hintColumn = headerIndex(headers, ['goi y', 'hint']);

  if (
    promptColumn < 0 ||
    correctColumn < 0 ||
    choiceColumns.filter((index) => index >= 0).length < 2
  ) {
    throw new QuestionImportError(
      'INVALID_TEMPLATE',
      'File Excel cần có các cột: Câu hỏi, Đáp án A, Đáp án B và Đáp án đúng.',
    );
  }

  const drafts = dataRows.flatMap((row, rowOffset) => {
    const prompt = cellText(row[promptColumn]);
    const hasContent = row.some((value) => cellText(value).length > 0);
    if (!hasContent) return [];

    const choices = choiceColumns.flatMap((column, index) => {
      if (column < 0) return [];
      const label = cellText(row[column]);
      return label ? [{ id: String.fromCharCode(97 + index), label }] : [];
    });
    const answer = normalizedLabel(cellText(row[correctColumn])).replace('dap an ', '');
    const correctChoiceId = /^[a-e]$/.test(answer) ? answer : '';
    const hint = hintColumn >= 0 ? cellText(row[hintColumn]) : '';

    return [
      validateDraft({
        sourceIndex: rowOffset + 2,
        prompt,
        choices,
        correctChoiceId,
        hints: hint ? [hint] : [],
        explanation: explanationColumn >= 0 ? cellText(row[explanationColumn]) : '',
        difficulty:
          difficultyColumn >= 0
            ? importedDifficulty(cellText(row[difficultyColumn]), defaultDifficulty)
            : defaultDifficulty,
      }),
    ];
  });

  if (drafts.length === 0) {
    throw new QuestionImportError(
      'EMPTY_FILE',
      'File Excel chưa có câu hỏi nào bên dưới hàng tiêu đề.',
    );
  }
  return drafts;
}

interface WordQuestionBuffer {
  sourceIndex: number;
  prompt: string;
  choices: { id: string; label: string }[];
  correctIds: Set<string>;
  explanation: string;
  hints: string[];
}

function optionSegments(line: string): { id: string; label: string; correct: boolean }[] {
  const matches = [
    ...line.matchAll(/(?:^|\s+)(\*?)([A-E])[.)-]\s*(.*?)(?=\s+\*?[A-E][.)-]\s*|$)/giu),
  ];
  return matches.flatMap((match) => {
    const rawLabel = (match[3] ?? '').trim();
    const correct = match[1] === '*' || rawLabel.startsWith('*');
    const label = rawLabel.replace(/^\*\s*/, '').trim();
    return label ? [{ id: (match[2] ?? '').toLocaleLowerCase('vi'), label, correct }] : [];
  });
}

export function parseWordText(
  rawText: string,
  defaultDifficulty: ImportedDifficulty = 'UNSPECIFIED',
): ImportedQuestionDraft[] {
  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const drafts: ImportedQuestionDraft[] = [];
  let current: WordQuestionBuffer | null = null;

  const finishCurrent = () => {
    if (!current) return;
    const correctIds = [...current.correctIds];
    drafts.push(
      validateDraft(
        {
          sourceIndex: current.sourceIndex,
          prompt: current.prompt.trim(),
          choices: current.choices,
          correctChoiceId: correctIds.length === 1 ? correctIds[0]! : '',
          hints: current.hints,
          explanation: current.explanation,
          difficulty: defaultDifficulty,
        },
        correctIds.length > 1 ? ['Mỗi câu hiện chỉ hỗ trợ một đáp án đúng.'] : [],
      ),
    );
    current = null;
  };

  for (const line of lines) {
    const questionMatch = line.match(/^(?:câu\s*)?(\d+)[.)]\s*(.+)$/iu);
    if (questionMatch) {
      finishCurrent();
      current = {
        sourceIndex: Number(questionMatch[1]),
        prompt: questionMatch[2] ?? '',
        choices: [],
        correctIds: new Set(),
        explanation: '',
        hints: [],
      };
      continue;
    }
    if (!current) continue;

    const correctMatch = line.match(/^(?:đáp\s*án|đa)\s*:\s*([A-E])\b/iu);
    if (correctMatch) {
      current.correctIds.add((correctMatch[1] ?? '').toLocaleLowerCase('vi'));
      continue;
    }
    const explanationMatch = line.match(/^giải\s*thích\s*:\s*(.+)$/iu);
    if (explanationMatch) {
      current.explanation = explanationMatch[1] ?? '';
      continue;
    }
    const hintMatch = line.match(/^gợi\s*ý\s*:\s*(.+)$/iu);
    if (hintMatch) {
      current.hints.push(hintMatch[1] ?? '');
      continue;
    }

    const options = optionSegments(line);
    if (options.length > 0) {
      for (const option of options) {
        current.choices.push({ id: option.id, label: option.label });
        if (option.correct) current.correctIds.add(option.id);
      }
    } else if (current.choices.length === 0) {
      current.prompt += ` ${line}`;
    }
  }
  finishCurrent();

  if (drafts.length === 0) {
    throw new QuestionImportError(
      'INVALID_TEMPLATE',
      'Không tìm thấy câu hỏi. Mỗi câu trong Word cần bắt đầu bằng số, ví dụ “1. Nội dung câu hỏi”.',
    );
  }
  return drafts;
}

export async function parseQuestionFile(
  fileName: string,
  buffer: Buffer,
  defaultDifficulty: ImportedDifficulty = 'UNSPECIFIED',
): Promise<QuestionImportPreview> {
  const extension = fileName.toLocaleLowerCase('vi').split('.').at(-1);
  let format: QuestionImportPreview['format'];
  let questions: ImportedQuestionDraft[];

  try {
    if (extension === 'xlsx') {
      format = 'XLSX';
      const sheets = await readXlsxFile(buffer);
      questions = parseExcelRows(sheets[0]?.data ?? [], defaultDifficulty);
    } else if (extension === 'docx') {
      format = 'DOCX';
      const result = await mammoth.extractRawText({ buffer });
      questions = parseWordText(result.value, defaultDifficulty);
    } else {
      throw new QuestionImportError(
        'UNSUPPORTED_FILE',
        'Chỉ hỗ trợ file Word .docx hoặc Excel .xlsx.',
      );
    }
  } catch (error) {
    if (error instanceof QuestionImportError) throw error;
    throw new QuestionImportError(
      'UNREADABLE_FILE',
      'Không đọc được file. Hãy kiểm tra file không bị khóa hoặc hỏng rồi thử lại.',
    );
  }

  if (questions.length > 100) {
    throw new QuestionImportError(
      'INVALID_TEMPLATE',
      'Mỗi lần chỉ nhập tối đa 100 câu hỏi. Hãy chia file thành các phần nhỏ hơn.',
    );
  }

  const validCount = questions.filter((question) => question.valid).length;
  return {
    fileName,
    format,
    totalCount: questions.length,
    validCount,
    invalidCount: questions.length - validCount,
    questions,
  };
}
