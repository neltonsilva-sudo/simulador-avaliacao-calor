// AMBIENTAÇÃO (realismo da sala de fornos) — dono: AMBIENTAÇÃO.
// Insumos, estantes, utensílios, pó de farinha/marcas no piso, manchas de calor nas frentes dos fornos, eletrocalhas,
// tomadas 3P+T, quadro de avisos, relógio (hora da simulação), termo-higrômetro (campo térmico), lavatório e dispensers.
// Tudo procedural e em lote (poucas chamadas de desenho). Desvia automaticamente do que CENÁRIO/EQUIPAMENTOS construíram
// (caixas dos objetos deles), mantém livres os pontos das estações, os caminhos entre elas e 1,2 m diante dos fornos.
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { HALL, OVENS, ovenFrontZ, STATIONS, BENCH, TABLE, FAN } from './layout.js';
import * as T from './props_tex.js';
import {
  Batch, M, mul, box, rbox, cyl, bagGeo, bucketGeos, crateGeos, trayGeo, peelGeos, gloveGeo, foldedClothGeo, hangingClothGeo,
  addRack, addWallShelf, addPallet, addPlasticPallet, addPlatformCart, addCableTray, addSocket,
} from './props_geo.js';

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
    scraper: std({ color: 0xe9e3c8, roughness: 0.35, transparent: false }, 'scraper'),
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
  const mats = makeMats();
  const B = new Batch();
  const R = T.rng(2026);
  const rr = (a, b) => a + R() * (b - a);
  const X0 = HALL.x0, X1 = HALL.x1, Z0 = HALL.z0, Z1 = HALL.z1;

  // ───────────── obstáculos dos outros donos (caixas dos objetos) ─────────────
  const obstacles = [], machMeshes = [];
  const _b = new THREE.Box3(), _m4 = new THREE.Matrix4();
  function collect(group, tag) {
    if (!group) return;
    group.updateWorldMatrix(true, true);
    group.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      const mt = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mt && mt.transparent && !mt.depthWrite) return; // efeitos (vapor, ar quente)
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const push = (bx) => {
        const s = bx.getSize(new THREE.Vector3());
        const big = (s.x > 5 ? 1 : 0) + (s.y > 3.5 ? 1 : 0) + (s.z > 5 ? 1 : 0);
        if (big >= 2) return;                        // piso, paredes, teto
        if (bx.max.y < 0.16 && Math.max(s.x, s.z) > 3) return; // rodapé sanitário / ralos lineares
        if (bx.min.y > 3.6) return;
        obstacles.push({ box: bx.clone(), tag, name: o.name || o.parent?.name || '' });
      };
      if (o.isInstancedMesh) {
        const n = Math.min(o.count, 400);
        for (let i = 0; i < n; i++) { o.getMatrixAt(i, _m4); _b.copy(o.geometry.boundingBox).applyMatrix4(_m4).applyMatrix4(o.matrixWorld); push(_b); }
      } else { _b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); push(_b); if (tag === 'mach') machMeshes.push(o); }
    });
  }
  collect(app.machines?.group, 'mach'); collect(app.hall?.group, 'hall'); collect(app.kit?.group, 'kit');
  const machGroup = app.machines?.group;

  // zonas que devem ficar livres
  const circles = [];
  for (const s of Object.values(STATIONS)) { circles.push([s.worker[0], s.worker[2], 0.55]); circles.push([s.tripod[0], s.tripod[2], 0.55]); }
  circles.push([TABLE.pos[0], TABLE.pos[2], 1.0], [FAN.pos[0], FAN.pos[2], 0.5]);
  for (const v of Object.values(stage.views || {})) if (v?.pos && v.pos[1] < 2.6) circles.push([v.pos[0], v.pos[2], 0.6]);
  const segs = [];
  const S = STATIONS;
  const seg = (a, b, r = 0.55) => segs.push([a[0], a[2], b[0], b[2], r]);
  seg(S.forno.worker, S.bancada.worker); seg(S.bancada.worker, S.descanso.worker); seg(S.forno.tripod, S.bancada.tripod);
  for (const s of Object.values(S)) seg(TABLE.pos, s.tripod, 0.45);
  const rects = OVENS.map((o) => [o.x - o.w / 2 - 0.05, ovenFrontZ(o), o.x + o.w / 2 + 0.05, ovenFrontZ(o) + 1.2]);
  const placed = [], rejected = [];

  function rectDist(b, x, z) { const dx = Math.max(b.min.x - x, 0, x - b.max.x), dz = Math.max(b.min.z - z, 0, z - b.max.z); return Math.hypot(dx, dz); }
  function segDist(b, s) { // distância (aprox.) do retângulo ao segmento: amostrada
    let d = 1e9; const n = Math.max(2, Math.ceil(Math.hypot(s[2] - s[0], s[3] - s[1]) / 0.1));
    for (let i = 0; i <= n; i++) { const t = i / n; d = Math.min(d, rectDist(b, s[0] + (s[2] - s[0]) * t, s[1] + (s[3] - s[1]) * t)); }
    return d;
  }
  function isFree(bx, { ignoreKeepout = false, ignoreHall = false } = {}) {
    if (bx.min.x < X0 + 0.005 || bx.max.x > X1 - 0.005 || bx.min.z < Z0 + 0.005 || bx.max.z > Z1 - 0.005) return 'parede';
    const sh = bx.clone().expandByScalar(-0.004);
    for (const o of obstacles) { if (ignoreHall && o.tag === 'hall') continue; if (o.box.intersectsBox(sh)) return 'obst:' + o.tag + ':' + o.name; }
    for (const p of placed) if (p.box.intersectsBox(sh)) return 'prop:' + p.name;
    if (ignoreKeepout) return null;
    if (bx.min.y > 2.1) return null; // acima da cabeça
    for (const [x, z, r] of circles) if (rectDist(bx, x, z) < r) return 'livre';
    for (const s of segs) if (segDist(bx, s) < s[4]) return 'caminho';
    for (const [a, b, c, d] of rects) if (bx.max.x > a && bx.min.x < c && bx.max.z > b && bx.min.z < d) return 'frente-forno';
    return null;
  }
  // caixa (mundo) de um volume local w×h×d com base em (x,y,z), girado ry
  function aabb(x, y, z, ry, w, h, d) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)); const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
    return new THREE.Box3(new THREE.Vector3(x - hw, y, z - hd), new THREE.Vector3(x + hw, y + h, z + hd));
  }
  const floorShadows = []; // [x, z, w, d, ry, força]
  /** tenta os lugares em ordem; o primeiro livre recebe o item */
  function place(name, size, spots, build, opt = {}) {
    for (const sp of spots) {
      const [x, z, ry = 0, y = 0] = sp; const bx = aabb(x, y, z, ry, ...size);
      const why = isFree(bx, opt);
      if (!why) {
        build(M(x, y, z, ry), sp); placed.push({ name, box: bx });
        if (y < 0.05 && opt.shadow !== false) floorShadows.push([x, z, size[0], size[2], ry, opt.ao ?? 0.55]);
        return sp;
      }
      rejected.push({ name, at: [x, z], why });
    }
    return null;
  }

  // ───────────── construtores de itens ─────────────
  const BAG = [0.62, 0.13, 0.40];
  const bagG = [1, 2, 3, 4].map((s) => bagGeo(s));
  function bagStack(base, layers = 6, { missing = 0, variant = 0 } = {}) {
    // 5 sacos por camada: 3 transversais (0,40 × 0,62) + 2 longitudinais (0,62 × 0,40); camadas espelhadas (amarração)
    let n = 0; const total = layers * 5 - missing;
    for (let L = 0; L < layers; L++) {
      const f = L % 2 ? -1 : 1, y = 0.153 + L * 0.118 + 0.062;
      const spots = [[-0.4, -0.19 * f, Math.PI / 2], [0, -0.19 * f, Math.PI / 2], [0.4, -0.19 * f, Math.PI / 2], [-0.31, 0.32 * f, 0], [0.31, 0.32 * f, 0]];
      for (const [a, b, r] of spots) {
        if (n >= total) return; n++;
        B.add(bagG[(n + L) % 4], mats.bag[variant], mul(base, M(a + rr(-0.012, 0.012), y, b + rr(-0.012, 0.012), r + rr(-0.035, 0.035), rr(-0.012, 0.012), rr(-0.012, 0.012))));
      }
    }
  }
  function bucket(base, kind = 0, lid = 'lidRed', withLid = true) {
    const g = bucketGeos(); B.add(g.body, mats.bucket[kind], base); if (withLid) B.add(g.lid, mats[lid], base); B.add(g.handle, mats.galv, base, { cast: false });
  }
  function crate(base, col = 0) { const g = crateGeos(), c = mats.crate[col]; B.add(g.sides, c.side, base); B.add(g.bottom, c.bottom, base); B.add(g.rim, c.rim, base); }
  function cardBox(base, w, h, d, k = 0) { B.add(rbox(w, h, d, 0.004), mats.card[k], mul(base, M(0, h / 2, 0))); }
  function trayStack(base, n, mat, { perf = false, jitter = 0.006, pitch = 0.0085 } = {}) {
    const g = trayGeo(0.6, 0.4, perf ? 0.012 : 0.024, perf);
    for (let i = 0; i < n; i++) B.add(g, mat, mul(base, M(rr(-jitter, jitter), i * pitch, rr(-jitter, jitter), rr(-0.015, 0.015))), { cast: i === n - 1 || i === 0 });
  }
  function clothStack(base, n, mat) { for (let i = 0; i < n; i++) B.add(foldedClothGeo(i + 1), mat, mul(base, M(rr(-0.01, 0.01), 0.011 + i * 0.02, rr(-0.01, 0.01), rr(-0.08, 0.08)))); }

  // ═════════════ 1) parede do fundo à esquerda dos fornos: estantes de insumos + pallet de farinha ═════════════
  const zb = Z0 + 0.27; // estante encostada (prof. 0,5)
  function insumoRack(base, variant) {
    addRack(B, mats, base, { w: 1.5, d: 0.5, h: 1.82, levels: [0.16, 0.6, 1.04, 1.48] });
    if (variant === 0) {
      for (let i = 0; i < 4; i++) bucket(mul(base, M(-0.55 + i * 0.34, 0.166, rr(-0.04, 0.04), rr(0, 6))), i % 3, ['lidRed', 'lidBlue', 'lidYel'][i % 3]);
      bucket(mul(base, M(-0.38, 0.166 + 0.38, 0.02, 1.2)), 0, 'lidRed');
      for (let i = 0; i < 3; i++) cardBox(mul(base, M(-0.1 + i * 0.32, 0.606, rr(-0.05, 0.05), rr(-0.08, 0.08))), 0.3, 0.24, 0.38, 1);
      cardBox(mul(base, M(0.06, 0.606 + 0.24, 0, 0.1)), 0.3, 0.2, 0.36, 1);
      crate(mul(base, M(-0.38, 1.046, 0, 0)), 0); crate(mul(base, M(0.36, 1.046, 0, 0.02)), 0); crate(mul(base, M(0.36, 1.046 + 0.282, 0, -0.03)), 1);
      trayStack(mul(base, M(-0.36, 1.486, 0)), 14, mats.trayBlack); trayStack(mul(base, M(0.36, 1.486, 0)), 9, mats.trayAlu);
    } else {
      trayStack(mul(base, M(-0.36, 0.166, 0)), 30, mats.trayPerf, { perf: true, pitch: 0.011 }); trayStack(mul(base, M(0.36, 0.166, 0)), 24, mats.trayPerf, { perf: true, pitch: 0.011 });
      trayStack(mul(base, M(-0.36, 0.606, 0)), 18, mats.trayAlu); trayStack(mul(base, M(0.36, 0.606, 0)), 22, mats.trayBlack);
      clothStack(mul(base, M(-0.5, 1.046, 0.02)), 6, mats.clothB); clothStack(mul(base, M(-0.2, 1.046, -0.02)), 5, mats.clothR);
      cardBox(mul(base, M(0.35, 1.046, 0, 0.05)), 0.42, 0.26, 0.34, 2);
      crate(mul(base, M(-0.36, 1.486, 0)), 1); crate(mul(base, M(0.36, 1.486, 0, 0.03)), 0);
    }
  }
  place('estante-insumos', [1.5, 1.85, 0.5], [[-7.15, zb, 0], [-5.55, zb, 0], [X0 + 0.27, -4.6, Math.PI / 2], [X0 + 0.27, -1.2, Math.PI / 2]], (b) => insumoRack(b, 0));
  place('estante-formas', [1.5, 1.85, 0.5], [[-5.55, zb, 0], [-3.95, zb, 0], [X0 + 0.27, -2.9, Math.PI / 2], [X0 + 0.27, 0.6, Math.PI / 2]], (b) => insumoRack(b, 1));
  // pallet de farinha (sacos de 25 kg, faltam alguns: em uso)
  const flourSpots = [];
  const fp = place('pallet-farinha', [1.22, 0.9, 1.02], [[-3.95, Z0 + 0.6, 0], [X0 + 0.62, -2.3, Math.PI / 2], [X0 + 0.62, -0.6, Math.PI / 2], [-7.2, -3.6, 0], [-5.6, -3.6, 0]], (b) => {
    addPlasticPallet(B, mats, b); bagStack(b, 6, { missing: 3 });
  }, { ao: 0.7 });
  if (fp) flourSpots.push([fp[0], fp[1], 1.0]);
  const fp2 = place('pallet-farinha-2', [1.22, 0.65, 1.02], [[X0 + 0.62, -1.0, Math.PI / 2], [X0 + 0.62, 0.3, Math.PI / 2], [-5.5, -3.7, 0], [-2.4, 5.3, 0]], (b) => {
    addPlasticPallet(B, mats, b); bagStack(b, 4, { missing: 1, variant: 1 });
  }, { ao: 0.7 });
  if (fp2) flourSpots.push([fp2[0], fp2[1], 0.9]);

  // ═════════════ 2) pás de forno no vão entre o rotativo e o lastro / junto ao lastro de 4 câmaras ═════════════
  function peels(x0, n, L, label) {
    const g = peelGeos(L);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i - (n - 1) / 2) * 0.12, tilt = 0.14 + i * 0.02, zf = Z0 + 0.05 + (L + 0.42) * Math.sin(tilt);
      const bx = new THREE.Box3(new THREE.Vector3(x - 0.18, 0, Z0 + 0.02), new THREE.Vector3(x + 0.18, L + 0.42, zf + 0.04));
      if (isFree(bx, { ignoreKeepout: true })) { rejected.push({ name: label, at: [x, zf], why: isFree(bx, { ignoreKeepout: true }) }); continue; }
      // lâmina para cima apoiada na parede, ponta do cabo no piso
      const bm = M(x, 0, zf, rr(-0.15, 0.15), -tilt);
      const inv = mul(bm, M(0, L + 0.42, 0, 0, 0, Math.PI));
      B.add(g.blade, i % 2 ? mats.wood : mats.alu, inv); B.add(g.handle, mats.alu, inv); B.add(g.cap, mats.black, inv);
      placed.push({ name: label, box: bx }); floorShadows.push([x, zf - 0.02, 0.08, 0.08, 0, 0.5]);
    }
  }
  peels(-0.9, 3, 2.2, 'pás-lastro');
  peels(6.15, 2, 1.8, 'pás-lastro4');

  // ═════════════ 3) parede direita (azulejo): quadro de avisos, relógio, prateleiras, lavatório, tomadas ═════════════
  const XR = X1; // plano da parede
  const wallR = (y, z) => M(XR - 0.001, y, z, -Math.PI / 2); // +z local → −x mundo
  // quadro de avisos 0,9 × 0,6
  const boardSpot = place('quadro-avisos', [0.06, 0.66, 0.96], [[XR - 0.03, -1.15, 0, 1.25], [XR - 0.03, 0.2, 0, 1.25]], (b, sp) => {
    const base = wallR(sp[3] + 0.33, sp[1]);
    B.add(box(0.96, 0.66, 0.02), mats.alu, mul(base, M(0, 0, 0.01)));
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: T.boardTex(), roughness: 0.85 }));
    pl.applyMatrix4(mul(base, M(0, 0, 0.0215))); pl.receiveShadow = true; root.add(pl);
  }, { ignoreKeepout: true, shadow: false });
  // relógio de parede (hora da simulação)
  let clockHands = null;
  {
    const z = boardSpot ? boardSpot[1] : -1.15, base = wallR(2.7, z);
    const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.copy(base); root.add(g);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 10, 48), mats.black); ring.position.z = 0.03; g.add(ring);
    const back = new THREE.Mesh(cyl(0.175, 0.03, 40), mats.black); back.rotation.x = Math.PI / 2; back.position.z = 0.015; g.add(back);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.165, 48), new THREE.MeshStandardMaterial({ map: T.clockTex(), roughness: 0.5 })); face.position.z = 0.031; g.add(face);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.168, 48), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.5 }));
    glass.position.z = 0.044; g.add(glass);
    const hand = (len, w, mat, z) => { const p = new THREE.Group(); const h = new THREE.Mesh(box(w, len, 0.003), mat); h.position.y = len / 2 - 0.02; p.add(h); p.position.z = z; g.add(p); return p; };
    const red = new THREE.MeshStandardMaterial({ color: 0xc81e1e, roughness: 0.4 });
    clockHands = { h: hand(0.1, 0.012, mats.black, 0.034), m: hand(0.145, 0.008, mats.black, 0.037), s: hand(0.15, 0.003, red, 0.04) };
    const hub = new THREE.Mesh(cyl(0.008, 0.012, 12), red); hub.rotation.x = Math.PI / 2; hub.position.z = 0.041; g.add(hub);
  }
  // termo-higrômetro digital (lê o campo térmico do modelo)
  const thermo = T.makeThermoCanvas(); let thermoPos = null;
  place('termo-higrometro', [0.04, 0.12, 0.16], [[XR - 0.02, -2.55, 0, 1.55], [XR - 0.02, -2.1, 0, 1.55]], (b, sp) => {
    const base = wallR(sp[3] + 0.06, sp[1]);
    B.add(rbox(0.15, 0.115, 0.026, 0.006), mats.plasticW, mul(base, M(0, 0, 0.013)));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.125, 0.094), new THREE.MeshStandardMaterial({ map: thermo.tex, roughness: 0.3, emissive: 0x000000 }));
    s.applyMatrix4(mul(base, M(0, 0, 0.0265))); root.add(s);
    thermoPos = new THREE.Vector3(XR - 0.3, sp[3] + 0.06, sp[1]);
  }, { ignoreKeepout: true, shadow: false });
  // prateleiras de parede inox (2 níveis) com insumos leves
  function wallShelves(z0, w = 1.2) {
    for (const [y, lvl] of [[1.5, 0], [1.9, 1]]) {
      const base = wallR(y, z0);
      addWallShelf(B, mats, base, { w, d: 0.35 });
      const top = (x, zz = 0.18) => mul(base, M(x, 0.006, zz));
      if (lvl === 0) {
        crate(mul(top(-0.32), M(0, 0, 0, 0, 0, 0, 0.92)), 1); bucket(top(0.18, 0.17), 2, 'lidYel'); bucket(top(0.42, 0.17), 1, 'lidBlue');
      } else {
        cardBox(top(-0.38), 0.3, 0.22, 0.28, 0); cardBox(top(-0.06), 0.28, 0.26, 0.3, 2); clothStack(top(0.25), 5, mats.clothB); clothStack(top(0.47), 4, mats.clothR);
      }
    }
  }
  place('prateleiras-parede', [0.4, 0.8, 1.24], [[XR - 0.2, 1.0, 0, 1.45], [XR - 0.2, 2.6, 0, 1.45], [XR - 0.2, -0.2, 0, 1.45]], (b, sp) => wallShelves(sp[1]), { ignoreKeepout: true, shadow: false });
  // lavatório de mãos inox + dispensers (sabonete, álcool 70 %, papel toalha)
  function handSink(z) {
    const base = wallR(0, z);
    const bw = 0.5, bd = 0.4, by = 0.86;
    B.add(box(bw, 0.012, bd), mats.steel, mul(base, M(0, by - 0.16, bd / 2)));
    for (const [w, d, x, zz] of [[bw, 0.012, 0, bd], [0.012, bd, -bw / 2, bd / 2], [0.012, bd, bw / 2, bd / 2]]) B.add(box(w, 0.17, d), mats.steel, mul(base, M(x, by - 0.075, zz)));
    B.add(box(bw, 0.3, 0.012), mats.steel, mul(base, M(0, by + 0.07, 0.006)));
    B.add(box(bw + 0.02, 0.012, 0.03), mats.steel, mul(base, M(0, by + 0.005, bd)));
    B.add(cyl(0.02, 0.006, 16), mats.black, mul(base, M(0, by - 0.152, bd / 2)), { cast: false });
    const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, by + 0.12, 0.02], [0, by + 0.3, 0.05], [0, by + 0.32, 0.16], [0, by + 0.2, 0.22]].map((p) => new THREE.Vector3(...p))), 24, 0.011, 10);
    B.add(neck, mats.alu, base); B.add(box(0.06, 0.08, 0.04), mats.alu, mul(base, M(0, by + 0.12, 0.02)));
    // sifão
    B.add(cyl(0.02, 0.35, 12), mats.alu, mul(base, M(0, by - 0.33, bd / 2))); B.add(new THREE.TorusGeometry(0.06, 0.02, 8, 16, Math.PI), mats.alu, mul(base, M(0.0, by - 0.5, bd / 2 - 0.06, Math.PI / 2, 0, Math.PI)));
    // dispensers
    const disp = (x, y, w, h, d, mat = mats.plasticW) => B.add(rbox(w, h, d, 0.012), mat, mul(base, M(x, y, d / 2 + 0.002)));
    disp(-0.42, 1.35, 0.28, 0.34, 0.13); B.add(box(0.2, 0.012, 0.01), mats.black, mul(base, M(-0.42, 1.19, 0.12)));
    disp(0.0, 1.3, 0.11, 0.22, 0.1); B.add(box(0.05, 0.05, 0.004), mats.socketBlue, mul(base, M(0, 1.33, 0.102)));
    disp(0.2, 1.3, 0.11, 0.22, 0.1); B.add(box(0.05, 0.05, 0.004), mats.lidYel, mul(base, M(0.2, 1.33, 0.102)));
    B.add(box(0.03, 0.02, 0.03), mats.black, mul(base, M(0, 1.18, 0.09))); B.add(box(0.03, 0.02, 0.03), mats.black, mul(base, M(0.2, 1.18, 0.09)));
  }
  place('lavatorio', [0.45, 1.6, 0.8], [[XR - 0.22, 2.3, 0], [XR - 0.22, 3.6, 0], [XR - 0.22, -0.2, 0]], (b, sp) => handSink(sp[1]), { ignoreKeepout: true, ao: 0.3 });

  // ═════════════ 4) luvas térmicas em ganchos + pano pendurado (vão entre lastro4 e forno1, parede do fundo) ═════════════
  function hookRail(x, y, n, withCloth) {
    const base = M(x, y, Z0 + 0.001, 0);
    B.add(box(0.06 + n * 0.11, 0.03, 0.012), mats.steel, mul(base, M(0, 0, 0.006)));
    for (let i = 0; i < n; i++) {
      const hx = -((n - 1) * 0.11) / 2 + i * 0.11;
      B.add(cyl(0.005, 0.06, 8), mats.steel, mul(base, M(hx, 0.0, 0.04, 0, Math.PI / 2 - 0.3)), { cast: false });
      if (i < n - (withCloth ? 1 : 0)) B.add(gloveGeo(), mats.glove, mul(base, M(hx, -0.34, 0.06, rr(-0.25, 0.25), rr(-0.08, 0.05), rr(-0.06, 0.06))));
      else B.add(hangingClothGeo(0.36, 0.3, 3), mats.clothB, mul(base, M(hx, 0.0, 0.07, 0.1)));
    }
  }
  {
    const x = 6.15, bx = new THREE.Box3(new THREE.Vector3(x - 0.3, 0.95, Z0), new THREE.Vector3(x + 0.3, 1.65, Z0 + 0.14));
    const why = isFree(bx, { ignoreKeepout: true });
    if (!why) { hookRail(x, 1.62, 4, true); placed.push({ name: 'ganchos-luvas', box: bx }); } else rejected.push({ name: 'ganchos-luvas', at: [x, Z0], why });
  }

  // ═════════════ 5) bancada de modelagem: balança, raspadores, espátula, pano, farinha (raycast no tampo) ═════════════
  const ray = new THREE.Raycaster();
  function surfaceY(x, z, yFrom = 1.4, yMin = 0.6) {
    if (!machGroup) return null;
    ray.set(new THREE.Vector3(x, yFrom, z), new THREE.Vector3(0, -1, 0)); ray.far = yFrom - yMin;
    const h = ray.intersectObject(machGroup, true).find((i) => !(i.object.material?.transparent && !i.object.material?.depthWrite));
    return h ? h.point.y : null;
  }
  const benchDecor = [];
  {
    const bz = BENCH.pos[2], bx0 = BENCH.pos[0];
    const top = (x, z) => { const y = surfaceY(x, z, BENCH.h + 0.5); return y != null && Math.abs(y - BENCH.h) < 0.12 ? y : null; };
    // balança digital de bancada (plataforma inox + visor)
    let y = top(bx0 + 0.95, bz - 0.12);
    if (y != null) {
      const b = M(bx0 + 0.95, y, bz - 0.12, -0.12);
      B.add(rbox(0.3, 0.06, 0.32, 0.01), mats.plasticW, mul(b, M(0, 0.03, 0))); B.add(rbox(0.28, 0.012, 0.26, 0.004), mats.steel, mul(b, M(0, 0.066, -0.015)));
      B.add(rbox(0.24, 0.035, 0.04, 0.006), mats.plasticW, mul(b, M(0, 0.03, 0.17, 0, -0.5)));
      const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.022), new THREE.MeshStandardMaterial({ color: 0x0b0f0b, emissive: 0x7cf07a, emissiveIntensity: 0.0, roughness: 0.3 }));
      lcd.material.emissiveMap = scaleLcd(); lcd.material.emissiveIntensity = 1.2; lcd.applyMatrix4(mul(b, M(0, 0.034, 0.191, 0, -0.5))); root.add(lcd);
      benchDecor.push('balança');
    }
    // raspadores plásticos e espátula inox
    y = top(bx0 - 0.25, bz - 0.25);
    if (y != null) {
      const sc = new THREE.CylinderGeometry(0.075, 0.075, 0.003, 24, 1, false, 0, Math.PI); sc.scale(1, 1, 0.9);
      for (let i = 0; i < 3; i++) B.add(sc, mats.scraper, M(bx0 - 0.25 + i * 0.012, y + 0.002 + i * 0.003, bz - 0.25 + i * 0.01, 1.3 + i * 0.25), { cast: false });
      const sp = M(bx0 + 0.45, y + 0.008, bz - 0.28, 0.6);
      B.add(box(0.12, 0.002, 0.1), mats.alu, sp, { cast: false }); B.add(rbox(0.12, 0.018, 0.026, 0.006), mats.wood, mul(sp, M(-0.12, 0.004, 0)));
      benchDecor.push('raspadores');
    }
    y = top(bx0 - 1.0, bz - 0.22);
    if (y != null) { clothStack(M(bx0 - 1.0, y - 0.004, bz - 0.22, 0.2), 2, mats.clothR); benchDecor.push('pano'); }
    // pó de farinha no tampo (decal fino)
    y = top(bx0, bz);
    if (y != null) {
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(BENCH.w * 0.95, BENCH.d * 0.9), new THREE.MeshStandardMaterial({ map: benchFlourTex(), transparent: true, depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      fl.rotation.x = -Math.PI / 2; fl.position.set(bx0, y + 0.0015, bz); fl.receiveShadow = true; fl.renderOrder = 2; root.add(fl);
    }
  }

  // ═════════════ 6) carrinho plataforma + pallets vazios + caixas plásticas (parede esquerda/da frente) ═════════════
  place('pallets-vazios', [1.22, 0.5, 1.02], [[X0 + 0.62, 1.6, Math.PI / 2], [X0 + 0.62, 0.3, Math.PI / 2], [-4.2, Z1 - 0.55, 0], [-1.4, Z1 - 0.55, 0]], (b) => {
    for (let i = 0; i < 3; i++) addPallet(B, mats, mul(b, M(rr(-0.02, 0.02), i * 0.145, rr(-0.02, 0.02), rr(-0.03, 0.03))));
  }, { ao: 0.7 });
  place('carrinho-plataforma', [1.0, 0.98, 0.64], [[X0 + 0.42, -0.25, Math.PI / 2 + 0.06], [-2.6, Z1 - 0.4, 0.04], [X0 + 0.42, 2.9, Math.PI / 2]], (b) => {
    addPlatformCart(B, mats, b);
    B.add(bagG[0], mats.bag[0], mul(b, M(-0.08, 0.255, 0.0, 0.05))); B.add(bagG[2], mats.bag[0], mul(b, M(-0.06, 0.38, 0.01, -0.06)));
  }, { ao: 0.5 });
  place('caixas-plasticas', [0.62, 1.15, 0.42], [[X0 + 0.25, -1.2, Math.PI / 2], [-0.4, Z1 - 0.25, 0], [X0 + 0.25, 2.4, Math.PI / 2]], (b) => {
    for (let i = 0; i < 4; i++) crate(mul(b, M(rr(-0.01, 0.01), i * 0.275, rr(-0.01, 0.01), rr(-0.03, 0.03))), i === 3 ? 1 : 0);
  });
  place('baldes-chao', [0.75, 0.75, 0.36], [[-2.6, Z0 + 0.22, 0], [X0 + 0.22, -3.6, Math.PI / 2], [-5.6, Z0 + 0.75, 0]], (b) => {
    bucket(mul(b, M(-0.18, 0, 0, 0.4)), 0, 'lidRed'); bucket(mul(b, M(0.18, 0, 0, 2)), 1, 'lidBlue'); bucket(mul(b, M(-0.18, 0.37, 0, 1.1)), 0, 'lidRed');
  });

  // ═════════════ 7) eletrocalhas, eletrodutos e tomadas 3P+T ═════════════
  function trayRun(axis, fixed, a0, a1, y, label) {
    // divide a corrida em trechos livres (desvia de dutos/coifas)
    const step = 0.1; let start = null; const runs = [];
    for (let a = a0; a <= a1 + 1e-6; a += step) {
      const bx = axis === 'x' ? new THREE.Box3(new THREE.Vector3(a - step / 2, y - 0.03, fixed - 0.14), new THREE.Vector3(a + step / 2, y + 0.09, fixed + 0.14))
        : new THREE.Box3(new THREE.Vector3(fixed - 0.14, y - 0.03, a - step / 2), new THREE.Vector3(fixed + 0.14, y + 0.09, a + step / 2));
      const free = !obstacles.some((o) => o.box.intersectsBox(bx));
      if (free && start == null) start = a; if ((!free || a + step > a1 + 1e-6) && start != null) { const e = free ? a : a - step; if (e - start > 0.4) runs.push([start, e]); start = null; }
    }
    for (const [s, e] of runs) {
      const L = e - s, c = (s + e) / 2;
      const base = axis === 'x' ? M(c, y, fixed, 0) : M(fixed, y, c, Math.PI / 2);
      addCableTray(B, mats, base, L);
    }
    return runs;
  }
  const trayY = 3.35;
  const backRuns = trayRun('x', Z0 + 0.16, X0 + 0.2, X1 - 0.2, trayY, 'fundo');
  const rightRuns = trayRun('z', X1 - 0.16, Z0 + 0.3, Z1 - 0.4, trayY, 'direita');
  function socket(x, y, z, ry, col) {
    const bx = aabb(x, y - 0.08, z, ry, 0.14, 0.18, 0.14);
    const why = isFree(bx, { ignoreKeepout: true }); if (why) { rejected.push({ name: 'tomada', at: [x, z], why }); return; }
    const base = M(x, y, z, ry); addSocket(B, mats, base, col); placed.push({ name: 'tomada', box: bx });
    // eletroduto até a eletrocalha
    const L = trayY - 0.02 - (y + 0.07); B.add(cyl(0.013, L, 10), mats.conduit, mul(base, M(0, 0.07 + L / 2, 0.035)), { cast: false });
    for (let k = 0.3; k < L; k += 0.9) B.add(box(0.04, 0.012, 0.03), mats.galv, mul(base, M(0, 0.07 + k, 0.018)), { cast: false });
  }
  socket(XR - 0.001, 1.3, -2.95, -Math.PI / 2, 'red');
  socket(XR - 0.001, 1.3, -0.25, -Math.PI / 2, 'blue');
  socket(-3.25, 1.3, Z0 + 0.001, 0, 'red');
  socket(-6.3, 1.3, Z0 + 0.001, 0, 'blue');
  socket(X0 + 0.001, 1.3, 2.2, Math.PI / 2, 'blue');

  // ═════════════ 8) manchas de calor/caramelização e farinha nas frentes dos fornos (decals projetados) ═════════════
  const decals = [];
  const sootMat = new THREE.MeshStandardMaterial({ map: T.sootTex(), transparent: true, depthWrite: false, roughness: 0.55, metalness: 0.4, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const smudgeMat = new THREE.MeshStandardMaterial({ map: T.smudgeTex(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  function projectDecal(x, y, zFront, w, h, mat, rotZ = 0) {
    if (!machMeshes.length) return false;
    ray.set(new THREE.Vector3(x, y, zFront + 0.8), new THREE.Vector3(0, 0, -1)); ray.far = 1.6;
    const hit = ray.intersectObjects(machMeshes, false).find((i) => { const mt = i.object.material; return !(mt?.transparent) && !(mt?.emissiveIntensity > 0.5 && mt?.emissive?.getHex?.()); });
    if (!hit || !hit.face || hit.point.z < zFront - 0.2) return false;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    if (n.z < 0.6) return false;
    const o = new THREE.Object3D(); o.position.copy(hit.point); o.lookAt(hit.point.clone().add(n)); o.rotateZ(rotZ);
    let g; try { g = new DecalGeometry(hit.object, hit.point, o.rotation, new THREE.Vector3(w, h, 0.12)); } catch (e) { return false; }
    if (!g.attributes.position.count) return false;
    // segue o objeto atingido (porta articulada): geometria em espaço local dele
    g.applyMatrix4(hit.object.matrixWorld.clone().invert());
    const d = new THREE.Mesh(g, mat); d.renderOrder = 3; d.receiveShadow = true; d.userData.noAO = true; hit.object.add(d); decals.push(d);
    return true;
  }
  let nDecal = 0;
  // Desligado (2026-11-19): os decalques ficavam presos às malhas mescladas dos fornos e viravam manchas marrons
  // horizontais nas coifas/frentes e riscos dentro do vidro. ?fuligem=1 reativa para testes.
  const FULIGEM = new URLSearchParams(location.search).get('fuligem') === '1';
  for (const o of FULIGEM ? OVENS : []) {
    const fz = ovenFrontZ(o);
    for (const d of o.doors) {
      const cx = o.x + d.cx;
      if (projectDecal(cx, d.y0 + d.h + 0.05, fz, d.w * 0.95, 0.12, sootMat)) nDecal++;
      if (projectDecal(cx, d.y0 - 0.03, fz, d.w * 0.7, 0.07, sootMat, Math.PI)) nDecal++;
    }
    if (projectDecal(o.x, o.h - 0.06, fz, o.w * 0.85, 0.1, sootMat)) nDecal++;
    // marcas de mão enfarinhada junto ao puxador
    const d0 = o.doors[0]; if (projectDecal(o.x + d0.cx - d0.w / 2 + 0.06, d0.y0 + d0.h * 0.55, fz, 0.16, 0.16, smudgeMat, rr(-0.4, 0.4))) nDecal++;
  }

  // ═════════════ 9) piso: pó de farinha, pegadas, marcas de rodízio, sujeira de rodapé, sombras de contato ═════════════
  for (const ob of obstacles) if (ob.tag === 'mach' && ob.box.min.y < 0.08) { const s = ob.box.getSize(new THREE.Vector3()); if (s.x < 4 && s.z < 4 && s.x * s.z > 0.004) floorShadows.push([(ob.box.min.x + ob.box.max.x) / 2, (ob.box.min.z + ob.box.max.z) / 2, s.x, s.z, 0, 0.32]); }
  const floorMesh = buildFloorOverlay({ flourSpots, floorShadows, machGroup, obstacles });
  root.add(floorMesh);

  B.build(root, 'props');

  // ───────────── atualização: relógio (hora simulada) + termo-higrômetro + cortina ─────────────
  let accT = 1;
  function update(dt) {
    const sec = app?.state?.clock ?? 0;
    if (clockHands) {
      const s = sec % 60, m = (sec / 60) % 60, h = (sec / 3600) % 12;
      clockHands.s.rotation.z = -(Math.floor(s) / 60) * Math.PI * 2; clockHands.m.rotation.z = -(m / 60) * Math.PI * 2; clockHands.h.rotation.z = -(h / 12) * Math.PI * 2;
    }
    accT += dt;
    if (accT > 1 && thermoPos && app?.field?.at) {
      accT = 0;
      try { const f = app.field.at(thermoPos); const rh = f.rh <= 1.5 ? f.rh * 100 : f.rh; thermo.draw(f.ta, rh); } catch { /* campo indisponível */ }
    }
  }

  const info = { placed: placed.map((p) => p.name), rejected, decals: nDecal, tris: Math.round(B.tris), ms: Math.round(performance.now() - t0), benchDecor, backRuns, rightRuns };
  window.__props = info;
  if (QS.get('propsdbg') === '1') console.info('[props]', JSON.stringify(info));
  return { group: root, update, info };

  // ───────────── helpers que dependem do escopo ─────────────
  function scaleLcd() {
    const [c, x] = T.cv(256, 64); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#9cff9a'; x.font = '700 46px "Roboto Mono", monospace'; x.textAlign = 'right'; x.fillText('0.000', 200, 50); x.font = '700 22px monospace'; x.fillText('kg', 246, 50);
    return T.tex(c);
  }
  function benchFlourTex() {
    const W = 1024, H = 340, r = T.rng(17); const [c, x] = T.cv(W, H);
    for (let i = 0; i < 120; i++) { const px = W * (0.3 + 0.4 * r()) + (r() - 0.5) * W * 0.5, py = H * (0.55 + (r() - 0.5) * 0.7), s = 20 + r() * 120; const g = x.createRadialGradient(px, py, 1, px, py, s); g.addColorStop(0, `rgba(250,248,242,${0.08 + r() * 0.22})`); g.addColorStop(1, 'rgba(250,248,242,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, s, s * (0.4 + r() * 0.6), r() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(252,250,245,${r() * 0.5})`; x.fillRect(r() * W, H * 0.2 + r() * H * 0.8, 1 + r() * 2, 1 + r() * 2); }
    // arcos de raspador
    for (let i = 0; i < 6; i++) { x.strokeStyle = `rgba(250,248,242,${0.15 + r() * 0.2})`; x.lineWidth = 3 + r() * 6; x.beginPath(); x.arc(W * (0.35 + r() * 0.3), H * (0.6 + r() * 0.2), 60 + r() * 90, 3.6 + r(), 5.2 + r()); x.stroke(); }
    return T.tex(c);
  }
}

/** sobreposição do piso inteiro (RGBA): farinha clara + sujeira escura + sombras de contato. ~5 mm/px. */
function buildFloorOverlay({ flourSpots, floorShadows, obstacles }) {
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0;
  const PX = 3072, PZ = Math.round(PX * D / W), k = PX / W;
  const [c, x] = T.cv(PX, PZ), R = T.rng(909);
  const U = (wx) => (wx - HALL.x0) * k, V = (wz) => (wz - HALL.z0) * k;
  const blob = (wx, wz, rx, rz, col, a, rot = 0) => { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); x.save(); x.translate(U(wx), V(wz)); x.rotate(rot); x.scale(rx * k, rz * k); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); };
  const FL = '247,244,236', DK = '28,22,16';

  // sombras de contato (AO) sob o que encosta no piso
  for (const [wx, wz, w, d, ry, s] of floorShadows) {
    x.save(); x.translate(U(wx), V(wz)); x.rotate(-ry);
    for (let i = 0; i < 4; i++) { const grow = 0.02 + i * 0.03; x.fillStyle = `rgba(${DK},${s * 0.16})`; x.filter = `blur(${(4 + i * 6)}px)`; x.fillRect(-(w / 2 + grow) * k, -(d / 2 + grow) * k, (w + 2 * grow) * k, (d + 2 * grow) * k); }
    x.restore();
  }
  x.filter = 'none';
  // sujeira no encontro piso/parede (rodapé) — farinha + pó escuro em faixas irregulares
  for (let i = 0; i < 700; i++) {
    const side = Math.floor(R() * 4); let wx, wz;
    if (side === 0) { wx = HALL.x0 + R() * W; wz = HALL.z0 + 0.03 + R() * 0.06; } else if (side === 1) { wx = HALL.x0 + R() * W; wz = HALL.z1 - 0.03 - R() * 0.06; }
    else if (side === 2) { wx = HALL.x0 + 0.03 + R() * 0.06; wz = HALL.z0 + R() * D; } else { wx = HALL.x1 - 0.03 - R() * 0.06; wz = HALL.z0 + R() * D; }
    const along = side < 2 ? 1 : 0; const l = 0.1 + R() * 0.5;
    blob(wx, wz, along ? l : 0.05, along ? 0.05 : l, R() < 0.6 ? FL : DK, 0.06 + R() * 0.1);
  }
  // farinha: bancada (mais concentrada do lado da forneira), pallets, masseira/divisora (por nome), trilha bancada → fornos
  const bx = BENCH.pos[0], bz = BENCH.pos[2];
  for (let i = 0; i < 260; i++) { const a = R() * 6.28, r = Math.pow(R(), 1.6); const wx = bx + Math.cos(a) * r * (BENCH.w * 0.75), wz = bz + 0.35 + Math.sin(a) * r * 0.9; blob(wx, wz, 0.05 + R() * 0.3, 0.04 + R() * 0.2, FL, 0.05 + R() * 0.12 * (1 - r), R() * 3); }
  for (let i = 0; i < 2500; i++) { const wx = bx + (R() - 0.5) * BENCH.w * 1.3, wz = bz + (R() - 0.2) * 1.4; x.fillStyle = `rgba(${FL},${0.03 + R() * 0.08})`; x.fillRect(U(wx), V(wz), 0.6 + R() * 1.0, 0.6 + R() * 1.0); } // pó fino (antes parecia confete)
  const named = [];
  for (const o of obstacles) if (o.tag === 'mach' && /mass|mixer|amass|divis|cilindr|modelad/i.test(o.name)) named.push(o.box);
  for (const b of named) { const cxw = (b.min.x + b.max.x) / 2, czw = (b.min.z + b.max.z) / 2, rw = (b.max.x - b.min.x) / 2 + 0.6, rd = (b.max.z - b.min.z) / 2 + 0.6; for (let i = 0; i < 60; i++) blob(cxw + (R() - 0.5) * rw * 2, czw + (R() - 0.5) * rd * 2, 0.06 + R() * 0.25, 0.05 + R() * 0.2, FL, 0.04 + R() * 0.1, R() * 3); }
  for (const [fx, fz, r0] of flourSpots) {
    for (let i = 0; i < 90; i++) { const a = R() * 6.28, r = r0 * (0.4 + R() * 0.7); blob(fx + Math.cos(a) * r, fz + Math.sin(a) * r, 0.04 + R() * 0.25, 0.04 + R() * 0.18, FL, 0.05 + R() * 0.14, R() * 3); }
    for (let i = 0; i < 6; i++) blob(fx + (R() - 0.5) * 1.6, fz + 0.6 + R() * 0.5, 0.04 + R() * 0.05, 0.03 + R() * 0.04, FL, 0.16, R() * 3); // derramado
  }
  // pegadas enfarinhadas (bancada → forno 1), alternando pés, esmaecendo
  function footprints(a, b, n0 = 0.18) {
    const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx); const n = Math.floor(L / 0.33);
    for (let i = 1; i < n; i++) {
      const t = i / n, side = i % 2 ? 1 : -1, wx = a[0] + dx * t - Math.sin(ang) * side * 0.09, wz = a[2] + dz * t + Math.cos(ang) * side * 0.09;
      const al = n0 * Math.pow(1 - t, 1.4); if (al < 0.02) continue;
      x.save(); x.translate(U(wx), V(wz)); x.rotate(ang + (R() - 0.5) * 0.15);
      x.fillStyle = `rgba(${FL},${al})`; x.beginPath(); x.ellipse(0.06 * k, 0, 0.075 * k, 0.045 * k, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(-0.09 * k, 0, 0.045 * k, 0.038 * k, 0, 0, 7); x.fill();
      x.fillStyle = `rgba(${DK},${al * 0.5})`; for (let j = 0; j < 8; j++) x.fillRect((0.0 + j * 0.017) * k, -0.03 * k, 0.006 * k, 0.06 * k);
      x.restore();
    }
  }
  footprints(STATIONS.bancada.worker, STATIONS.forno.worker, 0.22);
  footprints([BENCH.pos[0] - 0.5, 0, -1.1], [2.2, 0, 0.6], 0.16);
  // marcas de rodízio (borracha) — carrinhos de esteiras indo e voltando dos fornos
  function tracks(p0, p1, p2, gauge, a) {
    for (const s of [-1, 1]) {
      x.strokeStyle = `rgba(${DK},${a})`; x.lineWidth = 0.022 * k; x.lineCap = 'round';
      for (let rep = 0; rep < 3; rep++) {
        const j = (R() - 0.5) * 0.06; x.beginPath();
        const off = (p) => [p[0] + s * gauge / 2 + j, p[1] + j * 0.5];
        const q0 = off(p0), q1 = off(p1), q2 = off(p2);
        x.moveTo(U(q0[0]), V(q0[1])); x.quadraticCurveTo(U(q1[0]), V(q1[1]), U(q2[0]), V(q2[1])); x.globalAlpha = 0.5 + R() * 0.5; x.stroke(); x.globalAlpha = 1;
      }
    }
  }
  for (const o of OVENS) {
    const fz = ovenFrontZ(o), cx = o.x + o.doors[0].cx;
    tracks([cx, fz + 0.1], [cx + 0.1, fz + 1.0], [cx + 0.9 * (cx < 3 ? -1 : 1), fz + 2.2], o.kind === 'rotativo' ? 0.62 : 0.5, o.kind === 'rotativo' ? 0.1 : 0.05);
    // migalhas tostadas diante da porta
    for (let i = 0; i < 70; i++) { const wx = cx + (R() - 0.5) * o.doors[0].w * 1.4, wz = fz + 0.05 + Math.pow(R(), 2) * 0.9; x.fillStyle = `rgba(${120 + R() * 60},${70 + R() * 40},${30 + R() * 20},${0.5 + R() * 0.4})`; x.fillRect(U(wx), V(wz), 2 + R() * 4, 2 + R() * 3); }
  }
  // respingos e manchas d'água secas perto do lavatório e do bebedouro (círculos de evaporação)
  for (let i = 0; i < 14; i++) { const wx = HALL.x1 - 0.5 - R() * 0.8, wz = 2.3 + (R() - 0.5) * 1.2; x.strokeStyle = `rgba(${DK},${0.05 + R() * 0.06})`; x.lineWidth = 2; x.beginPath(); x.ellipse(U(wx), V(wz), (0.03 + R() * 0.12) * k, (0.02 + R() * 0.08) * k, R() * 3, 0, 7); x.stroke(); }

  const t = T.tex(c, { aniso: 8 });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.name = 'floorOverlay';
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), m);
  pl.rotation.x = -Math.PI / 2; pl.position.set((HALL.x0 + HALL.x1) / 2, 0.003, (HALL.z0 + HALL.z1) / 2);
  pl.receiveShadow = true; pl.renderOrder = 1; pl.name = 'props:floorOverlay'; pl.userData.noAO = true;
  return pl;
}
