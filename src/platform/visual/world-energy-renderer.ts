const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time,energy,mood,theme;
out vec4 pixel;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
 vec2 p=uv*2.25;
 float radius=.73*(1.+.018*sin(time*1.4)+energy*.095);
 float r2=dot(p,p);
 float halo=exp(-pow(length(p)/1.04,2.)*3.1);
 vec3 color=vec3(.05,.46,.28)*halo*(.19+energy*.17);
 float alpha=halo*.30;
 if(r2<radius*radius){
  float depth=sqrt(max(radius*radius-r2,0.));
  vec3 n=normalize(vec3(p,depth)),back=normalize(vec3(p,-depth));
  vec3 light=normalize(vec3(-.65,.87,1.15));
  float diffuse=max(dot(n,light),0.),fresnel=pow(1.-max(n.z,0.),2.7);
  vec3 rotated=vec3(n.x*cos(time*.13)-n.z*sin(time*.13),n.y,n.x*sin(time*.13)+n.z*cos(time*.13));
  float flow=noise(rotated*4.8+vec3(0.,time*.16,0.));
  float strands=pow(.5+.5*sin(rotated.y*26.+atan(rotated.z,rotated.x)*5.+flow*7.-time*.55),9.);
  vec3 body=mix(vec3(.003,.023,.016),vec3(.035,.42,.25),.30+flow*.38+diffuse*.22);
  body+=vec3(.34,.95,.64)*(strands*(.10+energy*.19)+pow(max(dot(n,normalize(vec3(-.42,.34,1.))),0.),10.)*.23);
  body+=vec3(.43,.98,.68)*fresnel*(.50+energy*.24);
  body+=vec3(.29,.85,.49)*exp(-pow(length(p-vec2(-.13,.12))/.19,2.))*(.28+energy*.52);
  body+=vec3(.08,.26,.16)*smoothstep(.5,1.,mood)*diffuse*.13;
  body+=vec3(.70,.48,.16)*pow(.5+.5*sin(back.y*36.-atan(back.z,back.x)*8.+time*.4),18.)*.22*(1.-fresnel);
  float edge=1.-smoothstep(radius-.027,radius,length(p));
  color=mix(color,body,edge);alpha=max(alpha,edge);
 }

 vec2 q=vec2(p.x*.85+p.y*.52,p.y*.85-p.x*.52);
 float arc=exp(-abs(length(vec2(q.x/1.04,q.y/.23))-1.)*170.)*smoothstep(-.32,.35,q.y);
 color+=vec3(.77,.51,.22)*arc*(.24+(mood>1.5 && mood<2.5 ? .16 : 0.)+energy*.15);alpha=max(alpha,arc*.65);
 float spark=exp(-dot(p-vec2(.77,.13),p-vec2(.77,.13))*900.);
 color+=vec3(.95,.70,.36)*spark*.65;alpha=max(alpha,spark*.7);
 pixel=vec4(color,clamp(alpha,0.,1.));
}`;

/** A single bounded shader plane, adapted from the founder's Aethelios reference. */
export function mountWorldEnergy(host: HTMLElement) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  if (!gl) return () => {};
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  let frame = 0,
    disposed = false,
    lost = false,
    visible = true,
    last = 0,
    elapsed = 0,
    slow = 0,
    scale = 1.5;
  const scene = host.closest('.gw-atlas');
  const contrast = matchMedia('(forced-colors: active)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const cleanupGPU = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    shaders.forEach((s) => gl.deleteShader(s));
  };
  if (!program || !buffer) {
    cleanupGPU();
    return () => {};
  }
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) {
      cleanupGPU();
      return () => {};
    }
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      cleanupGPU();
      return () => {};
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    cleanupGPU();
    return () => {};
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'resolution'),
    time = gl.getUniformLocation(program, 'time');
  gl.uniform1f(gl.getUniformLocation(program, 'energy'), 0.04);
  gl.uniform1f(gl.getUniformLocation(program, 'mood'), 0);
  host.append(canvas);
  const allowed = () =>
    !disposed &&
    !lost &&
    visible &&
    !document.hidden &&
    !contrast.matches &&
    !motion.matches &&
    scene?.getAttribute('data-animated') !== 'false' &&
    !document.querySelector('dialog[open]') &&
    !document.activeElement?.matches('input,textarea,[contenteditable="true"]');
  function draw(now: number) {
    frame = 0;
    if (!allowed()) return;
    frame = requestAnimationFrame(draw);
    if (last && now - last < 32) return;
    const delta = last ? now - last : 32;
    if (delta > 65 && ++slow > 20) scale = 1;
    elapsed += Math.min(delta, 50) / 1000;
    last = now;
    const size = Math.min(
      480,
      Math.max(1, Math.round(host.clientWidth * Math.min(devicePixelRatio || 1, scale))),
    );
    if (canvas.width !== size) {
      canvas.width = canvas.height = size;
      gl!.viewport(0, 0, size, size);
    }
    gl!.uniform2f(resolution, size, size);
    gl!.uniform1f(time, elapsed);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    host.dataset.rendered = 'true';
  }
  function sync() {
    if (allowed()) {
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(draw);
      }
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }
  function contextLost(event: Event) {
    event.preventDefault();
    lost = true;
    delete host.dataset.rendered;
    sync();
  }
  canvas.addEventListener('webglcontextlost', contextLost);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false;
    sync();
  });
  intersection.observe(host);
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['open', 'data-animated'],
  });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('focusin', sync);
  document.addEventListener('focusout', sync);
  contrast.addEventListener('change', sync);
  motion.addEventListener('change', sync);
  sync();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    intersection.disconnect();
    observer.disconnect();
    document.removeEventListener('visibilitychange', sync);
    document.removeEventListener('focusin', sync);
    document.removeEventListener('focusout', sync);
    contrast.removeEventListener('change', sync);
    motion.removeEventListener('change', sync);
    canvas.removeEventListener('webglcontextlost', contextLost);
    cleanupGPU();
    canvas.remove();
    delete host.dataset.rendered;
  };
}
