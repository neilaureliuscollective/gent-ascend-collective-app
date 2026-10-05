// Browser fixture only. This adapter cannot reach application identity or data.
export function useRouter() {
  return {
    push: () => window.dispatchEvent(new Event('fixture-router-push')),
    refresh: () => window.dispatchEvent(new Event('fixture-router-refresh')),
  };
}
export function usePathname() {
  return location.pathname;
}
