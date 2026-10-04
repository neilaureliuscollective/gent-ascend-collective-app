'use client';
import { draftKey, validDraft, type DirectionDraft } from './model';
let memory: DirectionDraft | null = null;
let memoryOnly = false;
export function readDraft() {
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw && !memoryOnly) memory = null;
    if (raw) {
      memory = validDraft(JSON.parse(raw));
      if (!memory) localStorage.removeItem(draftKey);
    }
  } catch {
    /* Storage is optional; this tab retains the draft. */
  }
  memory = validDraft(memory);
  return memory;
}
export function writeDraft(draft: DirectionDraft) {
  memory = draft;
  let retained = false;
  try {
    localStorage.setItem(draftKey, JSON.stringify(draft));
    retained = true;
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  window.dispatchEvent(new Event('gent-direction-change'));
  return retained;
}
export function clearDraft(id?: string) {
  if (id && readDraft()?.id !== id) return;
  memory = null;
  memoryOnly = false;
  try {
    localStorage.removeItem(draftKey);
  } catch {}
  window.dispatchEvent(new Event('gent-direction-change'));
}
