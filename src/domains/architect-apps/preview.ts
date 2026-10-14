import { createHmac, randomBytes } from 'node:crypto';
import { APP_PROFILE_VERSION } from './catalog';
import type { AppFile } from './schema';

export const APP_PREVIEW_SANDBOX = 'allow-scripts';
export const APP_DATA_SCHEMA = 'architect-apps-data/v1';

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

export function signPreviewSession(input: {
  personId: string;
  projectId: string;
  revisionId: string;
  secret?: string;
}) {
  const nonce = randomBytes(12).toString('hex');
  const body = `${input.personId}:${input.projectId}:${input.revisionId}:${nonce}:${APP_PROFILE_VERSION}`;
  const secret = input.secret ?? process.env.ARCHITECT_APPS_PREVIEW_SECRET ?? 'architect-apps-dev-preview';
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  return `${body}:${digest}`;
}

export function verifyPreviewSession(
  session: string,
  expected: { personId: string; projectId: string; revisionId: string },
  secret = process.env.ARCHITECT_APPS_PREVIEW_SECRET ?? 'architect-apps-dev-preview',
) {
  const parts = session.split(':');
  if (parts.length !== 6) return false;
  const [personId, projectId, revisionId, , version, digest] = parts;
  if (personId !== expected.personId || projectId !== expected.projectId || revisionId !== expected.revisionId)
    return false;
  if (version !== APP_PROFILE_VERSION) return false;
  const body = parts.slice(0, 5).join(':');
  if (!digest) return false;
  const check = createHmac('sha256', secret).update(body).digest('hex');
  return check === digest;
}

export function validateArtifactPath(path: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) && !path.includes('..') && !path.startsWith('/');
}

function decodeAsset(file: AppFile) {
  if (file.path.endsWith('.html') || file.path.endsWith('.js') || file.path.endsWith('.css')) return file.content;
  return file.content;
}

export function assemblePreviewDocument(input: {
  artifacts: AppFile[];
  session: string;
  parentOrigin: string;
  title?: string;
}) {
  const html = input.artifacts.find((file) => file.path === 'index.html' || file.path.endsWith('/index.html'));
  const scripts = input.artifacts.filter((file) => file.path.endsWith('.js'));
  const styles = input.artifacts.filter((file) => file.path.endsWith('.css'));
  const styleTags = styles.map((file) => `<style>${decodeAsset(file)}</style>`).join('\n');
  const scriptTags = scripts.map((file) => `<script type="module">${decodeAsset(file)}</script>`).join('\n');
  const body = html
    ? html.content
        .replace(/<link[^>]+href="[^"]+\.css"[^>]*>/g, '')
        .replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/g, '')
        .replace('</head>', `${styleTags}</head>`)
        .replace('</body>', `${scriptTags}</body>`)
    : `<!doctype html><html><head><meta charset="utf-8" /><title>${input.title ?? 'Generated application'}</title>${styleTags}</head><body><div id="root"></div>${scriptTags}</body></html>`;
  const bootstrap = `<script>window.__AETHELIOS_APP_SESSION__=${JSON.stringify(input.session)};window.__AETHELIOS_PARENT_ORIGIN__=${JSON.stringify(input.parentOrigin)};if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rows){rows.forEach(function(row){row.unregister();});});}</script>`;
  const srcDoc = body.includes('<head>')
    ? body.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${previewCsp()}" />${bootstrap}`)
    : `${bootstrap}${body}`;
  return {
    srcDoc,
    sandbox: APP_PREVIEW_SANDBOX,
    csp: previewCsp(),
    scriptEnabled: true,
    serviceWorkers: false,
    label: 'Private compiled preview. Generated code cannot read parent cookies, tokens or DOM.',
  };
}

export function denyForeignPreview(ownerId: string, projectId: string, actual: { personId: string; projectId: string }) {
  return actual.personId !== ownerId || actual.projectId !== projectId;
}
