export function ReadinessNotice({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <aside className="origin-ready">
      <div>
        <p className="origin-ready-kicker">Readiness</p>
        <h2>{title}</h2>
        <div className="origin-ready-copy">{children}</div>
      </div>
      {action}
    </aside>
  );
}
