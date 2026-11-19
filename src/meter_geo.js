// Geometria auxiliar do MEDIDOR 3D (unidades em mm; os grupos pais escalam 0,001). Dono: MEDIDOR 3D.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { mergeGeometries };

/** retângulo com cantos em arco verdadeiro (r por canto: [bl, br, tr, tl]) — também como Path (furos) */
export function roundRect(w, h, rs, cx = 0, cy = 0, P = THREE.Shape) {
  const s = new P(); const x0 = cx - w / 2, y0 = cy - h / 2; const [bl, br, tr, tl] = Array.isArray(rs) ? rs : [rs, rs, rs, rs];
  s.moveTo(x0 + bl, y0); s.lineTo(x0 + w - br, y0); if (br) s.absarc(x0 + w - br, y0 + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + h - tr); if (tr) s.absarc(x0 + w - tr, y0 + h - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x0 + tl, y0 + h); if (tl) s.absarc(x0 + tl, y0 + h - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + bl); if (bl) s.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}
export function circlePath(r, cx = 0, cy = 0, P = THREE.Path) { const p = new P(); p.absarc(cx, cy, r, 0, Math.PI * 2, false); return p; }

/** remove pontos repetidos (evita "rasgos" no chanfro da extrusão) */
export function cleanShape(shape, curve = 24) {
  const { shape: pts, holes } = shape.extractPoints(curve);
  const dedup = (a) => { const o = []; for (const q of a) if (!o.length || o[o.length - 1].distanceTo(q) > 1e-5) o.push(q);
    while (o.length > 2 && o[0].distanceTo(o[o.length - 1]) < 1e-5) o.pop(); return o; };
  const s = new THREE.Shape(dedup(pts)); s.holes = holes.map((hh) => new THREE.Path(dedup(hh))); return s;
}
/**
 * Extrusão com bisel arredondado e normais suaves, centrada em z (espessura total T).
 * uv: 'box' (projeção por eixo dominante, mm × uvScale) | 'planar' (xy normalizado → decalques)
 */
export function extrudeSmooth(shape, T, { bt = 1, bs = 1, seg = 6, curve = 24, uv = 'box', uvScale = 1 } = {}) {
  const depth = Math.max(0.0001, T - 2 * bt);
  shape = cleanShape(shape, curve);
  let g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bs, bevelOffset: -bs, bevelSegments: seg, curveSegments: curve });
  g.translate(0, 0, -depth / 2);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-4); g.computeVertexNormals();
  g.computeBoundingBox(); const bb = g.boundingBox;
  const P = g.attributes.position, N = g.attributes.normal, uvA = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (uv === 'planar') { uvA[i * 2] = (x - bb.min.x) / (bb.max.x - bb.min.x); uvA[i * 2 + 1] = (y - bb.min.y) / (bb.max.y - bb.min.y); continue; }
    const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
    let a, b; if (az >= ax && az >= ay) { a = x; b = y; } else if (ax >= ay) { a = z; b = y; } else { a = x; b = z; }
    uvA[i * 2] = a * uvScale; uvA[i * 2 + 1] = b * uvScale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvA, 2));
  return g;
}
/** torno (LatheGeometry) com UV (u = ângulo, v = comprimento de arco em mm × vScale) */
export function lathe(pts, seg = 48, vScale = 1 / 40, phi0 = 0, phiL = Math.PI * 2) {
  const v2 = pts.map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(v2, seg, phi0, phiL);
  // v por comprimento de arco (textura não estica nas curvas)
  const L = [0]; for (let i = 1; i < v2.length; i++) L.push(L[i - 1] + v2[i].distanceTo(v2[i - 1]));
  const uv = g.attributes.uv; const n = v2.length;
  for (let j = 0; j <= seg; j++) for (let i = 0; i < n; i++) { const k = j * n + i; uv.setY(k, L[i] * vScale); }
  return g;
}
/** tubo reto ao longo de y (com tampas), base em y0 */
export function cyl(r, h, y0 = 0, seg = 24, r2 = r, open = false) {
  const g = new THREE.CylinderGeometry(r2, r, h, seg, 1, open); g.translate(0, y0 + h / 2, 0); return g;
}
/** cilindro com bordas arredondadas (perfil de torno): raio r, altura h, raio de borda e */
export function roundedCyl(r, h, e = 1, seg = 32, y0 = 0, n = 4) {
  const pts = [[0, y0]];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push([r - e + e * Math.cos(a), y0 + e + e * Math.sin(a)]); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push([r - e + e * Math.cos(a), y0 + h - e + e * Math.sin(a)]); }
  pts.push([0, y0 + h]);
  return lathe(pts, seg);
}
/** caixa arredondada (todas as arestas com raio r), centrada */
export function rbox(w, h, d, r = 1, seg = 3) {
  const s = roundRect(w, h, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  return extrudeSmooth(s, d, { bt: Math.min(r, d / 2 - 0.01), bs: Math.min(r, d / 2 - 0.01) * 0.999, seg, curve: 6 });
}
/** pinta cor de vértice (multiplicador) — fn(x,y,z,nx,ny,nz) → [r,g,b] */
export function paintVerts(geo, fn) {
  const P = geo.attributes.position, N = geo.attributes.normal, c = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { const v = fn(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i)); c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
/** aplica matriz (posição, rotação euler, escala) e devolve a geometria (encadeável) */
export function place(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
  return g.applyMatrix4(m);
}
/** junta geometrias com atributos compatíveis (remove uv/color ausentes para uniformizar) */
export function merge(list) {
  const keys = ['position', 'normal', 'uv'];
  const gs = list.map((g) => {
    let q = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(q.attributes)) if (!keys.includes(k)) q.deleteAttribute(k);
    if (!q.attributes.uv) q.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
    if (!q.attributes.normal) q.computeVertexNormals();
    return q;
  });
  return mergeGeometries(gs, false);
}

// ─── ícones das teclas (mm, centrados) ───
export function iconShapes(kind, s = 1) {
  const out = [];
  const bar = (x, y, w, h, r = Math.min(w, h) * 0.45) => out.push(roundRect(w * s, h * s, r * s, x * s, y * s));
  if (kind === 'power') {
    const R = 1.85 * s, r = 1.32 * s, g = 0.62;
    const a0 = Math.PI / 2 + g, a1 = Math.PI / 2 - g + Math.PI * 2;
    const sh = new THREE.Shape(); sh.absarc(0, 0, R, a0, a1, false);
    const ex = (R + r) / 2, ep = (R - r) / 2;
    sh.absarc(ex * Math.cos(a1), ex * Math.sin(a1), ep, a1, a1 + Math.PI, false);
    sh.absarc(0, 0, r, a1, a0, true);
    sh.absarc(ex * Math.cos(a0), ex * Math.sin(a0), ep, a0 + Math.PI, a0, false);
    out.push(sh); bar(0, 1.1, 0.52, 2.15, 0.26);
  } else if (kind === 'play') {
    const t = new THREE.Shape(); t.moveTo(-2.05 * s, -1.6 * s); t.lineTo(0.35 * s, 0); t.lineTo(-2.05 * s, 1.6 * s); t.closePath(); out.push(t);
    bar(1.0, 0, 0.55, 3.2, 0.12); bar(1.95, 0, 0.55, 3.2, 0.12);
  } else if (kind === 'stop') {
    out.push(roundRect(3.0 * s, 3.0 * s, 0.45 * s));
  } else if (kind === 'menu') {
    bar(0, 1.15, 3.5, 0.6); bar(0, 0, 3.5, 0.6); bar(0, -1.15, 3.5, 0.6);
  }
  return out;
}
