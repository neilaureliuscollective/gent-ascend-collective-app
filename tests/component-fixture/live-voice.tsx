import { useState } from 'react';
import { LiveConversationProvider, LiveVoiceEntry } from '@/components/live/provider';
export function LiveVoiceFixture() {
  const [view, setView] = useState('Talk');
  return (
    <LiveConversationProvider enabled>
      <h1>Synthetic voice fixture · no real account or provider</h1>
      <button onClick={() => setView(view === 'Talk' ? 'Studio' : 'Talk')}>
        Navigate workspace
      </button>
      <h2>{view}</h2>
      {view === 'Talk' && (
        <LiveVoiceEntry
          conversationId="ed000000-0000-4000-8000-000000000001"
          includeContext={false}
        />
      )}
    </LiveConversationProvider>
  );
}
export function LiveVoiceUnavailableFixture() {
  return (
    <LiveConversationProvider
      enabled={false}
      unavailableReason="Aethelios Live is not enabled on this deployment."
    >
      <h1>Synthetic voice fixture · no real account or provider</h1>
      <div className="talk-toolbar imperial-control-surface">
        <LiveVoiceEntry conversationId={null} includeContext={false} />
      </div>
    </LiveConversationProvider>
  );
}
