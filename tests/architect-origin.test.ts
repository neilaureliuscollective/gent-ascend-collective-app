import { describe, it, expect } from 'vitest';
import {
  initialProject,
  projectContentSchema,
  proposalSchema,
  boundedContext,
  consistencyNotes,
  safeUrl,
  type OriginProject,
} from '@/domains/architect-origin/schema';
const content = initialProject('Build a premium skincare company', 'business');
const project: OriginProject = {
  id: crypto.randomUUID(),
  person_id: crypto.randomUUID(),
  revision: 2,
  content,
  created_at: '',
  updated_at: '',
};
describe('Origin project intelligence contracts', () => {
  it('uses one project contract across all four journeys and bounds untrusted data', () => {
    for (const discipline of ['business', 'application', 'product', 'custom'] as const)
      expect(
        projectContentSchema.safeParse(initialProject('Test creation', discipline)).success,
      ).toBe(true);
    expect(projectContentSchema.safeParse({ ...content, owner: 'forged' }).success).toBe(false);
    expect(
      projectContentSchema.safeParse({
        ...content,
        blueprint: { ...content.blueprint, vision: 'x'.repeat(3001) },
      }).success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({
        reply: 'Proposal',
        changes: [{ section: 'unknown', content: 'x', reason: 'x' }],
        document: null,
      }).success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({
        reply: 'Proposal',
        changes: [],
        document: null,
        sources: ['invented'],
      }).success,
    ).toBe(false);
  });
  it('rejects active URLs and credentials while permitting attributed HTTP evidence', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/plain,hi',
      'https://user:secret@example.com',
      'not a url',
    ])
      expect(safeUrl.safeParse(url).success).toBe(false);
    expect(safeUrl.safeParse('https://example.com/evidence').success).toBe(true);
  });
  it('retrieves bounded current direction and only the selected document', () => {
    const doc = {
      id: crypto.randomUUID(),
      title: 'Spec',
      kind: 'Product requirements' as const,
      status: 'draft' as const,
      content: 'x'.repeat(24000),
      basis: 1,
    };
    const input = {
      ...project,
      content: {
        ...content,
        documents: [doc],
        blueprint: Object.fromEntries(
          Object.keys(content.blueprint).map((k) => [k, 'a'.repeat(3000)]),
        ) as typeof content.blueprint,
      },
    };
    const output = boundedContext(input, [], doc.id);
    expect(output.document!.content).toHaveLength(12000);
    expect(output.blueprint.vision).toHaveLength(1800);
    expect(output.blueprint.risks).toHaveLength(650);
    expect(boundedContext(input, [], null).document).toBeNull();
    expect(JSON.stringify(output).length).toBeLessThan(26000);
  });
  it('identifies missing evidence and physical/software validation without claiming verification', () => {
    expect(consistencyNotes(content, 2).join(' ')).toMatch(/No attributed evidence/);
    expect(consistencyNotes({ ...content, discipline: 'product' }, 2).join(' ')).toMatch(
      /laboratory/,
    );
    expect(consistencyNotes({ ...content, discipline: 'application' }, 2).join(' ')).toMatch(
      /does not demonstrate working/,
    );
  });
});

import { compileDocument } from '@/domains/architect-origin/documents';
import { documentKinds, documentSchema } from '@/domains/architect-origin/schema';
it('creates a usable editable document for every supported kind without invented economics or lost bounds', () => {
  const full = {
    ...content,
    description: 'd'.repeat(2000),
    blueprint: Object.fromEntries(
      Object.keys(content.blueprint).map((k) => [
        k,
        'Approved detail. '.repeat(180).slice(0, 3000),
      ]),
    ) as typeof content.blueprint,
    sources: Array.from({ length: 30 }, (_, i) => ({
      url: `https://example.com/${i}/` + 'x'.repeat(1900),
      title: 't'.repeat(160),
      provenance: 'user' as const,
    })),
  };
  for (const kind of documentKinds) {
    const text = compileDocument(full, kind);
    expect(text).toContain('Draft compiled from the approved Living Blueprint');
    expect(text).toContain('Section excerpted');
    expect(text).toContain('Additional sources remain');
    expect(
      documentSchema.safeParse({
        id: crypto.randomUUID(),
        title: 'Test',
        kind,
        content: text,
        status: 'draft',
        basis: 1,
      }).success,
    ).toBe(true);
  }
});
