import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { DesignBoardView } from '@/components/aurelius/design-board';
import { CreationDetail } from '@/components/aurelius/creation-detail';
import { RetainedDesign } from '@/components/architect-origin/retained-design';
import {
  lifestyleLaunchBoard,
  designBoardContentSchema,
} from '@/domains/talk-creation/design-board';
import { TalkLiveFixture } from './talk-live';
import '@/app/globals.css';
import '@/app/imperial-workspace.css';
import '@/app/imperial-emerald-ii.css';
import '@/app/obsidian-smoked-glass.css';

function PremiumFixture() {
  const [board, setBoard] = useState(() =>
    designBoardContentSchema.parse(
      JSON.parse(
        localStorage.getItem('synthetic-premium-board') || JSON.stringify(lifestyleLaunchBoard()),
      ),
    ),
  );
  const [notice, setNotice] = useState('');
  const mode = new URLSearchParams(location.search).get('surface');
  if (mode === 'talk') return <TalkLiveFixture />;
  if (mode === 'board-detail')
    return (
      <main style={{ maxWidth: 1160, padding: 24, margin: 'auto' }}>
        <p className="eyebrow">Synthetic saved premium revision · no account or project writes</p>
        <CreationDetail
          creation={{
            id: '50000000-0000-4000-8000-000000000031',
            lineage_id: '50000000-0000-4000-8000-000000000031',
            person_id: 'synthetic',
            conversation_id: '30000000-0000-4000-8000-000000000031',
            source_turn_id: null,
            version: 2,
            predecessor_id: null,
            superseded_by: null,
            created_at: '2026-10-15',
            kind: 'board',
            content: board,
          }}
          images={[]}
          canEdit
          busy={false}
          error=""
          notice=""
          onClose={() => {}}
          onSave={() => {}}
          onCopy={() => {}}
          onSelect={() => {}}
          onHandoff={() => {}}
        />
      </main>
    );

  return (
    <main style={{ maxWidth: 1160, padding: '24px 16px', margin: 'auto' }}>
      <p className="eyebrow">
        Deterministic component acceptance · no account, provider or build execution
      </p>
      {mode === 'architect' ? (
        <RetainedDesign
          projectId="50000000-0000-4000-8000-000000000031"
          onContinue={() => setNotice('Build brief opened. No generation started.')}
        />
      ) : mode === 'document' ? (
        <CreationDetail
          creation={{
            id: '50000000-0000-4000-8000-000000000031',
            lineage_id: '50000000-0000-4000-8000-000000000031',
            person_id: 'synthetic',
            conversation_id: '30000000-0000-4000-8000-000000000031',
            source_turn_id: null,
            version: 1,
            predecessor_id: null,
            superseded_by: null,
            created_at: '2026-10-15',
            kind: 'brief',
            content: {
              title: 'A considered launch',
              purpose:
                'Create a campaign that feels as intentional as the essentials it introduces.\n\nThe first release should make one clear promise: a more considered daily ritual.',
              audience: 'Founders who value deliberate choices.',
              visualDirection:
                'Charcoal glass, luminous emerald and restrained gold. Use only the approved emblem.',
              requirements: [
                'Use the approved Aethelios identity.',
                'Keep product photography marked as not supplied.',
                'Review copy before publication.',
              ],
              unresolved: ['Launch date and product photography require approval.'],
            },
          }}
          images={[]}
          canEdit
          busy={false}
          error=""
          notice=""
          onClose={() => {}}
          onSave={() => {}}
          onCopy={() => {}}
          onSelect={() => {}}
          onHandoff={() => {}}
        />
      ) : (
        <DesignBoardView
          board={board}
          expanded
          editable
          onChange={setBoard}
          onCommit={(next) => {
            setBoard(next);
            localStorage.setItem('synthetic-premium-board', JSON.stringify(next));
            setNotice('Saved fixture revision.');
          }}
        />
      )}
      <p role="status">{notice}</p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<PremiumFixture />);
