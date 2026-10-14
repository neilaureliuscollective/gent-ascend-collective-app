import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { APP_PROFILE_VERSION } from './catalog';
import { APP_DATA_SCHEMA, PREVIEW_SESSION_MAX } from './schema';
import type { AppFile } from './schema';

export const APP_PREVIEW_SANDBOX = 'allow-scripts';
export { APP_DATA_SCHEMA };
export const PREVIEW_SESSION_VERSION = 'v1';

export function previewCsp() {
  return [
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

function previewSecret(secret?: string) {
  return secret ?? process.env.ARCHITECT_APPS_PREVIEW_SECRET ?? 'architect-apps-dev-preview';
}

function mac(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('hex').slice(0, 32);
}

export function signPreviewSession(input: {
  personId: string;
  projectId: string;
  revisionId: string;
  secret?: string;
}) {
  const nonce = randomBytes(8).toString('hex');
  const body = `${input.personId}|${input.projectId}|${input.revisionId}|${nonce}|${APP_PROFILE_VERSION}`;
  const session = `${PREVIEW_SESSION_VERSION}.${nonce}.${mac(body, previewSecret(input.secret))}`;
  if (session.length > PREVIEW_SESSION_MAX)
    throw new Error('Preview session exceeded the derived token bound.');
  return session;
}

export function verifyPreviewSession(
  session: string,
  expected: { personId: string; projectId: string; revisionId: string },
  secret = previewSecret(),
) {
  if (session.length < 16 || session.length > PREVIEW_SESSION_MAX) return false;
  const [version, nonce, digest] = session.split('.');
  if (version !== PREVIEW_SESSION_VERSION || !nonce || !digest || digest.length !== 32) return false;
  const body = `${expected.personId}|${expected.projectId}|${expected.revisionId}|${nonce}|${APP_PROFILE_VERSION}`;
  const check = mac(body, secret);
  try {
    return timingSafeEqual(Buffer.from(check, 'utf8'), Buffer.from(digest, 'utf8'));
  } catch {
    return false;
  }
}

export function validateArtifactPath(path: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) && !path.includes('..') && !path.startsWith('/');
}

function decodeAsset(file: AppFile) {
  return file.content;
}

function escapeInlineScript(content: string) {
  return content.replace(/<\/(script|style|body|html)/gi, '<\\/$1');
}

export function assemblePreviewDocument(input: {
  artifacts: AppFile[];
  session: string;
  parentOrigin: string;
  title?: string;
  revision?: number;
  revisionId?: string;
}) {
  const html = input.artifacts.find((file) => file.path === 'index.html' || file.path.endsWith('/index.html'));
  const scripts = input.artifacts.filter((file) => file.path.endsWith('.js'));
  const styles = input.artifacts.filter((file) => file.path.endsWith('.css'));
  const styleTags = styles.map((file) => `<style>${decodeAsset(file)}</style>`).join('\n');
  const scriptTags = scripts.map((file) => `<script type="module">${escapeInlineScript(decodeAsset(file))}</script>`).join('\n');
  const body = html
    ? html.content
        .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/g, '')
        .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, '')
        .replace('</head>', `${styleTags}</head>`)
        .replace('</body>', `${scriptTags}</body>`)
    : `<!doctype html><html><head><meta charset="utf-8" /><title>${input.title ?? 'Generated application'}</title>${styleTags}</head><body><div id="root"></div>${scriptTags}</body></html>`;
  const bootstrap = `<script>window.__AETHELIOS_APP_SESSION__=${JSON.stringify(input.session)};window.__AETHELIOS_PARENT_ORIGIN__=${JSON.stringify(input.parentOrigin)};window.__AETHELIOS_APP_REVISION__=${JSON.stringify(input.revision ?? null)};if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rows){rows.forEach(function(row){row.unregister();});});}</script>`;
  const srcDoc = body.includes('<head>')
    ? body.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${previewCsp()}" />${bootstrap}`)
    : `${bootstrap}${body}`;
  return {
    srcDoc,
    sandbox: APP_PREVIEW_SANDBOX,
    csp: previewCsp(),
    scriptEnabled: true,
    serviceWorkers: false,
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
