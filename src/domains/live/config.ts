import 'server-only';
import { z } from 'zod';
import { IntelligenceError } from '@/domains/intelligence/service';
import { liveAdmissionPolicy } from './admission-policy';
export function liveConfig() {
  const policy = liveAdmissionPolicy(process.env);
  if (policy.error) throw new IntelligenceError(policy.error, 403);
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) throw new IntelligenceError('The voice connection is not configured.', 503);
  // Explicit pilot model; changes require a separate provider and cost validation.
  const model = z
    .enum(['gpt-realtime', 'gpt-realtime-1.5', 'gpt-realtime-2.1', 'gpt-realtime-mini'])
    .parse(process.env.AETHELIOS_LIVE_MODEL ?? 'gpt-realtime');
  return {
    key,
    model,
    canonicalPilot: policy.founderOnly,
  };
}
