export type Conversation = {
  id: string;
  person_id: string;
  title: string;
  created_at: string;
  updated_at: string;
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
  profile: { name: string; priority: string; timezone: string; units: string; updatedAt: string };
  goal: { title: string; nextStep: string; reason: string; updatedAt: string } | null;
  memories: Pick<Memory, 'id' | 'content' | 'kind' | 'confirmed_at'>[];
  daily?: { day: string; intention: string; energy: number | null; actions: { title: string; done: boolean }[]; reflection: string; review?: {progress:string;blocker:string;tomorrow:string;confirmedAt:string}|null }[];
  ascendProfile?: { key: string; value: string; confirmedAt: string; source: 'user' | 'ai_proposal' }[];
};
export type WorkspaceData = {
  conversations: Conversation[];
  turns: Turn[];
  memories: Memory[];
  actionProposals: ActionProposal[];
  context: PersonalContext;
  canChat: boolean;
  configured: boolean;
  model: string;
};
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'saved'; turn: Turn }
  | { type: 'error'; message: string };
