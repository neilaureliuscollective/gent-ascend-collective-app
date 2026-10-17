import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import { LiveConversationProvider } from '@/components/live/provider';
/** Isolated Talk+Live fixture: synthetic records, no real account or provider. */
export function TalkLiveFixture() {
  if (!window.location.pathname.endsWith('/aethelios')) {
    const url = new URL(window.location.href);
    window.history.replaceState(window.history.state, '', '/app/aethelios' + url.search);
  }
  const conversation = new URLSearchParams(window.location.search).get('conversation');
  const initialConversation =
    conversation &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(conversation)
      ? conversation
      : null;
  return (
    <div className="imperial-workspace aethelios-aether">
      <LiveConversationProvider enabled>
        <ConversationViewport>
          <section className="aurelius-surface">
            <AureliusWorkspace initialConversation={initialConversation} />
          </section>
        </ConversationViewport>
      </LiveConversationProvider>
    </div>
  );
}
