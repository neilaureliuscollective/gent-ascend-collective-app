import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const postgresReady = spawnSync('pg_isready', { encoding: 'utf8' }).status === 0;

describe('Talk Origin unique-violation recovery (real PostgreSQL)', () => {
  it.skipIf(!postgresReady)(
    'exercises normal import, replay, unique-violation recovery and owner isolation without disabling ambiguity checks',
    () => {
      const result = spawnSync('node', ['scripts/verify-talk-origin-import-recovery.mjs'], {
        encoding: 'utf8',
      });
      expect(result.status, result.stderr || result.stdout).toBe(0);
      const receipt = JSON.parse(result.stdout) as {
        engine: string;
        variableConflict: string;
        historicalAmbiguity: boolean;
        normalImport: boolean;
        sameRequestReplay: boolean;
        uniqueViolationRecovery: boolean;
        foreignOwnerRejected: boolean;
        failedRecoveryUnchanged: boolean;
        historicalFileUnchanged: boolean;
      };
      expect(receipt.engine).toMatch(/^PostgreSQL 1[6-9]/);
      expect(receipt.variableConflict).toBe('error');
      expect(receipt.historicalAmbiguity).toBe(true);
      expect(receipt.normalImport).toBe(true);
      expect(receipt.sameRequestReplay).toBe(true);
      expect(receipt.uniqueViolationRecovery).toBe(true);
      expect(receipt.foreignOwnerRejected).toBe(true);
      expect(receipt.failedRecoveryUnchanged).toBe(true);
      expect(receipt.historicalFileUnchanged).toBe(true);
    },
  );
});
