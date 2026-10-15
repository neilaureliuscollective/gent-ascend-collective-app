export type DiffLine = {
  kind: 'context' | 'add' | 'remove';
  text: string;
};

export function lineDiff(before: string, after: string): DiffLine[] {
  if (before === after) return before.split('\n').map((text) => ({ kind: 'context', text }));
  const a = before.split('\n');
  const b = after.split('\n');
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      lines.push({ kind: 'context', text: a[i]! });
      i += 1;
      j += 1;
      continue;
    }
    if (i < a.length && (j >= b.length || !b.slice(j).includes(a[i]!))) {
      lines.push({ kind: 'remove', text: a[i]! });
      i += 1;
      continue;
    }
    if (j < b.length) {
      lines.push({ kind: 'add', text: b[j]! });
      j += 1;
    }
  }
  return lines;
}

export function unifiedHunk(path: string, before: string, after: string) {
  const lines = lineDiff(before, after);
  return [
    `--- a/${path}`,
    `+++ b/${path}`,
    '@@',
    ...lines.map((line) =>
      line.kind === 'add' ? `+${line.text}` : line.kind === 'remove' ? `-${line.text}` : ` ${line.text}`,
    ),
  ].join('\n');
}
