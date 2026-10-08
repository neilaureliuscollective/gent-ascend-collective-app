import type { DeliverableVersion } from '@/domains/missions/deliverable-schema';
type Draft = { title: string; body: string; acceptance: string };
type Entry = { base: string; draft: Draft; note: string; at: number };
const drafts = new Map<string, Entry>();
let owner: string | undefined;
/** Bounded in-memory route recovery. Never storage, URLs, logs or model context. */
export function recoverDeliverableDraft(person: string, id: string) {
  if (owner !== person) {
    drafts.clear();
    owner = person;
  }
  for (const [key, value] of drafts) if (Date.now() - value.at > 30 * 60 * 1000) drafts.delete(key);
  return drafts.get(id);
}
export function retainDeliverableDraft(
  person: string,
  id: string,
  version: DeliverableVersion,
  draft: Draft,
  note: string,
) {
  recoverDeliverableDraft(person, id);
  if (
    !note &&
    draft.title === version.title &&
    draft.body === version.body &&
    draft.acceptance === version.acceptance
  ) {
    drafts.delete(id);
    return;
  }
  drafts.delete(id);
  drafts.set(id, { base: version.id, draft, note, at: Date.now() });
  while (drafts.size > 3) drafts.delete(drafts.keys().next().value!);
}
export function clearDeliverableDraft(id: string) {
  drafts.delete(id);
}
