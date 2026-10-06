import Link from 'next/link';
import { Brand } from '@/components/visual/brand';
export default function Loading() {
  return (
    <div role="status" className="workspace-loading">
      <Brand />
      <p>Opening your Aethelios workspace…</p>
      <div className="workspace-loading-help">
        <p>If this screen stays here, enable JavaScript and reload to open your saved context.</p>
        <nav aria-label="Workspace fallback">
          <Link href="/enter">Member entrance</Link>
          {' · '}
          <Link href="/">Aethelios</Link>
        </nav>
      </div>
    </div>
  );
}
