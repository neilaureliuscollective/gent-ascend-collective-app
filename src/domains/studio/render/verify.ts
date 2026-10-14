export function inspectRenderedMp4(bytes: Uint8Array, expected: { seconds: number; width: number; height: number }) {
  if (bytes.length < 64 || bytes.length > 80_000_000) throw new Error('Unsupported film size.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  let duration = 0;
  let movie = false;
  let media = false;
  let format = false;
  let width = 0;
  let height = 0;
  function boxes(start: number, end: number, depth: number) {
    if (depth > 6) throw new Error('Unsupported film container.');
    for (let at = start; at < end; ) {
      if (at + 8 > end) throw new Error('Incomplete film container.');
      let size = view.getUint32(at);
      let header = 8;
      if (size === 1) {
        size = Number(view.getBigUint64(at + 8));
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) throw new Error('Incomplete film box.');
      const kind = tag(at + 4);
      const body = at + header;
      const limit = at + size;
      if (kind === 'ftyp' && depth === 0) format = true;
      if (kind === 'mdat' && depth === 0 && size > header) media = true;
      if (kind === 'moov' && depth === 0) movie = true;
      if (kind === 'mvhd') {
        const version = view.getUint8(body);
        const rate = view.getUint32(body + (version === 1 ? 20 : 12));
        const ticks = version === 1 ? Number(view.getBigUint64(body + 24)) : view.getUint32(body + 16);
        duration = ticks / rate;
      }
      if (kind === 'tkhd' && size >= header + 84) {
        const nextWidth = view.getUint32(limit - 8) / 65536;
        const nextHeight = view.getUint32(limit - 4) / 65536;
        if (nextWidth >= width) {
          width = nextWidth;
          height = nextHeight;
        }
      }
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(kind)) boxes(body, limit, depth + 1);
      at = limit;
    }
  }
  boxes(0, bytes.length, 0);
  if (!format || !movie || !media)
    throw new Error('The rendered file is not a complete MP4.');
  if (Math.abs(duration - expected.seconds) > 0.6)
    throw new Error(`Rendered duration was ${duration.toFixed(2)}s, expected ${expected.seconds}s.`);
  if (Math.round(width) !== expected.width || Math.round(height) !== expected.height)
    throw new Error(`Rendered frame was ${width}×${height}, expected ${expected.width}×${expected.height}.`);
  return { duration, width, height };
}
