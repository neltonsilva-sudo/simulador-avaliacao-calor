// CALDEIRAS — plumas de vapor: partículas na CPU (jato → empuxo → espalhamento sob o telhado), desenhadas como billboards
// instanciados ordenados de trás para frente, atlas de tufos suaves, iluminação por espalhamento (ambiente + sol com fase
// de Henyey-Greenstein: contraluz brilha), sem serrilhado (sem escrita de profundidade, fade junto à câmera e ao nascer).
import * as THREE from 'three';
import { puffAtlas } from './cald_tex.js';

const VS = /* glsl */`
attribute vec4 iPos;   // xyz + tamanho
attribute vec4 iData;  // alfa, rotação, tile, calor(0..1)
uniform float uNearFade;
varying vec2 vUv; varying float vA; varying float vTile; varying vec3 vWorld; varying float vHot; varying vec2 vCorner;
void main(){
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  float c = cos(iData.y), s = sin(iData.y);
  vec2 p = position.xy; vCorner = p * 2.0;
  mv.xy += mat2(c, s, -s, c) * p * iPos.w;
  vUv = uv; vA = iData.x * smoothstep(0.9, uNearFade, -mv.z); vTile = iData.z; vWorld = iPos.xyz; vHot = iData.w;
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */`
uniform sampler2D tAtlas; uniform vec3 uAmb; uniform vec3 uSun; uniform vec3 uSunDir; uniform vec3 uCam; uniform vec3 uWin;
varying vec2 vUv; varying float vA; varying float vTile; varying vec3 vWorld; varying float vHot; varying vec2 vCorner;
void main(){
  float t = floor(vTile + 0.5);
  vec2 uv = (vUv + vec2(mod(t, 2.0), floor(t / 2.0))) * 0.5;
  vec4 a = texture2D(tAtlas, uv);
  float alpha = a.r * vA;
  if (alpha < 0.002) discard;
  vec3 V = normalize(vWorld - uCam);
  float g = 0.55, ct = dot(V, -uSunDir);
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * ct, 1.5) * 0.25;
  float top = a.g;                         // "iluminação de cima" do tufo
  float thick = a.b;
  vec3 col = uAmb * (0.3 + 0.72 * top) * (1.0 - 0.3 * thick) + uSun * (0.18 + hg) * (0.45 + 0.55 * top) * (1.0 - 0.4 * thick);
  col += uWin * (0.3 + 0.7 * smoothstep(-0.2, 0.8, vCorner.y)) * 0.25;  // céu claro das janelas no topo do tufo
  col *= mix(1.0, 1.06, vHot);
  gl_FragColor = vec4(col, alpha);
}`;

export function createSteam(ctx, emitters) {
  const MAX = 1600;
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aDat = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iPos', aPos); geo.setAttribute('iData', aDat); geo.instanceCount = 0;
  const U = {
    tAtlas: { value: puffAtlas() }, uAmb: { value: new THREE.Color(1.05, 1.08, 1.12) }, uSun: { value: new THREE.Color(1.6, 1.55, 1.45) },
    uSunDir: { value: new THREE.Vector3(-0.35, -0.85, -0.4).normalize() }, uCam: { value: new THREE.Vector3() }, uWin: { value: new THREE.Color(0.9, 0.95, 1.0) }, uNearFade: { value: 2.6 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, transparent: true, depthWrite: false, depthTest: true });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.name = 'cald_steam';
  mesh.userData.noAO = true; mesh.castShadow = false; mesh.receiveShadow = false;
  ctx.group.add(mesh);

  // partículas
  const P = []; let rnd = 12345; const R = () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
  const CEIL = ctx.TRUSS_Y - 0.25;
  const E = [];
  for (const [id, e] of Object.entries(emitters)) {
    const cfg = {
      purgador: { rate: 70, life: [4.5, 7.5], v0: 2.6, spread: 0.13, s0: 0.03, grow: 0.36, a0: 0.33, drag: 1.25, buoy: 0.65, hot: 1 },
      respiro: { rate: 45, life: [7, 11], v0: 2.0, spread: 0.1, s0: 0.08, grow: 0.42, a0: 0.3, drag: 0.9, buoy: 0.55, hot: 0.8 },
      flash: { rate: 35, life: [6, 9.5], v0: 1.6, spread: 0.12, s0: 0.07, grow: 0.42, a0: 0.3, drag: 0.9, buoy: 0.55, hot: 0.8 },
      dreno: { rate: 5, life: [1.8, 3.2], v0: 0.35, spread: 0.6, s0: 0.05, grow: 0.16, a0: 0.18, drag: 1.2, buoy: 0.35, hot: 0.4 },
    }[id]; if (!cfg) continue;
    E.push({ id, pos: e.pos.clone(), dir: e.dir.clone().normalize(), acc: 0, on: 1, ...cfg });
  }
  // névoa de vapor acumulada sob o telhado (grandes tufos quase estáticos)
  const HZ = [];
  for (const e of E.filter((q) => q.id !== 'dreno')) for (let k = 0; k < 9; k++) {
    HZ.push({ p: new THREE.Vector3(e.pos.x + (R() - 0.5) * 7, CEIL - 0.3 - R() * 1.6, e.pos.z + (R() - 0.2) * 5), s: 3.0 + R() * 3.0, a: 0.04 + R() * 0.05, rot: R() * 6, tile: (R() * 4) | 0, ph: R() * 6, w: 0.05 + R() * 0.08 });
  }
  const tmp = new THREE.Vector3();
  function noise(x, y, z, t) { return Math.sin(x * 1.7 + t * 0.9 + Math.sin(z * 1.3 + t * 0.5)) * Math.cos(y * 1.1 - t * 0.7 + z * 0.4); }
  function spawn(e) {
    if (P.length >= MAX - HZ.length) return;
    const d = e.dir.clone().add(new THREE.Vector3((R() - 0.5) * e.spread * 2, (R() - 0.5) * e.spread * 2, (R() - 0.5) * e.spread * 2)).normalize();
    P.push({ p: e.pos.clone().addScaledVector(d, 0.02), v: d.multiplyScalar(e.v0 * (0.7 + R() * 0.6)), age: 0, life: e.life[0] + R() * (e.life[1] - e.life[0]),
      s: e.s0 * (0.8 + R() * 0.4), grow: e.grow * (0.8 + R() * 0.5), a0: e.a0 * (0.7 + R() * 0.5), rot: R() * 6.283, vr: (R() - 0.5) * 0.5, tile: (R() * 4) | 0, e });
  }
  const order = new Uint16Array(MAX), dist = new Float32Array(MAX);
  let T = 0;
  function update(dt, cam) {
    T += dt; dt = Math.min(dt, 0.05);
    for (const e of E) { e.acc += e.rate * e.on * dt; while (e.acc >= 1) { e.acc -= 1; spawn(e); } }
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.age += dt; if (q.age >= q.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const e = q.e, f = q.age / q.life;
      q.v.multiplyScalar(Math.exp(-e.drag * dt));
      q.v.y += e.buoy * (1 - f * 0.6) * dt;
      const n1 = noise(q.p.x, q.p.y, q.p.z, T), n2 = noise(q.p.z + 3.1, q.p.x - 1.7, q.p.y, T * 1.1);
      q.v.x += n1 * 0.45 * dt; q.v.z += n2 * 0.45 * dt; q.v.y += noise(q.p.y, q.p.z, q.p.x, T) * 0.15 * dt;
      q.p.addScaledVector(q.v, dt);
      if (q.p.y > CEIL) { q.p.y = CEIL; if (q.v.y > 0) { const sp = q.v.y * 0.8; q.v.y = 0; tmp.set(q.p.x - e.pos.x, 0, q.p.z - e.pos.z); if (tmp.lengthSq() < 1e-4) tmp.set(R() - 0.5, 0, R() - 0.5); tmp.normalize(); q.v.x += tmp.x * sp; q.v.z += tmp.z * sp; } }
      if (q.p.y < 0.05) { q.p.y = 0.05; q.v.y = Math.abs(q.v.y) * 0.2; }
      q.s += q.grow * dt * (1.0 + 2.2 * Math.exp(-q.age * 2.0)); q.rot += q.vr * dt;
    }
    // escrita + ordenação (trás → frente)
    const cp = cam.position; U.uCam.value.copy(cp);
    let n = 0;
    const items = [];
    for (const q of P) items.push(q);
    for (const h of HZ) items.push(h);
    for (let i = 0; i < items.length; i++) { order[i] = i; const q = items[i]; dist[i] = (q.p.x - cp.x) ** 2 + (q.p.y - cp.y) ** 2 + (q.p.z - cp.z) ** 2; }
    const idx = Array.from(order.subarray(0, items.length)).sort((a, b) => dist[b] - dist[a]);
    const pa = aPos.array, da = aDat.array;
    for (const i of idx) {
      const q = items[i];
      if (q.e) {
        const f = q.age / q.life, e = q.e;
        const a = q.a0 * Math.min(1, q.age / 0.12) * Math.pow(1 - f, 1.4) * Math.min(1, Math.max(0.3, 0.5 / Math.max(0.05, q.s)));
        pa[n * 4] = q.p.x; pa[n * 4 + 1] = q.p.y; pa[n * 4 + 2] = q.p.z; pa[n * 4 + 3] = q.s;
        da[n * 4] = a; da[n * 4 + 1] = q.rot; da[n * 4 + 2] = q.tile; da[n * 4 + 3] = e.hot * (1 - f);
      } else {
        const w = Math.sin(T * q.w + q.ph);
        pa[n * 4] = q.p.x + w * 0.4; pa[n * 4 + 1] = q.p.y; pa[n * 4 + 2] = q.p.z + Math.cos(T * q.w + q.ph) * 0.3; pa[n * 4 + 3] = q.s;
        da[n * 4] = q.a * (0.8 + 0.2 * w) * (E.length ? 1 : 0); da[n * 4 + 1] = q.rot + T * 0.01; da[n * 4 + 2] = q.tile; da[n * 4 + 3] = 0;
      }
      n++;
    }
    geo.instanceCount = n; aPos.needsUpdate = true; aDat.needsUpdate = true;
  }
  // pré-aquecimento (a pluma já existe quando o ambiente aparece)
  function warm(sec = 8, cam) { for (let t = 0; t < sec; t += 1 / 30) update(1 / 30, cam); }
  return { mesh, update, warm, uniforms: U, emitters: E };
}
