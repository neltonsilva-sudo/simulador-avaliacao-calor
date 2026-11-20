// CALDEIRAS — geometria procedural: lotes mesclados por material (com cor de vértice para sujeira/AO assada), instâncias
// (parafusos, porcas, montantes), costados de vasos com tampos (UV em metros), tubulação com curvas, flanges, válvulas
// com volante, manômetros, perfis I.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export function mat4(pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
  return new THREE.Matrix4().compose(_p.set(...pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ')), _s.set(...(typeof scl === 'number' ? [scl, scl, scl] : scl)));
}
/** matriz que leva o eixo +y local para a direção dir (unitária), com origem em pos */
export function alignY(pos, dir, scl = [1, 1, 1]) {
  _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return new THREE.Matrix4().compose(pos.clone ? pos.clone() : new THREE.Vector3(...pos), _q, _s.set(...scl));
}

// ───────────── lotes mesclados ─────────────
// shade(p: Vector3 mundo, n: Vector3 mundo) → fator (0..1+) multiplicado na cor do vértice (sujeira, AO assada)
export class Batch {
  constructor() { this.parts = new Map(); }
  add(key, geo, matrix, tint = null) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    g.userData.tint = tint;
    (this.parts.get(key) || this.parts.set(key, []).get(key)).push(g);
    return g;
  }
  build(group, mats, shade = {}) {
    const meshes = {};
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [key, list] of this.parts) {
      const mat = mats[key]; if (!mat) { console.warn('[cald] material ausente', key); continue; }
      for (const g of list) {
        const P = g.attributes.position, N = g.attributes.normal, cnt = P.count, col = new Float32Array(cnt * 3), f = shade[key], t = g.userData.tint;
        for (let i = 0; i < cnt; i++) {
          let v = 1; if (f) { p.fromBufferAttribute(P, i); n.fromBufferAttribute(N, i); v = f(p, n); }
          col[i * 3] = v * (t ? t[0] : 1); col[i * 3 + 1] = v * (t ? t[1] : 1); col[i * 3 + 2] = v * (t ? t[2] : 1);
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      const merged = mergeGeometries(list, false); list.forEach((g) => g.dispose());
      if (!merged) { console.warn('[cald] merge falhou', key); continue; }
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, mat); m.name = 'cald_' + key; m.castShadow = mat.userData.cast !== false; m.receiveShadow = true;
      group.add(m); meshes[key] = m;
    }
    this.parts.clear(); return meshes;
  }
}

// ───────────── instâncias ─────────────
export class Inst {
  constructor() { this.sets = new Map(); }
  add(key, geo, mat, matrix) { let s = this.sets.get(key); if (!s) this.sets.set(key, (s = { geo, mat, list: [] })); s.list.push(matrix.clone()); }
  build(group, { cast = true } = {}) {
    const out = {};
    for (const [key, s] of this.sets) {
      const im = new THREE.InstancedMesh(s.geo, s.mat, s.list.length); s.list.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = cast; im.receiveShadow = true; im.name = 'cald_inst_' + key; group.add(im); out[key] = im;
    }
    return out;
  }
}

// ───────────── costado com tampos (eixo +y local, centrado) — UV em "folhas" (u = perímetro/sheetW, v = comprimento/sheetL) ─────────────
// head: 'ell' (2:1 elipsoidal, profundidade R/2), 'tori' (torisférico ~R/4), 'flat', 'none'
export function shellGeo(R, Lc, { top = 'ell', bot = 'ell', seg = 72, sheetW = 1.2, sheetL = 1.0, rings = 10 } = {}) {
  const prof = []; // [r, y]
  const head = (kind, sgn) => {
    const pts = [];
    if (kind === 'ell' || kind === 'tori') {
      const d = kind === 'ell' ? R / 2 : R / 4;
      for (let i = 0; i <= rings; i++) { const a = (i / rings) * Math.PI / 2; pts.push([R * Math.cos(a), sgn * (Lc / 2 + d * Math.sin(a))]); }
    } else if (kind === 'flat') { pts.push([R, sgn * Lc / 2], [R * 0.999, sgn * (Lc / 2 + 0.001)], [0, sgn * (Lc / 2 + 0.001)]); }
    else pts.push([R, sgn * Lc / 2]);
    return pts;
  };
  const b = head(bot, -1).reverse(), t = head(top, +1);
  // corpo: subdividido para iluminação suave da cor de vértice
  const body = []; const nb = Math.max(2, Math.ceil(Lc / 0.5));
  for (let i = 1; i < nb; i++) body.push([R, -Lc / 2 + (Lc * i) / nb]);
  for (const q of [...b, ...body, ...t]) prof.push(q);
  // comprimento de arco ao longo do perfil
  const s = [0]; for (let i = 1; i < prof.length; i++) s.push(s[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const pos = [], nor = [], uv = [], idx = [];
  // normais do perfil (diferença central)
  const pn = prof.map((q, i) => { const a = prof[Math.max(0, i - 1)], c = prof[Math.min(prof.length - 1, i + 1)]; const dy = c[1] - a[1], dr = c[0] - a[0]; const l = Math.hypot(dy, dr) || 1; return [dy / l, -dr / l]; });
  for (let i = 0; i < prof.length; i++) for (let j = 0; j <= seg; j++) {
    const a = (j / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    pos.push(prof[i][0] * sa, prof[i][1], prof[i][0] * ca); nor.push(pn[i][0] * sa, pn[i][1], pn[i][0] * ca);
    uv.push((j / seg) * (2 * Math.PI * R) / sheetW, s[i] / sheetL);
  }
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * (seg + 1) + j, b2 = a + seg + 1; idx.push(a, a + 1, b2, b2, a + 1, b2 + 1); } // CCW visto de fora (normais para fora)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
/** cilindro aberto com UV em metros (u = perímetro, v = comprimento) */
export function cylGeo(r, L, seg = 32, open = false, sheet = 1) {
  const g = new THREE.CylinderGeometry(r, r, L, seg, Math.max(1, Math.round(L / 0.6)), open);
  const uv = g.attributes.uv, P = g.attributes.position;
  for (let i = 0; i < uv.count; i++) { const y = P.getY(i); if (Math.abs(Math.abs(y) - L / 2) < 1e-5 && !open && Math.hypot(P.getX(i), P.getZ(i)) < r * 0.999) continue; uv.setXY(i, uv.getX(i) * 2 * Math.PI * r / sheet, (y + L / 2) / sheet); }
  return g;
}

// ───────────── tubulação: polilinha com curvas de raio rb ─────────────
export function pipePath(points, rb) {
  const P = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  const path = new THREE.CurvePath(); let cur = P[0].clone();
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    if (!c) { path.add(new THREE.LineCurve3(cur, b.clone())); break; }
    const din = b.clone().sub(a).normalize(), dout = c.clone().sub(b).normalize();
    const r = Math.min(rb, a.distanceTo(b) * 0.45, b.distanceTo(c) * 0.45);
    const s = b.clone().addScaledVector(din, -r), e = b.clone().addScaledVector(dout, r);
    if (cur.distanceTo(s) > 1e-4) path.add(new THREE.LineCurve3(cur, s));
    path.add(new THREE.QuadraticBezierCurve3(s, b.clone(), e)); cur = e;
  }
  return path;
}
export function tubeGeo(points, r, rb = r * 3, radial = 20) {
  const path = pipePath(points, rb), L = path.getLength();
  const segs = Math.max(4, Math.round(L / 0.12) + points.length * 8);
  const g = new THREE.TubeGeometry(path, segs, r, radial, false);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const a = uv.getX(i), b = uv.getY(i); uv.setXY(i, b * 2 * Math.PI * r / 0.6, a * L); }
  return { geo: g, path, L };
}

// ───────────── peças ─────────────
const geoCache = new Map();
export function cached(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
export const hexGeo = () => cached('hex', () => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1); g.rotateY(Math.PI / 6); return g; });
export const boltGeo = () => cached('bolt', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 8, 1));
/** acrescenta porcas (instâncias) num círculo de parafusos: centro c, normal n, raio rb, contagem k, tamanho s */
export function boltCircle(inst, mat, c, n, rb, k, s = 0.03, len = 0.02, phase = 0) {
  const nn = n.clone().normalize(), up = Math.abs(nn.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3().crossVectors(nn, up).normalize(), t2 = new THREE.Vector3().crossVectors(nn, t1);
  for (let i = 0; i < k; i++) {
    const a = phase + (i / k) * Math.PI * 2, p = c.clone().addScaledVector(t1, Math.cos(a) * rb).addScaledVector(t2, Math.sin(a) * rb);
    inst.add('nut', hexGeo(), mat, alignY(p, nn, [s, len, s]));
    inst.add('stud', boltGeo(), mat, alignY(p.clone().addScaledVector(nn, len * 0.6), nn, [s * 0.5, len * 0.9, s * 0.5]));
  }
}
/** flange (par) num ponto do tubo: disco duplo + parafusos */
export function flange(batch, inst, matKey, nutMat, c, n, r, { thick = 0.03, bolts = 8, gap = 0.004 } = {}) {
  const rf = r * 1.75 + 0.03, nn = n.clone().normalize();
  const g = cached(`fl_${rf.toFixed(3)}_${thick}`, () => new THREE.CylinderGeometry(rf, rf, thick, 28));
  batch.add(matKey, g, alignY(c.clone().addScaledVector(nn, -(thick / 2 + gap / 2)), nn));
  batch.add(matKey, g, alignY(c.clone().addScaledVector(nn, thick / 2 + gap / 2), nn));
  const s = Math.max(0.018, r * 0.22);
  boltCircle(inst, nutMat, c.clone().addScaledVector(nn, thick + gap / 2), nn, rf * 0.8, bolts, s, s * 0.8);
  boltCircle(inst, nutMat, c.clone().addScaledVector(nn, -(thick + gap / 2)), nn.clone().negate(), rf * 0.8, bolts, s, s * 0.8);
}
/** volante de válvula (torus + raios + cubo), eixo +y local, raio rw */
export function wheelGeo(rw) {
  return cached('wheel' + rw, () => {
    const parts = [];
    const t = new THREE.TorusGeometry(rw, rw * 0.09, 10, 40); t.rotateX(Math.PI / 2); parts.push(t);
    for (let i = 0; i < 3; i++) { const s = new THREE.CylinderGeometry(rw * 0.05, rw * 0.05, rw * 2 * 0.95, 8); s.rotateZ(Math.PI / 2); s.rotateY((i / 3) * Math.PI); s.translate(0, -rw * 0.05, 0); parts.push(s); }
    const h = new THREE.CylinderGeometry(rw * 0.16, rw * 0.18, rw * 0.3, 14); h.translate(0, -rw * 0.05, 0); parts.push(h);
    // pega no aro
    const k = new THREE.CylinderGeometry(rw * 0.07, rw * 0.07, rw * 0.35, 8); k.translate(rw * 0.98, rw * 0.17, 0); parts.push(k);
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
  });
}
/** válvula globo/gaveta em linha: corpo + castelo + haste + volante. axis = direção do tubo, up = direção do castelo */
export function valve(batch, inst, M, c, axis, up, r, { wheel = 'red', size = 1, gate = false } = {}) {
  const a = axis.clone().normalize(), u = up.clone().normalize();
  const k = size, rb = r * 1.6;
  // corpo esférico achatado
  const body = cached('vbody', () => { const g = new THREE.SphereGeometry(1, 24, 16); return g; });
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
  batch.add('cast', body, new THREE.Matrix4().compose(c, q, new THREE.Vector3(rb, rb * 1.05, rb)));
  // flanges do corpo
  for (const sg of [-1, 1]) flange(batch, inst, 'cast', M.nut, c.clone().addScaledVector(a, sg * rb * 1.25), a, r, { thick: 0.025 * k + r * 0.12, bolts: r > 0.08 ? 8 : 4 });
  // castelo (bonnet) + flange do castelo
  const bh = r * (gate ? 3.6 : 2.4) + 0.06;
  const bon = cached('vbon', () => new THREE.CylinderGeometry(0.5, 0.62, 1, 18));
  batch.add('cast', bon, alignY(c.clone().addScaledVector(u, rb * 0.9 + bh / 2), u, [rb * 1.1, bh, rb * 1.1]));
  const bfl = cached('vbfl', () => new THREE.CylinderGeometry(1, 1, 1, 20));
  batch.add('cast', bfl, alignY(c.clone().addScaledVector(u, rb * 0.95), u, [rb * 1.05, 0.03, rb * 1.05]));
  boltCircle(inst, M.nut, c.clone().addScaledVector(u, rb * 0.95 + 0.02), u, rb * 0.85, 6, Math.max(0.016, r * 0.18), 0.02);
  // gaxeta (prensa-gaxeta) e haste
  const top = c.clone().addScaledVector(u, rb * 0.9 + bh);
  batch.add('steelDark', bfl, alignY(top.clone().addScaledVector(u, 0.012), u, [rb * 0.55, 0.035, rb * 0.55]));
  const stemL = r * 1.6 + 0.08;
  batch.add('chrome', cached('stem', () => new THREE.CylinderGeometry(1, 1, 1, 10)), alignY(top.clone().addScaledVector(u, stemL / 2), u, [Math.max(0.008, r * 0.12), stemL, Math.max(0.008, r * 0.12)]));
  // volante
  const rw = Math.max(0.09, r * 2.3) * k;
  batch.add(wheel === 'blue' ? 'wheelBlue' : 'wheelRed', wheelGeo(1), alignY(top.clone().addScaledVector(u, stemL), u, [rw, rw, rw]));
  return { top, gland: top.clone().addScaledVector(u, 0.012) };
}
/** manômetro: caixa + aro + face (material próprio) + vidro; ponteiro devolvido para animação. n = normal da face */
export function gauge(group, batch, M, faceTex, c, n, rad = 0.075, stem = null) {
  const nn = n.clone().normalize();
  const caseG = cached('gcase', () => new THREE.CylinderGeometry(1, 1, 1, 32));
  batch.add('chrome', caseG, alignY(c, nn, [rad * 1.08, rad * 0.55, rad * 1.08]));
  batch.add('chrome', cached('grim', () => { const t = new THREE.TorusGeometry(1, 0.06, 8, 36); t.rotateX(Math.PI / 2); return t; }), alignY(c.clone().addScaledVector(nn, rad * 0.28), nn, [rad * 1.02, rad, rad * 1.02]));
  if (stem) { // conexão (sifão/tubo) até o ponto da tomada
    const pts = [c.clone().addScaledVector(nn, -rad * 0.3), ...stem];
    const { geo } = tubeGeo(pts, 0.008, 0.03, 8); batch.add('brass', geo, null);
  }
  const face = new THREE.Mesh(cached('gface', () => new THREE.CircleGeometry(1, 40)), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5, metalness: 0 }));
  face.scale.setScalar(rad * 0.98); face.position.copy(c).addScaledVector(nn, rad * 0.276); face.lookAt(face.position.clone().add(nn)); group.add(face);
  const needle = new THREE.Group(); needle.position.copy(c).addScaledVector(nn, rad * 0.285); needle.lookAt(needle.position.clone().add(nn)); group.add(needle);
  const nm = new THREE.Mesh(cached('gneedle', () => { const g = new THREE.BoxGeometry(0.06, 0.8, 0.02); g.translate(0, 0.32, 0); return g; }), M.needle); nm.scale.setScalar(rad); needle.add(nm);
  const pivot = new THREE.Mesh(cached('gpiv', () => new THREE.CylinderGeometry(0.08, 0.08, 0.05, 12).rotateX(Math.PI / 2)), M.needle); pivot.scale.setScalar(rad); needle.add(pivot);
  const glass = new THREE.Mesh(cached('gface', () => new THREE.CircleGeometry(1, 40)), M.gaugeGlass); glass.scale.setScalar(rad); glass.position.copy(c).addScaledVector(nn, rad * 0.3); glass.lookAt(glass.position.clone().add(nn)); group.add(glass);
  return { needle, face };
}
/** perfil I (alma em y, mesas em x), comprimento ao longo de z, centrado */
export function iBeamGeo(h, b, tw, tf, L) {
  return cached(`ib_${h}_${b}_${L}`, () => {
    const s = new THREE.Shape(); const hb = b / 2, hh = h / 2, ht = tw / 2;
    s.moveTo(-hb, -hh); s.lineTo(hb, -hh); s.lineTo(hb, -hh + tf); s.lineTo(ht, -hh + tf); s.lineTo(ht, hh - tf); s.lineTo(hb, hh - tf); s.lineTo(hb, hh); s.lineTo(-hb, hh); s.lineTo(-hb, hh - tf); s.lineTo(-ht, hh - tf); s.lineTo(-ht, -hh + tf); s.lineTo(-hb, -hh + tf); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2);
    // UV em metros
    const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) + P.getY(i), P.getZ(i));
    return g;
  });
}
export function boxGeo(w, h, d) { return cached(`box_${w}_${h}_${d}`, () => { const g = new THREE.BoxGeometry(w, h, d); const P = g.attributes.position, N = g.attributes.normal, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)); const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (ax > 0.5) uv.setXY(i, z, y); else if (ay > 0.5) uv.setXY(i, x, z); else uv.setXY(i, x, y); } return g; }); }
export const unitBox = () => cached('ubox', () => new THREE.BoxGeometry(1, 1, 1));
export const unitCyl = (seg = 16) => cached('ucyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg));

/** cinta/abraçadeira com espessura (perfil retangular chanfrado), eixo y, raio interno R */
export function strapGeo(R, w = 0.04, t = 0.003, seg = 96) {
  return cached(`strap_${R}_${w}_${t}`, () => {
    const h = w / 2, p = [[R - 0.001, -h], [R + t * 0.6, -h], [R + t, -h + t], [R + t, h - t], [R + t * 0.6, h], [R - 0.001, h]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, seg);
  });
}
