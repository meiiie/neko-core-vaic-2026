import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  createTeacherClass,
  fetchClassStudents,
  fetchTeacherClasses,
  type TeacherClassDto,
  type TeacherStudentSummaryDto,
} from './teacher-api';

interface ImportStudentRow {
  sourceIndex: number;
  name: string;
  email: string;
  temporaryPassword: string;
  accountStatus: 'NEW' | 'EXISTING';
  valid: boolean;
  issues: string[];
}

interface ImportPreview {
  fileName: string;
  students: ImportStudentRow[];
}

function activityLabel(value: string | null): string {
  if (!value) return 'Chưa có bài làm';
  return new Date(value).toLocaleString('vi-VN');
}

export function TeacherStudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [classes, setClasses] = useState<readonly TeacherClassDto[]>([]);
  const [students, setStudents] = useState<readonly TeacherStudentSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateClass, setShowCreateClass] = useState(searchParams.get('newClass') === '1');
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [search, setSearch] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('Toán');
  const [schoolYear, setSchoolYear] = useState('2026–2027');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState<
    readonly { email: string; temporaryPassword: string }[]
  >([]);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedClassId =
    classes.find((classroom) => classroom.id === searchParams.get('classId'))?.id ??
    classes[0]?.id ??
    null;
  const selectedClass = classes.find((classroom) => classroom.id === selectedClassId);

  const loadClasses = useCallback(async () => {
    const next = await fetchTeacherClasses();
    setClasses(next);
    return next;
  }, []);

  const loadStudents = useCallback(async (classId: string) => {
    const response = await fetchClassStudents(classId);
    setStudents(response.students);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchTeacherClasses()
      .then(async (next) => {
        if (!active) return;
        setClasses(next);
        const classId =
          next.find((classroom) => classroom.id === searchParams.get('classId'))?.id ?? next[0]?.id;
        if (classId) await loadStudents(classId);
        if (active) setError('');
      })
      .catch(() => {
        if (active) setError('Không tải được danh sách lớp và học sinh từ máy chủ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadClasses, loadStudents, searchParams]);

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    if (!keyword) return students;
    return students.filter(
      (student) =>
        student.name.toLocaleLowerCase('vi').includes(keyword) ||
        student.email?.toLocaleLowerCase('vi').includes(keyword),
    );
  }, [search, students]);

  async function createClass(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setGeneratedCredentials([]);
    try {
      const classroom = await createTeacherClass({ name: className, subject, schoolYear });
      const next = await loadClasses();
      setSearchParams({ classId: classroom.id });
      setClasses(next);
      setStudents([]);
      setClassName('');
      setShowCreateClass(false);
      setNotice(`Đã tạo lớp ${classroom.name}. Bây giờ cô có thể thêm học sinh.`);
    } catch {
      setNotice('Không tạo được lớp. Tên lớp có thể đã tồn tại.');
    } finally {
      setBusy(false);
    }
  }

  async function addOneStudent(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedClassId) return;
    setBusy(true);
    setNotice('');
    setGeneratedCredentials([]);
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(selectedClassId)}/students`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: studentName,
            email: studentEmail,
            ...(temporaryPassword ? { temporaryPassword } : {}),
          }),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { temporaryPassword: string | null };
      await Promise.all([loadStudents(selectedClassId), loadClasses()]);
      setNotice(
        body.temporaryPassword
          ? `Đã thêm học sinh. Mật khẩu tạm thời (chỉ hiện lần này): ${body.temporaryPassword}`
          : 'Đã thêm tài khoản học sinh hiện có vào lớp.',
      );
      setGeneratedCredentials(
        body.temporaryPassword
          ? [{ email: studentEmail, temporaryPassword: body.temporaryPassword }]
          : [],
      );
      setStudentName('');
      setStudentEmail('');
      setTemporaryPassword('');
    } catch {
      setNotice(
        'Không thêm được học sinh. Hãy kiểm tra email hoặc học sinh có thể đã ở trong lớp.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function previewFile(file: File | undefined) {
    if (!file || !selectedClassId) return;
    setBusy(true);
    setNotice('');
    setGeneratedCredentials([]);
    const form = new FormData();
    form.append('file', file);
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(selectedClassId)}/students/import/preview`,
        { method: 'POST', credentials: 'include', body: form },
      );
      if (!response.ok) throw new Error(String(response.status));
      setPreview((await response.json()) as ImportPreview);
    } catch {
      setPreview(null);
      setNotice('Không đọc được file. File cần là .xlsx và có cột “Họ và tên”, “Email”.');
    } finally {
      setBusy(false);
    }
  }

  async function importStudents() {
    if (!preview || !selectedClassId) return;
    const validStudents = preview.students
      .filter((student) => student.valid)
      .map(({ name, email, temporaryPassword: password }) => ({
        name,
        email,
        ...(password ? { temporaryPassword: password } : {}),
      }));
    if (validStudents.length === 0) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(selectedClassId)}/students/import`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ students: validStudents }),
        },
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as {
        importedCount: number;
        credentials: { email: string; temporaryPassword: string }[];
      };
      await Promise.all([loadStudents(selectedClassId), loadClasses()]);
      setPreview(null);
      setGeneratedCredentials(body.credentials);
      setNotice(
        body.credentials.length > 0
          ? `Đã thêm ${body.importedCount} học sinh. Có ${body.credentials.length} mật khẩu tạm thời trong kết quả vừa tạo.`
          : `Đã thêm ${body.importedCount} học sinh vào lớp.`,
      );
    } catch {
      setNotice('Chưa nhập được danh sách. Hãy xem lại các dòng báo lỗi rồi thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(student: TeacherStudentSummaryDto) {
    if (!selectedClassId) return;
    const confirmed = window.confirm(
      `Xóa ${student.name} khỏi ${selectedClass?.name ?? 'lớp này'}? Tài khoản và bài làm cũ vẫn được giữ lại.`,
    );
    if (!confirmed) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch(
        `/api/teacher/classes/${encodeURIComponent(selectedClassId)}/students/${encodeURIComponent(student.id)}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!response.ok) throw new Error(String(response.status));
      await Promise.all([loadStudents(selectedClassId), loadClasses()]);
      setNotice(`Đã xóa ${student.name} khỏi lớp. Tài khoản học sinh không bị xóa.`);
    } catch {
      setNotice('Không xóa được học sinh khỏi lớp. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="empty-state" role="status">
        <h1>Đang tải lớp học</h1>
      </section>
    );

  return (
    <div className="page-stack teacher-students-page">
      <header className="page-heading teacher-heading-row">
        <div>
          <p className="eyebrow">Theo dõi theo từng lớp</p>
          <h1>Quản lý học sinh</h1>
          <p>Chọn một lớp để xem danh sách, tiến độ từng bài và học sinh cần hỗ trợ.</p>
        </div>
        <button className="button-primary" type="button" onClick={() => setShowCreateClass(true)}>
          Tạo lớp học
        </button>
      </header>

      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="teacher-notice" role="status">
          {notice}
        </p>
      ) : null}
      {generatedCredentials.length > 0 ? (
        <section className="temporary-credentials" aria-labelledby="temporary-credentials-heading">
          <h2 id="temporary-credentials-heading">Mật khẩu tạm thời — chỉ hiện lần này</h2>
          <p>Gửi riêng cho từng học sinh và yêu cầu đổi mật khẩu sau lần đăng nhập đầu tiên.</p>
          <div>
            {generatedCredentials.map((credential) => (
              <p key={credential.email}>
                <strong>{credential.email}</strong>
                <code>{credential.temporaryPassword}</code>
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {showCreateClass ? (
        <form className="summary-panel class-create-form" onSubmit={createClass}>
          <header>
            <h2>Tạo lớp học mới</h2>
            <p>Điền tên dễ nhận biết để dùng xuyên suốt khi giao bài và xem tiến độ.</p>
          </header>
          <label>
            <span>Tên lớp</span>
            <input
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="Ví dụ: Lớp 7A"
              required
              minLength={2}
            />
          </label>
          <label>
            <span>Môn học</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
          </label>
          <label>
            <span>Năm học</span>
            <input
              value={schoolYear}
              onChange={(event) => setSchoolYear(event.target.value)}
              placeholder="2026–2027"
            />
          </label>
          <div className="form-actions">
            <button className="button-primary" disabled={busy}>
              Tạo lớp
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => setShowCreateClass(false)}
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {classes.length === 0 ? (
        <section className="empty-state">
          <h2>Chưa có lớp để quản lý</h2>
          <p>Tạo lớp đầu tiên, sau đó thêm từng học sinh hoặc nhập danh sách Excel.</p>
          <button className="button-primary" type="button" onClick={() => setShowCreateClass(true)}>
            Tạo lớp học
          </button>
        </section>
      ) : (
        <div className="class-management-layout">
          <aside className="class-list-panel" aria-label="Các lớp của giáo viên">
            <h2>Lớp của cô</h2>
            {classes.map((classroom) => (
              <button
                key={classroom.id}
                type="button"
                data-active={classroom.id === selectedClassId || undefined}
                onClick={() => setSearchParams({ classId: classroom.id })}
              >
                <span>
                  <strong>{classroom.name}</strong>
                  <small>
                    {classroom.subject} {classroom.schoolYear ? `· ${classroom.schoolYear}` : ''}
                  </small>
                </span>
                <span>{classroom.studentCount}</span>
              </button>
            ))}
          </aside>

          <section className="summary-panel roster-panel" aria-labelledby="roster-heading">
            <header className="panel-heading">
              <div>
                <p className="eyebrow">{selectedClass?.subject}</p>
                <h2 id="roster-heading">{selectedClass?.name}</h2>
                <p>
                  {students.length} học sinh ·{' '}
                  {students.filter((student) => student.needsSupportCount > 0).length} em cần chú ý
                </p>
              </div>
              <button
                className="button-primary"
                type="button"
                onClick={() => setShowAddStudents((value) => !value)}
              >
                Thêm học sinh
              </button>
            </header>

            {showAddStudents ? (
              <div className="student-add-panel">
                <form onSubmit={addOneStudent}>
                  <h3>Thêm một học sinh</h3>
                  <label>
                    <span>Họ và tên</span>
                    <input
                      value={studentName}
                      onChange={(event) => setStudentName(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Email đăng nhập</span>
                    <input
                      type="email"
                      value={studentEmail}
                      onChange={(event) => setStudentEmail(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Mật khẩu tạm thời (không bắt buộc)</span>
                    <input
                      value={temporaryPassword}
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                      minLength={8}
                      placeholder="Hệ thống sẽ tự tạo nếu để trống"
                    />
                  </label>
                  <button className="button-secondary" disabled={busy}>
                    Thêm vào lớp
                  </button>
                </form>
                <div className="excel-import-panel">
                  <h3>Nhập danh sách Excel</h3>
                  <p>
                    File .xlsx cần có cột <strong>Họ và tên</strong>, <strong>Email</strong>; có thể
                    thêm cột <strong>Mật khẩu tạm thời</strong>.
                  </p>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => void previewFile(event.target.files?.[0])}
                  />
                  {preview ? (
                    <div className="import-preview">
                      <p>
                        <strong>
                          {preview.students.filter((student) => student.valid).length}
                        </strong>{' '}
                        dòng có thể thêm ·{' '}
                        <strong>
                          {preview.students.filter((student) => !student.valid).length}
                        </strong>{' '}
                        dòng cần sửa
                      </p>
                      <ul>
                        {preview.students
                          .filter((student) => !student.valid)
                          .slice(0, 5)
                          .map((student) => (
                            <li key={student.sourceIndex}>
                              Dòng {student.sourceIndex}: {student.issues.join(' ')}
                            </li>
                          ))}
                      </ul>
                      <button
                        className="button-secondary"
                        type="button"
                        disabled={busy || preview.students.every((student) => !student.valid)}
                        onClick={() => void importStudents()}
                      >
                        Xác nhận thêm học sinh hợp lệ
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <label className="roster-search">
              <span>Tìm học sinh</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nhập tên hoặc email"
              />
            </label>

            {filteredStudents.length === 0 ? (
              <div className="compact-empty">
                <h3>Chưa có học sinh trong lớp</h3>
                <p>Chọn “Thêm học sinh” để nhập thủ công hoặc bằng Excel.</p>
              </div>
            ) : (
              <div className="student-table-wrap">
                <table className="student-progress-table">
                  <thead>
                    <tr>
                      <th>Học sinh</th>
                      <th>Tiến độ bài được giao</th>
                      <th>Cần chú ý</th>
                      <th>Hoạt động gần nhất</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <strong>{student.name}</strong>
                          <small>{student.email}</small>
                        </td>
                        <td>
                          <div
                            className="progress-track"
                            aria-label={`${student.progressPercent}%`}
                          >
                            <span style={{ width: `${student.progressPercent}%` }} />
                          </div>
                          <small>{student.progressPercent}%</small>
                        </td>
                        <td>
                          {student.needsSupportCount > 0 ? (
                            <span className="status-pill status-pill--attention">
                              {student.needsSupportCount} bài
                            </span>
                          ) : (
                            <span className="status-pill">Chưa có dấu hiệu</span>
                          )}
                        </td>
                        <td>
                          <small>{activityLabel(student.latestActivityAt)}</small>
                        </td>
                        <td>
                          <div className="student-row-actions">
                            <Link
                              className="text-link"
                              to={`/teacher/students/${encodeURIComponent(student.id)}?classId=${encodeURIComponent(selectedClassId ?? '')}`}
                            >
                              Xem chi tiết
                            </Link>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeStudent(student)}
                            >
                              Xóa khỏi lớp
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
