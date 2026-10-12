// Bounded ISO BMFF validation; a MIME header alone does not establish a video file.
export function footageMp4(bytes: Uint8Array, seconds: number, ratio: string) {
  if (bytes.length < 64 || bytes.length > 30_000_000) throw new Error('Unsupported footage size.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  let count = 0,
    duration = 0,
    movie = false,
    media = false,
    format = false,
    dimensions = false;
  function boxes(start: number, end: number, depth: number) {
    if (depth > 5) throw new Error('Unsupported footage container.');
    for (let at = start; at < end;) {
      if (++count > 10000 || at + 8 > end) throw new Error('Incomplete footage container.');
      let size = view.getUint32(at),
        header = 8;
      if (size === 1) {
        if (at + 16 > end) throw new Error('Incomplete footage box.');
        const large = view.getBigUint64(at + 8);
        if (large > BigInt(bytes.length)) throw new Error('Oversized footage box.');
        size = Number(large);
        header = 16;
      } else if (size === 0) size = end - at;
      if (size < header || at + size > end) throw new Error('Incomplete footage box.');
      const kind = tag(at + 4),
        body = at + header,
        limit = at + size;
      if (kind === 'ftyp' && depth === 0) {
        if (size < header + 8) throw new Error('Missing footage format.');
        format = true;
      }
      if (kind === 'mdat' && depth === 0 && size > header) media = true;
      if (kind === 'moov' && depth === 0) movie = true;
      if (kind === 'mvhd') {
        if (body + 20 > limit) throw new Error('Missing footage duration.');
        const version = view.getUint8(body);
        if (version > 1 || (version === 1 && body + 32 > limit))
          throw new Error('Unsupported footage duration.');
        const rate = view.getUint32(body + (version === 1 ? 20 : 12));
        const ticks =
          version === 1 ? Number(view.getBigUint64(body + 24)) : view.getUint32(body + 16);
        duration = ticks / rate;
      }
      if (kind === 'tkhd' && size >= header + 84) {
        const width = view.getUint32(limit - 8) / 65536,
          height = view.getUint32(limit - 4) / 65536;
        const [w, h] = ratio.split(':').map(Number);
        if (width === w && height === h) dimensions = true;
      }
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(kind)) boxes(body, limit, depth + 1);
      at = limit;
    }
  }
  boxes(0, bytes.length, 0);
  if (
    !format ||
    !movie ||
    !media ||
    !dimensions ||
    !Number.isFinite(duration) ||
    duration < seconds - 0.5 ||
    duration > seconds + 0.5
  )
    throw new Error(
      'The footage format, dimensions or duration did not match the approved request.',
    );
  return { duration };
}
