export type AssetBytes = {
  id: string;
  kind: 'version' | 'reference';
  bytes: Uint8Array;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  widthPx?: number;
  heightPx?: number;
};

export function imageDimensions(
  bytes: Uint8Array,
  mediaType: AssetBytes['mediaType'],
): { widthPx: number; heightPx: number } {
  if (mediaType === 'image/png') {
    if (bytes.length < 24) throw new Error('PNG header is incomplete.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { widthPx: view.getUint32(16), heightPx: view.getUint32(20) };
  }
  if (mediaType === 'image/jpeg') return jpegSize(bytes);
  return webpSize(bytes);
}

function jpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1]!;
    if (marker === 0xd9 || marker === 0xda) break;
    const size = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
      return { heightPx: (bytes[offset + 5]! << 8) | bytes[offset + 6]!, widthPx: (bytes[offset + 7]! << 8) | bytes[offset + 8]! };
    }
    offset += 2 + size;
  }
  throw new Error('JPEG dimensions could not be read.');
}

function webpSize(bytes: Uint8Array) {
  if (bytes.length < 30) throw new Error('WebP header is incomplete.');
  const four = (at: number) => String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
  if (four(0) !== 'RIFF' || four(8) !== 'WEBP') throw new Error('Not a WebP image.');
  const kind = four(12);
  if (kind === 'VP8X') {
    const width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
    const height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
    return { widthPx: width, heightPx: height };
  }
  if (kind === 'VP8L') {
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return { widthPx: (bits & 0x3fff) + 1, heightPx: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') {
    const start = 20;
    if (bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a)
      throw new Error('Unsupported VP8 frame.');
    const width = bytes[start + 6]! | (bytes[start + 7]! << 8);
    const height = bytes[start + 8]! | (bytes[start + 9]! << 8);
    return { widthPx: width & 0x3fff, heightPx: height & 0x3fff };
  }
  throw new Error('Unsupported WebP variant.');
}
