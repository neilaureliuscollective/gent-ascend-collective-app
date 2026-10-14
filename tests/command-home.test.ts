import { describe, expect, it } from 'vitest';
import {
  collectAttention,
  emptyRecords,
  parseFocus,
  projectCommandHome,
  resolveSelectedKey,
  serializeFocus,
  type ArchitectRecord,
  type CommandHomeRecords,
  type JobRecord,
  type TalkRecord,
  type WorkVersionRecord,
} from '../src/domains/command-home/model';

const owner = '60000000-0000-4000-8000-000000000001';
const architectId = '61000000-0000-4000-8000-000000000001';
const olderArchitect = '61000000-0000-4000-8000-000000000002';
const companyId = '62000000-0000-4000-8000-000000000001';
const jobId = '63000000-0000-4000-8000-000000000001';
const studioId = '64000000-0000-4000-8000-000000000001';
const talkId = '65000000-0000-4000-8000-000000000001';
const documentId = '66000000-0000-4000-8000-000000000001';
const asOf = '2026-10-14T16:00:00.000Z';

const architect: ArchitectRecord = {
  id: architectId,
  name: 'Atlas chamber',
  description: 'A saved Origin project about a private chamber.',
  status: 'active',
  updatedAt: '2026-10-14T15:00:00.000Z',
  documents: [
    {
      id: documentId,
      title: 'Chamber brief',
      kind: 'Product requirements',
      content: 'The chamber keeps the work in view without inventing motion.',
      status: 'draft',
    },
  ],
};

const job: JobRecord = {
  id: jobId,
  companyId,
  conversationId: talkId,
  createdAt: '2026-10-13T12:00:00.000Z',
  request: 'Scope the next client review',
};

const version: WorkVersionRecord = {
  jobId,
  revision: 2,
  title: 'Client review draft',
  summary: 'Saved deliverable waiting for the owner to review.',
  gaps: ['Need the signed brief'],
  slides: [{ title: 'Opening', body: 'Start with the actual saved outcome.' }],
  reviewedAt: null,
  createdAt: '2026-10-14T14:00:00.000Z',
};

function records(overrides: Partial<CommandHomeRecords> = {}): CommandHomeRecords {
  return {
    ...emptyRecords(owner, asOf),
    architect: {
      availability: { id: 'architect', state: 'ready' },
      projects: [architect],
    },
    companies: [{ id: companyId, name: 'Synthetic House' }],
    jobs: [job],
    versions: [version],
    studio: {
      availability: { id: 'studio', state: 'ready' },
      projects: [{ id: studioId, title: 'Crest studies', updatedAt: '2026-10-12T12:00:00.000Z' }],
      versions: [
        {
          id: '67000000-0000-4000-8000-000000000001',
          projectId: studioId,
          status: 'complete',
          prompt: 'Standing gentleman crest on smoked graphite',
          createdAt: '2026-10-12T12:00:00.000Z',
        },
      ],
    },
    conversations: [{ id: talkId, title: 'Saved thinking', updatedAt: '2026-10-11T12:00:00.000Z' }],
    workAvailability: { id: 'work', state: 'ready' },
    talkAvailability: { id: 'talk', state: 'ready' },
    ...overrides,
  };
}

describe('Command home projection', () => {
  it('parses owned focus keys and rejects foreign shapes', () => {
    expect(parseFocus(`architect:${architectId}`)).toEqual({
      source: 'architect',
      id: architectId,
    });
    expect(parseFocus(`company:${companyId}:${jobId}`)).toEqual({
      source: 'company',
      companyId,
      id: jobId,
    });
    expect(parseFocus('architect:not-a-uuid')).toBeNull();
    expect(parseFocus(`company:${companyId}`)).toBeNull();
    expect(serializeFocus({ source: 'studio', id: studioId })).toBe(`studio:${studioId}`);
  });

  it('keeps the chosen project while newer work arrives', () => {
    const home = projectCommandHome(records(), `studio:${studioId}`);
    expect(home.selected?.id).toBe(studioId);
    const newer = records({
      architect: {
        availability: { id: 'architect', state: 'ready' },
        projects: [
          { ...architect, updatedAt: '2026-10-14T15:50:00.000Z' },
          {
            ...architect,
            id: olderArchitect,
            name: 'Newer project',
            updatedAt: '2026-10-14T15:55:00.000Z',
            documents: [],
          },
        ],
      },
    });
    expect(resolveSelectedKey(projectCommandHome(newer).items, null, home.selectedKey)).toBe(
      home.selectedKey,
    );
  });

  it('ignores stale or foreign focus instead of inventing access', () => {
    const home = projectCommandHome(
      records(),
      'architect:88000000-0000-4000-8000-000000000099',
    );
    expect(home.selected?.source).toBe('architect');
    expect(home.selected?.id).toBe(architectId);
    expect(home.items.every((item) => item.id !== '88000000-0000-4000-8000-000000000099')).toBe(
      true,
    );
  });

  it('shows a real excerpt and authorized Studio image, never a manufactured screenshot', () => {
    const architectHome = projectCommandHome(records(), `architect:${architectId}`);
    expect(architectHome.artifact.excerpt).toContain('chamber keeps the work');
    expect(architectHome.artifact.imageHref).toBeNull();
    const studioHome = projectCommandHome(records(), `studio:${studioId}`);
    expect(studioHome.artifact.imageHref).toBe(
      '/api/studio/image?id=67000000-0000-4000-8000-000000000001&kind=version',
    );
    expect(studioHome.artifact.provenance).toContain('authorized account image');
  });

  it('only lists genuine attention and distinguishes review from approval and running jobs', () => {
    const home = projectCommandHome(records(), `architect:${architectId}`);
    const kinds = home.attention.map((item) => item.kind);
    expect(kinds).toContain('review-result');
    expect(kinds).toContain('missing-input');
    expect(kinds).toContain('continue-draft');
    expect(home.attention.find((item) => item.kind === 'review-result')?.kindLabel).toBe(
      'Review suggestion',
    );
    expect(home.attention.some((item) => /approv/i.test(item.kindLabel))).toBe(false);
    expect(home.attention.some((item) => item.href.includes('/app/founder'))).toBe(false);
    expect(
      collectAttention(home.items, records({ versions: [{ ...version, reviewedAt: asOf, gaps: [] }] }), home.selected)
        .filter((item) => item.source === 'Work'),
    ).toEqual([]);
  });

  it('goes quiet when nothing needs the owner', () => {
    const quiet = projectCommandHome(
      records({
        architect: {
          availability: { id: 'architect', state: 'ready' },
          projects: [{ ...architect, documents: [], running: false }],
        },
        versions: [{ ...version, reviewedAt: asOf, gaps: [] }],
        studio: {
          availability: { id: 'studio', state: 'ready' },
          projects: [],
          versions: [],
        },
      }),
    );
    expect(quiet.attention).toEqual([]);
  });

  it('keeps empty accounts honest and does not fabricate scores or jobs', () => {
    const empty = projectCommandHome(emptyRecords(owner, asOf));
    expect(empty.items).toEqual([]);
    expect(empty.attention).toEqual([]);
    expect(empty.orientation.line).toMatch(/Nothing saved yet/);
    expect(JSON.stringify(empty)).not.toMatch(/revenue|productivity|agent count|% complete/i);
  });

  it('labels founder office as a separate destination, never as home data', () => {
    const home = projectCommandHome({ ...records(), founderOffice: true });
    expect(home.founderOffice).toBe(true);
    expect(home.items.some((item) => item.href.startsWith('/app/founder'))).toBe(false);
  });

  it('keeps Talk conversations selectable without claiming they have a document preview', () => {
    const talk: TalkRecord = {
      id: talkId,
      title: 'Saved thinking',
      updatedAt: '2026-10-14T15:30:00.000Z',
    };
    const home = projectCommandHome(
      records({ conversations: [talk] }),
      `talk:${talkId}`,
    );
    expect(home.selected?.resumeHref).toBe(`/app/aethelios?conversation=${talkId}`);
    expect(home.artifact.kind).toBe('conversation');
    expect(home.artifact.fallback).toMatch(/does not reconstruct/);
  });
});
