import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
/** Actual Shopify-hosted product model. On-demand renders; no automatic spin. */
export async function createModelStage(host: HTMLElement, source: string, lost: () => void) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0.2, 4.2);
  const pivot = new THREE.Group();
  scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xffedcb, 0x0b3b32, 3));
  const key = new THREE.DirectionalLight(0xffe3ae, 4);
  key.position.set(3, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb6e1d0, 3);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  let disposed = false,
    visible = true,
    frame = 0;
  let model: THREE.Group | undefined;
  const cleanupModel = () => {
    const materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    model?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    textures.forEach((texture) => texture.dispose());
    materials.forEach((material) => material.dispose());
  };
  const draw = () => {
    frame = 0;
    if (!disposed && visible && !document.hidden) renderer.render(scene, camera);
  };
  const request = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(draw);
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
  const observer = new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    request();
  });
  const onLost = (event: Event) => {
    event.preventDefault();
    lost();
  };
  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    observer.disconnect();
    document.removeEventListener('visibilitychange', request);
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    cleanupModel();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
    if (!response.ok || Number(response.headers.get('content-length')) > 10000000)
      throw new Error('Model unavailable');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 10000000) throw new Error('Model too large');
    const gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', source).href);
    model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const dimension = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(dimension) || dimension <= 0) throw new Error('Invalid model');
    model.position.sub(bounds.getCenter(new THREE.Vector3()));
    pivot.add(model);
    pivot.scale.setScalar(2.1 / dimension);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.append(renderer.domElement);
    resize.observe(host);
    observer.observe(host);
    renderer.domElement.addEventListener('webglcontextlost', onLost);
    document.addEventListener('visibilitychange', request);
    request();
    return {
      rotate(degrees: number) {
        pivot.rotation.y = (degrees * Math.PI) / 180;
        request();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
