// Initial migration contract. Replace with CLI-generated types after a validated
// local Supabase reset; this file deliberately describes only shipped tables.
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationship[];
};
export type PersonRow = {
  id: string;
  auth_user_id: string;
  display_name: string;
  timezone: string;
  onboarding_completed: boolean;
  created_at: string;
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
export interface Database {
  public: {
    Tables: {
      persons: Table<
        PersonRow,
        never,
        Partial<Pick<PersonRow, 'display_name' | 'timezone' | 'onboarding_completed'>>
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
        },
        never,
        never
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
