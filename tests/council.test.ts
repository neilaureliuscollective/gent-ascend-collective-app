import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/intelligence/model', () => ({ generateReply: vi.fn() }));
import {
  council,
  councilFromVersion,
  councilPromptVersion,
  relevantCouncil,
  tableRoutes,
} from '../src/domains/intelligence/council';
import { chatInput } from '../src/domains/intelligence/validation';
import {
  generateCouncilReply,
  type CouncilRunner,
} from '../src/domains/intelligence/council-model';
import type { ModelChunk } from '../src/domains/intelligence/stream';
import { replyStream } from '../src/domains/intelligence/stream';
import type { Turn } from '../src/domains/intelligence/types';
const request = {
  conversationId: 'bb000000-0000-4000-8000-000000000001',
  requestId: 'bb000000-0000-4000-8000-000000000002',
  text: 'Compare these options',
  includeContext: false,
};
const cast = { kind: 'table' as const, specialists: ['athena', 'themis'] as const };
const selected = { ...cast, specialists: [...cast.specialists] };
const runner: CouncilRunner = {
  perspective: vi.fn(async (id) => ({ id, text: `${id} advice`, input: 10, output: 20 })),
  synthesize: vi.fn(async function* (): AsyncGenerator<ModelChunk> {
    yield { type: 'text', text: 'One useful next step' };
    yield { type: 'finish', reason: 'stop', input: 30, output: 40 };
  }),
};
describe('member Council contract', () => {
  it('preserves inspected roles, routes relevant lenses and does not advertise founder tools', () => {
    expect(council.find((x) => x.id === 'hermes')?.role).toBe('Growth & commercial operations');
    expect(relevantCouncil('Fix this database bug').map((x) => x.id)).toContain('prometheus');
    expect(relevantCouncil('Plan travel options').map((x) => x.id)).toEqual(['athena']);
    expect(relevantCouncil('Hello')).toEqual([]);
    expect(tableRoutes('A personal question').map((x) => x.id)).toEqual(['athena', 'themis']);
    expect(
      relevantCouncil('Compare strategy for a business brand and code').length,
    ).toBeLessThanOrEqual(3);
  });
  it('accepts ordinary chat and deliberate specialist/Table requests; rejects injected authority and invalid casts', () => {
    expect(chatInput.safeParse(request).success).toBe(true);
    expect(chatInput.safeParse({ ...request, council: selected }).success).toBe(true);
    for (const council of [
      { kind: 'table', specialists: ['athena'] },
      { kind: 'table', specialists: ['athena', 'athena'] },
      { kind: 'specialist', specialists: ['founder'] },
      { kind: 'table', specialists: ['athena', 'themis'], ownerId: 'neil' },
      { kind: 'specialist', specialists: ['athena', 'apollo'] },
    ])
      expect(chatInput.safeParse({ ...request, council }).success).toBe(false);
    expect(chatInput.safeParse({ ...request, personId: 'other-account' }).success).toBe(false);
  });
  it('roundtrips the exact cast on the existing ledger and fails closed on unknown versions', () => {
    expect(councilFromVersion(councilPromptVersion(selected))).toEqual(selected);
    expect(councilPromptVersion(selected).length).toBeLessThan(80);
    for (const v of [
      'aethelios-2026-10-02.integrated.1',
      'council.1.t.athena',
      'council.1.s.athena,apollo',
      'council.1.t.neil,athena',
      'council.1.t.athena,athena',
    ])
      expect(councilFromVersion(v)).toBeNull();
  });
  it('runs independent perspectives then Aethelios synthesis with aggregate usage', async () => {
    const chunks = [];
    for await (const chunk of generateCouncilReply(
      'test-model',
      [{ role: 'user', content: 'member-only question' }],
      selected,
      new AbortController().signal,
      runner,
    ))
      chunks.push(chunk);
    expect(
      chunks
        .filter((x) => x.type === 'text')
        .map((x) => x.text)
        .join(''),
    ).toContain('Aethelios synthesis');
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: 'stop', input: 50, output: 80 });
    expect(runner.perspective).toHaveBeenCalledWith(
      'athena',
      'test-model',
      [{ role: 'user', content: 'member-only question' }],
      expect.any(AbortSignal),
    );
  });
  it('single specialist does not synthesize or silently involve other specialists', async () => {
    const execute = {
      ...runner,
      perspective: vi.fn(runner.perspective),
      synthesize: vi.fn(runner.synthesize),
    };
    const chunks = [];
    for await (const chunk of generateCouncilReply(
      'test-model',
      [],
      { kind: 'specialist', specialists: ['apollo'] },
      new AbortController().signal,
      execute,
    ))
      chunks.push(chunk);
    expect(execute.perspective).toHaveBeenCalledTimes(1);
    expect(execute.synthesize).not.toHaveBeenCalled();
    expect(chunks.at(-1)?.type).toBe('finish');
  });
  it('a provider failure retains completed contributions, marks failure, and never emits saved synthesis', async () => {
    const execute = {
      ...runner,
      perspective: vi.fn(async (id) => {
        if (id === 'themis') throw Error('provider secret');
        return { id, text: 'Recorded perspective', input: 10, output: 20 };
      }),
      synthesize: vi.fn(runner.synthesize),
    } satisfies CouncilRunner;
    const finish = vi.fn(
      async (text, status, input, output) =>
        ({ assistant_text: text, status, input, output }) as unknown as Turn,
    );
    const response = new Response(
      replyStream(
        (signal) => generateCouncilReply('test-model', [], selected, signal, execute),
        finish,
        new AbortController().signal,
      ),
    );
    const events = await response.text();
    expect(events).toContain('Recorded perspective');
    expect(events).not.toContain('provider secret');
    expect(events).not.toContain('"type":"saved"');
    expect(execute.synthesize).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(
      expect.stringContaining('Recorded perspective'),
      'failed',
      10,
      20,
    );
  });
});
