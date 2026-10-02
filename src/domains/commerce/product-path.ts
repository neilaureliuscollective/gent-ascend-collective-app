export function productPath(handle: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(handle)) return null;
  return `/shop/${handle}`;
}
