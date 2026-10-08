import { afterEach, describe, expect, it, vi } from 'vitest';
import { savedWorkRelations, savedWorkStatus } from '../src/domains/release/saved-work';
const mocks = vi.hoisted(() => ({ founder: vi.fn(), identity: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/domains/access/founder', () => ({ currentFounderAccess: mocks.founder }));
vi.mock('@/domains/identity/current', () => ({ currentIdentity: mocks.identity }));
import { probeSavedWork } from '../src/domains/release/saved-work-service';
afterEach(() => vi.resetAllMocks());

describe('founder saved-work probes', () => {
  it('does not inspect the database for non-founders', async () => {
    mocks.founder.mockResolvedValue(false);
    expect(await probeSavedWork()).toBeNull();
    expect(mocks.identity).not.toHaveBeenCalled();
  });
  it('keeps missing schema, access denial and transient failures distinct', () => {
    expect(savedWorkStatus({ status: 200, error: null })).toBe('accessible');
    expect(savedWorkStatus({ status: 404, error: { code: 'PGRST205' } })).toBe('unavailable');
    expect(savedWorkStatus({ status: 400, error: { code: '42703' } })).toBe('unavailable');
    expect(savedWorkStatus({ status: 403, error: { code: '42501' } })).toBe('denied');
    expect(savedWorkStatus({ status: 503, error: { code: 'PGRST002' } })).toBe('unknown');
    expect(savedWorkStatus({ status: 0, error: null })).toBe('unknown');
  });
  it('uses bounded zero-row session reads and redacts errors from its report', async () => {
    mocks.founder.mockResolvedValue(true);
    const from = vi.fn((relation: string) => {
      const query = {
        select: vi.fn(() => query),
        limit: vi.fn(() => query),
        abortSignal: vi.fn(async (signal: AbortSignal) => {
          expect(signal).toBeInstanceOf(AbortSignal);
          if (relation === 'mission_outputs') throw new Error('private backend URL');
          return relation === 'mission_deliverables'
            ? { status: 403, error: { code: '42501', message: 'private backend URL' } }
            : { status: 200, error: null };
        }),
      };
      return query;
    });
    mocks.identity.mockResolvedValue({ client: { from } });
    const report = await probeSavedWork();
    expect(from).toHaveBeenCalledTimes(savedWorkRelations.length);
    for (const result of from.mock.results) {
      expect(result.value.select).toHaveBeenCalledWith('person_id', { head: true });
      expect(result.value.limit).toHaveBeenCalledWith(0);
    }
    expect(report?.checks.find((c) => c.relation === 'mission_outputs')?.status).toBe('unknown');
    expect(report?.checks.find((c) => c.relation === 'mission_deliverables')?.status).toBe(
      'denied',
    );
    expect(JSON.stringify(report)).not.toContain('private backend');
  });
  it('does not claim accessibility after identity loss', async () => {
    mocks.founder.mockResolvedValue(true);
    mocks.identity.mockResolvedValue(null);
    const report = await probeSavedWork();
    expect(report?.checks.every((c) => c.status === 'unknown')).toBe(true);
  });
});
