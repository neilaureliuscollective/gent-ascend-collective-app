import { useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { ConversationViewport } from '@/components/aurelius/conversation-viewport';
import { AureliusWorkspace } from '@/components/aurelius/workspace';
import { CommandTalkContext } from '@/components/command-home/talk-context';
import { CommandHome } from '@/components/command-home/workspace';
import {
  emptyRecords,
  projectCommandHome,
  type CommandHomeRecords,
} from '@/domains/command-home/model';
import '@/app/(workspace)/app/command-home.css';

const ownerId = '60000000-0000-4000-8000-000000000001';
const architectId = '61000000-0000-4000-8000-000000000001';
const secondId = '61000000-0000-4000-8000-000000000002';
const companyId = '62000000-0000-4000-8000-000000000001';
const jobId = '63000000-0000-4000-8000-000000000001';
const talkId = '65000000-0000-4000-8000-000000000001';

function labelledRecords(): CommandHomeRecords {
  const params = new URLSearchParams(location.search);
  if (params.get('empty') === '1') return emptyRecords(ownerId, '2026-10-14T16:00:00.000Z');
  return {
    ...emptyRecords(ownerId, '2026-10-14T16:00:00.000Z'),
    founderOffice: params.get('founder') === '1',
    architect: {
      availability: { id: 'architect', state: 'ready' },
      projects: [
        {
          id: architectId,
          name: 'Labelled Atlas chamber',
          description: 'Synthetic Architect fixture. Not a live project.',
          status: 'active',
          updatedAt: '2026-10-14T15:00:00.000Z',
          documents: [
            {
              id: '66000000-0000-4000-8000-000000000001',
              title: 'Chamber brief',
              kind: 'Product requirements',
              content: 'The chamber keeps the saved work in view. Labelled fixture excerpt.',
              status: 'draft',
            },
          ],
        },
        {
          id: secondId,
          name: 'Second labelled site',
          description: 'Another synthetic Architect project.',
          status: 'paused',
          updatedAt: '2026-10-13T12:00:00.000Z',
          documents: [],
        },
      ],
    },
    companies: [{ id: companyId, name: 'Synthetic House' }],
    jobs: [
      {
        id: jobId,
        companyId,
        conversationId: talkId,
        createdAt: '2026-10-13T12:00:00.000Z',
        request: 'Scope the next client review',
      },
    ],
    versions: [
      {
        jobId,
        revision: 2,
        title: 'Client review draft',
        summary: 'Labelled company deliverable waiting for review.',
        gaps: ['Need the signed brief'],
        slides: [{ title: 'Opening', body: 'Start with the actual saved outcome.' }],
        reviewedAt: null,
        createdAt: '2026-10-14T14:00:00.000Z',
      },
    ],
    studio: {
      availability: { id: 'studio', state: 'ready' },
      projects: [],
      versions: [],
    },
    conversations: [
      { id: talkId, title: 'Labelled saved thinking', updatedAt: '2026-10-11T12:00:00.000Z' },
    ],
    workAvailability: { id: 'work', state: 'ready' },
    talkAvailability: { id: 'talk', state: 'ready' },
  };
}

/** Isolated browser fixture: labelled synthetic Command records, no account or model. */
export function CommandHomeFixture() {
  const [talk, setTalk] = useState(false);
  const records = useMemo(() => labelledRecords(), []);
  const initial = useMemo(
    () => projectCommandHome(records, new URLSearchParams(location.search).get('focus')),
    [records],
  );

  useEffect(() => {
    const open = () => setTalk(true);
    window.addEventListener('fixture-router-push', open);
    const original = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = String(input);
      if (url.includes('/api/command-home')) {
        const query = new URL(url, location.origin).searchParams;
        return new Response(
          JSON.stringify(projectCommandHome(records, query.get('focus'), query.get('previous'))),
          { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } },
        );
      }
      if (url.includes('/api/aurelius')) {
        return new Response(
          JSON.stringify({
            ownerId,
            conversations: [],
            turns: [],
            memories: [],
            actionProposals: [],
            context: {
              profile: {
                name: 'Synthetic tester',
                priority: '',
                timezone: 'America/Chicago',
                units: 'metric',
                updatedAt: '2026-09-21',
              },
              goal: null,
              memories: [],
            },
            canChat: true,
            configured: true,
            model: 'synthetic-model',
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return original(input, init);
    };
    return () => {
      window.removeEventListener('fixture-router-push', open);
      window.fetch = original;
    };
  }, [records]);

  return (
    <Shell founderOffice={records.founderOffice}>
      <p role="note">Synthetic Command fixture · labelled records, no account or live model.</p>
      {talk ? (
        <ConversationViewport>
          <CommandTalkContext>
            <AureliusWorkspace />
          </CommandTalkContext>
        </ConversationViewport>
      ) : (
        <CommandHome initial={initial} founderOffice={records.founderOffice} />
      )}
    </Shell>
  );
}
