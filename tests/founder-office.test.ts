import { beforeEach, describe, expect, it, vi } from 'vitest';
import { founderRequest, founderScope } from '../src/domains/founder-office/schema';
import {
  coworkers,
  council,
  requiresFounder,
  councilFromVersion,
  councilPromptVersion,
} from '../src/domains/intelligence/council';
const state = vi.hoisted(() => ({
  founder: false,
  signedIn: true,
  error: false,
  queries: [] as Array<[string, string, unknown]>,
  records: {} as Record<string, unknown[]>,
}));
const errors = vi.hoisted(() => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
const create = vi.hoisted(() => vi.fn());
const read = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/access/founder', () => ({
  currentFounderAccess: async () => state.founder,
}));
vi.mock('../src/domains/company-work/service', () => ({ createWork: create, readWork: read }));
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: errors.IntelligenceError,
  intelligenceSession: async () => {
    if (!state.signedIn) {
      throw new errors.IntelligenceError('Sign in', 401);
    }
    return {
      person: {
        id: 'owner-a',
        display_name: 'Synthetic founder',
        timezone: 'UTC',
        priority: 'Build useful work',
      },
      client: {
        from(table: string) {
          const builder = {
            select: () => builder,
            eq: (key: string, value: unknown) => {
              state.queries.push([table, key, value]);
              return builder;
            },
            gte: () => builder,
            order: () => builder,
            or: (filter: string) => {
              state.queries.push([table, 'or', filter]);
              return builder;
            },
            limit: (limit: number) => {
              state.queries.push([table, 'limit', limit]);
              return builder;
            },
            then(resolve: (r: { data: unknown[]; error: unknown }) => unknown) {
              return Promise.resolve(
                resolve({
                  data: state.records[table] ?? [],
                  error: state.error ? { message: 'SECRET_DATABASE_MESSAGE' } : null,
                }),
              );
            },
          };
          return builder;
        },
      },
    };
  },
}));
import { prepareFounderWork, readFounderOffice } from '../src/domains/founder-office/service';
import { GET, POST } from '../src/app/api/founder-office/route';
import { IntelligenceError } from '../src/domains/intelligence/service';
import { syntheticWork } from './component-fixture/company-work-data';
import {
  routeFounderCoworker,
  explicitlyRequestedCoworkers,
} from '../src/domains/founder-office/routing';
const input = {
  companyId: 'c8000000-0000-4000-8000-000000000001',
  jobId: 'c8000000-0000-4000-8000-000000000002',
  conversationId: 'c8000000-0000-4000-8000-000000000003',
  objective: 'Review supplied financial evidence',
  specialistId: 'mara' as const,
};
const request = (body: unknown, origin = 'https://app.test') =>
  new Request('https://app.test/api/founder-office', {
    method: 'POST',
    headers: { origin, host: 'app.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  state.founder = false;
  state.signedIn = true;
  state.error = false;
  state.queries = [];
  state.records = {};
  create.mockReset();
  read.mockReset();
  read.mockRejectedValue(new IntelligenceError('Job not found', 404));
  create.mockResolvedValue({ job: { id: input.jobId }, versions: [] });
});
describe('Founder Office authority and saved work', () => {
  it('requires authentication even if a caller claims founder authority', async () => {
    state.signedIn = false;
    state.founder = true;
    expect((await GET()).status).toBe(401);
    expect((await POST(request(input))).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
    expect(state.queries).toEqual([]);
  });
  it('reads exact latest mission versions in bounded owner-scoped batches', async () => {
    state.founder = true;
    const jobs = Array.from({ length: 25 }, (_, i) => ({
      ...syntheticWork.job,
      id: `c8000000-0000-4000-8000-${String(i + 500).padStart(12, '0')}`,
      person_id: 'owner-a',
    }));
    state.records.company_jobs = jobs;
    state.records.company_work_versions = jobs.map((job) => ({
      ...syntheticWork.versions[0]!,
      job_id: job.id,
      person_id: 'owner-a',
    }));
    const data = await readFounderOffice();
    expect(data.missions).toHaveLength(25);
    const filters = state.queries.filter(
      ([table, key]) => table === 'company_work_versions' && key === 'or',
    );
    expect(filters).toHaveLength(2);
    expect(filters[0]![2]).toContain(`company_id.eq.${syntheticWork.job.company_id}`);
    expect(filters[0]![2]).toContain('revision.eq.1');
    expect(
      state.queries
        .filter(([table, key]) => table === 'company_work_versions' && key === 'limit')
        .map(([, , value]) => value),
    ).toEqual([20, 5]);
    expect(
      state.queries.filter(
        ([table, key, value]) =>
          table === 'company_work_versions' && key === 'person_id' && value === 'owner-a',
      ),
    ).toHaveLength(2);
  });
  it('keeps approved external proposals in attention and exposes saved task readiness', async () => {
    state.founder = true;
    state.records.company_jobs = [syntheticWork.job];
    const version = {
      ...structuredClone(syntheticWork.versions[0]!),
      reviewed_at: '2026-10-12T00:00:00Z',
    };
    version.content.approvalRequests = [
      {
        id: input.jobId,
        kind: 'deployment',
        title: 'Synthetic release',
        proposal: 'Deploy after acceptance',
        figureIds: [],
        status: 'approved',
      },
    ];
    version.content.taskPlan = [
      {
        id: input.conversationId,
        title: 'Check release',
        objective: 'Review the saved release',
        assignee: 'cassius',
        status: 'planned',
        dependsOn: [],
      },
    ];
    state.records.company_work_versions = [version];
    const data = await readFounderOffice();
    expect(data.missions[0]?.status).toBe('approved_awaiting_executor');
    expect(data.missions[0]?.readiness[0]).toMatchObject({
      state: 'ready',
      assignee: 'cassius',
      blockers: [],
    });
  });
  it('routes natural founder requests to the approved roles without creating authority', () => {
    expect(routeFounderCoworker('Have MARA review the financial picture')).toBe('mara');
    expect(routeFounderCoworker('Compare our credit and capital options')).toBe('cassian');
    expect(routeFounderCoworker('Inspect Aethelios and tell me what is broken')).toBe('cassius');
    expect(explicitlyRequestedCoworkers('Assemble MARA and CASSIUS around this launch')).toEqual({
      kind: 'table',
      specialists: ['mara', 'cassius'],
    });
    expect(explicitlyRequestedCoworkers('What is an API?')).toBeUndefined();
  });
  it('retains confirmed source notes and figures and rejects changed-input recovery', async () => {
    state.founder = true;
    const figures = [
      {
        id: input.jobId,
        label: 'Confirmed operating budget',
        value: 'USD 100',
        source: 'Synthetic approved budget, 2026-10-11',
      },
    ];
    const evidence = [{ label: 'Synthetic statement', detail: 'Synthetic statement source only.' }];
    await prepareFounderWork({ ...input, figures, evidence });
    const scope = create.mock.calls[0]![0].scope;
    expect(scope.figures).toEqual(figures);
    expect(scope.evidence).toEqual(evidence);
    expect(scope.constraints).toContain('Confirmed input fingerprint');
    read.mockResolvedValue({ job: { conversation_id: input.conversationId, scope } });
    await prepareFounderWork({ ...input, figures, evidence });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(
      prepareFounderWork({ ...input, figures: [{ ...figures[0]!, value: 'USD 200' }], evidence }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('does not expose founder reads or writes to ordinary members', async () => {
    await expect(readFounderOffice()).rejects.toMatchObject({ status: 403 });
    expect(state.queries).toEqual([]);
    expect((await GET()).status).toBe(403);
    expect((await POST(request(input))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects client privilege claims, injected ownership, unknown roles and hostile origins', async () => {
    state.founder = true;
    for (const body of [
      { ...input, personId: 'other-owner' },
      { ...input, founder: true },
      { ...input, specialistId: 'root' },
      { ...input, objective: 'x' },
    ])
      expect((await POST(request(body))).status).toBe(400);
    expect((await POST(request(input, 'https://hostile.test'))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });
  it('uses the existing company job transaction with stable identity and bounded assignment', async () => {
    state.founder = true;
    await prepareFounderWork(input);
    await prepareFounderWork(input);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenNthCalledWith(1, {
      companyId: input.companyId,
      jobId: input.jobId,
      conversationId: input.conversationId,
      scope: founderScope(input.objective, 'mara'),
    });
    expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
    expect(JSON.stringify(create.mock.calls)).not.toContain('personId');
  });
  it('binds every portfolio, memory, approval and usage read to the authenticated owner', async () => {
    state.founder = true;
    const data = await readFounderOffice();
    expect(
      state.queries.filter(([, key, value]) => key === 'person_id' && value === 'owner-a'),
    ).toHaveLength(7);
    expect(data.missions).toEqual([]);
    expect(data.operations.inputTokens).toBe(0);
    expect((await GET()).headers.get('cache-control')).toBe('private, no-store');
  });
  it('fails closed on record errors without exposing database details or fabricating health', async () => {
    state.founder = true;
    state.error = true;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('SECRET_DATABASE_MESSAGE');
  });
  it('shares the specialist ledger while keeping public Entities separate from founder Coworkers', () => {
    expect(coworkers.map((c) => c.id)).toEqual(['mara', 'cassian', 'cassius']);
    expect(council.some((c) => (c.id as string) === 'mara')).toBe(false);
    const cast = { kind: 'specialist' as const, specialists: ['mara' as const] };
    expect(councilFromVersion(councilPromptVersion(cast))).toEqual(cast);
    expect(requiresFounder(cast)).toBe(true);
    expect(requiresFounder({ kind: 'specialist', specialists: ['athena'] })).toBe(false);
    expect(founderRequest.safeParse({ ...input, objective: ' '.repeat(10) }).success).toBe(false);
  });
});
