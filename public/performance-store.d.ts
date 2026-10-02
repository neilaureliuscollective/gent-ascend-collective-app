import type { Session } from '../src/domains/performance/schema';
export type DeviceDraft = {
  owner: string;
  draft: Session;
  baseVersion: number;
  revision: number;
  syncedRevision: number;
  pending: {
    kind: 'session';
    owner: string;
    requestId: string;
    expectedVersion: number;
    payload: Session;
    revision: number;
  } | null;
  savedAt: number;
};
export function readDraft(owner: string): Promise<DeviceDraft | null>;
export function currentDraft(): Promise<DeviceDraft | null>;
export function beginDraft(
  owner: string,
  draft: Session,
  baseVersion?: number,
): Promise<DeviceDraft>;
export function writeDraft(
  owner: string,
  draft: Session,
  expectedRevision: number,
): Promise<DeviceDraft>;
export function forgetDraft(owner: string): Promise<null>;
export function clearDrafts(): Promise<void>;
export function isolateOwner(owner: string): Promise<void>;
export function syncDraft(owner: string): Promise<DeviceDraft | null>;
