import { describe, expect, it } from 'vitest';
import {
  defaultRecoveryDatabase,
  quoteDisposableDatabase,
  recoveryTarget,
} from '../scripts/talk-import-recovery-target.mjs';

describe('Talk import-recovery target guards', () => {
  it('quotes only a lowercase disposable identifier', () => {
    expect(quoteDisposableDatabase(defaultRecoveryDatabase)).toBe('"talk_import_recovery"');
    expect(() => quoteDisposableDatabase('postgres')).toThrow(/system or application/);
    expect(() => quoteDisposableDatabase('template1')).toThrow(/system or application/);
    expect(() => quoteDisposableDatabase('Talk_Import')).toThrow(/lowercase identifier/);
    expect(() => quoteDisposableDatabase('drop database;')).toThrow(/lowercase identifier/);
  });

  it('accepts only loopback Supabase PostgreSQL 54322', () => {
    expect(recoveryTarget({}).host).toBe('127.0.0.1');
    expect(recoveryTarget({}).port).toBe(54322);
    expect(recoveryTarget({}).quotedDatabase).toBe('"talk_import_recovery"');
    expect(() => recoveryTarget({ TALK_IMPORT_RECOVERY_HOST: 'db.supabase.co' })).toThrow(/loopback/);
    expect(() => recoveryTarget({ TALK_IMPORT_RECOVERY_PORT: '5432' })).toThrow(/54322/);
    expect(() =>
      recoveryTarget({ DATABASE_URL: 'postgresql://postgres:postgres@db.example.com:54322/postgres' }),
    ).toThrow(/hosted or application/);
    expect(() => recoveryTarget({ PGHOST: 'volpzkfsnmtztrovexcw.supabase.co' })).toThrow(/loopback/);
    expect(() => recoveryTarget({ TALK_IMPORT_RECOVERY_DB: 'postgres' })).toThrow(/system or application/);
  });
});
