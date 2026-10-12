// Small, bounded STORE-only ZIP writer. Exports contain reviewed files, never storage keys.
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]!;
  return (crc ^ 0xffffffff) >>> 0;
}
export function exportZip(files: { name: string; bytes: Uint8Array }[]) {
  if (
    files.length < 1 ||
    files.length > 5 ||
    files.reduce((sum, f) => sum + f.bytes.length, 0) > 50_000_000
  )
    throw new Error('This export is too large. Download individual assets instead.');
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    if (!/^[a-zA-Z0-9_-]+\.(png|json|md)$/.test(file.name))
      throw new Error('Invalid export filename.');
    const name = new TextEncoder().encode(file.name),
      crc = crc32(file.bytes);
    const header = new Uint8Array(30 + name.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, file.bytes.length, true);
    h.setUint32(22, file.bytes.length, true);
    h.setUint16(26, name.length, true);
    header.set(name, 30);
    const directory = new Uint8Array(46 + name.length);
    const d = new DataView(directory.buffer);
    d.setUint32(0, 0x02014b50, true);
    d.setUint16(4, 20, true);
    d.setUint16(6, 20, true);
    d.setUint32(16, crc, true);
    d.setUint32(20, file.bytes.length, true);
    d.setUint32(24, file.bytes.length, true);
    d.setUint16(28, name.length, true);
    d.setUint32(42, offset, true);
    directory.set(name, 46);
    local.push(header, file.bytes);
    central.push(directory);
    offset += header.length + file.bytes.length;
  }
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(
    12,
    central.reduce((n, c) => n + c.length, 0),
    true,
  );
  e.setUint32(16, offset, true);
  const parts = [...local, ...central, end];
  const output = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let cursor = 0;
  for (const part of parts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}
