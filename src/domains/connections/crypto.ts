import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  createPrivateKey,
  createSign,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { ConnectionError } from './errors';

const PURPOSE = 'aethelios-connection-v1';

function keyBytes(key: string) {
  return Buffer.from(key, 'hex');
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function sealSecret(value: unknown, purpose: string, key: string, binding: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv);
  cipher.setAAD(Buffer.from(`${PURPOSE}|${purpose}|${binding}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

export function openSecret(
  raw: string | null | undefined,
  purpose: string,
  key: string,
  binding: string,
) {
  try {
    if (!raw || raw.length > 20000 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
    const bytes = Buffer.from(raw, 'base64url');
    if (bytes.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`${PURPOSE}|${purpose}|${binding}`));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'),
    ) as unknown;
  } catch {
    return null;
  }
}

export function githubAppJwt(appId: string, pem: string, now = Math.floor(Date.now() / 1000)) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }),
  ).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  try {
    return `${header}.${payload}.${signer.sign(createPrivateKey(pem), 'base64url')}`;
  } catch {
    throw new ConnectionError(
      'The GitHub App private key could not be used.',
      503,
      'setup_required',
    );
  }
}

export function equal(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hmacHex(algorithm: 'sha1' | 'sha256', secret: string, body: string) {
  return createHmac(algorithm, secret).update(body).digest('hex');
}
