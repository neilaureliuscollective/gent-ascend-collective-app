import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { memoryStore } from '../src/domains/connections/store';
import {
  architectCommitDeployment,
  architectConnectionReadiness,
} from '../src/domains/connections/architect';
import { describeConnections } from '../src/domains/connections/service';
import { connectedEnv, owner } from './connections-support';

describe('Architect connection contract', () => {
  it('never reports ready from configuration alone and does not start work', async () => {
    const store = memoryStore();
    const board = await describeConnections(owner, store, connectedEnv);
    expect(['disconnected', 'setup_required']).toContain(board.github.status);
    expect(board.github.status).not.toBe('connected');
    expect(board.vercel.status).not.toBe('connected');
    const ready = await architectConnectionReadiness(owner, store, connectedEnv);
    expect(ready.github.ready).toBe(false);
    expect(ready.vercel.ready).toBe(false);
    expect(ready.github.repository).toBeNull();
  });

  it('rejects stale or forged commit deployments', async () => {
    const store = memoryStore();
    await expect(
      architectCommitDeployment(owner, store, 'a'.repeat(40), connectedEnv),
    ).rejects.toMatchObject({ code: 'invalid' });
  });
});
