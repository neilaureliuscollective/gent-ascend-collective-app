import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseEnvironment } from '@/platform/environment';
import { APP_PROFILE_VERSION } from './catalog';
import { resolveCompiledBundle } from './bundle';
import { defaultPreviewSessionStore, type PreviewSessionStore } from './preview-store';
import { APP_DATA_SCHEMA, PREVIEW_SESSION_MAX } from './schema';
import type { AppFile } from './schema';

export {
  DatabasePreviewSessionStore,
  MemoryPreviewSessionStore,
  createSharedPreviewMaps,
  defaultPreviewSessionStore,
} from './preview-store';
export type { PreviewSessionRecord, PreviewSessionStore } from './preview-store';

export const APP_PREVIEW_SANDBOX = 'allow-scripts allow-forms';
export { APP_DATA_SCHEMA };
export const PREVIEW_SESSION_VERSION = 'v1';
export const PREVIEW_SESSION_TTL_SEC = 1800;

export function previewCsp() {
  return [
    "sandbox allow-scripts allow-forms",
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data:",
    "font-src data:",
    "connect-src 'none'",
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

export function previewDocumentHeaders(csp = previewCsp()) {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
  };
}

export function previewClusterAllowed(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  if (env.ARCHITECT_APPS_PREVIEW_CLUSTER !== 'true') return false;
  if (env.ARCHITECT_APPS_STORE === 'memory') return false;
  try {
    requirePreviewSecret(env.ARCHITECT_APPS_PREVIEW_SECRET);
    const mode = parseEnvironment(env).mode;
    return mode === 'production' || mode === 'preview';
  } catch {
    return false;
  }
}

export function requirePreviewSecret(secret?: string) {
  const value = secret ?? process.env.ARCHITECT_APPS_PREVIEW_SECRET;
  if (!value || value === 'architect-apps-dev-preview')
    throw new Error('ARCHITECT_APPS_PREVIEW_SECRET is required. Fallback signing secrets are not permitted.');
  if (value.length < 16) throw new Error('Preview signing secret is too short.');
  return value;
}

function mac(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex').slice(0, 32);
}

function encodeSession(nonce: string, exp: number, digest: string) {
  return `${PREVIEW_SESSION_VERSION}.${nonce}.${exp.toString(16).padStart(8, '0')}.${digest}`;
}

function resolvePreviewStore(store?: PreviewSessionStore | null) {
  return store ?? defaultPreviewSessionStore();
}

export function resetPreviewSessions(store?: PreviewSessionStore | null) {
  resolvePreviewStore(store).reset();
}

export async function previewSessionGeneration(revisionId: string, store?: PreviewSessionStore | null) {
  const current = await resolvePreviewStore(store).current(revisionId);
  return current && !current.revoked ? current.generation : 0;
}

export async function revokePreviewSessions(revisionId: string, store?: PreviewSessionStore | null) {
  await resolvePreviewStore(store).revoke(revisionId);
}

export function previewStoreRequired(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return previewClusterAllowed(env);
}

export async function signPreviewSession(input: {
  personId: string;
  projectId: string;
  revisionId: string;
  secret?: string;
  ttlSec?: number;
  replace?: boolean;
  store?: PreviewSessionStore | null;
}) {
  const secret = requirePreviewSecret(input.secret);
  const store = resolvePreviewStore(input.store);
  if (previewClusterAllowed() && !input.store && store.kind !== 'database') {
    throw new Error('Cluster preview sessions require shared revocation state. Missing local state is not authorization.');
  }
  const nonce = randomBytes(8).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + (input.ttlSec ?? PREVIEW_SESSION_TTL_SEC);
  const body = `${input.personId}|${input.projectId}|${input.revisionId}|${nonce}|${exp}|${APP_PROFILE_VERSION}`;
  const token = encodeSession(nonce, exp, mac(body, secret));
  if (token.length > PREVIEW_SESSION_MAX) throw new Error('Preview session exceeded the derived token bound.');
  const issued = await store.issue(
    {
      token,
      nonce,
      exp,
      generation: 1,
      personId: input.personId,
      projectId: input.projectId,
      revisionId: input.revisionId,
      revoked: false,
    },
    Boolean(input.replace),
  );
  return issued.token;
}

export async function verifyPreviewSession(
  session: string,
  expected: { personId: string; projectId: string; revisionId: string },
  secret = process.env.ARCHITECT_APPS_PREVIEW_SECRET,
  store?: PreviewSessionStore | null,
) {
  if (session.length < 16 || session.length > PREVIEW_SESSION_MAX) return false;
  let resolvedSecret: string;
  try {
    resolvedSecret = requirePreviewSecret(secret);
  } catch {
    return false;
  }
  const [version, nonce, expHex, digest] = session.split('.');
  if (version !== PREVIEW_SESSION_VERSION || !nonce || !expHex || !digest || digest.length !== 32) return false;
  const exp = Number.parseInt(expHex, 16);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false;
  const body = `${expected.personId}|${expected.projectId}|${expected.revisionId}|${nonce}|${exp}|${APP_PROFILE_VERSION}`;
  const check = mac(body, resolvedSecret);
  let authentic = false;
  try {
    authentic = timingSafeEqual(Buffer.from(check, 'utf8'), Buffer.from(digest, 'utf8'));
  } catch {
    authentic = false;
  }
  if (!authentic) return false;
  const resolved = resolvePreviewStore(store);
  const record = await resolved.read(nonce);
  if (!record || record.revoked) return false;
  if (record.personId !== expected.personId || record.projectId !== expected.projectId) return false;
  if (record.revisionId !== expected.revisionId || record.token !== session) return false;
  const current = await resolved.current(expected.revisionId);
  return Boolean(current && current.nonce === nonce && !current.revoked);
}

export function validateArtifactPath(path: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) && !path.includes('..') && !path.startsWith('/');
}

function escapeInlineScript(content: string) {
  return content.replace(/<\/(script|style|body|html)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

function spliceLiteral(haystack: string, needle: string, insertion: string, position: 'before' | 'after' = 'before') {
  const index = position === 'after' ? haystack.indexOf(needle) : haystack.lastIndexOf(needle);
  if (index === -1) return haystack;
  if (position === 'after') return haystack.slice(0, index + needle.length) + insertion + haystack.slice(index + needle.length);
  return haystack.slice(0, index) + insertion + haystack.slice(index);
}

export function assemblePreviewDocument(input: {
  artifacts: AppFile[];
  session: string;
  parentOrigin: string;
  title?: string;
  revision?: number;
  revisionId?: string;
  generation?: number;
}) {
  const bundle = resolveCompiledBundle(input.artifacts);
  const styleTags = bundle.styles.map((file) => `<style>${file.content}</style>`).join('\n');
  const scriptTag = `<script>${escapeInlineScript(bundle.script.content)}</script>`;
  let body = bundle.html.content
    .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/g, '')
    .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, '');
  body = spliceLiteral(body, '</head>', styleTags);
  body = spliceLiteral(body, '</body>', scriptTag);
  const generation = input.generation ?? 1;
  const bootstrap = `<script>window.__AETHELIOS_APP_SESSION__=${JSON.stringify(input.session)};window.__AETHELIOS_PARENT_ORIGIN__=${JSON.stringify(input.parentOrigin)};window.__AETHELIOS_APP_REVISION__=${JSON.stringify(input.revision ?? null)};window.__AETHELIOS_APP_GENERATION__=${JSON.stringify(generation)};try{var sw=navigator.serviceWorker;if(sw&&sw.getRegistrations){sw.getRegistrations().then(function(rows){rows.forEach(function(row){row.unregister();});});}}catch(e){}if(window.origin!=='null'){try{localStorage.clear();sessionStorage.clear();}catch(e){}}</script>`;
  const srcDoc = body.includes('<head>')
    ? spliceLiteral(body, '<head>', `<meta http-equiv="Content-Security-Policy" content="${previewCsp()}" />${bootstrap}`, 'after')
    : `${bootstrap}${body}`;
  return {
    srcDoc,
    sandbox: APP_PREVIEW_SANDBOX,
    csp: previewCsp(),
    scriptEnabled: true,
    serviceWorkers: false,
    sameOriginStorage: false,
    entry: bundle.entry,
    generation,
    revision: input.revision ?? null,
    revisionId: input.revisionId ?? null,
    label: input.revision
      ? `Private compiled preview of saved revision ${input.revision}. Generated code cannot read parent cookies, tokens or DOM.`
      : 'Private compiled preview. Generated code cannot read parent cookies, tokens or DOM.',
  };
}

export function denyForeignPreview(ownerId: string, projectId: string, actual: { personId: string; projectId: string }) {
  return actual.personId !== ownerId || actual.projectId !== projectId;
}

export function revisionAllowsPreview(revision: { status: string; working: boolean } | null | undefined) {
  return Boolean(revision && (revision.status === 'ready' || revision.working));
}
