import { Brand } from '@/components/visual/brand';
export default function Loading() {
  return (
    <div role="status" className="workspace-loading">
      <Brand />
      <p>Opening your Gent Ascend workspace…</p>
    </div>
  );
}
