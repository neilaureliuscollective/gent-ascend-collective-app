import { useEffect, useState } from 'react';
import { DailyDashboard } from '@/components/dashboard/daily-dashboard';
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { Shell } from '@/components/shell';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import { sampleData } from '@/domains/daily/model';
/** Isolated browser fixture: synthetic records, no server identity or real model. */
export function HomeHandoffFixture() {
  const [talk, setTalk] = useState(false);
  useEffect(() => {
    const open = () => setTalk(true);
    window.addEventListener('fixture-router-push', open);
    return () => window.removeEventListener('fixture-router-push', open);
  }, []);
  return (
    <Shell>
      {talk ? (
        <ConversationViewport>
          <AureliusWorkspace />
        </ConversationViewport>
      ) : (
        <DailyDashboard
          asOf="2026-09-21T14:00:00Z"
          initial={{
            ...sampleData('2026-09-21'),
            mode: 'personal',
            ownerId: '60000000-0000-4000-8000-000000000001',
            name: 'Synthetic tester',
          }}
        />
      )}
    </Shell>
  );
}
