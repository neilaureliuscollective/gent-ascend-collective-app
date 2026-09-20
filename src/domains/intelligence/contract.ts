import type { Capability } from '@/domains/access/policy';
export interface ContextReference {
  id: string;
  personId: string;
  domain: 'person' | 'goals' | 'metrics' | 'timeline';
  source: 'user' | 'provider' | 'import' | 'derived';
  occurredAt: string;
  confirmedByUser: boolean;
  confidence?: number;
}
export interface IntelligenceContext {
  personId: string;
  capabilities: ReadonlySet<Capability>;
  sources: ContextReference[];
}
export interface ContextProvider {
  readAuthorized(context: IntelligenceContext): Promise<ContextReference[]>;
}
// Aurelius conversation implementation lives beside this future context-provider contract.
