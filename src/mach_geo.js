// EQUIPAMENTOS — geometria auxiliar (lotes mesclados por material, UV de mundo), pães procedurais e biblioteca de materiais.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './mach_tex.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const KEEP = ['position', 'normal', 'uv', 'color'];
function prep(geo, mat4, withColor) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (withColor && !g.attributes.color) { const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  if (!withColor && g.attributes.color) g.deleteAttribute('color');
  g.morphAttributes = {};
  if (mat4) g.applyMatrix4(mat4);
  return g;
}
/** UV de mundo por projeção de caixa (eixo dominante da normal); escala em metros por repetição */
export function worldUV(g, scale = 1) {
  const P = g.attributes.position, N = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)), x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (ny >= nx && ny >= nz) uv.setXY(i, x / scale, z / scale);
    else if (nx >= nz) uv.setXY(i, z / scale + 0.37, y / scale);
    else uv.setXY(i, x / scale, y / scale);
  }
  uv.needsUpdate = true;
}
const geoCache = new Map();
function rbox(w, h, d, r, seg = 2) {
  const k = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}|${r}|${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, r > 0 ? new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)) : new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

/** Lote: acumula geometrias por chave de material e mescla em uma malha por material. */
export class Batch {
  constructor() { this.lists = {}; }
  add(geo, key, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1], color) {
    _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e); _m.compose(_p.set(...pos), _q, _s.set(...scl));
    const g = prep(geo, _m, !!color || key.startsWith('vc:'));
    if (color && g.attributes.color) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, color.r, color.g, color.b); }
    (this.lists[key] ||= []).push(g); return g;
  }
  /** caixa por cantos (x0,y0,z0)-(x1,y1,z1), raio de quina r */
  box(key, x0, y0, z0, x1, y1, z1, r = 0.004, seg = 2) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    return this.add(rbox(w, h, d, r, seg), key, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
  }
  /** cilindro: eixo 'x' | 'y' | 'z' */
  cyl(key, r, len, pos, axis = 'y', seg = 20, r2 = r, open = false) {
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, open);
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return this.add(g, key, pos, rot);
  }
  /** barra entre dois pontos (cilindro) */
  bar(key, a, b, r, seg = 10) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L, seg, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    return this.add(g, key, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [e.x, e.y, e.z]);
  }
  /** plano (face +z) */
  plane(key, w, h, pos, rot = [0, 0, 0]) { return this.add(new THREE.PlaneGeometry(w, h), key, pos, rot); }
  build(mats, parent, { cast = true, receive = true, name = '' } = {}) {
    const out = {};
    for (const [key, list] of Object.entries(this.lists)) {
      if (!list.length) continue;
      const mk = key.startsWith('vc:') ? key.slice(3) : key;
      const mat = mats[mk]; if (!mat) { console.warn('[machines] material ausente', mk); continue; }
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!g) { console.warn('[machines] merge falhou', key); continue; }
      if (mat.userData.worldUV) worldUV(g, mat.userData.worldUV);
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mat); mesh.name = `${name}:${key}`;
      mesh.castShadow = cast && !mat.transparent && !mat.userData.noShadow; mesh.receiveShadow = receive && !mat.userData.noShadow;
      if (mat.userData.noAO) mesh.userData.noAO = true;
      if (mat.userData.noBloom) mesh.userData.noBloom = true;
      mesh.renderOrder = mat.userData.order || 0;
      parent.add(mesh); out[key] = mesh;
    }
    this.lists = {};
    return out;
  }
}

/** normais seguras: recalcula e substitui normais nulas/NaN (polos, pontas) pela direção radial a partir do centro */
export function fixNormals(g) {
  g.computeVertexNormals(); g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new THREE.Vector3()), P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < N.count; i++) {
    const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z);
    if (!(l > 1e-4)) { v.set(P.getX(i) - c.x, P.getY(i) - c.y, P.getZ(i) - c.z); if (v.lengthSq() < 1e-12) v.set(0, 1, 0); v.normalize(); N.setXYZ(i, v.x, v.y, v.z); }
    else if (Math.abs(l - 1) > 1e-3) N.setXYZ(i, x / l, y / l, z / l);
  }
  N.needsUpdate = true;
  // aLit: luz interna "assada" (lâmpadas no teto da câmara): topo claro, base escura → volume sob o emissivo
  const lit = new Float32Array(N.count);
  for (let i = 0; i < N.count; i++) lit[i] = 0.28 + 0.8 * Math.pow(Math.max(0, N.getY(i)), 0.8) + 0.18 * Math.max(0, N.getZ(i));
  g.setAttribute('aLit', new THREE.BufferAttribute(lit, 1));
  return g;
}
// ───────────── pães procedurais (cores por vértice, sRGB → linear) ─────────────
const col = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const lerpC = (a, b, t) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
function hash3(x, y, z) { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
    r += hash3(ix + a, iy + b, iz + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  return r;
}
const PAL = {
  baked: { top: col(0.66, 0.36, 0.11), mid: col(0.82, 0.54, 0.22), side: col(0.9, 0.72, 0.42), bot: col(0.52, 0.32, 0.12), cut: col(0.96, 0.84, 0.58) },
  baking: { top: col(0.93, 0.78, 0.44), mid: col(0.96, 0.86, 0.6), side: col(0.97, 0.9, 0.72), bot: col(0.8, 0.64, 0.38), cut: col(0.99, 0.96, 0.86) },
  raw: { top: col(0.93, 0.88, 0.78), mid: col(0.95, 0.9, 0.81), side: col(0.96, 0.92, 0.84), bot: col(0.9, 0.84, 0.74), cut: col(0.98, 0.95, 0.9) },
  rustic: { top: col(0.6, 0.33, 0.1), mid: col(0.8, 0.52, 0.2), side: col(0.9, 0.7, 0.4), bot: col(0.45, 0.27, 0.1), cut: col(0.98, 0.9, 0.66) },
};
/** pão redondo (bisnaguinha/brioche) — base achatada, topo abaulado, leve irregularidade */
export function bunGeometry(pal = 'baked', { r = 0.055, h = 0.048, seed = 1, cross = false, slash = false, flour = 0 } = {}) {
  const g = new THREE.SphereGeometry(1, 15, 9), P = g.attributes.position, n = P.count, C = new Float32Array(n * 3), p = PAL[pal];
  for (let i = 0; i < n; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = 1 + 0.05 * (vnoise3(x * 2.3 + seed, y * 2.3, z * 2.3) - 0.5) + 0.025 * (vnoise3(x * 7, y * 7 + seed, z * 7) - 0.5);
    x *= k; z *= k;
    let yy = y >= 0 ? Math.pow(y, 0.85) : y * 0.22;
    let t = (yy + 0.22) / 1.22; // 0 base → 1 topo
    let c = t < 0.12 ? lerpC(p.bot, p.side, t / 0.12) : t < 0.55 ? lerpC(p.side, p.mid, (t - 0.12) / 0.43) : lerpC(p.mid, p.top, (t - 0.55) / 0.45);
    const blot = vnoise3(x * 5 + seed * 3, y * 5, z * 5);
    c = lerpC(c, p.top, (blot - 0.55) * 0.9 * t);
    if (cross && y > 0.3) { const cut = Math.min(Math.abs(x), Math.abs(z)); if (cut < 0.12) { c = lerpC(p.cut, c, cut / 0.12); yy -= (0.12 - cut) * 0.5; } }
    if (slash && y > 0.35) { // pestana: corte único levemente em S, borda levantada e mais tostada
      const sd = Math.abs(z * 0.94 - x * 0.34 - 0.06 * Math.sin(x * 4 + seed)), w = 0.085;
      if (sd < w) { const a = sd / w; c = lerpC(p.cut, c, a * a); yy -= (1 - a) * 0.09; }
      else if (sd < w * 2) { const a = (sd - w) / w; c = lerpC(p.top, c, 0.35 + 0.65 * a); yy += (1 - a) * 0.035; }
    }
    if (flour > 0 && y > 0.45) { const fl = vnoise3(x * 9 + seed * 5, y * 9, z * 9); if (fl > 0.6) c = lerpC(c, col(0.98, 0.97, 0.94), Math.min(0.8, (fl - 0.6) * 3.5 * flour)); }
    P.setXYZ(i, x * r, yy * h, z * r * 0.97);
    C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return fixNormals(g);
}
/** baguete com 5 cortes diagonais (pestanas) — ao longo de x */
export function baguetteGeometry(pal = 'baked', { L = 0.42, R = 0.03, cuts = 5, seed = 2, NU = 30, NV = 12 } = {}) {
  const pos = [], uv = [], C = [], idx = [], p = PAL[pal];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, prof = Math.max(0.12, Math.pow(Math.sin(Math.PI * u), 0.42)) * (0.94 + 0.08 * vnoise3(u * 6 + seed, 0, 0));
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * Math.PI * 2, sv = Math.sin(v), cv = Math.cos(v);
      let rr = R * prof;
      let c = sv < 0 ? lerpC(p.side, p.bot, -sv * 1.6) : lerpC(p.side, p.top, Math.pow(sv, 0.7));
      // cortes diagonais no topo
      if (sv > 0.15 && cuts) {
        const k = Math.floor(u * cuts), uk = (k + 0.5) / cuts, s = ((u - uk) * cuts) * 1.6 - cv * 0.9;
        const as = Math.abs(s);
        if (as < 0.22 && u > 0.06 && u < 0.94) { c = lerpC(p.cut, p.mid, as / 0.22 * 0.5); rr *= 0.93 + as * 0.2; }
        else if (as < 0.42) { c = lerpC(c, p.top, 0.6 * (1 - (as - 0.22) / 0.2)); rr *= 1.0 + 0.04 * (1 - (as - 0.22) / 0.2); }
      }
      const blot = vnoise3(u * 14 + seed, sv * 3, cv * 3); c = lerpC(c, p.top, (blot - 0.6) * 0.8 * Math.max(0, sv));
      const x = (u - 0.5) * L, y = sv * rr * (sv < 0 ? 0.3 : 0.82) + rr * 0.3, z = cv * rr;
      pos.push(x, y, z); uv.push(u * 6, j / NV); C.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(idx);
  return fixNormals(g);
}
/** pão rústico (FOTO 5): oval grande com corte longitudinal e farinha */
export function bouleGeometry(pal = 'rustic', { rx = 0.11, rz = 0.075, h = 0.075, seed = 3 } = {}) {
  const g = new THREE.SphereGeometry(1, 40, 22), P = g.attributes.position, n = P.count, C = new Float32Array(n * 3), p = PAL[pal];
  for (let i = 0; i < n; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const k = 1 + 0.05 * (vnoise3(x * 2 + seed, y * 2, z * 2) - 0.5); x *= k; z *= k;
    let yy = y >= 0 ? Math.pow(y, 0.9) : y * 0.2, t = (yy + 0.2) / 1.2;
    let c = t < 0.15 ? lerpC(p.bot, p.side, t / 0.15) : t < 0.6 ? lerpC(p.side, p.mid, (t - 0.15) / 0.45) : lerpC(p.mid, p.top, (t - 0.6) / 0.4);
    // corte longitudinal levemente em S
    const sc = z - 0.12 * Math.sin(x * 2.2 + seed);
    if (y > 0.3 && Math.abs(sc) < 0.17 && Math.abs(x) < 0.85) { const a = Math.abs(sc) / 0.17; c = lerpC(p.cut, c, a * a * a); yy -= (1 - a) * 0.12; }
    else if (y > 0.25 && Math.abs(sc) < 0.28) { c = lerpC(c, p.top, 0.55); yy += 0.03 * (1 - (Math.abs(sc) - 0.17) / 0.11); }
    const fl = vnoise3(x * 6 + seed, y * 6, z * 6); if (y > 0.4 && fl > 0.56) c = lerpC(c, col(0.96, 0.93, 0.86), Math.min(0.85, (fl - 0.56) * 3)); // farinha
    P.setXYZ(i, x * rx, yy * h, z * rz);
    C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); return fixNormals(g);
}

// ───────────── materiais ─────────────
/** patch: emissivo proporcional à cor do vértice/instância (pão "aceso" pela luz interna do forno) */
function emissiveFromColor(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aLit; varying float vLit;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = aLit;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLit;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n totalEmissiveRadiance *= vColor.rgb;\n#endif\n totalEmissiveRadiance *= vLit;');
  };
  mat.customProgramCacheKey = () => 'emisVC';
  return mat;
}
export function makeMaterials(envMap) {
  const st = T.steelTextures(), tr = T.treadTextures();
  const steelBase = (o = {}) => {
    const m = new THREE.MeshPhysicalMaterial({
      color: 0xc6c8ca, map: st.albedo, roughnessMap: st.rough, roughness: 1.25, metalness: 1, normalMap: st.normal, normalScale: new THREE.Vector2(0.1, 0.1),
      anisotropy: 0.8, anisotropyRotation: Math.PI / 2, envMap, envMapIntensity: 1.4, ...o,
    });
    m.userData.worldUV = 0.6; return m;
  };
  const M = {
    steel: steelBase(),
    steelSat: steelBase({ color: 0xa8abae, roughness: 1.8, envMapIntensity: 1.2 }),        // inox mais fosco (frisos, fundo)
    steelPol: steelBase({ color: 0xd2d4d6, roughness: 0.6, anisotropy: 0.5 }),             // inox polido (puxadores, molduras)
    steelDark: steelBase({ color: 0x5c5f62, roughness: 2.2, envMapIntensity: 0.6 }),         // inox escurecido pelo calor (interior)
    chrome: new THREE.MeshPhysicalMaterial({ color: 0xe6e7e8, metalness: 1, roughness: 0.07, envMap, envMapIntensity: 1.1 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.55, metalness: 0.1, envMap, envMapIntensity: 0.5 }),
    blackMatte: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85, metalness: 0 }),
    blackGloss: new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMap, envMapIntensity: 0.9 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 }),
    grilleHood: new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.8, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x9e958a, roughness: 0.42, metalness: 1, envMap, envMapIntensity: 0.7 }),   // esteira de alumínio (escurecida no forno)
    aluNew: new THREE.MeshStandardMaterial({ color: 0xc4c6c6, roughness: 0.32, metalness: 1, envMap, envMapIntensity: 0.9 }),
    tread: new THREE.MeshStandardMaterial({ color: 0xd8d8d6, map: tr.albedo, roughnessMap: tr.rough, normalMap: tr.normal, normalScale: new THREE.Vector2(1, 1), metalness: 1, roughness: 1, envMap, envMapIntensity: 0.9 }),
    whitePlastic: new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.45 }),
    greyPlastic: new THREE.MeshStandardMaterial({ color: 0x5d6266, roughness: 0.55 }),
    bluePlastic: new THREE.MeshStandardMaterial({ color: 0x1d4f9a, roughness: 0.5 }),
    redPaint: new THREE.MeshPhysicalMaterial({ color: 0xb3100f, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, envMap, envMapIntensity: 0.8 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe8b80e, roughness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.7 }),
    flour: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.95 }),
    dough: new THREE.MeshStandardMaterial({ color: 0xeee2c8, roughness: 0.8 }),
    fabric: new THREE.MeshStandardMaterial({ color: 0x3b4c63, roughness: 0.92 }),
    whiteFabric: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.95 }),
    water: new THREE.MeshPhysicalMaterial({ color: 0xbfd8e6, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.55, envMap }),
    // vidro temperado escuro: reflexo somado por inteiro, transmitido atenuado (ONE, ONE_MINUS_SRC_ALPHA)
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.3, envMap, envMapIntensity: 0.07, specularIntensity: 1,
      roughnessMap: T.glassGrime(), depthWrite: false, side: THREE.FrontSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    }),
    glassClear: new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.12, envMap, envMapIntensity: 0.25, depthWrite: false, side: THREE.FrontSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    }),
    glassDark: new THREE.MeshPhysicalMaterial({
      color: 0x000000, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.36, envMap, envMapIntensity: 0.3, roughnessMap: T.glassGrime(), depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation,
    }),
    // vidro do armário de fermentação (vermelho)
    glassRed: new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.05, transparent: true, opacity: 0.55, envMap, envMapIntensity: 2, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation }),
    redGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.12, 0.06) }),
    lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 6.2, 3.2) }),
  };
  M.grilleHood.userData.noShadow = true; M.glassDark.userData.noShadow = true; M.glassDark.userData.order = 2; M.glass.userData.noShadow = true; M.glassClear.userData.noShadow = true; M.glassRed.userData.noShadow = true;
  M.glass.userData.order = 2; M.glassClear.userData.order = 2;
  M.lamp.userData.noAO = true;
  const crust = T.crustNormal();
  const bread = (glow) => emissiveFromColor(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, normalMap: crust, normalScale: new THREE.Vector2(0.55, 0.55),
    emissive: new THREE.Color(1, 0.6, 0.22), emissiveIntensity: glow }));
  M.breadIn = bread(1.15); M.breadIn.color.setScalar(0.14);
  M.breadInPale = bread(0.5); M.breadInPale.emissive.setRGB(1, 0.86, 0.6); M.breadInPale.color.setScalar(0.85); M.breadInPale.customProgramCacheKey = () => 'emisVC';   // turbo (FOTO 2): luz halógena mais clara   // dentro: luz da sala bloqueada pelo forno → quase só a luz interna (emissivo âmbar)     // dentro do forno (luz âmbar)
  M.breadOut = bread(0.0);     // fora (carrinhos, bancada)
  M.breadOut.onBeforeCompile = () => {}; M.breadOut.customProgramCacheKey = () => 'breadOut';
  return M;
}

/** material de "interior incandescente" (cavidade do forno): textura × intensidade HDR */
export function cavityMaterial(texture, intensity = 2.2, tint = 0xffffff) {
  const m = new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
  m.userData.base = intensity; m.userData.noAO = true; m.userData.noShadow = true; return m;
}
/** material de display (mapa serigrafado + emissivo de dígitos) */
export function displayMaterial(t, glow = 2.5) {
  return new THREE.MeshPhysicalMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.1, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.04 });
}
