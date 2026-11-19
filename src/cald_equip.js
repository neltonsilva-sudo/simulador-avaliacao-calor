// CALDEIRAS — equipamentos: 2 caldeiras flamotubulares (costado isolado com chapa de alumínio, tampo frontal com porta da
// caixa de fumaça e queimador, visor de nível, manômetros, válvulas de segurança, válvula principal, chaminé), trocador
// casco-tubo sem isolamento, desaerador vertical com respiro, bombas de alimentação, coletor/distribuidor de vapor com
// válvulas de volante e a gaxeta vazando, linha aérea isolada, tubulações (vapor, água de alimentação, gás), painéis.
import * as THREE from 'three';
import { BOILERS, PIPES, LEAKS, STATIONS2 } from './layout_caldeiras.js';
import * as G from './cald_geo.js';
import * as TX from './cald_tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);

export function buildEquipment(ctx) {
  const { group, batch, inst, M } = ctx;
  const cyl = (key, a, b, r, seg = 20) => { const d = b.clone().sub(a), L = d.length(); batch.add(key, G.unitCyl(seg), G.alignY(a.clone().add(b).multiplyScalar(0.5), d.normalize(), [r, L, r])); };
  const box = (key, c, s, rot = [0, 0, 0]) => batch.add(key, G.boxGeo(s[0], s[1], s[2]), G.mat4(c, rot));
  const pipe = (key, pts, r, rb) => { const { geo } = G.tubeGeo(pts, r, rb ?? Math.max(r * 2.5, 0.08)); batch.add(key, geo, null); };
  const sign = (kind, c, n, w = 0.3, h2 = null, text2) => {
    const t = TX.signTexture(kind, text2); const m = new THREE.Mesh(G.cached('signPlane', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0 }));
    m.scale.set(w, h2 ?? w * 1.25, 1); m.position.copy(c); m.lookAt(c.clone().add(n)); m.receiveShadow = true; group.add(m); return m;
  };
  ctx.sign = sign; ctx.cyl = cyl; ctx.box = box; ctx.pipe = pipe;
  const needles = ctx.needles, flames = ctx.flames, screens = ctx.screens;
  const faceP = TX.gaugeFace({ max: 16, red: 10.5 });

  // ═════════════ CALDEIRAS FLAMOTUBULARES ═════════════
  for (const b of BOILERS.filter((q) => q.kind === 'flamotubular')) {
    const [cx, cy, zc] = b.c, R = b.R, L = b.L, zf = zc + L / 2, zr = zc - L / 2, num = b.id === 'cald1' ? 1 : 2;
    // costado isolado (chapa de alumínio) — de zr+0,3 a zf−0,34
    const za = zr + 0.3, zb = zf - 0.34, Lc = zb - za;
    batch.add('clad', G.shellGeo(R, Lc, { top: 'none', bot: 'none', seg: 96, sheetW: 1.2, sheetL: 1.0 }), G.mat4([cx, cy, (za + zb) / 2], [Math.PI / 2, 0, 0]));
    // cintas de fixação a cada ~1 m
    const strapG = G.cached('strap' + R, () => new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.03, 96, 1, true));
    for (let z = za + 0.5; z < zb - 0.2; z += 1.0) batch.add('steel', strapG, G.mat4([cx, cy, z], [Math.PI / 2, 0, 0]));
    // anel de arremate do isolamento e espelho (tube sheet) frontal
    batch.add('steelHot', new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.12, 96), G.mat4([cx, cy, zb + 0.06], [Math.PI / 2, 0, 0]));
    // flange da porta (anel) + porta abaulada (calota) com parafusos
    batch.add('steelHot', new THREE.CylinderGeometry(R - 0.01, R - 0.01, 0.07, 96), G.mat4([cx, cy, zb + 0.155], [Math.PI / 2, 0, 0]));
    const a = R - 0.07, hcap = 0.15, Rs = (a * a + hcap * hcap) / (2 * hcap), th = Math.asin(a / Rs);
    const capG = new THREE.SphereGeometry(Rs, 96, 10, 0, Math.PI * 2, 0, th); { const P = capG.attributes.position, uv = capG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) / 1.2, P.getZ(i) / 1.2); }
    const zDoorBase = zb + 0.19;
    batch.add('door', capG, G.mat4([cx, cy, zDoorBase + hcap - Rs], [Math.PI / 2, 0, 0]));
    const doorZ = (r) => zDoorBase + hcap - (Rs - Math.sqrt(Math.max(0, Rs * Rs - r * r))); // superfície da porta no raio r
    batch.add('steelHot', new THREE.CylinderGeometry(R + 0.07, R + 0.07, 0.09, 96), G.mat4([cx, cy, zb + 0.145], [Math.PI / 2, 0, 0]));
    G.boltCircle(inst, M.nut, V(cx, cy, zb + 0.19), Z, R + 0.015, 40, 0.062, 0.05);
    // dobradiças (lado +x) e olhal de içamento
    for (const dy of [-0.55, 0.55]) { box('steelDark', [cx + R + 0.05, cy + dy, zb + 0.16], [0.16, 0.18, 0.14]); cyl('chrome', V(cx + R + 0.1, cy + dy - 0.14, zb + 0.16), V(cx + R + 0.1, cy + dy + 0.14, zb + 0.16), 0.03, 12); }
    box('steelDark', [cx, cy + R - 0.05, zDoorBase + 0.02], [0.12, 0.1, 0.06]);
    // visor de inspeção na porta (furo de observação da fornalha) — chama visível
    const vp = V(cx + 0.62, cy + 0.42, doorZ(0.75));
    cyl('steelDark', vp.clone().add(V(0, 0, -0.02)), vp.clone().add(V(0, 0, 0.09)), 0.055, 18);
    G.boltCircle(inst, M.nut, vp.clone().add(V(0, 0, 0.09)), Z, 0.05, 4, 0.016, 0.012);
    const fm = new THREE.Mesh(G.cached('vpDisc', () => new THREE.CircleGeometry(0.036, 20)), M.flame.clone()); fm.position.copy(vp).add(V(0, 0, 0.0915)); group.add(fm); flames.push({ m: fm, k: 1, seed: num * 3.1 });
    // ───── queimador monobloco (centro da fornalha, abaixo do eixo) ─────
    const by = cy - 0.36, zB = doorZ(0.0) - 0.02;
    box('steelDark', [cx, by, zB + 0.03], [0.62, 0.62, 0.05]);
    G.boltCircle(inst, M.nut, V(cx, by, zB + 0.055), Z, 0.36, 8, 0.03, 0.025, Math.PI / 8);
    // caracol/carcaça do ventilador (corpo arredondado) + tampa
    const hous = G.cached('burnerHousing', () => { const g = new THREE.CylinderGeometry(0.29, 0.29, 0.34, 40); g.rotateX(Math.PI / 2); return g; });
    batch.add('burner', hous, G.mat4([cx, by, zB + 0.24]));
    batch.add('burnerCover', G.cached('burnerCap', () => { const g = new THREE.SphereGeometry(0.29, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI / 2); g.scale(1, 1, 0.32); return g; }), G.mat4([cx, by, zB + 0.41]));
    box('burner', [cx, by - 0.24, zB + 0.24], [0.5, 0.12, 0.3]);
    // motor do ventilador (lado +x) com aletas e caixa de ligação
    const mx = cx + 0.29;
    cyl('motor', V(mx, by + 0.05, zB + 0.24), V(mx + 0.3, by + 0.05, zB + 0.24), 0.105, 24);
    for (let k = 0; k < 7; k++) cyl('motor', V(mx + 0.04 + k * 0.035, by + 0.05, zB + 0.24), V(mx + 0.052 + k * 0.035, by + 0.05, zB + 0.24), 0.118, 24);
    cyl('motorDark', V(mx + 0.3, by + 0.05, zB + 0.24), V(mx + 0.34, by + 0.05, zB + 0.24), 0.09, 20);
    box('motor', [mx + 0.14, by + 0.18, zB + 0.24], [0.1, 0.07, 0.1]);
    // servomotor do registro de ar + transformador de ignição + programador (caixa preta)
    box('rubber', [cx - 0.1, by + 0.33, zB + 0.2], [0.14, 0.09, 0.1]); box('burnerCover', [cx + 0.12, by + 0.32, zB + 0.16], [0.12, 0.07, 0.14]);
    // visor de chama do queimador (traseira da carcaça)
    const sv = V(cx - 0.14, by + 0.1, zB + 0.505); cyl('chrome', sv.clone().add(V(0, 0, -0.04)), sv, 0.03, 16);
    const f2 = new THREE.Mesh(G.cached('svDisc', () => new THREE.CircleGeometry(0.022, 16)), M.flame.clone()); f2.position.copy(sv).add(V(0, 0, 0.002)); group.add(f2); flames.push({ m: f2, k: 1.3, seed: num * 5.7 });
    // ───── trem de gás (amarelo) — desce da rede aérea e entra por baixo do queimador ─────
    const gx = cx - 0.62, gz = zf + 0.22;
    pipe('gasYellow', [V(gx, 3.6, gz), V(gx, 0.95, gz), V(cx - 0.12, 0.95, gz), V(cx - 0.12, by - 0.29, gz)], 0.028, 0.07);
    // válvula de esfera (alavanca), filtro, regulador (campânula), 2 solenoides, pressostato
    cyl('cast', V(gx, 2.35, gz), V(gx, 2.47, gz), 0.045); box('paintRed', [gx + 0.09, 2.47, gz], [0.18, 0.02, 0.03]);
    cyl('cast', V(gx, 1.95, gz), V(gx, 2.1, gz), 0.05); cyl('cast', V(gx - 0.05, 2.02, gz), V(gx - 0.14, 2.02, gz), 0.035);
    batch.add('gasRegulator', G.cached('bell', () => new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), G.mat4([gx, 1.58, gz], [0, 0, Math.PI / 2])); cyl('cast', V(gx, 1.5, gz), V(gx, 1.66, gz), 0.05);
    for (const k of [0, 1]) { const sx = gx + 0.15 + k * 0.17; cyl('cast', V(sx - 0.05, 0.95, gz), V(sx + 0.05, 0.95, gz), 0.045); box(k ? 'paintRed' : 'paintBlue', [sx, 1.07, gz], [0.08, 0.1, 0.08]); cyl('rubber', V(sx, 1.12, gz), V(sx, 1.2, gz), 0.012, 8); }
    box('paintBlue', [gx - 0.08, 1.25, gz], [0.06, 0.09, 0.06]);
    // ───── visor de nível (lado −x da frente) com coluna, vidro e válvulas ─────
    const lx = cx - 0.95, lz = zf + 0.06;
    for (const y of [cy + 0.12, cy + 0.95]) cyl('steel', V(lx, y, zb + 0.08), V(lx, y, lz + 0.03), 0.026, 12);
    cyl('steel', V(lx, cy + 0.0, lz), V(lx, cy + 1.07, lz), 0.034, 16); // coluna
    const gxv = lx - 0.13; // vidro plano refletor com guarnição (bronze) + água
    for (const y of [cy + 0.2, cy + 0.87]) { cyl('brass', V(lx, y, lz), V(gxv, y, lz), 0.016, 10); cyl('brass', V(gxv, y - 0.045, lz), V(gxv, y + 0.045, lz), 0.03, 12); batch.add('wheelRed', G.wheelGeo(1), G.alignY(V(gxv - 0.07, y, lz), V(-1, 0, 0), [0.045, 0.045, 0.045])); }
    box('steelDark', [gxv, cy + 0.535, lz], [0.07, 0.6, 0.06]);
    const wl = new THREE.Mesh(G.cached('lvlGlass', () => new THREE.PlaneGeometry(0.026, 0.56)), M.levelGlass); wl.position.set(gxv, cy + 0.535, lz + 0.0305); group.add(wl);
    const wat = new THREE.Mesh(G.cached('lvlWater', () => new THREE.PlaneGeometry(0.024, 0.3)), M.levelWater); wat.position.set(gxv, cy + 0.385, lz + 0.031); group.add(wat); ctx.levels.push({ m: wat, base: cy + 0.235, seed: num });
    cyl('steel', V(lx, cy - 0.0, lz), V(lx, 0.55, lz), 0.016, 10); cyl('cast', V(lx, 0.62, lz), V(lx, 0.74, lz), 0.03); box('paintRed', [lx + 0.08, 0.7, lz], [0.15, 0.02, 0.025]);
    // controle de nível (garrafa magnética) lado +x
    const kx = cx + 0.98; for (const y of [cy + 0.1, cy + 0.7]) cyl('steel', V(kx, y, zb + 0.05), V(kx, y, lz + 0.02), 0.024, 12);
    cyl('steelHot', V(kx, cy + 0.0, lz + 0.03), V(kx, cy + 0.82, lz + 0.03), 0.065, 24); box('rubber', [kx, cy + 0.9, lz + 0.03], [0.13, 0.13, 0.13]); cyl('steelDark', V(kx, cy + 0.96, lz + 0.03), V(kx, cy + 1.3, lz - 0.2), 0.012, 8);
    // ───── manômetros e pressostatos no topo-frente ─────
    const mpx = cx + 0.35, mpz = zb - 0.25, top = cy + R;
    const gp = V(mpx, top + 0.48, mpz + 0.05);
    cyl('steel', V(mpx, top - 0.02, mpz), V(mpx, top + 0.18, mpz), 0.022, 12);
    batch.add('steel', G.cached('pigtail', () => { const t = new THREE.TorusGeometry(0.05, 0.009, 8, 24, Math.PI * 1.8); return t; }), G.mat4([mpx, top + 0.24, mpz]));
    cyl('steel', V(mpx, top + 0.28, mpz), V(mpx, top + 0.42, mpz), 0.01, 8); cyl('cast', V(mpx, top + 0.33, mpz), V(mpx, top + 0.37, mpz), 0.022);
    const g1 = G.gauge(group, batch, M, faceP.tex, gp, Z, 0.085); needles.push({ n: g1.needle, ang: faceP.ang, v: 9.6, jit: 0.06, seed: num * 1.7 });
    for (const dx of [-0.35, -0.6]) { cyl('steel', V(cx + dx, top - 0.02, mpz), V(cx + dx, top + 0.25, mpz), 0.018, 10); box('paintDark', [cx + dx, top + 0.33, mpz], [0.1, 0.14, 0.09]); }
    // ───── válvula principal de vapor (topo, z = saída) + saída vertical ─────
    const sp = PIPES.find((p) => p.id === (num === 1 ? 'saida1' : 'saida2')); const zs = sp.c[2];
    cyl('steelHot', V(cx, top - 0.06, zs), V(cx, top + 0.14, zs), sp.R + 0.01, 24);
    G.flange(batch, inst, 'steelHot', M.nut, V(cx, top + 0.15, zs), Y, sp.R, { bolts: 8 });
    G.valve(batch, inst, M, V(cx, top + 0.45, zs), Y, X, sp.R, { wheel: 'red', size: 1.5, gate: true });
    pipe('steelHot', [V(cx, top + 0.75, zs), V(cx, 5.7, zs)], sp.R);
    G.flange(batch, inst, 'steelHot', M.nut, V(cx, 4.4, zs), Y, sp.R, { bolts: 8 });
    // ───── válvulas de segurança (2) com descarga até o telhado ─────
    for (const [k, zz] of [[0, zf - 1.75], [1, zf - 2.25]]) {
      cyl('steelHot', V(cx, top - 0.05, zz), V(cx, top + 0.1, zz), 0.07, 18); G.flange(batch, inst, 'steelHot', M.nut, V(cx, top + 0.1, zz), Y, 0.06, { bolts: 4 });
      const vb = V(cx, top + 0.24, zz); batch.add('cast', G.cached('svBody', () => new THREE.SphereGeometry(0.1, 18, 12)), G.mat4([vb.x, vb.y, vb.z]));
      batch.add('cast', G.cached('svBonnet', () => new THREE.CylinderGeometry(0.05, 0.075, 0.42, 18)), G.mat4([vb.x, vb.y + 0.3, vb.z]));
      batch.add('svRed', G.cached('svCap', () => new THREE.CylinderGeometry(0.035, 0.05, 0.1, 14)), G.mat4([vb.x, vb.y + 0.56, vb.z]));
      box('steelDark', [vb.x + 0.12, vb.y + 0.45, vb.z], [0.26, 0.02, 0.025], [0, 0, -0.35]);
      pipe('steel', [V(cx + 0.02, vb.y, zz), V(cx - 0.34, vb.y, zz), V(cx - 0.34, 10.9, zz)], 0.055, 0.12);
      G.flange(batch, inst, 'steel', M.nut, V(cx - 0.16, vb.y, zz), X, 0.055, { bolts: 4 });
      void k;
    }
    // respiro/dreno de ar (válvula pequena, volante azul)
    cyl('steelHot', V(cx + 0.45, top - 0.1, zf - 3.1), V(cx + 0.45, top + 0.12, zf - 3.1), 0.03, 12);
    G.valve(batch, inst, M, V(cx + 0.45, top + 0.2, zf - 3.1), Y, X, 0.025, { wheel: 'blue' });
    // boca de visita (topo)
    cyl('steelHot', V(cx, top - 0.05, zf - 4.2), V(cx, top + 0.1, zf - 4.2), 0.26, 32); cyl('steelHot', V(cx, top + 0.1, zf - 4.2), V(cx, top + 0.13, zf - 4.2), 0.3, 32);
    for (const s of [-1, 1]) box('steelDark', [cx, top + 0.18, zf - 4.2 + s * 0.12], [0.62, 0.05, 0.05]);
    // ───── selas (azul) sobre bases de concreto ─────
    for (const zz of [zc - 2.05, zc + 1.75]) {
      const sh = new THREE.Shape(); const w = 1.0, y0 = 0.13; sh.moveTo(-w, y0); sh.lineTo(w, y0);
      const ytop = (x) => cy - Math.sqrt(Math.max(0, (R + 0.012) ** 2 - x * x));
      sh.lineTo(w, ytop(w)); for (let i = 1; i < 24; i++) { const x = w - (2 * w * i) / 24; sh.lineTo(x, ytop(x)); } sh.lineTo(-w, ytop(-w)); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false }); { const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) + P.getZ(i), P.getY(i)); }
      batch.add('paintBlue', g, G.mat4([cx, 0, zz - 0.11]));
      box('paintBlue', [cx, 0.14, zz], [2.25, 0.03, 0.42]);
      for (const sx of [-0.6, 0, 0.6]) box('paintBlue', [cx + sx, 0.4, zz + 0.16], [0.02, 0.5, 0.1]);
      box('concrete', [cx, 0.06, zz], [2.5, 0.12, 0.62]);
      for (const sx of [-1.0, 1.0]) for (const sz of [-0.15, 0.15]) inst.add('nut', G.hexGeo(), M.nut, G.mat4([cx + sx, 0.17, zz + sz], [0, 0, 0], [0.04, 0.03, 0.04]));
    }
    // ───── caixa de fumaça traseira + chaminé isolada até o telhado ─────
    box('paintAlu', [cx, 1.8, zr - 0.25], [1.3, 2.5, 0.72]);
    box('paintAlu', [cx, 0.3, zr - 0.25], [1.0, 0.6, 0.5]);
    G.boltCircle(inst, M.nut, V(cx, 1.8, zr - 0.25), Y, 0.0001, 1, 0.001, 0.001); // (placeholder sem efeito)
    for (const dx of [-0.66, 0.66]) for (let k = 0; k < 7; k++) inst.add('nut', G.hexGeo(), M.nut, G.alignY(V(cx + dx * 1.005, 0.7 + k * 0.36, zr + 0.0), X, [0.03, 0.02, 0.03]));
    const chz = zr - 0.3;
    batch.add('clad', G.shellGeo(0.32, 11.2 - 3.05, { top: 'none', bot: 'none', seg: 40, sheetW: 1.0, sheetL: 1.0 }), G.mat4([cx, 3.05 + (11.2 - 3.05) / 2, chz]));
    const chS = G.cached('chStrap', () => new THREE.CylinderGeometry(0.327, 0.327, 0.03, 40, 1, true));
    for (let y = 3.6; y < 9.5; y += 1.0) batch.add('steel', chS, G.mat4([cx, y, chz]));
    cyl('paintAlu', V(cx, 3.03, chz), V(cx, 3.25, chz), 0.36, 32);
    box('steelDark', [cx + 0.38, 3.6, chz], [0.12, 0.03, 0.03]); // alavanca do registro (damper)
    cyl('steel', V(cx - 0.32, 4.2, chz), V(cx - 0.42, 4.2, chz), 0.025, 10); // tomada de amostragem
    // ───── descarga de fundo ─────
    const dz = zr + 0.7; cyl('steelHot', V(cx, cy - R + 0.05, dz), V(cx, 0.45, dz), 0.035, 12); cyl('cast', V(cx - 0.06, 0.38, dz), V(cx + 0.06, 0.38, dz), 0.05); box('paintRed', [cx, 0.38, dz + 0.16], [0.03, 0.03, 0.3]);
    pipe('steelHot', [V(cx, 0.38, dz), V(cx, 0.25, dz - 0.1), V(cx, 0.25, -9.55)], 0.035, 0.1);
    // ───── água de alimentação (verde): retenção + globo, desce e corre junto à parede do fundo ─────
    const fx = cx - R - 0.32, fz = zf - 1.15;
    pipe('paintGreen', [V(cx - R + 0.1, cy + 0.3, fz), V(fx, cy + 0.3, fz), V(fx, 0.3, fz), V(fx, 0.3, -9.2)], 0.038, 0.12);
    G.valve(batch, inst, M, V(fx, 1.2, fz), Y, X.clone().negate(), 0.038, { wheel: 'blue' });
    cyl('cast', V(fx, 1.62, fz), V(fx, 1.78, fz), 0.06);
    // ───── identificação e placas ─────
    const plate = new THREE.Mesh(G.cached('plate', () => new THREE.PlaneGeometry(0.42, 0.29)), new THREE.MeshStandardMaterial({ map: TX.nr13Plate({ tag: `CALDEIRA ${num}`, serie: num === 1 ? '0417/2016' : '0418/2016' }), metalness: 0.6, roughness: 0.35 }));
    plate.position.set(cx + R + 0.035, cy - 0.1, zf - 1.05); plate.rotation.y = Math.PI / 2; group.add(plate);
    for (const dz2 of [-0.12, 0.12]) for (const dy of [-0.13, 0.13]) cyl('steelDark', V(cx + R - 0.01, cy - 0.1 + dy, zf - 1.05 + dz2), V(cx + R + 0.033, cy - 0.1 + dy, zf - 1.05 + dz2), 0.008, 6);
    sign('cat', V(cx + R * 0.86, cy + R * 0.52, zc + 0.6), V(0.86, 0.52, 0), 0.55, 0.42, `CALD-0${num}`);
    sign('quente', V(cx - 0.62, cy + 0.85, doorZ(0.95) + 0.03), V(0, 0.12, 1), 0.2);
    // ───── painel de comando (gabinete cinza com IHM) à esquerda da frente ─────
    panel(ctx, V(cx - 1.95, 0, zf + 0.42), 0, `CALDEIRA ${num}`, num);
  }

  // ═════════════ LINHA AÉREA ISOLADA (aerea) + descida ao coletor ═════════════
  const aer = PIPES.find((p) => p.id === 'aerea'), col = PIPES.find((p) => p.id === 'coletor');
  const ay = aer.c[1], az = aer.c[2], ax0 = aer.c[0] - aer.L / 2 + 0.5, ax1 = aer.c[0] + aer.L / 2; // 36.5 → 50
  const xD = 50.0;
  { const { geo } = G.tubeGeo([V(ax0, 5.7, az), V(ax0, ay, az), V(xD, ay, az), V(xD, ay, col.c[2]), V(xD, 2.75, col.c[2])], aer.R, 0.45, 28); batch.add('clad', geo, null); }
  // tê da caldeira 2
  cyl('clad', V(42.5, 5.7, az), V(42.5, ay, az), aer.R, 28);
  // cintas da linha aérea
  const aS = G.cached('aStrap', () => new THREE.CylinderGeometry(aer.R + 0.004, aer.R + 0.004, 0.022, 28, 1, true));
  for (let x = ax0 + 0.8; x < xD - 0.5; x += 1.0) batch.add('steel', aS, G.mat4([x, ay, az], [0, 0, Math.PI / 2]));
  for (const y of [5.9]) for (const x of [ax0, 42.5]) batch.add('steel', aS, G.mat4([x, y, az]));
  // suportes pendurados nas tesouras (tirante + braçadeira)
  for (const x of [38.0, 40.5, 44.5, 47.0, 49.0]) { cyl('steelDark', V(x, ay + aer.R + 0.03, az), V(x, ctx.TRUSS_Y, az), 0.012, 8); batch.add('steelDark', G.cached('clamp' + aer.R, () => new THREE.TorusGeometry(aer.R + 0.03, 0.012, 6, 28)), G.mat4([x, ay, az], [0, Math.PI / 2, 0])); }
  // descida nua ao coletor com válvula de bloqueio
  pipe('steelHot', [V(xD, 2.75, col.c[2]), V(xD, col.c[1] + col.R, col.c[2])], 0.1);
  G.valve(batch, inst, M, V(xD, 2.28, col.c[2]), Y, Z, 0.1, { wheel: 'red', size: 1.4, gate: true });

  // ═════════════ COLETOR / DISTRIBUIDOR DE VAPOR ═════════════
  const [kx, ky, kz] = col.c, kx0 = kx - col.L / 2 + 0.1, kx1 = kx + col.L / 2 - 0.1;
  batch.add('steelHot', G.shellGeo(col.R, kx1 - kx0, { top: 'ell', bot: 'ell', seg: 40, sheetW: 0.6, sheetL: 1.0 }), G.mat4([kx, ky, kz], [0, 0, -Math.PI / 2]));
  // suportes (coluna + berço + abraçadeira U)
  for (const x of [44.4, 47.4, 50.7]) {
    cyl('paintBlue', V(x, 0.1, kz), V(x, ky - col.R - 0.02, kz), 0.06, 16); box('paintBlue', [x, ky - col.R - 0.03, kz], [0.12, 0.04, 0.36]);
    box('paintBlue', [x, 0.12, kz], [0.3, 0.02, 0.3]); box('concrete', [x, 0.05, kz], [0.4, 0.1, 0.4]);
    batch.add('steelDark', G.cached('ubolt', () => new THREE.TorusGeometry(col.R + 0.012, 0.009, 6, 24, Math.PI)), G.mat4([x, ky, kz], [0, Math.PI / 2, 0]));
  }
  // saídas no topo: bocal vertical → curva para o fundo → válvula (volante vermelho) → sobe pela parede
  const outs = [[44.9, 0.07, 4.4], [46.15, 0.06, 5.0], [47.45, 0.07, 4.7]];
  const wz = -9.3;
  outs.forEach(([x, r, yr], i) => {
    pipe('steelHot', [V(x, ky, kz), V(x, ky + col.R + 0.28, kz), V(x, ky + col.R + 0.28, wz), V(x, yr, wz), V(i === 2 ? x + 0.6 : x - 0.6, yr, wz)], r, 0.18);
    G.flange(batch, inst, 'steelHot', M.nut, V(x, ky + col.R + 0.08, kz), Y, r, { bolts: 6 });
    G.valve(batch, inst, M, V(x, ky + col.R + 0.28, -8.88), Z.clone().negate(), Y, r, { wheel: i === 1 ? 'blue' : 'red', size: 1.2 });
  });
  // linhas ao longo da parede do fundo (para os processos) — y 4,4 / 5,0 / 4,7
  pipe('clad', [V(44.3, 4.4, wz), V(31.0, 4.4, wz), V(31.0, 4.4, -6.0), V(30.2, 4.4, -6.0)], 0.1, 0.3);
  pipe('clad', [V(45.55, 5.0, wz), V(31.6, 5.0, wz), V(31.6, 5.0, -4.0), V(30.2, 5.0, -4.0)], 0.09, 0.3);
  // linha para o trocador (isolada): parede → +x → atravessa por cima do corredor → desce no bocal do casco
  const tr = BOILERS.find((b) => b.id === 'trocador');
  const tIn = V(tr.c[0] - tr.L / 2 + 1.25, tr.c[1] + tr.R + 0.3, tr.c[2]);
  pipe('clad', [V(48.05, 4.7, wz), V(49.2, 4.7, wz), V(49.2, 4.7, tr.c[2]), V(tIn.x, 4.7, tr.c[2]), V(tIn.x, tIn.y + 0.85, tr.c[2])], 0.085, 0.3);
  for (const zz of [-6.6, -3.6, -0.6]) { cyl('steelDark', V(49.2, 4.8, zz), V(49.2, ctx.TRUSS_Y, zz), 0.01, 6); }
  // válvula com a gaxeta vazando (frente do coletor, x = 48,7): bocal +z → curva para cima → válvula vertical com castelo para +z
  const lk = LEAKS.find((l) => l.id === 'purgador');
  const lx = lk.pos[0], rz = kz + col.R + 0.22;
  pipe('steelHot', [V(lx, ky, kz), V(lx, ky, rz), V(lx, 3.05, rz), V(lx, 3.05, wz), V(lx, 3.6, wz)], 0.06, 0.16);
  G.flange(batch, inst, 'steelHot', M.nut, V(lx, ky, kz + col.R + 0.06), Z, 0.06, { bolts: 6 });
  const lv = G.valve(batch, inst, M, V(lx, 1.98, rz), Y, Z, 0.06, { wheel: 'red', size: 1.25 });
  ctx.emitters.purgador = { pos: lv.gland.clone(), dir: V(0.55, 0.35, 0.75).normalize() };
  // manômetro do coletor
  cyl('steelHot', V(45.6, ky + col.R - 0.02, kz), V(45.6, ky + col.R + 0.22, kz), 0.015, 10);
  const g2 = G.gauge(group, batch, M, faceP.tex, V(45.6, ky + col.R + 0.33, kz + 0.03), Z, 0.08); needles.push({ n: g2.needle, ang: faceP.ang, v: 9.3, jit: 0.05, seed: 7.3 });
  // termômetro bimetálico
  cyl('steelHot', V(46.8, ky + col.R - 0.02, kz), V(46.8, ky + col.R + 0.16, kz), 0.012, 8);
  const ft = TX.gaugeFace({ max: 250, red: 200, unit: '°C' });
  const g3 = G.gauge(group, batch, M, ft.tex, V(46.8, ky + col.R + 0.24, kz + 0.02), Z, 0.06); needles.push({ n: g3.needle, ang: ft.ang, v: 182, jit: 0.4, seed: 2.1 });
  // purgador (perna de dreno + purgador termodinâmico + saída ao ralo)
  const px = 49.4;
  pipe('steelHot', [V(px, ky - col.R + 0.02, kz), V(px, 0.62, kz), V(px, 0.62, kz - 0.3), V(px, 0.32, kz - 0.3), V(px, 0.32, -8.84), V(px, 0.06, -8.84)], 0.03, 0.08);
  batch.add('cast', G.cached('trap', () => new THREE.CylinderGeometry(0.06, 0.06, 0.09, 6)), G.mat4([px, 0.62, kz - 0.15], [Math.PI / 2, 0, 0]));
  G.valve(batch, inst, M, V(px, 1.0, kz), Y, Z, 0.025, { wheel: 'red' });
  ctx.emitters.dreno = { pos: V(px, 0.08, -8.84), dir: Y.clone() };
  // gaxeta (anel escurecido de umidade) já feita pelo prensa-gaxeta da válvula

  // ═════════════ TROCADOR CASCO-TUBO (sem isolamento) ═════════════
  {
    const [tx, ty, tz] = tr.c, R = tr.R, xa = tx - tr.L / 2, xb = tx + tr.L / 2;
    const s0 = xa + 0.66, s1 = xb - 0.46; // casco
    batch.add('steelHot', G.shellGeo(R, s1 - s0, { top: 'none', bot: 'none', seg: 64, sheetW: 0.6, sheetL: 1.0 }), G.mat4([(s0 + s1) / 2, ty, tz], [0, 0, -Math.PI / 2]));
    // costuras de solda circunferenciais (cordão escurecido)
    for (const x of [s0 + 1.1, s0 + 2.2]) batch.add('weld', G.cached('weld' + R, () => new THREE.TorusGeometry(R + 0.002, 0.008, 6, 64)), G.mat4([x, ty, tz], [0, Math.PI / 2, 0]));
    // flanges grandes do espelho (par) e carretel/canal
    for (const x of [s0, s1]) { cyl('steelHot', V(x - 0.05, ty, tz), V(x + 0.05, ty, tz), R + 0.14, 64); G.boltCircle(inst, M.nut, V(x + 0.05, ty, tz), X, R + 0.08, 24, 0.04, 0.035); G.boltCircle(inst, M.nut, V(x - 0.05, ty, tz), X.clone().negate(), R + 0.08, 24, 0.04, 0.035); }
    batch.add('steelHot', G.shellGeo(R + 0.01, s0 - xa - 0.2, { top: 'none', bot: 'none', seg: 64, sheetW: 0.6 }), G.mat4([xa + 0.1 + (s0 - xa - 0.2) / 2, ty, tz], [0, 0, -Math.PI / 2]));
    cyl('steelHot', V(xa + 0.02, ty, tz), V(xa + 0.12, ty, tz), R + 0.14, 64); G.boltCircle(inst, M.nut, V(xa + 0.02, ty, tz), X.clone().negate(), R + 0.08, 24, 0.04, 0.035);
    cyl('steelHot', V(xa - 0.04, ty, tz), V(xa + 0.02, ty, tz), R + 0.12, 64); // tampa plana do canal
    box('steel', [xa - 0.045, ty, tz], [0.01, 0.14, 0.22]); // placa de identificação da tampa
    // tampo traseiro (calota elipsoidal)
    batch.add('steelHot', G.shellGeo(R, 0.06, { top: 'ell', bot: 'none', seg: 64, sheetW: 0.6 }), G.mat4([s1 + 0.08, ty, tz], [0, 0, -Math.PI / 2]));
    // bocais: entrada de vapor no topo do casco, saída de condensado embaixo, entrada/saída de água no canal
    cyl('steelHot', V(tIn.x, ty + R - 0.05, tz), V(tIn.x, tIn.y + 0.85, tz), 0.085, 24); G.flange(batch, inst, 'steelHot', M.nut, V(tIn.x, ty + R + 0.2, tz), Y, 0.085, { bolts: 8 });
    G.valve(batch, inst, M, V(tIn.x, ty + R + 0.55, tz), Y, Z, 0.085, { wheel: 'red', size: 1.3 });
    const cx2 = xb - 0.9; cyl('steelHot', V(cx2, ty - R + 0.05, tz), V(cx2, 0.32, tz), 0.06, 20); G.flange(batch, inst, 'steelHot', M.nut, V(cx2, ty - R - 0.12, tz), Y, 0.06, { bolts: 6 });
    pipe('steelHot', [V(cx2, 0.32, tz), V(cx2, 0.22, tz - 0.2), V(cx2, 0.22, tz - 1.3), V(55.6, 0.22, tz - 1.3)], 0.045, 0.12);
    for (const s of [-1, 1]) {
      const nz = tz + s * (R + 0.05), nx = xa + 0.35;
      cyl('steelHot', V(nx, ty + s * 0.18, tz), V(nx, ty + s * 0.18, nz + s * 0.18), 0.075, 20); G.flange(batch, inst, 'steelHot', M.nut, V(nx, ty + s * 0.18, nz + s * 0.12), V(0, 0, s), 0.075, { bolts: 8 });
    }
    pipe('paintGreen', [V(xa + 0.35, ty + 0.18, tz + R + 0.24), V(xa + 0.35, ty + 0.18, tz + R + 0.45), V(xa + 0.35, 3.9, tz + R + 0.45), V(55.75, 3.9, tz + R + 0.45)], 0.07, 0.2);
    pipe('paintGreen', [V(xa + 0.35, ty - 0.18, tz - R - 0.24), V(xa + 0.35, ty - 0.18, tz - R - 0.45), V(xa + 0.35, 3.6, tz - R - 0.45), V(55.75, 3.6, tz - R - 0.45)], 0.07, 0.2);
    // termômetros nos bocais
    const ft2 = TX.gaugeFace({ max: 200, red: 160, unit: '°C' });
    const g4 = G.gauge(group, batch, M, ft2.tex, V(xa + 0.35, ty + 0.42, tz + R + 0.3), Z, 0.055); needles.push({ n: g4.needle, ang: ft2.ang, v: 88, jit: 0.3, seed: 4.4 });
    const g5 = G.gauge(group, batch, M, faceP.tex, V(tIn.x + 0.2, tIn.y + 0.55, tz + 0.12), Z, 0.065, [V(tIn.x + 0.2, tIn.y + 0.45, tz + 0.05), V(tIn.x + 0.09, tIn.y + 0.45, tz)]); needles.push({ n: g5.needle, ang: faceP.ang, v: 6.1, jit: 0.05, seed: 3.3 });
    // selas
    for (const x of [s0 + 0.55, s1 - 0.55]) {
      const sh = new THREE.Shape(), w = 0.45; sh.moveTo(-w, 0.12); sh.lineTo(w, 0.12); const yt = (q) => ty - Math.sqrt(Math.max(0, (R + 0.01) ** 2 - q * q)); sh.lineTo(w, yt(w)); for (let i = 1; i < 16; i++) { const q = w - (2 * w * i) / 16; sh.lineTo(q, yt(q)); } sh.lineTo(-w, yt(-w)); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false }); batch.add('paintBlue', g, G.mat4([x - 0.08, 0, tz], [0, Math.PI / 2, 0]));
      box('concrete', [x, 0.06, tz], [0.4, 0.12, 1.1]);
    }
    ctx.sign('quente', V(tx, ty + R + 0.32, tz + 0.25), V(0, 0, 1), 0.22);
  }

  // ═════════════ DESAERADOR VERTICAL + BOMBAS ═════════════
  {
    const de = BOILERS.find((b) => b.id === 'desaerador'); const [dx, , dz] = de.c, R = de.R;
    const yb = 0.6, Lc = de.L - yb - R; // tampos 2:1 (R/2 cada)
    batch.add('clad', G.shellGeo(R, Lc, { top: 'ell', bot: 'ell', seg: 72, sheetW: 1.2, sheetL: 1.0 }), G.mat4([dx, yb + R / 2 + Lc / 2, dz]));
    const sS = G.cached('dStrap', () => new THREE.CylinderGeometry(R + 0.006, R + 0.006, 0.03, 72, 1, true));
    for (let y = yb + R / 2 + 0.5; y < yb + R / 2 + Lc; y += 1.0) batch.add('steel', sS, G.mat4([dx, y, dz]));
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, lx2 = dx + Math.cos(a) * (R - 0.15), lz2 = dz + Math.sin(a) * (R - 0.15); batch.add('paintBlue', G.iBeamGeo(0.16, 0.16, 0.008, 0.012, yb + 0.35), G.mat4([lx2, (yb + 0.35) / 2, lz2], [Math.PI / 2, a, 0])); box('paintBlue', [lx2, 0.01, lz2], [0.28, 0.02, 0.28]); }
    // respiro no topo (válvula + bocal aberto) → pluma
    const ty2 = yb + R / 2 + Lc + R / 2; // 4,4
    cyl('steelHot', V(dx, ty2 - 0.08, dz), V(dx, ty2 + 0.12, dz), 0.05, 16); G.valve(batch, inst, M, V(dx, ty2 + 0.2, dz), Y, X, 0.04, { wheel: 'red' });
    cyl('steelHot', V(dx, ty2 + 0.28, dz), V(dx, ty2 + 0.32, dz), 0.045, 16);
    ctx.emitters.respiro = { pos: V(dx, ty2 + 0.33, dz), dir: Y.clone() };
    // bocais do topo (entrada de condensado/reposição)
    for (const [ox, oz] of [[0.5, 0.2], [-0.4, -0.45]]) { const yy = ty2 - 0.12 - (Math.hypot(ox, oz) ** 2) * 0.45; cyl('steelHot', V(dx + ox, yy, dz + oz), V(dx + ox, ty2 + 0.12, dz + oz), 0.05, 14); G.flange(batch, inst, 'steelHot', M.nut, V(dx + ox, ty2 + 0.1, dz + oz), Y, 0.05, { bolts: 4 }); }
    pipe('steelHot', [V(dx + 0.5, ty2 + 0.12, dz + 0.2), V(dx + 0.5, 5.6, dz + 0.2), V(dx + 0.5, 5.6, -9.3), V(44.0, 5.6, -9.3)], 0.05, 0.15);
    // visor de nível lateral e manômetro
    cyl('steel', V(dx - R - 0.02, 1.3, dz), V(dx - R - 0.12, 1.3, dz), 0.02, 10); cyl('steel', V(dx - R - 0.02, 3.2, dz), V(dx - R - 0.12, 3.2, dz), 0.02, 10);
    cyl('steel', V(dx - R - 0.14, 1.25, dz), V(dx - R - 0.14, 3.25, dz), 0.03, 12);
    const g6 = G.gauge(group, batch, M, TX.gaugeFace({ max: 4, red: 1.5, unit: 'kgf/cm²' }).tex, V(dx - R - 0.14, 3.45, dz + 0.0), X.clone().negate(), 0.07); needles.push({ n: g6.needle, ang: (v) => -(Math.PI * 0.75 + Math.PI * 1.5 * v / 4), v: 0.35, jit: 0.01, seed: 8.8 });
    // plataforma de topo + escada marinheiro com gaiola
    const px0 = dx + 0.35, px1 = dx + 1.55, pz0 = dz - 0.65, pz1 = dz + 0.65, py = 4.45;
    box('grating', [(px0 + px1) / 2, py, (pz0 + pz1) / 2], [px1 - px0, 0.04, pz1 - pz0]);
    for (const [x, z] of [[px1, pz0], [px1, pz1], [px0 + 0.3, pz0], [px0 + 0.3, pz1]]) cyl('paintYellow', V(x, py, z), V(x, py + 1.1, z), 0.024, 10);
    for (const yy of [0.55, 1.1]) { cyl('paintYellow', V(px0 + 0.3, py + yy, pz0), V(px1, py + yy, pz0), 0.022, 8); cyl('paintYellow', V(px0 + 0.3, py + yy, pz1), V(px1, py + yy, pz1), 0.022, 8); cyl('paintYellow', V(px1, py + yy, pz0), V(px1, py + yy, dz - 0.25), 0.022, 8); }
    for (const yy of [0.5, 2.0, 3.6]) cyl('paintBlue', V(dx + R * 0.7, yy + 0.2, dz + R * 0.7), V(px1 - 0.2, yy + 0.2, pz1 - 0.2), 0.03, 8);
    const lxx = px1 + 0.2, lz0 = dz - 0.22, lz1 = dz + 0.22;
    for (const zz of [lz0, lz1]) cyl('paintYellow', V(lxx, 0, zz), V(lxx, py + 1.1, zz), 0.025, 10);
    for (let y = 0.3; y < py; y += 0.3) cyl('paintYellow', V(lxx, y, lz0), V(lxx, y, lz1), 0.014, 6);
    const hoop = G.cached('hoop', () => new THREE.TorusGeometry(0.36, 0.012, 6, 24, Math.PI));
    for (let y = 2.3; y <= py + 1.0; y += 0.7) batch.add('paintYellow', hoop, G.mat4([lxx, y, dz], [Math.PI / 2, 0, -Math.PI / 2]));
    for (const a of [-0.9, 0, 0.9]) { const zz = dz + Math.sin(a) * 0.36, xx = lxx + Math.cos(a) * 0.36; cyl('paintYellow', V(xx, 2.3, zz), V(xx, py + 1.0, zz), 0.012, 6); }
    // bombas de alimentação (2): base, bomba centrífuga, acoplamento (protetor amarelo), motor
    for (const [bx, bz] of [[51.7, -4.0], [53.5, -4.0]]) {
      box('paintBlue', [bx, 0.12, bz], [1.25, 0.12, 0.42]); box('concrete', [bx, 0.04, bz], [1.4, 0.08, 0.55]);
      batch.add('pumpBlue', G.cached('volute', () => { const g = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 28); g.rotateZ(Math.PI / 2); return g; }), G.mat4([bx - 0.38, 0.42, bz]));
      cyl('pumpBlue', V(bx - 0.47, 0.42, bz), V(bx - 0.7, 0.42, bz), 0.07, 16); G.flange(batch, inst, 'cast', M.nut, V(bx - 0.62, 0.42, bz), X, 0.07, { bolts: 4 });
      cyl('pumpBlue', V(bx - 0.38, 0.6, bz), V(bx - 0.38, 0.85, bz), 0.05, 14);
      box('paintYellow', [bx - 0.12, 0.42, bz], [0.24, 0.16, 0.18]);
      cyl('motor', V(bx + 0.02, 0.42, bz), V(bx + 0.55, 0.42, bz), 0.15, 28); for (let k = 0; k < 9; k++) cyl('motor', V(bx + 0.08 + k * 0.05, 0.42, bz), V(bx + 0.095 + k * 0.05, 0.42, bz), 0.165, 28);
      cyl('motorDark', V(bx + 0.55, 0.42, bz), V(bx + 0.6, 0.42, bz), 0.13, 24); box('motor', [bx + 0.25, 0.62, bz], [0.14, 0.09, 0.14]);
      pipe('steelHot', [V(bx - 0.7, 0.42, bz), V(bx - 0.95, 0.42, bz), V(bx - 0.95, 0.42, dz + 1.25), V(dx, 0.42, dz + 1.25), V(dx, 0.42, dz + 0.4), V(dx, 0.6, dz + 0.4)], 0.06, 0.15);
      pipe('paintGreen', [V(bx - 0.38, 0.85, bz), V(bx - 0.38, 1.4, bz), V(bx - 0.38, 1.4, -9.2), V(bx - 0.38, 0.3, -9.2)], 0.04, 0.12);
      G.valve(batch, inst, M, V(bx - 0.38, 1.12, bz), Y, X, 0.04, { wheel: 'blue' });
    }
    // água de alimentação: coletor verde junto ao fundo até as caldeiras
    pipe('paintGreen', [V(53.12, 0.3, -9.2), V(34.0, 0.3, -9.2)], 0.045, 0.12);
    for (let x = 35; x < 53; x += 2.5) box('paintBlue', [x, 0.13, -9.2], [0.08, 0.26, 0.2]);
    ctx.sign('quente', V(dx - R - 0.01, 2.2, dz + 0.0), V(-1, 0, 0), 0.24);
  }

  // ═════════════ REDE DE GÁS (amarela) ao longo das frentes ═════════════
  { const gz = BOILERS[0].c[2] + BOILERS[0].L / 2 + 0.22; pipe('gasYellow', [V(30.25, 3.6, -3.0), V(31.0, 3.6, -3.0), V(31.0, 3.6, gz), V(41.88, 3.6, gz)], 0.035, 0.15);
    for (let x = 32.5; x < 42; x += 2.4) cyl('steelDark', V(x, 3.64, gz), V(x, ctx.TRUSS_Y, gz), 0.009, 6);
    // abrigo da válvula de bloqueio geral (parede esquerda)
    G.valve(batch, inst, M, V(30.6, 3.6, -3.0), X, Y, 0.035, { wheel: 'red' });
  }
  // ═════════════ ELETROCALHA na parede do fundo ═════════════
  { box('galv', [43, 3.35, -9.72], [25.4, 0.02, 0.32]); box('galv', [43, 3.4, -9.57], [25.4, 0.1, 0.012]); box('galv', [43, 3.4, -9.87], [25.4, 0.1, 0.012]);
    for (let x = 31; x < 56; x += 1.5) box('steelDark', [x, 3.33, -9.75], [0.04, 0.04, 0.4]);
    for (let k = 0; k < 7; k++) cyl('rubber', V(31, 3.39, -9.62 - k * 0.035), V(55.5, 3.39, -9.62 - k * 0.035), 0.012, 6); }
}

// painel de comando da caldeira: gabinete cinza autoportante com IHM, botoeiras, sinaleiros, placa de advertência
function panel(ctx, base, rotY, label, num) {
  const { group, batch, M } = ctx;
  const g = new THREE.Group(); g.position.copy(base); g.rotation.y = rotY; group.add(g);
  const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(base);
  const add = (key, geo, local) => batch.add(key, geo, m.clone().multiply(local));
  add('cabinet', G.boxGeo(0.8, 1.8, 0.4), G.mat4([0, 1.0, 0])); add('paintDark', G.boxGeo(0.84, 0.1, 0.44), G.mat4([0, 0.05, 0]));
  add('cabinet', G.boxGeo(0.84, 0.04, 0.44), G.mat4([0, 1.92, 0]));
  add('chrome', G.boxGeo(0.03, 0.16, 0.03), G.mat4([0.33, 1.1, 0.215])); add('steelDark', G.boxGeo(0.005, 1.7, 0.005), G.mat4([0, 1.0, 0.2]));
  const front = new THREE.Mesh(G.cached('pfront', () => new THREE.PlaneGeometry(0.8, 1.0)), new THREE.MeshStandardMaterial({ map: TX.panelFront(label), roughness: 0.42, metalness: 0.1 }));
  front.position.set(0, 1.35, 0.2015); g.add(front);
  // IHM (tela emissiva) — 7" na área preta da textura
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const sc = new THREE.Mesh(G.cached('hmi', () => new THREE.PlaneGeometry(0.5, 0.375)), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5) }));
  sc.position.set(0, 1.35 + 0.5 - 0.104 * 1.0 / 0.64 - 0.375 / 2 + 0.005, 0.203); sc.userData.noBloom = true; g.add(sc);
  // posição exata: textura 512×640 em plano 0.8×1.0 → 1 px = 1/640 m; área preta x 96..416, y 104..352
  sc.position.set(0, 1.35 + 0.5 - (104 + 124) / 640, 0.203); sc.scale.set(320 / 640 / 0.5, 248 / 640 / 0.375, 1);
  ctx.screens.push({ ctx: cv.getContext('2d'), tex: t, W: 512, H: 384, kind: 'cald', id: num });
  // cabos sobem do gabinete até a eletrocalha
  add('rubber', G.unitCyl(8), G.mat4([-0.25, 2.6, -0.1], [0, 0, 0], [0.02, 1.4, 0.02])); add('rubber', G.unitCyl(8), G.mat4([-0.2, 2.6, -0.1], [0, 0, 0], [0.015, 1.4, 0.015]));
  ctx.sign('operador', base.clone().add(new THREE.Vector3(0.62, 1.55, 0.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)), new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY), 0.28);
}
