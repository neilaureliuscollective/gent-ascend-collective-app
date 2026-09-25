import type { WorkspaceData } from '@/domains/intelligence/types';
// Empty presentation state only. Never a user identity, entitlement or API bypass.
export const disconnectedWorkspace: WorkspaceData = {
  conversations: [],
  turns: [],
  memories: [],
  actionProposals: [],
  canChat: false,
  configured: false,
  model: '',
  context: {
    profile: { name: '', priority: '', timezone: '', units: '', updatedAt: '' },
    goal: null,
    memories: [],
  },
};
