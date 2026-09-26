import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createIntelligenceStage(host: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const environmentScene = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene, 0.04);
  scene.environment = environment.texture;
  environmentScene.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
  camera.position.z = 6;
  const sculpture = new THREE.Group();
  scene.add(sculpture);
  const coreGeometry = new THREE.IcosahedronGeometry(0.62, 2);
  const coreMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0b3b32,
    emissive: 0x082c20,
    emissiveIntensity: 0.3,
    roughness: 0.28,
    metalness: 0.65,
    clearcoat: 1,
    flatShading: true,
    envMapIntensity: 0.65,
  });
  sculpture.add(new THREE.Mesh(coreGeometry, coreMaterial));
  const gold = new THREE.MeshStandardMaterial({ color: 0xc4912f, metalness: 0.85, roughness: 0.3 });
  const ringGeometries: THREE.TorusGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.TorusGeometry(0.94 + i * 0.22, 0.025, 8, 96);
    ringGeometries.push(geometry);
    const ring = new THREE.Mesh(geometry, gold);
    ring.rotation.set(0.4 + i * 0.8, 0.3 + i * 0.65, i * 0.6);
    sculpture.add(ring);
  }
  // Graduated brass bands and cardinal points make a crafted armillary instrument.
  const details: THREE.BufferGeometry[] = [];
  const tickGeometry = new THREE.BoxGeometry(0.014, 0.07, 0.025);
  details.push(tickGeometry);
  const graduations = new THREE.Group();
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const tick = new THREE.Mesh(tickGeometry, gold);
    tick.position.set(Math.sin(angle) * 1.38, Math.cos(angle) * 1.38, 0);
    tick.rotation.z = -angle;
    if (i % 6 === 0) tick.scale.y = 2;
    graduations.add(tick);
  }
  graduations.rotation.set(0.45, 0.3, 0);
  sculpture.add(graduations);
  const nodeGeometry = new THREE.SphereGeometry(0.065, 12, 8);
  details.push(nodeGeometry);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const jewel = new THREE.Mesh(nodeGeometry, gold);
    jewel.position.set(Math.sin(angle) * 1.16, Math.cos(angle) * 1.16, 0);
    sculpture.add(jewel);
  }
  const footGeometry = new THREE.CylinderGeometry(0.6, 0.76, 0.12, 64);
  details.push(footGeometry);
  const foot = new THREE.Mesh(footGeometry, coreMaterial);
  foot.position.y = -1.68;
  scene.add(foot);
  const stemGeometry = new THREE.CylinderGeometry(0.055, 0.16, 0.48, 24);
  details.push(stemGeometry);
  const stem = new THREE.Mesh(stemGeometry, gold);
  stem.position.y = -1.41;
  scene.add(stem);
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
  let elapsed = 0,
    lastPaint = 0;
  const paint = (now: number) => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;
    if (now - lastPaint < 33) {
      schedule();
      return;
    }
    elapsed += Math.min((now - lastPaint) / 1000, 0.05);
    lastPaint = now;
    const rect = host.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
    sculpture.rotation.set(
      0.12 + Math.sin(elapsed * 0.2) * 0.035,
      p * 0.6 - 0.3 + elapsed * 0.035,
      Math.sin(elapsed * 0.15) * 0.05,
    );
    graduations.rotation.z = elapsed * 0.025;
    renderer.render(scene, camera);
    host.dataset.ready = 'true';
    schedule();
  };
  const schedule = () => {
    if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(paint);
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
    details.forEach((g) => g.dispose());
    environment.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    host.dataset.ready = 'false';
  }
  schedule();
  return { dispose };
}
