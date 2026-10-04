import { z } from 'zod';
export const cabinetRelations = [
  'saved',
  'owned',
  'in_use',
  'running_low',
  'finished',
  'tried',
  'favorite',
  'stopped',
] as const;
export type CabinetRelation = (typeof cabinetRelations)[number];
export const cabinetLabels: Record<CabinetRelation, string> = {
  saved: 'Saved',
  owned: 'Owned',
  in_use: 'In use',
  running_low: 'Running low',
  finished: 'Finished',
  tried: 'Tried',
  favorite: 'Favorite',
  stopped: 'Stopped using',
};
export const catalogSaveInput = z
  .object({ handle: z.string().regex(/^[a-z0-9-]{1,120}$/) })
  .strict();
export const externalProductInput = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    category: z.enum(['hair', 'beard', 'skin', 'other']),
  })
  .strict();
export const cabinetUpdateInput = z
  .object({
    id: z.uuid(),
    version: z.coerce.number().int().min(1),
    relation: z.enum(cabinetRelations),
    note: z.string().trim().max(400),
    ritual_id: z.uuid().nullable(),
  })
  .strict();
export const cabinetDeleteInput = cabinetUpdateInput.pick({ id: true, version: true });
export type CabinetRow = {
  id: string;
  person_id: string;
  name: string;
  category: 'hair' | 'beard' | 'skin' | 'other';
  relation: CabinetRelation;
  shopify_handle: string | null;
  catalog_product_id: string | null;
  note: string;
  created_at: string;
  updated_at: string;
  version: number;
  ritual_id: string | null;
};

export const cabinetImportHandles = z
  .array(catalogSaveInput.shape.handle)
  .min(1)
  .max(20)
  .refine((handles) => new Set(handles).size === handles.length, 'Choose each product once.');
export const cabinetImportInput = z
  .object({
    owner: z.uuid(),
    items: z
      .array(
        z
          .object({
            handle: catalogSaveInput.shape.handle,
            id: z.string().regex(/^gid:\/\/shopify\/Product\/[0-9]+$/),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    ({ items }) => new Set(items.map((item) => item.handle)).size === items.length,
    'Choose each product once.',
  );
export type CabinetImportReview = {
  owner: string;
  items: { handle: string; id: string; title: string }[];
  unavailable: string[];
  error: string;
};
