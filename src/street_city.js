// CIDADE (rua colonial estilo Ouro Preto): igreja barroca no alto da ladeira com adro e escadaria, morros com casario
// distante instanciado e manchas de mata, mobiliário urbano (lampiões, placas, vasos, pedestres). Ver src/layout_rua.js.
// Visível só junto com a rua (app.street.group), ou seja, no perfil externo 'rua'.
import * as THREE from 'three';
import { RUA, ruaY } from './layout_rua.js';
import { Merger, buildChurch, buildAdro, miniChurch } from './street_city_church.js';
import { buildProps } from './street_city_props.js';
import * as TX from './street_city_tex.js';

const { rnd } = TX;
// ── relevo: duas "caixas" planas (corredor da rua com os prédios; platô da igreja) e morros subindo fora delas ──
const BOXES = [
  { x0: -21, x1: 59, z0: -55, z1: 46, base: (z) => ruaY(Math.max(-55, Math.min(46, z))) - 0.12 },
  { x0: -7, x1: 45, z0: 44, z1: 96, base: () => ruaY(62) - 0.15 },
];
const fbm = (x, z) => 9 * Math.sin(x * 0.021 + 1.3) * Math.sin(z * 0.017 + 0.5) + 4 * Math.sin(x * 0.053 + z * 0.041 + 2) + 2 * Math.sin(x * 0.11 - z * 0.093) + Math.sin(x * 0.23 + z * 0.19 + 1);
function edist(b, x, z) { return Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1)); }
export function cityH(x, z) {
  let h = 1e9;
  for (const b of BOXES) { const e = edist(b, x, z), rise = e * 0.22 + e * e * 0.0009; h = Math.min(h, b.base(z) + Math.max(rise * 0.35, rise + fbm(x, z) * Math.min(1, e / 40))); }
  return h;
}
const eMin = (x, z) => Math.min(...BOXES.map(b => edist(b, x, z)));

export function buildCity(stage, app) {
  const g = new THREE.Group(); g.name = 'cidade'; stage.scene.add(g);
  const std = (o, wuv) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o }); if (wuv) m.userData.wuv = wuv; return m; };
  const cal = TX.calTex();
  const mats = {
    cal: std({ map: cal }, 3), ocre: std({ map: cal, color: '#d9a44a' }, 3), stone: std({ map: TX.stoneTex(), roughness: 0.82 }, 1.5),
    roof: std({ map: TX.roofTex(), roughness: 0.8 }, 2), ashlar: std({ map: TX.ashlarTex() }, 2.5), laje: std({ map: TX.lajeTex(), roughness: 0.85 }, 2.5),
    win: std({ map: TX.windowTex(), roughness: 0.25, metalness: 0.1 }), glass: std({ map: TX.darkTex(), roughness: 0.2, metalness: 0.3 }),
    door: std({ map: TX.doorTex(), roughness: 0.7 }), relief: std({ map: TX.reliefTex(), alphaTest: 0.5, roughness: 0.85 }),
    bronze: std({ color: '#7a5828', metalness: 0.85, roughness: 0.38, side: THREE.DoubleSide }), wood: std({ color: '#4a3220' }),
    iron: std({ color: '#141414', metalness: 0.55, roughness: 0.5 }),
    lampGlass: std({ color: '#efe2bd', emissive: '#ffcf80', emissiveIntensity: 0.12, roughness: 0.15, metalness: 0.1 }),
    terra: std({ color: '#a2573a', roughness: 0.85 }), leaf: std({ color: '#3d5e2a' }), flower: std({ color: '#c23a4a', roughness: 0.7 }),
    people: std({ vertexColors: true, roughness: 0.85 }),
  };
  mats.relief.userData.noCast = true;

  // ── igreja, adro, igrejinhas distantes ──
  const M = new Merger();
  buildChurch(M); buildAdro(M);
  for (const [x, z, ry, k] of [[-62, 196, 0.5, 0.9], [118, -150, 2.6, 0.85], [96, 168, -0.6, 0.75]]) miniChurch(M, x, cityH(x, z) - 0.5, z, ry, k);
  M.build(g, mats);
  buildProps(g, mats);

  // ── terreno ──
  const S = 760, N = 170, tg = new THREE.PlaneGeometry(S, S, N, N); tg.rotateX(-Math.PI / 2); tg.translate(19, 0, 40);
  const tp = tg.attributes.position, col = new Float32Array(tp.count * 3);
  const cG1 = new THREE.Color('#6f7a3e'), cG2 = new THREE.Color('#4d5f2e'), cEa = new THREE.Color('#8a5a3c'), cRo = new THREE.Color('#8d877a'), cGr = new THREE.Color('#7a7262'), tc = new THREE.Color();
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), h = cityH(x, z); tp.setY(i, h);
    const sl = Math.hypot(cityH(x + 2, z) - h, cityH(x, z + 2) - h) / 2, e = eMin(x, z);
    const n1 = 0.5 + 0.5 * Math.sin(x * 0.05 + Math.cos(z * 0.04) * 2) * Math.sin(z * 0.045 + Math.sin(x * 0.03)), n2 = 0.5 + 0.5 * Math.sin(x * 0.09 + 1) * Math.sin(z * 0.07 + 2);
    tc.copy(cG1).lerp(cG2, n1).lerp(cEa, THREE.MathUtils.smoothstep(n2, 0.62, 0.9) * 0.8).lerp(cRo, THREE.MathUtils.smoothstep(sl, 0.55, 1.0) * 0.85);
    if (e < 6) tc.lerp(cGr, 1 - e / 6);
    col.set([tc.r, tc.g, tc.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.computeVertexNormals();
  const gt = TX.groundTex(); gt.repeat.set(S / 9, S / 9);
  const terr = new THREE.Mesh(tg, std({ map: gt, vertexColors: true, roughness: 0.97 })); terr.receiveShadow = true; terr.name = 'city_terreno'; g.add(terr);

  // ── casario distante: fileiras geminadas acompanhando as curvas de nível, telhados de 4 águas cerâmicos ──
  const occ = new Set(), cell = (x, z) => `${Math.floor(x / 7)},${Math.floor(z / 7)}`;
  const houses = [];
  const clusters = [[19, 140, 4], [-35, 125, 3], [75, 120, 3], [20, 215, 3], [-60, 175, 3], [105, 190, 3], [-40, -120, 3], [70, -118, 3], [19, -175, 3], [-85, -180, 2], [-90, 40, 3], [130, -20, 3], [-80, -40, 2], [125, 80, 3], [150, 140, 2], [-130, 110, 2],
    [19, 185, 3], [0, 250, 3], [40, 245, 3], [19, 300, 2], [-22, 222, 2], [62, 205, 2], [19, -130, 3], [0, -228, 2], [42, -222, 2], [19, -290, 2]];
  for (const [cx, cz, rows] of clusters) {
    const gx = cityH(cx + 3, cz) - cityH(cx - 3, cz), gz = cityH(cx, cz + 3) - cityH(cx, cz - 3), gl = Math.hypot(gx, gz) || 1;
    const dx = -gz / gl, dz = gx / gl, ux = gx / gl, uz = gz / gl; // ao longo da curva de nível / encosta acima
    for (let r = 0; r < rows; r++) {
      let s = -38 + rnd() * 10; const off = (r - (rows - 1) / 2) * 13 + (rnd() - 0.5) * 3;
      while (s < 38) {
        const w = 5.5 + rnd() * 4, d = 7 + rnd() * 4, hw = 4.2 + (rnd() < 0.3 ? 2.6 : 0) + rnd() * 0.8, bend = Math.sin(s * 0.04 + r) * 4;
        const x = cx + dx * (s + w / 2) + ux * (off + bend), z = cz + dz * (s + w / 2) + uz * (off + bend);
        s += w + (rnd() < 0.15 ? 5 + rnd() * 8 : 0.15);
        if (eMin(x, z) < 12) continue;
        const ry = Math.atan2(-dz, dx) + (rnd() - 0.5) * 0.08, c = Math.cos(ry), sn = Math.sin(ry);
        let hmin = 1e9, hmax = -1e9; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const hh = cityH(x + (a * w / 2) * c + (b * d / 2) * sn, z - (a * w / 2) * sn + (b * d / 2) * c); hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh); }
        if (hmax - hmin > 7) continue;
        houses.push({ x, z, ry, w, d, y0: hmin - 0.6, h: hw + (hmax - hmin) + 0.6, top: hmax + hw }); occ.add(cell(x, z));
      }
    }
  }
  const hm = new THREE.MeshStandardMaterial({ map: TX.farHouseTex(), roughness: 0.92 });
  const hipG = (() => { const A = [-0.5, 0, -0.5], B = [0.5, 0, -0.5], C = [0.5, 0, 0.5], D = [-0.5, 0, 0.5], R1 = [-0.22, 1, 0], R2 = [0.22, 1, 0];
    const tri = [A, R1, R2, A, R2, B, C, R2, R1, C, R1, D, B, R2, C, D, R1, A].flat(); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); geo.computeVertexNormals(); return geo; })();
  const rm = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const hI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), hm, houses.length), rI = new THREE.InstancedMesh(hipG, rm, houses.length);
  const wallC = ['#f4f0e8', '#f2ede2', '#efe6cf', '#f1e0b0', '#e6c98a', '#dfe4e8', '#efdccd', '#f5f3ee'].map(h => new THREE.Color(h));
  const roofC = ['#a9543a', '#9a4a33', '#b06243', '#8b4530', '#a35a3e', '#7d4433'].map(h => new THREE.Color(h));
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  houses.forEach((o, i) => {
    qq.setFromAxisAngle(Y, o.ry);
    hI.setMatrixAt(i, mm.compose(pp.set(o.x, o.y0 + o.h / 2, o.z), qq, ss.set(o.w, o.h, o.d))); hI.setColorAt(i, wallC[(rnd() * wallC.length) | 0]);
    rI.setMatrixAt(i, mm.compose(pp.set(o.x, o.y0 + o.h, o.z), qq, ss.set(o.w + 0.6, 1.5 + rnd() * 0.6, o.d + 0.6))); rI.setColorAt(i, roofC[(rnd() * roofC.length) | 0]);
  });
  hI.receiveShadow = rI.receiveShadow = true; g.add(hI, rI);

  // ── mata / cerrado em manchas (blobs instanciados) e árvores junto à igreja ──
  const blobs = [];
  for (let k = 0; k < 9000 && blobs.length < 1400; k++) {
    const x = -300 + rnd() * 640, z = -300 + rnd() * 680, e = eMin(x, z);
    if (e < 7 || Math.hypot(x - 19, z - 40) > 370 || occ.has(cell(x, z))) continue;
    const patch = Math.sin(x * 0.035 + 1.7) * Math.sin(z * 0.03 + 0.4) + 0.5 * Math.sin(x * 0.08 - z * 0.06);
    if (patch < 0.15 + rnd() * 0.3) continue;
    const s = 1.6 + rnd() * 3.2; blobs.push([x, cityH(x, z) + s * 0.35, z, s]);
  }
  const trees = [[5.5, 66], [3.6, 75], [33.2, 65], [35, 75], [6.5, 87], [31.5, 88], [2, 54], [37, 55]];
  const trunkM = [];
  for (const [x, z] of trees) { const y = cityH(x, z), th = 4 + rnd() * 2; trunkM.push([x, y + th / 2, z, th]); for (let i = 0; i < 4; i++) blobs.push([x + (rnd() - 0.5) * 2.5, y + th + rnd() * 1.6, z + (rnd() - 0.5) * 2.5, 1.6 + rnd() * 1.2]); }
  const vegC = ['#2f4a22', '#3b5a2a', '#4a6431', '#56683a', '#2a3f20', '#6c7240', '#41552b'].map(h => new THREE.Color(h));
  const vI = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), std({ roughness: 0.95, flatShading: true }), blobs.length);
  blobs.forEach(([x, y, z, s], i) => { vI.setMatrixAt(i, mm.compose(pp.set(x, y, z), qq.setFromAxisAngle(Y, rnd() * 6), ss.set(s * (0.9 + rnd() * 0.3), s * 0.78, s * (0.9 + rnd() * 0.3)))); vI.setColorAt(i, vegC[(rnd() * vegC.length) | 0]); });
  vI.castShadow = true; vI.receiveShadow = true; g.add(vI);
  const tI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 1, 7), std({ color: '#4b3a2a' }), trunkM.length);
  trunkM.forEach(([x, y, z, h], i) => tI.setMatrixAt(i, mm.compose(pp.set(x, y, z), qq.identity(), ss.set(1, h, 1)))); tI.castShadow = true; g.add(tI);

  const vis = () => (app?.street?.group ? app.street.group.visible : stage.env === 'rua');
  g.visible = vis();
  return { group: g, cityH, update() { const v = vis(); if (g.visible !== v) g.visible = v; } };
}
