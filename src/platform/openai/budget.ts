import 'server-only';
import { z } from 'zod';
import { serverClient } from '@/platform/supabase/server';

const limits = z.object({
  maxOutputTokens: z.number().int().min(1).max(16384),
  maxToolCalls: z.number().int().min(0).max(8),
});
export function requestFamily(body: Record<string, unknown>) {
  const tools = Array.isArray(body.tools) ? body.tools : [];
  if (tools.some((tool) => tool?.type === 'image_generation')) return 'image';
  if (JSON.stringify(body.input ?? []).includes('"type":"input_image"')) return 'vision';
  if (tools.some((tool) => ['web_search', 'web_search_preview'].includes(tool?.type)))
    return 'research';
  return 'text';
}

// Every SDK step, HTTP retry and raw image/vision request uses this boundary.
// Ceilings are reviewed provider estimates, not claims about actual billed cost.
export async function budgetedFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  if (process.env.GENT_AI_BUDGET_ENABLED !== 'true') return fetch(input, init);
  const url = new URL(
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
  );
  if (
    url.origin !== 'https://api.openai.com' ||
    url.pathname !== '/v1/responses' ||
    init?.method?.toUpperCase() !== 'POST' ||
    typeof init.body !== 'string'
  )
    throw new Error('Unsupported intelligence request. No provider call was made.');
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(init.body);
  } catch {
    throw new Error('Invalid intelligence request.');
  }
  if (!body || typeof body.model !== 'string') throw new Error('Invalid intelligence model.');
  const client = await serverClient();
  if (!client) throw new Error('Account access is required for intelligence.');
  const id = crypto.randomUUID();
  const reservation = await client.rpc('ai_budget_reserve', {
    p_id: id,
    p_model: body.model,
    p_family: requestFamily(body),
    p_input_bytes: Buffer.byteLength(init.body),
  });
  const policy = limits.safeParse(reservation.data);
  if (reservation.error || !policy.success)
    throw new Error('Intelligence allowance is unavailable or reached. Your saved work is intact.');
  const requested =
    typeof body.max_output_tokens === 'number'
      ? body.max_output_tokens
      : policy.data.maxOutputTokens;
  body.max_output_tokens = Math.min(requested, policy.data.maxOutputTokens);
  if (Array.isArray(body.tools) && body.tools.length) {
    if (policy.data.maxToolCalls === 0)
      throw new Error('Tools are not enabled for this allowance.');
    const requestedTools =
      typeof body.max_tool_calls === 'number' ? body.max_tool_calls : policy.data.maxToolCalls;
    body.max_tool_calls = Math.min(requestedTools, policy.data.maxToolCalls);
  }
  const response = await fetch(input, { ...init, body: JSON.stringify(body) });
  // Do not consume/clone streaming replies or log provider content. A failed
  // receipt never releases spend or replays an uncertain provider request.
  try {
    await client.rpc('ai_budget_receipt', { p_id: id, p_status: response.status });
  } catch {}
  return response;
}
