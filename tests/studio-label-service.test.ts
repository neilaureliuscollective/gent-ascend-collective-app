import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  save: vi.fn(),
  generate: vi.fn(),
  project: vi.fn(),
}));
vi.mock('../src/domains/studio/service', () => ({
  verifyStudioProject: mocks.verify,
  studioSession: async () => ({
    person: { id: 'owner' },
    client: {
      from: () => {
        const query = { select: () => query, eq: () => query, single: mocks.project };
        return query;
      },
    },
  }),
}));
vi.mock('../src/domains/studio/design-service', () => ({ saveDesign: mocks.save }));
vi.mock('ai', () => ({ generateText: mocks.generate, Output: { object: () => ({}) } }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI: () => ({ responses: () => 'fixture-model' }) }));
vi.mock('../src/domains/intelligence/validation', () => ({
  aiConfigSchema: {
    parse: () => ({ OPENAI_API_KEY: 'synthetic-key-not-used', AURELIUS_AI_MODEL: 'fixture-model' }),
  },
}));
import { createSupplierLabel } from '../src/domains/studio/label/service';
const profile = JSON.parse(readFileSync('tests/fixtures/labels/supplier-profile.json', 'utf8'));
const brief = JSON.parse(readFileSync('tests/fixtures/labels/talk-brief.json', 'utf8'));
const logo = readFileSync('tests/fixtures/labels/approved-fixture-logo.svg', 'utf8');
const input = {
  projectId: '10000000-0000-4000-8000-000000000001',
  profile,
  brief,
  logo,
  mode: 'deterministic' as const,
  modelConsent: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockResolvedValue({});
  mocks.project.mockResolvedValue({
    data: {
      brief: {
        brand: {
          name: 'Saved brand',
          background: '#112233',
          foreground: '#FFFFFF',
          accent: '#C4912F',
        },
      },
    },
    error: null,
  });
  mocks.save.mockImplementation(async (x) => x);
});
describe('label service with mocked model adapter (not real model acceptance)', () => {
  it('uses saved brand and never calls provider for deterministic mode', async () => {
    const saved = await createSupplierLabel(input);
    expect(saved.document.label!.brand.background).toBe('#112233');
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.verify).toHaveBeenCalledWith(input.projectId);
  });
  it('denies foreign project before generation or save', async () => {
    mocks.verify.mockRejectedValue(new Error('scope mismatch'));
    await expect(createSupplierLabel(input)).rejects.toThrow('scope mismatch');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('requires fresh explicit model consent', async () => {
    await expect(createSupplierLabel({ ...input, mode: 'model' })).rejects.toThrow(/approve/);
    expect(mocks.generate).not.toHaveBeenCalled();
  });
  it('validates model output and records actual adapter mode', async () => {
    mocks.generate.mockResolvedValue({
      output: { alignment: 'left', titleSize: 15, logoFraction: 0.3, accent: 'none' },
    });
    const saved = await createSupplierLabel({ ...input, mode: 'model', modelConsent: true });
    expect(saved.document.label!.generation).toBe('model');
    expect(saved.document.label!.layout.alignment).toBe('left');
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
  it('rejects model attempts to invent copy or dimensions', async () => {
    mocks.generate.mockResolvedValue({
      output: {
        alignment: 'left',
        titleSize: 15,
        logoFraction: 0.3,
        accent: 'none',
        ingredients: 'invented',
      },
    });
    await expect(
      createSupplierLabel({ ...input, mode: 'model', modelConsent: true }),
    ).rejects.toThrow();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
