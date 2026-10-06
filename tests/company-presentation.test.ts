import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { PDFDocument } from 'pdf-lib';
import {
  workContent,
  workScope,
  validateFigures,
  emptyWork,
} from '../src/domains/company-work/schema';
import { presentationLayout, presentationPdf } from '../src/domains/company-work/presentation';
const id = 'd8000000-0000-4000-8000-000000000001';
const scope = workScope.parse({
  request: 'Synthetic launch',
  audience: 'Founder',
  outcome: 'Reviewed deck',
  constraints: '',
  acceptance: 'An actionable offer',
  evidence: [],
  figures: [
    {
      id,
      label: 'Confirmed annual revenue',
      value: '$123,456.78',
      source: 'Synthetic founder-supplied statement',
    },
  ],
});
const content = workContent.parse({
  ...emptyWork('Synthetic strategy'),
  slides: [
    {
      title: 'Confirmed economics',
      body: 'Use the confirmed evidence for the launch decision.',
      bullets: ['Verify costs before expansion.'],
      figureIds: [id],
      notes: 'INTERNAL PRIVATE MARGIN SENTINEL',
    },
  ],
});
describe('reviewed presentation fidelity', () => {
  it('uses exact supplied values and sources in the shared bounded layout, excluding private notes', async () => {
    const layout = await presentationLayout(content, scope, 'Synthetic Co · v3');
    const text = layout[0]!.lines.map((l) => l.text).join('\n');
    expect(text).toContain('Confirmed annual revenue: $123,456.78');
    expect(text).toContain('Synthetic founder-supplied statement');
    expect(text).not.toContain('MARGIN SENTINEL');
    expect(layout.every((s) => s.lines.every((l) => l.y <= 512 && l.x >= 0 && l.size >= 10))).toBe(
      true,
    );
  });
  it('exports a real embedded-font landscape PDF matching the reviewed slide count', async () => {
    const bytes = await presentationPdf(
      content,
      scope,
      'Synthetic Co · v3',
      '2026-10-06T00:00:00Z',
    );
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toContain('%PDF-1.7');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(content.slides.length);
    expect(pdf.getPage(0).getSize()).toEqual({ width: 960, height: 540 });
    expect(pdf.getTitle()).toBe(content.title);
    expect(bytes.length).toBeGreaterThan(5000);
    if (process.env.AETHELIOS_PRESENTATION_SAMPLE)
      await (
        await import('node:fs/promises')
      ).writeFile(process.env.AETHELIOS_PRESENTATION_SAMPLE, bytes);
  });
  it('fails clearly for unsupported glyphs and unknown figure links', async () => {
    const unsupported = {
      ...content,
      slides: [{ ...content.slides[0]!, title: 'Unsupported 🧬' }],
    };
    await expect(
      presentationPdf(unsupported, scope, 'Synthetic', '2026-10-06T00:00:00Z'),
    ).rejects.toThrow(/character/);
    const unknown = {
      ...content,
      slides: [{ ...content.slides[0]!, figureIds: [crypto.randomUUID()] }],
    };
    expect(validateFigures(unknown, scope)).toBe(false);
    await expect(presentationLayout(unknown, scope, 'Synthetic')).rejects.toThrow(/Unknown figure/);
  });
  it('rejects oversized or forged deliverable fields before persistence', () => {
    expect(workContent.safeParse({ ...content, person_id: 'forged' }).success).toBe(false);
    expect(
      workContent.safeParse({
        ...content,
        slides: [{ ...content.slides[0]!, body: 'x'.repeat(701) }],
      }).success,
    ).toBe(false);
    expect(
      workScope.safeParse({ ...scope, figures: [scope.figures[0], scope.figures[0]] }).success,
    ).toBe(false);
  });
});
