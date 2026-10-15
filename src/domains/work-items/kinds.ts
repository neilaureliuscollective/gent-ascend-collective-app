export const workItemSources = ['talk', 'artifact', 'origin'] as const;
export type WorkItemSource = (typeof workItemSources)[number];

export const workItemKinds = [
  'brief',
  'plan',
  'palette',
  'board',
  'handoff',
  'image',
  'diagram',
  'document',
] as const;
export type WorkItemKind = (typeof workItemKinds)[number];

export type WorkItemRef = {
  source: WorkItemSource;
  kind: WorkItemKind;
  id: string;
  lineageId?: string;
  version?: number;
  conversationId?: string;
  title: string;
  element?: string;
};
