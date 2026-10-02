import { deriveCommand, emptyArrival, type CommandData } from '@/domains/daily-command/model';
export const commandFixture: CommandData = {
  mode: 'personal',
  ownerId: '20000000-0000-4000-8000-000000000001',
  arrival: emptyArrival,
  record: null,
  yesterday: null,
  snapshot: deriveCommand({
    day: '2026-10-02',
    arrival: { ...emptyArrival, sleepMinutes: 450, energy: 4, soreness: 'mild' },
    signals: [
      {
        family: 'recovery',
        source: 'user-reported',
        day: '2026-10-02',
        detail: 'Sleep reported: 450 minutes',
      },
    ],
    recentTraining: [{ day: '2026-10-01', sets: 10, effort: 7, pain: false }],
    water: 600,
    waterTarget: 2000,
    priority: 'Finish the proposal',
    blocker: 'Confirm scope',
    goal: 'Launch deliberately',
    ritual: 'Morning grooming ritual',
    occasion: null,
    unavailable: [],
  }),
};
