// EQUIPAMENTOS — mobiliário e acessórios do setor de fornos: bancada de modelagem (BENCH), mesa de inox da FOTO 2, mesa do
// avaliador (TABLE), carrinhos de esteiras, masseira espiral, divisora, armário de fermentação (luz vermelha), área de
// descanso (banco, bebedouro, ventilador FAN), extintores, lixeiras e sinalização NR-26.
import * as THREE from 'three';
import { Batch, fixNormals } from './mach_geo.js';
import { ramp } from './mach_ovens.js';
import * as T from './mach_tex.js';
import { BENCH, TABLE, STATIONS, FAN, HALL } from './layout.js';

const R = T.rng(777);
const jit = (a) => (R() - 0.5) * 2 * a;

/** mesa de inox: tampo com aba dobrada, pés tubulares, prateleira inferior; origem no centro do piso */
function steelTable(B, cx, cz, w, d, h, { shelf = 0.18, backsplash = 0 } = {}) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  B.box('steel', x0, h - 0.035, z0, x1, h, z1, 0.004);
  B.box('steelSat', x0 + 0.01, h - 0.07, z0 + 0.01, x1 - 0.01, h - 0.035, z0 + 0.03, 0.002, 1);
  B.box('steelSat', x0 + 0.01, h - 0.07, z1 - 0.03, x1 - 0.01, h - 0.035, z1 - 0.01, 0.002, 1);
  if (backsplash) B.box('steel', x0, h, z0, x1, h + backsplash, z0 + 0.012, 0.003);
  for (const x of [x0 + 0.04, x1 - 0.04]) for (const z of [z0 + 0.04, z1 - 0.04]) {
    B.cyl('steelSat', 0.019, h - 0.06, [x, (h - 0.06) / 2 + 0.03, z], 'y', 14);
    B.cyl('steelPol', 0.016, 0.03, [x, 0.015, z], 'y', 12);
  }
  if (shelf) B.box('steel', x0 + 0.02, shelf - 0.015, z0 + 0.02, x1 - 0.02, shelf, z1 - 0.02, 0.003);
}
/** carrinho de esteiras (assadeiras) com pães */
function trayCart(B, ctx, g, cx, cz, rotY, kind = 'bunBaked', levels = 14, fill = 0.85) {
  const cart = new THREE.Group(); cart.position.set(cx, 0, cz); cart.rotation.y = rotY; g.add(cart);
  const C = new Batch(), w = 0.5, d = 0.7, h = 1.78;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) C.box('steelSat', sx * w / 2 - 0.013, 0.1, sz * d / 2 - 0.013, sx * w / 2 + 0.013, h, sz * d / 2 + 0.013, 0.003, 1);
  for (const sx of [-1, 1]) for (let i = 0; i < levels; i++) { const y = 0.22 + i * 0.1; C.box('steelSat', sx * (w / 2 - 0.02) - 0.012, y - 0.01, -d / 2, sx * (w / 2 - 0.02) + 0.012, y - 0.003, d / 2, 0.001, 1); }
  C.box('steelSat', -w / 2, 0.09, -d / 2, w / 2, 0.11, -d / 2 + 0.025, 0.002); C.box('steelSat', -w / 2, 0.09, d / 2 - 0.025, w / 2, 0.11, d / 2, 0.002);
  C.box('steelSat', -w / 2, h - 0.02, -d / 2, w / 2, h, d / 2, 0.003);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { C.cyl('black', 0.035, 0.03, [sx * (w / 2 - 0.03), 0.04, sz * (d / 2 - 0.03)], 'x', 16); C.box('steelSat', sx * (w / 2 - 0.03) - 0.02, 0.06, sz * (d / 2 - 0.03) - 0.02, sx * (w / 2 - 0.03) + 0.02, 0.095, sz * (d / 2 - 0.03) + 0.02, 0.002, 1); }
  const isBag = kind.startsWith('bag');
  for (let i = 0; i < levels; i++) {
    if (R() > fill) continue;
    const y = 0.22 + i * 0.1; C.box(kind.endsWith('Raw') ? 'aluNew' : 'alu', -w / 2 + 0.03, y - 0.003, -d / 2 + 0.01, w / 2 - 0.03, y + 0.001, d / 2 - 0.01, 0.0015, 1);
    if (isBag) { for (let a = 0; a < 5; a++) ctx.bread(kind === 'bagRaw' ? 'baguetteRaw' : 'baguetteOut', cart, -0.17 + a * 0.085, y + 0.001, 0, Math.PI / 2 + jit(0.03), 0.8, 0); }
    else for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) ctx.bread(kind, cart, -0.14 + a * 0.14 + jit(0.006), y + 0.001, -0.25 + b * 0.165 + jit(0.008), R() * 6.28, 0.8 + jit(0.04), 0);
  }
  C.build(ctx.M, cart, { name: 'cart' });
  return cart;
}
function placard(g, kind, x, y, z, rotY, w = 0.42) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (kind === 'adesivo' ? 1 : 360 / 512)), new THREE.MeshStandardMaterial({ map: T.signTexture(kind), roughness: 0.42, metalness: 0 }));
  m.position.set(x, y, z); m.rotation.y = rotY; m.receiveShadow = true; g.add(m); return m;
}
const SIGN_TEX = {};

export function buildProps(ctx) {
  const { M } = ctx, g = new THREE.Group(), B = new Batch(); g.name = 'props';
  const Z0 = HALL.z0;
  // ═════ bancada de modelagem (S2) ═════
  { const [bx, , bz] = BENCH.pos, w = BENCH.w, d = BENCH.d, h = BENCH.h;
    steelTable(B, bx, bz, w, d, h, { shelf: 0.2 });
    // tampo de polietileno branco para corte/modelagem na metade esquerda
    B.box('whitePlastic', bx - w / 2 + 0.05, h, bz - d / 2 + 0.05, bx + 0.1, h + 0.018, bz + d / 2 - 0.05, 0.004);
    // farinha espalhada (decal irregular)
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ map: flourTex(), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    fl.rotation.x = -Math.PI / 2; fl.position.set(bx - 0.25, h + 0.0195, bz + 0.05); fl.userData.noAO = true; g.add(fl);
    // massa em bloco (pâton) diante da forneira
    const lump = new THREE.SphereGeometry(1, 28, 16); { const P = lump.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setY(i, y < 0 ? y * 0.15 : y * (0.9 + 0.1 * Math.sin(P.getX(i) * 5))); } fixNormals(lump); }
    B.add(lump, 'dough', [bx - 0.05, h + 0.018, bz + 0.12], [0, 0.4, 0], [0.2, 0.07, 0.15]);
    // bolinhas porcionadas e pães modelados
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) ctx.bread('bunRaw', g, bx - 0.85 + i * 0.11 + jit(0.01), h + 0.018, bz - 0.2 + j * 0.11 + jit(0.01), R() * 6, 0.62 + jit(0.04), 0);
    // assadeira com baguetes cruas modeladas (lado direito)
    B.box('aluNew', bx + 0.35, h, bz - 0.3, bx + 1.05, h + 0.004, bz + 0.1, 0.0015, 1);
    for (let a = 0; a < 5; a++) ctx.bread('baguetteRaw', g, bx + 0.42 + a * 0.13, h + 0.004, bz - 0.1, Math.PI / 2 + jit(0.04), 0.82, 0);
    // rolo de madeira, raspadeira, balança
    B.cyl('wood', 0.028, 0.42, [bx + 0.05, h + 0.046, bz - 0.25], 'x', 16); for (const s of [-1, 1]) B.cyl('wood', 0.014, 0.1, [bx + 0.05 + s * 0.26, h + 0.046, bz - 0.25], 'x', 10);
    B.box('whitePlastic', bx - 0.32, h + 0.018, bz + 0.22, bx - 0.2, h + 0.022, bz + 0.31, 0.002, 1);
    B.box('steelPol', bx + 0.5, h, bz + 0.15, bx + 0.78, h + 0.06, bz + 0.33, 0.01); B.box('blackGloss', bx + 0.58, h + 0.04, bz + 0.331, bx + 0.7, h + 0.055, bz + 0.334, 0.001, 1);
    // sacos de farinha na prateleira
    for (let i = 0; i < 3; i++) B.box('flour', bx - 1.0 + i * 0.5, 0.2, bz - 0.25, bx - 0.6 + i * 0.5, 0.33, bz + 0.25, 0.05, 3);
    // lixeira com pedal ao lado da bancada
    bin(B, bx - w / 2 - 0.35, bz - 0.15, 'greyPlastic');
  }
  // ═════ mesa de inox junto à parede direita (FOTO 2) ═════
  { const x1 = HALL.x1 - 0.06, w = 0.62, cx = x1 - w / 2, cz = -3.55, d = 1.4;
    steelTable(B, cx, cz, w, d, 0.9, { shelf: 0.22, backsplash: 0 });
    // cubas gastronômicas empilhadas na prateleira (FOTO 2, canto inferior direito)
    for (let k = 0; k < 4; k++) gnPan(B, cx, 0.22 + k * 0.055, cz - 0.3, 0.32, 0.52);
    for (let k = 0; k < 2; k++) gnPan(B, cx, 0.22 + k * 0.055, cz + 0.32, 0.32, 0.52);
    // assadeira de pães recém-saídos esfriando + luva térmica
    B.box('alu', cx - 0.2, 0.9, cz + 0.05, cx + 0.2, 0.904, cz + 0.65, 0.0015, 1);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) ctx.bread('bunBaked', g, cx - 0.12 + a * 0.12, 0.904, cz + 0.12 + b * 0.15, R() * 6, 0.82, 0);
    glove(B, cx - 0.05, 0.9, cz - 0.35, 0.4);
  }
  // ═════ mesa do avaliador (TABLE) — maleta vai no centro ═════
  { const tg = new THREE.Group(); tg.position.set(TABLE.pos[0], 0, TABLE.pos[2]); tg.rotation.y = TABLE.rotY; g.add(tg);
    const TB = new Batch(); steelTable(TB, 0, 0, 1.15, 0.65, TABLE.h, { shelf: 0.2 });
    // prancheta com formulário e caneta no canto
    TB.box('black', 0.34, TABLE.h, -0.12, 0.56, TABLE.h + 0.004, 0.18, 0.002, 1);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), new THREE.MeshStandardMaterial({ map: formTex(), roughness: 0.9 }));
    sheet.rotation.x = -Math.PI / 2; sheet.position.set(0.45, TABLE.h + 0.0055, 0.03); tg.add(sheet);
    TB.cyl('bluePlastic', 0.005, 0.14, [0.48, TABLE.h + 0.012, 0.0], 'x', 8);
    TB.build(M, tg, { name: 'table' });
  }
  // ═════ carrinhos de esteiras ═════
  trayCart(B, ctx, g, 6.15, -5.45, 0, 'bunBaked', 15, 0.95);          // pães saídos do forno 1 (à esquerda na FOTO 2)
  trayCart(B, ctx, g, 3.35, -1.45, 0.2, 'bunRaw', 14, 0.8);           // pães crus aguardando (junto à bancada)
  trayCart(B, ctx, g, -3.35, -3.95, -0.3, 'bagRaw', 14, 0.75);        // baguetes cruas para o rotativo
  // ═════ armário de fermentação (luz vermelha) — móvel solto ═════
  proofer(B, ctx, g, -4.15, Z0 + 0.48);
  // ═════ masseira espiral e divisora ═════
  mixer(B, ctx, g, -5.45, Z0 + 0.62);
  divider(B, ctx, g, -6.75, Z0 + 0.45);
  // ═════ área de descanso (S3) ═════
  { const s = STATIONS.descanso, [wx, , wz] = s.worker, ry = s.workerRotY;
    const dg = new THREE.Group(); dg.position.set(wx, 0, wz); dg.rotation.y = ry; g.add(dg);
    // banco de ripas de madeira; assento a 0,45 m sob o quadril (ponto worker), encosto atrás
    const DB = new Batch(), L = 1.5, sd = 0.42, sz0 = -0.3, sz1 = sz0 + sd; // z local: +z = frente (para onde olha)
    for (let i = 0; i < 5; i++) { const z0 = sz0 + i * (sd / 5) + 0.004, z1 = z0 + sd / 5 - 0.008; DB.box('wood', -L / 2, 0.42, z0, L / 2, 0.45, z1, 0.006); }
    for (let i = 0; i < 3; i++) DB.box('wood', -L / 2, 0.58 + i * 0.12, sz0 - 0.06, L / 2, 0.66 + i * 0.12, sz0 - 0.035, 0.006);
    for (const x of [-L / 2 + 0.08, L / 2 - 0.08]) {
      DB.box('black', x - 0.02, 0.0, sz1 - 0.06, x + 0.02, 0.42, sz1 - 0.03, 0.004);
      DB.box('black', x - 0.02, 0.0, sz0 - 0.06, x + 0.02, 0.96, sz0 - 0.03, 0.004);
      DB.box('black', x - 0.02, 0.39, sz0 - 0.06, x + 0.02, 0.42, sz1 - 0.03, 0.004);
    }
    // garrafa d'água no banco
    DB.cyl('bluePlastic', 0.035, 0.2, [0.5, 0.55, sz0 + 0.15], 'y', 16); DB.cyl('whitePlastic', 0.02, 0.03, [0.5, 0.665, sz0 + 0.15], 'y', 12);
    DB.build(M, dg, { name: 'bench-rest' });
    // bebedouro industrial inox junto à parede esquerda
    fountain(B, HALL.x0 + 0.3, 3.25);
    placard(g, 'hidrate', HALL.x0 + 0.012, 1.75, 3.25, Math.PI / 2, 0.42);
    bin(B, HALL.x0 + 0.28, 2.55, 'greyPlastic');
    // ventilador de parede (FAN)
    ctx.fan = fan(B, g, M);
  }
  // ═════ extintores (parede esquerda e parede direita) + placas ═════
  extinguisher(B, g, HALL.x0 + 0.11, -1.2, Math.PI / 2);
  extinguisher(B, g, HALL.x1 - 0.11, -0.6, -Math.PI / 2);
  // ═════ sinalização NR-26 ═════
  placard(g, 'quente', -0.9, 1.75, Z0 + 0.012, 0, 0.36);           // entre rotativo e lastro
  placard(g, 'quente', 6.15, 2.15, Z0 + 0.012, 0, 0.4);            // acima do carrinho, entre lastro 4 e forno 1
  placard(g, 'luva', HALL.x1 - 0.012, 1.72, -2.45, -Math.PI / 2, 0.42);
  placard(g, 'luva', 2.3, 2.75, Z0 + 0.012, 0, 0.42);
  B.build(M, g, { name: 'props' });
  return g;
}

function bin(B, x, z, key) {
  B.cyl(key, 0.17, 0.62, [x, 0.33, z], 'y', 24, 0.19); B.cyl('black', 0.195, 0.04, [x, 0.66, z], 'y', 24);
  B.box('black', x - 0.06, 0.0, z + 0.15, x + 0.06, 0.03, z + 0.24, 0.006);
}
function gnPan(B, cx, y, cz, w, d) {
  B.box('steelPol', cx - w / 2, y, cz - d / 2, cx + w / 2, y + 0.05, cz + d / 2, 0.01, 2);
  B.box('steelPol', cx - w / 2 - 0.012, y + 0.046, cz - d / 2 - 0.012, cx + w / 2 + 0.012, y + 0.052, cz + d / 2 + 0.012, 0.003, 1);
}
function glove(B, x, y, z, ry) {
  const g = new THREE.CapsuleGeometry(0.055, 0.2, 4, 12); B.add(g, 'fabric', [x, y + 0.03, z], [0, ry, Math.PI / 2], [1, 0.45, 1]);
  B.add(new THREE.CapsuleGeometry(0.02, 0.06, 3, 8), 'fabric', [x + 0.05, y + 0.025, z + 0.06], [0, ry + 0.8, Math.PI / 2], [1, 0.6, 1]);
}
function proofer(B, ctx, g, cx, cz) {
  const w = 0.78, d = 0.86, h = 1.95, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  B.box('black', x0, 0.12, z0, x1, h, z1 - 0.03, 0.01);
  for (const sx of [x0 + 0.06, x1 - 0.06]) for (const sz of [z0 + 0.06, z1 - 0.09]) { B.cyl('black', 0.04, 0.03, [sx, 0.045, sz], 'x', 16); B.box('steelSat', sx - 0.025, 0.07, sz - 0.025, sx + 0.025, 0.12, sz + 0.025, 0.003, 1); }
  // interior vermelho visto pelas portas de vidro
  const iz = z1 - 0.06;
  B.plane('redGlow', w - 0.12, h - 0.4, [cx, (h + 0.32) / 2, z0 + 0.05]);
  for (let i = 0; i < 12; i++) { const y = 0.36 + i * 0.12; B.box('steelDark', x0 + 0.06, y, z0 + 0.06, x1 - 0.06, y + 0.004, iz - 0.02, 0.001, 1);
    if (i % 2 === 0) for (let a = 0; a < 4; a++) ctx.bread('bunRaw', g, x0 + 0.14 + a * 0.16, y + 0.004, cz - 0.05 + jit(0.03), R() * 6, 0.7, 0); }
  for (const x of [x0 + 0.03, x1 - 0.03]) B.box('redGlow', x - 0.006, 0.3, iz - 0.3, x + 0.006, h - 0.1, iz - 0.28, 0.002, 1); // fitas LED vermelhas
  // 2 portas de vidro com moldura preta
  for (const [a, b] of [[x0, cx - 0.004], [cx + 0.004, x1]]) {
    const holes = [[a + 0.05, 0.3, b - 0.05, h - 0.1]];
    const s = new THREE.Shape(); s.moveTo(a, 0.22); s.lineTo(b, 0.22); s.lineTo(b, h - 0.02); s.lineTo(a, h - 0.02); s.closePath();
    const p = new THREE.Path(); p.moveTo(holes[0][0], holes[0][1]); p.lineTo(holes[0][0], holes[0][3]); p.lineTo(holes[0][2], holes[0][3]); p.lineTo(holes[0][2], holes[0][1]); p.closePath(); s.holes.push(p);
    B.add(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false }), 'black', [0, 0, z1 - 0.03]);
    B.plane('glassRed', b - a - 0.1, h - 0.4, [(a + b) / 2, (h + 0.2) / 2, z1 - 0.012]);
    const hx = a < cx - 0.1 ? b - 0.04 : a + 0.04; B.box('steelPol', hx - 0.008, 0.9, z1, hx + 0.008, 1.3, z1 + 0.03, 0.003, 1);
  }
  B.box('blackGloss', cx - 0.15, h - 0.09, z1 - 0.02, cx + 0.15, h - 0.035, z1 + 0.001, 0.004, 1);
  ctx.redLight = new THREE.Vector3(cx, 1.1, z1 + 0.15);
}
function mixer(B, ctx, g, cx, cz) {
  // masseira espiral: base, cuba inox, coluna e cabeçote, espiral, protetor
  const bw = 0.62, bd = 1.0;
  B.box('whitePlastic', cx - bw / 2, 0.06, cz - bd / 2, cx + bw / 2, 0.62, cz + bd / 2, 0.03, 3);
  B.box('steelSat', cx - bw / 2 + 0.02, 0.0, cz - bd / 2 + 0.02, cx + bw / 2 - 0.02, 0.06, cz + bd / 2 - 0.02, 0.01);
  const bz = cz + 0.15;
  const bowl = new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.3, 0.0), new THREE.Vector2(0.34, 0.04), new THREE.Vector2(0.36, 0.38), new THREE.Vector2(0.375, 0.39), new THREE.Vector2(0.37, 0.4), new THREE.Vector2(0.35, 0.39), new THREE.Vector2(0.34, 0.06), new THREE.Vector2(0.29, 0.02), new THREE.Vector2(0, 0.02)], 40);
  B.add(bowl, 'steelPol', [cx, 0.63, bz]);
  // massa dentro da cuba
  const dough = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); B.add(dough, 'dough', [cx, 0.68, bz], [0, 0, 0], [0.33, 0.12, 0.33]);
  // coluna traseira e cabeçote
  B.box('whitePlastic', cx - 0.22, 0.62, cz - bd / 2 + 0.02, cx + 0.22, 1.4, cz - bd / 2 + 0.3, 0.04, 3);
  B.box('whitePlastic', cx - 0.2, 1.18, cz - bd / 2 + 0.05, cx + 0.2, 1.4, bz + 0.12, 0.05, 3);
  // espiral
  const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 3.2; pts.push(new THREE.Vector3(cx + 0.11 + Math.cos(a) * 0.07, 1.18 - t * 0.45, bz - 0.02 + Math.sin(a) * 0.07)); }
  B.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.016, 8), 'steelPol');
  B.cyl('steelPol', 0.02, 0.5, [cx - 0.12, 0.93, bz - 0.02], 'y', 12);
  // protetor de arame (semi-tampa)
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); B.bar('steelPol', [cx + Math.cos(a) * 0.37, 1.03, bz + Math.sin(a) * 0.37], [cx + Math.cos(a) * 0.05, 1.05, bz + Math.sin(a) * 0.05], 0.004, 5); }
  B.add(new THREE.TorusGeometry(0.37, 0.006, 6, 40, Math.PI), 'steelPol', [cx, 1.03, bz], [-Math.PI / 2, 0, 0]);
  // painel de comando
  B.box('blackGloss', cx + bw / 2 - 0.005, 0.9, cz - 0.4, cx + bw / 2 + 0.005, 1.15, cz - 0.2, 0.003, 1);
  B.cyl('redPaint', 0.022, 0.025, [cx + bw / 2 + 0.015, 1.1, cz - 0.3], 'x', 18);
  B.cyl('greyPlastic', 0.014, 0.02, [cx + bw / 2 + 0.012, 0.97, cz - 0.35], 'x', 14);
  B.cyl('greyPlastic', 0.014, 0.02, [cx + bw / 2 + 0.012, 0.97, cz - 0.25], 'x', 14);
}
function divider(B, ctx, g, cx, cz) {
  // divisora hidráulica: base, cuba redonda com grade de facas, tampa articulada aberta, alavanca
  B.box('steel', cx - 0.3, 0.06, cz - 0.3, cx + 0.3, 0.8, cz + 0.3, 0.02, 3);
  B.box('steelSat', cx - 0.28, 0.0, cz - 0.28, cx + 0.28, 0.06, cz + 0.28, 0.01);
  B.cyl('steelPol', 0.27, 0.12, [cx, 0.86, cz], 'y', 40); B.cyl('steelDark', 0.25, 0.005, [cx, 0.922, cz], 'y', 40);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI; B.bar('steelPol', [cx + Math.cos(a) * 0.25, 0.925, cz + Math.sin(a) * 0.25], [cx - Math.cos(a) * 0.25, 0.925, cz - Math.sin(a) * 0.25], 0.0025, 4); }
  // tampa aberta (para trás, encostada)
  B.cyl('steelPol', 0.27, 0.03, [cx, 1.18, cz - 0.27], 'z', 40);
  B.box('steelSat', cx - 0.04, 0.88, cz - 0.31, cx + 0.04, 1.2, cz - 0.27, 0.005);
  B.bar('chrome', [cx + 0.3, 0.7, cz + 0.1], [cx + 0.42, 1.05, cz + 0.1], 0.012); B.add(new THREE.SphereGeometry(0.03, 14, 10), 'black', [cx + 0.42, 1.06, cz + 0.1]);
  B.box('blackGloss', cx - 0.12, 0.6, cz + 0.3, cx + 0.12, 0.72, cz + 0.305, 0.003, 1);
}
function fountain(B, cx, cz) {
  // bebedouro industrial inox de pressão: coluna, cuba, 2 torneiras (boca/copo), botões, grelha
  B.box('steel', cx - 0.22, 0.0, cz - 0.24, cx + 0.22, 0.98, cz + 0.24, 0.008);
  B.box('steelPol', cx - 0.25, 0.98, cz - 0.27, cx + 0.25, 1.02, cz + 0.27, 0.01);
  B.box('steelDark', cx - 0.19, 1.0, cz - 0.2, cx + 0.19, 1.021, cz + 0.2, 0.004);
  B.box('steel', cx - 0.25, 1.02, cz - 0.27, cx - 0.18, 1.32, cz + 0.27, 0.008);
  for (const s of [-0.09, 0.09]) { B.cyl('chrome', 0.012, 0.1, [cx - 0.12, 1.1, cz + s], 'x', 12); B.cyl('chrome', 0.009, 0.05, [cx - 0.07, 1.08, cz + s], 'y', 10); }
  for (const s of [-0.1, 0.1]) B.cyl('chrome', 0.02, 0.02, [cx + 0.231, 0.9, cz + s], 'x', 16);
  for (let i = 0; i < 9; i++) B.box('grille', cx + 0.221, 0.12 + i * 0.03, cz - 0.15, cx + 0.223, 0.135 + i * 0.03, cz + 0.15, 0);
  // dispensador de copos na parede
  B.cyl('whitePlastic', 0.04, 0.4, [HALL.x0 + 0.06, 1.35, cz + 0.4], 'y', 16);
}
function extinguisher(B, g, x, z, rotY) {
  const e = new THREE.Group(); e.position.set(x, 0, z); e.rotation.y = rotY; g.add(e);
  const E = new Batch();
  E.box('black', -0.05, 1.02, -0.11, 0.05, 1.12, -0.085, 0.004);        // suporte de parede (lado −z local = parede)
  E.cyl('redPaint', 0.085, 0.5, [0, 0.82, 0], 'y', 28);
  E.add(new THREE.SphereGeometry(0.085, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'redPaint', [0, 1.07, 0]);
  E.cyl('black', 0.03, 0.06, [0, 1.15, 0], 'y', 14); E.box('chrome', -0.015, 1.17, -0.02, 0.09, 1.19, 0.02, 0.004, 1);
  E.box('chrome', -0.01, 1.2, -0.02, 0.07, 1.215, 0.02, 0.003, 1);
  const hose = new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 1.15, 0.02), new THREE.Vector3(0.1, 1.05, 0.06), new THREE.Vector3(0.1, 0.8, 0.09), new THREE.Vector3(0.06, 0.66, 0.08)]);
  E.add(new THREE.TubeGeometry(hose, 20, 0.009, 8), 'black');
  E.add(new THREE.PlaneGeometry(0.1, 0.14), 'whitePlastic', [0, 0.82, 0.0855]);
  E.build({ black: g.userData.M?.black, ...extMats }, e, { name: 'ext' });
  // placa de identificação acima e demarcação no piso (NR-23/NR-26)
  placard(e, 'extintor', 0, 1.85, -0.105, 0, 0.3);
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), floorMarkMat()); fm.rotation.x = -Math.PI / 2; fm.position.set(0, 0.003, 0.25); fm.userData.noAO = true; e.add(fm);
}
let extMats = {};
let _fmm = null;
function floorMarkMat() {
  if (_fmm) return _fmm;
  const c = T.canvas(256), x = c.getContext('2d'); x.clearRect(0, 0, 256, 256);
  x.fillStyle = '#c4141b'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#f2c200'; x.fillRect(0, 0, 256, 22); x.fillRect(0, 234, 256, 22); x.fillRect(0, 0, 22, 256); x.fillRect(234, 0, 22, 256);
  _fmm = new THREE.MeshStandardMaterial({ map: T.tex(c, true, false), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 }); return _fmm;
}
function fan(B, g, M) {
  // ventilador oscilante de parede (FAN.pos), aponta para +x (aimRotY = π/2)
  const root = new THREE.Group(); root.position.set(...FAN.pos); g.add(root);
  const F = new Batch();
  F.box('black', HALL.x0 - FAN.pos[0] + 0.0, -0.08, -0.08, HALL.x0 - FAN.pos[0] + 0.03, 0.08, 0.08, 0.01);
  F.bar('black', [HALL.x0 - FAN.pos[0] + 0.03, 0, 0], [0.05, 0.0, 0], 0.018);
  F.build(M, root, { name: 'fan-mount' });
  const head = new THREE.Group(); head.position.set(0.05, 0, 0); head.rotation.y = FAN.aimRotY - Math.PI / 2; root.add(head); // frente do cabeçote = +x
  head.rotation.z = -0.22; // inclinado para baixo, na direção do banco
  const H = new Batch();
  H.add(new THREE.SphereGeometry(0.1, 20, 14), 'black', [0.05, 0, 0], [0, 0, 0], [1.1, 0.85, 0.85]);
  // grade: anéis + raios (frente e trás)
  for (const xg of [0.17, 0.32]) {
    for (const r of [0.08, 0.15, 0.22, 0.28]) H.add(new THREE.TorusGeometry(r, 0.0028, 5, 48), 'black', [xg + (0.28 - r) * (xg > 0.2 ? -0.25 : 0.2), 0, 0], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; H.bar('black', [xg + (xg > 0.2 ? -0.06 : 0.05), Math.cos(a) * 0.03, Math.sin(a) * 0.03], [xg, Math.cos(a) * 0.28, Math.sin(a) * 0.28], 0.002, 4); }
  }
  H.add(new THREE.TorusGeometry(0.29, 0.008, 8, 48), 'black', [0.245, 0, 0], [0, Math.PI / 2, 0]);
  H.cyl('black', 0.035, 0.03, [0.31, 0, 0], 'x', 16);
  H.build(M, head, { name: 'fan-head' });
  const blades = new THREE.Group(); blades.position.set(0.24, 0, 0); head.add(blades);
  const bl = new Batch();
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Shape(); s.moveTo(0.03, -0.02); s.bezierCurveTo(0.12, -0.08, 0.26, -0.07, 0.25, 0.02); s.bezierCurveTo(0.22, 0.08, 0.1, 0.06, 0.03, 0.02); s.closePath();
    const geo = new THREE.ShapeGeometry(s, 8); geo.rotateY(Math.PI / 2); geo.rotateX((i / 3) * Math.PI * 2);
    bl.add(geo, 'fanBlade');
  }
  bl.cyl('greyPlastic', 0.04, 0.05, [0, 0, 0], 'x', 16);
  bl.build({ ...M, fanBlade: fanBladeMat() }, blades, { name: 'fan-blades', cast: false });
  return { head, blades, root };
}
let _fbm = null;
function fanBladeMat() { return (_fbm ||= new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); }
function flourTex() {
  const N = 256, n = T.fbm(N, N, 4, 4, 5, 551), c = T.canvas(N), x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) {
    const i = y * N + X, r = Math.hypot((X - N / 2) / (N / 2), (y - N / 2) / (N / 2));
    const a = Math.max(0, Math.min(1, (n[i] - 0.38) * 2.6 * (1.1 - r)));
    img.data[i * 4] = 246; img.data[i * 4 + 1] = 242; img.data[i * 4 + 2] = 232; img.data[i * 4 + 3] = a * 235;
  }
  x.putImageData(img, 0, 0); return T.tex(c, true, false);
}
function formTex() {
  const c = T.canvas(256, 360), x = c.getContext('2d'); x.fillStyle = '#f6f5f0'; x.fillRect(0, 0, 256, 360);
  x.fillStyle = '#222'; x.font = '700 15px Arial'; x.fillText('AVALIAÇÃO DE CALOR — NHO-06', 14, 26);
  x.font = '11px Arial'; ['Setor: fornos', 'Data: ___/___/____', 'Avaliador: ____________', 'Medidor IBUTG nº série ______'].forEach((l, i) => x.fillText(l, 14, 50 + i * 18));
  x.strokeStyle = '#555'; x.lineWidth = 0.8; for (let i = 0; i < 12; i++) { x.strokeRect(14, 130 + i * 18, 228, 18); } for (const cx of [60, 110, 160, 200]) { x.beginPath(); x.moveTo(cx, 130); x.lineTo(cx, 346); x.stroke(); }
  x.font = '700 10px Arial'; ['Hora', 'tg', 'tbn', 'tbs', 'IBUTG'].forEach((l, i) => x.fillText(l, [18, 70, 118, 168, 204][i], 143));
  return T.tex(c, true, false);
}
export function setExtMats(M) { extMats = M; }
