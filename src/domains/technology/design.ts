import { designSchema, type Brief } from './schema';
export const palettes = {
  petrol: {
    background: '#07161b',
    foreground: '#f4f5f2',
    accent: '#e0bb6a',
    muted: '#b8c5c9',
    border: '#62757d',
  },
  ivory: {
    background: '#f5f1e8',
    foreground: '#182b31',
    accent: '#765118',
    muted: '#46585e',
    border: '#7b8788',
  },
  slate: {
    background: '#101b2c',
    foreground: '#f4f5f2',
    accent: '#a5c8ff',
    muted: '#b5c3d8',
    border: '#637991',
  },
} as const;
// Only audited constants become CSS. No AI-provided CSS, URLs, fonts, or HTML.
export function designCss(brief: Brief) {
  if (!brief.design) return '';
  const d = designSchema.parse(brief.design),
    p = palettes[d.palette];
  return `body{background:${p.background};color:${p.foreground}}a{color:${p.accent}}footer,.notice{color:${p.muted}}article,footer{border-color:${p.border}}h1,h2{font-family:${d.typography === 'serif' ? 'Georgia,serif' : 'system-ui,sans-serif'}}section{padding:${d.spacing === 'spacious' ? '72' : '36'}px 0}#home{${d.hero === 'centered' ? 'text-align:center' : d.hero === 'split' ? 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px;align-items:center' : 'border-bottom:1px solid ' + p.border}}#home h1{${d.hero === 'split' ? 'grid-column:1;grid-row:1 / 3' : ''}}#home p{${d.hero === 'split' ? 'grid-column:2' : d.hero === 'centered' ? 'margin-inline:auto' : ''}}#home a{${d.hero === 'split' ? 'grid-column:2' : ''}}@media(max-width:600px){#home{display:block;text-align:left}section{padding:32px 0}}`;
}
