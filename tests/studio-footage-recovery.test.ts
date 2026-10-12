import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  job: {} as Record<string, unknown>,
  rpc: vi.fn(),
  submit: vi.fn(),
  inspect: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  providerDownload: vi.fn(),
  eligible: true,
  filters: [] as unknown[][],
}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({ has: () => state.eligible }),
}));
vi.mock('../src/platform/runway/footage', () => ({
  submitFootage: state.submit,
  inspectFootage: state.inspect,
  downloadFootage: state.providerDownload,
}));
vi.mock('../src/domains/studio/service', () => ({
  verifyStudioProject: async () => ({}),
  studioSession: async () => ({
    person: { id: 'owner' },
    client: {
      auth: { getUser: async () => ({ data: { user: { id: 'auth-owner' } } }) },
      rpc: state.rpc,
      from: () => {
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            state.filters.push(args);
            return q;
          },
          maybeSingle: async () => ({ data: state.job, error: null }),
        };
        return q;
      },
      storage: { from: () => ({ download: state.download, upload: state.upload }) },
    },
  }),
}));
import { startFootage, checkFootage } from '../src/domains/studio/footage-service';
import { quoteSignature, taskSignature } from '../src/platform/runway/receipts';
import type { FootageJob } from '../src/domains/studio/footage';
const provider = '10000000-0000-4000-8000-000000000004';
beforeEach(() => {
  vi.clearAllMocks();
  state.filters = [];
  state.eligible = true;
  vi.stubEnv('STUDIO_FOOTAGE_ENABLED', 'true');
  vi.stubEnv('RUNWAYML_API_SECRET', 'fixture-key');
  vi.stubEnv('STUDIO_FOOTAGE_SIGNING_KEY', 'fixture-signing-key-at-least-32-characters');
  state.job = {
    id: 'request',
    person_id: 'owner',
    project_id: 'project',
    title: 'Clip',
    prompt: 'Quiet light',
    duration: 5,
    ratio: '1280:720',
    estimate: 60,
    policy: 'runway-gen45-2026-10-12',
    expires_at: new Date(Date.now() + 600000).toISOString(),
    status: 'quoted',
    provider_id: null,
    provider_signature: null,
  };
  state.job.quote_signature = quoteSignature(state.job as FootageJob);
  state.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'ai_studio_footage_begin') {
      if (state.job.status !== 'quoted') return { data: false };
      state.job.status = 'submitting';
    }
    if (name === 'ai_studio_footage_receipt') {
      state.job.provider_id = args.p_provider ?? null;
      state.job.provider_signature = args.p_signature ?? null;
      state.job.status = args.p_provider ? 'queued' : 'uncertain';
    }
    if (name === 'ai_studio_footage_finish') {
      state.job.status = args.p_status;
      state.job.storage_key = args.p_key ?? null;
    }
    return { data: true, error: null };
  });
  state.submit.mockResolvedValue({ id: provider });
  state.inspect.mockResolvedValue({
    id: provider,
    status: 'SUCCEEDED',
    output: ['https://approved/output.mp4'],
    cost: { credits: 60 },
  });
  state.download.mockResolvedValue({ data: null, error: { statusCode: '404' } });
  state.upload.mockResolvedValue({ error: null });
  state.providerDownload.mockResolvedValue(
    Buffer.from(readFileSync('tests/fixtures/studio-footage.mp4.base64', 'utf8'), 'base64'),
  );
});
afterEach(() => vi.unstubAllEnvs());
it('retains uncertain paid submission and never repeats it on replay', async () => {
  state.submit.mockRejectedValue(new Error('unknown acceptance'));
  await expect(startFootage('request', 'project', 60)).rejects.toThrow('reconciliation');
  expect(state.job.status).toBe('uncertain');
  await startFootage('request', 'project', 60);
  expect(state.submit).toHaveBeenCalledOnce();
});
it('rejects changed quotes, unapproved estimates and unavailable creation before provider calls', async () => {
  await expect(startFootage('request', 'project', 120)).rejects.toThrow('estimate');
  state.job.prompt = 'tampered';
  await expect(startFootage('request', 'project', 60)).rejects.toThrow('receipt');
  state.eligible = false;
  await expect(startFootage('request', 'project', 60)).rejects.toThrow('eligible');
  state.eligible = true;
  vi.stubEnv('STUDIO_FOOTAGE_ENABLED', 'false');
  await expect(startFootage('request', 'project', 60)).rejects.toThrow('activation');
  expect(state.submit).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
it('rejects a forged foreign provider ID before any provider lookup or output copy', async () => {
  await startFootage('request', 'project', 60);
  state.job.provider_id = 'foreign';
  await expect(checkFootage('request', 'project')).rejects.toThrow('receipt');
  expect(state.inspect).not.toHaveBeenCalled();
  expect(state.providerDownload).not.toHaveBeenCalled();
});
it('recovers an uncertain storage upload through the original task and saved bytes without a new render', async () => {
  await startFootage('request', 'project', 60);
  state.upload.mockResolvedValueOnce({ error: { message: 'lost acknowledgement' } });
  await expect(checkFootage('request', 'project')).rejects.toThrow('recover');
  const bytes = Buffer.from(
    readFileSync('tests/fixtures/studio-footage.mp4.base64', 'utf8'),
    'base64',
  );
  state.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  expect((await checkFootage('request', 'project')).status).toBe('complete');
  expect(state.upload).toHaveBeenCalledOnce();
  expect(state.providerDownload).toHaveBeenCalledOnce();
  expect(state.submit).toHaveBeenCalledOnce();
  expect(state.filters).toContainEqual(['person_id', 'owner']);
});
it('does not replace an ambiguous private read or invent success from a running task', async () => {
  await startFootage('request', 'project', 60);
  state.inspect.mockResolvedValueOnce({
    id: provider,
    status: 'RUNNING',
    estimatedCost: { credits: 60 },
  });
  expect((await checkFootage('request', 'project')).status).toBe('queued');
  state.download.mockResolvedValue({ data: null, error: { statusCode: '503' } });
  await expect(checkFootage('request', 'project')).rejects.toThrow('Nothing was replaced');
  expect(state.providerDownload).not.toHaveBeenCalled();
  expect(state.upload).not.toHaveBeenCalled();
});
it('binds stored task receipts to request and owner even for valid UUIDs', () => {
  const signature = taskSignature(state.job as FootageJob, provider);
  expect(signature).not.toBe(
    taskSignature({ ...state.job, person_id: 'another' } as FootageJob, provider),
  );
});
