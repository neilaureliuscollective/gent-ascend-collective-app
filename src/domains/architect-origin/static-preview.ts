import { looksLikeHtml, PREVIEW_BODY_MAX } from './preview-contract';

const FORBIDDEN_TAGS =
  /<\/?(?:script|iframe|object|embed|link|meta|base|form|input|button|textarea|select|frame|frameset|applet|video|audio|source|track|portal|object)(?:\s[^>]*)?>/gi;
const EVENT_ATTR = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URL =
  /\s(?:href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|data|file|vbscript|blob):[^"]*"|'\s*(?:javascript|data|file|vbscript|blob):[^']*'|(?:javascript|data|file|vbscript|blob):[^\s>]+)/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

export type IsolatedStaticPreview = {
  srcDoc: string;
  blocked: string[];
};

/** Labelled UI-test / layout demonstration. Never presented as a live generated site. */
export const LABELLED_DEMONSTRATION_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Studio Atlas — labelled demonstration</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: #f4efe6; color: #1c1a16; }
    header { display: flex; justify-content: space-between; padding: 18px 28px; font: 600 12px/1 system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; }
    main { padding: 24px 28px 64px; max-width: 720px; }
    h1 { font-size: 42px; font-weight: 500; margin: 12px 0; letter-spacing: -0.03em; }
    p { line-height: 1.55; max-width: 38ch; }
    .banner { margin: 0; padding: 10px 28px; background: #1a1a1a; color: #c4912f; font: 600 12px/1.4 system-ui, sans-serif; }
  </style>
</head>
<body>
  <p class="banner">Labelled demonstration — not a live generated preview and not bound to a saved project.</p>
  <header><span>Atlas</span><span>Work · Studio · Contact</span></header>
  <main>
    <p>Hero</p>
    <h1>Space, considered.</h1>
    <p>Architecture shaped around how you live. This page is a deterministic fixture for layout tests.</p>
  </main>
</body>
</html>`;

export function isolateStaticHtml(html: string): IsolatedStaticPreview {
  const blocked: string[] = [];
  let body = html.slice(0, PREVIEW_BODY_MAX);
  if (html.length > PREVIEW_BODY_MAX) blocked.push('truncated');
  const beforeComments = body;
  body = body.replace(HTML_COMMENT, '');
  if (body !== beforeComments) blocked.push('comments');
  const beforeTags = body;
  body = body.replace(FORBIDDEN_TAGS, '');
  if (body !== beforeTags) blocked.push('forbidden-tags');
  const beforeEvents = body;
  body = body.replace(EVENT_ATTR, '');
  if (body !== beforeEvents) blocked.push('event-handlers');
  const beforeUrls = body;
  body = body.replace(DANGEROUS_URL, '');
  if (body !== beforeUrls) blocked.push('dangerous-urls');
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';"/>`;
  if (!/<head[\s>]/i.test(body)) {
    body = `<!DOCTYPE html><html><head>${csp}</head><body>${body}</body></html>`;
  } else {
    body = body.replace(/<head([^>]*)>/i, `<head$1>${csp}`);
  }
  return { srcDoc: body, blocked };
}

export function documentPreviewMode(content: string): 'html' | 'markdown' {
  return looksLikeHtml(content) ? 'html' : 'markdown';
}
