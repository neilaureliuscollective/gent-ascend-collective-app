import 'server-only';
// Stable cookie names remain for revocation/cleanup of previously linked accounts.
export const privateOrigin = 'https://aethelios.vercel.app';
export const bridgeCookie = 'aethelios-founder-link';
export const stateCookie = 'aethelios-link-state';
export const verifierCookie = 'aethelios-link-verifier';
export async function founderBridgeContext(_question: string): Promise<null> {
  void _question;
  return null;
}
export async function founderBridgeLinked() {
  return false;
}
