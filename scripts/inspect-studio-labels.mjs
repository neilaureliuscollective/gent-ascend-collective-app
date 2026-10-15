import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
const folder = 'docs/evidence/studio-labels/';
const receipts = [];
for (const name of ['synthetic-label.pdf', 'desktop-download.pdf', 'fold-download.pdf']) {
  const bytes = await readFile(folder + name),
    pdf = await PDFDocument.load(bytes),
    page = pdf.getPages()[0];
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(bytes.length < 10_000_000);
  const media = page.getMediaBox(),
    trim = page.getTrimBox(),
    bleed = page.getBleedBox();
  assert.ok(Math.abs(media.width - (124 * 72) / 25.4) < 0.001);
  assert.ok(Math.abs(media.height - (64 * 72) / 25.4) < 0.001);
  assert.ok(Math.abs(trim.width - (120 * 72) / 25.4) < 0.001);
  assert.ok(Math.abs(trim.height - (60 * 72) / 25.4) < 0.001);
  assert.deepEqual(bleed, media);
  const raw = bytes.toString('latin1');
  assert.ok(!raw.includes('/Subtype /Image'));
  assert.ok(!raw.includes('/Type /Font'));
  const stream = [...raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((m) => {
      try {
        return inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1');
      } catch {
        return m[1];
      }
    })
    .join('\n');
  assert.match(stream, /50 8 m/);
  assert.doesNotMatch(stream, /\bBT\b/);
  assert.match(stream, / rg\n/);
  receipts.push({
    file: name,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    mediaPoints: media,
    trimPoints: trim,
    bleedPoints: bleed,
    text: 'outlined glyph paths; no PDF font objects',
    logo: 'vector paths; no raster image XObjects',
    color: 'RGB operators',
    supplierApproval: false,
    fixture: true,
  });
}
await writeFile(folder + 'pdf-inspection.json', JSON.stringify(receipts, null, 2) + '\n');
console.log(
  'PASS: three downloaded/generated fixture PDFs; exact media/trim/bleed, RGB, outlined glyphs, vector logo, under 10 MB.',
);
