// AMBIENTAÇÃO (realismo da sala de fornos) — dono: AMBIENTAÇÃO.
// Insumos (pallets de farinha 25 kg, baldes, caixas), estantes inox, pás de forno, luvas em ganchos, câmara fria modular com
// cortina de PVC, eletrocalha, quadro de avisos/cronograma, relógio (hora simulada), termo-higrômetro (campo térmico), lavatório
// e dispensers, pallets/carrinho plataforma, pó de farinha/pegadas/marcas de rodízio/sombras de contato no piso.
// Tudo procedural e em lote. Desvia do que CENÁRIO/EQUIPAMENTOS construíram por ocupação em voxels (triângulos deles),
// mantém livres estações, caminhos, rotas de fuga, 1,2 m diante dos fornos e o acesso a quadro elétrico/extintores/portas.
// Não toca em materiais nem malhas dos outros donos (nenhum decalque sobre fornos/coifas/vidros).
import * as THREE from 'three';
import { HALL, OVENS, ovenFrontZ, STATIONS, BENCH, TABLE, FAN } from './layout.js';
import * as T from './props_tex.js';
import {
  Batch, M, mul, box, rbox, cyl, bagGeo, bucketGeos, crateGeos, trayGeo, peelGeos, gloveGeo, foldedClothGeo, hangingClothGeo,
  addRack, addPallet, addPlasticPallet, addPlatformCart, addCableTray,
} from './props_geo.js';
import { buildColdRoom } from './props_cold.js';

const QS = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();

function makeMats() {
  const std = (o, name) => Object.assign(new THREE.MeshStandardMaterial(o), { name });
  const st = T.steelTex();
  const m = {
    steel: std({ color: 0xe2e4e6, map: st.map, roughnessMap: st.rough, metalness: 1, roughness: 0.95, envMapIntensity: 1.0 }, 'steel'),
    galv: std({ color: 0xb4b8ba, metalness: 1, roughness: 0.5 }, 'galv'),
    trayGalv: std({ color: 0xa9adb0, map: T.trayTex('perf', 9), metalness: 0.9, roughness: 0.55 }, 'trayGalv'),
    rubber: std({ color: 0x1c1c1c, roughness: 0.85 }, 'rubber'),
    cableGray: std({ color: 0x5e6164, roughness: 0.6 }, 'cableGray'),
    plasticW: std({ color: 0xf0f0ec, roughness: 0.42 }, 'plasticW'),
    alu: std({ color: 0xc2c5c8, metalness: 1, roughness: 0.32 }, 'alu'),
    wood: std({ map: T.woodTex('#c99f66', 1), roughness: 0.72 }, 'wood'),
    pallet: std({ map: T.woodTex('#b9905c', 2), roughness: 0.92 }, 'pallet'),
    pallet2: std({ map: T.woodTex('#a37d4f', 3), roughness: 0.92 }, 'pallet2'),
    ppallet: std({ color: 0x2f3d4e, roughness: 0.62 }, 'ppallet'),
    cartPaint: std({ color: 0x2552a0, roughness: 0.45, metalness: 0.25 }, 'cartPaint'),
    trayAlu: std({ map: T.trayTex('alu', 1), metalness: 0.85, roughness: 0.42 }, 'trayAlu'),
    trayBlack: std({ map: T.trayTex('black', 2), metalness: 0.55, roughness: 0.52 }, 'trayBlack'),
    trayPerf: std({ map: T.trayTex('perf', 3), metalness: 0.85, roughness: 0.45 }, 'trayPerf'),
    glove: std({ map: T.gloveTex(), roughness: 0.96 }, 'glove'),
    clothB: std({ map: T.clothTex('#2f5fa8', 1), roughness: 0.97, side: THREE.DoubleSide }, 'clothB'),
    clothR: std({ map: T.clothTex('#b5302b', 2), roughness: 0.97, side: THREE.DoubleSide }, 'clothR'),
    socketBody: std({ color: 0x9ea2a5, roughness: 0.5 }, 'socketBody'),
    socketRed: std({ color: 0xb8262a, roughness: 0.42 }, 'socketRed'),
    socketBlue: std({ color: 0x1f56b0, roughness: 0.42 }, 'socketBlue'),
    conduit: std({ color: 0x8d9194, roughness: 0.55 }, 'conduit'),
    lidRed: std({ color: 0xc23a2c, roughness: 0.4 }, 'lidRed'),
    lidBlue: std({ color: 0x2a62b8, roughness: 0.4 }, 'lidBlue'),
    lidYel: std({ color: 0xe0b030, roughness: 0.4 }, 'lidYel'),
    black: std({ color: 0x151515, roughness: 0.5 }, 'black'),
    flour: std({ color: 0xf4f1ea, roughness: 0.98 }, 'flour'),
    coldFloor: std({ color: 0xcfd3d2, roughness: 0.5 }, 'coldFloor'),
    dough: std({ color: 0xead9b4, roughness: 0.75 }, 'dough'),
  };
  m.bag = [0, 1, 2].map((i) => std({ map: T.bagTex(i), roughness: 0.9 }, 'bag' + i));
  m.card = [['FRÁGIL', 1], ['FERMENTO', 2], ['EMBALAGENS', 3]].map(([t, s]) => std({ map: T.cardTex(s, t), roughness: 0.88 }, 'card' + s));
  m.bucket = [
    std({ map: T.labelTex(['MARGARINA', 'USO PROFISSIONAL', '15 kg'], '#f0f0ea', '#1d3f7a', '#f2c230', 1), roughness: 0.45 }, 'bk0'),
    std({ map: T.labelTex(['GORDURA', 'VEGETAL', '14,5 kg'], '#f0f0ea', '#7a1d1d', '#e6e2d4', 2), roughness: 0.45 }, 'bk1'),
    std({ map: T.labelTex(['MELHORADOR', 'P/ PÃES', '10 kg'], '#f0f0ea', '#14552a', '#cfe7c4', 3), roughness: 0.45 }, 'bk2'),
  ];
  const crate = (col, n) => ({
    side: std({ color: col, alphaMap: T.crateAlpha(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 }, 'crS' + n),
    bottom: std({ color: col, alphaMap: T.crateBottomAlpha(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 }, 'crB' + n),
    rim: std({ color: col, roughness: 0.48 }, 'crR' + n),
  });
  m.crate = [crate(0x2a5da6, 0), crate(0xdadbd6, 1)];
  return m;
}

export function buildProps(stage, app) {
  const t0 = performance.now();
  const root = new THREE.Group(); root.name = 'props'; stage.scene.add(root);
  if (QS.get('noprops') === '1') return { group: root, update() {}, info: {} }; // A/B de desempenho e diagnóstico
  const mats = makeMats();
  const B = new Batch();
  const R = T.rng(2026);
  const rr = (a, b) => a + R() * (b - a);
  const X0 = HALL.x0, X1 = HALL.x1, Z0 = HALL.z0, Z1 = HALL.z1;

  // ───────────── ocupação (voxels de 6 cm) do que CENÁRIO/EQUIPAMENTOS/MEDIDOR construíram ─────────────
  // Os outros donos mesclam geometria por material (caixas envolventes inúteis) → rasterizamos os triângulos.
  const VC = 0.06, NX = Math.ceil((X1 - X0) / VC), NY = Math.ceil(HALL.h / VC), NZ = Math.ceil((Z1 - Z0) / VC);
  const grid = new Uint8Array(NX * NY * NZ);
  const gi = (i, j, k) => (j * NZ + k) * NX + i;
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), mi = new THREE.Matrix4(), mw = new THREE.Matrix4();
    const near = (v, e) => [Math.abs(v.x - X0) < e, Math.abs(v.x - X1) < e, Math.abs(v.z - Z0) < e, Math.abs(v.z - Z1) < e];
    const allNear = (e) => { const A = near(a, e), Bn = near(b, e), C = near(c, e); for (let q = 0; q < 4; q++) if (A[q] && Bn[q] && C[q]) return true; return false; };
    function tri(bit) {
      const y0 = Math.min(a.y, b.y, c.y), y1 = Math.max(a.y, b.y, c.y);
      if (y1 < 0.012 || y0 > HALL.h - 0.03) return;
      const x0 = Math.min(a.x, b.x, c.x), x1 = Math.max(a.x, b.x, c.x), z0 = Math.min(a.z, b.z, c.z), z1 = Math.max(a.z, b.z, c.z);
      if (x1 < X0 || x0 > X1 || z1 < Z0 || z0 > Z1) return;
      const ext = Math.max(x1 - x0, y1 - y0, z1 - z0);
      if (allNear(0.006)) return;                                  // a própria parede / azulejo
      if (ext > 1.2 && allNear(0.04)) return;                        // grandes painéis de parede
      if (y1 < 0.17 && ext > 0.8 && allNear(0.16)) return;           // rodapé sanitário
      if (ext > 4 && y1 - y0 < 0.02 && y0 < 0.03) return;            // piso
      const i0 = Math.max(0, Math.floor((x0 - X0) / VC)), i1 = Math.min(NX - 1, Math.floor((x1 - X0) / VC));
      const j0 = Math.max(0, Math.floor(y0 / VC)), j1 = Math.min(NY - 1, Math.floor(y1 / VC));
      const k0 = Math.max(0, Math.floor((z0 - Z0) / VC)), k1 = Math.min(NZ - 1, Math.floor((z1 - Z0) / VC));
      for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) grid[gi(i, j, k)] |= bit;
    }
    function addGroup(group, bit) {
      if (!group) return; group.updateWorldMatrix(true, true);
      group.traverse((o) => {
        if (!o.isMesh || !o.geometry?.attributes?.position) return;
        for (let p = o; p; p = p.parent) if (p.visible === false) return;
        const mt = Array.isArray(o.material) ? o.material[0] : o.material;
        if (mt && mt.transparent && !mt.depthWrite) return; // vapor, ar quente, decalques
        const pos = o.geometry.attributes.position, idx = o.geometry.index, nt = (idx ? idx.count : pos.count) / 3;
        const inst = o.isInstancedMesh ? Math.min(o.count, 600) : 1; if (nt * inst > 400000) return;
        for (let n = 0; n < inst; n++) {
          if (o.isInstancedMesh) { o.getMatrixAt(n, mi); mw.multiplyMatrices(o.matrixWorld, mi); } else mw.copy(o.matrixWorld);
          for (let t = 0; t < nt; t++) {
            const i0 = idx ? idx.getX(3 * t) : 3 * t, i1 = idx ? idx.getX(3 * t + 1) : 3 * t + 1, i2 = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
            a.fromBufferAttribute(pos, i0).applyMatrix4(mw); b.fromBufferAttribute(pos, i1).applyMatrix4(mw); c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
            tri(bit);
          }
        }
      });
    }
    addGroup(app.hall?.group, 1); addGroup(app.machines?.group, 2); addGroup(app.kit?.group, 4);
  }
  const TAG = { 1: 'cenario', 2: 'equip', 4: 'kit' };
  function gridHit(bx) {
    const e = 0.012;
    const i0 = Math.max(0, Math.floor((bx.min.x + e - X0) / VC)), i1 = Math.min(NX - 1, Math.floor((bx.max.x - e - X0) / VC));
    const j0 = Math.max(0, Math.floor((bx.min.y + e) / VC)), j1 = Math.min(NY - 1, Math.floor((bx.max.y - e) / VC));
    const k0 = Math.max(0, Math.floor((bx.min.z + e - Z0) / VC)), k1 = Math.min(NZ - 1, Math.floor((bx.max.z - e - Z0) / VC));
    let bits = 0; for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) bits |= grid[gi(i, j, k)];
    return bits;
  }

  // zonas que devem ficar livres
  const circles = [];
  for (const s of Object.values(STATIONS)) { if (Math.abs(s.worker[0]) > 20) continue; circles.push([s.worker[0], s.worker[2], 0.55]); circles.push([s.tripod[0], s.tripod[2], 0.55]); }
  circles.push([TABLE.pos[0], TABLE.pos[2], 1.0], [FAN.pos[0], FAN.pos[2], 0.5]);
  for (const v of Object.values(stage.views || {})) if (v?.pos && v.pos[1] < 2.6 && v.pos[0] < 20) circles.push([v.pos[0], v.pos[2], 0.6]);
  const segs = [];
  const S = STATIONS;
  const seg = (a, b, r = 0.55) => segs.push([a[0], a[2], b[0], b[2], r]);
  seg(S.forno.worker, S.bancada.worker); seg(S.bancada.worker, S.descanso.worker); seg(S.forno.tripod, S.bancada.tripod);
  for (const s of [S.forno, S.bancada, S.descanso]) seg(TABLE.pos, s.tripod, 0.45);
  seg(S.bancada.worker, [1.0, 0, Z1 - 0.6], 0.7); seg(S.descanso.worker, [X0 + 0.7, 0, 1.1], 0.7); // rotas de fuga (porta principal x 0,2–1,8; saída de emergência z 0,6–1,6)
  const ovenFront = OVENS.map((o) => [o.x - o.w / 2 - 0.05, ovenFrontZ(o), o.x + o.w / 2 + 0.05, ovenFrontZ(o) + 1.2]);
  // áreas de acesso obrigatório (NR-10, NR-23, saídas): quadro elétrico, extintores, portas, bebedouro
  // portas (hall.js): saída de emergência na parede esquerda z∈[0,6;1,6]; porta principal na parede da frente x∈[0,2;1,8] —
  // faixa livre de 1,5 m diante de cada uma (NR-23), com folga lateral
  const hard = [[X0, -5.6, X0 + 1.15, -4.4], [X0, 0.1, X0 + 1.6, 2.1], [-0.3, Z1 - 1.6, 2.3, Z1], [X0, 1.0, X0 + 1.4, 3.8], [X0, -1.85, X0 + 0.9, -0.55], [X1 - 0.9, -1.25, X1, 0.05]];
  const placed = [], rejected = [];

  function rectDist(b, x, z) { const dx = Math.max(b.min.x - x, 0, x - b.max.x), dz = Math.max(b.min.z - z, 0, z - b.max.z); return Math.hypot(dx, dz); }
  function segDist(b, s) { let d = 1e9; const n = Math.max(2, Math.ceil(Math.hypot(s[2] - s[0], s[3] - s[1]) / 0.1)); for (let i = 0; i <= n; i++) { const t = i / n; d = Math.min(d, rectDist(b, s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t)); } return d; }
  const inRect = (bx, [a, b, c, d]) => bx.max.x > a && bx.min.x < c && bx.max.z > b && bx.min.z < d;
  function isFree(bx, { ignoreKeepout = false } = {}) {
    if (bx.min.x < X0 - 0.002 || bx.max.x > X1 + 0.002 || bx.min.z < Z0 - 0.002 || bx.max.z > Z1 + 0.002) return 'parede';
    const bits = gridHit(bx); if (bits) return 'ocupado:' + Object.entries(TAG).filter(([k]) => bits & k).map(([, v]) => v).join('+');
    const sh = bx.clone().expandByScalar(-0.004);
    for (const p of placed) if (p.box.intersectsBox(sh)) return 'prop:' + p.name;
    for (const r of hard) if (inRect(bx, r) && bx.min.y < 2.08) return 'acesso';
    if (ignoreKeepout) return null;
    if (bx.min.y > 2.1) return null;
    for (const [x, z, r] of circles) if (rectDist(bx, x, z) < r) return 'livre';
    for (const s of segs) if (segDist(bx, s) < s[4]) return 'caminho';
    for (const r of ovenFront) if (inRect(bx, r)) return 'frente-forno';
    return null;
  }
  function aabb(x, y, z, ry, w, h, d) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
    return new THREE.Box3(new THREE.Vector3(x - hw, y, z - hd), new THREE.Vector3(x + hw, y + h, z + hd));
  }
  const floorShadows = []; // [x, z, w, d, ry, força]
  function place(name, size, spots, build, opt = {}) {
    for (const sp of spots) {
      const [x, z, ry = 0, y = 0] = sp; const bx = aabb(x, y, z, ry, ...size);
      const why = isFree(bx, opt);
      if (!why) { build(M(x, y, z, ry), sp); placed.push({ name, box: bx }); if (y < 0.05 && opt.shadow !== false) floorShadows.push([x, z, size[0], size[2], ry, opt.ao ?? 0.55]); return sp; }
      rejected.push({ name, at: [+x.toFixed(2), +z.toFixed(2)], why });
    }
    return null;
  }

  // ───────────── construtores de itens ─────────────
  const bagG = [1, 2, 3, 4].map((s) => bagGeo(s));
  function bagStack(base, layers = 6, { missing = 0, variant = 0 } = {}) {
    // 5 sacos por camada: 3 transversais + 2 longitudinais; camadas espelhadas (amarração)
    let n = 0; const total = layers * 5 - missing;
    for (let L = 0; L < layers; L++) {
      const f = L % 2 ? -1 : 1, y = 0.153 + L * 0.118 + 0.062;
      for (const [a, b, r] of [[-0.4, -0.19 * f, Math.PI / 2], [0, -0.19 * f, Math.PI / 2], [0.4, -0.19 * f, Math.PI / 2], [-0.31, 0.32 * f, 0], [0.31, 0.32 * f, 0]]) {
        if (n >= total) return; n++;
        B.add(bagG[(n + L) % 4], mats.bag[variant], mul(base, M(a + rr(-0.012, 0.012), y, b + rr(-0.012, 0.012), r + rr(-0.035, 0.035), rr(-0.012, 0.012), rr(-0.012, 0.012))));
      }
    }
  }
  function bucket(base, kind = 0, lid = 'lidRed', withLid = true) { const g = bucketGeos(); B.add(g.body, mats.bucket[kind], base); if (withLid) B.add(g.lid, mats[lid], base); B.add(g.handle, mats.galv, base, { cast: false }); }
  function crate(base, col = 0) { const g = crateGeos(), c = mats.crate[col]; B.add(g.sides, c.side, base, { cast: false }); B.add(g.bottom, c.bottom, base, { cast: false }); B.add(g.rim, c.rim, base); }
  function cardBox(base, w, h, d, k = 0) { B.add(rbox(w, h, d, 0.004), mats.card[k], mul(base, M(0, h / 2, 0))); }
  function trayStack(base, n, mat, { perf = false, jitter = 0.006, pitch = 0.0085 } = {}) {
    const g = trayGeo(0.6, 0.4, perf ? 0.012 : 0.024, perf);
    for (let i = 0; i < n; i++) B.add(g, mat, mul(base, M(rr(-jitter, jitter), i * pitch, rr(-jitter, jitter), rr(-0.015, 0.015))), { cast: i === n - 1 || i === 0 });
  }
  function clothStack(base, n, mat) { for (let i = 0; i < n; i++) B.add(foldedClothGeo(i + 1), mat, mul(base, M(rr(-0.01, 0.01), 0.011 + i * 0.02, rr(-0.01, 0.01), rr(-0.08, 0.08)))); }

  // ═════ 1) pallets de farinha (25 kg) — junto à masseira (parede esquerda) e perto da bancada (parede direita) ═════
  const flourSpots = [];
  const fp = place('pallet-farinha', [1.22, 0.9, 1.02], [[X0 + 0.53, -3.15, Math.PI / 2], [X0 + 0.53, -2.85, Math.PI / 2], [-2.4, Z1 - 0.53, 0]], (b) => { addPlasticPallet(B, mats, b); bagStack(b, 6, { missing: 3 }); }, { ao: 0.7 });
  if (fp) flourSpots.push([fp[0] + 0.4, fp[1], 1.0]);
  const fp2 = place('pallet-farinha-2', [1.22, 0.72, 1.02], [[X1 - 0.53, -1.95, Math.PI / 2], [X1 - 0.53, -2.05, Math.PI / 2], [-3.8, Z1 - 0.53, 0]], (b) => { addPlasticPallet(B, mats, b); bagStack(b, 5, { missing: 4, variant: 1 }); }, { ao: 0.7 });
  if (fp2) flourSpots.push([fp2[0] - 0.4, fp2[1], 0.9]);

  // ═════ 2) estantes baixas inox sob as prateleiras de parede do CENÁRIO (parede direita) + estante da parede da frente ═════
  function lowRack(base, v) {
    addRack(B, mats, base, { w: 1.5, d: 0.5, h: 0.92, levels: [0.14, 0.52, 0.9] });
    if (v === 0) {
      for (let i = 0; i < 4; i++) bucket(mul(base, M(-0.54 + i * 0.355, 0.146, rr(-0.03, 0.03), rr(0, 6))), i % 3, ['lidRed', 'lidBlue', 'lidYel'][i % 3]);
      for (let i = 0; i < 3; i++) cardBox(mul(base, M(-0.46 + i * 0.46, 0.526, rr(-0.04, 0.04), rr(-0.08, 0.08))), 0.4, 0.26 + (i % 2) * 0.04, 0.36, 1);
      trayStack(mul(base, M(-0.36, 0.906, 0)), 12, mats.trayBlack); trayStack(mul(base, M(0.36, 0.906, 0)), 7, mats.trayAlu);
    } else {
      trayStack(mul(base, M(-0.36, 0.146, 0)), 24, mats.trayPerf, { perf: true, pitch: 0.011 }); trayStack(mul(base, M(0.36, 0.146, 0)), 19, mats.trayPerf, { perf: true, pitch: 0.011 });
      crate(mul(base, M(-0.38, 0.526, 0, 0.02)), 0); crate(mul(base, M(0.36, 0.526, 0, -0.03)), 1);
      clothStack(mul(base, M(-0.45, 0.906, 0.02)), 5, mats.clothB); clothStack(mul(base, M(-0.15, 0.906, -0.02)), 4, mats.clothR); cardBox(mul(base, M(0.38, 0.906, 0, 0.05)), 0.4, 0.06, 0.32, 2);
    }
  }
  place('estante-baixa-1', [1.5, 1.05, 0.5], [[X1 - 0.27, 1.15, -Math.PI / 2], [X1 - 0.27, 1.35, -Math.PI / 2]], (b) => lowRack(b, 0));
  place('estante-baixa-2', [1.5, 1.05, 0.5], [[X1 - 0.27, 2.75, -Math.PI / 2], [X1 - 0.27, 2.95, -Math.PI / 2]], (b) => lowRack(b, 1));
  function tallRack(base) {
    addRack(B, mats, base, { w: 1.5, d: 0.5, h: 1.82, levels: [0.16, 0.6, 1.04, 1.48] });
    for (let i = 0; i < 4; i++) bucket(mul(base, M(-0.54 + i * 0.355, 0.166, rr(-0.04, 0.04), rr(0, 6))), (i + 1) % 3, ['lidBlue', 'lidYel', 'lidRed'][i % 3]);
    for (let i = 0; i < 3; i++) cardBox(mul(base, M(-0.46 + i * 0.46, 0.606, rr(-0.05, 0.05), rr(-0.08, 0.08))), 0.4, 0.24, 0.38, i === 1 ? 2 : 1);
    cardBox(mul(base, M(0.0, 0.85, 0, 0.1)), 0.36, 0.2, 0.34, 0);
    crate(mul(base, M(-0.38, 1.046, 0)), 0); crate(mul(base, M(0.36, 1.046, 0, 0.02)), 0); crate(mul(base, M(0.36, 1.326, 0, -0.03)), 1);
    trayStack(mul(base, M(-0.36, 1.486, 0)), 14, mats.trayBlack); trayStack(mul(base, M(0.36, 1.486, 0)), 9, mats.trayAlu);
  }
  place('estante-frente', [1.5, 1.85, 0.5], [[-2.15, Z1 - 0.27, Math.PI], [-3.7, Z1 - 0.27, Math.PI], [5.2, Z1 - 0.27, Math.PI]], (b) => tallRack(b));

  // ═════ 3) câmara fria modular com cortina de PVC (canto da frente, à direita da porta principal) ═════
  let cold = null;
  place('camara-fria', [2.6, 2.62, 1.95], [[5.85, Z1 - 1.0, 0], [6.0, Z1 - 1.0, 0]], (b, sp) => {
    cold = buildColdRoom(B, mats, M(sp[0], 0, Z1 - 1.92, Math.PI), root, {});
  }, { ao: 0.6 });

  // ═════ 4) pallets vazios, carrinho plataforma, caixas plásticas ═════
  place('pallets-vazios', [1.22, 0.45, 1.02], [[X0 + 0.53, 0.25, Math.PI / 2], [X0 + 0.58, 0.3, Math.PI / 2], [-4.6, Z1 - 0.53, 0], [-0.6, Z1 - 0.53, 0], [7.9, 0.1, Math.PI / 2]], (b) => {
    for (let i = 0; i < 3; i++) addPallet(B, mats, mul(b, M(rr(-0.02, 0.02), i * 0.145, rr(-0.02, 0.02), rr(-0.03, 0.03))));
  }, { ao: 0.7 });
  place('carrinho-plataforma', [1.0, 0.98, 0.64], [[X1 - 0.75, 5.3, Math.PI / 2 + 0.05], [X1 - 0.75, 5.2, Math.PI / 2], [-3.4, Z1 - 0.45, 0.04]], (b) => {
    addPlatformCart(B, mats, b);
    B.add(bagG[0], mats.bag[0], mul(b, M(-0.08, 0.255, 0.0, 0.05))); B.add(bagG[2], mats.bag[0], mul(b, M(-0.06, 0.373, 0.01, -0.06)));
  }, { ao: 0.5 });
  place('caixas-plasticas', [0.62, 1.15, 0.42], [[X0 + 0.24, -2.2, Math.PI / 2], [X0 + 0.24, -2.25, Math.PI / 2], [-4.6, Z1 - 0.24, 0]], (b) => {
    for (let i = 0; i < 4; i++) crate(mul(b, M(rr(-0.01, 0.01), i * 0.275, rr(-0.01, 0.01), rr(-0.03, 0.03))), i === 3 ? 1 : 0);
  });

  // ═════ 5) pás de forno de cabo longo encostadas na parede, junto aos lastros ═════
  function peel(name, x, L, { edge = false, tilt = 0.12, mat = mats.wood } = {}) {
    const bl = 0.38, tot = L + bl, g = peelGeos(L, edge ? 0.28 : 0.34, bl);
    const zf = Z0 + (edge ? 0.17 : 0.03) + tot * Math.sin(tilt);
    const bx = edge ? new THREE.Box3(new THREE.Vector3(x - 0.03, 0, Z0 + 0.01), new THREE.Vector3(x + 0.03, tot, zf + 0.03))
      : new THREE.Box3(new THREE.Vector3(x - 0.18, 0, Z0 + 0.01), new THREE.Vector3(x + 0.18, tot, zf + 0.03));
    const why = isFree(bx, { ignoreKeepout: true }); if (why) { rejected.push({ name, at: [+x.toFixed(2), +zf.toFixed(2)], why }); return false; }
    const base = edge ? M(x, 0, zf, Math.PI / 2, 0, -tilt) : M(x, 0, zf, rr(-0.1, 0.1), -tilt);
    const inv = mul(base, M(0, tot, 0, 0, 0, Math.PI));
    B.add(g.blade, mat, inv); B.add(g.handle, mats.alu, inv); B.add(g.cap, mats.black, inv);
    placed.push({ name, box: bx }); floorShadows.push([x, zf - 0.02, 0.07, 0.07, 0, 0.6]); return true;
  }
  /** pá de perfil num vão entre fornos, encostada de lado na chapa lateral do forno vizinho (xTop) */
  function peelSide(name, xb, xTop, zf, L, mat = mats.wood) {
    const bl = 0.38, tot = L + bl, g = peelGeos(L, 0.28, bl), th = Math.atan2(xTop - xb, tot);
    const bx = new THREE.Box3(new THREE.Vector3(Math.min(xb, xTop) - 0.025, 0, zf - 0.16), new THREE.Vector3(Math.max(xb, xTop) + 0.025, tot, zf + 0.16));
    const why = isFree(bx, { ignoreKeepout: true }); if (why) { rejected.push({ name, at: [+xb.toFixed(2), +zf.toFixed(2)], why }); return false; }
    const inv = mul(M(xb, 0, zf, Math.PI / 2, th), M(0, tot, 0, 0, 0, Math.PI));
    B.add(g.blade, mat, inv); B.add(g.handle, mats.alu, inv); B.add(g.cap, mats.black, inv);
    placed.push({ name, box: bx }); floorShadows.push([xb, zf, 0.07, 0.07, 0, 0.6]); return true;
  }
  let nPeel = 0;
  for (const [x, L, o] of [[3.85, 2.0, { edge: true, tilt: 0.1 }], [-3.32, 2.2, {}], [-3.2, 1.9, { mat: mats.alu, tilt: 0.15 }]]) if (peel('pá-forno', x, L, o)) nPeel++;
  // vão rotativo | lastro (x −1,10 … −0,70): duas pás de perfil apoiadas na lateral do rotativo; vão forno2 | lastro4
  for (const [xb, xt, zf, L, m] of [[-0.8, -1.07, -4.25, 1.8, mats.wood], [-0.82, -1.07, -4.6, 1.6, mats.alu], [3.77, 3.95, -5.2, 1.6, mats.alu]]) if (peelSide('pá-forno', xb, xt, zf, L, m)) nPeel++;

  // ═════ 6) parede direita: quadro de avisos, relógio (hora simulada), termo-higrômetro, luvas em ganchos ═════
  const XR = X1;
  const wallR = (y, z) => M(XR - 0.001, y, z, -Math.PI / 2); // +z local → −x mundo
  const boardSpot = place('quadro-avisos', [0.05, 0.66, 0.96], [[XR - 0.025, -0.6, 0, 2.12], [XR - 0.025, -0.45, 0, 2.12], [XR - 0.025, 3.0, 0, 2.15]], (b, sp) => {
    const base = wallR(sp[3] + 0.33, sp[1]);
    B.add(box(0.96, 0.66, 0.02), mats.alu, mul(base, M(0, 0, 0.01)));
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: T.boardTex(), roughness: 0.85 }));
    pl.applyMatrix4(mul(base, M(0, 0, 0.0215))); pl.receiveShadow = true; root.add(pl);
  }, { ignoreKeepout: true, shadow: false });
  let clockHands = null;
  {
    const z = -2.45, y = 2.27; // acima da placa 'uso obrigatório de luvas' (EQUIPAMENTOS)
    const why = isFree(aabb(XR - 0.03, y - 0.19, z, 0, 0.06, 0.38, 0.38), { ignoreKeepout: true });
    if (!why) {
      const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(wallR(y, z)); root.add(g);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 10, 48), mats.black); ring.position.z = 0.03; g.add(ring);
      const back = new THREE.Mesh(cyl(0.175, 0.03, 40), mats.black); back.rotation.x = Math.PI / 2; back.position.z = 0.015; g.add(back);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.165, 48), new THREE.MeshStandardMaterial({ map: T.clockTex(), roughness: 0.5 })); face.position.z = 0.031; g.add(face);
      const glass = new THREE.Mesh(new THREE.CircleGeometry(0.168, 48), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false }));
      glass.position.z = 0.044; g.add(glass);
      const hand = (len, w, mat, zz) => { const p = new THREE.Group(); const h = new THREE.Mesh(box(w, len, 0.003), mat); h.position.y = len / 2 - 0.02; p.add(h); p.position.z = zz; g.add(p); return p; };
      const red = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.4 });
      clockHands = { h: hand(0.1, 0.012, mats.black, 0.034), m: hand(0.145, 0.008, mats.black, 0.037), s: hand(0.15, 0.003, red, 0.04) };
      const hub = new THREE.Mesh(cyl(0.008, 0.012, 12), red); hub.rotation.x = Math.PI / 2; hub.position.z = 0.041; g.add(hub);
      placed.push({ name: 'relógio', box: aabb(XR - 0.03, y - 0.19, z, 0, 0.06, 0.38, 0.38) });
    } else rejected.push({ name: 'relógio', at: [XR, z], why });
  }
  const thermo = T.makeThermoCanvas(); let thermoPos = null;
  place('termo-higrometro', [0.04, 0.12, 0.16], [[XR - 0.02, -1.95, 0, 1.48], [XR - 0.02, -1.4, 0, 1.48], [XR - 0.02, 0.2, 0, 1.55]], (b, sp) => {
    const base = wallR(sp[3] + 0.06, sp[1]);
    B.add(rbox(0.15, 0.115, 0.026, 0.006), mats.plasticW, mul(base, M(0, 0, 0.013)));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.094), new THREE.MeshStandardMaterial({ map: thermo.tex, roughness: 0.3 }));
    s.applyMatrix4(mul(base, M(0, 0, 0.0265))); root.add(s);
    thermoPos = new THREE.Vector3(XR - 0.3, sp[3] + 0.06, sp[1]);
  }, { ignoreKeepout: true, shadow: false });
  // luvas térmicas e pano em ganchos (acima da mesa de inox junto ao forno 1)
  function hookRail(base, n, withCloth) {
    B.add(box(0.06 + n * 0.11, 0.03, 0.012), mats.steel, mul(base, M(0, 0, 0.006)));
    for (let i = 0; i < n; i++) {
      const hx = -((n - 1) * 0.11) / 2 + i * 0.11;
      B.add(cyl(0.005, 0.06, 8), mats.steel, mul(base, M(hx, 0.0, 0.035, 0, Math.PI / 2 - 0.3)), { cast: false });
      if (i < n - (withCloth ? 1 : 0)) B.add(gloveGeo(), mats.glove, mul(base, M(hx, -0.34, 0.06, rr(-0.25, 0.25), rr(-0.08, 0.05), rr(-0.06, 0.06))));
      else B.add(hangingClothGeo(0.36, 0.3, 3), mats.clothB, mul(base, M(hx, 0.0, 0.065, 0.1)));
    }
  }
  place('ganchos-luvas', [0.16, 0.7, 0.42], [[XR - 0.08, -2.45, 0, 0.82], [XR - 0.08, -2.4, 0, 0.82], [XR - 0.08, 0.15, 0, 0.9]], (b, sp) => hookRail(wallR(sp[3] + 0.62, sp[1]), 3, true), { ignoreKeepout: true, shadow: false });

  // ═════ 7) lavatório de mãos inox + dispensers (sabonete, álcool 70 %, papel toalha) ═════
  function handSink(z) {
    const base = wallR(0, z), bw = 0.5, bd = 0.4, by = 0.86;
    B.add(box(bw, 0.012, bd), mats.steel, mul(base, M(0, by - 0.16, bd / 2)));
    for (const [w, d, x, zz] of [[bw, 0.012, 0, bd], [0.012, bd, -bw / 2, bd / 2], [0.012, bd, bw / 2, bd / 2]]) B.add(box(w, 0.17, d), mats.steel, mul(base, M(x, by - 0.075, zz)));
    B.add(box(bw, 0.3, 0.012), mats.steel, mul(base, M(0, by + 0.07, 0.006)));
    B.add(box(bw + 0.02, 0.012, 0.03), mats.steel, mul(base, M(0, by + 0.005, bd)));
    B.add(cyl(0.02, 0.006, 16), mats.black, mul(base, M(0, by - 0.152, bd / 2)), { cast: false });
    const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, by + 0.12, 0.02], [0, by + 0.3, 0.05], [0, by + 0.32, 0.16], [0, by + 0.2, 0.22]].map((p) => new THREE.Vector3(...p))), 24, 0.011, 10);
    B.add(neck, mats.alu, base); B.add(box(0.06, 0.08, 0.04), mats.alu, mul(base, M(0, by + 0.12, 0.02)));
    B.add(cyl(0.02, 0.35, 12), mats.alu, mul(base, M(0, by - 0.33, bd / 2)));
    B.add(box(0.07, 0.04, 0.012), mats.alu, mul(base, M(0.12, 0.45, 0.006))); B.add(box(0.03, 0.14, 0.03), mats.alu, mul(base, M(0.12, 0.4, 0.03))); // válvula de joelho
    const disp = (x, y, w, h, d) => B.add(rbox(w, h, d, 0.012), mats.plasticW, mul(base, M(x, y, d / 2 + 0.002)));
    disp(-0.42, 1.35, 0.28, 0.34, 0.13); B.add(box(0.2, 0.012, 0.01), mats.black, mul(base, M(-0.42, 1.19, 0.12)));
    disp(0.0, 1.3, 0.11, 0.22, 0.1); B.add(box(0.05, 0.05, 0.004), mats.socketBlue, mul(base, M(0, 1.33, 0.102)));
    disp(0.2, 1.3, 0.11, 0.22, 0.1); B.add(box(0.05, 0.05, 0.004), mats.lidYel, mul(base, M(0.2, 1.33, 0.102)));
    B.add(box(0.03, 0.02, 0.03), mats.black, mul(base, M(0, 1.18, 0.09))); B.add(box(0.03, 0.02, 0.03), mats.black, mul(base, M(0.2, 1.18, 0.09)));
  }
  place('lavatorio', [0.45, 1.55, 0.78], [[XR - 0.225, 4.15, 0], [XR - 0.225, 4.0, 0], [XR - 0.225, -0.2, 0]], (b, sp) => handSink(sp[1]), { ignoreKeepout: true, ao: 0.3 });

  // ═════ 8) eletrocalha perfurada com cabos (desvia de dutos/tubos) + descidas para masseira/divisora/armário ═════
  const trayY = 3.32;
  function trayRun(axis, fixed, a0, a1, y) {
    const step = 0.06, runs = []; let start = null;
    for (let a = a0; a <= a1 + 1e-6; a += step) {
      const bx = axis === 'x' ? new THREE.Box3(new THREE.Vector3(a - step / 2, y - 0.03, fixed - 0.13), new THREE.Vector3(a + step / 2, y + 0.09, fixed + 0.13))
        : new THREE.Box3(new THREE.Vector3(fixed - 0.13, y - 0.03, a - step / 2), new THREE.Vector3(fixed + 0.13, y + 0.09, a + step / 2));
      const free = !gridHit(bx);
      if (free && start == null) start = a;
      if ((!free || a + step > a1 + 1e-6) && start != null) { const e = free ? a : a - step; if (e - start > 0.6) runs.push([start, e]); start = null; }
    }
    for (const [s, e] of runs) addCableTray(B, mats, axis === 'x' ? M((s + e) / 2, y, fixed, 0) : M(fixed, y, (s + e) / 2, Math.PI / 2), e - s);
    return runs.map(([s, e]) => [+s.toFixed(2), +e.toFixed(2)]);
  }
  const backRuns = trayRun('x', Z0 + 0.15, X0 + 0.15, X1 - 0.15, trayY);
  const rightRuns = trayRun('z', X1 - 0.15, Z0 + 0.3, Z1 - 0.3, trayY);
  for (const x of [-6.75, -5.45, -4.15]) {
    if (!backRuns.some(([s, e]) => x > s && x < e)) continue;
    const bx = new THREE.Box3(new THREE.Vector3(x - 0.08, 1.5, Z0), new THREE.Vector3(x + 0.08, trayY - 0.02, Z0 + 0.1));
    if (gridHit(bx)) continue;
    B.add(cyl(0.013, trayY - 1.62, 10), mats.conduit, M(x, (trayY + 1.62) / 2, Z0 + 0.035), { cast: false });
    for (let y = 1.9; y < trayY; y += 0.7) B.add(box(0.04, 0.012, 0.03), mats.galv, M(x, y, Z0 + 0.018), { cast: false });
    B.add(rbox(0.14, 0.14, 0.07, 0.008), mats.socketBody, M(x, 1.55, Z0 + 0.035));
  }

  // ═════ 9) piso: pó de farinha (manchas suaves), pegadas, marcas de rodízio, migalhas, sombras de contato ═════
  // sombra de contato do que os outros donos apoiaram no piso (voxels da 1ª camada)
  const lowCells = [];
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) { const v = grid[gi(i, 0, k)] | grid[gi(i, 1, k)]; if (v & 2) lowCells.push([X0 + (i + 0.5) * VC, Z0 + (k + 0.5) * VC]); }
  const floorMesh = buildFloorOverlay({ flourSpots, floorShadows, lowCells, VC });
  root.add(floorMesh);

  B.build(root, 'props');
  // sombras projetadas desligadas nos meus itens: o passe de sombra com as variantes de MeshDepthMaterial dos lotes gerava
  // VALIDATE_STATUS false no ANGLE/Metal; o contato com o piso vem das sombras pintadas na sobreposição + SSAO.
  if (QS.get('propshadow') === '0') root.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  // ───────────── ambiente ativo + atualização ─────────────
  const envOk = (id) => (id ?? 'fornos') === 'fornos';
  root.visible = envOk(app?.state?.env);
  app?.on?.('env', (id) => { root.visible = envOk(id); });
  let accT = 1;
  function update(dt, t) {
    if (!root.visible) return;
    const sec = app?.state?.clock ?? 0;
    if (clockHands) {
      const s = sec % 60, m = (sec / 60) % 60, h = (sec / 3600) % 12;
      clockHands.s.rotation.z = -(Math.floor(s) / 60) * Math.PI * 2; clockHands.m.rotation.z = -(m / 60) * Math.PI * 2; clockHands.h.rotation.z = -(h / 12) * Math.PI * 2;
    }
    cold?.update(dt, t);
    accT += dt;
    if (accT > 1 && thermoPos && app?.field?.at) {
      accT = 0;
      try { const f = app.field.at(thermoPos); const rh = f.rh <= 1.5 ? f.rh * 100 : f.rh; if (Number.isFinite(f.ta) && Number.isFinite(rh)) thermo.draw(f.ta, rh); } catch { /* campo indisponível */ }
    }
  }

  const info = { placed: placed.map((p) => p.name), rejected, peels: nPeel, tris: Math.round(B.tris), ms: Math.round(performance.now() - t0), backRuns, rightRuns };
  window.__props = info;
  if (QS.get('propsdbg') === '1') console.info('[props]', JSON.stringify(info));
  return { group: root, update, info };
}

/** sobreposição do piso inteiro (RGBA): farinha em manchas suaves + sujeira + sombras de contato. ~5 mm/px. */
function buildFloorOverlay({ flourSpots, floorShadows, lowCells, VC }) {
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0;
  const PX = +(QS.get("floorpx") || 1024), PZ = Math.round(PX * D / W), k = PX / W;
  const [c, x] = T.cv(PX, PZ), R = T.rng(909);
  const U = (wx) => (wx - HALL.x0) * k, V = (wz) => (wz - HALL.z0) * k;
  const blob = (wx, wz, rx, rz, col, a, rot = 0) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.55, `rgba(${col},${a * 0.45})`); g.addColorStop(1, `rgba(${col},0)`); x.save(); x.translate(U(wx), V(wz)); x.rotate(rot); x.scale(rx * k, rz * k); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); };
  const FL = '246,243,235', DK = '30,24,18';

  // sombras de contato: pés/bases dos equipamentos (voxels) e dos meus itens
  // (sem filtros de canvas: milhares de desenhos com blur sobrecarregavam a GPU) — máscara 1 px/voxel ampliada com suavização
  if (lowCells.length) {
    const NXc = Math.ceil(W / VC), NZc = Math.ceil(D / VC), [mc, mx] = T.cv(NXc, NZc), id = mx.createImageData(NXc, NZc);
    for (const [wx, wz] of lowCells) { const i = Math.floor((wx - HALL.x0) / VC), kk = Math.floor((wz - HALL.z0) / VC); const o = (kk * NXc + i) * 4; id.data[o] = 30; id.data[o + 1] = 24; id.data[o + 2] = 18; id.data[o + 3] = 30; }
    mx.putImageData(id, 0, 0); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    for (const [ox, oz] of [[0, 0], [-0.03, 0], [0.03, 0], [0, -0.03], [0, 0.03]]) x.drawImage(mc, U(HALL.x0 + ox), V(HALL.z0 + oz), W * k, D * k);
  }
  for (const [wx, wz, w, d, ry, s] of floorShadows) {
    x.save(); x.translate(U(wx), V(wz)); x.rotate(-ry);
    for (let i = 0; i < 4; i++) { const grow = 0.01 + i * 0.03; x.fillStyle = `rgba(${DK},${s * 0.13})`; x.fillRect(-(w / 2 + grow) * k, -(d / 2 + grow) * k, (w + 2 * grow) * k, (d + 2 * grow) * k); }
    x.restore();
  }
  // sujeira/pó acumulados no encontro piso-parede (faixas longas e suaves)
  for (let i = 0; i < 260; i++) {
    const side = Math.floor(R() * 4); let wx, wz;
    if (side === 0) { wx = HALL.x0 + R() * W; wz = HALL.z0 + 0.04 + R() * 0.05; } else if (side === 1) { wx = HALL.x0 + R() * W; wz = HALL.z1 - 0.04 - R() * 0.05; }
    else if (side === 2) { wx = HALL.x0 + 0.04 + R() * 0.05; wz = HALL.z0 + R() * D; } else { wx = HALL.x1 - 0.04 - R() * 0.05; wz = HALL.z0 + R() * D; }
    const along = side < 2; const l = 0.25 + R() * 0.7;
    blob(wx, wz, along ? l : 0.06, along ? 0.06 : l, R() < 0.55 ? FL : DK, 0.05 + R() * 0.07);
  }
  // farinha: véu largo + manchas médias (sem pontilhado) — bancada (lado da forneira), masseira/divisora, pallets
  const veil = (cx, cz, rx, rz, n, a) => { blob(cx, cz, rx * 1.2, rz * 1.2, FL, a * 0.8); for (let i = 0; i < n; i++) { const t = R() * 6.28, r = Math.sqrt(R()); blob(cx + Math.cos(t) * r * rx, cz + Math.sin(t) * r * rz, 0.15 + R() * 0.45, 0.1 + R() * 0.3, FL, a * (0.5 + R() * 0.8) * (1 - r * 0.6), R() * 3); } };
  const bx = BENCH.pos[0], bz = BENCH.pos[2];
  veil(bx, bz + 0.45, BENCH.w * 0.6, 0.65, 40, 0.11);
  veil(bx, bz - 0.1, BENCH.w * 0.55, 0.35, 14, 0.07); // sob a bancada
  veil(-5.45, -4.45, 0.9, 0.55, 26, 0.12);            // diante da masseira (EQUIPAMENTOS: x −5,45)
  veil(-6.75, -4.75, 0.6, 0.45, 16, 0.09);            // diante da divisora (EQUIPAMENTOS: x −6,75)
  for (const [fx, fz, r0] of flourSpots) { veil(fx, fz, r0, r0 * 0.8, 22, 0.1); for (let i = 0; i < 4; i++) blob(fx + (R() - 0.5) * 0.8, fz + (R() - 0.5) * 1.2, 0.06 + R() * 0.07, 0.05 + R() * 0.05, FL, 0.35, R() * 3); }
  // pegadas enfarinhadas (bancada → forno 1; bancada → mesa), esmaecendo
  function footprints(a, b, n0 = 0.18) {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx); const n = Math.floor(L / 0.33);
    for (let i = 1; i < n; i++) {
      const t = i / n, side = i % 2 ? 1 : -1, wx = a[0] + dx * t - Math.sin(ang) * side * 0.09, wz = a[2] + dz * t + Math.cos(ang) * side * 0.09;
      const al = n0 * Math.pow(1 - t, 1.4); if (al < 0.02) continue;
      x.save(); x.translate(U(wx), V(wz)); x.rotate(ang + (R() - 0.5) * 0.15);
      x.fillStyle = `rgba(${FL},${al})`; x.beginPath(); x.ellipse(0.06 * k, 0, 0.075 * k, 0.043 * k, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(-0.09 * k, 0, 0.043 * k, 0.036 * k, 0, 0, 7); x.fill();
      x.restore();
    }
  }
  footprints(STATIONS.bancada.worker, STATIONS.forno.worker, 0.2);
  footprints([BENCH.pos[0] - 0.5, 0, -1.1], [2.2, 0, 0.6], 0.14);
  // marcas de rodízio (borracha) — carrinhos indo e voltando dos fornos
  function tracks(p0, p1, p2, gauge, a) {
    x.lineCap = 'round';
    for (const s of [-1, 1]) for (let rep = 0; rep < 3; rep++) {
      const j = (R() - 0.5) * 0.06; x.strokeStyle = `rgba(${DK},${a * (0.5 + R() * 0.5)})`; x.lineWidth = 0.02 * k; x.beginPath();
      const off = (p) => [p[0] + s * gauge / 2 + j, p[1] + j * 0.5]; const q0 = off(p0), q1 = off(p1), q2 = off(p2);
      x.moveTo(U(q0[0]), V(q0[1])); x.quadraticCurveTo(U(q1[0]), V(q1[1]), U(q2[0]), V(q2[1])); x.stroke();
    }
  }
  for (const o of OVENS) {
    const fz = ovenFrontZ(o), cx = o.x + o.doors[0].cx;
    tracks([cx, fz + 0.1], [cx + 0.1, fz + 1.0], [cx + 0.9 * (cx < 3 ? -1 : 1), fz + 2.2], o.kind === 'rotativo' ? 0.62 : 0.5, o.kind === 'rotativo' ? 0.09 : 0.045);
  }
  // manchas d'água secas perto do lavatório
  for (let i = 0; i < 10; i++) { const wx = HALL.x1 - 0.35 - R() * 0.6, wz = 4.15 + (R() - 0.5) * 0.9; x.strokeStyle = `rgba(${DK},${0.04 + R() * 0.05})`; x.lineWidth = 1; x.beginPath(); x.ellipse(U(wx), V(wz), (0.03 + R() * 0.1) * k, (0.02 + R() * 0.07) * k, R() * 3, 0, 7); x.stroke(); }

  const t = T.tex(c, { aniso: 8 });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.name = 'floorOverlay';
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m);
  pl.rotation.x = -Math.PI / 2; pl.position.set((HALL.x0 + HALL.x1) / 2, 0.003, (HALL.z0 + HALL.z1) / 2);
  pl.receiveShadow = true; pl.renderOrder = 1; pl.name = 'props:floorOverlay'; pl.userData.noAO = true;
  return pl;
}
