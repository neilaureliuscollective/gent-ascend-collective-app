export type Conversation = {
  company_id?: string | null;
  id: string;
  person_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  title_source?: 'first_message' | 'generated' | 'user';
  context_summary?: string;
  summary_through?: string | null;
  summary_updated_at?: string | null;
};
export type Turn = {
  id: string;
  person_id: string;
  conversation_id: string;
  user_text: string;
  assistant_text: string;
  status: 'pending' | 'complete' | 'failed' | 'cancelled';
  model: string;
  context_included: boolean;
  prompt_version: string;
  feedback: 'helpful' | 'needs_work' | null;
  created_at: string;
  finished_at: string | null;
  parent_turn_id?: string | null;
  revision_kind?: 'retry' | 'regenerate' | 'edit' | null;
};
export type ChatMessage = {
  id: string; person_id: string; conversation_id: string; turn_id: string|null;
  role: 'user' | 'assistant' | 'tool'; content: string;
  position: 0|1|2;
  parts: Array<{type: string; [key: string]: unknown}>;
  metadata: Record<string,unknown>;
  status: Turn['status']; created_at: string;
};
export type Memory = {
  id: string;
  person_id: string;
  content: string;
  kind: 'preference' | 'fact';
  source: 'user';
  confirmed_at: string;
  version: number;
};
export type ActionProposal = {
  id:string;person_id:string;source_turn_id:string|null;tool_name:'create_daily_action';title:string;
  status:'pending'|'executed'|'rejected';proposed_at:string;decided_at:string|null;executed_day:string|null;
};
export type PersonalContext = {
  continuity?: { start: string; today: string; timezone: string; recordedDays: number; actionsCompleted: number; actionsPlanned: number; sessionsCompleted: number | null; practiceDays: number | null; reviewedDays: number; nextAction: string | null; activeSession: { title: string } | null; unavailable: string[] } | null;
  profile: { name: string; priority: string; timezone: string; units: string; updatedAt: string };
  goal: { title: string; nextStep: string; reason: string; updatedAt: string } | null;
  memories: Pick<Memory, 'id' | 'content' | 'kind' | 'confirmed_at'>[];
  daily?: { day: string; intention: string; energy: number | null; actions: { id: string; title: string; done: boolean }[]; reflection: string; review?: {progress:string;blocker:string;tomorrow:string;confirmedAt:string}|null }[];
  dailyBrief?: { asOf: string; day: string; version: number; intention: string; actions: { id: string; title: string; done: boolean }[]; openCaptures: number; previousReview: { day: string; tomorrow: string; blocker: string } | null; nextMove?: { title: string; kind: 'action' | 'review' | 'goal' | 'rest'; source: string; sourceDay: string | null } };
  ascendProfile?: { key: string; value: string; confirmedAt: string; source: 'user' | 'ai_proposal' }[];
  grooming?: { occasions?:{title:string;day:string;note:string}[]; profile: {hair:string;beard:string;skin:string;look:string;effort:string;sensitivities:string;dislikes:string}|null; goals:{title:string;date:string|null}[]; rituals:{id?:string;version?:number;kind:string;title:string;steps:string}[]; products:{name:string;relation:string;note:string;ritualId?:string|null}[]; looks:{title:string;kind:string;detail:string;date:string|null}[]; concepts:{title:string;style:string;note:string;at:string}[]; scans:{at:string;summary:string}[];practice?:{ritualId:string;at:string;note:string}[] };
};
export type WorkspaceData = {
  /** Session-bound owner for rejecting cross-account transient drafts; not authority. */
  ownerId?: string;
  conversations: Conversation[];
  turns: Turn[];
  memories: Memory[];
  actionProposals: ActionProposal[];
  context: PersonalContext;
  canChat: boolean;
  configured: boolean;
  model: string;
  hasOlderTurns?: boolean;
  nextConversationCursor?: string | null;
  currentConversation?: Conversation | null;
};
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'saved'; turn: Turn }
  | { type: 'error'; message: string };
