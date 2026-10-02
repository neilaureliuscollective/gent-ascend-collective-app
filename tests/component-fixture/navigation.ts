// Browser fixture only. This adapter cannot reach application identity or data.
export function useRouter() {
  return { refresh: () => window.dispatchEvent(new Event('fixture-router-refresh')) };
}
