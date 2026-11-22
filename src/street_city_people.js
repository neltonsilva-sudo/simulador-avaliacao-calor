// CIDADE — pedestres: corpo articulado leve (tronco+cabeça, coxas, canelas, braços = 7 malhas com cores de vértice)
// e ciclo de caminhada simples em vaivém. Nunca atravessam o trecho do voo da câmera (z ∈ [−6; 6]).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RUA, ruaY, ruaX } from './layout_rua.js';

const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
function part(list, g, col, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  const geo = (g.index ? g.toNonIndexed() : g.clone()); geo.deleteAttribute('uv');
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz)));
  const c = new THREE.Color(col), arr = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); list.push(geo);
}
const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10), SPH = new THREE.SphereGeometry(1, 14, 10), CYL = new THREE.CylinderGeometry(1, 1, 1, 10);

/** cria uma pessoa: o = { shirt, pants, skin, hair, shoes, dress, longHair, h } */
function person(mat, o) {
  const root = new THREE.Group(), k = o.h / 1.7;
  const T = [];
  // pelve/calça, tronco (camisa), pescoço, cabeça, cabelo
  part(T, new THREE.LatheGeometry(V2([[0.001, 0.8], [0.15, 0.82], [0.165, 0.92], [0.15, 1.02], [0.001, 1.02]]), 12), o.dress || o.pants, 0, 0, 0, 1, 1, 0.68);
  part(T, new THREE.LatheGeometry(V2([[0.001, 0.98], [0.15, 0.99], [0.135, 1.08], [0.16, 1.26], [0.19, 1.38], [0.17, 1.44], [0.07, 1.48], [0.001, 1.48]]), 14), o.shirt, 0, 0, 0, 1, 1, 0.62);
  if (o.dress) part(T, new THREE.CylinderGeometry(0.17, 0.27, 0.5, 14, 1, true), o.dress, 0, 0.62, 0, 1, 1, 0.8);
  part(T, CYL, o.skin, 0, 1.5, 0, 0.05, 0.1, 0.05);
  part(T, SPH, o.skin, 0, 1.6, 0.005, 0.088, 0.115, 0.1);
  part(T, SPH, o.skin, 0, 1.575, 0.085, 0.018, 0.022, 0.02); // nariz
  part(T, SPH, o.hair, 0, 1.64, -0.012, 0.096, 0.1, 0.106);
  if (o.longHair) part(T, CAP(0.075, 0.22), o.hair, 0, 1.47, -0.07, 1.2, 1, 0.7);
  const torso = new THREE.Mesh(mergeGeometries(T), mat); torso.castShadow = true; root.add(torso);
  const limb = (list) => { const m = new THREE.Mesh(mergeGeometries(list), mat); m.castShadow = true; return m; };
  const legs = [], arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.088, 0.88, 0); root.add(hip);
    const th = []; part(th, CAP(0.066, 0.34), o.dress ? o.skin : o.pants, 0, -0.21, 0); const thigh = limb(th); hip.add(thigh);
    const knee = new THREE.Group(); knee.position.set(0, -0.43, 0); hip.add(knee);
    const sh = []; part(sh, CAP(0.052, 0.34), o.dress ? o.skin : o.pants, 0, -0.2, 0); part(sh, new THREE.BoxGeometry(1, 1, 1), o.shoes, 0, -0.42, 0.04, 0.095, 0.07, 0.25);
    const shin = limb(sh); knee.add(shin);
    const sho = new THREE.Group(); sho.position.set(s * 0.205, 1.4, 0); root.add(sho);
    const ar = []; part(ar, CAP(0.046, 0.26), o.shirt, 0, -0.15, 0); part(ar, CAP(0.038, 0.24), o.sleeve || o.skin, 0, -0.43, 0.02, 1, 1, 1, -0.12); part(ar, SPH, o.skin, 0, -0.6, 0.035, 0.04, 0.055, 0.03);
    const arm = limb(ar); arm.rotation.z = s * 0.06; sho.add(arm);
    legs.push({ hip, knee }); arms.push(sho);
  }
  root.scale.setScalar(k);
  return { root, legs, arms, torso };
}

export function buildPeople(root) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const yWalk = (z) => ruaY(z) + 0.17, yRoad = (z) => ruaY(z) + 0.06;
  const wW = (RUA.walkW[0] + RUA.walkW[1]) / 2 + 0.1, wE = (RUA.walkE[0] + RUA.walkE[1]) / 2 - 0.1;
  const Ya = ruaY(62) + 0.02;
  const defs = [
    // parada no passeio leste encostada à porta (blusa vermelha, calça cinza), como na foto
    { o: { shirt: '#9a2a2a', pants: '#8c8c8a', skin: '#6e4a34', hair: '#1c140e', shoes: '#e4e2dc', longHair: true, h: 1.64 }, x: RUA.walkE[1] - 0.45, z: -17.5, yaw: -Math.PI / 2 - 0.35, y: yWalk },
    // caminhando: rua acima / abaixo, passeios
    { o: { shirt: '#1d1d20', pants: '#2a2c33', skin: '#5a3c2a', hair: '#151010', shoes: '#222', h: 1.76 }, x: 18.3, path: [14, 40], speed: 1.15, y: yRoad },
    { o: { shirt: '#e8e2d2', dress: '#d9d2bf', skin: '#7a5238', hair: '#1a110c', shoes: '#6b4a30', longHair: true, h: 1.62 }, x: 19.4, path: [16, 38], speed: 1.0, phase: 0.5, y: yRoad },
    { o: { shirt: '#9fb6c8', pants: '#b9ab8c', skin: '#c9a084', hair: '#d8d6d0', shoes: '#3a2a20', h: 1.7, sleeve: '#9fb6c8' }, x: wW, path: [-40, -10], speed: 0.85, y: yWalk },
    { o: { shirt: '#6b6f74', pants: '#34445e', skin: '#a77a58', hair: '#2a1d14', shoes: '#ddd', h: 1.74 }, x: 19.8, path: [-40, -12], speed: 1.25, phase: 0.3, y: yRoad },
    { o: { shirt: '#3d5a73', pants: '#3a3530', skin: '#b48662', hair: '#3a2a1c', shoes: '#2a221c', h: 1.72 }, x: wE, path: [24, 42], speed: 1.05, phase: 0.7, y: yWalk },
    // casal no adro, à porta da igreja
    { o: { shirt: '#7a2e2a', pants: '#2b3140', skin: '#a77a58', hair: '#2a1d14', shoes: '#2a221c', h: 1.72 }, x: 17.4, z: 55.4, yaw: 0.9, y: () => Ya },
    { o: { shirt: '#d8d2c2', dress: '#5a4a6a', skin: '#8a5f42', hair: '#1a120c', shoes: '#3a2a20', longHair: true, h: 1.62 }, x: 18.25, z: 55.9, yaw: -2.3, y: () => Ya },
  ];
  const ppl = defs.map((d) => {
    const p = person(mat, d.o); root.add(p.root);
    if (d.path) { const L = d.path[1] - d.path[0]; p.s = (d.phase ?? Math.random()) * L; p.dir = 1; p.L = L; }
    Object.assign(p, d); p.idle = Math.random() * 6; return p;
  });
  const place = (p, z, yaw, ph) => {
    const bob = ph == null ? 0 : 0.022 * Math.abs(Math.cos(ph));
    p.root.position.set(p.x + ruaX(z), p.y(z) + bob, z); p.root.rotation.y = yaw;
  };
  function update(dt, t) {
    dt = Math.min(dt, 0.1);
    for (const p of ppl) {
      if (!p.path) { place(p, p.z, p.yaw); p.arms.forEach((a, i) => (a.rotation.x = 0.04 * Math.sin(t * 0.8 + i + p.idle))); p.torso.rotation.y = 0.05 * Math.sin(t * 0.3 + p.idle); continue; }
      p.s += p.dir * p.speed * dt; if (p.s > p.L) { p.s = p.L; p.dir = -1; } else if (p.s < 0) { p.s = 0; p.dir = 1; }
      p.ph = (p.ph || 0) + p.speed * dt / 1.35 * Math.PI * 2; const z = p.path[0] + p.s, ph = p.ph;
      place(p, z, p.dir > 0 ? 0 : Math.PI, ph);
      p.legs.forEach((L, i) => { const f = ph + i * Math.PI; L.hip.rotation.x = -0.42 * Math.sin(f); L.knee.rotation.x = 0.08 + 0.62 * Math.max(0, Math.cos(f)); });
      p.arms.forEach((a, i) => { a.rotation.x = 0.34 * Math.sin(ph + i * Math.PI); });
    }
  }
  update(0, 0);
  return { update };
}
