interface StudentDataFailureProps {
  readonly onRetry: () => void;
}

export function StudentDataFailure({ onRetry }: StudentDataFailureProps) {
  return (
    <main className="page-stack">
      <section className="decision-panel decision-panel--review" role="alert">
        <div>
          <p className="eyebrow">Dữ liệu trên thiết bị</p>
          <h1>Chưa thể mở dữ liệu học tập</h1>
          <p>NekoPath chưa thay đổi dữ liệu cũ. Hãy thử lại để chuẩn bị đúng hồ sơ học sinh này.</p>
        </div>
        <button className="button-primary" type="button" onClick={onRetry}>
          Thử lại
        </button>
      </section>
    </main>
  );
}
