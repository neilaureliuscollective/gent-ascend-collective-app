export function ProductMediaPending({ title }: { title: string }) {
  return (
    <div className="reserve-media-pending">
      <span aria-hidden="true">LR</span>
      <strong>{title}</strong>
      <small>Product photography forthcoming</small>
    </div>
  );
}
