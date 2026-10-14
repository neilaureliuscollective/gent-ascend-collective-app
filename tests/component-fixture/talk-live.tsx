import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import { LiveConversationProvider } from '@/components/live/provider';
/** Isolated Talk+Live fixture: synthetic records, no real account or provider. */
export function TalkLiveFixture() {
  if (!window.location.pathname.endsWith('/aethelios')) {
    const url = new URL(window.location.href);
    window.history.replaceState(window.history.state, '', '/app/aethelios' + url.search);
  }
  return (
    <div className="imperial-workspace aethelios-aether">
      <LiveConversationProvider enabled>
        <ConversationViewport>
          <section className="aurelius-surface">
            <AureliusWorkspace />
          </section>
        </ConversationViewport>
      </LiveConversationProvider>
    </div>
  );
}
