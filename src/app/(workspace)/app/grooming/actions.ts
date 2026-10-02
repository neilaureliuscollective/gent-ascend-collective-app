'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addCheckin,
  addEvent,
  addGoal,
  addLook,
  addPhoto,
  addProduct,
  deletePhoto,
  finishGoal,
  saveProfile,
  setRitual,
} from '@/domains/grooming/service';
const s = (f: FormData, k: string) => String(f.get(k) ?? '');
const date = (f: FormData, k: string) => s(f, k) || null;
async function commit(task: () => Promise<unknown>) {
  let result = 'saved';
  try {
    await task();
    revalidatePath('/app/grooming');
  } catch {
    result = 'error';
  }
  redirect(`/app/grooming?result=${result}`);
}
export async function profileAction(f: FormData) {
  await commit(() =>
    saveProfile({
      hair_focus: s(f, 'hair_focus'),
      beard_focus: s(f, 'beard_focus'),
      skin_focus: s(f, 'skin_focus'),
      preferred_look: s(f, 'preferred_look'),
      effort: s(f, 'effort'),
      sensitivities: s(f, 'sensitivities'),
      dislikes: s(f, 'dislikes'),
      version: s(f, 'version'),
    }),
  );
}
export async function goalAction(f: FormData) {
  await commit(() => addGoal({ title: s(f, 'title'), target_date: date(f, 'target_date') }));
}
export async function finishGoalAction(f: FormData) {
  await commit(() => finishGoal(s(f, 'id')));
}
export async function ritualAction(f: FormData) {
  await commit(() => setRitual({ kind: s(f, 'kind'), title: s(f, 'title'), steps: s(f, 'steps') }));
}
export async function checkinAction(f: FormData) {
  await commit(() => addCheckin({ ritual_id: s(f, 'ritual_id'), done: true, note: s(f, 'note') }));
}
export async function productAction(f: FormData) {
  await commit(() =>
    addProduct({
      name: s(f, 'name'),
      category: s(f, 'category'),
      relation: s(f, 'relation'),
      shopify_handle: date(f, 'shopify_handle'),
      note: s(f, 'note'),
    }),
  );
}
export async function lookAction(f: FormData) {
  await commit(() =>
    addLook({
      title: s(f, 'title'),
      detail: s(f, 'detail'),
      kind: s(f, 'kind'),
      service_date: date(f, 'service_date'),
    }),
  );
}
export async function eventAction(f: FormData) {
  await commit(() =>
    addEvent({ title: s(f, 'title'), event_date: s(f, 'event_date'), note: s(f, 'note') }),
  );
}
export async function photoAction(f: FormData) {
  await commit(() =>
    addPhoto(
      { view: s(f, 'view'), captured_on: s(f, 'captured_on'), note: s(f, 'note') },
      f.get('image') as File,
    ),
  );
}
export async function deletePhotoAction(f: FormData) {
  await commit(() => deletePhoto(s(f, 'id')));
}

// Focused editors return failures in place so the member's draft survives.
export async function saveDirectionAction(f: FormData): Promise<{ error: string }> {
  try {
    await saveProfile({
      hair_focus: s(f, 'hair_focus'),
      beard_focus: s(f, 'beard_focus'),
      skin_focus: s(f, 'skin_focus'),
      preferred_look: s(f, 'preferred_look'),
      effort: s(f, 'effort'),
      sensitivities: s(f, 'sensitivities'),
      dislikes: s(f, 'dislikes'),
      version: s(f, 'version'),
    });
    revalidatePath('/app/grooming');
    return { error: '' };
  } catch {
    return {
      error:
        'Could not save. Your draft is retained. If the profile changed elsewhere, reload before trying again.',
    };
  }
}
