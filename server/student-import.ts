import readXlsxFile, { type Row } from 'read-excel-file/node';

export interface StudentImportRow {
  sourceIndex: number;
  name: string;
  email: string;
  temporaryPassword: string;
  valid: boolean;
  issues: string[];
}

export interface StudentImportPreview {
  fileName: string;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  students: StudentImportRow[];
}

export class StudentImportError extends Error {
  readonly code: 'UNSUPPORTED_FILE' | 'INVALID_TEMPLATE' | 'EMPTY_FILE' | 'UNREADABLE_FILE';

  constructor(
    code: 'UNSUPPORTED_FILE' | 'INVALID_TEMPLATE' | 'EMPTY_FILE' | 'UNREADABLE_FILE',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

function text(value: Row[number]): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function column(headers: readonly string[], aliases: readonly string[]): number {
  return headers.findIndex((header) => aliases.includes(header));
}

export function parseStudentRows(rows: readonly Row[]): StudentImportRow[] {
  if (rows.length === 0) throw new StudentImportError('EMPTY_FILE', 'File chưa có dữ liệu.');
  const headers = rows[0]!.map((cell) => normalized(text(cell)));
  const nameIndex = column(headers, ['ho va ten', 'ho ten', 'ten hoc sinh', 'name']);
  const emailIndex = column(headers, ['email', 'email hoc sinh']);
  const passwordIndex = column(headers, ['mat khau tam thoi', 'mat khau', 'password']);
  if (nameIndex < 0 || emailIndex < 0) {
    throw new StudentImportError('INVALID_TEMPLATE', 'File cần có hai cột “Họ và tên” và “Email”.');
  }

  const seenEmails = new Set<string>();
  const result = rows.slice(1).flatMap((row, index) => {
    if (row.every((cell) => text(cell) === '')) return [];
    const name = text(row[nameIndex]);
    const email = text(row[emailIndex]).toLocaleLowerCase('vi');
    const temporaryPassword = passwordIndex >= 0 ? text(row[passwordIndex]) : '';
    const issues: string[] = [];
    if (name.length < 2) issues.push('Họ và tên chưa hợp lệ.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('Email chưa hợp lệ.');
    if (seenEmails.has(email)) issues.push('Email bị lặp trong file.');
    if (email) seenEmails.add(email);
    if (temporaryPassword && temporaryPassword.length < 8) {
      issues.push('Mật khẩu tạm thời cần ít nhất 8 ký tự.');
    }
    return [
      {
        sourceIndex: index + 2,
        name,
        email,
        temporaryPassword,
        valid: issues.length === 0,
        issues,
      },
    ];
  });
  if (result.length === 0) throw new StudentImportError('EMPTY_FILE', 'File chưa có học sinh.');
  return result;
}

export async function parseStudentFile(
  fileName: string,
  buffer: Buffer,
): Promise<StudentImportPreview> {
  if (!fileName.toLocaleLowerCase('vi').endsWith('.xlsx')) {
    throw new StudentImportError('UNSUPPORTED_FILE', 'Chỉ hỗ trợ file Excel .xlsx.');
  }
  try {
    const sheets = await readXlsxFile(buffer);
    const students = parseStudentRows(sheets[0]?.data ?? []);
    const validCount = students.filter((student) => student.valid).length;
    return {
      fileName,
      totalCount: students.length,
      validCount,
      invalidCount: students.length - validCount,
      students,
    };
  } catch (error) {
    if (error instanceof StudentImportError) throw error;
    throw new StudentImportError('UNREADABLE_FILE', 'Không đọc được file Excel này.');
  }
}
