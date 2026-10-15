import 'server-only';
import { randomBytes } from 'node:crypto';

/** Client conversation-item IDs only: letter-led alphanumeric, 26 characters, 128 random bits.
 * This is an application format, not a claim about the provider's exact validation limit.
 * Database UUIDs and event correlation IDs use their existing formats.
 */
export function createLiveItemId() {
  return `c${BigInt(`0x${randomBytes(16).toString('hex')}`)
    .toString(36)
    .padStart(25, '0')}`;
}
