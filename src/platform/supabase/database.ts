import type { DayEntry, DayAction, DailyReview } from '@/domains/daily/model';
import type { Conversation, Turn, Memory, ActionProposal } from '@/domains/intelligence/types';
import type { FactKey } from '@/domains/ascend-profile/schema';
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
      ai_action_proposals: Table<ActionProposal,never,never>;
      ascend_profile_facts: Table<{
        person_id: string; fact_key: FactKey; value: string | null; version: number;
        source_kind: 'user' | 'ai_proposal'; source_excerpt: string | null; confirmed_at: string;
      }, never, never>;
      ascend_profile_revisions: Table<{
        request_id: string; person_id: string; fact_key: FactKey; old_value: string | null;
        new_value: string | null; previous_version: number; new_version: number;
        source_kind: 'user' | 'ai_proposal'; source_excerpt: string | null; confirmed_at: string;
      }, never, never>;
      life_captures: Table<
        { id: string; person_id: string; content: string; kind: 'thought' | 'idea' | 'task' | 'decision'; status: 'inbox' | 'acted' | 'dismissed'; source: 'user'; created_at: string; updated_at: string },
        { id: string; person_id: string; content: string; kind: 'thought' | 'idea' | 'task' | 'decision' },
        { status?: 'inbox' | 'acted' | 'dismissed'; updated_at?: string }
      >;
      daily_entries: Table<Omit<DayEntry, 'actions'|'review'> & { person_id: string }, never, never>;
      daily_reviews: Table<DailyReview & {person_id:string;day:string},never,never>;
      daily_review_revisions: Table<DailyReview & {request_id:string;person_id:string;day:string},never,never>;
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
      founder_access: Table<
        { person_id: string; granted_at: string; grant_reason: string },
        never,
        never
      >;
      pilot_invitations: Table<{
        id: string; email: string; status: 'pending' | 'claimed' | 'revoked';
        person_id: string | null; created_at: string; claimed_at: string | null;
      }, never, never>;
      pilot_feedback: Table<{
        id: string; person_id: string; category: 'friction' | 'idea' | 'working';
        message: string; created_at: string;
      }, never, never>;
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
      pilot_reserve: { Args: { p_email: string }; Returns: string };
      pilot_claim: { Args: Record<string, never>; Returns: boolean };
      pilot_submit_feedback: { Args: { p_category: string; p_message: string }; Returns: string };
      daily_confirm_review: {Args:{p_request:string;p_day:string;p_expected_review_version:number;p_source_day_version:number;p_progress:string;p_blocker:string;p_tomorrow:string};Returns:number};
      ai_propose_daily_action:{Args:{p_id:string;p_turn:string;p_title:string};Returns:string};
      ai_decide_daily_action:{Args:{p_id:string;p_approve:boolean};Returns:string|null};
      ai_reserve_proposal: { Args: { p_request: string }; Returns: boolean };
      ascend_profile_confirm: { Args: {
        p_request: string; p_key: FactKey; p_value: string | null; p_expected_version: number;
        p_source_kind: string; p_excerpt: string | null;
      }; Returns: number };
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
