import { hasVerifiedPremiumAuthority, UNVERIFIED_PREMIUM_DIRECTION } from './premium-authority';
import type { DesignDirectionReceipt } from './contract';

export class DesignDirectionStoreError extends Error {
  constructor(
    message: string,
    readonly code: 'conflict' | 'not_found' = 'conflict',
  ) {
    super(message);
  }
}

export type RetainedDirection = {
  request_id: string;
  person_id: string;
  project_id: string;
  revision: number;
  digest: string;
  receipt: DesignDirectionReceipt;
  started: false;
  source_kind: 'text-import' | 'talk-authorized' | 'pending';
  verified: boolean;
  created_at: string;
};

export type DesignDirectionStore = {
  retain(input: {
    requestId: string;
    personId: string;
    projectId: string;
    digest: string;
    receipt: DesignDirectionReceipt;
    sourceKind?: RetainedDirection['source_kind'];
    verified?: boolean;
  }): Promise<RetainedDirection>;
  read(personId: string, requestId: string): Promise<RetainedDirection | null>;
  readProject(personId: string, projectId: string): Promise<RetainedDirection | null>;
};

export class MemoryDesignDirectionStore implements DesignDirectionStore {
  rows = new Map<string, RetainedDirection>();

  async retain(input: Parameters<DesignDirectionStore['retain']>[0]) {
    if (input.receipt.content.designSnapshot && !hasVerifiedPremiumAuthority({ verified: input.verified, sourceKind: input.sourceKind, compatibleTextImport: input.receipt.content.compatibleTextImport }))
      throw new DesignDirectionStoreError(UNVERIFIED_PREMIUM_DIRECTION);
    const existing = this.rows.get(input.requestId);
    if (existing) {
      if (
        existing.person_id !== input.personId ||
        existing.project_id !== input.projectId ||
        existing.digest !== input.digest
      )
        throw new DesignDirectionStoreError(
          'Request already reserved with a different project or design receipt.',
        );
      return existing;
    }
    const sameProject = [...this.rows.values()].find(
      (row) => row.person_id === input.personId && row.project_id === input.projectId,
    );
    const row: RetainedDirection = {
      request_id: input.requestId,
      person_id: input.personId,
      project_id: input.projectId,
      revision: sameProject ? sameProject.revision : 1,
      digest: input.digest,
      receipt: input.receipt,
      started: false,
      source_kind: input.sourceKind ?? 'text-import',
      verified: input.verified ?? input.sourceKind === 'talk-authorized',
      created_at: new Date().toISOString(),
    };
    this.rows.set(input.requestId, row);
    return row;
  }

  async read(personId: string, requestId: string) {
    const row = this.rows.get(requestId);
    return row?.person_id === personId ? row : null;
  }

  async readProject(personId: string, projectId: string) {
    return (
      [...this.rows.values()]
        .filter((row) => row.person_id === personId && row.project_id === projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    );
  }
}
