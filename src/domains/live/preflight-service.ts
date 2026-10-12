import 'server-only';
import { currentFounderAccess } from '@/domains/access/founder';
import { intelligenceSession, IntelligenceError } from '@/domains/intelligence/service';
import { preflightConfiguration, type PreflightReport, type ProviderPreflight } from './preflight';
export async function inspectProviderMetadata(
  env: Record<string, string | undefined>,
  request: typeof fetch = fetch,
): Promise<ProviderPreflight> {
  const config = preflightConfiguration(env);
  if (!config.keyConfigured) return { status: 'missing-key', durationMs: null };
  if (!config.model) return { status: 'unsupported-model', durationMs: null };
  const started = performance.now();
  const result = (status: ProviderPreflight['status']) => ({
    status,
    durationMs: Math.round(performance.now() - started),
  });
  try {
    // A fixed read-only metadata request; never creates a voice call, token, response or image.
    const response = await request(
      'https://api.openai.com/v1/models/' + encodeURIComponent(config.model),
      {
        headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY!.trim() },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      await response.body?.cancel();
      return result(
        response.status === 401
          ? 'credential-rejected'
          : response.status === 403
            ? 'metadata-forbidden'
            : response.status === 404
              ? 'model-not-found'
              : response.status === 429
                ? 'rate-limited'
                : 'provider-error',
      );
    }
    const reader = response.body?.getReader();
    if (!reader) return result('invalid-response');
    let size = 0,
      text = '';
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) {
        await reader.cancel();
        return result('invalid-response');
      }
      text += decoder.decode(value, { stream: true });
    }
    try {
      const model: unknown = JSON.parse(text + decoder.decode());
      return result(
        model &&
          typeof model === 'object' &&
          'id' in model &&
          model.id === config.model &&
          'object' in model &&
          model.object === 'model'
          ? 'metadata-accessible'
          : 'invalid-response',
      );
    } catch {
      return result('invalid-response');
    }
  } catch {
    return result('network-error');
  }
}
export async function readLivePreflight(checkProvider = false): Promise<PreflightReport> {
  // Founder authority is the existing RLS-visible person grant, never a Vercel token, email or tier.
  if (!(await currentFounderAccess())) throw new IntelligenceError('Founder access required.', 403);
  const { client, person } = await intelligenceSession();
  const configuration = preflightConfiguration(process.env);
  const schema = await Promise.all(
    [
      {
        name: 'Voice sessions',
        query: client
          .from('ai_live_sessions')
          .select('id,expires_at,call_tag')
          .eq('person_id', person.id)
          .limit(0),
      },
      {
        name: 'Conversation creations and reviews',
        query: client
          .from('ai_conversation_artifacts')
          .select('id,visual,review_coworker,review_context')
          .eq('person_id', person.id)
          .limit(0),
      },
      {
        name: 'Reviewed daily action provenance',
        query: client
          .from('ai_action_proposals')
          .select('id,source_review_id,review_day,review_version')
          .eq('person_id', person.id)
          .limit(0),
      },
    ].map(async ({ name, query }) => {
      // Queries only inspect the owned read contract. No rows, RPC execution or schema writes.
      try {
        const response = await query.abortSignal(AbortSignal.timeout(4000));
        return { name, status: response.error ? ('unavailable' as const) : ('readable' as const) };
      } catch {
        return { name, status: 'unavailable' as const };
      }
    }),
  );
  return {
    ...configuration,
    checkedAt: new Date().toISOString(),
    schema,
    provider: checkProvider
      ? await inspectProviderMetadata(process.env)
      : { status: 'not-checked', durationMs: null },
  };
}
