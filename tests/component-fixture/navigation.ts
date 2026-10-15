// Browser fixture only. This adapter cannot reach application identity or data.
export function useRouter() {
  return {
    push: () => window.dispatchEvent(new Event('fixture-router-push')),
    refresh: () => window.dispatchEvent(new Event('fixture-router-refresh')),
  };
}
export function usePathname() {
  const mode = new URLSearchParams(location.search).get('mode') ?? '';
  if (
    mode.startsWith('lifestyle-member') ||
    mode === 'lifestyle-list' ||
    mode === 'lifestyle-product' ||
    mode === 'lifestyle-film' ||
    mode === 'lifestyle-cart' ||
    mode === 'lifestyle-brand'
  )
    return '/app/lifestyle';
  return location.pathname;
}
