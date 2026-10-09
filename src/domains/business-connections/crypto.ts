import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
export const nonce = () => randomBytes(32).toString('base64url');
export const challenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');
function key(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw Error('Connection encryption is not configured');
  return Buffer.from(secret, 'hex');
}
export function seal(value: unknown, secret: string, aad: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(aad));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return [iv, cipher.getAuthTag(), bytes].map((v) => v.toString('base64url')).join('.');
}
export function unseal(value: string, secret: string, aad: string): unknown {
  const parts = value.split('.');
  if (parts.length !== 3) throw Error('Invalid connection envelope');
  const [iv, tag, bytes] = parts.map((v) => Buffer.from(v, 'base64url'));
  if (!iv || !tag || !bytes) throw Error('Invalid envelope');
  const cipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString('utf8'));
}
export function equalState(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
