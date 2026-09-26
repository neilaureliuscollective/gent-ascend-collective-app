import * as THREE from 'three';

export function createIntelligenceStage(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
  camera.position.z = 6;
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  const coreGeometry = new THREE.SphereGeometry(0.78, 48, 32);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0b3b32,
    emissive: 0x082c20,
    emissiveIntensity: 0.3,
    roughness: 0.48,
    metalness: 0.3,
    clearcoat: 1,
  });
  sculpture.add(new THREE.Mesh(coreGeometry, coreMaterial));
  const gold = new THREE.MeshStandardMaterial({ color: 0xc4912f, metalness: 0.85, roughness: 0.3 });
  const ringGeometries: THREE.TorusGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.TorusGeometry(1.1 + i * 0.2, 0.009, 8, 100);
    ringGeometries.push(geometry);
    const ring = new THREE.Mesh(geometry, gold);
    ring.rotation.set(0.4 + i * 0.8, 0.3 + i * 0.65, i * 0.6);
    sculpture.add(ring);
  }
  scene.add(new THREE.HemisphereLight(0xffe8b9, 0x0b3b32, 3));
  const light = new THREE.DirectionalLight(0xffdda2, 5);
  light.position.set(2, 3, 4);
  scene.add(light);
  const rim = new THREE.DirectionalLight(0x4ddaac, 4);
  rim.position.set(-2, 1, 2);
  scene.add(rim);
  let frame = 0,
    visible = true,
    disposed = false;
  const paint = () => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    const rect = host.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
    sculpture.rotation.set(0.12, p * 0.9 - 0.45, p * 0.4);
    renderer.render(scene, camera);
    host.dataset.ready = 'true';
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const resize = new ResizeObserver(() => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    schedule();
  });
  const visibility = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    if (visible) schedule();
  });
  const lost = (event: Event) => {
    event.preventDefault();
    dispose();
  };
  host.append(renderer.domElement);
  resize.observe(host);
  visibility.observe(host);
  addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', schedule);
  renderer.domElement.addEventListener('webglcontextlost', lost);
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    visibility.disconnect();
    removeEventListener('scroll', schedule);
    document.removeEventListener('visibilitychange', schedule);
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    coreGeometry.dispose();
    coreMaterial.dispose();
    gold.dispose();
    ringGeometries.forEach((g) => g.dispose());
    renderer.dispose();
    renderer.domElement.remove();
    host.dataset.ready = 'false';
  }
  schedule();
  return { dispose };
}
