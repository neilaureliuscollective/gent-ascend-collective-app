import Link from 'next/link';
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import { currentFounderAccess } from '@/domains/access/founder';
import { founderBridgeLinked } from '@/domains/intelligence/founder-bridge';
export const dynamic = 'force-dynamic';
export default async function WorldConversation({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const params = await searchParams;
  const founder = await currentFounderAccess();
  const linked = founder && (await founderBridgeLinked());
  const id =
    typeof params.conversation === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.conversation,
    )
      ? params.conversation
      : null;
  return (
    <section className="gw-conversation">
      <ConversationViewport>
        <header className="aethelios-room-heading">
          <Link href="/experience/world" aria-label="Return to World">
            ←
          </Link>
          <div>
            <p className="gw-kicker">THE INTELLIGENCE</p>
            <h1 tabIndex={-1}>Aethelios</h1>
          </div>
        </header>
        <section className="aurelius-surface">
          <AureliusWorkspace initialConversation={id} founderLinked={linked} key={id ?? 'new'} />
        </section>
      </ConversationViewport>
    </section>
  );
}
