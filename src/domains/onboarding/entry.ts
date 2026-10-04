'use client';

/** The URL retains an explicit entry request even while the signup panel hydrates. */
export function requestAccountClaim() {
  const url = new URL(window.location.href);
  url.searchParams.set('claim', '1');
  url.hash = '';
  window.history.replaceState(null, '', url);
  window.dispatchEvent(new Event('gent-claim-account'));
}
