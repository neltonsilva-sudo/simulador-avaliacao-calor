// CIDADE — igreja barroca no alto da ladeira (adro, escadaria, torres sineiras) + mesclador de geometria por material
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ruaY } from './layout_rua.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** UV planar por eixo dominante da normal (metros / escala) — texturas tileáveis sem esticar */
function worldUV(g, s) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v; if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); } else if (ax >= az) { u = p.getZ(i); v = p.getY(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[2 * i] = u / s; uv[2 * i + 1] = v / s;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export class Merger {
  constructor() { this.parts = new Map(); }
  add(key, geom, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, color = null) {
    const g = geom.index ? geom.toNonIndexed() : geom.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)); g.applyMatrix4(_m);
    if (color) { const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = color.r; c[i + 1] = color.g; c[i + 2] = color.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    if (!this.parts.has(key)) this.parts.set(key, []); this.parts.get(key).push(g);
  }
  take(key) { const list = this.parts.get(key) || []; const g = mergeGeometries(list, false); list.forEach(x => x.dispose()); this.parts.delete(key); return g; }
  build(parent, mats, { cast = true, receive = true } = {}) {
    const out = {};
    for (const [key, list] of this.parts) {
      const mat = mats[key]; if (!mat) { console.warn('[city] sem material', key); continue; }
      if (mat.userData.wuv) for (const g of list) worldUV(g, mat.userData.wuv);
      const geo = mergeGeometries(list, false); list.forEach(g => g.dispose());
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = cast && !mat.userData.noCast; mesh.receiveShadow = receive; mesh.name = 'city_' + key;
      parent.add(mesh); out[key] = mesh;
    }
    this.parts.clear(); return out;
  }
}

// geometrias base reutilizadas
const BOX = new THREE.BoxGeometry(1, 1, 1);
const box = (M, key, w, h, d, x, y0, z, ry = 0) => M.add(key, BOX, x, y0 + h / 2, z, 0, ry, 0, w, h, d);

/** frontão barroco curvo (volutas em S e coroamento em arco) — base em y = 0, largura 2·hw */
export function frontaoShape(hw = 5, k = 1) {
  const s = new THREE.Shape(), X = (v) => v * hw / 5, Y = (v) => v * k;
  s.moveTo(X(-5), 0); s.lineTo(X(-5), Y(1.0)); s.quadraticCurveTo(X(-3.7), Y(1.0), X(-3.25), Y(2.0));
  s.bezierCurveTo(X(-2.9), Y(2.85), X(-2.0), Y(3.0), X(-1.45), Y(3.4)); s.quadraticCurveTo(X(-1.05), Y(3.7), X(-1.05), Y(4.3));
  s.quadraticCurveTo(X(0), Y(5.3), X(1.05), Y(4.3)); s.quadraticCurveTo(X(1.05), Y(3.7), X(1.45), Y(3.4));
  s.bezierCurveTo(X(2.0), Y(3.0), X(2.9), Y(2.85), X(3.25), Y(2.0)); s.quadraticCurveTo(X(3.7), Y(1.0), X(5), Y(1.0)); s.lineTo(X(5), 0); s.closePath();
  return s;
}
const extrude = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });

// perfis de torno
const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
const DOME = new THREE.LatheGeometry(V2([[0.001, 0], [1.5, 0], [1.5, 0.3], [1.72, 0.55], [1.84, 0.95], [1.72, 1.4], [1.3, 1.9], [0.78, 2.3], [0.42, 2.58], [0.26, 2.78], [0.001, 2.84]]), 20);
const BELL = new THREE.LatheGeometry(V2([[0.001, 0.02], [0.44, 0.02], [0.47, 0.0], [0.42, 0.1], [0.32, 0.32], [0.27, 0.62], [0.25, 0.86], [0.17, 0.94], [0.001, 0.95]]), 18);
const SPHERE = new THREE.SphereGeometry(1, 12, 8), CONE4 = new THREE.ConeGeometry(1, 1, 4, 1), CYL8 = new THREE.CylinderGeometry(1, 1, 1, 10);

// orientação de faces: f = fachada (normal −z), r = +x, l = −x
const RY = { f: Math.PI, r: Math.PI / 2, l: -Math.PI / 2, b: 0 };
function onFace(M, key, geom, face, X, Y, Z, lx, ly, lz, sx = 1, sy = 1, sz = 1) {
  const ry = RY[face], c = Math.cos(ry), s = Math.sin(ry);
  M.add(key, geom, X + lx * c + lz * s, Y + ly, Z - lx * s + lz * c, 0, ry, 0, sx, sy, sz);
}
/** janela com caixilho, cercadura de cantaria, verga com cimalha e peitoril */
function janela(M, face, X, Y, Z, w, h, PLANE) {
  onFace(M, 'win', PLANE, face, X, Y, Z, 0, h / 2, 0.03, w, h, 1);
  for (const sx of [-1, 1]) onFace(M, 'stone', BOX, face, X, Y, Z, sx * (w / 2 + 0.1), h / 2, 0.1, 0.2, h, 0.2);
  onFace(M, 'stone', BOX, face, X, Y, Z, 0, -0.08, 0.14, w + 0.55, 0.16, 0.3);
  onFace(M, 'stone', BOX, face, X, Y, Z, 0, h + 0.15, 0.12, w + 0.5, 0.3, 0.26);
  onFace(M, 'stone', BOX, face, X, Y, Z, 0, h + 0.36, 0.17, w + 0.75, 0.12, 0.36);
  onFace(M, 'stone', BOX, face, X, Y, Z, 0, h + 0.5, 0.12, w * 0.45, 0.16, 0.24);
}
function oculo(M, face, X, Y, Z, r) {
  onFace(M, 'stone', new THREE.TorusGeometry(r, r * 0.18, 8, 28), face, X, Y, Z, 0, 0, 0.06);
  onFace(M, 'glass', new THREE.CircleGeometry(r, 24), face, X, Y, Z, 0, 0, 0.02);
}
function pinaculo(M, x, y, z, k = 1) {
  box(M, 'stone', 0.45 * k, 0.55 * k, 0.45 * k, x, y, z);
  M.add('stone', CONE4, x, y + 0.55 * k + 0.5 * k, z, 0, Math.PI / 4, 0, 0.2 * k, 1.0 * k, 0.2 * k);
  M.add('stone', SPHERE, x, y + 1.62 * k, z, 0, 0, 0, 0.12 * k, 0.12 * k, 0.12 * k);
}
function bolaPinha(M, x, y, z) { box(M, 'stone', 0.55, 0.5, 0.55, x, y, z); box(M, 'stone', 0.65, 0.1, 0.65, x, y + 0.5, z); M.add('stone', SPHERE, x, y + 0.82, z, 0, 0, 0, 0.24, 0.26, 0.24); }

/**
 * Igreja: fachada voltada para −z no plano z = CZ, eixo x = CX, piso em CY.
 * Retorna { glassPos } (nada animado) — tudo vai para o mesclador M.
 */
export function buildChurch(M, CX = 18.9, CY = ruaY(62) + 0.35, CZ = 60) {
  const P = (key, g, x, y, z, rx, ry, rz, sx, sy, sz) => M.add(key, g, CX + x, CY + y, CZ + z, rx, ry, rz, sx, sy, sz);
  const B = (key, w, h, d, x, y0, z) => box(M, key, w, h, d, CX + x, CY + y0, CZ + z);
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const NW = 10.4, NH = 12, ND = 24, TX = 7.0, TZ = 1.4, TW = 3.6, TH = 15.6;

  // ── nave, capela-mor, embasamento ──
  B('cal', NW, NH + 0.6, ND, 0, -0.6, ND / 2);
  B('stone', NW + 0.2, 1.0, ND + 0.2, 0, -0.6, ND / 2);
  B('cal', 7.6, 9.6, 9, 0, -0.6, ND + 4.5); B('stone', 7.8, 1.0, 9.2, 0, -0.6, ND + 4.5);
  for (const s of [-1, 1]) {
    B('stone', 0.6, NH - 0.6, 0.3, s * 4.9, 0.4, -0.15);             // pilastras da fachada
    B('stone', 0.5, NH, 0.5, s * (NW / 2 - 0.2), 0, ND - 0.2);         // cunhais posteriores
    B('stone', 0.8, 0.35, ND, s * (NW / 2 + 0.1), NH - 0.35, ND / 2);  // cimalha lateral
    B('stone', 1.1, 0.28, ND + 0.4, s * (NW / 2 + 0.2), NH, ND / 2);
    B('stone', 0.5, 9, 0.5, s * 3.6, 0, ND + 8.8); B('stone', 0.9, 0.3, 9.4, s * 3.9, 8.7, ND + 4.5);
    for (const z of [7, 13, 19]) janela(M, s > 0 ? 'r' : 'l', CX + s * NW / 2, CY + 6.2, CZ + z, 1.1, 2.0, PLANE);
    janela(M, s > 0 ? 'r' : 'l', CX + s * 3.8, CY + 4.2, CZ + ND + 4.5, 1.0, 1.8, PLANE);
  }
  // cimalha frontal da nave
  B('stone', NW, 0.35, 0.5, 0, NH - 0.35, -0.05); B('stone', NW + 0.6, 0.3, 0.95, 0, NH, -0.2);

  // ── telhados (capa-canal) e oitões posteriores ──
  const roof = (hw, rise, len, ridgeY, zc) => {
    const th = Math.atan2(rise, hw), sw = Math.hypot(hw, rise) + 0.1;
    for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(sw, 0.14, len); g.rotateZ(-s * th); P('roof', g, s * (sw / 2) * Math.cos(th), ridgeY - (sw / 2) * Math.sin(th), zc); g.dispose(); }
    const tri = new THREE.Shape(); tri.moveTo(-hw + 0.6, 0); tri.lineTo(0, rise - 0.35 * rise / hw); tri.lineTo(hw - 0.6, 0); tri.closePath();
    return tri;
  };
  const triN = roof(5.95, 3.4, ND + 0.3, NH + 0.3 + 3.4, ND / 2 + 0.3);
  P('cal', extrude(triN, 0.4), 0, NH + 0.3, ND - 0.4);
  const triC = roof(4.4, 2.5, 9.6, 9 + 2.5 + 0.1, ND + 4.6);
  P('cal', extrude(triC, 0.4), 0, 9.05, ND + 8.6);
  P('roof', new THREE.BoxGeometry(0.35, 0.22, ND + 0.3), 0, NH + 0.3 + 3.4, ND / 2 + 0.3);
  P('roof', new THREE.BoxGeometry(0.3, 0.2, 9.6), 0, 9 + 2.6, ND + 4.6);

  // ── frontão curvo com óculo, pináculos e cruz ──
  const fs = frontaoShape(5.0, 1);
  P('stone', extrude(fs, 0.55), 0, NH + 0.3, -0.3);
  const inner = new THREE.Shape(fs.getPoints(14).map(p => new THREE.Vector2(p.x * 0.86, p.y * 0.8)));
  P('cal', extrude(inner, 0.05), 0, NH + 0.42, -0.36);
  oculo(M, 'f', CX, CY + NH + 2.3, CZ - 0.36, 0.62);
  for (const s of [-1, 1]) pinaculo(M, CX + s * 4.65, CY + NH + 1.3, CZ - 0.05, 0.9);
  B('stone', 0.55, 0.45, 0.45, 0, NH + 0.3 + 4.85, 0); B('stone', 0.2, 1.55, 0.2, 0, NH + 0.3 + 5.3, 0); B('stone', 0.85, 0.2, 0.2, 0, NH + 0.3 + 6.15, 0);

  // ── portada em cantaria: porta almofadada em arco, ombreiras, cimalha e cartela em relevo ──
  const ds = new THREE.Shape(); ds.moveTo(-1.25, 0); ds.lineTo(1.25, 0); ds.lineTo(1.25, 3.7); ds.absarc(0, 3.7, 1.25, 0, Math.PI, false); ds.lineTo(-1.25, 0);
  const dg = new THREE.ShapeGeometry(ds, 16); { const p = dg.attributes.position, uv = dg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.25) / 2.5, p.getY(i) / 4.95); }
  onFace(M, 'door', dg, 'f', CX, CY, CZ, 0, 0, 0.02);
  for (const s of [-1, 1]) { B('stone', 0.55, 5.3, 0.42, s * 1.62, 0, -0.18); B('stone', 0.75, 0.5, 0.55, s * 1.62, 0, -0.22); B('stone', 0.8, 0.25, 0.55, s * 1.62, 5.05, -0.24); }
  onFace(M, 'stone', new THREE.TorusGeometry(1.42, 0.2, 8, 22, Math.PI), 'f', CX, CY + 3.7, CZ, 0, 0, 0.16);
  B('stone', 4.3, 0.32, 0.55, 0, 5.3, -0.22); B('stone', 4.7, 0.2, 0.7, 0, 5.62, -0.3);
  onFace(M, 'relief', PLANE, 'f', CX, CY + 5.82, CZ, 0, 1.15, 0.34, 2.3, 2.3, 1);
  for (const s of [-1, 1]) janela(M, 'f', CX + s * 2.95, CY + 6.7, CZ, 1.1, 2.0, PLANE);
  // degraus diante da porta
  B('stone', 5.6, 0.175, 0.9, 0, -0.35, -0.55); B('stone', 5.0, 0.175, 0.45, 0, -0.175, -0.33);

  // ── torres sineiras ──
  const spandrel = (() => { const s = new THREE.Shape(); s.moveTo(-0.9, 0); s.lineTo(-0.9, 0.95); s.lineTo(0.9, 0.95); s.lineTo(0.9, 0); s.absarc(0, 0, 0.9, 0, Math.PI, false); return extrude(s, 0.9); })();
  const archRing = new THREE.TorusGeometry(0.9, 0.1, 6, 18, Math.PI);
  for (const s of [-1, 1]) {
    const x = s * TX;
    B('cal', TW, TH + 0.6, TW, x, -0.6, TZ); B('stone', TW + 0.2, 1.0, TW + 0.2, x, -0.6, TZ);
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) B('stone', 0.5, 19.2, 0.5, x + cx * 1.6, 0, TZ + cz * 1.6);
    B('stone', TW + 0.6, 0.35, TW + 0.6, x, NH - 0.35, TZ); B('stone', TW + 0.9, 0.28, TW + 0.9, x, NH, TZ);
    B('stone', TW + 0.5, 0.3, TW + 0.5, x, TH - 0.3, TZ);
    janela(M, 'f', CX + x, CY + 6.4, CZ + TZ - TW / 2, 0.85, 1.5, PLANE);
    janela(M, s > 0 ? 'r' : 'l', CX + x + s * TW / 2, CY + 6.4, CZ + TZ, 0.85, 1.5, PLANE);
    oculo(M, 'f', CX + x, CY + 13.7, CZ + TZ - TW / 2, 0.38);
    // sineira: pilares de canto, arcos nas 4 faces, banda superior
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) B('cal', 0.9, 2.85, 0.9, x + cx * 1.35, TH, TZ + cz * 1.35);
    B('cal', 0.7, 0.2, 0.7, x, TH, TZ);
    P('stone', spandrel, x, TH + 1.9, TZ - 1.8); P('stone', spandrel, x, TH + 1.9, TZ + 0.9);
    P('cal', spandrel, x + 0.9, TH + 1.9, TZ, 0, Math.PI / 2, 0); P('cal', spandrel, x - 1.8, TH + 1.9, TZ, 0, Math.PI / 2, 0);
    P('stone', archRing, x, TH + 1.9, TZ - 1.84); P('stone', archRing, x, TH + 1.9, TZ + 1.84);
    P('stone', archRing, x + 1.84, TH + 1.9, TZ, 0, Math.PI / 2, 0); P('stone', archRing, x - 1.84, TH + 1.9, TZ, 0, Math.PI / 2, 0);
    B('cal', TW, 0.75, TW, x, TH + 2.85, TZ);
    B('stone', TW + 0.1, 0.12, 0.35, x, TH + 0.0, TZ - 1.62); // peitoril da sineira
    // sino de bronze com cepo de madeira
    P('bronze', BELL, x, TH + 0.85, TZ, 0, 0, 0, 1, 1, 1);
    B('wood', 1.9, 0.2, 0.24, x, TH + 1.78, TZ); P('bronze', SPHERE, x, TH + 0.9, TZ, 0, 0, 0, 0.07, 0.07, 0.07);
    // cimalha, pináculos, cúpula bulbosa, lanterna e cruz
    B('stone', TW + 0.5, 0.3, TW + 0.5, x, TH + 3.6, TZ); B('stone', TW + 0.85, 0.25, TW + 0.85, x, TH + 3.9, TZ);
    const top = TH + 4.15;
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) pinaculo(M, CX + x + cx * 1.75, CY + top, CZ + TZ + cz * 1.75);
    P('stone', CYL8, x, top + 0.25, TZ, 0, 0, 0, 1.6, 0.5, 1.6);
    P('ocre', DOME, x, top + 0.5, TZ);
    P('stone', CYL8, x, top + 3.55, TZ, 0, 0, 0, 0.24, 0.5, 0.24); P('stone', SPHERE, x, top + 3.95, TZ, 0, 0, 0, 0.3, 0.3, 0.3);
    B('iron', 0.08, 1.3, 0.08, x, top + 4.15, TZ); B('iron', 0.62, 0.08, 0.08, x, top + 4.95, TZ);
  }
}

/** adro com muro de arrimo, escadaria de pedra até a rua (z = 45), parapeitos e pinhas */
export function buildAdro(M) {
  const Ya = ruaY(62), yb = 1.0, z0 = 45, zs = 48, z1 = 61, sx0 = 14.3, sx1 = 23.5;
  const block = (x0, x1, za, zb) => { box(M, 'ashlar', x1 - x0, Ya - 0.04 - yb, zb - za, (x0 + x1) / 2, yb, (za + zb) / 2); box(M, 'laje', x1 - x0, 0.08, zb - za, (x0 + x1) / 2, Ya - 0.06, (za + zb) / 2); };
  block(8.75, sx0, z0, zs); block(sx1, 29.85, z0, zs); block(7, 31, zs, z1);
  const n = 7, y0 = ruaY(z0), rise = (Ya + 0.02 - y0) / n, tread = (zs - z0) / n;
  for (let i = 0; i < n; i++) { const za = z0 + i * tread; box(M, 'laje', sx1 - sx0, y0 + (i + 1) * rise - yb, zs - za, (sx0 + sx1) / 2, yb, (za + zs) / 2); }
  const top = Ya + 0.02, ph = 0.85;
  const wall = (x0, x1, za, zb) => { box(M, 'cal', x1 - x0, ph, zb - za, (x0 + x1) / 2, top, (za + zb) / 2); box(M, 'stone', x1 - x0 + 0.12, 0.12, zb - za + 0.12, (x0 + x1) / 2, top + ph, (za + zb) / 2); };
  wall(sx0 - 0.36, sx0, z0, zs); wall(sx1, sx1 + 0.36, z0, zs);
  wall(8.75, sx0 - 0.36, z0, z0 + 0.36); wall(sx1 + 0.36, 29.85, z0, z0 + 0.36);
  wall(7, 7.36, zs, z1 - 1); wall(30.64, 31, zs, z1 - 1); wall(7, 8.75, zs, zs + 0.36); wall(29.85, 31, zs, zs + 0.36);
  for (const x of [sx0 - 0.18, sx1 + 0.18]) for (const z of [z0 + 0.18, zs - 0.18]) bolaPinha(M, x, top + ph + 0.12, z);
  // banco de pedra encostado no parapeito oeste e outro no leste
  for (const [x, s] of [[7.9, 1], [30.1, -1]]) { box(M, 'stone', 0.5, 0.1, 2.0, x, top + 0.38, 53.5); for (const dz of [-0.7, 0.7]) box(M, 'stone', 0.36, 0.38, 0.3, x - s * 0.02, top, 53.5 + dz); }
  return { Ya: top };
}

/** igrejinha distante no morro (silhueta: nave, duas torres com coruchéu) */
export function miniChurch(M, x, y, z, ry, k = 1) {
  const c = Math.cos(ry), s = Math.sin(ry), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const bx = (key, w, h, d, lx, y0, lz) => { const [X, Z] = at(lx, lz); M.add(key, BOX, X, y + y0 * k + h * k / 2, Z, 0, ry, 0, w * k, h * k, d * k); };
  bx('cal', 8, 10, 16, 0, -2, 8); bx('stone', 8.4, 0.4, 16.4, 0, 7.8, 8);
  const [rx, rz] = at(0, 8.2); const g = new THREE.ConeGeometry(1, 1, 4); g.rotateY(Math.PI / 4); M.add('roof', g, rx, y + 9.1 * k, rz, 0, ry, 0, 6.2 * k, 2.6 * k, 12.2 * k);
  for (const sx of [-1, 1]) {
    bx('cal', 2.8, 14.5, 2.8, sx * 4.6, -2, 0.8); bx('stone', 3.2, 0.4, 3.2, sx * 4.6, 12.3, 0.8); bx('glass', 1.0, 1.4, 0.1, sx * 4.6, 10.5, -0.62);
    const [tx, tz] = at(sx * 4.6, 0.8); M.add('ocre', DOME, tx, y + 12.7 * k, tz, 0, 0, 0, 0.8 * k, 0.8 * k, 0.8 * k);
  }
  bx('glass', 1.6, 2.6, 0.1, 0, -0.2, -0.05);
}
