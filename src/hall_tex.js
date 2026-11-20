// Texturas procedurais do prédio (CENÁRIO): azulejo branco 15×15, pintura epóxi, piso cerâmico industrial antiderrapante,
// macro de desgaste/farinha/umidade do piso, forro em painéis, grelha de ralo, placas de sinalização.
import * as THREE from 'three';
import { HALL, OVENS, ovenFrontZ, BENCH, STATIONS, TABLE } from './layout.js';

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }

function tex(c, { srgb = false, rep = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
// altura (Float32Array S×S, metros relativos) → normal map tangente (wrap)
function heightToNormal(H, S, strength) {
  const [c, g] = cnv(S); const id = g.createImageData(S, S), d = id.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const xl = H[y * S + ((x - 1 + S) % S)], xr = H[y * S + ((x + 1) % S)], yu = H[((y - 1 + S) % S) * S + x], yd = H[((y + 1) % S) * S + x];
    let nx = (xl - xr) * strength, ny = (yd - yu) * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * S + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); return tex(c);
}
// ruído de valor 2D periódico
function vnoise(S, cell, R) {
  const n = Math.max(1, Math.round(S / cell)), grid = new Float32Array(n * n).map(() => R());
  return (x, y) => {
    const fx = (x / S) * n, fy = (y / S) * n, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), a = (i, j) => grid[((j % n + n) % n) * n + ((i % n + n) % n)];
    return (a(ix, iy) * (1 - sx) + a(ix + 1, iy) * sx) * (1 - sy) + (a(ix, iy + 1) * (1 - sx) + a(ix + 1, iy + 1) * sx) * sy;
  };
}

// ── azulejo branco 30×30 cm (proporção medida na FOTO 2): 4×4 peças (1,2 m) por repetição; rejunte 3 mm cinza; esmalte com ondulação e
// inclinação individual (reflexo varia de peça para peça), bisotê arredondado nas bordas.
export function tileTextures() {
  const S = 1024, N = 4, P = S / N, R = rng(21), G = 2.6; // rejunte ~3 mm
  const [c, g] = cnv(S), [rc, rg] = cnv(S); const cid = g.createImageData(S, S), rid = rg.createImageData(S, S);
  const H = new Float32Array(S * S);
  const wav = vnoise(S, 96, rng(5)), wav2 = vnoise(S, 9, rng(6));
  const tiles = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) tiles.push({ tx: (R() - 0.5) * 2, ty: (R() - 0.5) * 2, v: (R() - 0.5) * 0.035, w: (R() - 0.5) * 0.012, r: R() });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / P), j = Math.floor(y / P), t = tiles[j * N + i];
    const lx = x - i * P, ly = y - j * P, e = Math.min(lx, ly, P - 1 - lx, P - 1 - ly); // distância à borda (px)
    const k = (y * S + x) * 4; let h, col, rough;
    if (e < G * 0.5) { // rejunte (cimentício, levemente encardido, poroso)
      const n = wav2(x * 3.1, y * 3.1); h = -0.7; col = [150 + n * 16, 150 + n * 15, 146 + n * 14]; rough = 225 + n * 25;
    } else {
      const b = Math.min(1, (e - G * 0.5) / 3.0); const bev = Math.sin(b * Math.PI / 2); // bisotê
      h = bev * 1.0 + (lx / P - 0.5) * t.tx * 0.55 + (ly / P - 0.5) * t.ty * 0.55 + (wav(x, y) - 0.5) * 0.5 + (wav2(x, y) - 0.5) * 0.05;
      const base = 236 + t.v * 255; col = [base + t.w * 255 + 1, base + 1, base - 3 - t.w * 140]; // branco levemente quente/frio por lote
      rough = 40 + t.r * 22 + (1 - b) * 40; // esmalte acetinado: brilho pontual das luzes fica difuso (sem ponto flutuando)
    }
    H[y * S + x] = h;
    cid.data[k] = col[0]; cid.data[k + 1] = col[1]; cid.data[k + 2] = col[2]; cid.data[k + 3] = 255;
    rid.data[k] = rid.data[k + 1] = rid.data[k + 2] = rough; rid.data[k + 3] = 255;
  }
  g.putImageData(cid, 0, 0); rg.putImageData(rid, 0, 0);
  // poucas peças com microrriscos/lascas no esmalte
  for (let n = 0; n < 40; n++) { g.fillStyle = `rgba(150,150,145,${0.15 + R() * 0.2})`; g.fillRect(R() * S, R() * S, 1 + R() * 2, 1); }
  return { map: tex(c, { srgb: true }), rough: tex(rc), normal: heightToNormal(H, S, 1.6), size: 1.2 };
}

// ── pintura epóxi acetinada acima do azulejo (off-white), casca de laranja do rolo ──
export function paintTextures() {
  const S = 512, R = rng(33); const [c, g] = cnv(S), [rc, rg] = cnv(S); const H = new Float32Array(S * S);
  const n1 = vnoise(S, 6, rng(7)), n2 = vnoise(S, 40, rng(8));
  const id = g.createImageData(S, S), rid = rg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = n1(x, y), b = n2(x, y), k = (y * S + x) * 4; H[y * S + x] = a * 0.8 + b * 0.4;
    const v = 226 + (b - 0.5) * 8; id.data[k] = v + 1; id.data[k + 1] = v; id.data[k + 2] = v - 5; id.data[k + 3] = 255;
    rid.data[k] = rid.data[k + 1] = rid.data[k + 2] = 105 + a * 40; rid.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0); rg.putImageData(rid, 0, 0); void R;
  return { map: tex(c, { srgb: true }), rough: tex(rc), normal: heightToNormal(H, S, 0.8), size: 1.6 };
}

// ── piso: porcelanato industrial antiderrapante 40×40 cinza claro, rejunte epóxi 6 mm; 4×4 peças (1,6 m) por repetição ──
export function floorTextures() {
  const S = 1024, N = 4, P = S / N, R = rng(44), G = 4.0;
  const [c, g] = cnv(S), [rc, rg] = cnv(S); const cid = g.createImageData(S, S), rid = rg.createImageData(S, S);
  const H = new Float32Array(S * S);
  const m1 = vnoise(S, 90, rng(9)), m2 = vnoise(S, 14, rng(10)), m3 = vnoise(S, 3, rng(11));
  const tiles = []; for (let j = 0; j < N * N; j++) tiles.push({ v: (R() - 0.5) * 0.05, w: (R() - 0.5) * 0.02, ox: R() * 400, oy: R() * 400, tilt: (R() - 0.5) * 0.4 });
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / P), j = Math.floor(y / P), t = tiles[j * N + i];
    const lx = x - i * P, ly = y - j * P, e = Math.min(lx, ly, P - 1 - lx, P - 1 - ly);
    const k = (y * S + x) * 4; let h, col, rough;
    const sx = (x + t.ox) % S, sy = (y + t.oy) % S;
    if (e < G * 0.5) { const n = m2(x * 2, y * 2); h = -1.2; col = [72 + n * 14, 71 + n * 13, 68 + n * 12]; rough = 215 + n * 30; }
    else {
      const b = Math.min(1, (e - G * 0.5) / 3.0);
      const sp = m3(sx, sy), mm = m1(sx, sy), mid = m2(sx, sy);
      // porcelanato "granilite" fino: base cinza claro + salpicos escuros/claros
      let v = 124 + (mm - 0.5) * 14 + (mid - 0.5) * 7 + t.v * 255;
      if (sp > 0.78) v -= (sp - 0.78) * 150; else if (sp < 0.12) v += (0.12 - sp) * 110;
      col = [v + 1 + t.w * 200, v, v - 3 - t.w * 120];
      h = Math.sin(b * Math.PI / 2) * 0.6 + (sp - 0.5) * 0.35 + (lx / P - 0.5) * t.tilt * 0.1;
      rough = 128 + (sp - 0.5) * 70 + (mid - 0.5) * 30 + (1 - b) * 40; // antiderrapante: microrrugosidade alta
    }
    H[y * S + x] = h;
    cid.data[k] = col[0]; cid.data[k + 1] = col[1]; cid.data[k + 2] = col[2]; cid.data[k + 3] = 255;
    rid.data[k] = rid.data[k + 1] = rid.data[k + 2] = Math.max(0, Math.min(255, rough)); rid.data[k + 3] = 255;
  }
  g.putImageData(cid, 0, 0); rg.putImageData(rid, 0, 0);
  return { map: tex(c, { srgb: true }), rough: tex(rc), normal: heightToNormal(H, S, 1.1), size: 1.6 };
}

// ── macro do piso inteiro (cor ×2 em RGB, rugosidade ×2 em outra textura): trilhas polidas pelo tráfego, farinha junto à
// bancada, umidade junto aos ralos, encardido nos cantos e rodapés, manchas de calor diante dos fornos ──
export function floorMacro(drains) {
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0, S = 1024, SZ = Math.round(S * D / W);
  const px = (x) => ((x - HALL.x0) / W) * S, pz = (z) => ((z - HALL.z0) / D) * SZ, ps = (m) => (m / W) * S;
  const R = rng(77);
  const [c, g] = cnv(S, SZ), [rc, rg] = cnv(S, SZ);
  g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, S, SZ); rg.fillStyle = 'rgb(128,128,128)'; rg.fillRect(0, 0, S, SZ);
  const blob = (ctx, x, y, r, rgb, a) => { const gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); };
  // variação ampla de lote/limpeza
  for (let i = 0; i < 260; i++) blob(g, R() * S, R() * SZ, 20 + R() * 120, R() < 0.5 ? '100,98,94' : '150,150,148', 0.05 + R() * 0.05);
  // trilha de tráfego: diante da linha de fornos e entre fornos ↔ bancada ↔ porta (mais polida = rugosidade menor, um pouco mais escura)
  const path = (pts, w, a) => { for (const [ctx, col] of [[g, `rgba(112,110,106,${a * 0.6})`], [rg, `rgba(70,70,70,${a})`]]) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = ps(w); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.filter = `blur(${ps(w) * 0.35}px)`;
    ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x), pz(z)) : ctx.moveTo(px(x), pz(z)))); ctx.stroke(); ctx.restore(); } };
  path([[-3.2, -3.0], [2, -3.1], [7.4, -3.7], [7.2, -2.6], [5.4, -0.6], [3.2, 1.6], [-1.6, 5.2]], 1.1, 0.5);
  path([[5.2, -0.6], [-1, 1.5], [-6, 3.8]], 0.8, 0.35);
  // farinha junto à bancada de modelagem e à mesa (pó branco, mais áspero)
  const bx = BENCH.pos[0], bz = BENCH.pos[2];
  for (let i = 0; i < 40; i++) { const x = px(bx + (R() - 0.5) * (BENCH.w + 0.6)), y = pz(bz + 0.3 + (R() - 0.35) * 1.2); blob(g, x, y, 18 + R() * 30, '200,198,192', 0.04 + R() * 0.05); blob(rg, x, y, 18 + R() * 30, '190,190,190', 0.05 + R() * 0.06); }
  // calor/resíduos diante das portas dos fornos (tom levemente amarronzado, gordura polida)
  for (const o of OVENS) { const fz = ovenFrontZ(o); for (let i = 0; i < 18; i++) { const x = px(o.x + (R() - 0.5) * o.w * 0.9), y = pz(fz + 0.15 + R() * 0.8); blob(g, x, y, 6 + R() * 26, '118,108,94', 0.06 + R() * 0.08); blob(rg, x, y, 6 + R() * 22, '90,90,90', 0.1 + R() * 0.1); } }
  // umidade nos ralos (escuro e brilhante)
  for (const d of drains) { const x0 = px(d.x0), x1 = px(d.x1), y0 = pz(d.z0), y1 = pz(d.z1);
    for (let i = 0; i < 40; i++) { const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); blob(g, x, y, 4 + R() * 18, '92,90,88', 0.1 + R() * 0.12); blob(rg, x, y, 4 + R() * 18, '40,40,40', 0.18 + R() * 0.2); } }
  // encardido junto às paredes (onde o rodo não alcança)
  for (const [ctx, col] of [[g, '104,100,94'], [rg, '160,160,160']]) {
    const e = ps(0.35);
    for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [[0, 0, S, e, 0, 0, 0, e], [0, SZ - e, S, e, 0, SZ, 0, SZ - e], [0, 0, e, SZ, 0, 0, e, 0], [S - e, 0, e, SZ, S, 0, S - e, 0]]) {
      const gr = ctx.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gr; ctx.fillRect(x, y, w, h);
    }
  }
  // marcas finas de rodo/carrinho (arcos tênues)
  g.lineWidth = 1;
  for (let i = 0; i < 120; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '96,94,90' : '160,158,154'},${0.05 + R() * 0.07})`; const x = R() * S, y = R() * SZ, r = 10 + R() * 60; g.beginPath(); g.arc(x, y, r, R() * 6, R() * 6 + 0.6 + R()); g.stroke(); }
  void STATIONS; void TABLE;
  const map = tex(c, { srgb: false, rep: false }), rough = tex(rc, { rep: false });
  return { map, rough };
}

// ── forro em painel isotérmico (isopainel) branco: placas de 1 m com frisos ──
export function ceilingTextures() { // forro modulado 625×625: placa mineral microperfurada branca + perfil T de alumínio
  const S = 1024, P = S / 2, R = rng(55); const [c, g] = cnv(S), [rc, rg] = cnv(S); const H = new Float32Array(S * S);
  const n = vnoise(S, 40, rng(12)), f = vnoise(S, 2, rng(13));
  const id = g.createImageData(S, S), rid = rg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = (y * S + x) * 4, lx = x % P, ly = y % P, e = Math.min(lx, ly, P - 1 - lx, P - 1 - ly), tb = e < 6, bev = e < 9;
    const fis = f(x, y) > 0.83 ? -10 : 0;
    const v = tb ? 205 : (bev ? 214 : 226) + (n(x, y) - 0.5) * 8 + fis;
    id.data[k] = v; id.data[k + 1] = v; id.data[k + 2] = v - (tb ? 0 : 3); id.data[k + 3] = 255;
    rid.data[k] = rid.data[k + 1] = rid.data[k + 2] = tb ? 90 : 235; rid.data[k + 3] = 255;
    H[y * S + x] = tb ? 1.2 : bev ? -0.6 : fis * 0.02;
  }
  g.putImageData(id, 0, 0); rg.putImageData(rid, 0, 0); void R;
  return { map: tex(c, { srgb: true }), rough: tex(rc), normal: heightToNormal(H, S, 1.4), size: 1.25 };
}

// ── grelha de ralo linear inox (fendas transversais) ──
export function grateTexture() {
  const W = 512, Hh = 64; const [c, g] = cnv(W, Hh);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#000';
  for (let x = 6; x < W; x += 16) g.fillRect(x, 10, 7, Hh - 20);
  const t = tex(c, { srgb: false }); t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// ── placas de sinalização (canvas) ──
function runner(g, x, y, s, col) { // pictograma de pessoa correndo (ISO 7010 E001 simplificado)
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.arc(14, -38, 7, 0, 7); g.fill();
  g.lineWidth = 9; g.beginPath(); g.moveTo(8, -26); g.lineTo(-2, 2); g.stroke(); // tronco
  g.beginPath(); g.moveTo(-2, 2); g.lineTo(14, 14); g.lineTo(12, 36); g.stroke(); // perna da frente
  g.beginPath(); g.moveTo(-2, 2); g.lineTo(-14, 18); g.lineTo(-32, 20); g.stroke(); // perna de trás
  g.beginPath(); g.moveTo(-18, -14); g.lineTo(-4, -24); g.lineTo(8, -26); g.lineTo(18, -12); g.lineTo(30, -10); g.stroke(); // braços
  g.restore();
}
function arrow(g, x, y, s, dir, col) { g.save(); g.translate(x, y); g.scale(dir * s, s); g.fillStyle = col; g.beginPath();
  g.moveTo(-26, -8); g.lineTo(4, -8); g.lineTo(4, -22); g.lineTo(28, 0); g.lineTo(4, 22); g.lineTo(4, 8); g.lineTo(-26, 8); g.closePath(); g.fill(); g.restore(); }
export function signTexture(kind) {
  const [c, g] = cnv(512, 256); const grn = '#0a8a3e', wht = '#f4f6f2';
  if (kind === 'saida' || kind === 'rota_l' || kind === 'rota_r') {
    g.fillStyle = grn; g.fillRect(0, 0, 512, 256); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 244);
    if (kind === 'saida') {
      g.fillStyle = wht; g.fillRect(28, 40, 150, 176); g.fillStyle = grn; g.fillRect(48, 58, 110, 158); runner(g, 98, 140, 1.25, wht);
      g.fillStyle = wht; g.font = '800 92px Inter, Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('SAÍDA', 200, 132);
    } else { const d = kind === 'rota_l' ? -1 : 1; runner(g, 256 - d * 80, 140, 1.7, wht); arrow(g, 256 + d * 120, 128, 2.6, d, wht);
      g.fillStyle = wht; g.fillRect(256 - d * 160 - 6 - (d > 0 ? 0 : 0), 30, 0, 0); }
  } else if (kind === 'extintor') {
    g.fillStyle = '#c8181e'; g.fillRect(0, 0, 512, 256); g.fillStyle = wht;
    // extintor
    g.save(); g.translate(150, 128); g.beginPath(); g.roundRect(-26, -50, 52, 140, 18); g.fill(); g.fillRect(-8, -78, 22, 30);
    g.fillRect(4, -84, 46, 10); g.lineWidth = 8; g.strokeStyle = wht; g.beginPath(); g.moveTo(-6, -72); g.quadraticCurveTo(-60, -60, -48, 20); g.stroke(); g.restore();
    // chama
    g.beginPath(); g.moveTo(360, 210); g.bezierCurveTo(290, 190, 300, 120, 340, 70); g.bezierCurveTo(345, 110, 365, 115, 372, 92); g.bezierCurveTo(395, 120, 440, 160, 400, 210); g.closePath(); g.fill();
    g.fillStyle = '#c8181e'; g.beginPath(); g.moveTo(366, 205); g.bezierCurveTo(330, 190, 340, 160, 356, 140); g.bezierCurveTo(372, 170, 392, 175, 380, 205); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 244);
  } else if (kind === 'touca') { // obrigação (azul): uso obrigatório de touca
    g.fillStyle = '#f4f6f2'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#1f5fae'; g.beginPath(); g.arc(110, 128, 92, 0, 7); g.fill();
    g.fillStyle = wht; g.beginPath(); g.arc(110, 132, 34, 0, 7); g.fill(); g.beginPath(); g.ellipse(110, 104, 54, 30, 0, Math.PI, 0); g.fill(); g.fillRect(56, 100, 108, 10);
    g.fillStyle = '#1f5fae'; g.font = '800 40px Inter, Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('USO', 230, 70); g.fillText('OBRIGATÓRIO', 230, 120); g.fillText('DE TOUCA', 230, 170);
    g.strokeStyle = '#1f5fae'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 244);
  } else if (kind === 'eletrico') { // perigo eletricidade (amarelo)
    g.fillStyle = '#f2c214'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#111';
    g.beginPath(); g.moveTo(110, 30); g.lineTo(200, 220); g.lineTo(20, 220); g.closePath(); g.lineWidth = 12; g.strokeStyle = '#111'; g.stroke();
    g.beginPath(); g.moveTo(118, 80); g.lineTo(92, 150); g.lineTo(114, 150); g.lineTo(100, 200); g.lineTo(136, 128); g.lineTo(114, 128); g.lineTo(130, 80); g.closePath(); g.fill();
    g.font = '800 44px Inter, Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('PERIGO', 240, 100); g.font = '700 30px Inter, Arial, sans-serif'; g.fillText('ELETRICIDADE', 240, 150);
  } else if (kind === 'quente') { // cuidado superfície quente
    g.fillStyle = '#f2c214'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#111';
    g.beginPath(); g.moveTo(110, 30); g.lineTo(200, 220); g.lineTo(20, 220); g.closePath(); g.lineWidth = 12; g.strokeStyle = '#111'; g.stroke();
    g.lineWidth = 8; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(110 + i * 26, 190); g.bezierCurveTo(95 + i * 26, 160, 125 + i * 26, 140, 110 + i * 26, 108); g.stroke(); }
    g.font = '800 44px Inter, Arial, sans-serif'; g.textBaseline = 'middle'; g.fillText('CUIDADO', 240, 96); g.font = '700 28px Inter, Arial, sans-serif'; g.fillText('SUPERFÍCIE', 240, 142); g.fillText('QUENTE', 240, 178);
  }
  return tex(c, { srgb: true, rep: false });
}

// ── etiqueta de caixa de papelão / rótulo genérico ──
export function cardboardTexture() {
  const S = 256, R = rng(91); const [c, g] = cnv(S); g.fillStyle = '#b98a57'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,60,30' : '220,190,150'},${0.04 + R() * 0.05})`; g.fillRect(R() * S, R() * S, 1 + R() * 30, 1); }
  g.fillStyle = 'rgba(80,50,20,0.25)'; g.fillRect(0, S * 0.48, S, 6); // fita
  g.fillStyle = '#f2efe6'; g.fillRect(S * 0.12, S * 0.62, S * 0.36, S * 0.18); g.fillStyle = '#333'; for (let k = 0; k < 4; k++) g.fillRect(S * 0.15, S * 0.65 + k * 9, S * 0.28 * (0.5 + R() * 0.5), 3);
  return tex(c, { srgb: true, rep: false });
}

// ── inox escovado: rugosidade com riscos longos (eixo u) ──
export function brushedTexture() {
  const W = 512, Hh = 512, R = rng(101); const [c, g] = cnv(W, Hh);
  g.fillStyle = 'rgb(92,92,92)'; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 2600; i++) { const v = R() < 0.5 ? 60 : 130; g.fillStyle = `rgba(${v},${v},${v},${0.05 + R() * 0.12})`; g.fillRect(R() * W - 100, R() * Hh, 60 + R() * 400, 1); }
  return tex(c);
}

// ── vidro mini-boreal: gradiente vertical (céu mais claro em cima) + textura martelada ──
export function windowTexture() {
  const W = 256, Hh = 128, R = rng(131); const [c, g] = cnv(W, Hh);
  const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#9aa0a6'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '90,95,100'},${0.04 + R() * 0.06})`; g.beginPath(); g.arc(R() * W, R() * Hh, 1 + R() * 3, 0, 7); g.fill(); }
  const t = tex(c, { srgb: true, rep: false }); return t;
}
