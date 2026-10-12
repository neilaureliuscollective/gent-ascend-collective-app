import Link from 'next/link';
import { IntelligencePresence } from '@/components/intelligence-motion/presence';
import { observedOperation } from '@/platform/visual/operation-adapters';
import { Brand } from '@/components/visual/brand';
export default function Loading() {
  return (
    <div role="status" className="workspace-loading">
      <Brand />
      <IntelligencePresence operation={observedOperation('workspace-load', 'loading')} />
      <p>Opening Aethelios…</p>
      <details className="workspace-loading-help">
        <summary>Having trouble opening your workspace?</summary>
        <p>
          Reload if opening takes longer than expected. Your saved work stays with your account.
        </p>
        <nav aria-label="Workspace fallback">
          <Link href="/enter">Your account</Link>
          {' · '}
          <Link href="/">Aethelios home</Link>
        </nav>
      </details>
    </div>
  );
}
