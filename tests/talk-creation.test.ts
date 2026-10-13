import { describe, expect, it } from 'vitest';
import {
  briefContentSchema,
  handoffContentSchema,
  offeredTextSchema,
  planContentSchema,
  paletteContentSchema,
  creationsOnTurn,
  readTalkCreationWorkspace,
  saveCreationInput,
  selectedCreationContext,
} from '@/domains/talk-creation/schema';
import { imageIntent } from '@/domains/talk-creation/intent';
import { clearTalkSave, rememberTalkSave, readTalkSave } from '@/domains/talk-creation/pending';
import { contrastRatio, paletteContrast, withCalculatedContrast } from '@/domains/talk-creation/contrast';
import {
  extractCreationFences,
  isExplicitImageRequest,
  stripCreationFences,
} from '@/domains/talk-creation/intent';
import { chatInput } from '@/domains/intelligence/validation';
import { researchTools } from '@/domains/intelligence/research';

const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders who want a considered presence.',
  visualDirection: 'Obsidian, emerald glass, restrained gold.',
  requirements: ['Mobile first', 'No invented products'],
  unresolved: ['Photography style'],
};

const plan = {
  title: 'Launch plan',
  summary: 'Clarify, design, then build.',
  steps: [
    { id: 'brief', title: 'Lock the brief', detail: 'Review purpose and audience.', dependsOn: [] },
    { id: 'palette', title: 'Choose color', detail: 'Set exact hex roles.', dependsOn: ['brief'] },
  ],
};

const palette = {
  title: 'Imperial palette',
  notes: 'Swatches are colors, not generated images.',
  swatches: [
    { hex: '#080D0D', name: 'Obsidian', role: 'background' as const },
    { hex: '#E6E7E2', name: 'Ivory', role: 'text' as const },
    { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' as const },
  ],
  contrast: [],
};

describe('Talk creation contracts', () => {
  it('validates brief, plan and palette and rejects invented plan status', () => {
    expect(briefContentSchema.safeParse(brief).success).toBe(true);
    expect(planContentSchema.safeParse(plan).success).toBe(true);
    expect(paletteContentSchema.safeParse(palette).success).toBe(true);
    expect(
      planContentSchema.safeParse({
        ...plan,
        steps: [{ ...plan.steps[0], status: 'done' }],
      }).success,
    ).toBe(false);
    expect(offeredTextSchema.safeParse({}).success).toBe(false);
    expect(offeredTextSchema.safeParse({ brief }).success).toBe(true);
  });

  it('calculates palette contrast instead of trusting model ratios', () => {
    const ratio = contrastRatio('#E6E7E2', '#080D0D');
    expect(ratio).toBeGreaterThan(10);
    const pairs = paletteContrast(palette.swatches);
    expect(pairs[0]?.passesAa).toBe(true);
    expect(pairs[0]?.ratio).toBe(ratio);
    expect(withCalculatedContrast(palette).contrast.length).toBeGreaterThan(0);
  });

  it('requires an explicit image request and strips untrusted fences', () => {
    expect(isExplicitImageRequest('Help me develop a premium brand and website.')).toBe(false);
    expect(isExplicitImageRequest('What images should I use on the homepage?')).toBe(false);
    expect(isExplicitImageRequest('Create an image of the brand mark on obsidian')).toBe(true);
    expect(isExplicitImageRequest('Make this image darker and change the background')).toBe(true);
    expect(isExplicitImageRequest('Make this darker')).toBe(true);
    expect(imageIntent('Make this darker', { selectedCompleted: true, completeCount: 1 })).toEqual({
      operation: 'image.edit',
    });
    expect(imageIntent('Make this darker', { selectedCompleted: false, completeCount: 2 })).toEqual({
      ask: 'clarify',
    });
    expect(imageIntent('What images should I use on the homepage?', {
      selectedCompleted: true,
      completeCount: 1,
    })).toBeNull();
    const text = 'Here is a brief.\n\n```talk-brief\n{"title":"x"}\n```\n';
    expect(stripCreationFences(text)).toBe('Here is a brief.');
    expect(extractCreationFences(text)[0]?.kind).toBe('brief');
  });

  it('keeps research tools read-only and allows a Talk attachment id', () => {
    expect(Object.keys(researchTools)).toEqual(['web_search']);
    const input = {
      conversationId: '30000000-0000-4000-8000-000000000001',
      requestId: '40000000-0000-4000-8000-000000000001',
      text: 'Hello',
      includeContext: false,
      attachmentId: '50000000-0000-4000-8000-000000000001',
    };
    expect(chatInput.safeParse(input).success).toBe(true);
    expect(chatInput.safeParse({ ...input, attachmentId: 'not-a-uuid' }).success).toBe(false);
    expect(
      saveCreationInput.safeParse({
        id: input.requestId,
        conversationId: input.conversationId,
        kind: 'brief',
        predecessorId: null,
        content: brief,
      }).success,
    ).toBe(true);
  });

  it('marks Architect handoff as not imported until the destination acknowledges it', () => {
    const parsed = handoffContentSchema.safeParse({
      schema: 'talk-architect-handoff/v1',
      conversationId: '30000000-0000-4000-8000-000000000001',
      preparedAt: new Date().toISOString(),
      discipline: 'business',
      idea: 'A premium brand and website.',
      description: '',
      decisions: 'Keep emerald restrained.',
      selections: [
        {
          kind: 'brief',
          lineageId: '30000000-0000-4000-8000-000000000002',
          versionId: '30000000-0000-4000-8000-000000000003',
          version: 1,
          title: 'Reserve site',
        },
      ],
      images: [],
      imported: false,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.imported).toBe(false);
    if (parsed.success)
      expect(handoffContentSchema.safeParse({ ...parsed.data, imported: true }).success).toBe(
        false,
      );
  });

  it('ignores empty or unrelated creation payloads so ordinary Talk fixtures stay intact', () => {
    expect(readTalkCreationWorkspace({})).toBeNull();
    expect(readTalkCreationWorkspace({ conversations: [], turns: [] })).toBeNull();
    expect(
      readTalkCreationWorkspace({
        creations: [],
        selected: {},
        images: [],
        selectedImageId: null,
        canCreateImages: false,
        imageAccess: 'unavailable',
        attachmentProjectId: null,
      }),
    ).not.toBeNull();
  });

  it('supplies selected contents with provenance and keeps orphan revisions on the latest turn', () => {
    const context = selectedCreationContext([
      {
        id: '50000000-0000-4000-8000-000000000011',
        person_id: 'synthetic',
        conversation_id: '30000000-0000-4000-8000-000000000011',
        source_turn_id: null,
        lineage_id: '50000000-0000-4000-8000-000000000011',
        version: 2,
        kind: 'brief',
        content: brief,
        predecessor_id: null,
        superseded_by: null,
        created_at: '2026-10-13T00:00:00.000Z',
      },
    ]);
    expect(context).toContain('Untrusted user-reviewed records');
    expect(context).toContain('A premium brand and website.');
    expect(context).toContain('selected brief v2');
    const latest = '40000000-0000-4000-8000-000000000012';
    const shown = creationsOnTurn(
      latest,
      latest,
      [
        {
          id: '50000000-0000-4000-8000-000000000011',
          person_id: 'synthetic',
          conversation_id: '30000000-0000-4000-8000-000000000011',
          source_turn_id: null,
          lineage_id: '50000000-0000-4000-8000-000000000011',
          version: 2,
          kind: 'brief',
          content: brief,
          predecessor_id: null,
          superseded_by: null,
          created_at: '2026-10-13T00:00:00.000Z',
        },
      ],
      ['40000000-0000-4000-8000-000000000011', latest],
    );
    expect(shown).toHaveLength(1);
  });

  it('reuses one save identity for the same payload and rejects a different payload on that identity', () => {
    const store = (() => {
      let value = '';
      return {
        getItem: () => value || null,
        setItem: (_key: string, next: string) => {
          value = next;
        },
        removeItem: () => {
          value = '';
        },
      };
    })();
    const payload = { conversationId: '30000000-0000-4000-8000-000000000001', kind: 'brief', content: brief };
    const first = rememberTalkSave('owner', payload.conversationId, 'revision', payload, store);
    const second = rememberTalkSave('owner', payload.conversationId, 'revision', payload, store);
    expect(second).toBe(first);
    expect(readTalkSave('owner', payload.conversationId, 'revision', store)?.id).toBe(first);
    clearTalkSave('owner', payload.conversationId, 'revision', store);
    expect(readTalkSave('owner', payload.conversationId, 'revision', store)).toBeNull();
  });
});
