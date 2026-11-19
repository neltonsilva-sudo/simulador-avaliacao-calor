// CALDEIRAS — prédio: piso de concreto/epóxi com faixas, paredes (alvenaria pintada + janelas altas em caixilho de aço +
// fechamento trapezoidal), pilares em perfil I, tesouras treliçadas, terças, telhado com telhas translúcidas, luminárias
// high-bay, ponte rolante, portão, porta, exterior claro visto pelas janelas.
import * as THREE from 'three';
import { HALL2 } from './layout_caldeiras.js';
import * as G from './cald_geo.js';
import * as TX from './cald_tex.js';

const { x0: X0, x1: X1, z0: Z0, z1: Z1, h: H } = HALL2;
export const COLS_X = [30, 36.5, 43, 49.5, 56];
export const COLS_Z = [-10, -5, 0, 5, 10];
export const WIN = { y0: HALL2.windowsSill, y1: 7.3 };
export const TRUSS_Y = 8.55; // corda inferior
const RIDGE = 1.15; // altura extra da cumeeira (z = 0)
export const roofY = (z) => H + RIDGE * (1 - Math.abs(z) / ((Z1 - Z0) / 2));

export function buildBuilding(ctx) {
  const { group, batch, inst, M } = ctx;
  // ───── piso ─────
  const W = X1 - X0, D = Z1 - Z0;
  const fg = new THREE.PlaneGeometry(W, D, 1, 1); fg.rotateX(-Math.PI / 2); fg.translate((X0 + X1) / 2, 0.0075, (Z0 + Z1) / 2); // 7,5 mm: fora da máscara de reflexo (rejunte 40 cm) do pós da sala de fornos
  { const P = fg.attributes.position, uv = fg.attributes.uv, uv1 = new Float32Array(P.count * 2);
    for (let i = 0; i < P.count; i++) { uv.setXY(i, (P.getX(i) - X0) / W, 1 - (P.getZ(i) - Z0) / D); uv1[i * 2] = P.getX(i) / 4; uv1[i * 2 + 1] = P.getZ(i) / 4; }
    fg.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2)); }
  const floor = new THREE.Mesh(fg, M.floor); floor.receiveShadow = true; floor.name = 'cald_floor'; group.add(floor);

  // ───── paredes ─────
  // cada parede: segmentos sólidos (alvenaria até o peitoril, painel acima das janelas) + vãos de janela entre pilares
  const T = 0.22;
  const walls = [
    { axis: 'x', fixed: Z0, n: +1, a0: X0, a1: X1, cols: COLS_X },   // fundo (normal +z)
    { axis: 'x', fixed: Z1, n: -1, a0: X0, a1: X1, cols: COLS_X, doors: [[33.0, 37.4, 4.6], [45.4, 46.5, 2.15]] }, // frente
    { axis: 'z', fixed: X0, n: +1, a0: Z0, a1: Z1, cols: COLS_Z },   // esquerda
    { axis: 'z', fixed: X1, n: -1, a0: Z0, a1: Z1, cols: COLS_Z },   // direita
  ];
  const wallMat = (axis, fixed, a, b, y0, y1, key) => {
    const len = b - a, h = y1 - y0; if (len <= 0.01 || h <= 0.01) return;
    const g = G.boxGeo(axis === 'x' ? len : T, h, axis === 'x' ? T : len);
    const c = axis === 'x' ? [(a + b) / 2, (y0 + y1) / 2, fixed + (fixed === Z0 ? -T / 2 : T / 2)] : [fixed + (fixed === X0 ? -T / 2 : T / 2), (y0 + y1) / 2, (a + b) / 2];
    batch.add(key, g, G.mat4(c));
  };
  const outside = [];
  for (const w of walls) {
    const { axis, fixed } = w;
    // alvenaria/barrado: 0 → peitoril (com recortes de portas)
    let segs = [[w.a0, w.a1]];
    for (const [d0, d1] of w.doors || []) segs = segs.flatMap(([a, b]) => (d1 <= a || d0 >= b ? [[a, b]] : [[a, d0], [d1, b]].filter(([p, q]) => q - p > 0.01)));
    for (const [a, b] of segs) { wallMat(axis, fixed, a, b, 0, 1.1, 'wallLow'); wallMat(axis, fixed, a, b, 1.1, WIN.y0, 'wallBlock'); }
    for (const [d0, d1, dh] of w.doors || []) { wallMat(axis, fixed, d0, d1, dh, WIN.y0, 'wallBlock'); }
    // painel trapezoidal acima das janelas até o telhado
    const top = axis === 'x' ? H : H + RIDGE;
    wallMat(axis, fixed, w.a0, w.a1, WIN.y1, axis === 'x' ? H + 0.05 : H, 'wallPanel');
    if (axis === 'z') { // oitão triangular (empena)
      const sh = new THREE.Shape(); sh.moveTo(Z0, 0); sh.lineTo(Z1, 0); sh.lineTo(0, RIDGE + 0.05); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: false }); const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i), P.getY(i));
      batch.add('wallPanel', g, G.mat4([fixed + (fixed === X0 ? -T : 0), H, 0], [0, -Math.PI / 2, 0]));
    }
    void top;
    // vãos de janela entre pilares: montantes (pilaretes) junto aos pilares + caixilhos
    for (let i = 0; i < w.cols.length - 1; i++) {
      const a = w.cols[i] + 0.35, b = w.cols[i + 1] - 0.35;
      wallMat(axis, fixed, w.cols[i] - 0.35 * (i > 0 ? 1 : 0), a, WIN.y0, WIN.y1, 'wallBlock');
      if (i === w.cols.length - 2) wallMat(axis, fixed, b, w.cols[i + 1], WIN.y0, WIN.y1, 'wallBlock');
      else wallMat(axis, fixed, b, w.cols[i + 1], WIN.y0, WIN.y1, 'wallBlock');
      // caixilho de aço: montantes verticais a cada ~1,05 m e travessas a cada ~1,27 m
      const nv = Math.max(2, Math.round((b - a) / 1.05)), nh = 4, fy = (WIN.y1 - WIN.y0);
      const at = (s, y, len, vert) => {
        const g = vert ? G.boxGeo(axis === 'x' ? 0.06 : 0.1, len, axis === 'x' ? 0.1 : 0.06) : G.boxGeo(axis === 'x' ? len : 0.1, 0.06, axis === 'x' ? 0.1 : len);
        const pos = axis === 'x' ? [s, y, fixed - (fixed === Z0 ? 0.11 : -0.11)] : [fixed - (fixed === X0 ? 0.11 : -0.11), y, s];
        batch.add('frame', g, G.mat4(pos));
      };
      for (let k = 0; k <= nv; k++) at(a + (b - a) * k / nv, (WIN.y0 + WIN.y1) / 2, fy, true);
      for (let k = 0; k <= nh; k++) at((a + b) / 2, WIN.y0 + fy * k / nh, b - a, false);
      // peitoril de concreto
      const sill = G.boxGeo(axis === 'x' ? b - a : 0.34, 0.06, axis === 'x' ? 0.34 : b - a);
      batch.add('concrete', sill, G.mat4(axis === 'x' ? [(a + b) / 2, WIN.y0 - 0.03, fixed + (fixed === Z0 ? 0.04 : -0.04)] : [fixed + (fixed === X0 ? 0.04 : -0.04), WIN.y0 - 0.03, (a + b) / 2]));
      // vidro (uma placa por vão) + exterior emissivo 3 m para fora
      const gw = new THREE.PlaneGeometry(b - a, fy);
      const glass = new THREE.Mesh(gw, M.glass); glass.castShadow = false; glass.receiveShadow = false;
      const out = new THREE.Mesh(new THREE.PlaneGeometry((b - a) * 2.2, fy * 2.0), M.outside); out.castShadow = false; out.receiveShadow = false;
      const mid = (a + b) / 2, ym = (WIN.y0 + WIN.y1) / 2;
      if (axis === 'x') { glass.position.set(mid, ym, fixed - (fixed === Z0 ? 0.12 : -0.12)); glass.rotation.y = fixed === Z0 ? 0 : Math.PI; out.position.set(mid, ym + 0.6, fixed + (fixed === Z0 ? -3.5 : 3.5)); out.rotation.y = fixed === Z0 ? 0 : Math.PI; }
      else { glass.position.set(fixed - (fixed === X0 ? 0.12 : -0.12), ym, mid); glass.rotation.y = fixed === X0 ? Math.PI / 2 : -Math.PI / 2; out.position.set(fixed + (fixed === X0 ? -3.5 : 3.5), ym + 0.6, mid); out.rotation.y = fixed === X0 ? Math.PI / 2 : -Math.PI / 2; }
      glass.userData.noAO = true; group.add(glass); outside.push(out); group.add(out);
    }
  }
  // portão seccional (frente) e porta de pessoal
  { const [d0, d1, dh] = [33.0, 37.4, 4.6]; const g = G.boxGeo(d1 - d0, dh, 0.08); batch.add('gateDoor', g, G.mat4([(d0 + d1) / 2, dh / 2, Z1 - 0.06]));
    for (let k = 1; k < 8; k++) batch.add('frame', G.boxGeo(d1 - d0, 0.025, 0.02), G.mat4([(d0 + d1) / 2, (dh * k) / 8, Z1 - 0.11]));
    batch.add('paintYellow', G.boxGeo(0.12, dh, 0.14), G.mat4([d0 - 0.06, dh / 2, Z1 - 0.1])); batch.add('paintYellow', G.boxGeo(0.12, dh, 0.14), G.mat4([d1 + 0.06, dh / 2, Z1 - 0.1]));
    batch.add('steelDark', G.unitCyl(20), G.mat4([(d0 + d1) / 2, dh + 0.25, Z1 - 0.3], [0, 0, Math.PI / 2], [0.25, d1 - d0 + 0.3, 0.25]));
    const [p0, p1, ph] = [45.4, 46.5, 2.15]; batch.add('gateDoor', G.boxGeo(p1 - p0, ph, 0.06), G.mat4([(p0 + p1) / 2, ph / 2, Z1 - 0.05]));
    batch.add('chrome', G.boxGeo(0.14, 0.03, 0.05), G.mat4([p1 - 0.12, 1.05, Z1 - 0.1])); batch.add('frame', G.boxGeo(p1 - p0 + 0.1, 0.06, 0.12), G.mat4([(p0 + p1) / 2, ph + 0.03, Z1 - 0.06])); }

  // ───── pilares (perfil I) ─────
  const colH = TRUSS_Y + 0.4;
  const colG = G.iBeamGeo(0.42, 0.3, 0.012, 0.02, colH);
  const addCol = (x, z, rotZ) => batch.add('struct', colG, G.mat4([x, colH / 2, z], [Math.PI / 2, 0, rotZ]));
  for (const x of COLS_X) { addCol(x, Z0 + 0.22, 0); addCol(x, Z1 - 0.22, 0); }
  for (const z of COLS_Z.slice(1, -1)) { addCol(X0 + 0.22, z, Math.PI / 2); addCol(X1 - 0.22, z, Math.PI / 2); }
  // bases de concreto dos pilares
  for (const x of COLS_X) for (const z of [Z0 + 0.25, Z1 - 0.25]) batch.add('concrete', G.boxGeo(0.6, 0.12, 0.55), G.mat4([x, 0.06, z]));
  // viga de rolamento da ponte rolante (consoles nos pilares)
  const RUN_Y = 7.25;
  for (const z of [Z0 + 0.55, Z1 - 0.55]) {
    batch.add('struct', G.iBeamGeo(0.5, 0.25, 0.012, 0.02, X1 - X0), G.mat4([(X0 + X1) / 2, RUN_Y, z], [0, Math.PI / 2, 0]));
    for (const x of COLS_X) batch.add('struct', G.boxGeo(0.25, 0.45, 0.5), G.mat4([x, RUN_Y - 0.45, z + (z < 0 ? -0.15 : 0.15)]));
  }
  // ponte rolante (viga caixão amarela + carro + gancho) estacionada perto da parede esquerda
  { const bx = 50.9, L = D - 1.1; batch.add('craneYellow', G.boxGeo(0.55, 0.85, L), G.mat4([bx, RUN_Y + 0.7, 0])); batch.add('craneYellow', G.boxGeo(0.55, 0.85, L), G.mat4([bx + 1.6, RUN_Y + 0.7, 0]));
    for (const z of [Z0 + 0.55, Z1 - 0.55]) batch.add('craneYellow', G.boxGeo(2.4, 0.5, 0.6), G.mat4([bx + 0.8, RUN_Y + 0.5, z]));
    batch.add('craneYellow', G.boxGeo(1.9, 0.5, 1.2), G.mat4([bx + 0.8, RUN_Y + 1.35, -2.0]));
    batch.add('steelDark', G.unitCyl(8), G.mat4([bx + 0.8, RUN_Y - 0.1, -2.0], [0, 0, 0], [0.012, 1.9, 0.012]));
    batch.add('steelDark', G.unitCyl(8), G.mat4([bx + 0.85, RUN_Y - 0.1, -2.0], [0, 0, 0], [0.012, 1.9, 0.012]));
    batch.add('craneYellow', G.boxGeo(0.28, 0.32, 0.18), G.mat4([bx + 0.82, RUN_Y - 1.15, -2.0]));
    const hook = new THREE.TorusGeometry(0.09, 0.025, 8, 16, Math.PI * 1.4); batch.add('steelDark', hook, G.mat4([bx + 0.82, RUN_Y - 1.42, -2.0], [0, 0, 2.2]));
    // botoeira pendente (amarela) com cabo
    batch.add('rubber', G.unitCyl(6), G.mat4([bx + 0.6, RUN_Y - 2.4, -1.8], [0, 0, 0], [0.006, 5.2, 0.006]));
    batch.add('craneYellow', G.boxGeo(0.09, 0.3, 0.07), G.mat4([bx + 0.6, 1.55, -1.8]));
  }

  // ───── tesouras (treliça) + terças + contraventamento ─────
  const sq = (key, a, b, s = 0.08) => { const d = b.clone().sub(a), L = d.length(); batch.add(key, G.unitBox(), G.alignY(a.clone().add(b).multiplyScalar(0.5), d.normalize(), [s, L, s])); };
  for (const x of COLS_X) {
    const xx = x === X0 ? X0 + 0.3 : x === X1 ? X1 - 0.3 : x;
    const n = 16, pts = [];
    for (let i = 0; i <= n; i++) { const z = Z0 + 0.3 + (D - 0.6) * i / n; pts.push([z, TRUSS_Y, roofY(z) - 0.12]); }
    for (let i = 0; i < n; i++) {
      const [za, ya, ta] = pts[i], [zb, yb, tb] = pts[i + 1];
      sq('struct', G.V3(xx, ya, za), G.V3(xx, yb, zb), 0.1); sq('struct', G.V3(xx, ta, za), G.V3(xx, tb, zb), 0.1);
      sq('struct', G.V3(xx, ya, za), G.V3(xx, ta, za), 0.06);
      if (i % 2 === 0) sq('struct', G.V3(xx, ya, za), G.V3(xx, tb, zb), 0.055); else sq('struct', G.V3(xx, ta, za), G.V3(xx, yb, zb), 0.055);
    }
    sq('struct', G.V3(xx, pts[n][1], pts[n][0]), G.V3(xx, pts[n][2], pts[n][0]), 0.06);
  }
  for (let k = 0; k <= 12; k++) { const z = Z0 + 0.4 + (D - 0.8) * k / 12; const y = roofY(z) - 0.02; batch.add('struct', G.boxGeo(X1 - X0, 0.15, 0.06), G.mat4([(X0 + X1) / 2, y - 0.08, z])); }
  // contraventamento em X no vão central e tirantes
  for (const [xa, xb] of [[30, 36.5], [49.5, 56]]) for (const s of [-1, 1]) { const z0 = s < 0 ? Z0 + 0.4 : 0, z1 = s < 0 ? 0 : Z1 - 0.4; sq('struct', G.V3(xa, roofY(z0) - 0.2, z0), G.V3(xb, roofY(z1) - 0.2, z1), 0.03); sq('struct', G.V3(xa, roofY(z1) - 0.2, z1), G.V3(xb, roofY(z0) - 0.2, z0), 0.03); }
  for (let k = 0; k < 3; k++) { const x = 33.25 + k * 9.75; batch.add('struct', G.boxGeo(0.06, 0.16, D - 0.6), G.mat4([x, TRUSS_Y, 0])); }

  // ───── telhado (duas águas) com faixas de telha translúcida ─────
  for (const s of [-1, 1]) {
    const len = Math.hypot(D / 2, RIDGE), ang = Math.atan2(RIDGE, D / 2);
    const g = new THREE.PlaneGeometry(W, len, 1, 1); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W, uv.getY(i) * len);
    const m = new THREE.Mesh(g, M.roof); m.rotation.order = 'YXZ';
    m.position.set((X0 + X1) / 2, H + RIDGE / 2 + 0.02, s * D / 4); m.rotation.x = Math.PI / 2 + s * ang;
    m.receiveShadow = true; m.castShadow = true; group.add(m);
    // translúcidas: 2 faixas por água entre as tesouras
    for (const xm of [39.75, 52.75]) {
      const sk = new THREE.Mesh(new THREE.PlaneGeometry(1.2, len * 0.62), M.skylight); sk.rotation.copy(m.rotation); sk.position.set(xm, H + RIDGE / 2 + 0.0, s * D / 4); sk.translateZ(0.015); sk.castShadow = false; group.add(sk);
    }
  }
  // ───── luminárias high-bay (refletor de alumínio + lente emissiva) ─────
  const domeG = G.cached('hb_dome', () => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.06 + 0.2 * Math.sin(t * Math.PI / 2) ** 0.8, -t * 0.26)); } return new THREE.LatheGeometry(pts, 28); });
  const lensG = G.cached('hb_lens', () => new THREE.CircleGeometry(0.245, 28).rotateX(Math.PI / 2));
  const lamps = [];
  for (const x of [33.25, 39.75, 46.25, 52.75]) for (const z of [-6.2, -1.2, 3.8]) {
    const y = TRUSS_Y - 0.45; lamps.push([x, y, z]);
    inst.add('hbDome', domeG, M.lampBody, G.mat4([x, y + 0.26, z]));
    inst.add('hbLens', lensG, M.lamp, G.mat4([x, y - 0.002, z]));
    inst.add('hbCan', G.unitCyl(14), M.lampBody, G.mat4([x, y + 0.36, z], [0, 0, 0], [0.11, 0.2, 0.11]));
    inst.add('hbRod', G.unitCyl(6), M.steelDarkI, G.mat4([x, (y + 0.46 + TRUSS_Y) / 2, z], [0, 0, 0], [0.008, TRUSS_Y - y - 0.46, 0.008]));
  }
  ctx.lamps = lamps; ctx.outside = outside;
  return { floor };
}
