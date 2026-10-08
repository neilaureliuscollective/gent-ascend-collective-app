import { briefSchema, type Brief } from './schema';
export const artifactTemplate = 'service-business-export-v1' as const;
export const artifactCsp =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function renderArtifact(input: Brief): string {
  const b = briefSchema.parse(input),
    e = escape;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${artifactCsp}"><title>${e(b.name)}</title><style>
*{box-sizing:border-box}html{scroll-behavior:auto}body{margin:0;background:#06090d;color:#f4f5f2;font:18px/1.65 system-ui,sans-serif}header,main,footer{max-width:1120px;margin:auto;padding:24px}header{display:flex;flex-wrap:wrap;gap:24px;align-items:center;justify-content:space-between}nav{display:flex;flex-wrap:wrap;gap:20px}a{color:#e0bb6a;text-underline-offset:5px}a:focus-visible{outline:3px solid white;outline-offset:5px}section{padding:52px 0;scroll-margin-top:24px}h1{font-size:clamp(2rem,7vw,4.5rem);line-height:1.1;max-width:900px}h2{font-size:2rem}p{max-width:760px;white-space:pre-wrap;overflow-wrap:anywhere}article{padding:24px 0;border-bottom:1px solid #526068}h3{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px}h1,h2,h3,header{overflow-wrap:anywhere}footer{color:#a8b0b4;border-top:1px solid #526068}.notice{color:#a8b0b4;font-size:14px}@media(max-width:400px){header,main,footer{padding:18px}section{padding:32px 0}}</style></head><body><header><strong>${e(b.name)}</strong><nav aria-label="Website sections"><a href="#home">Home</a><a href="#services">Services</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header><main><section id="home"><p>${b.industry === 'grooming-beauty' ? 'Care. Craft. Confidence.' : 'Expertise with purpose.'}</p><h1>${e(b.headline)}</h1><a href="#services">Explore services</a></section><section id="services"><h2>Services</h2>${b.services.map((s) => `<article><h3>${e(s.name)}<span>${e(s.price)}</span></h3><p>${e(s.description)}</p></article>`).join('')}</section><section id="about"><h2>About</h2><p>${e(b.about)}</p></section><section id="contact"><h2>Contact</h2><p>${e(b.contact)}</p><p>${e(b.hours)}</p>${b.bookingUrl ? `<a href="${e(b.bookingUrl)}" target="_blank" rel="noopener noreferrer">Visit booking provider</a>` : ''}<p class="notice">No contact form is connected. Booking is an external link; availability and appointments have not been verified.</p></section></main><footer>${e(b.name)} · Draft website export. Not published.</footer></body></html>`;
}
export function checkArtifact(html: string) {
  const checks = [
    {
      name: 'document',
      passed: html.startsWith('<!doctype html>') && html.includes('<html lang="en">'),
    },
    { name: 'viewport', passed: html.includes('width=device-width,initial-scale=1') },
    {
      name: 'sections',
      passed: ['home', 'services', 'about', 'contact'].every(
        (id) => html.includes(`id="${id}"`) && html.includes(`href="#${id}"`),
      ),
    },
    {
      name: 'no-executable-content',
      passed:
        !/<(?:script|iframe|object|embed|form)\b|<[^>]*\son[a-z]+\s*=|(?:href|src)=["']javascript:/i.test(
          html,
        ),
    },
    { name: 'content-policy', passed: html.includes(artifactCsp) },
    { name: 'bounded-output', passed: new TextEncoder().encode(html).length <= 100000 },
  ];
  return { validator: 'static-service-v1', checks, passed: checks.every((c) => c.passed) };
}
