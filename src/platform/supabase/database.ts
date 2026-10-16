import type {
  ProfileRow,
  ProgramRow,
  SessionContextRow,
  PlanRow,
  CheckinRow,
  SessionRow,
  SetRow,
} from '@/domains/performance/rows';
import type { FuelTargets, RecoveryRoutine, Movement } from '@/domains/performance/schema';
import type { DayEntry, DayAction, DailyReview } from '@/domains/daily/model';
import type {
  Conversation,
  Turn,
  Memory,
  ActionProposal,
  ChatMessage,
} from '@/domains/intelligence/types';
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
  tier: 'free' | 'aurelius' | 'health' | 'essential' | 'signature' | 'reserve';
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
      architect_origin_projects: Table<
        import('@/domains/architect-origin/schema').OriginProject,
        never,
        never
      >;
      architect_origin_versions: Table<
        import('@/domains/architect-origin/schema').OriginVersion,
        never,
        never
      >;
      architect_origin_runs: Table<
        import('@/domains/architect-origin/schema').OriginRun & { payload: unknown },
        never,
        never
      >;
      architect_origin_tools: Table<
        import('@/domains/architect-tools/schema').SavedEstimatorTool,
        never,
        never
      >;
      architect_origin_tool_versions: Table<
        import('@/domains/architect-tools/schema').SavedEstimatorVersion,
        never,
        never
      >;
      architect_origin_tool_invocations: Table<
        import('@/domains/architect-tools/schema').SavedEstimatorInvocation,
        never,
        never
      >;
      architect_construct_sources: Table<
        import('@/domains/architect-construct/schema').SourceSnapshot,
        never,
        never
      >;
      architect_construct_briefs: Table<
        import('@/domains/architect-construct/schema').ConstructBrief & {
          project_id: string;
          project_revision: number;
          source_id: string;
        },
        never,
        never
      >;
      architect_construct_runs: Table<
        import('@/domains/architect-construct/schema').ConstructRun,
        never,
        never
      >;
      architect_construct_events: Table<
        import('@/domains/architect-construct/schema').ConstructEvent,
        never,
        never
      >;
      architect_apps: Table<
        import('@/domains/architect-apps/schema').ArchitectApp,
        never,
        never
      >;
      architect_app_revisions: Table<
        import('@/domains/architect-apps/schema').AppRevision,
        never,
        never
      >;
      architect_app_artifacts: Table<
        import('@/domains/architect-apps/schema').AppArtifact,
        never,
        never
      >;
      architect_app_jobs: Table<
        import('@/domains/architect-apps/schema').AppJob,
        never,
        never
      >;
      architect_app_events: Table<
        import('@/domains/architect-apps/schema').AppEvent,
        never,
        never
      >;
      architect_app_records: Table<
        import('@/domains/architect-apps/schema').AppRecord,
        never,
        never
      >;
      architect_design_directions: Table<
        import('@/domains/architect-design-direction/store').RetainedDirection,
        never,
        never
      >;
      intelligence_missions: Table<
        import('@/domains/missions/schema').Mission,
        Omit<import('@/domains/missions/schema').Mission, 'revision' | 'created_at' | 'updated_at'>,
        Partial<import('@/domains/missions/schema').Mission>
      >;
      company_turn_context: Table<
        {
          request_id: string;
          person_id: string;
          company_id: string;
          name: string;
          brief: string;
          version: number;
          confirmed_at: string;
        },
        never,
        never
      >;
      company_jobs: Table<import('@/domains/company-work/schema').WorkJob, never, never>;
      company_work_versions: Table<
        import('@/domains/company-work/schema').WorkVersion,
        never,
        never
      >;
      companies: Table<
        import('@/domains/companies/schema').Company,
        { id: string; person_id: string; name: string; brief: string },
        { name: string; brief: string; version: number; confirmed_at: string }
      >;
      daily_command_records: Table<
        import('@/domains/daily-command/model').CommandRecord,
        never,
        never
      >;
      proactive_signal_receipts: Table<
        {
          person_id: string;
          signal_key: string;
          disposition: 'opened' | 'dismissed';
          handled_at: string;
          expires_at: string;
        },
        {
          person_id: string;
          signal_key: string;
          disposition: 'opened' | 'dismissed';
          handled_at?: string;
          expires_at: string;
        },
        {
          disposition?: 'opened' | 'dismissed';
          handled_at?: string;
          expires_at?: string;
        }
      >;
      onboarding_claims: Table<
        {
          person_id: string;
          request_id: string;
          focus: 'body' | 'presence' | 'focus';
          day: string;
          intention: string;
          created_at: string;
        },
        never,
        never
      >;
      performance_programs: Table<ProgramRow, never, never>;
      performance_session_context: Table<SessionContextRow, never, never>;
      performance_profiles: Table<ProfileRow, never, never>;
      performance_plans: Table<PlanRow, never, never>;
      performance_checkins: Table<CheckinRow, never, never>;
      performance_sessions: Table<SessionRow, never, never>;
      performance_sets: Table<SetRow, never, never>;
      ai_action_proposals: Table<ActionProposal, never, never>;
      ascend_profile_facts: Table<
        {
          person_id: string;
          fact_key: FactKey;
          value: string | null;
          version: number;
          source_kind: 'user' | 'ai_proposal';
          source_excerpt: string | null;
          confirmed_at: string;
        },
        never,
        never
      >;
      ascend_profile_revisions: Table<
        {
          request_id: string;
          person_id: string;
          fact_key: FactKey;
          old_value: string | null;
          new_value: string | null;
          previous_version: number;
          new_version: number;
          source_kind: 'user' | 'ai_proposal';
          source_excerpt: string | null;
          confirmed_at: string;
        },
        never,
        never
      >;
      grooming_profiles: Table<
        {
          person_id: string;
          hair_focus: string;
          beard_focus: string;
          skin_focus: string;
          morning_ritual: string;
          evening_ritual: string;
          preferred_look: string;
          effort: 'simple' | 'considered' | 'detailed';
          sensitivities: string;
          dislikes: string;
          version: number;
          updated_at: string;
        },
        {
          person_id: string;
          hair_focus?: string;
          beard_focus?: string;
          skin_focus?: string;
          morning_ritual?: string;
          evening_ritual?: string;
          preferred_look?: string;
          effort?: 'simple' | 'considered' | 'detailed';
          sensitivities?: string;
          dislikes?: string;
        },
        {
          hair_focus?: string;
          beard_focus?: string;
          skin_focus?: string;
          morning_ritual?: string;
          evening_ritual?: string;
          preferred_look?: string;
          effort?: 'simple' | 'considered' | 'detailed';
          sensitivities?: string;
          dislikes?: string;
        }
      >;
      grooming_goals: Table<
        {
          id: string;
          person_id: string;
          title: string;
          target_date: string | null;
          status: 'active' | 'completed' | 'archived';
          created_at: string;
        },
        { person_id: string; title: string; target_date?: string | null },
        { status?: 'active' | 'completed' | 'archived' }
      >;
      grooming_rituals: Table<
        {
          id: string;
          person_id: string;
          kind: 'morning' | 'evening' | 'weekly';
          title: string;
          steps: string;
          version: number;
          active: boolean;
          created_at: string;
        },
        never,
        never
      >;
      grooming_checkins: Table<
        {
          id: string;
          person_id: string;
          ritual_id: string;
          done: boolean;
          note: string;
          occurred_at: string;
          local_day: string | null;
        },
        { id?: string; person_id: string; ritual_id: string; done: boolean; note?: string },
        never
      >;
      grooming_products: Table<
        import('@/domains/commerce/cabinet-model').CabinetRow,
        {
          id?: string;
          person_id: string;
          name: string;
          category: 'hair' | 'beard' | 'skin' | 'other';
          relation: import('@/domains/commerce/cabinet-model').CabinetRelation;
          catalog_product_id?: string | null;
          shopify_handle?: string | null;
          note?: string;
        },
        {
          relation?: import('@/domains/commerce/cabinet-model').CabinetRelation;
          note?: string;
          ritual_id?: string | null;
        }
      >;
      grooming_looks: Table<
        {
          id: string;
          person_id: string;
          title: string;
          detail: string;
          kind: 'target' | 'service';
          service_date: string | null;
          created_at: string;
        },
        {
          person_id: string;
          title: string;
          detail: string;
          kind: 'target' | 'service';
          service_date?: string | null;
        },
        never
      >;
      grooming_events: Table<
        {
          id: string;
          person_id: string;
          title: string;
          event_date: string;
          note: string;
          created_at: string;
        },
        { person_id: string; title: string; event_date: string; note: string },
        never
      >;
      grooming_scans: Table<
        {
          id: string;
          person_id: string;
          status: 'pending' | 'complete' | 'rejected' | 'failed';
          consented_at: string;
          created_at: string;
          completed_at: string | null;
          provider_version: string | null;
          quality_note: string;
          summary: string;
          next_step: string;
        },
        never,
        never
      >;
      grooming_photos: Table<
        {
          id: string;
          person_id: string;
          scan_id: string | null;
          storage_key: string;
          view: 'front' | 'left' | 'right' | 'hair';
          note: string;
          captured_on: string;
          media_type: string;
          byte_size: number;
          created_at: string;
        },
        {
          id: string;
          person_id: string;
          scan_id?: string | null;
          storage_key: string;
          view: 'front' | 'left' | 'right' | 'hair';
          note: string;
          captured_on: string;
          media_type: string;
          byte_size: number;
        },
        never
      >;
      grooming_scan_observations: Table<
        {
          id: string;
          person_id: string;
          scan_id: string;
          area: 'skin' | 'hair' | 'beard';
          description: string;
          confidence: 'low' | 'medium' | 'high';
          source_version: string;
          created_at: string;
        },
        never,
        never
      >;
      grooming_look_previews: Table<
        {
          id: string;
          person_id: string;
          source_photo_id: string | null;
          category: 'hair' | 'beard';
          style_id: string;
          title: string;
          note: string;
          saved_at: string | null;
          status: 'pending' | 'complete' | 'failed';
          storage_key: string | null;
          created_at: string;
        },
        never,
        { title?: string; note?: string; saved_at?: string }
      >;
      grooming_professional_passes: Table<
        {
          id: string;
          person_id: string;
          professional_user_id: string | null;
          label: string;
          direction: string;
          hair: string;
          beard: string;
          preferences: string;
          avoid: string;
          target_title: string;
          target_detail: string;
          note: string;
          created_at: string;
          expires_at: string;
          claimed_at: string | null;
          revoked_at: string | null;
        },
        {
          id: string;
          person_id: string;
          label: string;
          direction: string;
          hair: string;
          beard: string;
          preferences: string;
          avoid: string;
          target_title: string;
          target_detail: string;
          note: string;
          expires_at: string;
        },
        { revoked_at: string }
      >;
      grooming_service_proposals: Table<
        {
          id: string;
          pass_id: string;
          person_id: string;
          professional_user_id: string;
          service_date: string;
          title: string;
          detail: string;
          return_note: string;
          status: 'pending' | 'accepted' | 'declined';
          created_at: string;
          decided_at: string | null;
        },
        never,
        never
      >;
      billing_profiles: Table<import('@/domains/billing/policy').BillingSummary, never, never>;
      life_captures: Table<
        {
          id: string;
          person_id: string;
          content: string;
          kind: 'thought' | 'idea' | 'task' | 'decision';
          status: 'inbox' | 'acted' | 'dismissed';
          source: 'user';
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          person_id: string;
          content: string;
          kind: 'thought' | 'idea' | 'task' | 'decision';
        },
        { status?: 'inbox' | 'acted' | 'dismissed'; updated_at?: string }
      >;
      daily_entries: Table<
        Omit<DayEntry, 'actions' | 'review'> & { person_id: string },
        never,
        never
      >;
      daily_reviews: Table<DailyReview & { person_id: string; day: string }, never, never>;
      daily_review_revisions: Table<
        DailyReview & { request_id: string; person_id: string; day: string },
        never,
        never
      >;
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
      performance_movements: Table<
        {
          person_id: string;
          id: string;
          day: string;
          entry: Movement;
          version: number;
          updated_at: string;
        },
        never,
        never
      >;
      performance_movement_revisions: Table<
        {
          person_id: string;
          id: string;
          entry: Movement;
          version: number;
          request_id: string;
          fingerprint: string;
          recorded_at: string;
        },
        never,
        never
      >;
      performance_recovery_routines: Table<
        {
          person_id: string;
          day: string;
          timezone: string;
          routine: RecoveryRoutine;
          version: number;
          updated_at: string;
        },
        never,
        never
      >;
      performance_recovery_revisions: Table<
        {
          person_id: string;
          day: string;
          routine: RecoveryRoutine;
          version: number;
          request_id: string;
          fingerprint: string;
          recorded_at: string;
        },
        never,
        never
      >;
      performance_fuel_targets: Table<
        { person_id: string; targets: FuelTargets; version: number; updated_at: string },
        never,
        never
      >;
      performance_fuel_target_revisions: Table<
        {
          person_id: string;
          targets: FuelTargets;
          version: number;
          recorded_at: string;
          request_id: string;
          fingerprint: string;
        },
        never,
        never
      >;
      performance_progression_decisions: Table<
        {
          person_id: string;
          request_id: string;
          fingerprint: string;
          from_version: number;
          to_version: number;
          evidence: unknown;
          created_at: string;
        },
        never,
        never
      >;
      ai_talk_creations: Table<
        import('@/domains/talk-creation/schema').TalkCreation,
        never,
        never
      >;
      ai_talk_selection: Table<
        {
          person_id: string;
          conversation_id: string;
          kind: 'brief' | 'plan' | 'palette' | 'board';
          creation_id: string;
        },
        never,
        never
      >;
      ai_live_observed_items: Table<
        {
          person_id: string;
          session_id: string;
          conversation_id: string;
          provider_item_id: string;
          provider_response_id: string | null;
          intended_turn_id: string | null;
          created_at: string;
        },
        never,
        never
      >;
      ai_talk_direction_transfers: Table<
        {
          id: string;
          person_id: string;
          conversation_id: string;
          board_id: string;
          board_version: number;
          direction_id: string;
          direction_uuid: string;
          project_id: string;
          digest: string;
          receipt: unknown;
          imported: boolean;
          created_at: string;
        },
        never,
        never
      >;
      ai_talk_origin_imports: Table<
        {
          id: string;
          person_id: string;
          handoff_id: string;
          conversation_id: string;
          project_id: string;
          save_id: string;
          prepared_at: string;
          provenance: Record<string, unknown>;
          mapping_version: string;
          created_at: string;
        },
        never,
        never
      >;
      ai_conversation_artifacts: Table<
        import('@/domains/artifacts/contract').Artifact & {
          person_id: string;
          preview_key: string | null;
        },
        never,
        never
      >;
      ai_artifact_selection: Table<
        {
          person_id: string;
          conversation_id: string;
          artifact_id: string;
          part_id: string | null;
          scenario_percent: number;
        },
        never,
        never
      >;
      ai_live_jobs: Table<
        {
          id: string;
          person_id: string;
          session_id: string;
          conversation_id: string;
          call_id: string;
          task: string;
          coworker: string | null;
          status: string;
          result: string;
          input_tokens: number;
          output_tokens: number;
          duration_ms: number | null;
          created_at: string;
        },
        never,
        never
      >;
      ai_live_sessions: Table<
        {
          id: string;
          person_id: string;
          conversation_id: string | null;
          created_at: string;
          expires_at: string;
          ended_at: string | null;
          call_id: string | null;
          call_tag: string | null;
          model: string;
          reserved_seconds: number;
          input_tokens: number;
          output_tokens: number;
          reason: string | null;
        },
        never,
        never
      >;
      ai_conversations: Table<Conversation, never, never>;
      ai_studio_projects: Table<
        {
          id: string;
          person_id: string;
          company_id: string | null;
          job_id: string | null;
          title: string;
          creative_type: 'open' | 'brand' | 'campaign' | 'product' | 'personal';
          brief: Partial<import('@/domains/studio/brand').StudioBrief>;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          person_id: string;
          title: string;
          company_id?: string;
          job_id?: string;
          creative_type?: 'open' | 'brand' | 'campaign' | 'product' | 'personal';
          brief?: Partial<import('@/domains/studio/brand').StudioBrief>;
        },
        {
          title?: string;
          creative_type?: 'open' | 'brand' | 'campaign' | 'product' | 'personal';
          brief?: import('@/domains/studio/brand').StudioBrief;
          updated_at?: string;
        }
      >;
      ai_studio_references: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          storage_key: string;
          media_type: string;
          byte_size: number;
          created_at: string;
        },
        {
          id: string;
          person_id: string;
          project_id: string;
          storage_key: string;
          media_type: string;
          byte_size: number;
        },
        never
      >;
      ai_studio_versions: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          parent_id: string | null;
          reference_id: string | null;
          prompt: string;
          model: string;
          image_size: string;
          status: 'pending' | 'complete' | 'failed';
          storage_key: string | null;
          failure_code: string | null;
          created_at: string;
          completed_at: string | null;
        },
        never,
        never
      >;
      ai_studio_usage: Table<{ id: string; person_id: string; created_at: string }, never, never>;
      ai_studio_scenes: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          position: number;
          title: string;
          message: string;
          visual_direction: string;
          motion_note: string;
          channel: 'social' | 'website' | 'pitch' | 'print';
          asset_version_id: string | null;
          created_at: string;
          updated_at: string;
        },
        never,
        {
          title?: string;
          message?: string;
          visual_direction?: string;
          motion_note?: string;
          channel?: 'social' | 'website' | 'pitch' | 'print';
          asset_version_id?: string | null;
          updated_at?: string;
        }
      >;
      ai_studio_narrations: Table<
        import('@/domains/studio/narration').NarrationRecord,
        never,
        never
      >;
      ai_studio_narration_usage: Table<
        { id: string; person_id: string; created_at: string },
        never,
        never
      >;
      ai_studio_finishes: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          version_id: string;
          format: 'square' | 'portrait' | 'landscape';
          treatment: 'editorial' | 'centered' | 'quiet';
          brand: string;
          headline: string;
          supporting: string;
          footer: string;
          focal_x: number;
          focal_y: number;
          updated_at: string;
        },
        {
          person_id: string;
          project_id: string;
          version_id: string;
          format: 'square' | 'portrait' | 'landscape';
          treatment: 'editorial' | 'centered' | 'quiet';
          brand: string;
          headline: string;
          supporting: string;
          footer: string;
          focal_x: number;
          focal_y: number;
        },
        {
          format?: 'square' | 'portrait' | 'landscape';
          treatment?: 'editorial' | 'centered' | 'quiet';
          brand?: string;
          headline?: string;
          supporting?: string;
          footer?: string;
          focal_x?: number;
          focal_y?: number;
          updated_at?: string;
        }
      >;
      ai_studio_designs: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          title: string;
          document: import('@/domains/studio/design/document').DesignDocument;
          revision: number;
          updated_at: string;
        },
        {
          id: string;
          person_id: string;
          project_id: string;
          title: string;
          document: import('@/domains/studio/design/document').DesignDocument;
        },
        {
          title?: string;
          document?: import('@/domains/studio/design/document').DesignDocument;
          revision?: number;
          updated_at?: string;
        }
      >;
      ai_studio_design_revisions: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          design_id: string;
          revision: number;
          kind: 'autosave' | 'explicit';
          document: import('@/domains/studio/design/document').DesignDocument;
          created_at: string;
        },
        never,
        { kind?: 'autosave' | 'explicit' }
      >;
      ai_studio_design_exports: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          design_id: string;
          revision_id: string;
          format: 'png' | 'svg' | 'pdf';
          storage_key: string;
          width_px: number;
          height_px: number;
          ppi: number;
          created_at: string;
        },
        never,
        never
      >;
      ai_studio_design_export_jobs: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          design_id: string;
          revision_id: string;
          format: 'png' | 'svg' | 'pdf';
          font_mode: 'embed' | 'outline';
          idempotency_key: string;
          status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled' | 'interrupted';
          lease_token: string | null;
          lease_until: string | null;
          failure_code: string | null;
          storage_key: string | null;
          export_id: string | null;
          width: number | null;
          height: number | null;
          ppi: number | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        },
        never,
        never
      >;
      ai_studio_compositions: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          title: string;
          document: import('@/domains/studio/composition/model').CompositionDocument;
          revision: number;
          updated_at: string;
        },
        {
          id: string;
          person_id: string;
          project_id: string;
          title: string;
          document: import('@/domains/studio/composition/model').CompositionDocument;
        },
        {
          title?: string;
          document?: import('@/domains/studio/composition/model').CompositionDocument;
          revision?: number;
          updated_at?: string;
        }
      >;
      ai_studio_composition_revisions: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          composition_id: string;
          revision: number;
          kind: 'autosave' | 'explicit';
          document: import('@/domains/studio/composition/model').CompositionDocument;
          created_at: string;
        },
        never,
        { kind?: 'autosave' | 'explicit' }
      >;
      ai_studio_render_jobs: Table<
        {
          id: string;
          person_id: string;
          project_id: string;
          composition_id: string;
          revision_id: string;
          idempotency_key: string;
          status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled' | 'interrupted';
          lease_token: string | null;
          lease_until: string | null;
          failure_code: string | null;
          storage_film: string | null;
          storage_cover: string | null;
          storage_captions: string | null;
          width: number | null;
          height: number | null;
          duration_ms: number | null;
          retry_count: number;
          created_at: string;
          updated_at: string;
        },
        never,
        never
      >;
      ai_studio_footage: Table<import('@/domains/studio/footage').FootageJob, never, never>;
      ai_turns: Table<Turn, never, { feedback: Turn['feedback'] }>;
      ai_messages: Table<ChatMessage, never, never>;
      ai_aux_usage: Table<
        {
          id: string;
          person_id: string;
          kind: 'title' | 'summary';
          created_at: string;
          input_tokens: number | null;
          output_tokens: number | null;
        },
        never,
        never
      >;
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
      service_connections: Table<
        {
          id: string;
          person_id: string;
          provider: 'github' | 'vercel';
          status:
            | 'setup_required'
            | 'disconnected'
            | 'connecting'
            | 'connected'
            | 'degraded'
            | 'expired'
            | 'revoked'
            | 'verification_failed';
          account_login: string | null;
          account_id: string | null;
          installation_id: string | null;
          selected_id: string | null;
          selected_name: string | null;
          capabilities: Record<string, unknown>;
          last_verified_at: string | null;
          last_error: string | null;
          user_authorization: 'active' | 'revoked' | null;
          created_at: string;
          updated_at: string;
        },
        never,
        never
      >;
      service_connection_secrets: Table<
        { connection_id: string; ciphertext: string; updated_at: string },
        never,
        never
      >;
      service_connection_flows: Table<
        {
          id: string;
          person_id: string;
          provider: 'github' | 'vercel';
          state: string;
          nonce: string;
          verifier: string;
          claimed_installation_id: string | null;
          expires_at: string;
          consumed_at: string | null;
          created_at: string;
        },
        never,
        never
      >;
      service_connection_events: Table<
        { provider: 'github' | 'vercel'; delivery_id: string; received_at: string },
        never,
        never
      >;
      pilot_invitations: Table<
        {
          id: string;
          email: string;
          status: 'pending' | 'claimed' | 'revoked';
          person_id: string | null;
          created_at: string;
          claimed_at: string | null;
        },
        never,
        never
      >;
      pilot_feedback: Table<
        {
          id: string;
          person_id: string;
          category: 'friction' | 'idea' | 'working';
          message: string;
          created_at: string;
        },
        never,
        never
      >;
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
      service_connection_begin_flow: {
        Args: {
          p_id: string;
          p_provider: string;
          p_state: string;
          p_nonce: string;
          p_verifier: string;
          p_expires: string;
        };
        Returns: boolean;
      };
      service_connection_read_flow: { Args: { p_state: string }; Returns: unknown };
      service_connection_claim_install: {
        Args: { p_person: string; p_state: string; p_installation: string };
        Returns: boolean;
      };
      service_connection_consume_flow: {
        Args: { p_state: string; p_consumed: string };
        Returns: boolean;
      };
      service_connection_read: { Args: { p_provider: string }; Returns: unknown };
      service_connection_list: { Args: Record<string, never>; Returns: unknown };
      service_connection_upsert: {
        Args: {
          p_person: string;
          p_id: string;
          p_provider: string;
          p_status: string;
          p_account_login: string | null;
          p_account_id: string | null;
          p_installation: string | null;
          p_selected_id: string | null;
          p_selected_name: string | null;
          p_capabilities: unknown;
          p_verified: string | null;
          p_error: string | null;
          p_user_authorization: string | null;
        };
        Returns: boolean;
      };
      service_connection_put_secret: {
        Args: { p_person: string; p_id: string; p_ciphertext: string };
        Returns: boolean;
      };
      service_connection_take_secret: {
        Args: { p_person: string; p_id: string };
        Returns: string | null;
      };
      service_connection_clear: { Args: { p_provider: string }; Returns: boolean };
      service_connection_set_selection: {
        Args: { p_provider: string; p_selected_id: string; p_selected_name: string };
        Returns: boolean;
      };
      service_connection_record_event: {
        Args: { p_provider: string; p_delivery: string };
        Returns: boolean;
      };
      service_connection_apply_status: {
        Args: { p_provider: string; p_installation: string; p_status: string; p_error: string | null };
        Returns: boolean;
      };
      service_connection_apply_account: {
        Args: { p_provider: string; p_account: string; p_status: string; p_error: string | null };
        Returns: boolean;
      };
      architect_origin_save: {
        Args: {
          p_project: string;
          p_request: string;
          p_expected: number;
          p_content: import('@/domains/architect-origin/schema').ProjectContent;
          p_note: string;
        };
        Returns: number;
      };
      architect_origin_begin: {
        Args: {
          p_project: string;
          p_request: string;
          p_expected: number;
          p_kind: string;
          p_instruction: string;
          p_payload: unknown;
        };
        Returns: boolean;
      };
      architect_origin_finish: { Args: { p_request: string; p_output: unknown }; Returns: boolean };
      architect_origin_tool_save: {
        Args: {
          p_tool: string;
          p_project: string;
          p_request: string;
          p_expected: number;
          p_name: string;
          p_config: import('@/domains/architect-tools/schema').SaveToolCommand['configuration'];
          p_note: string;
        };
        Returns: number;
      };
      architect_origin_tool_record_invocation: {
        Args: {
          p_id: string;
          p_tool: string;
          p_revision: number;
          p_inputs: unknown;
          p_result: unknown;
          p_source: string;
        };
        Returns: boolean;
      };
      architect_origin_tool_invoke: {
        Args: {
          p_id: string;
          p_project: string;
          p_tool: string;
          p_revision: number;
          p_inputs: unknown;
          p_source: string;
        };
        Returns: import('@/domains/architect-tools/engine').EstimatorResult;
      };
      architect_construct_import_source: {
        Args: {
          p_id: string;
          p_kind: string;
          p_repository: string | null;
          p_commit: string | null;
          p_label: string;
          p_tree: string;
          p_files: unknown;
        };
        Returns: boolean;
      };
      architect_construct_approve_brief: {
        Args: {
          p_id: string;
          p_project: string;
          p_expected: number;
          p_source: string;
          p_hash: string;
          p_scope: unknown;
        };
        Returns: boolean;
      };
      architect_construct_start: {
        Args: { p_project: string; p_request: string; p_brief: string; p_expected: number };
        Returns: boolean;
      };
      architect_construct_cancel: {
        Args: { p_project: string; p_run: string };
        Returns: boolean;
      };
      architect_construct_claim: { Args: { p_worker: string; p_lease: number }; Returns: string | null };
      architect_construct_finish: {
        Args: {
          p_worker: string;
          p_run: string;
          p_token: string;
          p_status: string;
          p_result: unknown;
        };
        Returns: boolean;
      };
      architect_construct_timeout: { Args: Record<string, never>; Returns: number };
      architect_construct_heartbeat: {
        Args: { p_worker: string; p_run: string; p_token: string; p_lease: number };
        Returns: boolean;
      };
      architect_construct_mark_running: {
        Args: { p_worker: string; p_run: string; p_token: string };
        Returns: boolean;
      };
      architect_construct_append_event: {
        Args: { p_worker: string; p_run: string; p_token: string; p_kind: string; p_detail: string };
        Returns: boolean;
      };
      architect_construct_invalidate_briefs: {
        Args: { p_project: string; p_reason: string };
        Returns: number;
      };
      health_export_history: { Args: Record<string, never>; Returns: unknown };
      health_read: { Args: Record<string, never>; Returns: unknown };
      health_mutate: {
        Args: { p_kind: string; p_request: string; p_payload: unknown };
        Returns: unknown;
      };
      company_begin_revision: {
        Args: {
          p_company: string;
          p_conversation: string;
          p_source: string;
          p_request: string;
          p_text: string;
          p_kind: string;
          p_model: string;
          p_prompt_version: string;
        };
        Returns: string;
      };
      company_create_job: {
        Args: {
          p_id: string;
          p_company: string;
          p_conversation: string;
          p_scope: import('@/domains/company-work/schema').WorkScope;
        };
        Returns: string;
      };
      company_save_work: {
        Args: {
          p_id: string;
          p_company: string;
          p_job: string;
          p_expected: number;
          p_content: import('@/domains/company-work/schema').WorkContent;
          p_source_turn: string | null;
        };
        Returns: string;
      };
      company_review_work: {
        Args: { p_company: string; p_job: string; p_version: string };
        Returns: string;
      };
      daily_command_save: {
        Args: {
          p_request: string;
          p_day: string;
          p_version: number;
          p_kind: string;
          p_arrival: import('@/domains/daily-command/model').Arrival;
          p_snapshot: import('@/domains/daily-command/model').DailyCommandSnapshot;
          p_outcome: import('@/domains/daily-command/model').DailyCommandOutcome | null;
        };
        Returns: number;
      };
      onboarding_claim: {
        Args: {
          p_request: string;
          p_focus: string;
          p_intention: string;
          p_timezone: string;
          p_created: string;
          p_replace: boolean;
          p_expected: number;
          p_day: string | null;
        };
        Returns: unknown;
      };
      performance_save_movement: {
        Args: { p_request: string; p_expected: number; p_entry: Movement };
        Returns: number;
      };
      performance_save_recovery_routine: {
        Args: { p_request: string; p_expected: number; p_routine: RecoveryRoutine };
        Returns: number;
      };
      performance_save_fuel_targets: {
        Args: { p_request: string; p_expected: number; p_targets: FuelTargets };
        Returns: number;
      };
      performance_outcomes: { Args: Record<string, never>; Returns: unknown };
      performance_progression: { Args: Record<string, never>; Returns: unknown };
      performance_progression_accept: {
        Args: { p_request: string; p_expected: number; p_slot: string; p_token: string };
        Returns: number;
      };
      performance_save: {
        Args: { p_kind: string; p_request: string; p_expected: number; p_payload: unknown };
        Returns: number;
      };
      ai_studio_footage_quote: {
        Args: {
          p_id: string;
          p_project: string;
          p_title: string;
          p_prompt: string;
          p_duration: number;
          p_ratio: string;
          p_expires: string;
          p_signature: string;
        };
        Returns: boolean;
      };
      ai_studio_footage_begin: { Args: { p_id: string }; Returns: boolean };
      ai_studio_footage_receipt: {
        Args: { p_id: string; p_provider?: string | null; p_signature?: string | null };
        Returns: boolean;
      };
      ai_studio_footage_check: { Args: { p_id: string }; Returns: boolean };
      ai_studio_footage_finish: {
        Args: { p_id: string; p_status: string; p_key?: string | null; p_credits?: number | null };
        Returns: boolean;
      };
      ai_studio_narration_begin: {
        Args: {
          p_id: string;
          p_project: string;
          p_title: string;
          p_script: string;
          p_voice: string;
          p_tone: string;
        };
        Returns: boolean;
      };
      ai_studio_narration_finish: {
        Args: { p_id: string; p_status: string; p_key?: string | null; p_duration?: number | null };
        Returns: boolean;
      };
      ai_studio_begin: {
        Args: {
          p_id: string;
          p_project: string;
          p_parent: string | null;
          p_reference: string | null;
          p_prompt: string;
          p_model: string;
          p_size: string;
        };
        Returns: boolean;
      };
      ai_studio_finish: {
        Args: { p_id: string; p_status: string; p_key?: string | null; p_failure?: string | null };
        Returns: boolean;
      };
      ai_studio_design_save: {
        Args: {
          p_id: string;
          p_project: string;
          p_title: string;
          p_document: import('@/domains/studio/design/document').DesignDocument;
          p_updated: string | null;
          p_expected: number;
          p_freeze?: boolean;
        };
        Returns: { id: string; revision: number; updated_at: string; revision_id: string }[];
      };
      ai_studio_design_freeze: { Args: { p_id: string; p_expected: number }; Returns: string };
      ai_studio_composition_save: {
        Args: {
          p_id: string;
          p_project: string;
          p_title: string;
          p_document: import('@/domains/studio/composition/model').CompositionDocument;
          p_updated: string | null;
          p_expected: number;
          p_freeze?: boolean;
        };
        Returns: { id: string; revision: number; updated_at: string; revision_id: string }[];
      };
      ai_studio_composition_freeze: { Args: { p_id: string; p_expected: number }; Returns: string };
      ai_studio_render_begin: {
        Args: {
          p_id: string;
          p_project: string;
          p_composition: string;
          p_revision: string;
          p_key: string;
        };
        Returns: { id: string; status: string; created: boolean }[];
      };
      ai_studio_render_cancel: { Args: { p_id: string }; Returns: boolean };
      ai_studio_render_claim: { Args: { p_id: string; p_token: string }; Returns: boolean };
      ai_studio_render_heartbeat: { Args: { p_id: string; p_token: string }; Returns: boolean };
      ai_studio_render_finish: {
        Args: {
          p_id: string;
          p_token: string;
          p_film: string;
          p_cover: string;
          p_captions: string;
          p_width: number;
          p_height: number;
          p_duration: number;
        };
        Returns: boolean;
      };
      ai_studio_render_fail: { Args: { p_id: string; p_token: string; p_code: string }; Returns: boolean };
      ai_studio_render_recover: { Args: Record<string, never>; Returns: number };
      ai_studio_render_requeue: { Args: Record<string, never>; Returns: number };
      ai_studio_export_record: {
        Args: {
          p_design: string;
          p_revision: string;
          p_format: string;
          p_key: string;
          p_width: number;
          p_height: number;
          p_ppi: number;
        };
        Returns: string;
      };
      ai_studio_design_export_begin: {
        Args: {
          p_id: string;
          p_project: string;
          p_design: string;
          p_revision: string;
          p_format: string;
          p_font_mode: string;
          p_key: string;
        };
        Returns: { id: string; status: string; created: boolean; export_id: string | null }[];
      };
      ai_studio_design_export_cancel: { Args: { p_id: string }; Returns: boolean };
      ai_studio_design_export_claim: { Args: { p_id: string; p_token: string }; Returns: boolean };
      ai_studio_design_export_heartbeat: { Args: { p_id: string; p_token: string }; Returns: boolean };
      ai_studio_design_export_finish: {
        Args: {
          p_id: string;
          p_token: string;
          p_key: string;
          p_width: number;
          p_height: number;
          p_ppi: number;
        };
        Returns: string;
      };
      ai_studio_design_export_fail: { Args: { p_id: string; p_token: string; p_code: string }; Returns: boolean };
      ai_studio_design_export_recover: { Args: Record<string, never>; Returns: number };
      ai_studio_design_export_requeue: { Args: Record<string, never>; Returns: number };
      ai_studio_scene_create: {
        Args: {
          p_project: string;
          p_title: string;
          p_message: string;
          p_visual: string;
          p_motion: string;
          p_channel: string;
        };
        Returns: string;
      };
      grooming_record_practice: {
        Args: {
          p_request: string;
          p_ritual: string;
          p_version: number;
          p_day: string;
          p_note: string;
        };
        Returns: { id: string; ritualId: string; occurredAt: string };
      };
      grooming_practice_feedback: { Args: { p_checkin: string; p_note: string }; Returns: boolean };
      grooming_review_ritual: {
        Args: {
          p_request: string;
          p_kind: string;
          p_version: number;
          p_title: string;
          p_steps: string;
          p_source: string | null;
        };
        Returns: string;
      };
      grooming_set_ritual: {
        Args: { p_kind: string; p_title: string; p_steps: string };
        Returns: string;
      };
      grooming_begin_scan: { Args: { p_id: string }; Returns: boolean };
      grooming_finish_scan: {
        Args: {
          p_id: string;
          p_status: string;
          p_quality: string;
          p_summary: string;
          p_next: string;
          p_observations: unknown;
        };
        Returns: boolean;
      };
      grooming_begin_look: {
        Args: { p_id: string; p_photo: string; p_category: string; p_style: string };
        Returns: boolean;
      };
      grooming_finish_look: {
        Args: { p_id: string; p_status: string; p_key?: string | null };
        Returns: boolean;
      };
      grooming_store_pass_code: { Args: { p_pass: string; p_hash: string }; Returns: boolean };
      grooming_claim_pass: { Args: { p_hash: string }; Returns: string | null };
      grooming_propose_service: {
        Args: {
          p_pass: string;
          p_id: string;
          p_date: string;
          p_title: string;
          p_detail: string;
          p_return: string;
        };
        Returns: boolean;
      };
      grooming_decide_service: { Args: { p_id: string; p_accept: boolean }; Returns: boolean };
      billing_control: {
        Args: {
          p_command: string;
          p_person: string | null;
          p_token: string | null;
          p_payload: unknown;
        };
        Returns: unknown;
      };
      pilot_reserve: { Args: { p_email: string }; Returns: string };
      pilot_claim: { Args: Record<string, never>; Returns: boolean };
      pilot_submit_feedback: { Args: { p_category: string; p_message: string }; Returns: string };
      daily_confirm_review: {
        Args: {
          p_request: string;
          p_day: string;
          p_expected_review_version: number;
          p_source_day_version: number;
          p_progress: string;
          p_blocker: string;
          p_tomorrow: string;
        };
        Returns: number;
      };
      ai_propose_daily_action: {
        Args: { p_id: string; p_turn: string; p_title: string };
        Returns: string;
      };
      ai_decide_daily_action: {
        Args: { p_id: string; p_approve: boolean };
        Returns: string | null;
      };
      ai_decide_daily_action_v2: {
        Args: { p_id: string; p_approve: boolean; p_title: string | null };
        Returns: string | null;
      };
      ai_confirm_reviewed_daily_action: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_review: string;
          p_title: string;
          p_day: string;
          p_version: number;
          p_timezone: string;
        };
        Returns: string;
      };
      ai_reserve_proposal: { Args: { p_request: string }; Returns: boolean };
      ascend_profile_confirm: {
        Args: {
          p_request: string;
          p_key: FactKey;
          p_value: string | null;
          p_expected_version: number;
          p_source_kind: string;
          p_excerpt: string | null;
        };
        Returns: number;
      };
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
      daily_complete_action: {
        Args: { p_day: string; p_action: string; p_version: number };
        Returns: number;
      };
      company_begin_turn: {
        Args: {
          p_company: string;
          p_conversation: string;
          p_request: string;
          p_text: string;
          p_model: string;
          p_prompt_version: string;
        };
        Returns: string;
      };
      ai_propose_coworker_review: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_prompt: string;
          p_coworker: string;
          p_scope: string;
        };
        Returns: boolean;
      };
      ai_propose_visual_artifact: {
        Args: { p_id: string; p_conversation: string; p_operation: string; p_prompt: string };
        Returns: boolean;
      };
      ai_claim_visual_artifact: {
        Args: { p_id: string; p_approve: boolean; p_model: string };
        Returns: boolean;
      };
      ai_set_chart_scenario: {
        Args: { p_conversation: string; p_artifact: string; p_percent: number };
        Returns: boolean;
      };
      ai_finish_metered_visual_artifact: {
        Args: {
          p_id: string;
          p_visual: import('@/domains/artifacts/visual').VisualBoard | null;
          p_text: string;
          p_input: number | null;
          p_output: number | null;
          p_duration: number;
          p_stages: number;
          p_usage_complete: boolean;
        };
        Returns: boolean;
      };
      ai_finish_visual_artifact: {
        Args: {
          p_id: string;
          p_visual: import('@/domains/artifacts/visual').VisualBoard | null;
          p_text: string;
          p_input: number | null;
          p_output: number | null;
          p_duration: number;
        };
        Returns: boolean;
      };
      ai_select_visual_part: {
        Args: { p_conversation: string; p_artifact: string; p_part: string | null };
        Returns: boolean;
      };
      ai_live_request_job: {
        Args: {
          p_id: string;
          p_session: string;
          p_call: string;
          p_task: string;
          p_coworker: string | null;
        };
        Returns: boolean;
      };
      ai_live_review_job: { Args: { p_id: string; p_approve: boolean }; Returns: boolean };
      ai_live_finish_job: {
        Args: {
          p_id: string;
          p_result: string;
          p_input: number;
          p_output: number;
          p_duration: number;
          p_success: boolean;
          p_model: string;
        };
        Returns: boolean;
      };
      ai_artifact_preview: {
        Args: { p_id: string; p_index: number; p_key: string };
        Returns: boolean;
      };
      ai_talk_save_creation: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_turn: string | null;
          p_kind: string;
          p_predecessor: string | null;
          p_content: unknown;
        };
        Returns: { id: string; lineageId: string; version: number };
      };
      ai_talk_save_candidate: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_turn: string;
          p_kind: string;
          p_base: string;
          p_content: unknown;
        };
        Returns: { id: string; lineageId: string; version: number; recovered?: boolean };
      };
      ai_talk_select_creation: {
        Args: { p_conversation: string; p_creation: string };
        Returns: boolean;
      };
      ai_live_observe_item: {
        Args: {
          p_session: string;
          p_conversation: string;
          p_item: string;
          p_response: string | null;
        };
        Returns: { providerItemId: string; observed: boolean };
      };
      ai_live_observe_trusted_item: {
        Args: {
          p_session: string;
          p_conversation: string;
          p_item: string;
          p_response: string | null;
          p_turn: string;
        };
        Returns: {
          providerItemId: string;
          turnId: string;
          observed: boolean;
          trusted: boolean;
        };
      };
      ai_live_bind_finished_turn: {
        Args: {
          p_session: string;
          p_conversation: string;
          p_item: string;
          p_response: string | null;
          p_turn: string;
        };
        Returns: {
          providerItemId: string;
          providerResponseId: string | null;
          turnId: string;
          recovered?: boolean;
        };
      };
      ai_talk_review_premium_direction: {
        Args: { p_conversation: string; p_board: string; p_version: number };
        Returns: unknown;
      };
      architect_apps_retain_design: {
        Args: {
          p_request: string;
          p_project: string;
          p_digest: string;
          p_receipt: unknown;
          p_source_kind: string;
          p_verified: boolean;
        };
        Returns: string;
      };
      ai_live_bind_turn: {
        Args: {
          p_session: string;
          p_conversation: string;
          p_item: string;
          p_response: string | null;
          p_turn: string;
        };
        Returns: {
          providerItemId: string;
          providerResponseId: string | null;
          turnId: string;
          recovered?: boolean;
        };
      };
      ai_live_read_bindings: {
        Args: { p_session: string; p_conversation: string };
        Returns: Array<{
          providerItemId: string;
          providerResponseId: string | null;
          turnId: string;
        }>;
      };
      ai_talk_record_direction_transfer: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_board: string;
          p_version: number;
          p_direction: string;
          p_direction_uuid: string;
          p_project: string;
          p_digest: string;
          p_receipt: unknown;
        };
        Returns: {
          id: string;
          projectId: string;
          digest: string;
          imported: boolean;
          recovered?: boolean;
        };
      };
      ai_talk_import_origin: {
        Args: { p_id: string; p_handoff: string; p_conversation: string };
        Returns: {
          id: string;
          handoffId: string;
          projectId: string;
          saveId?: string;
          mappingVersion?: string;
          recovered?: boolean;
        };
      };
      talk_studio_entitled: { Args: { p_person: string }; Returns: boolean };
      ai_talk_propose_image: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_operation: string;
          p_prompt: string;
          p_project: string | null;
        };
        Returns: boolean;
      };
      ai_talk_claim_image: { Args: { p_id: string; p_approve: boolean }; Returns: boolean };
      ai_propose_image_artifact: {
        Args: {
          p_id: string;
          p_conversation: string;
          p_operation: string;
          p_prompt: string;
          p_project: string | null;
        };
        Returns: boolean;
      };
      ai_select_artifact: {
        Args: { p_conversation: string; p_artifact: string };
        Returns: boolean;
      };
      ai_claim_image_artifact: { Args: { p_id: string; p_approve: boolean }; Returns: boolean };
      ai_reconcile_artifact: { Args: { p_id: string }; Returns: boolean };
      ai_live_reserve: {
        Args: { p_id: string; p_conversation: string; p_model: string };
        Returns: string;
      };
      ai_live_attach: { Args: { p_id: string; p_call: string; p_tag: string }; Returns: boolean };
      ai_live_claim_expired: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          person_id: string;
          call_id: string;
          call_tag: string | null;
          expires_at: string;
          lease_token: string;
        }[];
      };
      ai_live_confirm_expired: { Args: { p_id: string; p_token: string }; Returns: boolean };
      ai_live_end: {
        Args: { p_id: string; p_reason: string; p_input?: number; p_output?: number };
        Returns: boolean;
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
      ai_update_conversation: {
        Args: { p_id: string; p_title: string | null; p_archive: boolean | null };
        Returns: boolean;
      };
      ai_search_conversations: {
        Args: { p_query: string; p_limit?: number };
        Returns: {
          id: string;
          title: string;
          updated_at: string;
          archived_at: string | null;
          excerpt: string;
        }[];
      };
      ai_set_generated_title: { Args: { p_id: string; p_title: string }; Returns: boolean };
      ai_save_thread_summary: {
        Args: { p_id: string; p_summary: string; p_through: string; p_expected: string | null };
        Returns: boolean;
      };
      ai_reserve_auxiliary: {
        Args: { p_id: string; p_kind: 'title' | 'summary' };
        Returns: boolean;
      };
      ai_finish_auxiliary: {
        Args: { p_id: string; p_input: number | null; p_output: number | null };
        Returns: boolean;
      };
      ai_begin_revision: {
        Args: {
          p_conversation: string;
          p_source: string;
          p_request: string;
          p_text: string;
          p_kind: string;
          p_model: string;
          p_context: boolean;
          p_prompt_version: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
