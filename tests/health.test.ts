import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { performancePayload } from '../src/domains/release/performance';
import { parseCsv, parseLabImport, originalMime } from '../src/domains/health/imports';
import { biomarkerSeries, numeric, summarize, weightKg } from '../src/domains/health/trends';
import { emptyHealth, mutationSchema, type SavedObservation } from '../src/domains/health/schema';
const base: SavedObservation = {
  id: 'a1000000-0000-4000-8000-000000000001',
  record_id: 'a2000000-0000-4000-8000-000000000001',
  name: 'Reported test',
  code: '',
  value: '10',
  unit: 'mg/dL',
  date: '2026-10-01',
  specimen: 'serum',
  method: 'reported method',
  range: '5–15',
  flag: '',
  version: 1,
  status: 'active',
  confirmed_at: '2026-10-02T12:00:00Z',
};
describe('Health evidence and imports', () => {
  it('keeps missing values unknown, retains zero and converts actual original weight', () => {
    expect(summarize([])).toMatchObject({ average: null, count: 0 });
    expect(
      summarize([{ date: '2026-10-01', value: 0, source: 'user', version: 1, updatedAt: '' }])
        .average,
    ).toBe(0);
    expect(weightKg(100, 'lb')).toBeCloseTo(45.359237);
    expect(emptyHealth().wellness.sleep).toEqual([]);
  });
  it('does not combine changed specimens, methods, units, qualitative or qualified values', () => {
    const second = {
      ...base,
      id: 'a1000000-0000-4000-8000-000000000002',
      date: '2026-10-05',
      value: '12',
    };
    expect(biomarkerSeries([base, second])[0]!.difference).toBe(2);
    for (const changed of [{ unit: 'mmol/L' }, { specimen: 'urine' }, { method: 'different' }])
      expect(biomarkerSeries([base, { ...second, ...changed }])).toHaveLength(2);
    for (const value of ['<12', '>12', 'positive', 'Infinity', '1e10']) {
      expect(numeric(value)).toBeNull();
      expect(biomarkerSeries([base, { ...second, value }])[0]!.difference).toBeNull();
    }
    expect(
      biomarkerSeries([base, { ...second, method: '' }]).every((s) => s.difference === null),
    ).toBe(true);
    expect(biomarkerSeries([base, { ...second, date: base.date }])[0]!.difference).toBeNull();
    expect(biomarkerSeries([{ ...base, status: 'excluded' }])).toEqual([]);
    expect(
      biomarkerSeries([
        base,
        second,
        { ...second, id: 'a1000000-0000-4000-8000-000000000003', value: '15' },
      ])[0]!.difference,
    ).toBeNull();
  });
  it('parses quoted CSV without executing formulas and refuses invalid columns, dates and unbounded input', () => {
    expect(parseCsv('name,value\r\n"a,b","x""y"')).toEqual([
      ['name', 'value'],
      ['a,b', 'x"y'],
    ]);
    const result = parseLabImport(
      'name,value,unit,date,range\n"Test, reported",0,mg/dL,2026-10-01,"2, 5"',
      'csv',
    );
    expect(result[0]).toMatchObject({
      name: 'Test, reported',
      value: '0',
      range: '2, 5',
      method: '',
    });
    for (const text of [
      'name,name\nx,y',
      'name,value,unit,date\nx,1,x,2026-02-30',
      'name,value,unit,date\nx,1',
      '"unclosed',
      '"name"x,value,unit,date',
    ])
      expect(() => parseLabImport(text, 'csv')).toThrow();
    expect(() => parseLabImport('x'.repeat(200001), 'json')).toThrow();
    expect(() => parseLabImport(JSON.stringify([{ ...base }]), 'json')).toThrow();
  });
  it('excludes Health routes from optional anonymous metric payloads', () => {
    expect(performancePayload({ name: 'LCP', value: 1200 }, '/app/health', 390)).toBeNull();
    expect(performancePayload({ name: 'LCP', value: 1200 }, '/app/health/records', 390)).toBeNull();
    expect(performancePayload({ name: 'LCP', value: 1200 }, '/app/aethelios', 390)).not.toBeNull();
  });
  it('uses actual file signatures, never a trusted extension', () => {
    expect(originalMime(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(originalMime(new TextEncoder().encode('<script>'))).toBeNull();
  });
  it('keeps Health AI off the general knowledge and memory path', () => {
    const source = readFileSync('src/domains/health/conversation.ts', 'utf8');
    expect(source).toContain(
      'general memory, Lifestyle catalog, company briefs, published brand knowledge',
    );
    expect(source).not.toMatch(
      /published-knowledge|product-knowledge|personalContext|buildMessages/,
    );
  });
  it('does not accept client ownership, expanded AI contexts or unversioned writes', () => {
    expect(
      mutationSchema.safeParse({
        kind: 'ask',
        request: base.id,
        question: 'Explain',
        evidence: [],
        consentVersion: 1,
        includeContext: true,
      }).success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        kind: 'consent',
        request: base.id,
        purpose: 'records',
        granted: true,
        adult: true,
        person_id: 'someone',
      }).success,
    ).toBe(false);
    expect(
      mutationSchema.safeParse({
        kind: 'confirm',
        request: base.id,
        id: base.record_id,
        observations: [],
      }).success,
    ).toBe(false);
  });
});
