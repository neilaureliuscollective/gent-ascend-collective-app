/** Official Realtime WebRTC admission uses string FormData fields, not Blob file parts. */
export function liveAdmissionForm(sdp: string, session: Record<string, unknown>) {
  const body = new FormData();
  body.set('sdp', sdp);
  body.set('session', JSON.stringify(session));
  return body;
}

export function liveAdmissionFieldKinds(body: FormData) {
  const sdp = body.get('sdp');
  const session = body.get('session');
  return {
    sdp: typeof sdp === 'string' ? sdp : null,
    session: typeof session === 'string' ? session : null,
    sdpKind: fieldKind(sdp),
    sessionKind: fieldKind(session),
  };
}

function fieldKind(value: FormDataEntryValue | null) {
  if (typeof value === 'string') return 'string' as const;
  if (value && typeof File !== 'undefined' && value instanceof File) return 'file' as const;
  if (value && typeof Blob !== 'undefined' && value instanceof Blob) return 'blob' as const;
  return 'other' as const;
}

const token = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : null;

const requestIdHeaders = ['x-request-id', 'openai-request-id', 'x-openai-request-id'] as const;

export function allowlistedRequestId(headers: Headers | null | undefined) {
  if (!headers) return null;
  for (const name of requestIdHeaders) {
    const value = token(headers.get(name));
    if (value) return value;
  }
  return null;
}

/** Allowlisted provider diagnostics only. Never retain raw SDP, keys, conversation text or unrestricted messages. */
export function readProviderRejection(
  status: number,
  contentType: string | null,
  body: string,
  headers?: Headers | null,
): Record<string, string | number | null> {
  const receipt: Record<string, string | number | null> = { providerStatus: status };
  const headerId = allowlistedRequestId(headers);
  if (headerId) receipt.providerRequestId = headerId;
  if (!body || body.length > 4000 || !contentType?.toLowerCase().includes('application/json'))
    return receipt;
  try {
    const parsed = JSON.parse(body) as {
      error?: { code?: unknown; type?: unknown; param?: unknown };
      request_id?: unknown;
    };
    const error = parsed.error ?? {};
    receipt.providerCode = token(error.code);
    receipt.providerType = token(error.type);
    receipt.providerParam = token(error.param);
    receipt.providerRequestId = token(parsed.request_id) ?? receipt.providerRequestId ?? null;
  } catch {
    /* Non-JSON or unexpected shapes stay status-only. */
  }
  return receipt;
}
