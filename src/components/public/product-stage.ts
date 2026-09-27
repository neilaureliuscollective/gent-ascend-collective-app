import * as THREE from 'three';

/** Procedural packaging study, not a final product asset. Render only on interaction. */
export function createProductStage(host: HTMLElement, onLost: () => void) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0.65, 6.8);
  camera.lookAt(0, 0.35, 0);
  const bottle = new THREE.Group();
  scene.add(bottle);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x10241c,
    metalness: 0.32,
    roughness: 0.22,
    clearcoat: 1,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xc4912f,
    metalness: 0.75,
    roughness: 0.28,
  });
  const black = new THREE.MeshStandardMaterial({
    color: 0x111713,
    metalness: 0.35,
    roughness: 0.3,
  });
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [glass, gold, black];
  function part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0) {
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    bottle.add(mesh);
    return mesh;
  }
  part(new THREE.CylinderGeometry(0.48, 0.48, 1.72, 64), glass, 0, 0);
  part(new THREE.CylinderGeometry(0.25, 0.48, 0.26, 64), glass, 0, 0.99);
  part(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 48), gold, 0, 1.21);
  part(new THREE.CylinderGeometry(0.15, 0.15, 0.19, 32), black, 0, 1.4);
  part(new THREE.BoxGeometry(0.59, 0.13, 0.23), black, 0.15, 1.56);
  part(new THREE.CylinderGeometry(0.48, 0.46, 0.09, 64), gold, 0, -0.87);
  const label = document.createElement('canvas');
  label.width = 512;
  label.height = 512;
  const context = label.getContext('2d')!;
  context.fillStyle = '#0b3b32';
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = '#c4912f';
  context.lineWidth = 3;
  context.strokeRect(20, 20, 472, 472);
  context.textAlign = 'center';
  context.fillStyle = '#e4c68b';
  context.font = '28px Georgia';
  context.fillText('LEGACY RESERVE', 256, 100);
  context.font = '62px Georgia';
  context.fillText('Vitalis', 256, 240);
  context.font = '18px sans-serif';
  context.fillText('HAIR & BEARD OIL', 256, 300);
  context.font = '15px sans-serif';
  context.fillText('PACKAGING STUDY', 256, 426);
  const texture = new THREE.CanvasTexture(label);
  texture.colorSpace = THREE.SRGBColorSpace;
  const labelMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65 });
  materials.push(labelMat);
  // Curved, front-facing label wraps the body without flattening the silhouette.
  part(new THREE.CylinderGeometry(0.485, 0.485, 1.1, 48, 1, true, -0.85, 1.7), labelMat, 0, -0.08);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 1.03, 0.12, 64), black);
  geometries.push(plinth.geometry);
  plinth.position.y = -1.03;
  scene.add(plinth);
  scene.add(new THREE.HemisphereLight(0xf3e7cc, 0x0b3b32, 2.4));
  const key = new THREE.DirectionalLight(0xffe0a1, 4);
  key.position.set(3, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x69cfaf, 5);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 2);
  fill.position.set(-2, 0, 3);
  scene.add(fill);
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  let disposed = false,
    frame = 0,
    visible = true;
  const draw = () => {
    frame = 0;
    if (!disposed && visible && !document.hidden) renderer.render(scene, camera);
  };
  const request = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  };
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (width && height) {
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      request();
    }
  });
  resize.observe(host);
  const observer = new IntersectionObserver(([e]) => {
    visible = Boolean(e?.isIntersecting);
    if (visible) request();
  });
  observer.observe(host);
  const lost = (event: Event) => {
    event.preventDefault();
    onLost();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  document.addEventListener('visibilitychange', request);
  request();
  return {
    rotate(degrees: number) {
      bottle.rotation.y = (degrees * Math.PI) / 180;
      request();
    },
    light(warm: boolean) {
      key.color.set(warm ? 0xffe0a1 : 0xd9fff0);
      rim.intensity = warm ? 5 : 8;
      request();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', request);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
