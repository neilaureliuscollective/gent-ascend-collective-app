import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/platform/supabase/database';
import { contentForKind, type CreationKind, type OfferedText, type TalkCreation } from './schema';
import { withCalculatedContrast } from './contrast';

type Client = SupabaseClient<Database>;

export function scopedTalkIdentity(seed: string) {
  const bytes = Uint8Array.from(createHash('sha1').update(seed).digest().subarray(0, 16));
  const version = bytes[6];
  const variant = bytes[8];
  if (version === undefined || variant === undefined) throw new Error('Talk identity failed.');
  bytes[6] = (version & 0x0f) | 0x50;
  bytes[8] = (variant & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function candidateIdentity(requestId: string, kind: 'brief' | 'plan' | 'palette') {
  return scopedTalkIdentity(`talk-candidate:${requestId}:${kind}`);
}

export function originProjectIdentity(personId: string, handoffId: string) {
  return scopedTalkIdentity(`talk-origin-project:${personId}:${handoffId}`);
}

export function originSaveIdentity(personId: string, handoffId: string) {
  return scopedTalkIdentity(`talk-origin-save:${personId}:${handoffId}`);
}

export function matchesHandoffDestination(
  personId: string,
  handoffId: string,
  receipt: { project_id: string; save_id?: string | null } | null | undefined,
) {
  return Boolean(
    receipt &&
      receipt.project_id === originProjectIdentity(personId, handoffId) &&
      receipt.save_id === originSaveIdentity(personId, handoffId),
  );
}

export async function persistKind(
  client: Client,
  input: {
    id?: string;
    conversationId: string;
    sourceTurnId?: string | null;
    kind: CreationKind;
    predecessorId?: string | null;
    content: unknown;
  },
) {
  const content =
    input.kind === 'brief'
      ? contentForKind('brief', input.content)
      : input.kind === 'plan'
        ? contentForKind('plan', input.content)
        : input.kind === 'palette'
          ? withCalculatedContrast(contentForKind('palette', input.content))
          : contentForKind('handoff', input.content);
  const id = input.id ?? crypto.randomUUID();
  const result = await client.rpc('ai_talk_save_creation', {
    p_id: id,
    p_conversation: input.conversationId,
    p_turn: input.sourceTurnId ?? null,
    p_kind: input.kind,
    p_predecessor: input.predecessorId ?? null,
    p_content: content,
  });
  if (result.error || !result.data) {
    const message = result.error?.message ?? '';
    if (result.error?.code === 'P0001' && /stale/i.test(message))
      throw new Error('Stale creation version');
    if (/reused with different inputs/i.test(message))
      throw new Error('Creation request reused with different inputs');
    throw new Error('Creation could not be saved.');
  }
  const receipt = result.data as { lineageId?: string; version?: number; recovered?: boolean };
  if (!receipt.lineageId || !receipt.version)
    throw new Error('Creation could not be saved.');
  return {
    id,
    lineageId: receipt.lineageId,
    version: receipt.version,
    content,
    recovered: Boolean(receipt.recovered),
  };
}

export async function persistCandidate(
  client: Client,
  input: {
    id: string;
    conversationId: string;
    sourceTurnId: string;
    kind: 'brief' | 'plan' | 'palette';
    baseId: string;
    content: unknown;
  },
) {
  const content =
    input.kind === 'palette'
      ? withCalculatedContrast(contentForKind('palette', input.content))
      : contentForKind(input.kind, input.content);
  const result = await client.rpc('ai_talk_save_candidate', {
    p_id: input.id,
    p_conversation: input.conversationId,
    p_turn: input.sourceTurnId,
    p_kind: input.kind,
    p_base: input.baseId,
    p_content: content,
  });
  if (result.error || !result.data) {
    const message = result.error?.message ?? '';
    if (/unavailable/i.test(message)) throw new Error('Base version unavailable');
    if (/reused with different inputs/i.test(message))
      throw new Error('Creation request reused with different inputs');
    throw new Error('Stale proposal could not be saved.');
  }
  const receipt = result.data as { lineageId?: string; version?: number; recovered?: boolean };
  if (!receipt.lineageId || !receipt.version)
    throw new Error('Stale proposal could not be saved.');
  return {
    id: input.id,
    lineageId: receipt.lineageId,
    version: receipt.version,
    content,
    recovered: Boolean(receipt.recovered),
    candidate: true as const,
  };
}

export async function persistOfferedCreations(
  client: Client,
  conversationId: string,
  sourceTurnId: string,
  offered: OfferedText[],
  selected: Partial<Record<'brief' | 'plan' | 'palette', string>>,
) {
  const saved: TalkCreation[] = [];
  const stale: Array<{
    id: string;
    kind: 'brief' | 'plan' | 'palette';
    title: string;
    status: 'stale';
    preserved: boolean;
  }> = [];
  const current = { ...selected };
  for (const offer of offered) {
    for (const kind of ['brief', 'plan', 'palette'] as const) {
      const content = offer[kind];
      if (!content) continue;
      try {
        const result = await persistKind(client, {
          conversationId,
          sourceTurnId,
          kind,
          predecessorId: current[kind] ?? null,
          content,
        });
        current[kind] = result.id;
        saved.push({
          id: result.id,
          person_id: '',
          conversation_id: conversationId,
          source_turn_id: sourceTurnId,
          lineage_id: result.lineageId,
          version: result.version,
          kind,
          content: result.content,
          predecessor_id: selected[kind] ?? null,
          superseded_by: null,
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        if (!(error instanceof Error && error.message === 'Stale creation version')) continue;
        const baseId = selected[kind];
        const title = content.title ?? kind;
        if (!baseId) {
          stale.push({ id: sourceTurnId, kind, title, status: 'stale', preserved: false });
          continue;
        }
        try {
          const candidate = await persistCandidate(client, {
            id: candidateIdentity(sourceTurnId, kind),
            conversationId,
            sourceTurnId,
            kind,
            baseId,
            content,
          });
          stale.push({ id: candidate.id, kind, title, status: 'stale', preserved: true });
        } catch {
          stale.push({ id: baseId, kind, title, status: 'stale', preserved: false });
        }
      }
    }
  }
  return { saved, stale };
}
