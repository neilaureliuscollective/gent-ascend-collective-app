'use server';
import { revalidatePath } from 'next/cache';
import {
  CabinetError,
  saveCatalogProduct,
  saveExternalProduct,
  updateCabinetProduct,
  removeCabinetProduct,
  reviewCabinetImport,
  importCabinetSelection,
} from '@/domains/commerce/cabinet';
const field = (f: FormData, key: string) => String(f.get(key) ?? '');
type Result = { error: string; message: string };
async function commit(write: () => Promise<void>): Promise<Result> {
  try {
    await write();
    revalidatePath('/app/collection/cabinet');
    revalidatePath('/app/grooming');
    return { error: '', message: 'Saved to your Cabinet.' };
  } catch (error) {
    return {
      error:
        error instanceof CabinetError
          ? error.message
          : 'Check the fields and try again. Your draft is retained.',
      message: '',
    };
  }
}
export async function saveProductAction(_previous: Result, f: FormData) {
  return commit(() => saveCatalogProduct({ handle: field(f, 'handle') }));
}
export async function externalProductAction(_previous: Result, f: FormData) {
  return commit(() =>
    saveExternalProduct({
      id: field(f, 'id'),
      name: field(f, 'name'),
      category: field(f, 'category'),
    }),
  );
}
export async function cabinetProductAction(_previous: Result, f: FormData) {
  if (field(f, 'operation') === 'remove') {
    const result = await commit(() =>
      removeCabinetProduct({ id: field(f, 'id'), version: field(f, 'version') }),
    );
    return result.error ? result : { error: '', message: 'Removed from your Cabinet.' };
  }
  return commit(() =>
    updateCabinetProduct({
      id: field(f, 'id'),
      version: field(f, 'version'),
      relation: field(f, 'relation'),
      note: field(f, 'note'),
      ritual_id: field(f, 'ritual_id') || null,
    }),
  );
}

export async function reviewSelectionAction(
  _previous: import('@/domains/commerce/cabinet-model').CabinetImportReview,
  form: FormData,
) {
  try {
    return await reviewCabinetImport(form.getAll('handle'));
  } catch (error) {
    return {
      owner: '',
      items: [],
      unavailable: [],
      error:
        error instanceof CabinetError
          ? error.message
          : 'Choose between one and twenty products to review.',
    };
  }
}
export async function importSelectionAction(_previous: Result, form: FormData): Promise<Result> {
  try {
    const count = await importCabinetSelection({
      owner: field(form, 'owner'),
      items: JSON.parse(field(form, 'items')),
    });
    revalidatePath('/app/collection/cabinet');
    revalidatePath('/app/grooming');
    return {
      error: '',
      message: count
        ? `${count} ${count === 1 ? 'product' : 'products'} added to your Cabinet. Existing notes and use states are kept.`
        : 'These products are already in your Cabinet. Existing notes and use states are kept.',
    };
  } catch (error) {
    return {
      error:
        error instanceof CabinetError
          ? error.message
          : 'The selection could not be imported. Review it again.',
      message: '',
    };
  }
}
