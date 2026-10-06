import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { WorkContent, WorkScope } from './schema';
import { IntelligenceError } from '@/domains/intelligence/service';
export type SlideLine = {
  text: string;
  x: number;
  y: number;
  size: number;
  kind: 'title' | 'body' | 'figure' | 'source' | 'footer';
};
export type SlideLayout = { width: number; height: number; lines: SlideLine[] };
async function document() {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), 'public/fonts/company-work.ttf')),
    { subset: true },
  );
  return { pdf, font };
}
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && font.widthOfTextAtSize(line + ' ' + word, size) > width) {
        lines.push(line);
        line = '';
      }
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
      line += ' ';
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}
function layoutWithFont(
  content: WorkContent,
  scope: WorkScope,
  label: string,
  font: PDFFont,
): SlideLayout[] {
  const supported = new Set(font.getCharacterSet());
  const requireText = (text: string) => {
    for (const char of text)
      if (char !== '\n' && !supported.has(char.codePointAt(0)!))
        throw new IntelligenceError(
          'This deck contains a character the export font cannot render. Replace that character before reviewing/exporting.',
          400,
        );
  };
  return content.slides.map((slide, index) => {
    const title = wrap(slide.title, font, 30, 856);
    const texts = [
      slide.title,
      slide.body,
      ...slide.bullets,
      ...slide.figureIds.flatMap((id) => {
        const f = scope.figures.find((f) => f.id === id);
        if (!f) throw new IntelligenceError('Unknown figure.', 400);
        return [`${f.label}: ${f.value}`, `Source: ${f.source}`];
      }),
      label,
    ];
    texts.forEach(requireText);
    for (let size = 19; size >= 12; size--) {
      const lines: SlideLine[] = title.map((text, i) => ({
        text,
        x: 52,
        y: 62 + i * 36,
        size: 30,
        kind: 'title',
      }));
      let y = 74 + title.length * 36;
      function add(text: string, kind: SlideLine['kind'], fontSize = size, gap = 10) {
        for (const line of wrap(text, font, fontSize, 856)) {
          lines.push({ text: line, x: 52, y, size: fontSize, kind });
          y += fontSize * 1.4;
        }
        y += gap;
      }
      add(slide.body, 'body');
      slide.bullets.forEach((text) => add('• ' + text, 'body', size, 5));
      slide.figureIds.forEach((id) => {
        const f = scope.figures.find((f) => f.id === id)!;
        add(`${f.label}: ${f.value}`, 'figure', size, 2);
        add(`Source: ${f.source}`, 'source', 10, 6);
      });
      if (y <= 477) {
        const footer = `${label} · ${index + 1}/${content.slides.length}`;
        if (font.widthOfTextAtSize(footer, 10) > 856)
          throw new IntelligenceError('Presentation label is too long.', 400);
        lines.push({ text: footer, x: 52, y: 512, size: 10, kind: 'footer' });
        return { width: 960, height: 540, lines };
      }
    }
    throw new IntelligenceError(
      `Slide ${index + 1} is too dense. Shorten it or divide it before review/export.`,
      400,
    );
  });
}
export async function presentationLayout(content: WorkContent, scope: WorkScope, label: string) {
  const { font } = await document();
  return layoutWithFont(content, scope, label, font);
}
export async function presentationPdf(
  content: WorkContent,
  scope: WorkScope,
  label: string,
  date: string,
) {
  const { pdf, font } = await document();
  const slides = layoutWithFont(content, scope, label, font);
  pdf.setTitle(content.title);
  pdf.setAuthor('Aethelios');
  pdf.setProducer('Aethelios reviewed presentation');
  pdf.setCreationDate(new Date(date));
  pdf.setModificationDate(new Date(date));
  for (const slide of slides) {
    const page = pdf.addPage([slide.width, slide.height]);
    page.drawRectangle({ x: 0, y: 0, width: 960, height: 540, color: rgb(0.02, 0.04, 0.03) });
    page.drawRectangle({ x: 52, y: 23, width: 856, height: 1, color: rgb(0.3, 0.4, 0.34) });
    for (const line of slide.lines)
      page.drawText(line.text, {
        x: line.x,
        y: slide.height - line.y,
        font,
        size: line.size,
        color:
          line.kind === 'figure' || line.kind === 'footer'
            ? rgb(0.86, 0.72, 0.46)
            : line.kind === 'source'
              ? rgb(0.62, 0.72, 0.66)
              : rgb(0.94, 0.94, 0.9),
      });
  }
  return pdf.save();
}
