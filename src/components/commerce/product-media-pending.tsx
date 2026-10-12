export function ProductMediaPending({ title }: { title: string }) {
  return (
    <div className="reserve-media-pending">
      <span aria-hidden="true">A / L</span>
      <strong>{title}</strong>
      <small>Product photography forthcoming</small>
    </div>
  );
}
