export type WebProject = { version: 1; name: string; brief: string; html: string; css: string };
export const MAX_SOURCE = 40000;
export function parseProject(input: unknown): WebProject {
  if (!input || typeof input !== 'object')
    throw new Error('Choose an Aethelios project JSON file.');
  const p = input as Record<string, unknown>;
  if (
    p.version !== 1 ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 80 ||
    typeof p.brief !== 'string' ||
    p.brief.length > 2000 ||
    typeof p.html !== 'string' ||
    typeof p.css !== 'string' ||
    p.html.length > MAX_SOURCE ||
    p.css.length > MAX_SOURCE
  )
    throw new Error('Project format or size is unsupported.');
  return { version: 1, name: p.name, brief: p.brief, html: p.html, css: p.css };
}
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export function scaffold(name: string, brief: string): WebProject {
  return parseProject({
    version: 1,
    name: name.trim() || 'My website',
    brief,
    html: `<main><header><p>INDEPENDENT PROJECT</p><h1>${escape(name.trim() || 'My website')}</h1><p>${escape(brief)}</p><a href="#about">Explore the idea</a></header><section id="about"><h2>Built around your idea</h2><p>Edit this source to tell your story. Replace this starter copy before publishing.</p></section><footer>Created in the Aethelios workshop.</footer></main>`,
    css: 'body{margin:0;background:#091d18;color:#f7f2e8;font-family:system-ui,sans-serif}main{max-width:960px;margin:auto;padding:clamp(24px,6vw,80px)}header{padding:64px 0}h1{font-size:clamp(36px,8vw,76px);line-height:1.05}p{line-height:1.7;max-width:60ch}a{color:#e0bf73}section{border-top:1px solid #bba36d;padding:36px 0}footer{padding-top:48px;font-size:14px}',
  });
}
export function checkProject(p: WebProject): string[] {
  const issues: string[] = [];
  if (!/<h1(?:\s|>)/i.test(p.html)) issues.push('Add an h1 heading.');
  if (!/<main(?:\s|>)/i.test(p.html)) issues.push('Add a main landmark.');
  if (
    /<(?:script|iframe|object|embed|form|svg|math|link|meta|base)\b/i.test(p.html) ||
    /\bon\w+\s*=/i.test(p.html)
  )
    issues.push(
      'Active content is excluded from the preview; inspect it before independent deployment.',
    );
  if (/(?:https?:|\/\/|@import|url\s*\()/i.test(p.html + p.css))
    issues.push('External resources are blocked in the preview.');
  if (!p.css.trim()) issues.push('Add styling for your website.');
  return issues;
}
export function exportDocument(p: WebProject): string {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(p.name)}</title><style>${p.css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${p.html}</body></html>`;
}
/** Preview is a restricted static projection, never the source of the exported deliverable. */
export function previewDocument(p: WebProject, doc: Document): string {
  const template = doc.createElement('template');
  template.innerHTML = p.html;
  const allowed = new Set([
    'MAIN',
    'HEADER',
    'FOOTER',
    'NAV',
    'SECTION',
    'ARTICLE',
    'ASIDE',
    'DIV',
    'SPAN',
    'P',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'UL',
    'OL',
    'LI',
    'STRONG',
    'EM',
    'B',
    'I',
    'BR',
    'HR',
    'BLOCKQUOTE',
    'CODE',
    'PRE',
    'A',
    'TABLE',
    'THEAD',
    'TBODY',
    'TR',
    'TH',
    'TD',
  ]);
  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    if (!allowed.has(element.tagName)) {
      element.remove();
      continue;
    }
    for (const attr of Array.from(element.attributes)) {
      const keep =
        ['class', 'id', 'title', 'aria-label', 'role'].includes(attr.name) ||
        (element.tagName === 'A' && attr.name === 'href' && /^#[\w-]+$/.test(attr.value));
      if (!keep) element.removeAttribute(attr.name);
    }
  }
  const csp =
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; img-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  return exportDocument({ ...p, html: template.innerHTML }).replace(
    '<head>',
    `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`,
  );
}
