export type BillingReadiness = {
  checkedAt: string;
  checks: Array<{ name: string; status: 'verified' | 'blocked' | 'unknown'; detail: string }>;
};
