// CASARIO — geometrias. Elementos instanciados em coordenadas locais: x ao longo da fachada, y para cima,
// +z para fora da fachada (plano da parede em z = 0). Builder = malha mesclada com vertexColors (paredes, cimalhas…).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = THREE.Vector3;
export function merge(list) {
  const gs = list.map((g) => { let n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; });
  const m = mergeGeometries(gs, false); gs.forEach((g) => g.dispose()); return m;
}
export const boxAt = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** malha mesclada: quads com normal pretendida (a ordem dos vértices é corrigida automaticamente) */
export class Builder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  quad(P, N, UV, C) {
    const e1 = new V().subVectors(P[1], P[0]), e2 = new V().subVectors(P[2], P[0]), cr = e1.cross(e2);
    if (cr.lengthSq() < 1e-12) { const e3 = new V().subVectors(P[3], P[0]); cr.copy(e2).cross(e3); }
    const idx = cr.dot(N) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of idx) { this.p.push(P[i].x, P[i].y, P[i].z); this.n.push(N.x, N.y, N.z); this.uv.push(UV[i][0], UV[i][1]); this.c.push(C.r, C.g, C.b); }
  }
  geo() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); return g;
  }
}

/** contexto de uma fachada: local (a = z do mundo, d = para fora, y) → mundo (F + s·d, y, a) */
export class Facade {
  constructor(F, s, uOff, vb, vh) { this.F = F; this.s = s; this.uo = uOff; this.vb = vb; this.vh = vh; }
  P(a, d, y) { return new V(this.F + this.s * d, y, a); }
  N(na, nd, ny) { return new V(this.s * nd, ny, na); }
  // quad em pontos locais [[a,d,y]×4]; uvMode: 'f' fachada (u=a), 's' lateral (u=d), 't' topo, 'r' bruto
  q(b, pts, n, col, mode = 'f', uvs) {
    const P = pts.map((p) => this.P(p[0], p[1], p[2])), uo = this.uo, S = 4.6;
    const UV = uvs || pts.map(([a, d, y]) => mode === 's' ? [d / S + uo, (y - this.vb) / this.vh] : mode === 't' ? [a / S + uo, d / S] : [a / S + uo, (y - this.vb) / this.vh]);
    b.quad(P, this.N(...n), UV, col);
  }
  /** caixa local: faces opcionais (skip: 'b' fundo, 'k' costas (−d), 'y' base) */
  box(b, a0, a1, d0, d1, y0, y1, col, skip = '') {
    if (!skip.includes('f')) this.q(b, [[a0, d1, y0], [a1, d1, y0], [a1, d1, y1], [a0, d1, y1]], [0, 1, 0], col);
    if (!skip.includes('k')) this.q(b, [[a0, d0, y0], [a1, d0, y0], [a1, d0, y1], [a0, d0, y1]], [0, -1, 0], col);
    this.q(b, [[a1, d0, y0], [a1, d1, y0], [a1, d1, y1], [a1, d0, y1]], [1, 0, 0], col, 's');
    this.q(b, [[a0, d0, y0], [a0, d1, y0], [a0, d1, y1], [a0, d0, y1]], [-1, 0, 0], col, 's');
    if (!skip.includes('t')) this.q(b, [[a0, d0, y1], [a1, d0, y1], [a1, d1, y1], [a0, d1, y1]], [0, 0, 1], col, 't');
    if (!skip.includes('y')) this.q(b, [[a0, d0, y0], [a1, d0, y0], [a1, d1, y0], [a0, d1, y0]], [0, 0, -1], col, 't');
  }
  /** parede plana em d com vãos retangulares (holes: {a0,a1,y0,y1}) */
  wall(b, a0, a1, y0, y1, d, holes, col) {
    const xs = [...new Set([a0, a1, ...holes.flatMap((h) => [h.a0, h.a1]).filter((x) => x > a0 && x < a1)])].sort((p, q) => p - q);
    for (let i = 0; i < xs.length - 1; i++) {
      const ca = xs[i], cb = xs[i + 1], m = (ca + cb) / 2; let y = y0;
      const hs = holes.filter((h) => h.a0 <= m && h.a1 >= m && h.y1 > y0 && h.y0 < y1).sort((p, q) => p.y0 - q.y0);
      for (const h of hs) { if (h.y0 > y) this.q(b, [[ca, d, y], [cb, d, y], [cb, d, h.y0], [ca, d, h.y0]], [0, 1, 0], col); y = Math.max(y, h.y1); }
      if (y < y1) this.q(b, [[ca, d, y], [cb, d, y], [cb, d, y1], [ca, d, y1]], [0, 1, 0], col);
    }
  }
}

// ───────────────────────── vãos: arco abatido ─────────────────────────
const arcY = (W, T, r) => { const Rc = (W * W / 4 + r * r) / (2 * r), cy = T + r - Rc; return (x) => cy + Math.sqrt(Math.max(0, Rc * Rc - x * x)); };
/** moldura larga: ombreiras que revestem o vão (din para dentro, dout para fora) + verga em arco abatido + fecho + cornija */
export function frameGeo(W, T, r, fw = 0.19, din = 0.3, dout = 0.07, top = 0.16) {
  const y = arcY(W, T, r), D = din + dout, Ht = T + r + top;
  const sh = new THREE.Shape(); sh.moveTo(-W / 2 - fw, T - 0.001); sh.lineTo(-W / 2, T - 0.001);
  for (let i = 0; i <= 16; i++) { const x = -W / 2 + W * i / 16; sh.lineTo(x, y(x)); }
  sh.lineTo(W / 2 + fw, T - 0.001); sh.lineTo(W / 2 + fw, Ht); sh.lineTo(-W / 2 - fw, Ht); sh.closePath();
  const head = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -din);
  return merge([
    boxAt(fw, T, D, -W / 2 - fw / 2, T / 2, dout / 2 - din / 2), boxAt(fw, T, D, W / 2 + fw / 2, T / 2, dout / 2 - din / 2), head,
    boxAt(0.17, 0.22, 0.05, 0, T + r + 0.04, dout + 0.02),                       // fecho (pedra-chave)
    boxAt(W + 2 * fw + 0.12, 0.06, dout + 0.1, 0, Ht + 0.03, (dout + 0.1) / 2 - 0.02), // cornija sobre a verga
    boxAt(W + 2 * fw + 0.04, 0.03, dout + 0.06, 0, Ht - 0.01, (dout + 0.06) / 2 - 0.02),
  ]);
}
/** folhas de porta em tábuas (duas), topo em arco; uv 0..1 na porta toda */
export function doorLeavesGeo(W, T, r, th = 0.055) {
  const y = arcY(W, T, r), g = [];
  for (const side of [-1, 1]) { const sh = new THREE.Shape(), xa = side < 0 ? -W / 2 : 0.006, xb = side < 0 ? -0.006 : W / 2;
    sh.moveTo(xa, 0); sh.lineTo(xb, 0); for (let i = 0; i <= 8; i++) { const x = xb + (xa - xb) * i / 8; sh.lineTo(x, y(x)); }
    sh.closePath(); g.push(new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 1 })); }
  const m = merge(g); const p = m.attributes.position, uv = m.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / (T + r));
  return m;
}
/** plano do vidro (arco), uv 0..1 */
export function glassGeo(W, T, r) {
  const y = arcY(W, T, r), sh = new THREE.Shape(); sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0);
  for (let i = 0; i <= 12; i++) { const x = W / 2 - W * i / 12; sh.lineTo(x, y(x)); } sh.closePath();
  const g = new THREE.ShapeGeometry(sh); const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + W / 2) / W, p.getY(i) / (T + r));
  return g;
}
/** caixilhos brancos: guilhotina (kind 'g') ou porta-janela de duas folhas ('p'), com bandeira em arco de raios */
export function sashGeo(W, T, r, kind = 'g', z = -0.1) {
  const y = arcY(W, T, r), b = 0.055, d = 0.05, L = [];
  const bar = (w, h, x, yy, zz = z) => L.push(boxAt(w, h, d, x, yy, zz));
  bar(b, T, -W / 2 + b / 2, T / 2); bar(b, T, W / 2 - b / 2, T / 2); bar(W, 0.07, 0, b / 2 + 0.01); bar(W, 0.075, 0, T - 0.03);
  if (kind === 'g') {
    const m = T * 0.5; bar(W, 0.06, 0, m - 0.02, z + 0.035); bar(W, 0.06, 0, m + 0.02); // trilhos de encontro (folha de cima recuada)
    for (const yy of [T * 0.25, T * 0.75]) bar(W - 2 * b, 0.028, 0, yy, yy < m ? z + 0.035 : z);
    for (const x of [-W / 6, W / 6]) { bar(0.028, m - 0.05, x, m / 2, z + 0.035); bar(0.028, m - 0.05, x, m + m / 2 - 0.03); }
  } else {
    bar(0.09, T, 0, T / 2); // montante central (encontro das folhas)
    for (const s of [-1, 1]) { const cx = s * W / 4; L.push(boxAt(W / 2 - 0.12, 0.62, 0.035, cx, 0.36, z - 0.01)); // almofada inferior
      bar(W / 2 - 0.1, 0.06, cx, 0.68); for (const yy of [0.68 + (T - 0.72) / 3, 0.68 + 2 * (T - 0.72) / 3]) bar(W / 2 - 0.1, 0.028, cx, yy); bar(0.028, T - 0.72, cx, 0.68 + (T - 0.72) / 2); }
  }
  // bandeira: raios + aro
  for (const an of [0.55, Math.PI / 2, Math.PI - 0.55]) { const R0 = 0.04; let x1 = Math.cos(an), y1 = Math.sin(an); let t = 0.02; while (T + y1 * t < y(x1 * t) && t < 2) t += 0.01;
    const len = t - R0; const g = new THREE.BoxGeometry(0.024, len, d); g.rotateZ(an - Math.PI / 2); g.translate(x1 * (R0 + len / 2), T + y1 * (R0 + len / 2), z); L.push(g); }
  for (let i = 0; i < 10; i++) { const xa = -W / 2 + W * i / 10, xb = -W / 2 + W * (i + 1) / 10, ya = y(xa) - 0.025, yb = y(xb) - 0.025; const len = Math.hypot(xb - xa, yb - ya);
    const g = new THREE.BoxGeometry(len + 0.01, 0.05, d); g.rotateZ(Math.atan2(yb - ya, xb - xa)); g.translate((xa + xb) / 2, (ya + yb) / 2, z); L.push(g); }
  return merge(L);
}

// ───────────────────────── sacada (laje top em y = 0, parede em z = 0) ─────────────────────────
export function balconyGeo(Wr = 1.6, D = 0.6, H = 1.0) {
  const stone = [boxAt(Wr, 0.09, D, 0, -0.045, D / 2), boxAt(Wr - 0.08, 0.06, D - 0.05, 0, -0.12, (D - 0.05) / 2)];
  for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.09, 0.02, 0.42, 4, 1).rotateY(Math.PI / 4).scale(0.9, 1, 3).translate(s * (Wr / 2 - 0.22), -0.36, 0.13); stone.push(g); }
  const iron = [], gold = [], hw = Wr / 2 - 0.05, zf = D - 0.05;
  const post = (x, z) => { iron.push(boxAt(0.035, H, 0.035, x, H / 2, z)); gold.push(new THREE.SphereGeometry(0.032, 10, 8).translate(x, H + 0.045, z), new THREE.CylinderGeometry(0.012, 0.022, 0.03, 8).translate(x, H + 0.012, z)); };
  post(-hw, zf); post(hw, zf); post(-hw, 0.04); post(hw, 0.04);
  for (const yy of [0.07, H - 0.02]) { iron.push(boxAt(2 * hw, 0.04, 0.045, 0, yy, zf)); for (const s of [-1, 1]) iron.push(boxAt(0.045, 0.04, zf, s * hw, yy, zf / 2)); }
  iron.push(boxAt(2 * hw, 0.022, 0.025, 0, H - 0.2, zf)); for (const s of [-1, 1]) iron.push(boxAt(0.025, 0.022, zf, s * hw, H - 0.2, zf / 2));
  const nb = Math.round(2 * hw / 0.11);
  for (let i = 1; i < nb; i++) { const x = -hw + i * 2 * hw / nb; iron.push(boxAt(0.016, H - 0.29, 0.016, x, 0.09 + (H - 0.29) / 2, zf));
    if (i < nb) { const ring = new THREE.TorusGeometry(0.06, 0.007, 4, 14).translate(x + hw / nb, H - 0.11, zf); iron.push(ring); gold.push(new THREE.SphereGeometry(0.015, 8, 6).translate(x + hw / nb, H - 0.11, zf)); } }
  for (const s of [-1, 1]) for (let z = 0.15; z < zf - 0.05; z += 0.11) iron.push(boxAt(0.016, H - 0.11, 0.016, s * hw, 0.09 + (H - 0.11) / 2, z));
  // volutas em "C" na faixa de baixo (frente) com rosetas douradas
  for (let i = 0; i < nb; i += 2) { const x = -hw + (i + 1) * 2 * hw / nb; for (const sy of [-1, 1]) { const t = new THREE.TorusGeometry(0.045, 0.007, 4, 10, Math.PI).rotateZ(sy < 0 ? Math.PI : 0).translate(x, 0.22 + sy * 0.045, zf); iron.push(t); }
    gold.push(new THREE.SphereGeometry(0.018, 8, 6).translate(x, 0.22, zf + 0.01)); }
  return { stone: merge(stone), iron: merge(iron), gold: merge(gold) };
}

// ───────────────────────── telhado ─────────────────────────
/** fiada de telhas capa-canal, 1 m de largura (x ∈ [−0,5; 0,5]), z ∈ [−L; 0] (z = 0 borda baixa exposta) */
export function tileCourseGeo(L = 0.44, lift = 0.035) {
  const NX = 24, NZ = 1, A = 0.052, prof = (x) => A * Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * x / 0.25), 0.7);
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) { const x = -0.5 + i / NX, z = -L + L * j / NZ; pos.push(x, prof(x) + lift * (1 + z / L), z); uv.push(i / NX, j / NZ); }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const top = new THREE.BufferGeometry(); top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); top.setIndex(idx); top.computeVertexNormals();
  // espessura na borda (bocas das telhas)
  const p2 = [], u2 = [], i2 = [];
  for (let i = 0; i <= NX; i++) { const x = -0.5 + i / NX, yt = prof(x) + lift; p2.push(x, yt, 0, x, yt - 0.024, 0); u2.push(i / NX, 1, i / NX, 0.97); }
  for (let i = 0; i < NX; i++) { const a = 2 * i; i2.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const lip = new THREE.BufferGeometry(); lip.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); lip.setAttribute('uv', new THREE.Float32BufferAttribute(u2, 2)); lip.setIndex(i2); lip.computeVertexNormals();
  const n = lip.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, -0.2, 0.98);
  return merge([top, lip]);
}
/** capa da cumeeira: meia-cana ao longo de x, comprimento 0,44 */
export function ridgeGeo(R = 0.14, Lr = 0.44) {
  const N = 10, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) { const an = Math.PI * i / N; for (const [k, x] of [[0, -Lr / 2], [1, Lr / 2]]) { const rr = R * (k ? 1.08 : 1); pos.push(x, Math.sin(an) * rr, Math.cos(an) * rr); uv.push(k, i / N); } }
  for (let i = 0; i < N; i++) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
