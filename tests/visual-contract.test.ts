import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisualBoard } from '@/components/live/visual-board';
import { visualSchema, visualContext } from '@/domains/artifacts/visual';
import { visualProposal, imageProposal } from '@/domains/artifacts/contract';
const diagram = {
  kind: 'diagram',
  basis: 'conceptual',
  title: 'Conversation architecture',
  summary: 'A conceptual flow.',
  nodes: [
    { id: 'voice', label: 'Voice', detail: 'Media transport.' },
    { id: 'tools', label: 'Tools', detail: 'Reviewed work.' },
  ],
  edges: [{ from: 'voice', to: 'tools', label: 'Delegates' }],
};
const comparison = {
  kind: 'comparison',
  basis: 'conceptual',
  title: 'Architecture choices',
  summary: 'Illustrative tradeoffs.',
  options: [
    { id: 'simple', label: 'Simple', detail: 'One service.' },
    { id: 'distributed', label: 'Distributed', detail: 'Separate services.' },
  ],
  rows: [
    {
      label: 'Operations',
      cells: [
        { optionId: 'simple', value: 'Fewer components', detail: 'Simpler to operate.' },
        {
          optionId: 'distributed',
          value: 'More components',
          detail: 'More independent lifecycles.',
        },
      ],
    },
  ],
};
describe('trusted visual data contract', () => {
  it('rejects executable fields, unverifiable provenance and invalid graph identities', () => {
    expect(visualSchema.safeParse({ ...diagram, html: '<script>run()</script>' }).success).toBe(
      false,
    );
    expect(visualSchema.safeParse({ ...diagram, basis: 'verified' }).success).toBe(false);
    expect(
      visualSchema.safeParse({ ...diagram, nodes: [diagram.nodes[0], diagram.nodes[0]] }).success,
    ).toBe(false);
    expect(
      visualSchema.safeParse({
        ...diagram,
        edges: [{ from: 'voice', to: 'missing', label: 'bad' }],
      }).success,
    ).toBe(false);
    expect(
      visualSchema.safeParse({ ...diagram, edges: [diagram.edges[0], diagram.edges[0]] }).success,
    ).toBe(false);
    expect(
      visualSchema.safeParse({ ...diagram, edges: [{ from: 'voice', to: 'voice', label: 'bad' }] })
        .success,
    ).toBe(false);
  });
  it('requires each comparison row to match the displayed options exactly', () => {
    expect(visualSchema.safeParse(comparison).success).toBe(true);
    expect(
      visualSchema.safeParse({
        ...comparison,
        rows: [
          {
            label: 'Operations',
            cells: [comparison.rows[0]!.cells[0], comparison.rows[0]!.cells[0]],
          },
        ],
      }).success,
    ).toBe(false);
  });
  it('keeps visual proposals separate from images and rejects caller ownership and result payloads', () => {
    const proposal = {
      id: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      operation: 'visual.diagram',
      prompt: 'Map the system',
    };
    expect(visualProposal.safeParse(proposal).success).toBe(true);
    expect(imageProposal.safeParse(proposal).success).toBe(false);
    expect(visualProposal.safeParse({ ...proposal, personId: crypto.randomUUID() }).success).toBe(
      false,
    );
    expect(visualProposal.safeParse({ ...proposal, visual: diagram }).success).toBe(false);
  });
  it('builds bounded reference context with only the exact selected part', () => {
    const board = visualSchema.parse(diagram);
    const context = JSON.parse(visualContext({ id: 'owned', visual: board }, 'tools'));
    expect(context.selectedPart.id).toBe('tools');
    expect(context.basis).toBe('conceptual');
    expect(
      JSON.parse(visualContext({ id: 'owned', visual: board }, 'absent')).selectedPart,
    ).toBeNull();
    expect(visualContext({ id: 'owned', visual: board }, 'tools').length).toBeLessThanOrEqual(1800);
  });
  it('escapes provider text and renders keyboard controls and conceptual provenance', () => {
    const board = visualSchema.parse({
      ...diagram,
      nodes: [{ ...diagram.nodes[0], label: '<script>alert(1)</script>' }, diagram.nodes[1]],
    });
    const html = renderToStaticMarkup(
      createElement(VisualBoard, { board, busy: false, partId: 'voice', onSelect: () => {} }),
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Diagram components');
    expect(html).toContain('Conceptual illustration');
    expect(
      renderToStaticMarkup(
        createElement(VisualBoard, {
          board: visualSchema.parse(comparison),
          busy: false,
          onSelect: () => {},
        }),
      ),
    ).toContain('scope="col"');
  });
});
