import 'server-only';
import { authorizedPerson } from '@/domains/access/authorize';
import { commerceConfigured, getProduct } from './shopify';
import {
  catalogSaveInput,
  externalProductInput,
  cabinetUpdateInput,
  cabinetDeleteInput,
  cabinetImportHandles,
  cabinetImportInput,
} from './cabinet-model';
export class CabinetError extends Error {}
async function owner(write = false) {
  const session = await authorizedPerson(write ? 'profile.write' : 'profile.read');
  if (!session) throw new CabinetError('Sign in to use your Cabinet.');
  return session;
}
export async function cabinetWorkspace(page = 0) {
  const { client, person } = await owner();
  const [records, rituals] = await Promise.all([
    client
      .from('grooming_products')
      .select('*')
      .eq('person_id', person.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * 20, page * 20 + 20),
    client
      .from('grooming_rituals')
      .select('id,title,kind')
      .eq('person_id', person.id)
      .eq('active', true),
  ]);
  if (records.error || rituals.error)
    throw new CabinetError('Your Cabinet is temporarily unavailable.');
  return {
    records: (records.data ?? []).slice(0, 20),
    hasMore: (records.data ?? []).length > 20,
    rituals: rituals.data ?? [],
  };
}
export async function saveCatalogProduct(raw: unknown) {
  const { handle } = catalogSaveInput.parse(raw),
    { client, person } = await owner(true);
  if (!commerceConfigured()) throw new CabinetError('The collection is temporarily unavailable.');
  const product = await getProduct(handle);
  if (!product || !/^gid:\/\/shopify\/Product\/[0-9]+$/.test(product.id))
    throw new CabinetError('This product is no longer in the collection.');
  // Keep legacy Vault records. Saving again never resets use state or personal notes.
  const old = await client
    .from('grooming_products')
    .select('id')
    .eq('person_id', person.id)
    .eq('shopify_handle', handle)
    .limit(1);
  if (old.error) throw new CabinetError('Product could not be saved.');
  if (old.data?.length) return;
  const result = await client.from('grooming_products').upsert(
    {
      person_id: person.id,
      catalog_product_id: product.id,
      shopify_handle: product.handle,
      name: product.title.slice(0, 120),
      category: 'other',
      relation: 'saved',
    },
    { onConflict: 'person_id,catalog_product_id', ignoreDuplicates: true },
  );
  if (result.error) throw new CabinetError('Product could not be saved. Please retry.');
}
export async function saveExternalProduct(raw: unknown) {
  const input = externalProductInput.parse(raw),
    { client, person } = await owner(true);
  // Stable form ID makes a retried submission an insertion replay, not another product.
  const result = await client.from('grooming_products').upsert(
    {
      ...input,
      person_id: person.id,
      relation: 'owned',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (result.error) throw new CabinetError('Product could not be saved. Please retry.');
  const confirmed = await client
    .from('grooming_products')
    .select('name,category')
    .eq('person_id', person.id)
    .eq('id', input.id)
    .maybeSingle();
  if (
    confirmed.error ||
    !confirmed.data ||
    confirmed.data.name !== input.name ||
    confirmed.data.category !== input.category
  )
    throw new CabinetError(
      'This submission changed or could not be confirmed. Reload before recording another product.',
    );
}
export async function updateCabinetProduct(raw: unknown) {
  const input = cabinetUpdateInput.parse(raw),
    { client, person } = await owner(true);
  if (input.ritual_id) {
    const ritual = await client
      .from('grooming_rituals')
      .select('id')
      .eq('person_id', person.id)
      .eq('id', input.ritual_id)
      .eq('active', true)
      .maybeSingle();
    if (ritual.error || !ritual.data)
      throw new CabinetError('That ritual changed. Reload before linking it.');
  }
  const { id, version, ...fields } = input;
  const result = await client
    .from('grooming_products')
    .update(fields)
    .eq('person_id', person.id)
    .eq('id', id)
    .eq('version', version)
    .select('id')
    .maybeSingle();
  if (result.error || !result.data)
    throw new CabinetError(
      'This record changed. Reload before saving again. Your draft is retained.',
    );
}
export async function removeCabinetProduct(raw: unknown) {
  const { id, version } = cabinetDeleteInput.parse(raw),
    { client, person } = await owner(true);
  const result = await client
    .from('grooming_products')
    .delete()
    .eq('person_id', person.id)
    .eq('id', id)
    .eq('version', version)
    .select('id')
    .maybeSingle();
  if (result.error || !result.data)
    throw new CabinetError('This record changed. Reload before removing it.');
}

export async function reviewCabinetImport(raw: unknown) {
  const handles = cabinetImportHandles.parse(raw),
    { person } = await owner();
  if (!commerceConfigured()) throw new CabinetError('The collection is temporarily unavailable.');
  const products = await Promise.all(handles.map((handle) => getProduct(handle)));
  return {
    owner: person.id,
    items: products.flatMap((product) =>
      product && /^gid:\/\/shopify\/Product\/[0-9]+$/.test(product.id)
        ? [{ handle: product.handle, id: product.id, title: product.title.slice(0, 120) }]
        : [],
    ),
    unavailable: handles.filter(
      (_handle, index) =>
        !products[index] || !/^gid:\/\/shopify\/Product\/[0-9]+$/.test(products[index]!.id),
    ),
    error: '',
  };
}
export async function importCabinetSelection(raw: unknown) {
  const input = cabinetImportInput.parse(raw),
    { client, person } = await owner(true);
  if (input.owner !== person.id)
    throw new CabinetError('Your signed-in account changed. Review the selection again.');
  if (!commerceConfigured()) throw new CabinetError('The collection is temporarily unavailable.');
  const products = await Promise.all(input.items.map((item) => getProduct(item.handle)));
  if (products.some((product, index) => !product || product.id !== input.items[index]!.id))
    throw new CabinetError('The collection changed. Review the selection again before importing.');
  const existing = await client
    .from('grooming_products')
    .select('shopify_handle')
    .eq('person_id', person.id)
    .in(
      'shopify_handle',
      input.items.map((item) => item.handle),
    );
  if (existing.error) throw new CabinetError('Your Cabinet could not be checked. Please retry.');
  const kept = new Set((existing.data ?? []).map((row) => row.shopify_handle));
  const unique = new Map(
    products
      .filter((product) => product && !kept.has(product.handle))
      .map((product) => [product!.id, product!]),
  );
  const rows = Array.from(unique.values()).map((product) => ({
    person_id: person.id,
    catalog_product_id: product.id,
    shopify_handle: product.handle,
    name: product.title.slice(0, 120),
    category: 'other' as const,
    relation: 'saved' as const,
  }));
  if (!rows.length) return 0;
  const result = await client
    .from('grooming_products')
    .upsert(rows, { onConflict: 'person_id,catalog_product_id', ignoreDuplicates: true })
    .select('id');
  if (result.error)
    throw new CabinetError(
      'Import could not be confirmed. Retry this selection; existing records are kept.',
    );
  return result.data?.length ?? 0;
}
