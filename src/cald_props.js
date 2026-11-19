// CALDEIRAS — sala de controle envidraçada (mesa, cadeira, monitores do supervisório, split, livro de registro), mesa do
// avaliador TABLE2, guarda-corpos amarelos, extintores, quadros elétricos (CCM), tratamento de água (abrandadores),
// dosagem química, tambores, carrinho de ferramentas, escada, bancada, hidrante, tanque de descarga, sinalização.
import * as THREE from 'three';
import { CONTROL_ROOM as C, STATIONS2, TABLE2, HALL2 } from './layout_caldeiras.js';
import * as G from './cald_geo.js';
import * as TX from './cald_tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildProps(ctx) {
  const { group, batch, M, cyl, box, sign } = ctx;

  // ═════════════ SALA DE CONTROLE ═════════════
  {
    const { x0, x1, z0, z1, h } = C;
    // piso elevado (placa vinílica) + rodapé
    box('cabFloor', [(x0 + x1) / 2, 0.05, (z0 + z1) / 2], [x1 - x0, 0.1, z1 - z0]);
    // paredes cegas (x1 e z1) em painel sanduíche
    box('cabWall', [x1 - 0.04, h / 2, (z0 + z1) / 2], [0.08, h, z1 - z0]); box('cabWall', [(x0 + x1) / 2, h / 2, z1 - 0.04], [x1 - x0, h, 0.08]);
    // forro
    box('cabWall', [(x0 + x1) / 2, h + 0.05, (z0 + z1) / 2], [x1 - x0 + 0.06, 0.1, z1 - z0 + 0.06]);
    // fachadas de vidro (x0 e z0): peitoril cego 0–0,95, vidro 0,95–2,55, bandeira 2,55–2,8; caixilhos de alumínio
    const facade = (axis) => {
      const a0 = axis === 'x' ? x0 : z0, a1 = axis === 'x' ? x1 : z1, fixed = axis === 'x' ? z0 : x0;
      const L = a1 - a0, door = axis === 'z' ? [z1 - 1.15, z1 - 0.2] : null;
      const P = (s, y) => (axis === 'x' ? [s, y, fixed + 0.04] : [fixed + 0.04, y, s]);
      const S = (len, hh, t = 0.08) => (axis === 'x' ? [len, hh, t] : [t, hh, len]);
      const segs = door ? [[a0, door[0]], [door[1], a1]] : [[a0, a1]];
      for (const [p, q] of segs) { box('cabWall', P((p + q) / 2, 0.475), S(q - p, 0.95)); box('cabWall', P((p + q) / 2, 2.675), S(q - p, 0.25)); }
      if (door) box('cabWall', P((door[0] + door[1]) / 2, 2.675), S(door[1] - door[0], 0.25));
      const n = Math.round(L / 1.0);
      for (let k = 0; k <= n; k++) { const s = a0 + (L * k) / n; box('alu', P(s, 1.4, 0), S(0.05, 2.8, 0.1)); }
      for (const y of [0.97, 2.53]) box('alu', P((a0 + a1) / 2, y), S(L, 0.05, 0.1));
      // vidro
      for (const [p, q] of segs) {
        const g = new THREE.Mesh(new THREE.PlaneGeometry(q - p, 1.56), M.cabGlass); const pp = P((p + q) / 2, 1.75); g.position.set(...pp);
        if (axis === 'z') g.rotation.y = -Math.PI / 2; else g.rotation.y = Math.PI; g.userData.noAO = true; group.add(g);
        const g2 = g.clone(); g2.rotation.y += Math.PI; group.add(g2);
      }
      if (door) { // porta de vidro com puxador
        const dg = new THREE.Mesh(new THREE.PlaneGeometry(door[1] - door[0] - 0.08, 2.3), M.cabGlass); dg.position.set(fixed + 0.02, 1.25, (door[0] + door[1]) / 2); dg.rotation.y = -Math.PI / 2; group.add(dg);
        box('alu', [fixed + 0.02, 1.25, door[0] + 0.03], [0.06, 2.4, 0.06]); box('alu', [fixed + 0.02, 1.25, door[1] - 0.03], [0.06, 2.4, 0.06]);
        cyl('chrome', V(fixed - 0.05, 0.85, door[0] + 0.15), V(fixed - 0.05, 1.45, door[0] + 0.15), 0.014, 8);
        sign('restrito', V(fixed - 0.01, 1.75, door[0] - 0.4), V(-1, 0, 0), 0.32);
      }
    };
    facade('x'); facade('z');
    // mesa de comando (bancada em L curta) diante da operadora (olhando −x)
    const W = STATIONS2.controle.worker; const dx0 = 50.25, dx1 = 51.08, dz0 = 7.32, dz1 = 9.4;
    box('desk', [(dx0 + dx1) / 2, 0.74, (dz0 + dz1) / 2], [dx1 - dx0, 0.035, dz1 - dz0]);
    box('cabinet', [(dx0 + dx1) / 2, 0.37, dz1 - 0.3], [dx1 - dx0 - 0.04, 0.72, 0.5]);
    box('steelDark', [dx0 + 0.1, 0.37, dz0 + 0.05], [0.05, 0.72, 0.05]); box('steelDark', [dx1 - 0.1, 0.37, dz0 + 0.05], [0.05, 0.72, 0.05]);
    box('cabinet', [dx0 + 0.04, 0.4, (dz0 + dz1) / 2], [0.03, 0.6, dz1 - dz0 - 0.1]);
    // monitores do supervisório (2) + teclado + mouse
    const mons = [[7.72, 0.25], [8.42, -0.12]];
    for (const [mz, ang] of mons) {
      const g = new THREE.Group(); g.position.set(dx0 + 0.22, 0.76, mz); g.rotation.y = Math.PI / 2 + ang; group.add(g);
      const base = new THREE.Mesh(G.boxGeo(0.22, 0.015, 0.18), M.blackPlasticI); base.position.y = 0.008; g.add(base);
      const arm = new THREE.Mesh(G.boxGeo(0.04, 0.28, 0.03), M.blackPlasticI); arm.position.set(0, 0.15, -0.04); g.add(arm);
      const bez = new THREE.Mesh(G.boxGeo(0.56, 0.34, 0.025), M.blackPlasticI); bez.position.set(0, 0.42, -0.02); g.add(bez);
      const cv = document.createElement('canvas'); cv.width = 768; cv.height = 432; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.3), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.35, 1.35, 1.35) })); sc.position.set(0, 0.42, -0.006); g.add(sc);
      ctx.screens.push({ ctx: cv.getContext('2d'), tex: t, W: 768, H: 432, kind: 'scada' });
    }
    box('blackPlastic', [dx0 + 0.55, 0.765, 7.75], [0.16, 0.018, 0.44], [0, 0.2, 0]);
    box('blackPlastic', [dx0 + 0.6, 0.765, 8.15], [0.07, 0.02, 0.05]);
    // livro de registro de segurança (NR-13) aberto + caneta + rádio + caneca
    box('paper', [dx0 + 0.6, 0.765, 8.75], [0.3, 0.012, 0.42], [0, -0.1, 0]); box('bookBlue', [dx0 + 0.6, 0.762, 8.75], [0.31, 0.008, 0.43], [0, -0.1, 0]);
    box('blackPlastic', [dx0 + 0.35, 0.83, 9.15], [0.06, 0.16, 0.035]); cyl('blackPlastic', V(dx0 + 0.35, 0.91, 9.15), V(dx0 + 0.35, 1.02, 9.15), 0.006, 6);
    cyl('mug', V(dx0 + 0.75, 0.758, 9.2), V(dx0 + 0.75, 0.855, 9.2), 0.04, 16);
    // cadeira giratória (assento a 0,47 m) no ponto da operadora, encosto para +x
    { const g = new THREE.Group(); g.position.set(W[0], 0, W[2]); g.rotation.y = STATIONS2.controle.workerRotY; group.add(g);
      const add = (geo, mat, p, s) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (s) m.scale.set(...s); m.castShadow = true; g.add(m); };
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; add(G.boxGeo(0.03, 0.03, 0.3), M.blackPlasticI, [Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15]); g.children[g.children.length - 1].rotation.y = a; add(G.unitCyl(10), M.blackPlasticI, [Math.sin(a) * 0.29, 0.03, Math.cos(a) * 0.29], [0.025, 0.05, 0.025]); }
      add(G.unitCyl(12), M.chromeI, [0, 0.25, 0], [0.025, 0.4, 0.025]);
      add(G.boxGeo(0.48, 0.07, 0.46), M.fabricI, [0, 0.47, 0.0]);
      add(G.boxGeo(0.44, 0.5, 0.06), M.fabricI, [0, 0.82, -0.27]); g.children[g.children.length - 1].rotation.x = 0.12;
      add(G.boxGeo(0.04, 0.2, 0.04), M.blackPlasticI, [0, 0.55, -0.25]); }
    // split (evaporadora) na parede z1 e condensadora sobre o forro
    box('white', [52.6, 2.35, z1 - 0.18], [0.95, 0.3, 0.22]); box('blackPlastic', [52.6, 2.23, z1 - 0.3], [0.85, 0.02, 0.03]);
    box('white', [54.4, h + 0.42, 7.0], [0.85, 0.62, 0.32]); cyl('steelDark', V(54.4, h + 0.45, 7.17), V(54.4, h + 0.45, 7.19), 0.23, 24);
    // luminária do forro, armário de arquivo, quadro de avisos
    box('lampPanel', [52.5, h - 0.005, 7.4], [1.2, 0.02, 0.6]);
    box('cabinet', [55.25, 0.75, 6.0], [0.5, 1.5, 0.9]);
    box('board', [x1 - 0.09, 1.6, 8.3], [0.02, 0.8, 1.2]);
  }

  // ═════════════ MESA DO AVALIADOR (TABLE2) ═════════════
  {
    const g = new THREE.Group(); g.position.set(TABLE2.pos[0], 0, TABLE2.pos[2]); g.rotation.y = TABLE2.rotY; group.add(g);
    const add = (geo, mat, p) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(G.boxGeo(1.4, 0.03, 0.75), M.deskI, [0, TABLE2.h - 0.015, 0]);
    add(G.boxGeo(1.36, 0.06, 0.71), M.steelDarkI, [0, TABLE2.h - 0.06, 0]);
    for (const sx of [-0.64, 0.64]) for (const sz of [-0.31, 0.31]) add(G.boxGeo(0.04, TABLE2.h - 0.06, 0.04), M.steelDarkI, [sx, (TABLE2.h - 0.06) / 2, sz]);
    add(G.boxGeo(1.3, 0.02, 0.6), M.steelDarkI, [0, 0.18, 0]);
    // prancheta com ficha de campo, caneta, garrafa de água
    add(G.boxGeo(0.23, 0.006, 0.32), M.boardI, [0.42, TABLE2.h + 0.003, 0.12]); add(G.boxGeo(0.21, 0.002, 0.29), M.paperI, [0.42, TABLE2.h + 0.007, 0.13]);
    add(G.unitCyl(8), M.blackPlasticI, [0.55, TABLE2.h + 0.01, 0.1]).scale.set(0.005, 0.14, 0.005); g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    const bottle = add(G.unitCyl(16), M.bottleI, [-0.55, TABLE2.h + 0.12, -0.2]); bottle.scale.set(0.035, 0.24, 0.035);
  }

  // ═════════════ GUARDA-CORPOS AMARELOS ═════════════
  const rail = (pts, posts = 1.4) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = V(pts[i][0], 0, pts[i][1]), b = V(pts[i + 1][0], 0, pts[i + 1][1]), L = a.distanceTo(b), n = Math.max(1, Math.round(L / posts));
      for (let k = 0; k <= n; k++) { if (k === 0 && i > 0) continue; const p = a.clone().lerp(b, k / n); cyl('paintYellow', V(p.x, 0, p.z), V(p.x, 1.1, p.z), 0.024, 10); box('paintYellow', [p.x, 0.005, p.z], [0.12, 0.01, 0.12]); }
      for (const y of [0.55, 1.1]) cyl('paintYellow', V(a.x, y, a.z), V(b.x, y, b.z), 0.022, 10);
      cyl('paintYellow', V(a.x, 0.07, a.z), V(b.x, 0.07, b.z), 0.012, 6);
    }
  };
  rail([[52.0, -8.1], [52.0, -5.05], [52.8, -5.05]]); rail([[54.35, -5.05], [55.7, -5.05]]);
  rail([[47.75, 1.5], [49.6, 1.5]]); rail([[51.4, 1.5], [53.25, 1.5], [53.25, 3.7], [51.0, 3.7]]);

  // ═════════════ EXTINTORES (piso demarcado) + placas ═════════════
  for (const [ex, ez, kind, n] of [[30.75, -3.0, 'pqs', V(1, 0, 0)], [55.3, 1.5, 'co2', V(-1, 0, 0)], [45.6, 9.3, 'pqs', V(0, 0, -1)]]) {
    const r = kind === 'co2' ? 0.075 : 0.09, hh = kind === 'co2' ? 0.68 : 0.5;
    box('steelDark', [ex, 0.03, ez], [0.32, 0.06, 0.32]);
    cyl('extRed', V(ex, 0.06, ez), V(ex, 0.06 + hh, ez), r, 24);
    batch.add('extRed', G.cached('extDome' + r, () => new THREE.SphereGeometry(r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2)), G.mat4([ex, 0.06 + hh, ez]));
    cyl(kind === 'co2' ? 'blackPlastic' : 'chrome', V(ex, 0.06 + hh + r * 0.8, ez), V(ex, 0.06 + hh + r + 0.06, ez), 0.025, 12);
    box('blackPlastic', [ex + 0.04, 0.06 + hh + r + 0.08, ez], [0.12, 0.015, 0.03]);
    G.cached('x', () => 0); cyl('blackPlastic', V(ex + 0.03, 0.06 + hh + r + 0.02, ez), V(ex + r + 0.02, 0.2, ez + 0.02), 0.012, 6);
    box('label', [ex + n.x * (r + 0.001), 0.06 + hh * 0.55, ez + n.z * (r + 0.001)], [n.x ? 0.002 : 0.1, 0.13, n.z ? 0.002 : 0.1]);
    sign('extintor', V(ex - n.x * 0.42 + (n.x ? 0 : 0), 1.85, ez - n.z * 0.42), n, 0.25);
  }

  // ═════════════ QUADROS ELÉTRICOS (CCM) na parede esquerda ═════════════
  for (let k = 0; k < 5; k++) { const z = -8.6 + k * 0.82; box('cabinet', [30.55, 1.05, z], [0.6, 2.1, 0.8]); box('steelDark', [30.86, 1.05, z + 0.39], [0.01, 2.0, 0.015]); box('chrome', [30.87, 1.1, z + 0.3], [0.02, 0.14, 0.025]); box('label', [30.86, 1.75, z], [0.004, 0.08, 0.3]);
    for (const yy of [1.55, 1.48]) cyl(k % 2 ? 'ledGreen' : 'ledRed', V(30.85, yy, z - 0.2), V(30.88, yy, z - 0.2), 0.012, 10); }
  box('paintDark', [30.55, 0.05, -6.96], [0.64, 0.1, 4.2]);
  sign('auricular', V(30.86, 2.5, -4.1), V(1, 0, 0), 0.3);

  // ═════════════ TRATAMENTO DE ÁGUA: abrandadores + tanque de salmoura + sacos de sal ═════════════
  for (const [x, z] of [[31.0, 6.3], [31.75, 6.3]]) { batch.add('frpBlue', G.shellGeo(0.27, 1.25, { top: 'ell', bot: 'ell', seg: 32, sheetW: 1, sheetL: 1 }), G.mat4([x, 0.2 + 0.135 + 0.625, z])); cyl('blackPlastic', V(x, 0.2, z), V(x, 0.33, z), 0.2, 20); box('blackPlastic', [x, 1.75, z], [0.22, 0.2, 0.18]); box('ledGreen', [x, 1.79, z + 0.091], [0.08, 0.04, 0.003]); }
  cyl('white', V(32.8, 0, 6.3), V(32.8, 1.1, 6.3), 0.38, 28); cyl('white', V(32.8, 1.1, 6.3), V(32.8, 1.13, 6.3), 0.4, 28);
  ctx.pipe('pvc', [V(31.0, 1.85, 6.3), V(31.0, 2.1, 6.3), V(31.75, 2.1, 6.3), V(31.75, 1.85, 6.3)], 0.02); ctx.pipe('pvc', [V(31.0, 2.1, 6.3), V(30.3, 2.1, 6.3), V(30.3, 2.1, 4.6)], 0.022);
  box('wood', [31.8, 0.07, 8.6], [1.2, 0.14, 1.0]); for (let k = 0; k < 6; k++) box('sack', [31.5 + (k % 2) * 0.58, 0.22 + Math.floor(k / 2) * 0.13, 8.35 + (k % 3 === 2 ? 0.5 : 0) + (k > 3 ? 0.25 : 0)], [0.55, 0.13, 0.4], [0, (k % 3) * 0.05, 0]);
  // dosagem química: tanques brancos 200 L com bomba dosadora
  for (const x of [34.2, 35.0]) { cyl('white', V(x, 0, 8.9), V(x, 0.95, 8.9), 0.3, 28); box('pumpBlue', [x, 1.03, 8.9], [0.16, 0.14, 0.2]); cyl('pvc', V(x + 0.05, 1.1, 8.9), V(x + 0.05, 2.6, 8.9), 0.008, 6); box('label', [x, 0.6, 8.9 - 0.301], [0.18, 0.12, 0.002]); }
  // tanque de descarga de fundo (canto do fundo à esquerda) com respiro
  batch.add('paintAlu', G.shellGeo(0.42, 1.0, { top: 'ell', bot: 'ell', seg: 40, sheetW: 1, sheetL: 1 }), G.mat4([31.3, 0.4 + 0.21 + 0.5, -9.1])); for (let k = 0; k < 3; k++) { const a = k * 2.09; cyl('paintBlue', V(31.3 + Math.cos(a) * 0.32, 0, -9.1 + Math.sin(a) * 0.32), V(31.3 + Math.cos(a) * 0.32, 0.5, -9.1 + Math.sin(a) * 0.32), 0.03, 8); }
  ctx.pipe('steelHot', [V(31.3, 2.0, -9.1), V(31.3, 10.8, -9.1)], 0.07); ctx.pipe('steelHot', [V(34.0, 0.25, -9.55), V(31.7, 0.25, -9.55), V(31.7, 0.9, -9.3)], 0.035, 0.1);

  // ═════════════ MANUTENÇÃO: tambores, carrinho de ferramentas, escada, bancada, hidrante, quadro de gaxetas ═════════════
  for (const [x, z, k] of [[54.7, -2.4, 'drumBlue'], [55.3, -2.15, 'drumBlue'], [55.25, -2.85, 'drumBlack']]) { cyl(k, V(x, 0, z), V(x, 0.88, z), 0.29, 28); for (const y of [0.29, 0.58]) cyl(k, V(x, y - 0.01, z), V(x, y + 0.01, z), 0.297, 28); cyl('steelDark', V(x + 0.15, 0.88, z), V(x + 0.15, 0.895, z), 0.03, 10); }
  { const x = 39.4, z = -0.95; box('toolRed', [x, 0.55, z], [0.75, 0.75, 0.45]); for (let k = 0; k < 4; k++) box('steelDark', [x, 0.3 + k * 0.17, z + 0.226], [0.6, 0.012, 0.004]); box('rubberMat', [x, 0.935, z], [0.74, 0.02, 0.44]);
    for (const [sx, sz] of [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]]) cyl('rubber', V(x + sx, 0.05, z + sz), V(x + sx, 0.12, z + sz), 0.05, 10);
    box('chrome', [x - 0.1, 0.955, z], [0.32, 0.018, 0.04], [0, 0.4, 0]); box('wheelRed', [x + 0.18, 0.96, z + 0.05], [0.2, 0.03, 0.06], [0, -0.3, 0]); cyl('chrome', V(x + 0.15, 0.95, z - 0.1), V(x + 0.15, 1.15, z - 0.1), 0.012, 8);
    cyl('steelDark', V(x - 0.38, 0.95, z - 0.2), V(x - 0.38, 1.0, z + 0.2), 0.012, 8); }
  { const z = 1.2; for (const s of [-1, 1]) { cyl('alu', V(30.3, 0, z + s * 0.22), V(30.62, 2.8, z + s * 0.19), 0.025, 8); } for (let k = 1; k < 9; k++) { const t = k / 9; cyl('alu', V(30.3 + t * 0.32, t * 2.8, z - 0.21), V(30.3 + t * 0.32, t * 2.8, z + 0.21), 0.015, 6); } }
  { box('wood', [40.2, 0.92, 9.55], [2.4, 0.06, 0.7]); box('steelDark', [40.2, 0.45, 9.55], [2.3, 0.9, 0.66]); box('cast', [39.3, 1.05, 9.35], [0.16, 0.14, 0.24]); box('board', [40.2, 1.75, 9.88], [2.2, 1.1, 0.03]);
    for (let k = 0; k < 7; k++) { const t = new THREE.TorusGeometry(0.08 + (k % 3) * 0.04, 0.012, 6, 24); batch.add(k % 2 ? 'gasket' : 'steelDark', t, G.mat4([39.4 + k * 0.28, 1.85 - (k % 2) * 0.25, 9.85])); } }
  box('extRed', [30.12, 1.55, 2.6], [0.24, 0.9, 0.7]); box('glassFrame', [30.245, 1.55, 2.6], [0.01, 0.6, 0.5]);
  // sinalização de parede
  sign('restrito', V(37.7, 2.6, HALL2.z1 - 0.12), V(0, 0, -1), 0.42);
  sign('auricular', V(36.5, 2.4, HALL2.z1 - 0.45), V(0, 0, -1), 0.34); sign('capacete', V(43.0, 2.4, HALL2.z1 - 0.45), V(0, 0, -1), 0.34);
  sign('auricular', V(43.0, 2.4, HALL2.z0 + 0.45), V(0, 0, 1), 0.34); sign('quente', V(49.5, 2.4, HALL2.z0 + 0.45), V(0, 0, 1), 0.34);
  sign('auricular', V(HALL2.x1 - 0.45, 2.4, 0.0), V(-1, 0, 0), 0.34);
  sign('saida', V(45.95, 2.45, HALL2.z1 - 0.13), V(0, 0, -1), 0.4, 0.25);
  sign('luvas', V(47.4, 1.0, -8.32), V(0, 0, 1), 0.2);
}
