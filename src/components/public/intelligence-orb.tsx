'use client';
import { useEffect, useRef } from 'react';

const vertex = `#version 300 es
in vec2 position;
void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time,energy,scroll;
out vec4 pixel;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
 vec2 p=uv*1.85;
 float radius=.73*(1.+.018*sin(time*1.4)+energy*.095);
 float r2=dot(p,p);
 float halo=exp(-pow(length(p)/1.04,2.)*3.1);
 vec3 color=vec3(.04,.30,.19)*halo*(.25+energy*.25);
 float alpha=halo*.30;
 if(r2<radius*radius){
  float depth=sqrt(max(radius*radius-r2,0.));
  vec3 n=normalize(vec3(p,depth)),back=normalize(vec3(p,-depth));
  vec3 light=normalize(vec3(-.65,.87,1.15));
  float diffuse=max(dot(n,light),0.),fresnel=pow(1.-max(n.z,0.),2.7);
  float turn=time*.17+scroll*.9;
  vec3 rotated=vec3(n.x*cos(turn)-n.z*sin(turn),n.y,n.x*sin(turn)+n.z*cos(turn));
  float flow=noise(rotated*4.8+vec3(0.,time*.16,0.));
  float strands=pow(.5+.5*sin(rotated.y*26.+atan(rotated.z,rotated.x)*5.+flow*7.-time*.55),9.);
  vec3 body=mix(vec3(.006,.025,.021),vec3(.035,.35,.24),.30+flow*.38+diffuse*.22);
  body+=vec3(.27,.79,.56)*(strands*(.21+energy*.19)+pow(max(dot(n,normalize(vec3(-.42,.34,1.))),0.),10.)*.26);
  body+=vec3(.37,.91,.68)*fresnel*(.48+energy*.24);
  body+=vec3(.33,.85,.66)*exp(-pow(length(p-vec2(-.13,.12))/.19,2.))*(.32+energy*.52);
  body+=vec3(.14,.35,.25)*diffuse*.13;
  body+=vec3(.19,.52,.35)*pow(.5+.5*sin(back.y*36.-atan(back.z,back.x)*8.+time*.4),18.)*.22*(1.-fresnel);
  float edge=1.-smoothstep(radius-.027,radius,length(p));
  color=mix(color,body,edge);alpha=max(alpha,edge);
 }
 vec2 q=vec2(p.x*.85+p.y*.52,p.y*.85-p.x*.52);
 float arc=exp(-abs(length(vec2(q.x/1.04,q.y/.23))-1.)*170.)*smoothstep(-.32,.35,q.y);
 color+=vec3(.77,.51,.22)*arc*(.24+scroll*.12+energy*.15);alpha=max(alpha,arc*.65);
 float spark=exp(-dot(p-vec2(.77,.13),p-vec2(.77,.13))*900.);
 color+=vec3(.95,.70,.36)*spark*.65;alpha=max(alpha,spark*.7);
 pixel=vec4(color,clamp(alpha,0.,1.));
}`;
function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}
/** Public, presentation-only adaptation of the founder Aethelios living orb. */
export function IntelligenceOrb({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !active || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const gl = el.getContext('webgl2', {
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, vertex);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    const buffer = gl.createBuffer();
    if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const attr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      time: gl.getUniformLocation(program, 'time'),
      energy: gl.getUniformLocation(program, 'energy'),
      scroll: gl.getUniformLocation(program, 'scroll'),
    };
    const chapter = el.closest<HTMLElement>('.ascend-emergence');
    let frame = 0,
      visible = false,
      disposed = false,
      lost = false,
      last = 0,
      elapsed = 0,
      energy = 0;
    const draw = (now: number) => {
      frame = 0;
      if (disposed || lost || !visible || document.hidden) return;
      const delta = Math.min(50, now - last || 32);
      if (now - last >= 32) {
        last = now;
        elapsed += delta * 0.001;
        const scroll = Number(chapter?.dataset.scrollProgress || 0);
        energy += (0.14 + Math.max(0, Math.min(1, (scroll - 0.35) / 0.45)) * 0.22 - energy) * 0.08;
        const size = Math.max(
          1,
          Math.min(500, Math.round(el.clientWidth * Math.min(devicePixelRatio || 1, 1.5))),
        );
        if (el.width !== size || el.height !== size) {
          el.width = size;
          el.height = size;
          gl.viewport(0, 0, size, size);
        }
        gl.uniform2f(uniforms.resolution, size, size);
        gl.uniform1f(uniforms.time, elapsed);
        gl.uniform1f(uniforms.energy, energy);
        gl.uniform1f(uniforms.scroll, scroll);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        el.parentElement!.dataset.rendered = 'true';
      }
      frame = requestAnimationFrame(draw);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (visible && !document.hidden && !lost && !disposed) {
        last = 0;
        frame = requestAnimationFrame(draw);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      sync();
    });
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      delete el.parentElement!.dataset.rendered;
      sync();
    };
    const contextRestored = () => {
      // A fresh mount rebuilds shader resources. The static artwork remains meanwhile.
      delete el.parentElement!.dataset.rendered;
    };
    observer.observe(el);
    document.addEventListener('visibilitychange', sync);
    el.addEventListener('webglcontextlost', contextLost);
    el.addEventListener('webglcontextrestored', contextRestored);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
      el.removeEventListener('webglcontextlost', contextLost);
      el.removeEventListener('webglcontextrestored', contextRestored);
      delete el.parentElement!.dataset.rendered;
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [active]);
  return (
    <div className="intelligence-orb" aria-hidden="true">
      <div className="intelligence-orb-static">
        <span className="intelligence-orb-contours" />
        <span className="intelligence-orb-light" />
      </div>
      <canvas ref={canvas} />
    </div>
  );
}
