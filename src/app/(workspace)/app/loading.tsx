import Link from 'next/link';
import { Brand } from '@/components/visual/brand';
export default function Loading() {
  return (
    <div role="status" className="workspace-loading">
      <Brand />
      <p>Opening Aethelios…</p>
      <noscript>
        <p>
          If this screen stays here, enable JavaScript to use the interactive workspace. Your
          saved work stays with your account.
        </p>
      </noscript>
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
