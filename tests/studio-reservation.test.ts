import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({
  row: {
    id: 'operation',
    person_id: 'owner',
    project_id: 'project',
    parent_id: null,
    reference_id: null,
    prompt: 'A city',
    model: 'gpt-image-2.5-flare',
    image_size: '1024x1024',
    status: 'pending',
  },
  image: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('@/platform/openai/image', () => ({
  renderImage: mock.image,
  ImageGenerationError: class extends Error {
    status = 503;
  },
}));
vi.mock('@/domains/access/current', () => ({
  currentAccess: async () => new Set(['aurelius.context', 'studio.create']),
}));
vi.mock('@/domains/intelligence/service', () => ({
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
      from: (table: string) => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({
          data:
            table === 'ai_studio_versions'
              ? mock.row
              : { brief: { purpose: '', audience: '', direction: '', palette: '', avoid: '' } },
          error: null,
        }),
        maybeSingle: async () => ({ data: { id: 'project', company_id: null }, error: null }),
      }),
      rpc: mock.rpc,
      auth: { getUser: async () => ({ data: { user: { id: 'auth-user' } } }) },
      storage: { from: () => ({ upload: mock.upload, remove: vi.fn() }) },
    },
  }),
}));
import { generateStudio } from '@/domains/studio/service';
const input = {
  id: 'operation',
  projectId: 'project',
  parentId: null,
  referenceId: null,
  prompt: 'A city',
  mode: 'fast' as const,
  size: '1024x1024' as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.row.prompt = 'A city';
  mock.image.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mock.upload.mockResolvedValue({ error: null });
  mock.rpc.mockResolvedValue({ data: true, error: null });
});
it('completes a claimed Studio reservation without reserving or spending twice', async () => {
  await generateStudio(input, undefined, true);
  expect(mock.rpc.mock.calls.map((call) => call[0])).toEqual(['ai_studio_finish']);
  expect(mock.image).toHaveBeenCalledOnce();
});
it('refuses mismatched reserved input before sending any image generation request', async () => {
  mock.row.prompt = 'Different approved direction';
  await expect(generateStudio(input, undefined, true)).rejects.toThrow(/does not match/);
  expect(mock.image).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
