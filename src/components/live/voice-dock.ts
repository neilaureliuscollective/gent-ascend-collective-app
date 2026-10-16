/** Talk registers its input-dock node; Live compact chrome portals into it when present. */
let dockNode: HTMLElement | null = null;
const listeners = new Set<() => void>();

export function attachTalkVoiceDock(node: HTMLElement | null) {
  if (dockNode === node) return;
  dockNode = node;
  listeners.forEach((listener) => listener());
}

export function subscribeTalkVoiceDock(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getTalkVoiceDock() {
  return dockNode;
}

export function getTalkVoiceDockSnapshot() {
  return null;
}
