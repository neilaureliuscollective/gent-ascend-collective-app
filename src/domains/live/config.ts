import 'server-only';
import { z } from 'zod';
import { parseEnvironment } from '@/platform/environment';
import { IntelligenceError } from '@/domains/intelligence/service';
import { previewBinding } from './preview-binding';
export function liveConfig() {
  const env = parseEnvironment(process.env);
  if (process.env.AETHELIOS_LIVE_ENABLED !== 'true' || env.mode === 'production')
    throw new IntelligenceError('Aethelios Live is not enabled on this deployment.', 403);
  if (env.mode === 'preview' && process.env.AETHELIOS_LIVE_CONTROL_READY !== 'true')
    throw new IntelligenceError(
      'Voice hosting controls have not been verified for this preview.',
      403,
    );
  if (env.mode === 'preview' && previewBinding(process.env) !== 'configuration-matched')
    throw new IntelligenceError('The voice preview database binding is missing or unsafe.', 403);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new IntelligenceError('The voice connection is not configured.', 503);
  // Explicit pilot model; changes require a separate provider and cost validation.
  const model = z
    .enum(['gpt-realtime', 'gpt-realtime-1.5', 'gpt-realtime-2.1', 'gpt-realtime-mini'])
    .parse(process.env.AETHELIOS_LIVE_MODEL ?? 'gpt-realtime');
  return { key, model };
}
