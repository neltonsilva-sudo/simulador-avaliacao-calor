// CIDADE — igreja barroca no alto da ladeira (adro, escadaria, torres sineiras) + mesclador de geometria por material
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ruaY, ruaX } from './layout_rua.js';
import { rnd } from './street_city_tex.js';

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

/** Igreja de torre única central (como a da foto): fachada voltada para −z no plano z = CZ, eixo x = CX, piso em CY. */
export function buildChurch(M, CX = 18.9, CY = ruaY(62) + 0.35, CZ = 60) {
  const P = (key, g, x, y, z, rx, ry, rz, sx, sy, sz) => M.add(key, g, CX + x, CY + y, CZ + z, rx, ry, rz, sx, sy, sz);
  const B = (key, w, h, d, x, y0, z) => box(M, key, w, h, d, CX + x, CY + y0, CZ + z);
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const DRIP = new THREE.PlaneGeometry(1, 1), DAMP = new THREE.PlaneGeometry(1, 1);
  { const u = DRIP.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, 0.5 + u.getY(i) * 0.5); const v = DAMP.attributes.uv; for (let i = 0; i < v.count; i++) v.setY(i, v.getY(i) * 0.5); }
  // decalques de envelhecimento: escorrimento pendurado em y (topo) e umidade a partir de y (base)
  const drip = (face, X, Y, Z, w, h) => onFace(M, 'grime', DRIP, face, X, Y, Z, 0, -h / 2, 0.012, w, h, 1);
  const damp = (face, X, Y, Z, w, h) => onFace(M, 'grime', DAMP, face, X, Y, Z, 0, h / 2, 0.012, w, h, 1);
  const NW = 10.4, NH = 12, ND = 24, TW = 4.2, TZ0 = -0.7, TZ = TZ0 + TW / 2, TH = 20.2, WX = (TW / 2 + NW / 2) / 2, WW = NW / 2 - TW / 2;

  // ── nave, capela-mor, embasamento ──
  B('cal', NW, NH + 0.6, ND, 0, -0.6, ND / 2);
  B('stone', NW + 0.2, 1.0, ND + 0.2, 0, -0.6, ND / 2);
  B('cal', 7.6, 9.6, 9, 0, -0.6, ND + 4.5); B('stone', 7.8, 1.0, 9.2, 0, -0.6, ND + 4.5);
  for (const s of [-1, 1]) {
    const f = s > 0 ? 'r' : 'l';
    B('stone', 0.55, NH, 0.55, s * (NW / 2 - 0.2), 0, 0.1);
    B('stone', 0.5, NH, 0.5, s * (NW / 2 - 0.2), 0, ND - 0.2);
    B('stone', 0.8, 0.35, ND, s * (NW / 2 + 0.1), NH - 0.35, ND / 2);
    B('stone', 1.1, 0.28, ND + 0.4, s * (NW / 2 + 0.2), NH, ND / 2);
    B('stone', 0.5, 9, 0.5, s * 3.6, 0, ND + 8.8); B('stone', 0.9, 0.3, 9.4, s * 3.9, 8.7, ND + 4.5);
    for (const z of [7, 13, 19]) janela(M, f, CX + s * NW / 2, CY + 6.2, CZ + z, 1.1, 2.0, PLANE);
    janela(M, f, CX + s * 3.8, CY + 4.2, CZ + ND + 4.5, 1.0, 1.8, PLANE);
    for (let z = 2; z < ND; z += 4) { drip(f, CX + s * NW / 2, CY + NH - 0.35, CZ + z, 4.1, 2.6 + rnd() * 1.6); damp(f, CX + s * NW / 2, CY + 0.4, CZ + z, 4.1, 1.0 + rnd() * 0.6); }
    // alas da fachada: janelas térreas e do coro, cimalha, meio-frontão em voluta, pináculo
    janela(M, 'f', CX + s * WX, CY + 2.4, CZ, 1.0, 1.7, PLANE);
    janela(M, 'f', CX + s * WX, CY + 6.9, CZ, 1.1, 2.0, PLANE);
    drip('f', CX + s * WX, CY + NH - 0.35, CZ, WW, 3.4); damp('f', CX + s * WX, CY + 0.4, CZ, WW, 1.3);
    const vs = new THREE.Shape(), X = (v) => s * (TW / 2 + v);
    vs.moveTo(X(0), 0); vs.lineTo(X(0), 2.9); vs.bezierCurveTo(X(1.0), 2.9, X(1.2), 1.3, X(2.2), 1.05); vs.quadraticCurveTo(X(WW), 0.95, X(WW), 0.5); vs.lineTo(X(WW), 0); vs.lineTo(X(0), 0);
    P('stone', extrude(vs, 0.5), 0, NH + 0.3, -0.3);
    const vi = new THREE.Shape(vs.getPoints(10).map(p => new THREE.Vector2(s * (TW / 2 + (Math.abs(p.x) - TW / 2) * 0.88), p.y * 0.78 + 0.1)));
    P('cal', extrude(vi, 0.05), 0, NH + 0.3, -0.36);
    pinaculo(M, CX + s * (NW / 2 - 0.3), CY + NH + 0.3, CZ - 0.05, 0.9);
  }
  B('stone', NW, 0.35, 0.5, 0, NH - 0.35, -0.05); B('stone', NW + 0.6, 0.3, 0.95, 0, NH, -0.2);

  // ── telhados (capa-canal) e oitões posteriores ──
  const roof = (hw, rise, len, ridgeY, zc) => {
    const th = Math.atan2(rise, hw), sw = Math.hypot(hw, rise) + 0.1;
    for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(sw, 0.14, len); g.rotateZ(-s * th); P('roof', g, s * (sw / 2) * Math.cos(th), ridgeY - (sw / 2) * Math.sin(th), zc); g.dispose(); }
    const tri = new THREE.Shape(); tri.moveTo(-hw + 0.6, 0); tri.lineTo(0, rise - 0.35 * rise / hw); tri.lineTo(hw - 0.6, 0); tri.closePath();
    return tri;
  };
  const triN = roof(5.95, 3.4, ND + 0.3, NH + 0.3 + 3.4, ND / 2 + 0.3);
  P('cal', extrude(triN, 0.4), 0, NH + 0.3, ND - 0.4); P('cal', extrude(triN, 0.4), 0, NH + 0.3, 0.1);
  const triC = roof(4.4, 2.5, 9.6, 9 + 2.5 + 0.1, ND + 4.6);
  P('cal', extrude(triC, 0.4), 0, 9.05, ND + 8.6);
  P('roof', new THREE.BoxGeometry(0.35, 0.22, ND + 0.3), 0, NH + 0.3 + 3.4, ND / 2 + 0.3);
  P('roof', new THREE.BoxGeometry(0.3, 0.2, 9.6), 0, 9 + 2.6, ND + 4.6);

  // ── torre única central, alta e esguia, rebocada em ocre-amarelo ──
  B('ocre', TW, TH + 0.6, TW, 0, -0.6, TZ); B('stone', TW + 0.2, 1.0, TW + 0.2, 0, -0.6, TZ);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) B('stone', 0.5, TH + 3.75, 0.5, cx * (TW / 2 - 0.2), 0, TZ + cz * (TW / 2 - 0.2));
  B('stone', TW + 0.6, 0.35, TW + 0.6, 0, NH - 0.35, TZ); B('stone', TW + 0.9, 0.28, TW + 0.9, 0, NH, TZ);
  B('stone', TW + 0.4, 0.3, TW + 0.4, 0, 16.3, TZ); B('stone', TW + 0.5, 0.3, TW + 0.5, 0, TH - 0.3, TZ);
  const Zf = CZ + TZ0;
  // portada em cantaria na base da torre
  const ds = new THREE.Shape(); ds.moveTo(-1.1, 0); ds.lineTo(1.1, 0); ds.lineTo(1.1, 3.5); ds.absarc(0, 3.5, 1.1, 0, Math.PI, false); ds.lineTo(-1.1, 0);
  const dg = new THREE.ShapeGeometry(ds, 16); { const p = dg.attributes.position, uv = dg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 1.1) / 2.2, p.getY(i) / 4.6); }
  onFace(M, 'door', dg, 'f', CX, CY, Zf, 0, 0, 0.02);
  for (const s of [-1, 1]) { B('stone', 0.45, 5.0, 0.42, s * 1.42, 0, TZ0 - 0.18); B('stone', 0.62, 0.5, 0.55, s * 1.42, 0, TZ0 - 0.22); B('stone', 0.66, 0.25, 0.55, s * 1.42, 4.75, TZ0 - 0.24); }
  onFace(M, 'stone', new THREE.TorusGeometry(1.25, 0.18, 8, 22, Math.PI), 'f', CX, CY + 3.5, Zf, 0, 0, 0.16);
  B('stone', 3.6, 0.32, 0.55, 0, 5.0, TZ0 - 0.22); B('stone', 3.9, 0.2, 0.7, 0, 5.32, TZ0 - 0.3);
  onFace(M, 'relief', PLANE, 'f', CX, CY + 5.52, Zf, 0, 1.05, 0.34, 2.1, 2.1, 1);
  janela(M, 'f', CX, CY + 8.9, Zf, 1.1, 1.9, PLANE);
  oculo(M, 'f', CX, CY + 14.2, Zf, 0.55);
  drip('f', CX, CY + NH - 0.35, Zf, TW - 0.6, 3.0); drip('f', CX, CY + 16.3, Zf, TW - 0.6, 2.4); damp('f', CX, CY + 0.4, Zf, TW - 0.6, 1.2);
  for (const s of [-1, 1]) { const f = s > 0 ? 'r' : 'l'; janela(M, f, CX + s * TW / 2, CY + 17.4, CZ + TZ, 0.8, 1.3, PLANE); drip(f, CX + s * TW / 2, CY + TH - 0.3, CZ + TZ, TW - 0.6, 3.0); drip(f, CX + s * TW / 2, CY + 16.3, CZ + TZ, TW - 0.6, 2.0); }
  janela(M, 'f', CX, CY + 17.4, Zf, 0.8, 1.3, PLANE); drip('f', CX, CY + TH - 0.3, Zf, TW - 0.6, 3.0);
  // sineira: pilares, arcos nas 4 faces, sino grande à frente
  const R = 1.25, SP = TH + 2.4, pier = (TW - 2 * R) / 2;
  const spd = (() => { const s = new THREE.Shape(); s.moveTo(-R, 0); s.lineTo(-R, R + 0.1); s.lineTo(R, R + 0.1); s.lineTo(R, 0); s.absarc(0, 0, R, 0, Math.PI, false); return extrude(s, pier); })();
  const ring = new THREE.TorusGeometry(R, 0.11, 6, 20, Math.PI);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) B('ocre', pier, SP + R + 0.1 - TH, pier, cx * (TW / 2 - pier / 2), TH, TZ + cz * (TW / 2 - pier / 2));
  P('ocre', spd, 0, SP, TZ0); P('ocre', spd, 0, SP, TZ0 + TW - pier);
  P('ocre', spd, TW / 2 - pier, SP, TZ, 0, Math.PI / 2, 0); P('ocre', spd, -TW / 2, SP, TZ, 0, Math.PI / 2, 0);
  P('stone', ring, 0, SP, TZ0 - 0.05); P('stone', ring, 0, SP, TZ0 + TW + 0.05);
  P('stone', ring, TW / 2 + 0.05, SP, TZ, 0, Math.PI / 2, 0); P('stone', ring, -TW / 2 - 0.05, SP, TZ, 0, Math.PI / 2, 0);
  const bandY = SP + R + 0.1;
  B('ocre', TW, 0.7, TW, 0, bandY, TZ);
  B('stone', TW + 0.1, 0.12, 0.35, 0, TH, TZ0 + 0.18);
  P('bronze', BELL, 0, TH + 0.75, TZ, 0, 0, 0, 1.3, 1.3, 1.3); B('wood', 2.6, 0.22, 0.26, 0, TH + 2.0, TZ);
  P('bronze', BELL, 0.0, TH + 1.25, TZ + 1.0, 0, 0, 0, 0.7, 0.7, 0.7);
  B('stone', TW + 0.5, 0.3, TW + 0.5, 0, bandY + 0.7, TZ); B('stone', TW + 0.85, 0.25, TW + 0.85, 0, bandY + 1.0, TZ);
  const top = bandY + 1.25;
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) pinaculo(M, CX + cx * (TW / 2 - 0.1), CY + top, CZ + TZ + cz * (TW / 2 - 0.1));
  P('ocre', CYL8, 0, top + 0.35, TZ, 0, 0, 0, 1.75, 0.7, 1.75); P('stone', CYL8, 0, top + 0.75, TZ, 0, 0, 0, 1.85, 0.12, 1.85);
  P('dome', DOME, 0, top + 0.8, TZ, 0, 0, 0, 0.95, 1.35, 0.95);
  P('stone', CYL8, 0, top + 4.95, TZ, 0, 0, 0, 0.24, 0.6, 0.24); P('stone', SPHERE, 0, top + 5.4, TZ, 0, 0, 0, 0.3, 0.3, 0.3);
  B('iron', 0.09, 1.5, 0.09, 0, top + 5.6, TZ); B('iron', 0.7, 0.09, 0.09, 0, top + 6.5, TZ);
  // degraus diante da porta
  B('stone', 4.6, 0.175, 0.9, 0, -0.35, TZ0 - 0.55); B('stone', 4.0, 0.175, 0.45, 0, -0.175, TZ0 - 0.33);
}

/** adro com muro de arrimo, escadaria de pedra até a rua (z = 45), parapeitos e pinhas */
export function buildAdro(M) {
  const Ya = ruaY(62), yb = 1.0, z0 = 45, zs = 48, z1 = 61, ox = ruaX(45), sx0 = 14.3 + ox, sx1 = 23.5 + ox;
  const block = (x0, x1, za, zb) => { box(M, 'ashlar', x1 - x0, Ya - 0.04 - yb, zb - za, (x0 + x1) / 2, yb, (za + zb) / 2); box(M, 'cobble', x1 - x0, 0.08, zb - za, (x0 + x1) / 2, Ya - 0.06, (za + zb) / 2); };
  block(8.75 + ox, sx0, z0, zs); block(sx1, 29.85 + ox, z0, zs); block(7, 31, zs, z1);
  const n = 7, y0 = ruaY(z0), rise = (Ya + 0.02 - y0) / n, tread = (zs - z0) / n;
  for (let i = 0; i < n; i++) { const za = z0 + i * tread; box(M, 'laje', sx1 - sx0, y0 + (i + 1) * rise - yb, zs - za, (sx0 + sx1) / 2, yb, (za + zs) / 2); }
  const top = Ya + 0.02, ph = 0.85;
  const wall = (x0, x1, za, zb) => { box(M, 'cal', x1 - x0, ph, zb - za, (x0 + x1) / 2, top, (za + zb) / 2); box(M, 'stone', x1 - x0 + 0.12, 0.12, zb - za + 0.12, (x0 + x1) / 2, top + ph, (za + zb) / 2); };
  wall(sx0 - 0.36, sx0, z0, zs); wall(sx1, sx1 + 0.36, z0, zs);
  wall(8.75 + ox, sx0 - 0.36, z0, z0 + 0.36); wall(sx1 + 0.36, 29.85 + ox, z0, z0 + 0.36);
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
    const [tx, tz] = at(sx * 4.6, 0.8); M.add('dome', DOME, tx, y + 12.7 * k, tz, 0, 0, 0, 0.8 * k, 0.8 * k, 0.8 * k);
  }
  bx('glass', 1.6, 2.6, 0.1, 0, -0.2, -0.05);
}
