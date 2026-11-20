// EQUIPAMENTOS — construtores dos 5 fornos (coordenadas locais: x centrado no forno, y do piso, z = 0 na parede do fundo,
// frente em z = o.d). Peças estáticas mescladas por material (Batch); portas em pivôs próprios; pães via ctx.bread (instancing).
import * as THREE from 'three';
import { Batch, cavityMaterial, displayMaterial } from './mach_geo.js';
import * as T from './mach_tex.js';

// ───────────── utilidades de chapa ─────────────
/** chapa com furos retangulares, bordas arredondadas (Extrude). Face frontal em zF, espessura th. */
export function plate(B, key, x0, y0, x1, y1, zF, th = 0.02, holes = [], bev = 0.004) {
  const s = new THREE.Shape(); s.moveTo(x0 + bev, y0 + bev); s.lineTo(x1 - bev, y0 + bev); s.lineTo(x1 - bev, y1 - bev); s.lineTo(x0 + bev, y1 - bev); s.closePath();
  for (const h of holes) { const p = new THREE.Path(); p.moveTo(h[0] - bev, h[1] - bev); p.lineTo(h[0] - bev, h[3] + bev); p.lineTo(h[2] + bev, h[3] + bev); p.lineTo(h[2] + bev, h[1] - bev); p.closePath(); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, th - 2 * bev), bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 2, curveSegments: 2 });
  return B.add(g, key, [0, 0, zF - th + bev]);
}
/** cavidade aberta na frente (5 faces internas) */
function cavity(B, keyWall, keyTop, keyFloor, x0, x1, y0, y1, zb, zf, keyBack = keyWall) {
  const w = x1 - x0, h = y1 - y0, d = zf - zb, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (zb + zf) / 2;
  B.plane(keyBack, w, h, [cx, cy, zb], [0, 0, 0]);                         // fundo
  B.plane(keyWall, d, h, [x0, cy, cz], [0, Math.PI / 2, 0]);               // esquerda (normal +x)
  B.plane(keyWall, d, h, [x1, cy, cz], [0, -Math.PI / 2, 0]);              // direita
  B.plane(keyTop, w, d, [cx, y1, cz], [Math.PI / 2, 0, 0]);                // teto (normal −y)
  B.plane(keyFloor, w, d, [cx, y0, cz], [-Math.PI / 2, 0, 0]);             // piso
}
function foot(B, x, z, h = 0.1) { B.cyl('steelPol', 0.022, h - 0.02, [x, 0.02 + (h - 0.02) / 2, z], 'y', 14); B.cyl('rubber', 0.032, 0.02, [x, 0.01, z], 'y', 16); }
/** puxador tubular entre suportes; axis 'x' (horizontal) ou 'y' */
function handle(B, a, b, out, r = 0.012, key = 'steelPol') {
  B.bar(key, a.map((v, i) => v + (i === 2 ? out : 0)), b.map((v, i) => v + (i === 2 ? out : 0)), r, 14);
  for (const p of [a, b]) B.bar(key, p, [p[0], p[1], p[2] + out], r * 0.75, 10);
}
/** grade de esteira (bandeja alumínio) */
function tray(B, cx, y, cz, w, d, key = 'alu') {
  B.box(key, cx - w / 2, y, cz - d / 2, cx + w / 2, y + 0.004, cz + d / 2, 0.0015, 1);
  for (const s of [-1, 1]) { B.box(key, cx - w / 2, y, cz + s * d / 2 - (s > 0 ? 0.01 : 0), cx + w / 2, y + 0.016, cz + s * d / 2 + (s < 0 ? 0.01 : 0), 0.002, 1); }
}
/** grelha de arame (FOTO 5) */
function wireRack(B, cx, y, cz, w, d, key = 'steelSat') {
  B.box(key, cx - w / 2, y - 0.004, cz - d / 2, cx + w / 2, y + 0.004, cz - d / 2 + 0.008, 0.002, 1);
  B.box(key, cx - w / 2, y - 0.004, cz + d / 2 - 0.008, cx + w / 2, y + 0.004, cz + d / 2, 0.002, 1);
  const n = Math.round(w / 0.03);
  for (let i = 0; i <= n; i++) { const x = cx - w / 2 + (i / n) * w; B.bar(key, [x, y, cz - d / 2], [x, y, cz + d / 2], 0.0022, 5); }
  for (const s of [-0.5, 0, 0.5]) B.bar(key, [cx - w / 2, y - 0.003, cz + s * d * 0.9], [cx + w / 2, y - 0.003, cz + s * d * 0.9], 0.003, 6);
}
/** junta/vedação: anel de 4 tiras (não tampa o vidro) */
function gasket(B, key, x0, y0, z0, x1, y1, z1, t = 0.018) {
  B.box(key, x0, y0, z0, x1, y0 + t, z1, 0.002, 1); B.box(key, x0, y1 - t, z0, x1, y1, z1, 0.002, 1);
  B.box(key, x0, y0 + t, z0, x0 + t, y1 - t, z1, 0.002, 1); B.box(key, x1 - t, y0 + t, z0, x1, y1 - t, z1, 0.002, 1);
}
const R = T.rng(1234);
const jit = (a) => (R() - 0.5) * 2 * a;

// ───────────── porta articulada com vidro (turbo/rotativo/vitrine) ─────────────
/** cria pivô + porta. side: 'L' (dobradiça à esquerda, abre para −x) | 'R'. Retorna {pivot, B} (B em coords do pivô). */
function doorPivot(group, hx, z) { const p = new THREE.Group(); p.position.set(hx, 0, z); group.add(p); return p; }

// ═════════════════════════════ FORNO TURBO 1 (FOTO 2) ═════════════════════════════
export function buildTurbo(o, ctx) {
  const { M } = ctx, g = new THREE.Group(), B = new Batch(), d = o.d, W = o.w / 2, H = o.h;
  const dr = o.doors[0], ox0 = dr.cx - dr.w / 2, ox1 = dr.cx + dr.w / 2, oy0 = dr.y0, oy1 = dr.y0 + dr.h;
  const zF = d - 0.035;                                  // plano frontal do corpo
  // corpo: laterais, topo, base
  B.box('steel', -W, 0.12, 0.02, -W + 0.02, H, zF, 0.004); B.box('steel', W - 0.02, 0.12, 0.02, W, H, zF, 0.004);
  B.box('steel', -W, H - 0.02, 0.02, W, H, zF, 0.004);
  // frente: chapa com recorte da porta e do painel
  const px0 = o.panel.cx - o.panel.w / 2 + 0.07, px1 = o.panel.cx + o.panel.w / 2 - 0.05, py0 = 1.08, py1 = H - 0.08;
  plate(B, 'steel', -W, 0.5, W, H, zF + 0.02, 0.02, [[ox0 - 0.03, oy0 - 0.03, ox1 + 0.03, oy1 + 0.03], [px0, py0, px1, py1]], 0.004);
  // moldura do painel (degrau) e vidro preto do comando
  plate(B, 'steelPol', px0 - 0.012, py0 - 0.012, px1 + 0.012, py1 + 0.012, zF + 0.024, 0.006, [[px0, py0, px1, py1]], 0.002);
  const pnl = T.turboPanel({ temp: 180, time: 25 }); ctx.panelTex.forno1 = pnl;
  const pMat = displayMaterial(pnl, 2.2); ctx.mats.push(pMat);
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, py1 - py0), pMat); pm.position.set((px0 + px1) / 2, (py0 + py1) / 2, zF + 0.012); g.add(pm);
  (ctx.ctrls ||= []).push({ id: o.id, kind: 'turbo', k: 0, tex: pnl, mesh: pm });
  ctx.panelButton = new THREE.Object3D(); ctx.panelButton.position.set((px0 + px1) / 2, py1 - (py1 - py0) * 0.62, zF + 0.02); g.add(ctx.panelButton);
  // faixa/ressalto abaixo da porta e gabinete inferior (FOTO 2: friso horizontal, rebaixo escuro, painel, rodapé)
  B.box('steelPol', -W, 0.455, zF - 0.01, W, 0.5, zF + 0.035, 0.006);
  B.box('steelSat', -W + 0.02, 0.4, zF - 0.06, W - 0.02, 0.455, zF - 0.02, 0.002);
  B.box('steel', -W + 0.005, 0.13, zF - 0.03, W - 0.005, 0.4, zF + 0.005, 0.005);
  B.box('steelSat', -W + 0.01, 0.04, zF - 0.09, W - 0.01, 0.13, zF - 0.05, 0.003);
  B.box('grille', -W + 0.1, 0.17, zF + 0.0055, -W + 0.4, 0.19, zF + 0.0065, 0);        // fenda de ventilação do gabinete
  for (const x of [-W + 0.07, W - 0.07]) for (const z of [0.12, zF - 0.12]) foot(B, x, z, 0.06);
  // costura vertical lateral e parafusos
  for (const y of [0.6, 1.0, 1.4, 1.8]) for (const x of [-W + 0.03, W - 0.03]) B.cyl('steelPol', 0.004, 0.003, [x, y, zF + 0.0215], 'z', 8);
  // cavidade incandescente
  const cz0 = zF - 0.56, cz1 = zF - 0.01;
  cavity(B, 'cav1', 'cav1t', 'cav1f', ox0, ox1, oy0, oy1, cz0, cz1, 'cav1b');
  gasket(B, 'steelDark', ox0 - 0.03, oy0 - 0.03, zF - 0.05, ox1 + 0.03, oy1 + 0.03, zF + 0.01, 0.032);   // batente da boca
  // guias laterais e esteiras com pães (5 níveis)
  const levels = [0.665, 0.845, 1.025, 1.205, 1.385];
  // estante lateral cromada: montantes na frente e no fundo de cada lado + trilho por nível (as esteiras apoiam nele)
  const rz0 = cz0 + 0.04, rz1 = cz1 - 0.07;
  for (const x of [ox0 + 0.018, ox1 - 0.018]) {
    for (const z of [rz0, rz1]) B.box('chrome', x - 0.006, oy0 + 0.02, z - 0.006, x + 0.006, oy1 - 0.08, z + 0.006, 0.002, 1);
    for (const y of levels) B.box('chrome', x - 0.007, y - 0.014, rz0, x + 0.007, y - 0.004, rz1, 0.002, 1);
  }
  for (const y of levels) {
    wireRack(B, (ox0 + ox1) / 2, y - 0.002, (rz0 + rz1) / 2, ox1 - ox0 - 0.03, rz1 - rz0, 'chrome');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = ox0 + 0.04 + (i + 0.5) * (ox1 - ox0 - 0.08) / 4 + jit(0.008), z = rz0 + 0.07 + j * 0.15 + jit(0.01);
      ctx.bread('bun', g, x, y + 0.002, z, R() * 6.28, 0.95 + jit(0.06), 0.7 + 0.16 * j + 0.2 * (y - 0.6));
    }
  }
  // lâmpadas halógenas na parede esquerda (FOTO 2: dois clarões à esquerda no alto)
  for (const [y, z] of [[1.6, cz1 - 0.1], [1.31, cz1 - 0.1]]) { B.cyl('lamp', 0.028, 0.012, [ox0 + 0.006, y, z], 'x', 18); ctx.glow(g, ox0 + 0.03, y, z, 0.22, 1.0); }
  ctx.lightAnchor.forno1 = new THREE.Vector3(o.x + (ox0 + ox1) / 2 - 0.1, oy1 - 0.04, -6 + cz1 - 0.2);
  // ── porta (dobradiça à esquerda)
  const dx0 = ox0 - 0.055, dx1 = ox1 + 0.055, dy0 = oy0 - 0.055, dy1 = oy1 + 0.055, dth = 0.065;
  const piv = doorPivot(g, dx0, zF + 0.022); const D = new Batch();
  const L = dx1 - dx0, gx0 = 0.095, gx1 = L - 0.095, gy0 = dy0 + 0.095, gy1 = dy1 - 0.095;
  plate(D, 'steel', 0, dy0, L, dy1, dth, dth, [[gx0 - 0.03, gy0 - 0.03, gx1 + 0.03, gy1 + 0.03]], 0.008);             // moldura externa
  plate(D, 'steelPol', gx0 - 0.03, gy0 - 0.03, gx1 + 0.03, gy1 + 0.03, dth - 0.012, 0.014, [[gx0, gy0, gx1, gy1]], 0.003); // degrau interno
  plate(D, 'black', gx0 - 0.004, gy0 - 0.004, gx1 + 0.004, gy1 + 0.004, dth - 0.02, 0.006, [[gx0 + 0.022, gy0 + 0.022, gx1 - 0.022, gy1 - 0.022]], 0.001); // serigrafia preta do vidro
  D.plane('glass', gx1 - gx0, gy1 - gy0, [(gx0 + gx1) / 2, (gy0 + gy1) / 2, dth - 0.022]);
  D.plane('fxTurbo', gx1 - gx0, gy1 - gy0, [(gx0 + gx1) / 2, (gy0 + gy1) / 2, dth - 0.019]);
  D.plane('glassClear', gx1 - gx0 + 0.04, gy1 - gy0 + 0.04, [(gx0 + gx1) / 2, (gy0 + gy1) / 2, 0.004]);
  gasket(D, 'rubber', 0.02, dy0 + 0.02, -0.004, L - 0.02, dy1 - 0.02, 0.003);
  // puxador vertical na borda direita (embutido)
  handle(D, [L - 0.045, 0.86, dth], [L - 0.045, 1.42, dth], 0.04, 0.011);
  // dobradiças
  for (const y of [dy0 + 0.12, dy1 - 0.12]) D.cyl('steelPol', 0.014, 0.09, [-0.012, y, dth * 0.5], 'y', 12);
  D.build(M, piv, { name: 'forno1-door' });
  ctx.doorObjs.forno1 = [{ pivot: piv, type: 'hinge', sign: -1, max: 1.78 }];
  ctx.steam.forno1 = [{ x0: o.x + ox0, x1: o.x + ox1, y: oy1, z: -6 + zF + 0.05, ceil: 2.32 }];
  // coifa sobre o forno + duto
  hood(B, -W - 0.12, W + 0.12, 2.32, 2.72, d + 0.45);
  B.box('steelSat', -0.17, 2.72, 0.08, 0.17, 4.0, 0.42, 0.004);
  // adesivo "superfície quente" na moldura
  ctx.sticker(g, dx0 + 0.05 + L - 0.18, dy1 - 0.06, zF + 0.022 + dth + 0.001, 0.07);
  B.build(M, g, { name: 'forno1' });
  return g;
}
/** coifa inox de exaustão: caixa trapezoidal com faixa lisa e filtros escuros na face inferior */
function hood(B, x0, x1, y0, y1, zf) {
  const zb = 0.02, s = new THREE.Shape();
  s.moveTo(zb, y1); s.lineTo(zf - 0.04, y1); s.lineTo(zf, y1 - 0.18); s.lineTo(zf, y0); s.lineTo(zb, y0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
  B.add(g, 'steel', [x0, 0, 0], [0, -Math.PI / 2, 0], [1, 1, 1]).applyMatrix4(new THREE.Matrix4().makeTranslation(x1 - x0, 0, 0));
  B.box('grilleHood', x0 + 0.05, y0 - 0.026, zb + 0.07, x1 - 0.05, y0 - 0.02, zf - 0.07, 0);           // filtros (escuros)
  const n = Math.max(2, Math.round((x1 - x0) / 0.5));
  for (let i = 1; i < n; i++) { const x = x0 + (i / n) * (x1 - x0); B.box('steelSat', x - 0.012, y0 - 0.034, zb + 0.06, x + 0.012, y0 - 0.006, zf - 0.06, 0.002, 1); }
  B.box('steelPol', x0, y0 - 0.012, zf - 0.03, x1, y0 + 0.012, zf + 0.004, 0.004); // calha frontal
}
// a geometria da coifa é extrudada ao longo de z e girada: −π/2 em y leva +z (extrusão) → +x? (corrigido pela translação)

// ═════════════════════════════ FORNO DE CONVECÇÃO COM JANELA (FOTO 5) ═════════════════════════════
export function buildVitrine(o, ctx) {
  const { M } = ctx, g = new THREE.Group(), B = new Batch(), d = o.d, W = o.w / 2;
  const dr = o.doors[0], ox0 = dr.cx - dr.w / 2, ox1 = dr.cx + dr.w / 2, oy0 = dr.y0, oy1 = dr.y0 + dr.h;
  const bx0 = -W, bx1 = o.panel.cx - o.panel.w / 2 - 0.06, by0 = 0.44, by1 = o.h, zF = d - 0.03;
  // bancada-suporte inox (pés tubulares, prateleira inferior)
  B.box('steel', -W, 0.385, 0.05, W, 0.425, d + 0.04, 0.006);
  for (const x of [-W + 0.04, W - 0.04]) for (const z of [0.09, d]) { B.cyl('steelSat', 0.02, 0.37, [x, 0.2, z], 'y', 12); B.cyl('rubber', 0.024, 0.02, [x, 0.01, z], 'y', 12); }
  B.box('steelSat', -W + 0.03, 0.12, 0.08, W - 0.03, 0.135, d + 0.01, 0.003);
  // assadeiras empilhadas na prateleira
  for (let k = 0; k < 4; k++) tray(B, -0.2, 0.137 + k * 0.022, d * 0.55, 0.6, 0.4, 'aluNew');
  // pés curtos da caixa (FOTO 5)
  for (const x of [bx0 + 0.07, bx1 - 0.07]) for (const z of [0.15, zF - 0.08]) B.cyl('steelPol', 0.024, 0.03, [x, 0.44, z], 'y', 14);
  // caixa
  B.box('steel', bx0, by0 + 0.015, 0.02, bx0 + 0.02, by1, zF, 0.004); B.box('steel', bx1 - 0.02, by0 + 0.015, 0.02, bx1, by1, zF, 0.004);
  B.box('steel', bx0, by1 - 0.02, 0.02, bx1, by1, zF, 0.004); B.box('steel', bx0, by0 + 0.015, 0.02, bx1, by0 + 0.035, zF, 0.004);
  const topY = oy1 + 0.13;
  plate(B, 'steel', bx0, by0 + 0.015, bx1, by1, zF + 0.02, 0.02, [[ox0 - 0.08, oy0 - 0.08, ox1 + 0.08, topY - 0.02]], 0.006);
  // grelha superior (2 fendas largas) e rodapé com fendas verticais
  B.box('grille', bx0 + 0.07, by1 - 0.085, zF + 0.019, bx1 - 0.07, by1 - 0.06, zF + 0.022, 0);
  B.box('grille', bx0 + 0.07, by1 - 0.115, zF + 0.019, bx1 - 0.07, by1 - 0.095, zF + 0.022, 0);
  B.box('steelPol', bx0, topY - 0.02, zF + 0.0, bx1, topY + 0.008, zF + 0.03, 0.006);
  const nS = 70; for (let i = 0; i < nS; i++) { const x = bx0 + 0.1 + (i + 0.5) * (bx1 - bx0 - 0.2) / nS; B.box('grille', x - 0.003, by0 + 0.03, zF + 0.019, x + 0.003, by0 + 0.065, zF + 0.022, 0); }
  // cavidade + grelhas + pães rústicos
  const cz0 = zF - 0.62, cz1 = zF - 0.01;
  cavity(B, 'cav2', 'cav2t', 'cav2f', ox0, ox1, oy0, oy1, cz0, cz1);
  for (const x of [ox0 + 0.025, ox1 - 0.025]) { // escadas laterais (racks com furos)
    for (let k = 0; k < 9; k++) B.box('steelDark', x - 0.012, oy0 + 0.04 + k * 0.075, cz0 + 0.04, x + 0.012, oy0 + 0.052 + k * 0.075, cz1 - 0.1, 0.001, 1);
  }
  const lv = [oy0 + 0.1, oy0 + 0.33, oy0 + 0.56];
  lv.forEach((y, k) => {
    wireRack(B, (ox0 + ox1) / 2, y, (cz0 + cz1) / 2, ox1 - ox0 - 0.06, 0.52);
    const n = k === 2 ? 2 : 3;
    for (let i = 0; i < n; i++) { const x = (ox0 + ox1) / 2 + (i - (n - 1) / 2) * 0.27 + jit(0.01); ctx.bread('boule', g, x, y + 0.004, (cz0 + cz1) / 2 + 0.06 + jit(0.02), jit(0.15), 1.18 + jit(0.06), 1.2); }
  });
  for (const x of [-0.13, 0.13]) { const X = (ox0 + ox1) / 2 + x; B.cyl('lamp', 0.032, 0.014, [X, oy1 - 0.008, cz0 + 0.12], 'y', 16); ctx.glow(g, X, oy1 - 0.04, cz0 + 0.14, 0.34, 1.4); }
  // ── porta (puxador vertical à esquerda → dobradiça à direita)
  const dx0 = ox0 - 0.07, dx1 = ox1 + 0.07, dy0 = oy0 - 0.07, dy1 = oy1 + 0.07, dth = 0.05, Lw = dx1 - dx0;
  const piv = doorPivot(g, dx1, zF + 0.022); const D = new Batch();
  plate(D, 'steelPol', -Lw, dy0, 0, dy1, dth, dth, [[-Lw + 0.07, dy0 + 0.07, -0.07, dy1 - 0.07]], 0.008);
  plate(D, 'black', -Lw + 0.06, dy0 + 0.06, -0.06, dy1 - 0.06, dth - 0.012, 0.006, [[-Lw + 0.085, dy0 + 0.085, -0.085, dy1 - 0.085]], 0.002);
  D.plane('glassClear', Lw - 0.13, dy1 - dy0 - 0.13, [-Lw / 2, (dy0 + dy1) / 2, dth - 0.016]);
  D.plane('fxVit', Lw - 0.13, dy1 - dy0 - 0.13, [-Lw / 2, (dy0 + dy1) / 2, dth - 0.013]);
  handle(D, [-Lw + 0.035, oy0 + 0.12, dth], [-Lw + 0.035, oy1 - 0.12, dth], 0.035, 0.011);
  gasket(D, 'rubber', -Lw + 0.02, dy0 + 0.02, -0.004, -0.02, dy1 - 0.02, 0.003);
  D.build(M, piv, { name: 'forno2-door' });
  ctx.doorObjs.forno2 = [{ pivot: piv, type: 'hinge', sign: 1, max: 1.7 }];
  ctx.steam.forno2 = [{ x0: o.x + ox0, x1: o.x + ox1, y: oy1, z: -6 + zF + 0.05 }];
  // duto de exaustão até o teto + conduíte preto
  B.cyl('steelSat', 0.1, 4.0 - by1, [(bx0 + bx1) / 2, (4.0 + by1) / 2, d * 0.45], 'y', 28);
  B.cyl('steelPol', 0.125, 0.06, [(bx0 + bx1) / 2, by1 + 0.03, d * 0.45], 'y', 28);
  const cpath = new THREE.CatmullRomCurve3([new THREE.Vector3(bx0 + 0.18, by1, d * 0.4), new THREE.Vector3(bx0 + 0.16, by1 + 0.1, d * 0.5), new THREE.Vector3(bx0 + 0.32, by1 + 0.16, d * 0.5), new THREE.Vector3(bx0 + 0.36, by1 + 0.02, d * 0.42)]);
  B.add(new THREE.TubeGeometry(cpath, 20, 0.012, 8), 'black');
  // ── torre de comando separada
  const tx0 = o.panel.cx - o.panel.w / 2 + 0.03, tx1 = o.panel.cx + o.panel.w / 2 - 0.03, ty0 = 0.43, ty1 = 1.33, tz0 = zF - 0.3, tz1 = zF - 0.04;
  B.box('steel', tx0, ty0 + 0.04, tz0, tx1, ty1, tz1, 0.012, 3);
  for (const x of [tx0 + 0.03, tx1 - 0.03]) for (const z of [tz0 + 0.03, tz1 - 0.03]) B.cyl('steelPol', 0.012, 0.04, [x, ty0 + 0.02, z], 'y', 10);
  const tp = T.towerPanel(), tm = displayMaterial(tp, 2.0); ctx.mats.push(tm);
  const pw = tx1 - tx0 - 0.03, ph = pw * 3;
  const tpm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), tm); tpm.position.set((tx0 + tx1) / 2, ty1 - 0.04 - ph / 2, tz1 + 0.0015); g.add(tpm);
  (ctx.ctrls ||= []).push({ id: o.id, kind: 'tower', k: 0, tex: tp, mesh: tpm });
  // botão de emergência (cogumelo vermelho)
  const ey = ty1 - 0.04 - ph * (470 / 768);
  B.cyl('redPaint', 0.024, 0.02, [(tx0 + tx1) / 2, ey, tz1 + 0.012], 'z', 24);
  B.add(new THREE.SphereGeometry(0.03, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), 'redPaint', [(tx0 + tx1) / 2, ey, tz1 + 0.012], [Math.PI / 2, 0, 0], [1, 0.45, 1]);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.42, pw * 0.84), new THREE.MeshStandardMaterial({ map: T.pictoTexture(), roughness: 0.4 }));
  pic.position.set((tx0 + tx1) / 2, ty1 - 0.06 - ph - pw * 0.5, tz1 + 0.001); g.add(pic);
  ctx.sticker(g, dx0 + 0.07, dy1 - 0.04, zF + 0.022 + dth + 0.001, 0.06);
  B.build(M, g, { name: 'forno2' });
  return g;
}

// ═════════════════════════════ LASTRO 4 CÂMARAS (FOTO 4) ═════════════════════════════
export function buildLastro4(o, ctx) {
  const { M } = ctx, g = new THREE.Group(), B = new Batch(), d = o.d, W = o.w / 2;
  const zF = d - 0.03, colL1 = -W + 0.235, colR0 = o.panel.cx - o.panel.w / 2;
  const doors = o.doors, dx0 = doors[0].cx - doors[0].w / 2, dx1 = doors[0].cx + doors[0].w / 2;
  // base: pés quadrados, travessas
  const baseTop = 0.4;
  for (const x of [-W + 0.03, W - 0.03]) for (const z of [0.1, zF - 0.04]) B.box('steelSat', x - 0.025, 0.02, z - 0.025, x + 0.025, baseTop, z + 0.025, 0.004);
  for (const x of [-W + 0.03, W - 0.03]) for (const z of [0.1, zF - 0.04]) foot(B, x, z, 0.03);
  B.box('steelSat', -W + 0.03, 0.12, zF - 0.06, W - 0.03, 0.15, zF - 0.02, 0.003);
  B.box('steel', -W, baseTop - 0.02, 0.05, W, baseTop + 0.04, zF + 0.01, 0.006);
  // laterais e corpo
  B.box('steel', -W, baseTop, 0.03, -W + 0.02, 2.12, zF, 0.004); B.box('steel', W - 0.02, baseTop, 0.03, W, 2.12, zF, 0.004);
  // colunas frontais (esq. e dir.)
  B.box('steel', -W, baseTop + 0.04, zF - 0.02, colL1, 2.12, zF + 0.02, 0.006);
  B.box('steel', colR0, baseTop + 0.04, zF - 0.02, W, 2.12, zF + 0.02, 0.006);
  B.box('steelSat', colL1, baseTop + 0.04, zF - 0.04, colL1 + 0.012, 2.12, zF + 0.005, 0.002, 1);
  B.box('steelSat', colR0 - 0.012, baseTop + 0.04, zF - 0.04, colR0, 2.12, zF + 0.005, 0.002, 1);
  // câmaras
  const cz0 = 0.22, cz1 = zF - 0.03;
  doors.forEach((dr, k) => {
    const y0 = dr.y0, y1 = dr.y0 + dr.h;
    // frontal entre câmaras (faixa inox + puxador horizontal abaixo de cada porta)
    const fy0 = y0 - 0.16 + (k === 0 ? 0.07 : 0), fy1 = y0 - 0.025;
    B.box('steel', colL1 + 0.012, fy0, zF - 0.02, colR0 - 0.012, fy1 + 0.013, zF + 0.025, 0.006);
    handle(B, [dx0 + 0.12, (fy0 + fy1) / 2 + 0.005, zF + 0.025], [dx1 - 0.12, (fy0 + fy1) / 2 + 0.005, zF + 0.025], 0.04, 0.012);
    // moldura preta da boca + interior
    plate(B, 'black', dx0 - 0.04, y0 - 0.012, dx1 + 0.04, y1 + 0.016, zF + 0.0, 0.03, [[dx0 + 0.005, y0 + 0.005, dx1 - 0.005, y1 - 0.005]], 0.003);
    for (const [sx, sy] of [[dx0 - 0.02, y1 + 0.004], [dx1 + 0.02, y1 + 0.004], [(dx0 + dx1) / 2, y1 + 0.004], [dx0 - 0.02, y0], [dx1 + 0.02, y0]]) B.cyl('steelPol', 0.006, 0.006, [sx, sy, zF + 0.003], 'z', 10);
    for (const sx of [dx0 - 0.03, dx1 + 0.03]) B.box('blackGloss', sx - 0.02, y1 + 0.016, zF - 0.004, sx + 0.02, y1 + 0.04, zF + 0.006, 0.002, 1);
    cavity(B, 'cav4', 'cav4t', 'cav4f', dx0, dx1, y0, y1, cz0, cz1 - 0.03);
    // lastro (pedra) e pães franceses
    B.box('stone', dx0 + 0.01, y0, cz0 + 0.02, dx1 - 0.01, y0 + 0.012, cz1 - 0.05, 0, 1);
    // pão ~23 cm (roll = 17 cm × escala ~1,35), 7 por fileira, 4 fileiras sobre a pedra
    for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) {
      const x = dx0 + 0.1 + i * (dx1 - dx0 - 0.2) / 6 + jit(0.01), z = cz1 - 0.22 - r * 0.3 + jit(0.025);
      ctx.bread('roll', g, x, y0 + 0.012, z, Math.PI / 2 + jit(0.14), 1.35 + jit(0.08), 1.05 - r * 0.1);
    }
    // fileira de lâmpadas no alto da boca (reflexos pontilhados da FOTO 4)
    for (let i = 0; i < 6; i++) { const x = dx0 + 0.1 + i * (dx1 - dx0 - 0.2) / 5; B.cyl('lamp', 0.012, 0.008, [x, y1 - 0.004, cz1 - 0.12], 'y', 10); B.cyl('lamp', 0.016, 0.006, [x, y1 - 0.045, cz0 + 0.004], 'z', 12); }
    ctx.glow(g, (dx0 + dx1) / 2, y1 - 0.04, cz1 - 0.15, 0.55, 0.6);
    // coluna esquerda: painel preto vertical + manete (registro de vapor)
    const lx = (-W + colL1) / 2;
    B.box('black', lx - 0.035, y0 - 0.06, zF + 0.02, lx + 0.035, y1 + 0.03, zF + 0.03, 0.004);
    B.box('blackGloss', lx - 0.022, y0 - 0.03, zF + 0.03, lx + 0.022, y1, zF + 0.034, 0.002, 1);
    B.bar('steelPol', [lx - 0.075, y0 + 0.02, zF + 0.04], [lx - 0.035, y0 + 0.02, zF + 0.04], 0.006);
    B.add(new THREE.SphereGeometry(0.014, 12, 8), 'black', [lx - 0.08, y0 + 0.02, zF + 0.04]);
    // coluna direita: controlador digital vermelho/verde
    const rx = (colR0 + W) / 2, cw = 0.15, ch = 0.21, cy = (y0 + y1) / 2 + 0.02;
    B.box('black', rx - cw / 2 - 0.01, cy - ch / 2 - 0.01, zF + 0.02, rx + cw / 2 + 0.01, cy + ch / 2 + 0.01, zF + 0.035, 0.006);
    const ct = T.deckController([[230 - k * 2, 248 - k * 3]]); const cm = displayMaterial(ct, 2.2); ctx.mats.push(cm);
    const cmesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), cm); cmesh.position.set(rx, cy, zF + 0.0365); g.add(cmesh);
    (ctx.ctrls ||= []).push({ id: o.id, kind: 'deck', k, tex: ct, mesh: cmesh });
    // porta basculante (dobradiça embaixo)
    const piv = doorPivot(g, 0, zF + 0.03); piv.position.y = y0 - 0.02; const D = new Batch();
    const ph = y1 - y0 + 0.045;
    plate(D, 'black', dx0 - 0.015, 0, dx1 + 0.015, ph, 0.03, 0.03, [[dx0 + 0.03, 0.035, dx1 - 0.03, ph - 0.035]], 0.004);
    D.plane('glassDark', dx1 - dx0 - 0.055, ph - 0.065, [(dx0 + dx1) / 2, ph / 2, 0.022]);
    D.plane('fxDeck', dx1 - dx0 - 0.055, ph - 0.065, [(dx0 + dx1) / 2, ph / 2, 0.025]);
    D.box('steelPol', dx0 + 0.25, ph - 0.02, 0.03, dx1 - 0.25, ph - 0.008, 0.045, 0.004, 1);
    D.build(M, piv, { name: `vertical-door${k}` });
    (ctx.doorObjs.vertical ||= []).push({ pivot: piv, type: 'drop', sign: 1, max: 1.15, delay: k * 0.12, base: 0.11 });
    (ctx.steam.vertical ||= []).push({ x0: o.x + dx0, x1: o.x + dx1, y: y1, z: -6 + zF + 0.05, ceil: 2.13 });
  });
  // fascia superior e coifa saliente
  B.box('steel', -W, 1.96, zF - 0.02, W, 2.13, zF + 0.025, 0.006);
  const cs = new THREE.Shape(); cs.moveTo(0, 2.13); cs.lineTo(d + 0.14, 2.13); cs.lineTo(d + 0.16, 2.42); cs.lineTo(d + 0.12, 2.45); cs.lineTo(0, 2.45); cs.closePath();
  const cg = new THREE.ExtrudeGeometry(cs, { depth: o.w + 0.06, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
  cg.rotateY(-Math.PI / 2); cg.translate(W + 0.03, 0, 0);
  B.add(cg, 'steel');
  B.box('grille', -W + 0.02, 2.128, zF + 0.04, W - 0.02, 2.134, d + 0.1, 0);           // fenda de exaustão sob a coifa
  B.box('steelSat', -0.2, 2.45, 0.2, 0.2, 4.0, 0.55, 0.004);                         // duto
  // rampa de chapa xadrez (plataforma diante do forno)
  ramp(B, dx0 - 0.08, dx1 + 0.08, zF + 0.04, zF + 1.0, 0.22, 0.05);
  ctx.sticker(g, colR0 - 0.08, 2.05, zF + 0.026, 0.065);
  B.build(M, g, { name: 'vertical' });
  return g;
}
/** plataforma/rampa de chapa xadrez: borda do forno a hBack, borda frontal a hFront */
export function ramp(B, x0, x1, z0, z1, hBack, hFront) {
  const L = Math.hypot(z1 - z0, hBack - hFront), a = Math.atan2(hBack - hFront, z1 - z0);
  B.add(new THREE.BoxGeometry(x1 - x0, 0.006, L), 'tread', [(x0 + x1) / 2, (hBack + hFront) / 2, (z0 + z1) / 2], [a, 0, 0]);
  for (const x of [x0 + 0.02, x1 - 0.02]) B.add(new THREE.BoxGeometry(0.03, 0.04, L), 'steelSat', [x, (hBack + hFront) / 2 - 0.022, (z0 + z1) / 2], [a, 0, 0]);
  if (hBack > 0.08) for (const x of [x0 + 0.04, x1 - 0.04]) { B.box('steelSat', x - 0.015, 0, z0 + 0.02, x + 0.015, hBack - 0.01, z0 + 0.05, 0.002); B.box('steelSat', x - 0.015, 0, z1 - 0.12, x + 0.015, hFront + 0.01, z1 - 0.09, 0.002); }
}

// ═════════════════════════════ LASTRO LARGO 3 CÂMARAS (FOTO 3) ═════════════════════════════
export function buildLastro(o, ctx) {
  const { M } = ctx, g = new THREE.Group(), B = new Batch(), d = o.d, W = o.w / 2, H = o.h;
  const zF = d - 0.03, pc0 = o.panel.cx - o.panel.w / 2, pc1 = o.panel.cx + o.panel.w / 2;
  const doors = o.doors, dx0 = doors[0].cx - doors[0].w / 2, dx1 = doors[0].cx + doors[0].w / 2;
  B.box('steel', -W, 0.08, 0.03, -W + 0.02, H, zF, 0.004); B.box('steel', W - 0.02, 0.08, 0.03, W, H, zF, 0.004);
  // base com 2 portas inox (armário)
  B.box('steelSat', -W + 0.02, 0.03, zF - 0.07, W - 0.02, 0.09, zF - 0.03, 0.003);
  for (const x of [-W + 0.08, W - 0.08]) for (const z of [0.15, zF - 0.12]) foot(B, x, z, 0.06);
  B.box('steel', -W, 0.08, zF - 0.03, W, 0.92, zF, 0.005);
  const half = (-W + W) / 2;
  for (const [a, b] of [[-W + 0.03, half - 0.006], [half + 0.006, W - 0.03]]) {
    B.box('steel', a, 0.11, zF, b, 0.89, zF + 0.022, 0.006);
    const hx = a < 0 ? b - 0.06 : a + 0.06; handle(B, [hx, 0.55, zF + 0.022], [hx, 0.8, zF + 0.022], 0.035, 0.01);
  }
  // frente das câmaras: chapa com 3 bocas + coluna do painel
  const holes = doors.map((dr) => [dx0 - 0.04, dr.y0 - 0.03, dx1 + 0.04, dr.y0 + dr.h + 0.03]);
  plate(B, 'steel', -W, 0.92, W, 1.98, zF + 0.02, 0.02, holes, 0.005);
  const cz0 = 0.2, cz1 = zF - 0.02;
  doors.forEach((dr, k) => {
    const y0 = dr.y0, y1 = dr.y0 + dr.h;
    plate(B, 'black', dx0 - 0.04, y0 - 0.03, dx1 + 0.04, y1 + 0.03, zF + 0.0, 0.025, [[dx0, y0, dx1, y1]], 0.003);
    cavity(B, 'cav3', 'cav3t', 'cav3f', dx0, dx1, y0, y1, cz0, cz1 - 0.02);
    B.box('stone', dx0 + 0.01, y0, cz0 + 0.02, dx1 - 0.01, y0 + 0.012, cz1 - 0.04, 0, 1);
    // baguetes ao longo da profundidade
    const n = 12; // pão ~23 cm, 12 por fileira, 5 fileiras
    for (let r = 0; r < 5; r++) for (let i = 0; i < n; i++) {
      const x = dx0 + 0.11 + i * (dx1 - dx0 - 0.22) / (n - 1) + jit(0.01), z = cz1 - 0.24 - r * 0.32 + jit(0.025);
      ctx.bread('roll', g, x, y0 + 0.012, z, Math.PI / 2 + jit(0.12), 1.38 + jit(0.08), 1.05 - r * 0.09);
    }
    for (let i = 0; i < 9; i++) { const x = dx0 + 0.12 + i * (dx1 - dx0 - 0.24) / 8; B.cyl('lamp', 0.012, 0.008, [x, y1 - 0.004, cz1 - 0.1], 'y', 10); B.cyl('lamp', 0.016, 0.006, [x, y1 - 0.05, cz0 + 0.004], 'z', 12); }
    ctx.glow(g, (dx0 + dx1) / 2, y1 - 0.05, cz1 - 0.15, 0.9, 0.55);
    // puxador horizontal acima de cada boca (porta basculante: puxa e desce)
    const piv = doorPivot(g, 0, zF + 0.02); piv.position.y = y0 - 0.035; const D = new Batch();
    const ph = y1 - y0 + 0.07;
    plate(D, 'steel', dx0 - 0.05, 0, dx1 + 0.05, ph, 0.03, 0.03, [[dx0 + 0.01, 0.035, dx1 - 0.01, ph - 0.035]], 0.005);
    plate(D, 'black', dx0 + 0.01, 0.035, dx1 - 0.01, ph - 0.035, 0.024, 0.004, [[dx0 + 0.03, 0.05, dx1 - 0.03, ph - 0.05]], 0.001);
    D.plane('glassDark', dx1 - dx0 - 0.06, ph - 0.1, [(dx0 + dx1) / 2, ph / 2, 0.02]);
    D.plane('fxDeck2', dx1 - dx0 - 0.06, ph - 0.1, [(dx0 + dx1) / 2, ph / 2, 0.023]);
    handle(D, [dx0 + 0.3, ph + 0.008, 0.03], [dx1 - 0.3, ph + 0.008, 0.03], 0.035, 0.011);
    D.build(M, piv, { name: `lastro-door${k}` });
    (ctx.doorObjs.lastro ||= []).push({ pivot: piv, type: 'drop', sign: 1, max: 1.1, delay: k * 0.12, base: 0.14 });
    (ctx.steam.lastro ||= []).push({ x0: o.x + dx0, x1: o.x + dx1, y: y1, z: -6 + zF + 0.05, ceil: 2.55 });
    // controlador pequeno por câmara na coluna direita
    const cw = pc1 - pc0 - 0.06, ch = cw * 1.5, cy = (y0 + y1) / 2;
    B.box('black', pc0 + 0.02, cy - ch / 2 - 0.01, zF + 0.02, pc1 - 0.02, cy + ch / 2 + 0.01, zF + 0.032, 0.004);
    const ct = T.deckController([[240 - k * 3, 260 - k * 4]]); const cm = displayMaterial(ct, 2.0); ctx.mats.push(cm);
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), cm); mm.position.set((pc0 + pc1) / 2, cy, zF + 0.0335); g.add(mm);
    (ctx.ctrls ||= []).push({ id: o.id, kind: 'deck', k, tex: ct, mesh: mm });
  });
  // faixa superior (sem logotipo) e coifa
  B.box('steel', -W, 1.98, zF - 0.02, W, H, zF + 0.03, 0.006);
  B.box('steelPol', -W, 2.12, zF + 0.03, W, 2.14, zF + 0.036, 0.002, 1);
  B.box('steelPol', -W, 2.2, zF + 0.03, W, 2.22, zF + 0.036, 0.002, 1);
  B.box('steel', -W, H - 0.02, 0.03, W, H, zF, 0.004);
  hood(B, -W - 0.1, W + 0.1, 2.55, 2.95, d + 0.4);
  B.box('steelSat', -0.2, 2.95, 0.1, 0.2, 4.0, 0.5, 0.004);
  ctx.sticker(g, dx1 - 0.05, 1.93, zF + 0.024, 0.07);
  B.build(M, g, { name: 'lastro' });
  return g;
}

// ═════════════════════════════ ROTATIVO (FOTO 3) ═════════════════════════════
export function buildRotativo(o, ctx) {
  const { M } = ctx, g = new THREE.Group(), B = new Batch(), d = o.d, W = o.w / 2, H = o.h;
  const zF = d - 0.03, dr = o.doors[0], ox0 = dr.cx - dr.w / 2, ox1 = dr.cx + dr.w / 2, oy0 = dr.y0, oy1 = dr.y0 + dr.h;
  B.box('steel', -W, 0.0, 0.03, -W + 0.02, H, zF, 0.004); B.box('steel', W - 0.02, 0.0, 0.03, W, H, zF, 0.004);
  // frente em painéis verticais
  const pl = o.panel, px0 = pl.cx - pl.w / 2, px1 = pl.cx + pl.w / 2;
  plate(B, 'steel', -W, 0.0, W, 2.27, zF + 0.02, 0.02, [[ox0 - 0.02, oy0, ox1 + 0.02, oy1 + 0.02]], 0.005);
  for (const x of [px1 + 0.03, ox1 + 0.12]) B.box('steelSat', x - 0.003, 0.02, zF + 0.019, x + 0.003, 2.25, zF + 0.022, 0.001, 1);
  B.box('steelSat', -W, 0.0, zF - 0.02, W, 0.06, zF + 0.022, 0.003);
  // sanca superior saliente com grelha de exaustão
  B.box('steel', -W - 0.02, 2.27, 0.03, W + 0.02, H, d + 0.13, 0.008);
  B.box('grille', -W + 0.03, 2.262, zF + 0.04, W - 0.03, 2.272, d + 0.1, 0);
  for (let i = 0; i < 30; i++) { const x = -W + 0.06 + i * (o.w - 0.12) / 29; B.box('steelSat', x - 0.004, 2.255, zF + 0.04, x + 0.004, 2.27, d + 0.1, 0); }
  B.box('steelSat', -0.2, H, 0.2, 0.2, 4.0, 0.6, 0.004);
  // painel de comando: tela azul clara + teclado (à esquerda da porta)
  const rp = T.rotativoPanel(), rm = displayMaterial(rp, 2.4); ctx.mats.push(rm);
  const cw = px1 - px0 - 0.1, ch = cw * 2, cy = 1.42;
  B.box('black', px0 + 0.04, cy - ch / 2 - 0.02, zF + 0.02, px1 - 0.04, cy + ch / 2 + 0.02, zF + 0.04, 0.008);
  const rmesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), rm); rmesh.position.set((px0 + px1) / 2, cy, zF + 0.0405); g.add(rmesh);
  (ctx.ctrls ||= []).push({ id: o.id, kind: 'rot', k: 0, tex: rp, mesh: rmesh });
  B.cyl('redPaint', 0.022, 0.02, [(px0 + px1) / 2, cy - ch / 2 - 0.1, zF + 0.03], 'z', 20);
  B.box('yellow', (px0 + px1) / 2 - 0.045, cy - ch / 2 - 0.145, zF + 0.02, (px0 + px1) / 2 + 0.045, cy - ch / 2 - 0.055, zF + 0.024, 0.002, 1);
  // cavidade com carrinho girando
  const cz0 = 0.25, cz1 = zF - 0.01;
  cavity(B, 'cavR', 'cavRt', 'cavRf', ox0, ox1, oy0 + 0.0, oy1, cz0, cz1);
  const cart = new THREE.Group(); cart.position.set((ox0 + ox1) / 2, 0, (cz0 + cz1) / 2); g.add(cart);
  const C = new Batch();
  const cwid = 0.62, cdep = 0.78, n = 15;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) C.box('steelDark', sx * cwid / 2 - 0.012, 0.1, sz * cdep / 2 - 0.012, sx * cwid / 2 + 0.012, 1.85, sz * cdep / 2 + 0.012, 0.003, 1);
  for (let i = 0; i < n; i++) {
    const y = 0.2 + i * 0.105; tray(C, 0, y, 0, cwid - 0.04, cdep - 0.02, 'alu');
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) ctx.bread('bunBaked', cart, -0.19 + a * 0.19 + jit(0.01), y + 0.004, -0.29 + b * 0.19 + jit(0.01), R() * 6.28, 0.78, 0.9);
  }
  C.box('steelDark', -cwid / 2, 1.85, -0.03, cwid / 2, 1.88, 0.03, 0.003); C.cyl('steelDark', 0.02, 0.15, [0, 1.95, 0], 'y', 10);
  C.build(M, cart, { name: 'rot-cart' });
  ctx.spin.push({ obj: cart, id: o.id, w: (2 * Math.PI) / 24 });
  ctx.glow(g, (ox0 + ox1) / 2, 1.9, cz1 - 0.2, 0.7, 0.5);
  // porta (dobradiça à direita) com janela vertical estreita, puxador com manopla preta à esquerda
  const dx0 = ox0 - 0.02, dx1 = ox1 + 0.02, Lw = dx1 - dx0, dth = 0.07;
  const piv = doorPivot(g, dx1, zF + 0.02); const D = new Batch();
  const wx0 = -Lw / 2 - 0.1, wx1 = -Lw / 2 + 0.1, wy0 = 0.22, wy1 = 1.92;
  plate(D, 'steel', -Lw, oy0, 0, oy1 + 0.02, dth, dth, [[wx0, wy0, wx1, wy1]], 0.006);
  plate(D, 'black', wx0 - 0.02, wy0 - 0.02, wx1 + 0.02, wy1 + 0.02, dth + 0.004, 0.008, [[wx0 + 0.006, wy0 + 0.006, wx1 - 0.006, wy1 - 0.006]], 0.002);
  D.plane('glassClear', wx1 - wx0, wy1 - wy0, [(wx0 + wx1) / 2, (wy0 + wy1) / 2, dth - 0.01]);
  D.plane('glassClear', wx1 - wx0, wy1 - wy0, [(wx0 + wx1) / 2, (wy0 + wy1) / 2, 0.006]);
  for (const s of [-1, 1]) D.box('steelDark', (wx0 + wx1) / 2 - 0.1 * s - 0.003, wy0, 0.006, (wx0 + wx1) / 2 - 0.1 * s + 0.003, wy1, dth - 0.01, 0.001, 1);
  handle(D, [-Lw + 0.07, 0.8, dth], [-Lw + 0.07, 1.4, dth], 0.06, 0.014, 'chrome');
  D.add(new THREE.SphereGeometry(0.035, 20, 14), 'blackGloss', [-Lw + 0.07, 1.1, dth + 0.1]);
  D.cyl('chrome', 0.012, 0.05, [-Lw + 0.07, 1.1, dth + 0.07], 'z', 12);
  for (const y of [0.3, 1.0, 1.75]) D.cyl('steelPol', 0.018, 0.12, [0.01, y, dth / 2], 'y', 12);
  gasket(D, 'rubber', -Lw + 0.02, oy0 + 0.02, -0.004, -0.02, oy1, 0.003);
  D.build(M, piv, { name: 'rot-door' });
  ctx.doorObjs.rotativo = [{ pivot: piv, type: 'hinge', sign: 1, max: 1.75 }];
  ctx.steam.rotativo = [{ x0: o.x + ox0, x1: o.x + ox1, y: oy1, z: -6 + zF + 0.05, ceil: 2.27 }];
  ramp(B, ox0 - 0.06, ox1 + 0.06, zF + 0.06, zF + 0.55, 0.05, 0.004);
  ctx.sticker(g, ox1 + 0.18, 1.75, zF + 0.022, 0.08);
  B.build(M, g, { name: 'rotativo' });
  return g;
}
