import type { DayEntry, DayAction } from '@/domains/daily/model';
import type { Conversation, Turn, Memory } from '@/domains/intelligence/types';
// Initial migration contract. Replace with CLI-generated types after a validated
// local Supabase reset; this file deliberately describes only shipped tables.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type Table<Row, Insert, Update, Relations extends Relationship[] = Relationship[]> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relations;
};
export type PersonRow = {
  id: string;
  auth_user_id: string;
  display_name: string;
  timezone: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  priority: string;
  unit_system: 'metric' | 'imperial';
};
export type MembershipRow = {
  person_id: string;
  tier: 'free' | 'aurelius' | 'health';
  billing_state:
    'none' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'paused';
  beta_access: boolean;
  trial_ends_at: string | null;
  access_until: string | null;
  updated_at: string;
};
export type GoalRow = {
  id: string;
  person_id: string;
  title: string;
  domain: 'body' | 'mind' | 'life';
  reason: string;
  next_step: string;
  target_date: string | null;
  status: 'active' | 'completed' | 'archived';
  version: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
export interface Database {
  public: {
    Tables: {
      daily_entries: Table<Omit<DayEntry, 'actions'> & { person_id: string }, never, never>;
      daily_actions: Table<
        DayAction & { person_id: string; day: string; position: number },
        never,
        never,
        [
          {
            foreignKeyName: 'daily_actions_entry_fkey';
            columns: ['person_id', 'day'];
            isOneToOne: false;
            referencedRelation: 'daily_entries';
            referencedColumns: ['person_id', 'day'];
          },
        ]
      >;
      ai_conversations: Table<Conversation, never, never>;
      ai_turns: Table<Turn, never, { feedback: Turn['feedback'] }>;
      ai_memories: Table<Memory, never, never>;
      ai_usage: Table<
        {
          id: string;
          person_id: string;
          created_at: string;
          input_tokens: number | null;
          output_tokens: number | null;
        },
        never,
        never
      >;
      persons: Table<
        PersonRow,
        never,
        Partial<
          Pick<
            PersonRow,
            'display_name' | 'timezone' | 'onboarding_completed' | 'unit_system' | 'priority'
          >
        >
      >;
      goals: Table<
        GoalRow,
        Pick<
          GoalRow,
          'id' | 'person_id' | 'title' | 'domain' | 'reason' | 'next_step' | 'target_date'
        >,
        Partial<
          Pick<GoalRow, 'title' | 'domain' | 'reason' | 'next_step' | 'target_date' | 'status'>
        >
      >;
      membership_accounts: Table<MembershipRow, never, never>;
      personal_events: Table<
        {
          id: string;
          person_id: string;
          kind: string;
          version: number;
          occurred_at: string;
          recorded_at: string;
          source: string;
          source_record_id: string | null;
          goal_id: string | null;
        },
        never,
        never
      >;
    };
    Views: Record<string, never>;
    Functions: {
      daily_save: {
        Args: {
          p_day: string;
          p_version: number;
          p_energy: number | null;
          p_sleep: number | null;
          p_intention: string;
          p_reflection: string;
          p_actions: DayAction[];
        };
        Returns: number;
      };
      ai_begin_turn: {
        Args: {
          p_conversation: string;
          p_request: string;
          p_text: string;
          p_model: string;
          p_context: boolean;
          p_prompt_version: string;
        };
        Returns: string;
      };
      ai_finish_turn: {
        Args: {
          p_request: string;
          p_text: string;
          p_status: string;
          p_input?: number | null;
          p_output?: number | null;
        };
        Returns: boolean;
      };
      ai_save_memory: {
        Args: { p_id: string; p_content: string; p_kind: string; p_version: number };
        Returns: number;
      };
      ai_delete_memory: { Args: { p_id: string; p_version: number }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
