import { z } from 'zod';
const sha = z.string().regex(/^[a-f0-9]{40}$/);
const account = z.object({ authUserId: z.uuid(), personId: z.uuid() }).strict();
export const stagingSchema = z
  .object({
    contract: z.literal('public-creation-acceptance-v1'),
    scope: z.literal('isolated-staging'),
    projectRef: z.string().regex(/^[a-z]{20}$/),
    candidateTree: sha,
    candidateCommit: sha,
    deploymentOrigin: z.url(),
    expiresAt: z.iso.datetime({ offset: true }),
    syntheticWritesApproved: z.literal(true),
    branchIdentityVerified: z.literal(true),
    deploymentIdentityVerified: z.literal(true),
    accounts: z.tuple([account, account]),
  })
  .strict();
export type CreationScope = {
  scope: 'isolated-staging' | 'disposable-local';
  origin: string;
  supabaseUrl: string;
  projectRef: string;
  candidateTree: string;
  candidateCommit: string;
  accounts?: z.infer<typeof stagingSchema>['accounts'];
};
const protectedRefs = new Set(['volpzkfsnmtztrovexcw', 'tybjocxecilkmozkvuns']);
export function stagingScope(
  value: unknown,
  tree: string,
  commit: string,
  now = Date.now(),
): CreationScope {
  const m = stagingSchema.parse(value),
    url = new URL(m.deploymentOrigin),
    expiry = Date.parse(m.expiresAt);
  if (
    m.candidateTree !== tree ||
    m.candidateCommit !== commit ||
    protectedRefs.has(m.projectRef) ||
    expiry <= now ||
    expiry - now > 86400000 ||
    url.origin !== m.deploymentOrigin ||
    url.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.vercel\.app$/.test(url.hostname) ||
    url.port ||
    url.hostname === 'gent-ascend-collective-qrnfjypec-stutes-legacy.vercel.app' ||
    m.accounts[0].authUserId === m.accounts[1].authUserId ||
    m.accounts[0].personId === m.accounts[1].personId
  )
    throw new Error('Creation acceptance scope refused.');
  return {
    scope: m.scope,
    origin: m.deploymentOrigin,
    supabaseUrl: `https://${m.projectRef}.supabase.co`,
    projectRef: m.projectRef,
    candidateTree: tree,
    candidateCommit: commit,
    accounts: m.accounts,
  };
}
export function localScope(url: string, tree: string, commit: string): CreationScope {
  if (
    url !== 'http://127.0.0.1:54321' ||
    !sha.safeParse(tree).success ||
    !sha.safeParse(commit).success
  )
    throw new Error('Disposable local scope required.');
  return {
    scope: 'disposable-local',
    origin: 'http://127.0.0.1:3104',
    supabaseUrl: url,
    projectRef: 'local',
    candidateTree: tree,
    candidateCommit: commit,
  };
}
export function assertRuntime(value: unknown, scope: CreationScope) {
  const r = z
    .object({
      contract: z.literal('public-creation-runtime-v1'),
      mode: z.enum(['local', 'preview']),
      projectRef: z.string(),
      commit: sha,
      harnessEnabled: z.boolean(),
    })
    .strict()
    .parse(value);
  if (
    r.commit !== scope.candidateCommit ||
    r.projectRef !== scope.projectRef ||
    (scope.scope === 'isolated-staging' && (r.mode !== 'preview' || r.harnessEnabled)) ||
    (scope.scope === 'disposable-local' && r.mode !== 'local')
  )
    throw new Error('Runtime does not match accepted candidate/environment.');
}
export function publicAcceptanceKey(key: string) {
  if (key && key.length < 5000 && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return key;
  try {
    const parts = key.split('.');
    if (
      parts.length === 3 &&
      key.length < 5000 &&
      JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()).role === 'anon'
    )
      return key;
  } catch {
    /* redact */
  }
  throw new Error('A publishable key is required.');
}
export function protectionHeaders(
  origin: string,
  target: string,
  token?: string,
): Record<string, string> {
  return token && new URL(target).origin === origin
    ? { 'x-vercel-trusted-oidc-idp-token': token }
    : {};
}
