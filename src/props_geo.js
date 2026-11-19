// AMBIENTAÇÃO — construtores de geometria (tudo procedural). Cada construtor recebe `B` (lote) e uma matriz-base.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from './props_tex.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function M(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
export const mul = (a, b) => a.clone().multiply(b);

/** Lote estático: junta toda a geometria por material (poucas chamadas de desenho). */
export class Batch {
  constructor() { this.L = new Map(); this.tris = 0; }
  add(geo, mat, m4, { cast = true, recv = true } = {}) {
    const k = mat.uuid + (cast ? 'C' : '') + (recv ? 'R' : '');
    if (!this.L.has(k)) this.L.set(k, { mat, cast, recv, geos: [] });
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m4); this.L.get(k).geos.push(g);
  }
  build(parent, name = 'props') {
    for (const { mat, cast, recv, geos } of this.L.values()) {
      if (!geos.length) continue;
      const g = mergeGeometries(geos, false); geos.forEach((x) => x.dispose());
      g.computeBoundingSphere(); g.computeBoundingBox(); this.tris += g.attributes.position.count / 3;
      const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; m.name = name + ':' + (mat.name || 'm');
      m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m);
    }
    this.L.clear();
  }
}

// ── geometrias base compartilhadas ──
const G = {};
export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
export function rbox(w, h, d, r = 0.004, seg = 2) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01)); }
export function cyl(r, h, seg = 16, r2 = r, open = false) { return new THREE.CylinderGeometry(r2, r, h, seg, 1, open); }

/** saco de 25 kg deitado (0,62 × 0,13 × 0,40) com forma de travesseiro e amassados; UV planar de cima */
export function bagGeo(seed = 1, L = 0.62, T = 0.13, W = 0.40) {
  const g = new THREE.BoxGeometry(L, T, W, 14, 3, 10), p = g.attributes.position, uv = g.attributes.uv, R = rng(seed);
  const bumps = Array.from({ length: 7 }, () => [R() * 2 - 1, R() * 2 - 1, (R() - 0.5) * 0.012, 0.15 + R() * 0.3]);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = x / (L / 2), w = z / (W / 2), v = y / (T / 2);
    const puff = (1 - 0.55 * Math.pow(Math.abs(u), 5)) * (1 - 0.45 * Math.pow(Math.abs(w), 4));
    y = y * puff;
    if (y > 0) for (const [bu, bw, a, r] of bumps) { const d2 = ((u - bu) ** 2 + (w - bw) ** 2) / (r * r); y += a * Math.exp(-d2) * puff; }
    const pinch = 1 - 0.07 * v * v; x *= 1 - 0.035 * v * v * (1 - Math.abs(w)) ; z *= pinch;
    // pontas costuradas mais finas/achatadas
    if (Math.abs(u) > 0.9) y *= 0.75;
    p.setXYZ(i, x, y, z); uv.setXY(i, z / W + 0.5, x / L + 0.5);
  }
  g.computeVertexNormals(); return g;
}

/** balde de 20 L com tampa (lathe) — UV: u ao redor, v na altura */
export function bucketGeos(r0 = 0.13, r1 = 0.15, h = 0.36) {
  const k = `bk${r0}${r1}${h}`; if (G[k]) return G[k];
  const prof = [[0.001, 0], [r0 - 0.01, 0], [r0, 0.012], [r1 - 0.004, h - 0.03], [r1 + 0.008, h - 0.026], [r1 + 0.008, h - 0.012], [r1, h - 0.01]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(prof, 32);
  const lp = [[0.001, h + 0.012], [r1 - 0.01, h + 0.012], [r1 + 0.012, h + 0.004], [r1 + 0.014, h - 0.03], [r1 + 0.006, h - 0.032]].map(([x, y]) => new THREE.Vector2(x, y));
  const lid = new THREE.LatheGeometry(lp, 32);
  const handle = new THREE.TorusGeometry(r1 + 0.012, 0.004, 6, 24, Math.PI); handle.rotateZ(0); handle.rotateX(-0.35); handle.translate(0, h - 0.06, 0);
  return (G[k] = { body, lid, handle });
}

/** caixa plástica vazada aberta (0,6 × 0,28 × 0,4): lados (alpha), fundo (alpha), aro sólido */
export function crateGeos(W = 0.6, H = 0.28, D = 0.4) {
  const k = `cr${W}${H}${D}`; if (G[k]) return G[k];
  const sides = [], t = 0.012;
  const pf = (w, h) => new THREE.PlaneGeometry(w, h);
  let a = pf(W, H); a.translate(0, H / 2, D / 2); sides.push(a);
  a = pf(W, H); a.rotateY(Math.PI); a.translate(0, H / 2, -D / 2); sides.push(a);
  a = pf(D, H); a.rotateY(Math.PI / 2); a.translate(W / 2, H / 2, 0); sides.push(a);
  a = pf(D, H); a.rotateY(-Math.PI / 2); a.translate(-W / 2, H / 2, 0); sides.push(a);
  const bottom = pf(W, D); bottom.rotateX(-Math.PI / 2); bottom.translate(0, 0.012, 0);
  const rim = [];
  for (const [w, d, x, z] of [[W + t, t, 0, D / 2], [W + t, t, 0, -D / 2], [t, D + t, W / 2, 0], [t, D + t, -W / 2, 0]]) {
    const r = box(w, 0.022, d); r.translate(x, H - 0.011, z); rim.push(r);
    const b = box(w, 0.016, d); b.translate(x, 0.008, z); rim.push(b);
  }
  for (const [x, z] of [[W / 2, D / 2], [-W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) { const c = box(0.02, H, 0.02); c.translate(x, H / 2, z); rim.push(c); }
  return (G[k] = { sides: mergeGeometries(sides), bottom, rim: mergeGeometries(rim.map((g) => g.toNonIndexed())) });
}

/** assadeira/esteira 0,6 × 0,4 (fundo + bordas levemente abertas) */
export function trayGeo(W = 0.6, D = 0.4, h = 0.022, flat = false) {
  const k = `tr${W}${D}${h}${flat}`; if (G[k]) return G[k];
  const parts = []; const t = 0.0025;
  const b = box(W - 0.01, t, D - 0.01); b.translate(0, t / 2, 0); parts.push(b);
  const hh = flat ? 0.008 : h;
  for (const [w, d, x, z, rx, rz] of [[W, t, 0, D / 2, 0.18, 0], [W, t, 0, -D / 2, -0.18, 0], [t, D, W / 2, 0, 0, -0.18], [t, D, -W / 2, 0, 0, 0.18]]) {
    const s = box(w, hh, d); s.rotateX(rx); s.rotateZ(rz); s.translate(x, hh / 2, z); parts.push(s);
    const r = box(w + (d > w ? 0.006 : 0), 0.004, d + (w > d ? 0.006 : 0)); r.translate(x * 1.02, hh, z * 1.02); parts.push(r);
  }
  return (G[k] = mergeGeometries(parts.map((g) => g.toNonIndexed())));
}

/** pá de forno: lâmina de madeira (ou alumínio) + cabo longo */
export function peelGeos(L = 2.4, blade = 0.34, bladeL = 0.42) {
  const k = `pe${L}${blade}`; if (G[k]) return G[k];
  const bl = new THREE.BoxGeometry(blade, bladeL, 0.008, 6, 6, 1); const p = bl.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / bladeL + 0.5; p.setX(i, p.getX(i) * (0.45 + 0.55 * Math.pow(Math.min(1, (1 - y) * 1.6 + 0.05), 0.5))); p.setZ(i, p.getZ(i) * (1 - 0.7 * (1 - y))); }
  bl.computeVertexNormals(); bl.translate(0, bladeL / 2, 0);
  const handle = cyl(0.016, L, 10); handle.translate(0, bladeL + L / 2 - 0.04, 0);
  const cap = cyl(0.019, 0.04, 10); cap.translate(0, bladeL + L - 0.02, 0);
  return (G[k] = { blade: bl, handle, cap });
}

/** luva térmica (mitene longa) pendurada: palma + polegar + punho */
export function gloveGeo() {
  if (G.glove) return G.glove;
  const palm = new THREE.CapsuleGeometry(0.055, 0.2, 6, 14); palm.scale(1, 1, 0.38);
  const thumb = new THREE.CapsuleGeometry(0.024, 0.07, 4, 10); thumb.scale(1, 1, 0.6); thumb.rotateZ(-0.6); thumb.translate(0.065, 0.02, 0);
  const cuff = cyl(0.06, 0.16, 16, 0.068, false); cuff.scale(1, 1, 0.45); cuff.translate(0, 0.21, 0);
  const loop = new THREE.TorusGeometry(0.02, 0.004, 5, 12); loop.translate(0, 0.31, 0);
  const g = mergeGeometries([palm, thumb, cuff, loop].map((x) => { x.deleteAttribute('uv'); x = x.index ? x.toNonIndexed() : x; return x; }));
  // UV cilíndrico simples
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[2 * i] = Math.atan2(p.getZ(i), p.getX(i)) / 6.283 + 0.5; uv[2 * i + 1] = 1 - (p.getY(i) + 0.15) / 0.5; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return (G.glove = g);
}

/** pano dobrado (pilha) com leve deformação */
export function foldedClothGeo(seed = 1) {
  const g = new THREE.BoxGeometry(0.24, 0.022, 0.2, 6, 2, 6), p = g.attributes.position, R = rng(seed);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * (1 - 0.3 * (x / 0.12) ** 4) + Math.sin(x * 30 + seed) * 0.0015 + (R() - 0.5) * 0.001); p.setZ(i, z * (1 - 0.04 * Math.abs(p.getY(i)) * 40)); }
  g.computeVertexNormals(); return g;
}
/** pano pendurado sobre uma barra (dobra ao meio) */
export function hangingClothGeo(w = 0.42, h = 0.32, seed = 2) {
  const g = new THREE.PlaneGeometry(w, h * 2, 12, 24), p = g.attributes.position, R = rng(seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i); const s = Math.abs(y);
    const side = y >= 0 ? 1 : -1; const yy = -s + 0.01; let z = side * 0.012 * Math.min(1, s / 0.03) + side * 0.004;
    z += Math.sin(x * 22 + seed) * 0.006 * (s / h) + (R() - 0.5) * 0.001;
    p.setXYZ(i, x + Math.sin(s * 9 + seed) * 0.004, yy - (side > 0 ? 0 : 0.03) * (s / h), z);
  }
  g.computeVertexNormals(); return g;
}

/** estante de piso inox: 4 colunas, n prateleiras lisas com aba */
export function addRack(B, mats, base, { w = 1.5, d = 0.5, h = 1.8, levels = [0.18, 0.62, 1.06, 1.5], wire = false } = {}) {
  const post = box(0.028, h, 0.028), foot = cyl(0.016, 0.03, 10), M0 = M;
  for (const [x, z] of [[-w / 2 + 0.014, -d / 2 + 0.014], [w / 2 - 0.014, -d / 2 + 0.014], [-w / 2 + 0.014, d / 2 - 0.014], [w / 2 - 0.014, d / 2 - 0.014]]) {
    B.add(post, mats.steel, mul(base, M0(x, h / 2 + 0.03, z))); B.add(foot, mats.rubber, mul(base, M0(x, 0.015, z)), { cast: false });
  }
  for (const y of levels) {
    B.add(box(w - 0.03, 0.012, d - 0.03), mats.steel, mul(base, M0(0, y, 0)));
    for (const s of [-1, 1]) { B.add(box(w - 0.03, 0.035, 0.01), mats.steel, mul(base, M0(0, y - 0.012, s * (d / 2 - 0.02)))); B.add(box(0.01, 0.035, d - 0.03), mats.steel, mul(base, M0(s * (w / 2 - 0.02), y - 0.012, 0))); }
  }
}
/** prateleira de parede inox (lisa) com mãos-francesas; base no plano da parede, frente para +z local */
export function addWallShelf(B, mats, base, { w = 1.2, d = 0.35 } = {}) {
  B.add(box(w, 0.012, d), mats.steel, mul(base, M(0, 0, d / 2)));
  B.add(box(w, 0.035, 0.01), mats.steel, mul(base, M(0, -0.012, d - 0.005)));
  B.add(box(w, 0.06, 0.01), mats.steel, mul(base, M(0, 0.03, 0.005))); // espelho traseiro
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(d * 0.85, 0); sh.lineTo(0, -d * 0.7); sh.lineTo(0, 0);
  const br = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }); br.rotateY(-Math.PI / 2);
  for (const x of [-w / 2 + 0.12, w / 2 - 0.12]) B.add(br, mats.steel, mul(base, M(x + 0.002, -0.006, 0)));
}
/** pallet de madeira 1,2 × 1,0 (PBR) */
export function addPallet(B, mats, base, { W = 1.2, D = 1.0 } = {}) {
  const R = rng(base.elements[12] * 100 | 0);
  for (let i = 0; i < 7; i++) { const z = -D / 2 + 0.05 + i * (D - 0.1) / 6; B.add(box(W, 0.022, 0.1 + (i % 3 === 0 ? 0.04 : 0)), mats.pallet, mul(base, M(0, 0.133, z, (R() - 0.5) * 0.01))); }
  for (const z of [-D / 2 + 0.05, 0, D / 2 - 0.05]) B.add(box(W, 0.022, 0.1), mats.pallet, mul(base, M(0, 0.111 - 0.1, z)));
  for (const x of [-W / 2 + 0.05, 0, W / 2 - 0.05]) for (const z of [-D / 2 + 0.05, 0, D / 2 - 0.05]) B.add(box(0.1, 0.078, 0.1), mats.pallet2, mul(base, M(x, 0.061, z)));
  for (const x of [-W / 2 + 0.05, 0, W / 2 - 0.05]) B.add(box(0.1, 0.022, D), mats.pallet, mul(base, M(x, 0.111, 0)));
}
/** pallet plástico (higiênico) 1,2 × 1,0 */
export function addPlasticPallet(B, mats, base, { W = 1.2, D = 1.0 } = {}) {
  B.add(rbox(W, 0.035, D, 0.008), mats.ppallet, mul(base, M(0, 0.135, 0)));
  for (const x of [-W / 2 + 0.07, 0, W / 2 - 0.07]) for (const z of [-D / 2 + 0.07, 0, D / 2 - 0.07]) B.add(rbox(0.13, 0.12, 0.13, 0.01), mats.ppallet, mul(base, M(x, 0.06, z)));
  for (const x of [-W / 2 + 0.07, 0, W / 2 - 0.07]) B.add(box(0.13, 0.02, D), mats.ppallet, mul(base, M(x, 0.01, 0)));
}
/** carrinho plataforma (chapa + alça + rodízios) */
export function addPlatformCart(B, mats, base) {
  const L = 0.9, W = 0.6;
  B.add(rbox(L, 0.03, W, 0.006), mats.cartPaint, mul(base, M(0, 0.17, 0)));
  B.add(box(L - 0.04, 0.004, W - 0.04), mats.rubber, mul(base, M(0, 0.187, 0)), { cast: false });
  const tube = (pts) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05), 40, 0.013, 8);
  B.add(tube([[L / 2 - 0.02, 0.18, -W / 2 + 0.04], [L / 2 + 0.01, 0.6, -W / 2 + 0.04], [L / 2 + 0.03, 0.9, -W / 2 + 0.06], [L / 2 + 0.03, 0.95, 0], [L / 2 + 0.03, 0.9, W / 2 - 0.06], [L / 2 + 0.01, 0.6, W / 2 - 0.04], [L / 2 - 0.02, 0.18, W / 2 - 0.04]]), mats.cartPaint, base);
  const wheel = cyl(0.062, 0.035, 18); wheel.rotateX(Math.PI / 2);
  for (const [x, z] of [[-L / 2 + 0.09, -W / 2 + 0.08], [-L / 2 + 0.09, W / 2 - 0.08], [L / 2 - 0.09, -W / 2 + 0.08], [L / 2 - 0.09, W / 2 - 0.08]]) {
    B.add(wheel, mats.rubber, mul(base, M(x, 0.062, z, x < 0 ? 0.4 : 0)));
    B.add(box(0.05, 0.06, 0.05), mats.galv, mul(base, M(x, 0.13, z)));
  }
}
/** eletrocalha perfurada (U) ao longo de x local, com suportes */
export function addCableTray(B, mats, base, L, { w = 0.2, h = 0.07 } = {}) {
  B.add(box(L, 0.003, w), mats.trayGalv, mul(base, M(0, 0, 0)), { cast: false });
  for (const s of [-1, 1]) { B.add(box(L, h, 0.003), mats.trayGalv, mul(base, M(0, h / 2, s * w / 2)), { cast: false }); B.add(box(L, 0.006, 0.012), mats.galv, mul(base, M(0, h, s * (w / 2 - 0.005))), { cast: false }); }
  // cabos dentro
  const R = rng(L * 1000 | 0);
  for (let i = 0; i < 5; i++) B.add(cyl(0.009 + R() * 0.006, L, 8), i % 2 ? mats.cableGray : mats.rubber, mul(base, M(0, 0.014 + (i > 2 ? 0.016 : 0), -0.06 + i * 0.03, 0, 0, Math.PI / 2)), { cast: false });
  for (let x = -L / 2 + 0.3; x < L / 2; x += 1.5) { B.add(box(0.03, 0.003, w + 0.06), mats.galv, mul(base, M(x, -0.012, -0.03)), { cast: false }); }
}
/** tomada industrial 3P+T (IEC 60309) em caixa: cor = vermelho (380 V) | azul (220 V); frente +z local */
export function addSocket(B, mats, base, col = 'red') {
  B.add(rbox(0.1, 0.13, 0.07, 0.008), mats.socketBody, mul(base, M(0, 0, 0.035)));
  const head = cyl(0.03, 0.06, 18); head.rotateX(Math.PI / 2 - 0.5);
  B.add(head, col === 'red' ? mats.socketRed : mats.socketBlue, mul(base, M(0, -0.02, 0.085)));
  const lid = cyl(0.033, 0.012, 18); lid.rotateX(Math.PI / 2 - 0.5);
  B.add(lid, col === 'red' ? mats.socketRed : mats.socketBlue, mul(base, M(0, -0.007, 0.115)));
  B.add(box(0.04, 0.025, 0.02), mats.socketBody, mul(base, M(0, 0.045, 0.075)));
}
