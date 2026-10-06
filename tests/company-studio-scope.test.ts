import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  companyId: 'company-a' as string | null,
  projectId: 'project-a',
  rpc: vi.fn(),
  download: vi.fn(),
  filters: [] as unknown[][],
}));
vi.mock('server-only', () => ({}));
vi.mock('../src/domains/access/current', () => ({
  currentAccess: async () => ({ has: () => true }),
}));
vi.mock('../src/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
  intelligenceSession: async () => ({
    person: { id: 'owner' },
    client: {
      from(table: string) {
        const query = {
          select() {
            return query;
          },
          eq(key: string, value: unknown) {
            state.filters.push([table, key, value]);
            return query;
          },
          is(key: string, value: unknown) {
            state.filters.push([table, key, value]);
            return query;
          },
          order() {
            return query;
          },
          limit() {
            return query;
          },
          maybeSingle: async () => ({
            data: { id: state.projectId, company_id: state.companyId },
            error: null,
          }),
          single: async () => ({
            data: { storage_key: 'private.png', project_id: state.projectId },
            error: null,
          }),
        };
        return query;
      },
      rpc: state.rpc,
      storage: { from: () => ({ download: state.download }) },
    },
  }),
}));
import { generateStudio, imageBlob, verifyStudioProject } from '../src/domains/studio/service';
beforeEach(() => {
  state.companyId = 'company-a';
  state.projectId = 'project-a';
  state.filters = [];
  vi.clearAllMocks();
});
describe('company Studio scope before paid or storage access', () => {
  it('rejects company-linked projects through the legacy generation entry before reserving or calling a provider', async () => {
    await expect(
      generateStudio({
        id: crypto.randomUUID(),
        projectId: state.projectId,
        parentId: null,
        referenceId: null,
        prompt: 'Synthetic visual',
        mode: 'fast',
        size: '1536x1024',
      }),
    ).rejects.toThrow(/scope mismatch/);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('rejects wrong-company images before downloading private storage', async () => {
    await expect(imageBlob('asset-a', 'version', 'company-b')).rejects.toThrow(/scope mismatch/);
    expect(state.download).not.toHaveBeenCalled();
    await expect(imageBlob('asset-a', 'version')).rejects.toThrow(/scope mismatch/);
    expect(state.download).not.toHaveBeenCalled();
  });
  it('requires the exact explicit company and retains server-side person ownership', async () => {
    await expect(verifyStudioProject('project-a', 'company-a')).resolves.toMatchObject({
      company_id: 'company-a',
    });
    expect(state.filters).toContainEqual(['ai_studio_projects', 'person_id', 'owner']);
    state.companyId = null;
    await expect(verifyStudioProject('project-a')).resolves.toMatchObject({ company_id: null });
    await expect(verifyStudioProject('project-a', 'company-a')).rejects.toThrow(/scope mismatch/);
  });
});
