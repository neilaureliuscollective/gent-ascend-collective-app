export interface PersonalEvent {
  id: string;
  personId: string;
  kind: string;
  version: number;
  occurredAt: string;
  recordedAt: string;
  source: 'user' | 'import' | 'derived' | 'provider';
  sourceRecordId: string | null;
}
