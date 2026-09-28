import type { DayEntry, DayAction, DailyReview } from '@/domains/daily/model';
import type { Conversation, Turn, Memory, ActionProposal, ChatMessage } from '@/domains/intelligence/types';
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
      grooming_profiles: Table<{person_id:string;hair_focus:string;beard_focus:string;skin_focus:string;morning_ritual:string;evening_ritual:string;preferred_look:string;effort:'simple'|'considered'|'detailed';sensitivities:string;dislikes:string;version:number;updated_at:string},{person_id:string;hair_focus?:string;beard_focus?:string;skin_focus?:string;morning_ritual?:string;evening_ritual?:string;preferred_look?:string;effort?:'simple'|'considered'|'detailed';sensitivities?:string;dislikes?:string},{hair_focus?:string;beard_focus?:string;skin_focus?:string;morning_ritual?:string;evening_ritual?:string;preferred_look?:string;effort?:'simple'|'considered'|'detailed';sensitivities?:string;dislikes?:string}>;
      grooming_goals: Table<{id:string;person_id:string;title:string;target_date:string|null;status:'active'|'completed'|'archived';created_at:string},{person_id:string;title:string;target_date?:string|null},{status?:'active'|'completed'|'archived'}>;
      grooming_rituals: Table<{id:string;person_id:string;kind:'morning'|'evening'|'weekly';title:string;steps:string;version:number;active:boolean;created_at:string},never,never>;
      grooming_checkins: Table<{id:string;person_id:string;ritual_id:string;done:boolean;note:string;occurred_at:string},{person_id:string;ritual_id:string;done:boolean;note?:string},never>;
      grooming_products: Table<{id:string;person_id:string;name:string;category:'hair'|'beard'|'skin'|'other';relation:'owned'|'tried'|'favorite'|'stopped';shopify_handle:string|null;note:string;created_at:string},{person_id:string;name:string;category:'hair'|'beard'|'skin'|'other';relation:'owned'|'tried'|'favorite'|'stopped';shopify_handle?:string|null;note?:string},never>;
      grooming_looks: Table<{id:string;person_id:string;title:string;detail:string;kind:'target'|'service';service_date:string|null;created_at:string},{person_id:string;title:string;detail:string;kind:'target'|'service';service_date?:string|null},never>;
      grooming_events: Table<{id:string;person_id:string;title:string;event_date:string;note:string;created_at:string},{person_id:string;title:string;event_date:string;note:string},never>;
      grooming_scans: Table<{id:string;person_id:string;status:'pending'|'complete'|'rejected'|'failed';consented_at:string;created_at:string;completed_at:string|null;provider_version:string|null;quality_note:string;summary:string;next_step:string},never,never>;
      grooming_photos: Table<{id:string;person_id:string;scan_id:string|null;storage_key:string;view:'front'|'left'|'right'|'hair';note:string;captured_on:string;media_type:string;byte_size:number;created_at:string},{id:string;person_id:string;scan_id?:string|null;storage_key:string;view:'front'|'left'|'right'|'hair';note:string;captured_on:string;media_type:string;byte_size:number},never>;
      grooming_scan_observations: Table<{id:string;person_id:string;scan_id:string;area:'skin'|'hair'|'beard';description:string;confidence:'low'|'medium'|'high';source_version:string;created_at:string},never,never>;
      grooming_look_previews: Table<{id:string;person_id:string;source_photo_id:string|null;category:'hair'|'beard';style_id:string;title:string;note:string;saved_at:string|null;status:'pending'|'complete'|'failed';storage_key:string|null;created_at:string},never,{title?:string;note?:string;saved_at?:string}>;
      grooming_professional_passes: Table<{id:string;person_id:string;professional_user_id:string|null;label:string;direction:string;hair:string;beard:string;preferences:string;avoid:string;target_title:string;target_detail:string;note:string;created_at:string;expires_at:string;claimed_at:string|null;revoked_at:string|null},{id:string;person_id:string;label:string;direction:string;hair:string;beard:string;preferences:string;avoid:string;target_title:string;target_detail:string;note:string;expires_at:string},{revoked_at:string}>;
      grooming_service_proposals: Table<{id:string;pass_id:string;person_id:string;professional_user_id:string;service_date:string;title:string;detail:string;return_note:string;status:'pending'|'accepted'|'declined';created_at:string;decided_at:string|null},never,never>;
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
      ai_studio_projects: Table<{
        id:string;person_id:string;title:string;creative_type:'open'|'brand'|'campaign'|'product'|'personal';
        brief:{purpose?:string;audience?:string;direction?:string;palette?:string;avoid?:string};created_at:string;updated_at:string
      },{id:string;person_id:string;title:string;creative_type?:'open'|'brand'|'campaign'|'product'|'personal'},
        {title?:string;creative_type?:'open'|'brand'|'campaign'|'product'|'personal';brief?:{purpose:string;audience:string;direction:string;palette:string;avoid:string};updated_at?:string}>;
      ai_studio_references: Table<{
        id:string;person_id:string;project_id:string;storage_key:string;media_type:string;byte_size:number;created_at:string
      },{id:string;person_id:string;project_id:string;storage_key:string;media_type:string;byte_size:number},never>;
      ai_studio_versions: Table<{
        id:string;person_id:string;project_id:string;parent_id:string|null;reference_id:string|null;
        prompt:string;model:string;image_size:string;status:'pending'|'complete'|'failed';
        storage_key:string|null;failure_code:string|null;created_at:string;completed_at:string|null
      },never,never>;
      ai_studio_usage: Table<{id:string;person_id:string;created_at:string},never,never>;
      ai_studio_scenes: Table<{
        id:string;person_id:string;project_id:string;position:number;title:string;message:string;
        visual_direction:string;motion_note:string;channel:'social'|'website'|'pitch'|'print';
        asset_version_id:string|null;created_at:string;updated_at:string
      },never,{title?:string;message?:string;visual_direction?:string;motion_note?:string;
        channel?:'social'|'website'|'pitch'|'print';asset_version_id?:string|null;updated_at?:string}>;
      ai_studio_finishes: Table<{
        id:string;person_id:string;project_id:string;version_id:string;format:'square'|'portrait'|'landscape';
        treatment:'editorial'|'centered'|'quiet';brand:string;headline:string;supporting:string;footer:string;
        focal_x:number;focal_y:number;updated_at:string
      },{person_id:string;project_id:string;version_id:string;format:'square'|'portrait'|'landscape';
        treatment:'editorial'|'centered'|'quiet';brand:string;headline:string;supporting:string;footer:string;focal_x:number;focal_y:number},
      {format?:'square'|'portrait'|'landscape';treatment?:'editorial'|'centered'|'quiet';brand?:string;
        headline?:string;supporting?:string;footer?:string;focal_x?:number;focal_y?:number;updated_at?:string}>;
      ai_turns: Table<Turn, never, { feedback: Turn['feedback'] }>;
      ai_messages: Table<ChatMessage, never, never>;
      ai_aux_usage: Table<{id:string;person_id:string;kind:'title'|'summary';created_at:string;input_tokens:number|null;output_tokens:number|null},never,never>;
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
      grooming_set_ritual:{Args:{p_kind:string;p_title:string;p_steps:string};Returns:string};
      grooming_begin_scan:{Args:{p_id:string};Returns:boolean};
      grooming_finish_scan:{Args:{p_id:string;p_status:string;p_quality:string;p_summary:string;p_next:string;p_observations:unknown};Returns:boolean};
      grooming_begin_look:{Args:{p_id:string;p_photo:string;p_category:string;p_style:string};Returns:boolean};
      grooming_finish_look:{Args:{p_id:string;p_status:string;p_key?:string|null};Returns:boolean};
      grooming_store_pass_code:{Args:{p_pass:string;p_hash:string};Returns:boolean};
      grooming_claim_pass:{Args:{p_hash:string};Returns:string|null};
      grooming_propose_service:{Args:{p_pass:string;p_id:string;p_date:string;p_title:string;p_detail:string;p_return:string};Returns:boolean};
      grooming_decide_service:{Args:{p_id:string;p_accept:boolean};Returns:boolean};
      ai_studio_begin: {Args:{p_id:string;p_project:string;p_parent:string|null;p_reference:string|null;p_prompt:string;p_model:string;p_size:string};Returns:boolean};
      ai_studio_finish: {Args:{p_id:string;p_status:string;p_key?:string|null;p_failure?:string|null};Returns:boolean};
      ai_studio_scene_create: {Args:{p_project:string;p_title:string;p_message:string;p_visual:string;p_motion:string;p_channel:string};Returns:string};
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
      ai_update_conversation: { Args: { p_id: string; p_title: string | null; p_archive: boolean | null }; Returns: boolean };
      ai_search_conversations: { Args: { p_query: string; p_limit?: number }; Returns: { id: string; title: string; updated_at: string; archived_at:string|null; excerpt: string }[] };
      ai_set_generated_title: { Args: {p_id:string;p_title:string}; Returns:boolean };
      ai_save_thread_summary: {Args:{p_id:string;p_summary:string;p_through:string;p_expected:string|null};Returns:boolean};
      ai_reserve_auxiliary: {Args:{p_id:string;p_kind:'title'|'summary'};Returns:boolean};
      ai_finish_auxiliary: {Args:{p_id:string;p_input:number|null;p_output:number|null};Returns:boolean};
      ai_begin_revision: {Args: {p_conversation:string;p_source:string;p_request:string;p_text:string;p_kind:string;p_model:string;p_context:boolean;p_prompt_version:string}; Returns:string};
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
