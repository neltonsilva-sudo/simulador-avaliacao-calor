// CASARIO da rua colonial (estilo Ouro Preto) — duas fileiras de sobrados geminados de 2 pavimentos + casarão/galpão
// diante da casa de caldeiras. Contrato: src/layout_rua.js (RUA.houseW / RUA.houseE, ruaY). Sem luzes próprias: a luz
// externa é do CENÁRIO (perfil 'rua'). Paredes/cimalhas/beirais = malhas mescladas (vertexColors); portas, janelas,
// sacadas, cachorros e telhas = InstancedMesh com instanceColor. Texturas canvas compartilhadas (street_houses_tex.js).
import * as THREE from 'three';
import { RUA, ruaY, ruaX } from './layout_rua.js';
import * as TX from './street_houses_tex.js';
import { Builder, Facade, frameGeo, doorLeavesGeo, glassGeo, sashGeo, balconyGeo, tileCourseGeo, ridgeGeo, boxAt, lanternGeo, shutterGeo, grilleGeo, merge } from './street_houses_geo.js';

const C = (h) => new THREE.Color(h);
const WALLS = [0xf4f1ea, 0xf2eee6, 0xf6f3ee, 0xf3efe6, 0xefe4cc, 0xf0e1bd, 0xead6a6, 0xe5c272, 0xf2e6d2];
const FRAMES = [0x6b1a1f, 0x7c2226, 0x1d397a, 0x24418a, 0x1c3f9a, 0x2a5e45, 0x1f4a33, 0xb8831e];
const DOORS = [0x2f6a4c, 0x275a40, 0x6e1c20, 0x7a2024, 0x1d4aa0, 0x23408a, 0xc99a45, 0x5a3a24];
const BARR = [0x8f8b82, 0x9c9078, 0x726d64, 0xa88e5c, 0x6e5a48];
const sw = (z) => ruaY(z) + 0.15; // topo do passeio de lajes
const DOOR = { W: 1.25, T: 2.45, r: 0.2 }, WING = { W: 1.05, T: 1.45, r: 0.15 }, WINU = { W: 1.05, T: 1.3, r: 0.14 }, PJ = { W: 1.05, T: 2.2, r: 0.14 };
const POR = { W: 3.3, T: 3.15, r: 0.5 };
const pick = (a) => a[Math.floor(TX.rnd() * a.length) % a.length];

export function buildColonialHouses(stage, app) {
  const root = new THREE.Group(); root.name = 'casario'; stage.scene.add(root);
  const BW = new Builder(), BT = new Builder(), BR = new Builder(), BS = new Builder(); const CR = { stone: [], iron: [], gold: [], wood: [] }, anchors = { W: [], E: [] }; // paredes (reboco), madeira (forro/testeira), telhado liso
  const I = {}; const put = (k, p, rotY, s = [1, 1, 1], col, rx = 0) => (I[k] ||= []).push({ p, rotY, s, col, rx });
  const signs = [];

  // ───────── materiais (compartilhados) ─────────
  const wood = TX.woodTex(), stoneT = TX.stoneTex(), tileT = TX.tileTex();
  const M = {
    wall: new THREE.MeshStandardMaterial({ map: TX.wallTex(), bumpMap: TX.wallBump(), bumpScale: 0.9, roughness: 0.93, vertexColors: true }),
    woodV: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.72, vertexColors: true }),
    roof: new THREE.MeshStandardMaterial({ map: tileT, roughness: 0.88, vertexColors: true }),
    frame: new THREE.MeshStandardMaterial({ map: wood, roughness: 0.62 }),
    door: new THREE.MeshStandardMaterial({ map: TX.doorTex(), roughness: 0.7 }),
    sash: new THREE.MeshStandardMaterial({ color: 0xf3f1ea, map: wood, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ map: TX.glassTex(), roughness: 0.05, metalness: 0.0, envMapIntensity: 1.6 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneT, bumpMap: stoneT, bumpScale: 0.6, roughness: 0.82 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.65, roughness: 0.42 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd2a640, metalness: 1.0, roughness: 0.28 }),
    tile: new THREE.MeshStandardMaterial({ map: tileT, roughness: 0.84 }),
    door2: new THREE.MeshStandardMaterial({ map: TX.panelDoorTex(), roughness: 0.68 }),
    louver: new THREE.MeshStandardMaterial({ map: TX.louverTex(), roughness: 0.66 }),
    lanG: new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.12, emissive: 0x2a1e0c }),
    rail: new THREE.MeshStandardMaterial({ color: 0xc8952e, map: wood, roughness: 0.55 }),
    pipe: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }),
    wire: new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 0.6 }),
    stoneV: new THREE.MeshStandardMaterial({ map: stoneT, bumpMap: stoneT, bumpScale: 0.8, roughness: 0.85, vertexColors: true }),
  };
  M.frame.map = wood;

  // ───────── lotes ─────────
  const lots = [];
  const W_EDGES = [-45, -36.5, -29.5, -20.5, -13.5, -4.5, 4.5, 11, 18.5, 26, 35, 45];
  const E_EDGES = [-45, -37, -30, -23, -16.5, -10, 10, 17, 24.5, 31, 38, 45];
  W_EDGES.slice(0, -1).forEach((z, i) => lots.push({ side: 'W', za: z, zb: W_EDGES[i + 1], seed: 100 + i }));
  E_EDGES.slice(0, -1).forEach((z, i) => lots.push({ side: 'E', za: z, zb: E_EDGES[i + 1], seed: 300 + i }));
  for (const L of lots) {
    const c = (L.za + L.zb) / 2;
    if (L.side === 'W' && Math.abs(c) < 1) Object.assign(L, { padaria: true, sign: 'PADARIA\nCONFEITARIA' });
    if (L.side === 'E' && Math.abs(c) < 1) L.galpao = true;
    if (L.side === 'W' && Math.abs(c + 17) < 1) L.sign = 'ARMAZÉM';
    if (L.side === 'E' && Math.abs(c - 20.75) < 1) L.sign = 'ATELIÊ';
    if (L.side === 'E' && Math.abs(c + 26.5) < 1) L.sign = 'CAFÉ';
    buildHouse(L);
  }

  function buildHouse(L) {
    TX.reseed(L.seed * 7919 + 13); for (let i = 0; i < 5; i++) TX.rnd();
    const s = L.side === 'W' ? 1 : -1, rot = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    const set = L.padaria || L.galpao ? 0 : pick([0, 0, 0.12, 0.25, 0.38]);
    const { za, zb } = L, w = zb - za, c = (za + zb) / 2, dx = ruaX(c);
    const F = (s > 0 ? RUA.houseW[1] : RUA.houseE[0]) + dx - s * set, depth = s > 0 ? F - RUA.houseW[0] - dx : RUA.houseE[1] + dx - F;
    const yf = sw(c) + 0.17, yb = Math.min(ruaY(za), ruaY(zb)) - 0.6;
    const H1 = L.galpao ? 3.9 : L.padaria ? 3.75 : 3.2 + TX.rnd() * 0.8, H2 = L.galpao ? 3.35 : 2.9 + TX.rnd() * 0.8;
    const y2 = yf + H1, ye = y2 + H2;
    const fc = new Facade(F, s, TX.rnd() * 5, yb, ye - yb);
    const P = (a, d, y) => fc.P(a, d, y);
    const wallC = C(L.galpao ? 0xf2efe7 : L.padaria ? 0xf0e2c0 : pick(WALLS)), white = wallC.r > 0.93 && wallC.b > 0.86;
    const frameC = C(L.galpao ? 0x1f4a33 : L.padaria ? 0x2f6a4c : pick(FRAMES)), blueF = frameC.b > frameC.r * 1.6;
    const doorC = L.galpao ? C(0x2d5a40) : L.padaria ? C(0x2f6a4c) : TX.rnd() < 0.35 ? frameC.clone() : C(pick(DOORS));
    const stoneCun = L.padaria || (!L.galpao && TX.rnd() < 0.45), soco = !L.galpao && !L.padaria && TX.rnd() < 0.3;
    const barC = white ? (blueF ? frameC.clone() : C(pick(BARR))) : wallC.clone().multiplyScalar(0.7);
    const cunC = white ? C(0xf7f5ef) : C(0xf6f3ec);
    const forroC = C(TX.rnd() < 0.75 ? 0xf2efe8 : 0x7a5a3c), cachC = C(TX.rnd() < 0.7 ? 0x3b2a1c : 0xefece4);
    const doorK = L.padaria || TX.rnd() < 0.7 ? 'lD' : 'lD2', shut = !L.galpao && !L.padaria && TX.rnd() < 0.4, grill = !shut && TX.rnd() < 0.35;
    const balStyle = L.padaria ? 2 : TX.rnd() < 0.5 ? 1 : 2, railC = C(pick([0xc8952e, 0x5c3e26, 0xd4a640]));

    // ───────── vãos ─────────
    const ground = [], upper = [];
    if (L.galpao) {
      ground.push({ t: 'por', a: c }); for (const o of [-8.3, -5, 5, 8.3]) ground.push({ t: 'win', a: c + o });
      for (const o of [-8.3, -5, -1.67, 1.67, 5, 8.3]) upper.push({ t: 'win', a: c + o });
    } else {
      const n = shut ? Math.max(2, Math.min(3, Math.round(w / 2.8))) : Math.max(2, Math.min(4, Math.round(w / 2.2))), ac = (k) => za + (k + 0.5) * w / n, r = TX.rnd();
      const G = L.padaria ? 'WDDW' : n === 2 ? (r < 0.5 ? 'DW' : 'WD') : n === 3 ? (r < 0.6 ? 'WDW' : 'DWD') : (r < 0.5 ? 'WDDW' : 'DWWD');
      const r2 = TX.rnd(), U = [...Array(n)].map((_, k) => r2 < 0.55 ? 'P' : r2 < 0.8 ? (k % 2 ? 'W' : 'P') : (Math.abs(k - (n - 1) / 2) < 0.6 ? 'P' : 'W'));
      for (let k = 0; k < n; k++) { ground.push({ t: G[k] === 'D' ? 'door' : 'win', a: ac(k) }); upper.push({ t: U[k] === 'P' ? 'pj' : 'win', a: ac(k) }); }
    }
    const holes = [], doorHoles = [];
    const glassCol = () => C(0xffffff).multiplyScalar(0.55 + TX.rnd() * 0.6);
    const stone = (a0, a1, d0, d1, y0, y1) => put('stone', P((a0 + a1) / 2, (d0 + d1) / 2, (y0 + y1) / 2), rot, [a1 - a0, y1 - y0, d1 - d0]);
    for (const o of ground) {
      if (o.t === 'door' || o.t === 'por') {
        const D = o.t === 'por' ? POR : DOOR, top = yf + D.T + D.r;
        const thr = Math.min(yf + 0.35, Math.max(yf - 0.35, sw(o.a) + 0.17)), sy = (top - thr) / (D.T + D.r);
        const h = { a0: o.a - D.W / 2, a1: o.a + D.W / 2, y0: thr, y1: top }; holes.push(h); doorHoles.push(h);
        put(o.t === 'por' ? 'fR' : 'fD', P(o.a, 0, thr), rot, [1, sy, 1], frameC);
        put(o.t === 'por' ? 'lR' : doorK, P(o.a, -0.37, thr), rot, [1, sy, 1], doorC);
        stone(o.a - D.W / 2 - 0.15, o.a + D.W / 2 + 0.15, -0.42, 0.3, thr - 0.12, thr);
        const tot = thr - sw(o.a), m = tot > 0.24 ? Math.round(tot / 0.17) - 1 : 0;
        for (let k = 1; k <= m; k++) { const ty = thr - k * tot / (m + 1), dd = Math.min(1.0, 0.3 + 0.28 * k);
          stone(o.a - D.W / 2 - 0.15 - 0.05 * k, o.a + D.W / 2 + 0.15 + 0.05 * k, -0.1, dd, sw(o.a) - 0.3, ty); }
      } else {
        const sill = yf + 1.05, D = WING; holes.push({ a0: o.a - D.W / 2, a1: o.a + D.W / 2, y0: sill, y1: sill + D.T + D.r });
        put('fG', P(o.a, 0, sill), rot, [1, 1, 1], frameC); put('sG', P(o.a, -0.14, sill), rot); put('gG', P(o.a, -0.3, sill), rot, [1, 1, 1], glassCol());
        if (shut) put('ven', P(o.a, 0, sill - 0.04), rot, [1, 1, 1], frameC); if (grill) put('grd', P(o.a, 0, sill), rot);
        stone(o.a - D.W / 2 - 0.21, o.a + D.W / 2 + 0.21, -0.42, 0.1, sill - 0.1, sill);
      }
    }
    const pjs = upper.filter((o) => o.t === 'pj'), corr = !L.galpao && pjs.length >= 2 && (L.padaria || TX.rnd() < 0.4);
    for (const o of upper) {
      if (o.t === 'pj') { const D = PJ; holes.push({ a0: o.a - D.W / 2, a1: o.a + D.W / 2, y0: y2, y1: y2 + D.T + D.r });
        put('fP', P(o.a, 0, y2), rot, [1, 1, 1], frameC); put('sP', P(o.a, -0.14, y2), rot); put('gP', P(o.a, -0.3, y2), rot, [1, 1, 1], glassCol());
        if (!corr) { put('bS', P(o.a, 0, y2), rot); if (balStyle === 1) { put('bI', P(o.a, 0, y2), rot); put('bG', P(o.a, 0, y2), rot); }
          else { put('bI2', P(o.a, 0, y2), rot); put('bG2', P(o.a, 0, y2), rot); put('bW2', P(o.a, 0, y2), rot, [1, 1, 1], railC); } }
        stone(o.a - D.W / 2, o.a + D.W / 2, -0.42, 0.02, y2 - 0.09, y2);
      } else { const D = WINU, sill = y2 + 0.95; holes.push({ a0: o.a - D.W / 2, a1: o.a + D.W / 2, y0: sill, y1: sill + D.T + D.r });
        put('fU', P(o.a, 0, sill), rot, [1, 1, 1], frameC); put('sU', P(o.a, -0.14, sill), rot); put('gU', P(o.a, -0.3, sill), rot, [1, 1, 1], glassCol());
        stone(o.a - D.W / 2 - 0.2, o.a + D.W / 2 + 0.2, -0.42, 0.09, sill - 0.09, sill); }
    }
    if (corr) { const a0 = pjs[0].a - 0.85, a1 = pjs[pjs.length - 1].a + 0.85, g = balconyGeo(a1 - a0, 0.72, 1.0, balStyle === 1 ? 'rings' : 'loops', true);
      const m = new THREE.Matrix4().compose(P((a0 + a1) / 2, 0, y2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(1, 1, 1));
      for (const k of Object.keys(CR)) if (g[k]) CR[k].push(g[k].applyMatrix4(m)); }
    // lampiões pendentes sob a sacada (entre vãos) e condutor de águas pluviais
    if (!L.galpao && ground.length >= 2) { const lam = [(ground[0].a + ground[1].a) / 2]; if (ground.length >= 4) lam.push((ground[2].a + ground[3].a) / 2);
      for (const a of lam) { put('lanI', P(a, 0, y2 - 0.32), rot); put('lanG', P(a, 0, y2 - 0.32), rot); } }
    if (L.galpao) for (const a of [c - 3.4, c + 3.4]) { put('lanI', P(a, 0, yf + 3.3), rot); put('lanG', P(a, 0, yf + 3.3), rot); }
    if (L.padaria || TX.rnd() < 0.65) { const a = TX.rnd() < 0.5 ? za + 0.45 : zb - 0.45, y0 = sw(a) - 0.05;
      put('pipe', P(a, 0.1, y0), rot, [1, ye - 0.42 - y0, 1], C(pick([0xdad7cf, 0x6a3a2a, 0x8c8a84]))); }
    anchors[L.side].push(P(za + 0.35, 0.1, ye - 0.65), P(zb - 0.35, 0.1, ye - 0.65));

    // ───────── paredes ─────────
    const wTop = ye + 0.17;
    fc.wall(BW, za, zb, yb, wTop, 0, holes, wallC);
    const barTop = yf + (L.galpao ? 1.0 : soco ? 0.5 : 0.82), bd = soco ? 0.05 : 0.025, Bb = soco ? BS : BW, bc = soco ? C(0xd8d2c6) : barC, md = soco ? 'm' : 'f';
    fc.wall(Bb, za + 0.3, zb - 0.3, yb, barTop, bd, doorHoles, bc, md);
    let a = za + 0.3; for (const h of [...doorHoles].sort((p, q) => p.a0 - q.a0)) { if (h.a0 > a) fc.q(Bb, [[a, 0, barTop], [h.a0, 0, barTop], [h.a0, bd, barTop], [a, bd, barTop]], [0, 0, 1], bc, soco ? 'm' : 't'); a = h.a1; }
    if (zb - 0.3 > a) fc.q(Bb, [[a, 0, barTop], [zb - 0.3, 0, barTop], [zb - 0.3, bd, barTop], [a, bd, barTop]], [0, 0, 1], bc, soco ? 'm' : 't');
    for (const [a0, a1] of [[za, za + 0.32], [zb - 0.32, zb]]) stoneCun ? fc.box(BS, a0, a1, 0, 0.07, yb, ye - 0.42, C(0xe2ddd3), 'ky', 'm') : fc.box(BW, a0, a1, 0, 0.05, yb, ye - 0.42, cunC, 'ky');
    if (L.galpao) for (const o of [-2.6, 2.6]) fc.box(BW, c + o - 0.17, c + o + 0.17, 0, 0.05, yb, ye - 0.42, cunC, 'ky');
    fc.box(BW, za + 0.32, zb - 0.32, 0, 0.035, y2 - 0.27, y2 - 0.12, cunC, 'k'); // faixa entre pavimentos
    for (const [y0, y1, dd] of [[ye - 0.42, ye - 0.32, 0.06], [ye - 0.32, ye - 0.2, 0.12], [ye - 0.2, ye - 0.1, 0.2], [ye - 0.1, ye, 0.3]]) fc.box(BW, za, zb, 0, dd, y0, y1, cunC, 'k'); // cimalha

    // beiral profundo: forro + testeira + cachorros de madeira escura
    const dE = 1.25, yF = ye + 0.15;
    fc.q(BT, [[za, 0, yF], [zb, 0, yF], [zb, dE, yF], [za, dE, yF]], [0, 0, -1], forroC, 't');
    fc.q(BT, [[za, dE, yF - 0.02], [zb, dE, yF - 0.02], [zb, dE, yF + 0.12], [za, dE, yF + 0.12]], [0, 1, 0], cachC.clone().multiplyScalar(0.9), 'r', [[0, 0], [w, 0], [w, 0.1], [0, 0.1]]);
    const nc = Math.max(3, Math.round((w - 0.4) / 0.6));
    for (let k = 0; k < nc; k++) put('cach', P(za + 0.2 + (k + 0.5) * (w - 0.4) / nc, 0.12, ye + 0.02), rot, [1, 1, 1], cachC);

    // telhado (cumeeira paralela à rua)
    const phi = THREE.MathUtils.degToRad(26 + TX.rnd() * 5), tn = Math.tan(phi), dT = dE + 0.08, yT = ye + 0.24, dR = -depth / 2;
    const yR = yT + (dT - dR) * tn, Ls = (dT - dR) / Math.cos(phi), ncs = Math.ceil(Ls / 0.38);
    const ncol = Math.max(1, Math.round(w)), cw = w / ncol;
    for (let k = 0; k < ncs; k++) { const sk = Math.min(k * 0.38, Ls - 0.3), d = dT - sk * Math.cos(phi), y = yT + sk * Math.sin(phi);
      for (let j = 0; j < ncol; j++) { const r = TX.rnd(), col = r < 0.1 ? C(0x6e655c) : r < 0.22 ? C(0xa3a07e).multiplyScalar(0.8 + TX.rnd() * 0.2) : C(0xffffff).multiplyScalar(0.68 + TX.rnd() * 0.45);
        if (r > 0.8) col.multiply(C(0xffd2a8)); if (k < 2 && TX.rnd() < 0.5) col.multiplyScalar(0.75);
        put('tile', P(za + (j + 0.5) * cw, d + (TX.rnd() - 0.5) * 0.02, y + (TX.rnd() - 0.5) * 0.018), rot, [cw, 1, 1], col, phi + (TX.rnd() - 0.5) * 0.04); } }
    const tileUnder = C(0x4a2c1e), yRb = yR - 0.005;
    fc.q(BR, [[za, dT + 0.02, yT - 0.01], [zb, dT + 0.02, yT - 0.01], [zb, dR, yRb], [za, dR, yRb]], [0, Math.sin(phi), Math.cos(phi)], tileUnder, 'r', [[0, 0], [w, 0], [w, Ls / 0.44], [0, Ls / 0.44]]);
    const dBk = -depth - 0.35, yBk = yR - (dR - dBk) * tn, Lb = (dR - dBk) / Math.cos(phi);
    fc.q(BR, [[za, dR, yR + 0.04], [zb, dR, yR + 0.04], [zb, dBk, yBk], [za, dBk, yBk]], [0, -Math.sin(phi), Math.cos(phi)], C(0xc9a38c), 'r', [[0, 0], [w, 0], [w, Lb / 0.44], [0, Lb / 0.44]]);
    for (let x = za + 0.2; x < zb; x += 0.4) put('ridge', P(x, dR, yR + 0.035), rot, [1, 1, 1], C(0xffffff).multiplyScalar(0.75 + TX.rnd() * 0.3));
    // laterais (empenas) e fundos
    const yr0 = yT + dT * tn - 0.04, yrB = yR - depth / 2 * tn - 0.04;
    for (const [aa, na] of [[za, -1], [zb, 1]]) {
      fc.q(BW, [[aa, -depth, yb], [aa, 0, yb], [aa, 0, yr0], [aa, -depth, yrB]], [na, 0, 0], wallC, 's');
      const k = 0.17, ai = aa - na * 0.16, gc = wallC.clone().multiplyScalar(0.94);
      fc.q(BW, [[aa, -depth, yrB], [aa, 0, yr0], [aa, dR, yR + k], [aa, dR, yR + k]], [na, 0, 0], gc, 's');
      fc.q(BW, [[aa, dT, yT - 0.06], [aa, 0, yr0], [aa, 0, yr0 + k], [aa, dT, yT + k]], [na, 0, 0], gc, 's');
      fc.q(BW, [[aa, -depth, yrB], [aa, -depth, yrB + k], [aa, dR, yR + k], [aa, dR, yR + k]], [na, 0, 0], gc, 's');
      // capeamento da empena acompanhando as águas (oculta o corte lateral das telhas)
      for (const [d0, y0] of [[dT, yT], [dBk, yBk]]) {
        fc.q(BW, [[aa, d0, y0 + k], [ai, d0, y0 + k], [ai, dR, yR + k], [aa, dR, yR + k]], [0, 0, 1], cunC, 't');
        fc.q(BW, [[ai, d0, y0 - 0.06], [ai, dR, yR - 0.02], [ai, dR, yR + k], [ai, d0, y0 + k]], [-na, 0, 0], cunC, 's');
        fc.q(BW, [[aa, d0, y0 - 0.06], [ai, d0, y0 - 0.06], [ai, d0, y0 + k], [aa, d0, y0 + k]], [0, d0 > 0 ? 1 : -1, 0], cunC);
      }
    }
    fc.q(BW, [[za, -depth, yb], [zb, -depth, yb], [zb, -depth, yrB], [za, -depth, yrB]], [0, -1, 0], wallC.clone().multiplyScalar(0.9));

    // letreiros
    if (L.galpao) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.49), new THREE.MeshStandardMaterial({ map: TX.paintedText('CASA DE CALDEIRAS'), transparent: true, opacity: 0.92, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.copy(P(c, 0.012, yf + POR.T + POR.r + 0.62)); m.rotation.y = rot; root.add(m); }
    if (L.padaria) { const m = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.44, 0.05), [0, 0, 0, 0, 1, 0].map((k) => k ? new THREE.MeshStandardMaterial({ map: TX.signTex('PADARIA · CONFEITARIA', 'rgb(110,28,32)', 'rgb(240,220,160)'), roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color: 0x3a1c14, roughness: 0.7 })));
      m.position.copy(P(c, 0.05, yf + 3.2)); m.rotation.y = rot; m.castShadow = true; root.add(m); }
    if (L.sign) { const aS = L.padaria ? za + 0.85 : za + 0.75, ya = y2 - 0.38;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.035, 0.035), M.iron); arm.position.copy(P(aS, 0.62, ya)); root.add(arm);
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.025, 0.025), M.iron); brace.position.copy(P(aS, 0.32, ya - 0.2)); brace.rotation.z = s * 0.55; root.add(brace);
      const piv = new THREE.Group(); piv.position.copy(P(aS, 0.7, ya - 0.02)); root.add(piv);
      const smat = new THREE.MeshStandardMaterial({ map: TX.signTex(L.sign, L.padaria ? 'rgb(110,28,32)' : pick(['rgb(36,58,42)', 'rgb(30,44,80)', 'rgb(60,40,28)']), 'rgb(238,218,160)'), roughness: 0.75 });
      const edge = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.8 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.4, 0.04), [edge, edge, edge, edge, smat, smat]); board.position.y = -0.31; board.castShadow = true; piv.add(board);
      for (const o of [-0.38, 0.38]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.012), M.iron); ch.position.set(o, -0.06, 0); piv.add(ch); }
      signs.push({ piv, ph: TX.rnd() * 6 });
    }
  }

  // ───────── malhas ─────────
  const bal = balconyGeo(), bal2 = balconyGeo(1.6, 0.6, 1.0, 'loops', true), lan = lanternGeo();
  const G = {
    fD: [frameGeo(DOOR.W, DOOR.T, DOOR.r, 0.22, 0.42, 0.06), 'frame'], lD: [doorLeavesGeo(DOOR.W, DOOR.T, DOOR.r), 'door'], lD2: [doorLeavesGeo(DOOR.W, DOOR.T, DOOR.r), 'door2'],
    fR: [frameGeo(POR.W, POR.T, POR.r, 0.32, 0.42, 0.08, 0.2), 'frame'], lR: [doorLeavesGeo(POR.W, POR.T, POR.r, 0.07), 'door'],
    fG: [frameGeo(WING.W, WING.T, WING.r, 0.19, 0.42, 0.06), 'frame'], sG: [sashGeo(WING.W, WING.T, WING.r, 'g'), 'sash'], gG: [glassGeo(WING.W, WING.T, WING.r), 'glass'],
    fU: [frameGeo(WINU.W, WINU.T, WINU.r, 0.19, 0.42, 0.06), 'frame'], sU: [sashGeo(WINU.W, WINU.T, WINU.r, 'g'), 'sash'], gU: [glassGeo(WINU.W, WINU.T, WINU.r), 'glass'],
    fP: [frameGeo(PJ.W, PJ.T, PJ.r, 0.19, 0.42, 0.06), 'frame'], sP: [sashGeo(PJ.W, PJ.T, PJ.r, 'p'), 'sash'], gP: [glassGeo(PJ.W, PJ.T, PJ.r), 'glass'],
    bS: [bal.stone, 'stone'], bI: [bal.iron, 'iron'], bG: [bal.gold, 'gold'], bI2: [bal2.iron, 'iron'], bG2: [bal2.gold, 'gold'], bW2: [bal2.wood, 'frame'],
    ven: [shutterGeo(WING.W, WING.T + WING.r + 0.12, 0.19), 'louver'], grd: [grilleGeo(WING.W, WING.T), 'iron'], lanI: [lan.iron, 'iron'], lanG: [lan.glass, 'lanG'],
    pipe: [new THREE.CylinderGeometry(0.045, 0.045, 1, 8, 1, true).translate(0, 0.5, 0), 'pipe'],
    stone: [new THREE.BoxGeometry(1, 1, 1), 'stone'], cach: [boxAt(0.09, 0.13, 1.12, 0, 0.065, 0.56), 'frame'],
    tile: [tileCourseGeo(), 'tile'], ridge: [ridgeGeo(), 'tile'],
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3();
  let tris = 0;
  for (const [k, list] of Object.entries(I)) {
    const [geo, mk] = G[k]; const im = new THREE.InstancedMesh(geo, M[mk], list.length); im.name = 'casario_' + k;
    list.forEach((it, i) => { e.set(it.rx, it.rotY, 0); q.setFromEuler(e); m4.compose(it.p, q, sc.set(...it.s)); im.setMatrixAt(i, m4); if (it.col) im.setColorAt(i, it.col); });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = !['tile', 'ridge', 'gG', 'gU', 'gP', 'bG', 'sG', 'sU', 'sP', 'cach'].includes(k); im.receiveShadow = true;
    im.computeBoundingSphere(); root.add(im); tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3 * list.length;
  }
  for (const [k, mat] of [['stone', M.stone], ['iron', M.iron], ['gold', M.gold], ['wood', M.rail]]) if (CR[k].length) { const m = new THREE.Mesh(merge(CR[k]), mat); m.castShadow = k !== 'gold'; m.receiveShadow = true; root.add(m); }
  // fiação elétrica: ao longo das fachadas e cruzando a rua (catenárias)
  const wires = [], sag = (A, B, h) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3().lerpVectors(A, B, t).add(new THREE.Vector3(0, -4 * h * t * (1 - t), 0))); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.008, 4); };
  for (const side of ['W', 'E']) { const an = anchors[side].sort((p, q) => p.z - q.z); for (let i = 0; i < an.length - 1; i++) if (an[i + 1].z - an[i].z > 0.3) wires.push(sag(an[i], an[i + 1], 0.12 + 0.05 * (i % 3))); }
  for (const z of [-27.5, -7.5, 14.5, 33.5]) { const yA = ruaY(z) + 6.6, yB = ruaY(z + 1.2) + 6.3; const xw = RUA.houseW[1] + ruaX(z) + 0.05, xe = RUA.houseE[0] + ruaX(z) - 0.05; wires.push(sag(new THREE.Vector3(xw, yA, z), new THREE.Vector3(xe, yB, z + 1.2), 0.38));
    wires.push(sag(new THREE.Vector3(xw, yA - 0.25, z + 0.3), new THREE.Vector3(xe, yB - 0.2, z + 1.5), 0.45)); }
  root.add(new THREE.Mesh(merge(wires), M.wire));
  for (const [b, mat, cast] of [[BW, M.wall, true], [BT, M.woodV, false], [BR, M.roof, true], [BS, M.stoneV, true]]) { const m = new THREE.Mesh(b.geo(), mat); m.castShadow = cast; m.receiveShadow = true; root.add(m); tris += b.p.length / 9; }
  root.userData.tris = Math.round(tris);

  // visibilidade: controlada pelo scene.js (showStreet) — oculto dentro dos prédios
  return {
    group: root,
    update(dt, t) {
      if (!root.visible) return;
      for (const sg of signs) sg.piv.rotation.x = 0.035 * Math.sin(t * 1.3 + sg.ph) + 0.015 * Math.sin(t * 2.9 + sg.ph * 2);
    },
  };
}
