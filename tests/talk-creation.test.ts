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
  matchesFrozenHandoff,
} from '@/domains/talk-creation/schema';
import { imageIntent } from '@/domains/talk-creation/intent';
import {
  bindTalkSave,
  clearTalkSave,
  matchesTalkSave,
  rememberTalkSave,
  readTalkSave,
} from '@/domains/talk-creation/pending';
import { idleCreationScope, shouldApplyCreation, shouldContinueWatch, shouldRecoverPending } from '@/domains/talk-creation/scope';
import { originProjectIdentity, originSaveIdentity } from '@/domains/talk-creation/persist';
import { projectFromResolvedHandoff } from '@/domains/talk-creation/origin-import';
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
      chatInput.safeParse({
        ...input,
        workTarget: { creationId: input.attachmentId, field: 'purpose' },
      }).success,
    ).toBe(true);
    expect(
      chatInput.safeParse({
        ...input,
        workTarget: { creationId: input.attachmentId, field: 'not a field' },
      }).success,
    ).toBe(false);
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
        true,
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
    const candidate = {
      id: '50000000-0000-4000-8000-000000000013',
      person_id: 'synthetic',
      conversation_id: '30000000-0000-4000-8000-000000000011',
      source_turn_id: '40000000-0000-4000-8000-000000000011',
      lineage_id: '50000000-0000-4000-8000-000000000011',
      version: 3,
      kind: 'brief' as const,
      content: { ...brief, title: 'Generated proposal' },
      predecessor_id: '50000000-0000-4000-8000-000000000011',
      superseded_by: null,
      candidate: true,
      created_at: '2026-10-13T00:00:02.000Z',
    };
    expect(
      selectedCreationContext([
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
        candidate,
      ]),
    ).not.toContain('Generated proposal');
    expect(context).toContain('Untrusted user-reviewed records');
    expect(context).toContain('A premium brand and website.');
    expect(context).toContain('selected brief v2');
    expect(
      selectedCreationContext(
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
        { creationId: '50000000-0000-4000-8000-000000000011', field: 'purpose' },
      ),
    ).toContain('Exact target: purpose on selected brief v2');
    expect(
      selectedCreationContext(
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
        { creationId: '50000000-0000-4000-8000-000000000099', field: 'purpose' },
      ),
    ).not.toContain('Exact target');
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

  it('reuses one handoff identity and preparedAt across retries, then issues a new identity for a changed selection', () => {
    const store = (() => {
      const values = new Map<string, string>();
      return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, next: string) => {
          values.set(key, next);
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
      };
    })();
    const intended = {
      conversationId: '30000000-0000-4000-8000-000000000001',
      discipline: 'business',
      idea: 'A premium brand and website.',
      decisions: '',
      creationIds: ['50000000-0000-4000-8000-000000000011'],
      imageIds: [],
    };
    const first = bindTalkSave('owner', intended.conversationId, 'handoff', intended, store, 1);
    const retry = bindTalkSave('owner', intended.conversationId, 'handoff', intended, store, 2);
    expect(retry.id).toBe(first.id);
    expect(retry.payload.preparedAt).toBe(first.payload.preparedAt);
    expect(matchesTalkSave('owner', intended.conversationId, 'handoff', first.id, store, 2)).toBe(true);
    const changed = bindTalkSave(
      'owner',
      intended.conversationId,
      'handoff',
      { ...intended, creationIds: ['50000000-0000-4000-8000-000000000012'] },
      store,
      3,
    );
    expect(changed.id).not.toBe(first.id);
    expect(changed.payload.preparedAt).not.toBe(first.payload.preparedAt);
    expect(readTalkSave('other', intended.conversationId, 'handoff', store, 3)).toBeNull();
    expect(readTalkSave('owner', intended.conversationId, 'handoff', store, 3)?.id).toBe(changed.id);
  });

  it('keeps one handoff identity when session storage is temporarily unavailable', () => {
    const store = {
      getItem: () => {
        throw new Error('Storage unavailable');
      },
      setItem: () => {
        throw new Error('Storage unavailable');
      },
      removeItem: () => {
        throw new Error('Storage unavailable');
      },
    };
    const intended = {
      conversationId: '30000000-0000-4000-8000-000000000001',
      discipline: 'business',
      idea: 'A premium brand and website.',
      decisions: '',
      creationIds: ['50000000-0000-4000-8000-000000000011'],
      imageIds: [],
    };
    const first = bindTalkSave('owner-unavailable', intended.conversationId, 'handoff', intended, store, 1);
    const retry = bindTalkSave('owner-unavailable', intended.conversationId, 'handoff', intended, store, 2);
    expect(retry.id).toBe(first.id);
    expect(retry.payload.preparedAt).toBe(first.payload.preparedAt);
  });

  it('ignores late creation results after the conversation scope is cleared', () => {
    const idle = idleCreationScope('owner');
    expect(shouldApplyCreation(idle, 'owner', '30000000-0000-4000-8000-000000000001')).toBe(false);
    expect(
      shouldContinueWatch(2, 1, { owner: 'owner', conversation: '30000000-0000-4000-8000-000000000001' }, 'owner', '30000000-0000-4000-8000-000000000001'),
    ).toBe(false);
    expect(
      shouldApplyCreation(
        { owner: 'owner', conversation: '30000000-0000-4000-8000-000000000001' },
        'other',
        '30000000-0000-4000-8000-000000000001',
      ),
    ).toBe(false);
    expect(
      shouldRecoverPending(idle, 'owner', '30000000-0000-4000-8000-000000000001'),
    ).toBe(false);
    expect(
      shouldRecoverPending(
        { owner: 'owner', conversation: '30000000-0000-4000-8000-000000000001' },
        'owner',
        '30000000-0000-4000-8000-000000000001',
      ),
    ).toBe(true);
    expect(
      shouldRecoverPending(
        { owner: 'owner', conversation: '30000000-0000-4000-8000-000000000002' },
        'owner',
        '30000000-0000-4000-8000-000000000001',
      ),
    ).toBe(false);
    expect(
      shouldRecoverPending(
        { owner: 'other', conversation: '30000000-0000-4000-8000-000000000001' },
        'owner',
        '30000000-0000-4000-8000-000000000001',
      ),
    ).toBe(false);
    expect(
      shouldRecoverPending(
        { owner: 'owner', conversation: '30000000-0000-4000-8000-000000000001' },
        'owner',
        '30000000-0000-4000-8000-000000000001',
        3,
        2,
      ),
    ).toBe(false);
  });

  it('matches a frozen Architect request against the stored package, not the current brief', () => {
    const content = {
      schema: 'talk-architect-handoff/v1' as const,
      conversationId: '30000000-0000-4000-8000-000000000001',
      preparedAt: '2026-10-13T00:00:00.000Z',
      discipline: 'business' as const,
      idea: 'A premium brand and website.',
      description: '',
      decisions: '',
      selections: [
        {
          kind: 'brief' as const,
          lineageId: '50000000-0000-4000-8000-000000000011',
          versionId: '50000000-0000-4000-8000-000000000011',
          version: 1,
          title: 'Reserve brand',
        },
      ],
      images: [],
      imported: false as const,
    };
    const request = {
      conversationId: content.conversationId,
      preparedAt: content.preparedAt,
      discipline: content.discipline,
      idea: content.idea,
      decisions: content.decisions,
      creationIds: ['50000000-0000-4000-8000-000000000011'],
      imageIds: [],
    };
    expect(matchesFrozenHandoff(content, request)).toBe(true);
    expect(matchesFrozenHandoff(content, { ...request, idea: 'Changed' })).toBe(false);
    expect(
      matchesFrozenHandoff(content, {
        ...request,
        creationIds: ['50000000-0000-4000-8000-000000000012'],
      }),
    ).toBe(false);
    expect(matchesFrozenHandoff(content, { ...request, preparedAt: undefined })).toBe(false);
    expect(matchesFrozenHandoff({ ...content, imported: true }, request)).toBe(false);
  });
});

describe('Talk Origin import mapping', () => {
  it('derives one owner-scoped project and save identity from the package', () => {
    const person = '00000000-0000-4000-8000-000000000001';
    const handoff = '70000000-0000-4000-8000-000000000011';
    expect(originProjectIdentity(person, handoff)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(originProjectIdentity(person, handoff)).toBe(originProjectIdentity(person, handoff));
    expect(originSaveIdentity(person, handoff)).not.toBe(originProjectIdentity(person, handoff));
    expect(originProjectIdentity(person, handoff)).not.toBe(
      originProjectIdentity('00000000-0000-4000-8000-000000000002', handoff),
    );
  });

  it('maps resolved Talk versions into a private Origin project without conversation history', () => {
    const project = projectFromResolvedHandoff({
      handoff: {
        schema: 'talk-architect-handoff/v1',
        conversationId: '30000000-0000-4000-8000-000000000001',
        preparedAt: '2026-10-14T00:00:00.000Z',
        discipline: 'business',
        idea: 'A premium brand and website.',
        description: '',
        decisions: 'Keep emerald restrained.',
        selections: [
          {
            kind: 'brief',
            lineageId: '50000000-0000-4000-8000-000000000011',
            versionId: '50000000-0000-4000-8000-000000000011',
            version: 1,
            title: 'Reserve site',
          },
        ],
        images: [],
        imported: false,
      },
      sourceTurnId: null,
      brief,
      selections: [
        {
          kind: 'brief',
          lineageId: '50000000-0000-4000-8000-000000000011',
          versionId: '50000000-0000-4000-8000-000000000011',
          version: 1,
          title: 'Reserve site',
          content: brief,
        },
      ],
      images: [],
    });
    expect(project.name).toBe('Reserve site');
    expect(project.discipline).toBe('business');
    expect(project.blueprint.vision).toContain('premium brand');
    expect(project.blueprint.decisions).toBe('Keep emerald restrained.');
    expect(project.blueprint.state).toContain('30000000-0000-4000-8000-000000000001');
    expect(JSON.stringify(project)).not.toContain('assistant_text');
  });
});
