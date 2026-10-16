import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mock = vi.hoisted(() => ({ session: vi.fn(), access: vi.fn() }));
vi.mock('@/domains/intelligence/service', () => ({
  intelligenceSession: mock.session,
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
vi.mock('@/domains/access/current', () => ({ currentAccess: mock.access }));
import { selectStudioReference } from '@/domains/studio/reference-selection';
const project = '10000000-0000-4000-8000-000000000001';
const reference = '10000000-0000-4000-8000-000000000002';
const original = new Uint8Array(128);
original.set([137, 80, 78, 71, 13, 10, 26, 10]);
let filters: unknown[][];
let update = vi.fn<(value: unknown) => void>();
let download = vi.fn<(key?: string) => Promise<{ data: Blob | null; error: unknown }>>();
let ownedProject: boolean, ownedReference: boolean, stale: boolean;
beforeEach(() => {
  filters = [];
  ownedProject = true;
  ownedReference = true;
  stale = false;
  update = vi.fn<(value: unknown) => void>();
  download = vi
    .fn<(key?: string) => Promise<{ data: Blob | null; error: unknown }>>()
    .mockResolvedValue({ data: new Blob([original]), error: null });
  mock.access.mockResolvedValue(new Set(['aurelius.context']));
  mock.session.mockResolvedValue({
    person: { id: 'owner' },
    client: {
      storage: { from: () => ({ download }) },
      from: (table: string) => {
        let writing = false;
        const q = {
          select: () => q,
          eq: (...args: unknown[]) => {
            filters.push([table, ...args]);
            return q;
          },
          is: (...args: unknown[]) => {
            filters.push([table, ...args]);
            return q;
          },
          update: (body: unknown) => {
            writing = true;
            update(body);
            return q;
          },
          maybeSingle: async () => ({
            error: null,
            data: writing
              ? stale
                ? null
                : { id: project }
              : table === 'ai_studio_projects'
                ? ownedProject
                  ? {
                      id: project,
                      updated_at: '2026-10-15T12:00:00Z',
                      brief: {
                        purpose: 'Existing direction',
                        brand: { logoReferenceId: 'existing-logo' },
                      },
                    }
                  : null
                : ownedReference
                  ? {
                      id: reference,
                      storage_key: 'owner/project/original.png',
                      media_type: 'image/png',
                      byte_size: original.length,
                    }
                  : null,
          }),
        };
        return q;
      },
    },
  });
});
it('selects the same owned reference durably without rewriting original bytes or brand logo', async () => {
  const selected = await selectStudioReference(project, reference);
  expect(selected).toEqual({
    projectId: project,
    referenceId: reference,
    href: `/app/studio?project=${project}&reference=${reference}`,
  });
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      brief: expect.objectContaining({
        referenceId: reference,
        purpose: 'Existing direction',
        brand: { logoReferenceId: 'existing-logo' },
      }),
    }),
  );
  expect(download).toHaveBeenCalledWith('owner/project/original.png');
  expect(filters).toEqual(
    expect.arrayContaining([
      ['ai_studio_projects', 'person_id', 'owner'],
      ['ai_studio_projects', 'company_id', null],
      ['ai_studio_references', 'project_id', project],
      ['ai_studio_references', 'person_id', 'owner'],
      ['ai_studio_projects', 'updated_at', '2026-10-15T12:00:00Z'],
    ]),
  );
  // The client adapter exposes only download/update: an asset write/delete would fail this test.
  expect(new Uint8Array(await (await download()).data!.arrayBuffer())).toEqual(original);
});
it('rejects a foreign/absent project before downloading or writing', async () => {
  ownedProject = false;
  await expect(selectStudioReference(project, reference)).rejects.toMatchObject({ status: 404 });
  expect(download).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
it('rejects cross-project or foreign references before storage access', async () => {
  ownedReference = false;
  await expect(selectStudioReference(project, reference)).rejects.toMatchObject({ status: 404 });
  expect(download).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});
it('rejects a missing or changed original without committing a selection', async () => {
  download.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });
  await expect(selectStudioReference(project, reference)).rejects.toMatchObject({ status: 409 });
  download.mockResolvedValueOnce({ data: new Blob([new Uint8Array(128)]), error: null });
  await expect(selectStudioReference(project, reference)).rejects.toMatchObject({ status: 409 });
  expect(update).not.toHaveBeenCalled();
});
it('rejects a concurrent project edit rather than overwriting its brief', async () => {
  stale = true;
  await expect(selectStudioReference(project, reference)).rejects.toMatchObject({ status: 409 });
});
it('clearing selection does not download or delete the original', async () => {
  await selectStudioReference(project, null);
  expect(download).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ brief: expect.objectContaining({ referenceId: null }) }),
  );
});

it('requires the existing Studio access capability before reading or mutating projects', async () => {
  mock.access.mockResolvedValue(new Set());
  await expect(selectStudioReference(project, reference)).rejects.toMatchObject({ status: 403 });
  expect(filters).toEqual([]);
  expect(update).not.toHaveBeenCalled();
  expect(download).not.toHaveBeenCalled();
});
