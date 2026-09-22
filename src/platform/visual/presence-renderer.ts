import {
  ACESFilmicToneMapping,
  CanvasTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three';
import { orbEnergy, readOrbState, type OrbState } from './presence-state';

// A bounded presentation renderer. No identity, microphone, model or private data access.
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
  renderer.debug.onShaderError = () => {
    throw new Error('Orb shader unavailable');
  };
  renderer.setClearColor(0, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 20);
  camera.position.z = 5;
  const group = new Group();
  group.rotation.z = -0.15;
  scene.add(group);
  let environment: ReturnType<PMREMGenerator['fromEquirectangular']> | undefined;
  let environmentSource: CanvasTexture | undefined;
  let generator: PMREMGenerator | undefined;
  let frame = 0,
    last = 0,
    elapsed = 0,
    orbitTime = 0,
    stateTime = 0,
    energy = 0;
  let visible = false,
    lost = false,
    disposed = false,
    degraded = false;
  let state: OrbState = readOrbState(host.dataset.state);
  let observedState = state;
  let frames = 0;
  let quality = 1.5,
    budgetFrames = 0,
    slowFrames = 0;
  const cleanGpu = () => {
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    environment?.dispose();
    environmentSource?.dispose();
    generator?.dispose();
    renderer.dispose();
  };

  try {
    // Small procedural studio reflection map: no image, HDR or model downloads.
    const studio = document.createElement('canvas');
    studio.width = 256;
    studio.height = 128;
    const paint = studio.getContext('2d');
    if (!paint) throw new Error('Studio surface unavailable');
    paint.fillStyle = '#12100e';
    paint.fillRect(0, 0, 256, 128);
    for (const [x, width, strength] of [
      [42, 16, 1],
      [158, 36, 0.75],
      [220, 7, 0.55],
    ] as const) {
      const gradient = paint.createLinearGradient(x - width, 0, x + width, 0);
      gradient.addColorStop(0, '#12100e');
      gradient.addColorStop(0.45, `rgba(255,244,224,${strength})`);
      gradient.addColorStop(0.55, `rgba(255,244,224,${strength})`);
      gradient.addColorStop(1, '#12100e');
      paint.fillStyle = gradient;
      paint.fillRect(x - width, 12, width * 2, 95);
    }
    environmentSource = new CanvasTexture(studio);
    environmentSource.mapping = EquirectangularReflectionMapping;
    environmentSource.colorSpace = SRGBColorSpace;
    generator = new PMREMGenerator(renderer);
    environment = generator.fromEquirectangular(environmentSource);
    scene.environment = environment.texture;
    generator.dispose();
    generator = undefined;

    const gold = new MeshStandardMaterial({
      color: '#C4912F',
      metalness: 1,
      roughness: 0.24,
      envMapIntensity: 1.8,
    });
    const lightGold = new MeshStandardMaterial({
      color: '#F6DFA4',
      emissive: '#D5A24B',
      emissiveIntensity: 0.45,
      metalness: 0.75,
      roughness: 0.2,
    });
    materials.push(gold, lightGold);
    // Layered light inside a shaded sphere. No expensive transmission or ray marching.
    const core = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uEnergy: { value: 0 }, uWorking: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = -mv.xyz; vLocal = position;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uEnergy; uniform float uWorking;
        varying vec3 vNormal; varying vec3 vView; varying vec3 vLocal;
        void main() {
          vec3 n = normalize(vNormal); vec3 v = normalize(vView);
          float facing = max(dot(n, v), 0.0);
          float rim = pow(1.0 - facing, 3.0);
          vec3 p = vLocal;
          float flow = sin(p.x * 5.0 + p.y * 4.0 + sin(p.z * 6.0 + uTime * 0.17));
          float layer = sin(p.y * 8.0 - p.z * 3.0 + flow * 1.4 + uTime * 0.12);
          float filament = pow(max(0.0, 1.0 - abs(layer)), 9.0);
          float dust = pow(max(0.0, sin(p.x * 52.0) * sin(p.y * 61.0 + p.z * 44.0 + flow * 12.0)), 64.0);
          float well = exp(-length(p.xy - vec2(-0.16, 0.15)) * 2.8);
          vec3 color = mix(vec3(0.002, 0.007, 0.005), vec3(0.002, 0.024, 0.016), facing);
          color += vec3(0.004, 0.055, 0.033) * well * (0.6 + flow * 0.13);
          color += vec3(0.011, 0.095, 0.060) * filament * well * (0.5 + uEnergy * 1.6);
          color += vec3(0.48, 0.28, 0.08) * dust * well * (0.1 + uEnergy);
          float wave = pow(max(0.0, sin(length(p.xy) * 18.0 - uTime * 4.2)), 6.0);
          color += vec3(0.012, 0.065, 0.043) * wave * uEnergy * facing;
          color += vec3(0.014, 0.065, 0.047) * rim;
          vec3 light = normalize(vec3(-0.7, 1.0, 1.8));
          float spec = pow(max(dot(n, normalize(light + v)), 0.0), 130.0);
          float soft = pow(max(dot(n, normalize(light + v)), 0.0), 14.0);
          color += vec3(0.95, 0.79, 0.58) * spec * 0.32;
          color += vec3(0.13, 0.24, 0.19) * soft * 0.27;
          color += vec3(0.008, 0.055, 0.035) * well * uWorking;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    materials.push(core);
    const sphere = new SphereGeometry(0.8, 48, 32);
    geometries.push(sphere);
    group.add(new Mesh(sphere, core));

    const rings: Group[] = [];
    for (const [radius, thickness, x, y, z] of [
      [1.04, 0.024, 0.4, 0.15, -0.3],
      [0.99, 0.014, 0.25, 1.08, -0.48],
      [1.1, 0.009, 1.14, 0.18, 0.38],
    ] as const) {
      const ring = new Group();
      ring.rotation.set(x, y, z);
      const geometry = new TorusGeometry(radius, thickness, 8, 112);
      geometries.push(geometry);
      ring.add(new Mesh(geometry, gold));
      rings.push(ring);
      group.add(ring);
    }
    const nodeGeometry = new SphereGeometry(0.04, 12, 8);
    geometries.push(nodeGeometry);
    const nodes = rings.map((ring, i) => {
      const node = new Mesh(nodeGeometry, i === 0 ? lightGold : gold);
      ring.add(node);
      return node;
    });
    // The four-point compass star is the logo's quiet focal detail.
    const starShape = new Shape();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = i % 2 === 0 ? 0.17 : 0.029;
      const x = Math.sin(angle) * radius;
      const y = Math.cos(angle) * radius;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starGeometry = new ExtrudeGeometry(starShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.007,
      bevelThickness: 0.007,
    });
    geometries.push(starGeometry);
    const starMaterial = new MeshStandardMaterial({
      color: '#C4912F',
      metalness: 0.8,
      roughness: 0.27,
      emissive: '#6B4215',
      emissiveIntensity: 0.25,
    });
    materials.push(starMaterial);
    const star = new Mesh(starGeometry, starMaterial);
    star.position.z = 0.818;
    group.add(star);
    const key = new DirectionalLight('#FFF1D0', 3);
    key.position.set(-2, 3, 4);
    scene.add(key);
    const edge = new DirectionalLight('#A4D5BC', 1.2);
    edge.position.set(2, -1, 2);
    scene.add(edge);

    function allowed() {
      return (
        visible &&
        !lost &&
        !disposed &&
        !degraded &&
        !document.hidden &&
        !document.querySelector('dialog[open]') &&
        !document.activeElement?.matches('input, textarea, [contenteditable="true"]') &&
        !matchMedia('(forced-colors: active)').matches
      );
    }
    function render(dt = 0) {
      state = readOrbState(host.dataset.state);
      if (state !== observedState) {
        stateTime = 0;
        energy = 0;
        observedState = state;
      }
      stateTime += dt;
      if (state !== 'stopped') orbitTime += dt * (state === 'working' ? 0.45 : 0.055);
      const target = orbEnergy(state, stateTime);
      energy += (target - energy) * (1 - Math.exp(-dt * 13));
      // Stopped/disconnected never simulate a continuing response.
      if (state === 'stopped' || state === 'disconnected') energy = 0;
      core.uniforms.uTime!.value = elapsed;
      core.uniforms.uEnergy!.value = energy;
      core.uniforms.uWorking!.value = state === 'working' ? 1 : 0;
      group.rotation.y = Math.sin(elapsed * 0.12) * 0.13;
      group.rotation.z = -0.15 + Math.sin(elapsed * 0.09) * 0.035;
      const radii = [1.04, 0.99, 1.1];
      nodes.forEach((node, i) => {
        const angle = i * 2.2 + 2.4 + orbitTime;
        node.position.set(Math.cos(angle) * radii[i]!, Math.sin(angle) * radii[i]!, 0);
      });
      lightGold.emissiveIntensity = 0.45 + energy;
      renderer.render(scene, camera);
      // Read-only diagnostic for reproducible lifecycle tests; no per-frame DOM updates.
      frames++;
    }
    function tick(time: number) {
      frame = 0;
      if (!allowed()) {
        host.dataset.animating = 'false';
        return;
      }
      if (time - last >= 32) {
        // Sustained missed frames lower resolution once per window, never oscillate.
        // Ignore the first few frames while shaders and the reflection map warm up.
        if (frames > 12) {
          budgetFrames++;
          if (time - last > 55) slowFrames++;
          if (budgetFrames >= 30) {
            if (slowFrames >= 6) {
              if (quality > 0.75) {
                quality -= 0.25;
                resize();
              } else {
                // The polished SVG takes over if the scene still competes with input.
                degraded = true;
                host.dataset.rendered = 'false';
                host.dataset.animating = 'false';
                host.dataset.fallback = 'frame-budget';
                return;
              }
            }
            budgetFrames = 0;
            slowFrames = 0;
          }
        }
        const dt = Math.min((time - last) / 1000, 0.05);
        last = time;
        if (state !== 'stopped') elapsed += dt;
        render(dt);
      }
      if (state !== 'stopped') frame = requestAnimationFrame(tick);
      else host.dataset.animating = 'false';
    }
    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      host.dataset.frames = String(frames);
      const active = allowed() && readOrbState(host.dataset.state) !== 'stopped';
      host.dataset.animating = String(active);
      if (active) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    function resize() {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height || lost || disposed || degraded) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, quality, 480 / Math.max(width, height)));
      renderer.setSize(width, height, false);
      host.dataset.quality = String(quality);
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
      if (disposed || degraded) return;
      try {
        // Render-target contents do not survive context loss; rebuild reflections.
        environment?.dispose();
        generator = new PMREMGenerator(renderer);
        environment = generator.fromEquirectangular(environmentSource!);
        scene.environment = environment.texture;
        generator.dispose();
        generator = undefined;
        lost = false;
        resize();
        host.dataset.rendered = 'true';
        sync();
      } catch {
        lost = true;
        host.dataset.rendered = 'false';
        sync();
      }
    }
    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    const stateObserver = new MutationObserver(() => {
      if (!lost && !disposed && !degraded && !document.hidden && visible) render();
      sync();
    });
    const dialogObserver = new MutationObserver(sync);
    const colors = matchMedia('(forced-colors: active)');
    resize();
    host.append(canvas);
    host.dataset.rendered = 'true';
    resizeObserver.observe(host);
    intersection.observe(host);
    stateObserver.observe(host, {
      attributes: true,
      attributeFilter: ['data-state', 'data-preview'],
    });
    dialogObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['open'],
      subtree: true,
    });
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', sync);
    colors.addEventListener('change', sync);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      stateObserver.disconnect();
      dialogObserver.disconnect();
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', sync);
      colors.removeEventListener('change', sync);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      cleanGpu();
      renderer.forceContextLoss();
      canvas.remove();
      delete host.dataset.rendered;
      delete host.dataset.animating;
      delete host.dataset.frames;
      delete host.dataset.quality;
      delete host.dataset.fallback;
    };
  } catch {
    cleanGpu();
    canvas.remove();
    delete host.dataset.rendered;
    return () => {};
  }
}
