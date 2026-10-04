import { describe, expect, it } from 'vitest';
import { sampleData } from '../src/domains/daily/model';
import { projectCommand } from '../src/domains/command/projection';
import { autonomyFor } from '../src/domains/command/autonomy';
describe('saved Command projection', () => {
  it('uses saved action order without claiming AI prioritization', () => {
    const p = projectCommand(sampleData('2026-09-21'));
    expect(p.move.title).toBe('Give the most important project 45 focused minutes');
    expect(p.move.source).toContain('saved order');
    expect(p.signals.map((s) => s.kind)).toEqual(['direction', 'actions', 'energy']);
  });
  it('keeps absent observations absent and has no invented signals', () => {
    const p = projectCommand({ ...sampleData('2026-09-21'), entries: [], goal: null });
    expect(p.signals).toEqual([]);
    expect(p.trajectory.every((p) => p.energy === null)).toBe(true);
  });
  it('preserves gaps rather than connecting missing readings', () => {
    expect(projectCommand(sampleData('2026-09-21')).trajectory[2]?.energy).toBeNull();
  });
  it('does not claim zero pending decisions when their read failed', () => {
    expect(
      projectCommand({ ...sampleData('2026-09-21'), mode: 'personal', decisionsAvailable: false })
        .decisionsAvailable,
    ).toBe(false);
  });
  it('carries only saved review text as the next move', () => {
    const p = projectCommand({
      ...sampleData('2026-09-21'),
      entries: [],
      carryForward: {
        day: '2026-09-20',
        tomorrow: 'Write first',
        reflection: '',
        blocker: '',
        unfinished: [],
      },
    });
    expect(p.move.title).toBe('Write first');
    expect(p.move.source).toContain('confirmed review');
  });
  it('denies unknown and unauthorized work', () => {
    expect(autonomyFor('send_everything', true).allowed).toBe(false);
    expect(autonomyFor('assemble_briefing', false).allowed).toBe(false);
    expect(autonomyFor('write_memory', true).level).toBe('approve');
  });
});
