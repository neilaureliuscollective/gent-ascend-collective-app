import Link from 'next/link';
import type { Metadata } from 'next';
import { aethelios } from '@/platform/intelligence-identity';
export const metadata: Metadata = {
  title: 'Aethelios',
  description: aethelios.description,
};
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { currentFounderAccess } from '@/domains/access/founder';
import { founderBridgeLinked } from '@/domains/intelligence/founder-bridge';
export default async function AetheliosPage({
  searchParams,
}: {
  searchParams: Promise<{ starter?: string; conversation?: string; link?: string }>;
}) {
  const params = await searchParams;
  const isFounder = await currentFounderAccess();
  const linked = isFounder && await founderBridgeLinked();
  const starters: Record<string, string> = {
    plan: 'Help me choose what matters most today and turn it into a manageable plan.',
    reflect:
      'Help me reflect on today: what mattered, what I learned, and what to carry into tomorrow.',
    perspective: 'Help me think clearly about a decision I am facing.',
  };
  const initialDraft =
    typeof params.starter === 'string' && Object.hasOwn(starters, params.starter)
      ? starters[params.starter]
      : '';
  const initialConversation =
    typeof params.conversation === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.conversation,
    )
      ? params.conversation
      : null;
  return (
    <>
      <div className="page-heading compact-heading aurelius-page-heading">
        <div>
          <p className="eyebrow">Digital Co-Founder</p>
          <h1>Aethelios.</h1>
        </div>
        <p className="muted">
          A considered perspective. A deliberate next step.
          <br />
          <Link href="/aethelios/meet" className="text-link">
            Meet Aethelios →
          </Link>
        </p>
      </div>
      {isFounder && (
        <aside className="aethelios-link-panel">
          <strong>Founder continuity</strong>
          <p>{params.link === 'failed' ? 'The link could not be completed. Sign in to your private Aethelios workspace, then try again. ' : ''}
            {linked ? 'Your private Aethelios teaching is linked. Confirmed shared and Gent Ascend memories can inform your chats when you turn on personal context.' : <>Sign in to your <a href="https://aethelios.vercel.app" target="_blank" rel="noopener noreferrer">private Aethelios workspace</a> first, then connect it here once. Relevant teaching will be available when you turn on personal context.</>}
          </p>
          {linked ? <form action="/api/aethelios-link/disconnect" method="post"><button type="submit" className="button">Disconnect private account</button></form> :
            <a href="/api/aethelios-link/start" className="button">Connect private Aethelios</a>}
        </aside>
      )}
      <section className="aurelius-surface">
        <AureliusWorkspace
          founderLinked={linked}
          key={initialConversation ?? (initialDraft || 'new')}
          initialDraft={initialDraft}
          initialConversation={initialConversation}
        />
      </section>
    </>
  );
}
