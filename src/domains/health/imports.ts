import { observationSchema, type Observation } from './schema';

const columns = ['name', 'value', 'unit', 'date', 'code', 'specimen', 'method', 'range', 'flag'];
/** RFC4180 quoting, bounded rows and cells; never execute spreadsheet formulas. */
export function parseCsv(text: string): string[][] {
  if (text.length > 200000) throw new Error('Import exceeds 200 KB.');
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length) throw new Error('Invalid CSV quoting.');
      else {
        if (closed) throw new Error('Invalid CSV quoting.');
        if (quoted) closed = true;
        quoted = !quoted;
      }
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
      closed = false;
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
      closed = false;
    } else {
      if (closed && !quoted) throw new Error('Invalid characters after CSV quote.');
      cell += c;
    }
    if (cell.length > 1000 || rows.length > 101 || row.length > 12)
      throw new Error('Import limits exceeded.');
  }
  if (quoted) throw new Error('Unclosed CSV field.');
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseLabImport(text: string, format: 'csv' | 'json'): Observation[] {
  if (text.length > 200000) throw new Error('Import exceeds 200 KB.');
  let entries: unknown;
  if (format === 'json') entries = JSON.parse(text);
  else {
    const [header, ...rows] = parseCsv(text.replace(/^\uFEFF/, ''));
    if (
      !header ||
      new Set(header).size !== header.length ||
      header.some((h) => !columns.includes(h)) ||
      ['name', 'value', 'unit', 'date'].some((h) => !header.includes(h))
    )
      throw new Error('Use the supplied lab CSV columns.');
    entries = rows.map((row) => {
      if (row.length !== header.length) throw new Error('CSV row length does not match columns.');
      return Object.fromEntries(header.map((h, i) => [h, row[i]!.trim()]));
    });
  }
  if (!Array.isArray(entries) || !entries.length || entries.length > 100)
    throw new Error('Import 1–100 results at a time.');
  return entries.map((entry) =>
    observationSchema.parse({ ...(entry as object), id: crypto.randomUUID() }),
  );
}
export function originalMime(bytes: Uint8Array): string | null {
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  return null;
}
