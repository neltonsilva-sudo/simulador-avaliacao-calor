// Texturas procedurais da rua colonial (CENÁRIO): pé-de-moleque (Voronoi com juntas de terra e musgo + normal), lajes de
// quartzito do passeio, telha capa-canal, fachadas caiadas de sobrado (variações de cor/molduras/aberturas), galpão de pedra,
// céu com cirros, placas pintadas. Tudo ≤1024 px.
import * as THREE from 'three';

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; };
const tex = (c, srgb = true, rep = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
function normalFrom(H, W, Hh, k) {
  const [c, g] = cnv(W, Hh); const id = g.createImageData(W, Hh), d = id.data;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const l = H[y * W + (x - 1 + W) % W], r = H[y * W + (x + 1) % W], u = H[((y - 1 + Hh) % Hh) * W + x], b = H[((y + 1) % Hh) * W + x];
    let nx = (l - r) * k, ny = (b - u) * k; const n = Math.hypot(nx, ny, 1); const i = (y * W + x) * 4;
    d[i] = (nx / n * 0.5 + 0.5) * 255; d[i + 1] = (ny / n * 0.5 + 0.5) * 255; d[i + 2] = (1 / n * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0); return tex(c, false);
}

// ── pé-de-moleque: pedras irregulares (Voronoi periódico 14×14 por 3 m), abauladas, juntas de terra/musgo, remendos ──
export function cobbleTextures() {
  const S = 1024, N = 11, R = rng(7), cell = S / N;
  const pts = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + 0.05 + R() * 0.9) * cell, (j + 0.05 + R() * 0.9) * cell, R(), R(), R()]);
  const [c, g] = cnv(S), [rc, rg] = cnv(S); const id = g.createImageData(S, S), rid = rg.createImageData(S, S); const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const ci = Math.floor(x / cell), cj = Math.floor(y / cell); let d1 = 1e9, d2 = 1e9, best = null;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + N) % N, jj = (cj + dj + N) % N, p = pts[jj * N + ii];
      const px = p[0] + (ci + di - ii) * cell, py = p[1] + (cj + dj - jj) * cell; const dd = Math.hypot(x - px, y - py);
      if (dd < d1) { d2 = d1; d1 = dd; best = p; } else if (dd < d2) d2 = dd;
    }
    const e = (d2 - d1) * 0.5, k = (y * S + x) * 4; let col, h, ro;
    const jw = 4.5 + best[4] * 4; // juntas largas e irregulares (pedras assentadas à mão)
    if (e < jw) { // junta: terra escura com musgo
      const m = R(); h = -1.2; col = m < 0.4 ? [52, 60, 36] : [64, 55, 44]; ro = 245;
    } else {
      const dome = Math.min(1, (e - jw) / 22); h = Math.sqrt(dome) * 1.4 + (R() - 0.5) * 0.08;
      const t = best[2], v = 70 + t * 42 - (1 - dome) * 30; // pedra cinza-escura (quartzito), algumas ferruginosas/ocres, poucas azuladas
      col = best[3] < 0.3 ? [v + 20, v + 10, v - 2] : best[3] < 0.75 ? [v + 3, v + 1, v - 3] : [v - 4, v, v + 5];
      const wear = Math.pow(dome, 4) * 14; col = col.map((q) => q + wear); ro = 150 - dome * 70 + best[4] * 30; // topo gasto, mais liso
    }
    H[y * S + x] = h; id.data[k] = col[0]; id.data[k + 1] = col[1]; id.data[k + 2] = col[2]; id.data[k + 3] = 255;
    rid.data[k] = rid.data[k + 1] = rid.data[k + 2] = ro; rid.data[k + 3] = 255;
  }
  g.putImageData(id, 0, 0); rg.putImageData(rid, 0, 0);
  // remendos de cimento e manchas de umidade
  for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(150,146,138,0.55)'; g.beginPath(); g.ellipse(R() * S, R() * S, 30 + R() * 50, 18 + R() * 30, R() * 3, 0, 7); g.fill(); }
  return { map: tex(c), rough: tex(rc, false), normal: normalFrom(H, S, S, 2.2), size: 3.0 };
}

// ── lajes de quartzito do passeio (retângulos irregulares, gastos) ──
export function slabTextures() {
  const W = 512, Hh = 1024, R = rng(19); const [c, g] = cnv(W, Hh); const H = new Float32Array(W * Hh);
  g.fillStyle = '#6d665c'; g.fillRect(0, 0, W, Hh);
  let y = 0; while (y < Hh) { const h = 110 + R() * 110; let x = 0; while (x < W) { const w = Math.min(W - x, 140 + R() * 220);
      const v = 150 + R() * 40, tint = R(); g.fillStyle = `rgb(${v + 8 + tint * 10},${v + 2},${v - 10 - tint * 8})`; g.fillRect(x + 3, y + 3, w - 6, h - 6);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,80,70' : '230,224,210'},${0.05 + R() * 0.1})`; g.fillRect(x + R() * w, y + R() * h, 2 + R() * 18, 1 + R() * 3); }
      for (let yy = Math.floor(y + 3); yy < Math.min(Hh, y + h - 3); yy++) for (let xx = Math.floor(x + 3); xx < Math.min(W, x + w - 3); xx++) H[yy * W + xx] = 1;
      x += w; } y += h; }
  return { map: tex(c), normal: normalFrom(H, W, Hh, 0.8), size: [1.2, 2.4] };
}

// ── telha capa-canal (fiadas de telhas curvas, tons de barro variados, limo) ──
export function tileRoofTexture() {
  const W = 512, Hh = 512, R = rng(31); const [c, g] = cnv(W, Hh); const n = 16, rows = 12;
  g.fillStyle = '#5a3424'; g.fillRect(0, 0, W, Hh);
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
    const x = i * (W / n), y = r * (Hh / rows), w = W / n, h = Hh / rows + 6; const v = R();
    const gr = g.createLinearGradient(x, 0, x + w, 0); const base = [150 + v * 40, 78 + v * 30, 50 + v * 18];
    gr.addColorStop(0, `rgb(${base[0] * 0.55},${base[1] * 0.55},${base[2] * 0.55})`); gr.addColorStop(0.5, `rgb(${base[0]},${base[1]},${base[2]})`); gr.addColorStop(1, `rgb(${base[0] * 0.5},${base[1] * 0.5},${base[2] * 0.5})`);
    g.fillStyle = gr; g.beginPath(); g.roundRect(x + 1, y, w - 2, h, 6); g.fill();
    if (R() < 0.25) { g.fillStyle = `rgba(40,45,30,${0.2 + R() * 0.3})`; g.fillRect(x + 2, y + h * 0.5, w - 4, h * 0.5); } // limo
  }
  return tex(c);
}

// ── fachadas de sobrado (canvas 512×640 = 6,4 m × 8 m) ──
const WALLS = ['#f1ece1', '#ece2c8', '#e9d6a2', '#f3efe6', '#dcc9a0', '#efe7d6'];
const FRAMES = ['#7a1f1f', '#1f3f7a', '#24513a', '#b27a17', '#6a2132', '#2f4f6f'];
export function facadeTexture(variant, opts = {}) {
  const W = 512, Hh = 640, R = rng(100 + variant * 13); const [c, g] = cnv(W, Hh); const px = W / 6.4, py = Hh / 8.0;
  const wall = opts.wall || WALLS[variant % WALLS.length], fr = opts.frame || FRAMES[variant % FRAMES.length];
  g.fillStyle = wall; g.fillRect(0, 0, W, Hh);
  // caiação irregular, manchas de umidade, escorridos sob o beiral
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,110,90' : '255,255,250'},${0.02 + R() * 0.05})`; g.beginPath(); g.arc(R() * W, R() * Hh, 2 + R() * 14, 0, 7); g.fill(); }
  const damp = g.createLinearGradient(0, Hh, 0, Hh - 1.4 * py); damp.addColorStop(0, 'rgba(70,60,45,0.45)'); damp.addColorStop(1, 'rgba(70,60,45,0)'); g.fillStyle = damp; g.fillRect(0, Hh - 1.4 * py, W, 1.4 * py);
  for (let i = 0; i < 10; i++) { const x = R() * W, w = 4 + R() * 16; const s = g.createLinearGradient(0, 0, 0, Hh * 0.5); s.addColorStop(0, 'rgba(60,55,45,0.22)'); s.addColorStop(1, 'rgba(60,55,45,0)'); g.fillStyle = s; g.fillRect(x, 0, w, Hh * (0.2 + R() * 0.35)); }
  // barrado e cunhais
  g.fillStyle = opts.barrado || fr; g.globalAlpha = 0.85; g.fillRect(0, Hh - 0.55 * py, W, 0.55 * py); g.globalAlpha = 1;
  g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, 0.28 * px, Hh); g.fillRect(W - 0.28 * px, 0, 0.28 * px, Hh);
  g.fillRect(0, Hh - 3.75 * py, W, 0.14 * py); // friso entre pavimentos
  const bays = opts.bays ?? (variant % 3 === 0 ? 3 : 2), bw = (6.4 - 0.56) / Math.max(1, bays);
  for (let b = 0; b < bays; b++) {
    const cx = (0.28 + bw * (b + 0.5)) * px;
    // porta térrea: tábuas, ombreira larga colorida, verga em arco abatido
    const dw = 1.15 * px, dh = 2.55 * py, dy = Hh - 0.12 * py - dh;
    g.fillStyle = fr; g.beginPath(); g.moveTo(cx - dw / 2 - 12, Hh - 0.1 * py); g.lineTo(cx - dw / 2 - 12, dy + 18); g.quadraticCurveTo(cx, dy - 26, cx + dw / 2 + 12, dy + 18); g.lineTo(cx + dw / 2 + 12, Hh - 0.1 * py); g.fill();
    g.fillStyle = (b + variant) % 2 ? '#4a3626' : fr; g.beginPath(); g.moveTo(cx - dw / 2, Hh - 0.1 * py); g.lineTo(cx - dw / 2, dy + 20); g.quadraticCurveTo(cx, dy - 6, cx + dw / 2, dy + 20); g.lineTo(cx + dw / 2, Hh - 0.1 * py); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 1; k < 6; k++) g.fillRect(cx - dw / 2 + k * dw / 6, dy + 10, 2, dh - 12); g.fillRect(cx - 1, dy, 3, dh); // tábuas + junta das folhas
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx - dw / 2 + 4, dy + 26, dw - 8, 4);
    g.fillStyle = '#c9a24a'; g.fillRect(cx + 6, dy + dh * 0.55, 5, 12); g.fillRect(cx - 11, dy + dh * 0.55, 5, 12); // ferragens
    // janela do sobrado: moldura, guilhotina de caixilhos brancos, bandeira; vidro escuro com reflexo do céu
    const ww = 1.05 * px, wh = 1.85 * py, wy = Hh - 3.6 * py - wh + 1.35 * py - 0.15 * py;
    g.fillStyle = fr; g.fillRect(cx - ww / 2 - 13, wy - 13, ww + 26, wh + 22);
    const gl = g.createLinearGradient(0, wy, 0, wy + wh); gl.addColorStop(0, '#7f9cbc'); gl.addColorStop(0.5, '#2b3640'); gl.addColorStop(1, '#1a2026'); g.fillStyle = gl; g.fillRect(cx - ww / 2, wy, ww, wh);
    g.strokeStyle = '#f4f2ec'; g.lineWidth = 4; g.strokeRect(cx - ww / 2, wy, ww, wh); g.lineWidth = 3;
    for (const f of [0.22, 0.6]) { g.beginPath(); g.moveTo(cx - ww / 2, wy + wh * f); g.lineTo(cx + ww / 2, wy + wh * f); g.stroke(); }
    for (const f of [1 / 3, 2 / 3]) { g.beginPath(); g.moveTo(cx - ww / 2 + ww * f, wy + wh * 0.22); g.lineTo(cx - ww / 2 + ww * f, wy + wh); g.stroke(); }
    for (const f of [0.41, 0.8]) { g.beginPath(); g.moveTo(cx - ww / 2, wy + wh * f); g.lineTo(cx + ww / 2, wy + wh * f); g.stroke(); }
  }
  if (opts.label) { // letreiro pintado sobre as portas (sem marca real)
    g.fillStyle = '#f6f3ea'; g.fillRect(0.8 * px, Hh - 3.55 * py, W - 1.6 * px, 0.42 * py); g.fillStyle = '#5b2414';
    g.font = `700 ${Math.round(0.3 * py)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opts.label, W / 2, Hh - 3.34 * py);
  }
  return tex(c, true, false);
}

// ── galpão antigo de pedra e cal (fachada da casa de caldeiras, 20 m × 11 m) ──
export function galpaoTexture() {
  const W = 1024, Hh = 576, R = rng(77); const [c, g] = cnv(W, Hh); const px = W / 20, py = Hh / 11.25;
  g.fillStyle = '#ece5d4'; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '110,100,80' : '255,255,248'},${0.02 + R() * 0.05})`; g.beginPath(); g.arc(R() * W, R() * Hh, 3 + R() * 16, 0, 7); g.fill(); }
  // embasamento de cantaria (blocos de pedra)
  const base = 1.5 * py; let y = Hh - base;
  for (let r = 0; r < 3; r++) { let x = (r % 2) * 20; while (x < W) { const w = 40 + R() * 50, v = 120 + R() * 40; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(x + 2, y + 2, w - 4, base / 3 - 4); x += w; } y += base / 3; }
  // cunhais e pilastras de pedra
  for (const x of [0, 6.5, 13.5, 19.4]) { g.fillStyle = '#b7aa8f'; g.fillRect(x * px, 0, 0.6 * px, Hh - base); for (let yy = 0; yy < Hh - base; yy += 22) { g.fillStyle = 'rgba(70,60,45,0.35)'; g.fillRect(x * px, yy, 0.6 * px, 2); } }
  // portão central em arco pleno (tábuas verde-escuras) e janelas altas em arco
  const arch = (cx, w, y0, y1, fill, frame) => { g.fillStyle = frame; g.beginPath(); g.moveTo(cx - w / 2 - 14, y1); g.lineTo(cx - w / 2 - 14, y0 + w / 2); g.arc(cx, y0 + w / 2, w / 2 + 14, Math.PI, 0); g.lineTo(cx + w / 2 + 14, y1); g.fill();
    g.fillStyle = fill; g.beginPath(); g.moveTo(cx - w / 2, y1); g.lineTo(cx - w / 2, y0 + w / 2); g.arc(cx, y0 + w / 2, w / 2, Math.PI, 0); g.lineTo(cx + w / 2, y1); g.fill(); };
  arch(10 * px, 4.2 * px, Hh - 6.0 * py, Hh - 0.05 * py, '#27402f', '#b7aa8f');
  g.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = -9; k <= 9; k++) g.fillRect(10 * px + k * 0.22 * px, Hh - 5.2 * py, 2, 5.1 * py); g.fillRect(10 * px - 2, Hh - 6 * py, 4, 6 * py);
  for (const x of [2.2, 4.4, 15.6, 17.8]) { arch(x * px, 1.4 * px, Hh - 8.6 * py, Hh - 4.6 * py, '#26303a', '#b7aa8f'); g.strokeStyle = '#efece4'; g.lineWidth = 3; g.beginPath(); g.moveTo(x * px, Hh - 8.0 * py); g.lineTo(x * px, Hh - 4.6 * py); g.stroke(); for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo((x - 0.7) * px, Hh - (4.6 + k * 0.9) * py); g.lineTo((x + 0.7) * px, Hh - (4.6 + k * 0.9) * py); g.stroke(); } }
  g.fillStyle = '#f5f1e7'; g.fillRect(0, 0, W, 0.35 * py); // cimalha
  g.fillStyle = '#2e2a26'; g.font = `700 ${Math.round(0.45 * py)}px Georgia, serif`; g.textAlign = 'center'; g.fillText('CASA DE CALDEIRAS', 10 * px, Hh - 6.7 * py);
  return tex(c, true, false);
}

// ── placa pendurada (tábua pintada) ──
export function hangingSignTexture(text, sub) {
  const [c, g] = cnv(512, 256); g.fillStyle = '#5b2414'; g.fillRect(0, 0, 512, 256); g.strokeStyle = '#d9b45a'; g.lineWidth = 10; g.strokeRect(10, 10, 492, 236);
  g.fillStyle = '#f3e6c4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 70px Georgia, serif'; g.fillText(text, 256, 110); g.font = 'italic 600 40px Georgia, serif'; g.fillText(sub, 256, 185);
  return tex(c, true, false);
}

// ── céu: gradiente azul profundo + cirros ──
export function skyTexture() {
  const W = 1024, Hh = 512, R = rng(5); const [c, g] = cnv(W, Hh);
  const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#1e5bb0'); gr.addColorStop(0.38, '#4f8fd6'); gr.addColorStop(0.49, '#b7d2ea'); gr.addColorStop(0.5, '#cfdbe2'); gr.addColorStop(1, '#8c8f84');
  g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 70; i++) { const x = R() * W, y = 40 + R() * Hh * 0.36, l = 60 + R() * 240; g.strokeStyle = `rgba(255,255,255,${0.06 + R() * 0.16})`; g.lineWidth = 2 + R() * 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + l * 0.3, y - 8 - R() * 10, x + l * 0.7, y + 6, x + l, y - 4); g.stroke(); }
  const t = tex(c, true, false); t.wrapS = THREE.RepeatWrapping; return t;
}
