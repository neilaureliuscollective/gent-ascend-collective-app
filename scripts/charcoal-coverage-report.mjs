import { readFileSync, writeFileSync } from 'node:fs';
const directory = process.argv[2] || 'test-results/charcoal-routes';
const output = process.argv[3] || directory + '/coverage.md';
const after = JSON.parse(readFileSync(directory + '/after-matrix.json', 'utf8'));
const before = JSON.parse(readFileSync('docs/evidence/charcoal-pass/before-matrix.json', 'utf8'));
function availability(route) {
  if (['/app/aethelios', '/app/studio', '/app/architect'].includes(route))
    return 'Labelled API fixture; connected engine/Auth proof is separate CI.';
  if (route.startsWith('/app/health'))
    return 'Signed-out UI; private records unavailable. Existing local/sample foundations are supported.';
  if (route === '/app/founder/connections')
    return 'Founder/provider connections unavailable without owner authentication.';
  if (route === '/app/founder') return 'Founder access gate; private administration unavailable.';
  if (route === '/app/membership')
    return 'Membership UI; owner billing unavailable while signed out.';
  if (route === '/membership')
    return 'Public plan presentation checked; purchase/provider activation unavailable.';
  if (route === '/app/you') return 'Foundation preview; personal profile persistence unavailable.';
  if (route === '/shop/cart' || route === '/app/collection/cart')
    return 'Cart UI; shopping is not open in this configuration.';
  if (route.includes('/orders') || route.includes('/cabinet'))
    return 'Owner account/Shopify records unavailable; signed-out layout checked.';
  if (route === '/shop' || route === '/app/collection')
    return 'Existing catalogue presentation; live inventory/checkout unverified.';
  if (route === '/enter') return 'Entry presentation; environment reports entrance preparation.';
  if (route === '/join')
    return 'Account form rendered; authentication provider execution unverified.';
  if (route.startsWith('/app/'))
    return 'Default access/preview UI; authenticated personal writes unverified.';
  return 'Public layout and existing content checked.';
}
const routes = [...new Set(after.rows.map((r) => r.route))];
const lines = [
  '# Charcoal material route coverage',
  '',
  `After source: \`${after.commit}\`. Before source: \`${before.commit}\`.`,
  '',
  'Each route was visited at Fold 884×690 and desktop 1440×900. Checks include resolved loading state, page exceptions, horizontal reflow, charcoal environment role, screenshot dimensions and hashes. Core creation data is a labelled fixture; other pages use their real default access state. This is not hosted production or authenticated personal-data proof.',
  '',
  '| Route | Checked | Changed | Available / unavailable evidence |',
  '|---|---|---|---|',
];
for (const route of routes) {
  const rows = after.rows.filter((r) => r.route === route);
  const checked = rows.every((r) => !r.unavailable && !r.errors.length && !r.overflow);
  const changed = rows.some((r) => {
    const old = before.rows.find((b) => b.route === route && b.label === r.label);
    return (
      !old || JSON.stringify([old.tokens, old.surfaces]) !== JSON.stringify([r.tokens, r.surfaces])
    );
  });
  lines.push(
    `| ${route} | ${checked ? 'Fold + desktop' : 'See matrix failure'} | ${changed ? 'Shared material/palette' : 'Already aligned; shared contract checked'} | ${availability(route)} |`,
  );
}
lines.push(
  '',
  'The early Connections before capture showed a loading shell and was excluded from comparison images; its baseline state is explicitly unavailable. After capture requires that loading shell to close. Private-data routes and dynamic owner/company/project IDs were source-audited for shared styling; no account, entitlement, price, provider or record was fabricated to open them.',
  '',
  'Existing approved imagery, product labels, Work naming, layouts, charts/state indicators, opt-in material/motion preferences and all owner/nonce/revision/isolated-preview controls are retained. No backend, voice/transcript, schema or release changes are included.',
  '',
);
writeFileSync(output, lines.join('\n'));
