import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchClassStudents,
  fetchTeacherClasses,
  type TeacherClassDto,
  type TeacherStudentSummaryDto,
} from './teacher-api';

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
  const [search, setSearch] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const requestedClassId = searchParams.get('classId');
  const selectedClassId =
    classes.find((classroom) => classroom.id === requestedClassId)?.id ?? classes[0]?.id ?? null;
  const selectedClass = classes.find((classroom) => classroom.id === selectedClassId);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTeacherClasses(controller.signal)
      .then(async (next) => {
        if (controller.signal.aborted) return;
        setClasses(next);
        const classId =
          next.find((classroom) => classroom.id === requestedClassId)?.id ?? next[0]?.id;
        if (!classId) {
          setStudents([]);
          return;
        }
        const response = await fetchClassStudents(classId, controller.signal);
        if (!controller.signal.aborted) setStudents(response.students);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Không tải được danh sách lớp và học sinh từ máy chủ.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [requestedClassId, retryCount]);

  const filteredStudents = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    if (!keyword) return students;
    return students.filter(
      (student) =>
        student.name.toLocaleLowerCase('vi').includes(keyword) ||
        student.email?.toLocaleLowerCase('vi').includes(keyword),
    );
  }, [search, students]);

  if (loading) {
    return (
      <section className="empty-state" role="status">
        <h1>Đang tải lớp học</h1>
        <p>Hệ thống đang lấy danh sách và tiến độ mới nhất từ máy chủ.</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state" role="alert">
        <h1>Chưa tải được danh sách học sinh</h1>
        <p>{error}</p>
        <button
          className="button-secondary"
          type="button"
          onClick={() => {
            setLoading(true);
            setError('');
            setRetryCount((n) => n + 1);
          }}
        >
          Thử tải lại
        </button>
      </section>
    );
  }

  return (
    <div className="page-stack teacher-students-page">
      <header className="page-heading">
        <p className="eyebrow">Theo dõi theo từng lớp</p>
        <h1>Quản lý học sinh</h1>
        <p>Chọn một lớp để xem tiến độ từng bài và mở hồ sơ của học sinh cần hỗ trợ.</p>
      </header>

      {classes.length === 0 ? (
        <section className="empty-state" role="status">
          <h2>Chưa tìm thấy lớp học trên máy chủ</h2>
          <p>
            Tài khoản giáo viên này chưa được gắn với lớp nào. Hãy kiểm tra dữ liệu lớp trên hệ
            thống.
          </p>
          <button
            className="button-secondary"
            type="button"
            onClick={() => {
              setLoading(true);
              setRetryCount((n) => n + 1);
            }}
          >
            Thử tải lại
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
                onClick={() => {
                  setLoading(true);
                  setSearchParams({ classId: classroom.id });
                }}
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
            </header>

            <label className="roster-search">
              <span>Tìm học sinh</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nhập tên hoặc email"
              />
            </label>

            {students.length === 0 ? (
              <div className="compact-empty">
                <h3>Lớp chưa có học sinh</h3>
                <p>Danh sách học sinh của lớp này chưa có trong dữ liệu máy chủ.</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="compact-empty">
                <h3>Không tìm thấy học sinh</h3>
                <p>Thử tìm bằng tên hoặc email khác.</p>
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
                          <Link
                            className="text-link"
                            to={`/teacher/students/${encodeURIComponent(student.id)}?classId=${encodeURIComponent(selectedClassId ?? '')}`}
                          >
                            Xem chi tiết
                          </Link>
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
