import type { Profile, Plan, Session, Program, Prescription } from './schema';
type Base = { person_id: string; version: number; updated_at: string };
export type ProfileRow = Base & Omit<Profile, 'daysPerWeek'> & { days_per_week: number };
export type PlanRow = Base & Plan;
export type CheckinRow = Base & {
  day: string;
  timezone: string;
  sleep_minutes: number | null;
  energy: number | null;
  soreness: 'none' | 'mild' | 'high' | null;
  weight: number | null;
  unit: 'kg' | 'lb';
  calories: number | null;
  protein: number | null;
  water_ml: number | null;
  nutrition_complete: boolean;
  source: 'user';
};
export type SessionRow = Base & {
  id: string;
  title: string;
  plan_version: number;
  started_at: string;
  ended_at: string | null;
  status: Session['status'];
  unit: 'kg' | 'lb';
  pain: boolean;
  note: string;
};
export type SetRow = {
  person_id: string;
  session_id: string;
  id: string;
  position: number;
  exercise_id: string;
  exercise: string;
  target_reps: number;
  target_load: number;
  reps: number | null;
  load: number | null;
  effort: number | null;
  done: boolean;
};

export type ProgramRow = Base & Program & { next_slot_id: string };
export type SessionContextRow = {
  person_id: string;
  session_id: string;
  program_version: number;
  slot_id: string;
  prescription: Prescription;
};
