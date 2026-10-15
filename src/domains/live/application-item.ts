/** Reserved application-item namespace; never classify by message wording or a broad `c` prefix. */
export function isApplicationLiveItem(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (id.startsWith('ctx_')) return true;
  return /^c[0-9a-z]{25}$/.test(id) && id.slice(1) <= ((1n << 128n) - 1n).toString(36);
}

/** Shared encoding keeps browser-selected targets in the same compact namespace as server context. */
export function formatApplicationLiveItem(bytes: Uint8Array) {
  if (bytes.length !== 16) throw new Error('Live item IDs require 128 random bits');
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `c${BigInt(`0x${hex}`).toString(36).padStart(25, '0')}`;
}
