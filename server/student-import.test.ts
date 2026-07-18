// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseStudentRows, StudentImportError } from './student-import.ts';

describe('student Excel import', () => {
  it('accepts Vietnamese headers and reports duplicate or invalid rows', () => {
    const students = parseStudentRows([
      ['Họ và tên', 'Email', 'Mật khẩu tạm thời'],
      ['Nguyễn Hải Nam', 'nam@example.edu.vn', 'Neko@2026'],
      ['Trần Minh An', 'nam@example.edu.vn', 'short'],
      ['Lê Thu Hà', 'khong-phai-email', ''],
    ]);

    expect(students[0]).toMatchObject({
      sourceIndex: 2,
      name: 'Nguyễn Hải Nam',
      email: 'nam@example.edu.vn',
      valid: true,
    });
    expect(students[1]?.issues).toEqual(
      expect.arrayContaining([
        'Email bị lặp trong file.',
        'Mật khẩu tạm thời cần ít nhất 8 ký tự.',
      ]),
    );
    expect(students[2]?.issues).toContain('Email chưa hợp lệ.');
  });

  it('requires name and email columns', () => {
    expect(() =>
      parseStudentRows([
        ['Tên', 'Số điện thoại'],
        ['An', '0123'],
      ]),
    ).toThrowError(StudentImportError);
  });
});
