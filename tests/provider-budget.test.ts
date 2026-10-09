import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn(), fetch: vi.fn() }));
vi.mock('@/platform/supabase/server', () => ({ serverClient: mock.client }));
import { budgetedFetch, requestFamily } from '@/platform/openai/budget';
beforeEach(() => {
  vi.stubEnv('GENT_AI_BUDGET_ENABLED', 'true');
  vi.stubGlobal('fetch', mock.fetch);
  mock.client.mockResolvedValue({ rpc: mock.rpc });
  mock.rpc.mockImplementation(async (name: string) =>
    name === 'ai_budget_reserve'
      ? { data: { maxOutputTokens: 1200, maxToolCalls: 2 }, error: null }
      : { data: true, error: null },
  );
  mock.fetch.mockResolvedValue(new Response('synthetic', { status: 200 }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const send = (body: unknown = { model: 'synthetic-model' }) =>
  budgetedFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    body: JSON.stringify(body),
  });
describe('durable provider allowance boundary', () => {
  it('covers tool research, image and vision requests without trusting client-selected costs', () => {
    expect(requestFamily({ tools: [{ type: 'image_generation' }] })).toBe('image');
    expect(requestFamily({ input: [{ content: [{ type: 'input_image' }] }] })).toBe('vision');
    expect(requestFamily({ tools: [{ type: 'web_search' }] })).toBe('research');
    expect(requestFamily({})).toBe('text');
  });
  it('reserves before calling the provider and clamps output/tool work to the reviewed policy', async () => {
    await send({
      model: 'synthetic-model',
      max_output_tokens: 4096,
      max_tool_calls: 5,
      tools: [{ type: 'web_search' }],
    });
    expect(mock.rpc.mock.calls[0]![0]).toBe('ai_budget_reserve');
    expect(mock.rpc.mock.calls[0]![1]).toMatchObject({
      p_model: 'synthetic-model',
      p_family: 'research',
    });
    expect(mock.rpc.mock.calls[0]![1]).not.toHaveProperty('p_cost');
    const body = JSON.parse(mock.fetch.mock.calls[0]![1].body);
    expect(body).toMatchObject({ max_output_tokens: 1200, max_tool_calls: 2 });
    expect(mock.rpc.mock.calls[1]![0]).toBe('ai_budget_receipt');
  });
  it('fails closed without a session, reservation or valid policy and never invokes the provider', async () => {
    mock.client.mockResolvedValueOnce(null);
    await expect(send()).rejects.toThrow('Account access');
    for (const result of [
      { data: null, error: { code: 'P0001' } },
      { data: { maxOutputTokens: Infinity, maxToolCalls: 2 }, error: null },
    ]) {
      mock.rpc.mockResolvedValueOnce(result);
      await expect(send()).rejects.toThrow('allowance');
    }
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('counts retries separately, retains unknown spend and never replays after a receipt failure', async () => {
    mock.fetch.mockRejectedValueOnce(new Error('network interruption'));
    await expect(send()).rejects.toThrow('network interruption');
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    const first = mock.rpc.mock.calls[0]![1].p_id;
    mock.rpc.mockImplementation(async (name: string) => {
      if (name === 'ai_budget_receipt') throw new Error('receipt unavailable');
      return { data: { maxOutputTokens: 1200, maxToolCalls: 2 }, error: null };
    });
    const response = await send();
    expect(response.status).toBe(200);
    expect(mock.rpc.mock.calls[1]![1].p_id).not.toBe(first);
    expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects alternate hosts/endpoints and keeps legacy calls unchanged until explicitly enabled', async () => {
    await expect(
      budgetedFetch('https://attacker.test/v1/responses', { method: 'POST', body: '{}' }),
    ).rejects.toThrow('Unsupported');
    expect(mock.fetch).not.toHaveBeenCalled();
    vi.stubEnv('GENT_AI_BUDGET_ENABLED', 'false');
    await send();
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
});
