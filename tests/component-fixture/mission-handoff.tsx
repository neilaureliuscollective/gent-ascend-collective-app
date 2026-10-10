import { useEffect, useState } from 'react';
import { ConversationDraftProvider } from '@/components/aurelius/draft-handoff';
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { MissionWorkspace } from '@/components/missions/mission-workspace';
import type { Mission } from '@/domains/missions/schema';
export const syntheticMission: Mission = {
  id: 'dd000000-0000-4000-8000-000000000001',
  person_id: 'dd000000-0000-4000-8000-000000000002',
  conversation_id: 'dd000000-0000-4000-8000-000000000003',
  title: 'Website launch',
  objective: 'Launch landscaping website',
  status: 'active',
  decisions: 'Use a single clear offer',
  open_questions: 'Which photos can we use?',
  next_actions: 'Draft the homepage brief',
  revision: 1,
  created_at: '2026-10-06T00:00:00Z',
  updated_at: '2026-10-06T00:00:00Z',
};
export function MissionHandoffFixture() {
  const [talk, setTalk] = useState(new URLSearchParams(location.search).has('talk'));
  useEffect(() => {
    const open = () => setTalk(true);
    window.addEventListener('fixture-router-push', open);
    return () => window.removeEventListener('fixture-router-push', open);
  }, []);
  return (
    <ConversationDraftProvider>
      <p>Synthetic Mission fixture · no real account or live model.</p>
      {talk ? (
        <AureliusWorkspace initialConversation={syntheticMission.conversation_id} />
      ) : (
        <MissionWorkspace initial={syntheticMission} participants={['prometheus']} />
      )}
    </ConversationDraftProvider>
  );
}
