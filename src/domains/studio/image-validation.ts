export const maxReferenceBytes = 10_485_760;
export type ReferenceType = 'image/png' | 'image/jpeg' | 'image/webp';
export function referenceType(bytes: Uint8Array): ReferenceType | null {
  if (bytes.length < 100 || bytes.length > maxReferenceBytes) return null;
  if (Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP') return 'image/webp';
  return null;
}
export function referenceExtension(type: ReferenceType) {
  return type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp';
}
