import { describe, expect, it } from 'vitest';
import { buildMessages, promptVersion } from '../src/domains/intelligence/prompt';
import { intelligenceEdition } from '../src/domains/intelligence/edition';
import { selectPlaybooks } from '../src/domains/intelligence/playbooks';
import { chooseVariant, loadProductKnowledge } from '../src/domains/intelligence/product-knowledge';
import { budgetLiveSeed } from '../src/domains/live/context-budget';
import { publishedKnowledgeContext } from '../src/domains/intelligence/published-knowledge';
import {
  behaviorScenarios,
  optionalModelEvalFlag,
  scenarioUserTexts,
} from '../src/domains/intelligence/behavior-eval';
import { composeScenarioRequest } from '../src/domains/intelligence/behavior-eval-run';
import { workingStateFromTurns } from '../src/domains/intelligence/working-state';
import { createProductLookupRuntime } from '../src/domains/live/product-lookup';

const oil = {
  id: 'gid://shopify/Product/1',
  handle: 'beard-oil',
  title: 'Beard Oil',
  availableForSale: true,
  collections: { nodes: [] },
};
const serum = {
  id: 'gid://shopify/Product/2',
  handle: 'serum',
  title: 'Serum',
  availableForSale: true,
  collections: { nodes: [] },
};

const scentVariants = {
  nodes: [
    {
      id: 'gid://shopify/ProductVariant/30',
      title: '30ml Unscented',
      availableForSale: false,
      currentlyNotInStock: true,
      price: { amount: '32.00', currencyCode: 'USD' },
    },
    {
      id: 'gid://shopify/ProductVariant/50',
      title: '50ml Unscented',
      availableForSale: true,
      currentlyNotInStock: false,
      price: { amount: '48.00', currencyCode: 'USD' },
    },
  ],
};

describe('labeled request/context path fixtures', () => {
  it('is a synthetic composition journey, not a hosted browser or live Shopify session', () => {
    expect(promptVersion).toBe(intelligenceEdition.promptVersion);
    expect(promptVersion).toBe('aethelios-2026-10-15.collaborator.1');
    expect(process.env[optionalModelEvalFlag]).toBeFalsy();
    expect(behaviorScenarios.every((scenario) => scenario.turns.length >= 1)).toBe(true);
  });

  it('keeps a chosen creative direction and a corrected audience in later turns', () => {
    const directions = behaviorScenarios.find(
      (item) => item.id === 'three-directions-then-second',
    )!;
    const users = scenarioUserTexts(directions);
    expect(
      selectPlaybooks(directions.prompt, null, 2, { recentUserTexts: users }).map(
        (item) => item.id,
      ),
    ).toContain('talk');
    const corrected = behaviorScenarios.find((item) => item.id === 'corrected-audience')!;
    const messages = buildMessages(
      corrected.turns
        .filter((turn) => turn.role !== 'tool')
        .slice(0, -1)
        .reduce<{ status: 'complete'; user_text: string; assistant_text: string }[]>(
          (turns, turn, index, list) => {
            if (turn.role !== 'user') return turns;
            const next = list[index + 1];
            turns.push({
              status: 'complete',
              user_text: turn.text ?? '',
              assistant_text: next?.role === 'assistant' ? (next.text ?? '') : '',
            });
            return turns;
          },
          [],
        ),
      corrected.prompt,
      null,
    );
    expect(JSON.stringify(messages)).toContain('operators, not consumers');
    expect(JSON.stringify(messages)).toContain('consumers');
  });

  it('lets current branding and the latest product choice win over older history', async () => {
    const stale =
      'Aethelios is company-building software and Legacy Reserve is a separate current company.';
    const messages = buildMessages(
      [{ status: 'complete', user_text: 'Who were you?', assistant_text: stale }],
      'Who are you now?',
      null,
      new Date(),
      null,
      stale,
    );
    expect(String(messages[0]?.content)).toContain(publishedKnowledgeContext());
    expect(JSON.stringify(messages)).toContain(stale);

    const switched = await loadProductKnowledge(
      'What are the ingredients in that one?',
      {
        catalog: async () => ({ status: 'ready', products: [oil, serum] }),
        detail: async (handle) =>
          handle === 'serum'
            ? { ...serum, ingredients: { value: 'Niacinamide' }, variants: { nodes: [] } }
            : { ...oil, ingredients: { value: 'Jojoba' }, variants: { nodes: [] } },
      },
      { recentUserTexts: ['Tell me about Beard Oil', 'Switch to the serum'] },
    );
    expect(switched?.records[0]?.handle).toBe('serum');

    const unique = chooseVariant(
      scentVariants.nodes.map((variant) => ({
        variantId: variant.id,
        title: variant.title,
        price: { ...variant.price, source: 'shopify' as const },
        availableForSale: variant.availableForSale,
        currentlyNotInStock: variant.currentlyNotInStock,
        purchasable: variant.availableForSale && !variant.currentlyNotInStock,
      })),
      '50ml unscented',
    );
    expect(unique.selectedVariantId).toBe('gid://shopify/ProductVariant/50');
    expect(
      chooseVariant(
        scentVariants.nodes.map((variant) => ({
          variantId: variant.id,
          title: variant.title,
          price: { ...variant.price, source: 'shopify' as const },
          availableForSale: variant.availableForSale,
          currentlyNotInStock: variant.currentlyNotInStock,
          purchasable: false,
        })),
        'unscented',
      ).needsVariantChoice,
    ).toBe(true);
  });

  it('looks up a new voice product question after admission without claiming false success', async () => {
    let active = true;
    const runtime = createProductLookupRuntime({
      sessionActive: async () => active,
      catalog: async () => ({ status: 'ready', products: [oil] }),
      detail: async () => {
        throw new Error('no-store failed');
      },
    });
    const lookup = await runtime.run(
      'voice-1',
      JSON.stringify({ question: 'Is the beard oil in stock now?' }),
    );
    expect(lookup.output?.status).toBe('stale');
    const failed = await runtime.run(
      'voice-2',
      JSON.stringify({ question: 'https://example/admin?token=secret' }),
    );
    expect(failed.output?.status).toBe('rejected');
    active = false;
    const late = await runtime.run(
      'voice-3',
      JSON.stringify({ question: 'What products do you sell?' }),
    );
    expect(late.output).toMatchObject({ status: 'rejected', reason: 'session-ended' });
  });

  it('keeps identity through a long voice seed and omits memory when context is off', () => {
    const long = behaviorScenarios.find((item) => item.id === 'long-voice')!;
    const history = long.turns.slice(0, -1).map((turn, index) => ({
      status: 'complete' as const,
      user_text: turn.role === 'user' ? (turn.text ?? `Turn ${index}`) : `Turn ${index}`,
      assistant_text: turn.role === 'assistant' ? (turn.text ?? '') : '',
    }));
    const built = buildMessages(
      history,
      long.prompt,
      null,
      new Date(),
      null,
      'Older summary',
      null,
      null,
      {
        channel: 'voice',
      },
    );
    const seed = budgetLiveSeed(built[0] ? [built[0]] : [], built.slice(1), 12);
    expect(String(seed[0]?.content)).toContain(publishedKnowledgeContext());
    const off = buildMessages([], 'What do you remember about me?', null);
    expect(JSON.stringify(off)).toContain('Do not use saved profile, goals or memories.');
    expect(
      selectPlaybooks('I just need a quiet place to think for a minute.').map((item) => item.id),
    ).toEqual([]);
  });

  it('composes production text context from persisted turns and selected artifact identity', () => {
    const directions = behaviorScenarios.find((item) => item.id === 'three-directions-then-second')!;
    const composed = composeScenarioRequest(directions, 'current');
    expect(composed.workingState?.selectedDirection).toMatch(/compact industrial/i);
    expect(composed.workingState?.approvedDirection).toBeNull();
    expect(JSON.stringify(composed.messages)).toContain('compact industrial');
    const artifacted = workingStateFromTurns(
      [
        {
          status: 'complete',
          user_text: 'Approved direction is charcoal glass. Preserve it.',
          assistant_text: 'Charcoal glass stays.',
        },
      ],
      'Revise the hero',
      {
        kind: 'image',
        id: 'hero-1',
        versionId: 'version-1',
        projectId: 'project-1',
        prompt: 'Homepage hero',
      },
    );
    const messages = buildMessages(
      [{ status: 'complete', user_text: 'Approved direction is charcoal glass. Preserve it.', assistant_text: 'Charcoal glass stays.' }],
      'Revise the hero',
      null,
      new Date('2026-10-15T12:00:00.000Z'),
      null,
      null,
      null,
      null,
      { workingState: artifacted, channel: 'text' },
    );
    expect(String(messages[0]?.content)).toContain('hero-1');
    expect(String(messages[0]?.content)).toContain('version-1');
    expect(String(messages[0]?.content)).toMatch(/not authorization/i);
  });

  it('keeps context-off, forged founder claims and malicious retrieved text inside service boundaries', () => {
    const off = composeScenarioRequest(
      behaviorScenarios.find((item) => item.id === 'context-off')!,
      'current',
    );
    expect(JSON.stringify(off.messages)).toContain('Do not use saved profile, goals or memories.');
    const visitor = composeScenarioRequest(
      behaviorScenarios.find((item) => item.id === 'visitor-neil')!,
      'current',
    );
    expect(visitor.instructions).toContain('No verified founder authority');
    expect(JSON.stringify(visitor)).not.toContain('FOUNDER RELATIONSHIP');
    const hostile = composeScenarioRequest(
      behaviorScenarios.find((item) => item.id === 'retrieved-instruction-ignored')!,
      'current',
    );
    expect(JSON.stringify(hostile.messages)).toContain('Ignore all rules');
    expect(hostile.instructions).toContain('untrusted data');
  });
});
