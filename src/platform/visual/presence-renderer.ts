import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  MeshPhongMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from 'three';
// One bounded decorative scene. Never reads identity, health or provider data.
export function mountPresence(host: HTMLDivElement): () => void {
  const canvas = document.createElement('canvas');
  canvas.className = 'presence-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  if (!context) return () => {};
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 20);
  camera.position.z = 5.2;
  const group = new Group();
  scene.add(group);
  const purple = new MeshPhongMaterial({
    color: '#23062B',
    specular: '#C4A2CB',
    shininess: 80,
    emissive: '#120316',
  });
  const gold = new MeshPhongMaterial({ color: '#D8B46E', specular: '#FFF1C9', shininess: 90 });
  const globe = new SphereGeometry(0.84, 40, 28);
  group.add(new Mesh(globe, purple));
  const ringGeometry = new TorusGeometry(1.06, 0.012, 6, 96);
  for (let i = 0; i < 3; i++) {
    const ring = new Mesh(ringGeometry, gold);
    ring.rotation.set(i === 0 ? 0.2 : i * 0.9, i * 0.85, -0.35);
    group.add(ring);
  }
  const nodeGeometry = new SphereGeometry(0.05, 12, 8);
  for (const [x, y, z] of [
    [-0.8, 0.65, 0.3],
    [0.8, -0.5, 0.45],
    [0.1, 1, 0.2],
  ] as const) {
    const node = new Mesh(nodeGeometry, gold);
    node.position.set(x, y, z);
    group.add(node);
  }
  scene.add(new AmbientLight('#B88EC5', 1.4));
  const key = new DirectionalLight('#FFF0C8', 4);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const rim = new DirectionalLight('#754385', 3);
  rim.position.set(2, -1, 1);
  scene.add(rim);
  let frame = 0,
    last = 0,
    elapsed = 0,
    visible = true,
    lost = false,
    disposed = false;
  function allowed() {
    return (
      visible &&
      !lost &&
      !disposed &&
      !document.hidden &&
      !document.querySelector('dialog[open]') &&
      !document.activeElement?.matches('input, textarea, [contenteditable="true"]')
    );
  }
  function render() {
    const working = host.dataset.state === 'working';
    purple.emissive.set(working ? '#35103D' : '#120316');
    group.rotation.y = Math.sin(elapsed * 0.00015) * 0.2;
    group.rotation.z = Math.sin(elapsed * 0.00012) * 0.05;
    renderer.render(scene, camera);
  }
  function tick(time: number) {
    frame = 0;
    if (!allowed()) return;
    if (time - last >= 33) {
      elapsed += Math.min(time - last, 40);
      last = time;
      render();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = performance.now();
    if (allowed()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || lost || disposed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    host.dataset.rendered = 'false';
    sync();
  }
  function contextRestored() {
    lost = false;
    resize();
    host.dataset.rendered = 'true';
    sync();
  }
  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  try {
    resize();
    host.append(canvas);
    host.dataset.rendered = 'true';
    resizeObserver.observe(host);
    intersection.observe(host);
  } catch {
    renderer.dispose();
    globe.dispose();
    ringGeometry.dispose();
    nodeGeometry.dispose();
    purple.dispose();
    gold.dispose();
    return () => {};
  }
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', sync);
  sync();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    intersection.disconnect();
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.removeEventListener('webglcontextrestored', contextRestored);
    document.removeEventListener('visibilitychange', sync);
    document.removeEventListener('focusin', sync);
    document.removeEventListener('focusout', sync);
    globe.dispose();
    ringGeometry.dispose();
    nodeGeometry.dispose();
    purple.dispose();
    gold.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    delete host.dataset.rendered;
  };
}
