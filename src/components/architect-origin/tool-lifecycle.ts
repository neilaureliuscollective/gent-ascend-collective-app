import type { EstimatorConfig, EstimatorResult } from '@/domains/architect-tools/engine';
import type {
  SavedEstimatorInvocation,
  SavedEstimatorTool,
  SavedEstimatorVersion,
} from '@/domains/architect-tools/schema';

export type ToolLibrary = {
  tools: SavedEstimatorTool[];
  versions: SavedEstimatorVersion[];
  invocations: SavedEstimatorInvocation[];
};

async function parse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Tool request failed.');
  return data;
}

export async function readToolLibrary(projectId: string, toolId?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ project: projectId });
  if (toolId) query.set('tool', toolId);
  const response = await fetch(`/api/architect-tools?${query}`, { signal, cache: 'no-store' });
  return parse<ToolLibrary>(response);
}

export async function saveToolRevision(input: {
  projectId: string;
  toolId: string;
  requestId: string;
  expected: number;
  name: string;
  configuration: EstimatorConfig;
  note: string;
}) {
  const response = await fetch('/api/architect-tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'save', ...input }),
  });
  return parse<{ revision: number; requestId: string; personId: string; toolId: string }>(response);
}

export async function invokeSavedTool(input: {
  projectId: string;
  toolId: string;
  revision: number;
  requestId: string;
  quantities?: Record<string, string>;
  source?: 'architect' | 'agent-fixture';
}) {
  const response = await fetch('/api/architect-tools', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'invoke', source: 'architect', quantities: {}, ...input }),
  });
  return parse<{
    toolId: string;
    projectId: string;
    revision: number;
    name: string;
    configuration: EstimatorConfig;
    inputs: { quantities: Record<string, string> };
    assumptions: string[];
    result: EstimatorResult;
    provenance: { source: string; requestId: string; personId: string; recorded: boolean };
  }>(response);
}
