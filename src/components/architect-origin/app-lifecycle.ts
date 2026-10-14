export type AppLibrary = {
  app: {
    id: string;
    current_revision: number;
    last_working_revision: number | null;
    name: string;
  } | null;
  revisions: {
    id: string;
    revision: number;
    status: string;
    working: boolean;
    approval_hash: string;
    generation: { mode: string; notes?: string };
    files: { path: string; content: string }[];
    collections: { name: string }[];
  }[];
  jobs: {
    id: string;
    revision_id: string;
    status: string;
    cancel_requested: boolean;
    result: { ok: boolean; isolation: string; blocker: string | null; typecheck: { ok: boolean }; bundle: { ok: boolean } } | null;
  }[];
  events: { kind: string; detail: string; created_at: string }[];
  current: { id: string; revision: number; status: string; working: boolean; approval_hash: string } | null;
  working: { id: string; revision: number } | null;
  preview: { srcDoc: string; sandbox: string; label: string } | null;
  previewSession: string | null;
  pendingStart: { revisionId: string; requestId: string; approvalHash: string; revision: number } | null;
  records: Record<string, Record<string, unknown>[]>;
  provider: { enabled: boolean; mode: string; reason: string | null };
  profile: { id: string; version: string; toolchain: string };
  capabilities: Record<string, boolean>;
};

class AppRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new AppRequestError(data.error || 'Application request failed.', response.status);
  return data;
}

export function readArchitectApps(projectId: string) {
  return request<AppLibrary>(`/api/architect-apps?project=${projectId}`);
}

export function proposeArchitectApp(body: Record<string, unknown>) {
  return request<Record<string, unknown>>('/api/architect-apps', { action: 'propose', ...body });
}

export function approveArchitectApp(body: Record<string, unknown>) {
  return request<{ revision: { id: string; revision: number; approval_hash: string } }>('/api/architect-apps', {
    action: 'approve',
    ...body,
  });
}

export function startArchitectApp(body: Record<string, unknown>) {
  return request<{ job: { id: string; status: string } }>('/api/architect-apps', { action: 'start', ...body });
}

export function cancelArchitectApp(projectId: string, jobId: string) {
  return request<{ job: { id: string; status: string } }>('/api/architect-apps', {
    action: 'cancel',
    projectId,
    jobId,
  });
}

export function reopenArchitectApp(projectId: string, revision: number) {
  return request<{ preview: { srcDoc: string; sandbox: string } }>('/api/architect-apps', {
    action: 'reopen',
    projectId,
    revision,
  });
}

export async function forwardAppData(
  message: {
    session: string;
    requestId: string;
    operation: string;
    collection: string;
    payload?: unknown;
    idempotencyKey?: string;
  },
  projectId: string,
  revisionId: string,
) {
  return request<Record<string, unknown>>('/api/architect-apps/data', {
    action: 'data',
    projectId,
    revisionId,
    ...message,
  });
}
