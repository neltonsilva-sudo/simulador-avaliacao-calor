// PAINEL DA CALDEIRA — texturas procedurais: pintura epóxi texturizada (casca de laranja), sujeira da porta/gabinete,
// atlas de plaquetas gravadas (lamicoide preto com letra branca), etiqueta NR-10, plaqueta de dados, legenda da chave
// MAN-0-AUT, disco amarelo da emergência e a IHM de 10" (3 telas tocáveis).
import * as THREE from 'three';

const cnv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function noise2(N, cells, seed) { // value noise tileável N×N
  const r = rng(seed), g = new Float32Array(cells * cells).map(() => r()), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / N * cells, fy = y / N * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), G = (i, j) => g[((j % cells) * cells) + (i % cells)];
    out[y * N + x] = (G(x0, y0) * (1 - sx) + G(x0 + 1, y0) * sx) * (1 - sy) + (G(x0, y0 + 1) * (1 - sx) + G(x0 + 1, y0 + 1) * sx) * sy;
  }
  return out;
}
const tex = (c, srgb = true, rep = false) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };

// pintura epóxi a pó texturizada: normal map tileável (casca de laranja fina) + rugosidade
let _paint = null;
export function paintMaps() {
  if (_paint) return _paint;
  const N = 256, a = noise2(N, 64, 11), b = noise2(N, 21, 17), h = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) h[i] = a[i] * 0.7 + b[i] * 0.3;
  const [c, x] = cnv(N), img = x.createImageData(N, N), [c2, x2] = cnv(N), img2 = x2.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
    const i = y * N + xx, dx = h[y * N + ((xx + 1) % N)] - h[y * N + ((xx + N - 1) % N)], dy = h[((y + 1) % N) * N + xx] - h[((y + N - 1) % N) * N + xx];
    const nx = -dx * 6, ny = -dy * 6, l = Math.hypot(nx, ny, 1);
    img.data[i * 4] = (nx / l * 0.5 + 0.5) * 255; img.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i * 4 + 3] = 255;
    const r = 150 + (b[i] - 0.5) * 60 + (a[i] - 0.5) * 30; img2.data[i * 4] = img2.data[i * 4 + 1] = img2.data[i * 4 + 2] = r; img2.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0); x2.putImageData(img2, 0, 0);
  const normal = tex(c, false, true), rough = tex(c2, false, true); normal.repeat.set(3, 3); rough.repeat.set(3, 3);
  return (_paint = { normal, rough });
}

// mapa de cor (multiplica a cor RAL 7035): sujeira na base, poeira no topo, marcas de mão perto do fecho e dos botões
export function grimeMap(seed, { w = 512, h = 640, door = false } = {}) {
  const [c, x] = cnv(w, h), r = rng(seed); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  const n = noise2(128, 9, seed), n2 = noise2(128, 31, seed + 5), img = x.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4, v = y / h, nn = n[((y * 128 / h) | 0) * 128 + ((xx * 128 / w) | 0)], m = n2[((y * 128 / h) | 0) * 128 + ((xx * 128 / w) | 0)];
    let k = 1 - 0.035 * (nn - 0.5) - 0.025 * (m - 0.5);
    k -= 0.2 * Math.pow(Math.max(0, v - 0.72) / 0.28, 1.6) * (0.6 + nn * 0.8); // respingos/poeira na base
    k -= 0.05 * Math.pow(Math.max(0, 0.06 - v) / 0.06, 2);
    img.data[i] *= k; img.data[i + 1] *= k * 0.995; img.data[i + 2] *= k * 0.98;
  }
  x.putImageData(img, 0, 0);
  x.globalCompositeOperation = 'multiply';
  const smudge = (cx, cy, rr, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, `rgba(120,112,100,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rr, rr * (0.6 + r() * 0.5), r() * 3, 0, 7); x.fill(); };
  if (door) {
    for (let i = 0; i < 9; i++) smudge(w * (0.9 + r() * 0.08), h * (0.44 + r() * 0.14), 10 + r() * 16, 0.22); // fecho
    for (let i = 0; i < 14; i++) smudge(w * (0.22 + r() * 0.56), h * (0.55 + r() * 0.25), 6 + r() * 10, 0.16); // botoeira
    for (let i = 0; i < 5; i++) smudge(w * (0.35 + r() * 0.3), h * (0.2 + r() * 0.1), 8 + r() * 12, 0.08); // IHM
  }
  // riscos finos claros (pintura raspada) e escorridos
  x.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 18; i++) { const sx = r() * w, sy = h * (0.5 + r() * 0.5), L = 6 + r() * 30, a = r() * Math.PI; x.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.2})`; x.lineWidth = 0.6 + r() * 0.6; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * L, sy + Math.sin(a) * L); x.stroke(); }
  x.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 5; i++) { const sx = r() * w, sy = h * (0.15 + r() * 0.5), L = 30 + r() * 120; const g = x.createLinearGradient(0, sy, 0, sy + L); g.addColorStop(0, 'rgba(150,140,125,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(sx, sy, 1.5 + r() * 2, L); }
  x.globalCompositeOperation = 'source-over';
  return tex(c);
}

// ───────────── atlas de plaquetas ─────────────
// itens: {key, w, h (m), draw(x, W, H), round?} → {texture, rect(key) → [u0, v0, u1, v1]}
export function plaqueAtlas(items, S = 1024, ppm = 2600) {
  const [c, x] = cnv(S); x.fillStyle = '#222'; x.fillRect(0, 0, S, S);
  const rects = {}; let px = 6, py = 6, rowH = 0;
  for (const it of items) {
    const W = Math.round(it.w * ppm), H = Math.round(it.h * ppm);
    if (px + W > S - 6) { px = 6; py += rowH + 8; rowH = 0; }
    x.save(); x.translate(px, py); it.draw(x, W, H); x.restore();
    rects[it.key] = [px / S, 1 - (py + H) / S, (px + W) / S, 1 - py / S];
    px += W + 8; rowH = Math.max(rowH, H);
  }
  const t = tex(c); t.anisotropy = 16; return { texture: t, rects };
}
const font = (wt, px) => `${wt} ${px}px "Arial Narrow", Arial, Helvetica, sans-serif`;
// lamicoide preto gravado: letra branca com leve sombra interna; bordas chanfradas claras; 2 furos de rebite
export function engraved(lines, { bg = '#141516', fg = '#f4f4f0', rivets = true, size = 0.5 } = {}) {
  return (x, W, H) => {
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2b2d'); g.addColorStop(0.5, bg); g.addColorStop(1, '#0b0b0c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,0.28)'; x.lineWidth = Math.max(2, H * 0.04); x.strokeRect(x.lineWidth / 2, x.lineWidth / 2, W - x.lineWidth, H - x.lineWidth);
    const n = lines.length, fs = Math.min(H * size / Math.max(1, n * 0.85), H * 0.62);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      const y = H / 2 + (i - (n - 1) / 2) * fs * 1.12; let f = fs; x.font = font(700, f);
      while (x.measureText(ln).width > W * (rivets ? 0.8 : 0.9) && f > 6) { f -= 1; x.font = font(700, f); }
      x.fillStyle = 'rgba(0,0,0,0.9)'; x.fillText(ln, W / 2 + 1, y + 1.5); x.fillStyle = fg; x.fillText(ln, W / 2, y);
    });
    if (rivets) for (const rx of [H * 0.32, W - H * 0.32]) { const rr = Math.min(H * 0.12, 7); const rg = x.createRadialGradient(rx - rr * 0.3, H / 2 - rr * 0.3, 1, rx, H / 2, rr); rg.addColorStop(0, '#f2f2f2'); rg.addColorStop(1, '#6b6e72'); x.fillStyle = rg; x.beginPath(); x.arc(rx, H / 2, rr, 0, 7); x.fill(); }
  };
}
export function nr10Sticker(x, W, H) {
  x.fillStyle = '#f7f6f0'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#c4161c'; x.fillRect(W * 0.04, H * 0.03, W * 0.92, H * 0.17);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font(800, H * 0.12); x.fillText('PERIGO', W / 2, H * 0.115);
  // triângulo amarelo com raio
  const cx = W / 2, ty = H * 0.25, th = H * 0.36, tw = th * 1.15;
  x.fillStyle = '#111'; x.beginPath(); x.moveTo(cx, ty); x.lineTo(cx + tw / 2, ty + th); x.lineTo(cx - tw / 2, ty + th); x.closePath(); x.fill();
  x.fillStyle = '#f6c400'; x.beginPath(); x.moveTo(cx, ty + th * 0.14); x.lineTo(cx + tw * 0.39, ty + th * 0.92); x.lineTo(cx - tw * 0.39, ty + th * 0.92); x.closePath(); x.fill();
  const s = th * 0.5, by = ty + th * 0.3; x.fillStyle = '#111'; x.beginPath();
  x.moveTo(cx + s * 0.12, by); x.lineTo(cx - s * 0.22, by + s * 0.62); x.lineTo(cx + s * 0.02, by + s * 0.6); x.lineTo(cx - s * 0.14, by + s * 1.08); x.lineTo(cx + s * 0.26, by + s * 0.42); x.lineTo(cx + s * 0.02, by + s * 0.44); x.closePath(); x.fill();
  x.fillStyle = '#111'; const L = ['RISCO DE', 'CHOQUE ELÉTRICO', '380 V'];
  L.forEach((t, i) => { x.font = font(800, H * (i === 2 ? 0.075 : 0.068)); x.fillText(t, W / 2, H * (0.7 + i * 0.075)); });
  x.font = font(700, H * 0.045); x.fillStyle = '#333'; x.fillText('NR-10 · SOMENTE PESSOAL', W / 2, H * 0.92); x.fillText('AUTORIZADO', W / 2, H * 0.965);
  x.strokeStyle = '#111'; x.lineWidth = W * 0.012; x.strokeRect(W * 0.02, H * 0.012, W * 0.96, H * 0.976);
}
export function dataPlate(num) {
  return (x, W, H) => {
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#d9dcdf'); g.addColorStop(0.5, '#b9bdc1'); g.addColorStop(1, '#cfd2d5'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < H; i += 2) { x.fillStyle = `rgba(255,255,255,${0.04 + (i % 6 === 0 ? 0.04 : 0)})`; x.fillRect(0, i, W, 1); }
    x.fillStyle = '#1b1c1e'; x.textAlign = 'left'; x.textBaseline = 'middle';
    const rows = [['QUADRO', `QC-CAL-0${num}`], ['TENSÃO', '380 V 3F+N+PE 60 Hz'], ['COMANDO', '24 Vcc'], ['Icc', '10 kA'], ['GRAU PROT.', 'IP54'], ['ANO', '2016']];
    x.font = font(800, H * 0.13); x.fillText('DADOS DO QUADRO', W * 0.06, H * 0.11);
    rows.forEach(([a, b], i) => { x.font = font(700, H * 0.1); x.fillStyle = '#3a3c40'; x.fillText(a, W * 0.06, H * (0.26 + i * 0.125)); x.fillStyle = '#111'; x.font = font(800, H * 0.1); x.fillText(b, W * 0.4, H * (0.26 + i * 0.125)); });
    x.strokeStyle = '#7d8185'; x.lineWidth = 2; x.strokeRect(1, 1, W - 2, H - 2);
  };
}
export function selectorLegend(x, W, H) {
  x.fillStyle = '#151617'; x.fillRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, H - 3);
  const cx = W / 2, cy = H * 0.6, R = W * 0.37; x.fillStyle = '#f4f4f0'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [['MAN', -45], ['0', 0], ['AUT', 45]].forEach(([t, a]) => {
    const r = (a - 90) * Math.PI / 180; x.font = font(800, W * (t === '0' ? 0.17 : 0.14));
    x.fillText(t, cx + Math.cos(r) * R, cy + Math.sin(r) * R * 0.95);
    x.strokeStyle = '#f4f4f0'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx + Math.cos(r) * R * 0.6, cy + Math.sin(r) * R * 0.6); x.lineTo(cx + Math.cos(r) * R * 0.72, cy + Math.sin(r) * R * 0.72); x.stroke();
  });
}
export function estopDisk(x, W, H) {
  x.fillStyle = '#222'; x.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, R = W / 2; x.fillStyle = '#f2c200'; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R - 2, 0, 7); x.stroke();
  x.fillStyle = '#111'; x.font = font(800, R * 0.2); x.textAlign = 'center'; x.textBaseline = 'middle';
  const txt = 'PARADA DE EMERGÊNCIA'; const ang = Math.PI * 1.05; [...txt].forEach((ch, i) => { const a = -Math.PI / 2 - ang / 2 + ang * (i + 0.5) / txt.length; x.save(); x.translate(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8); x.rotate(a + Math.PI / 2); x.fillText(ch, 0, 0); x.restore(); });
}
// LED: mancha radial para o emissivo das lentes (tampa do cilindro tem UV radial)
let _led = null;
export function ledMap() {
  if (_led) return _led; const [c, x] = cnv(64), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#e8e8e8'); g.addColorStop(0.8, '#9a9a9a'); g.addColorStop(1, '#555'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  for (let r = 6; r < 32; r += 5) { x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1.5; x.beginPath(); x.arc(32, 32, r, 0, 7); x.stroke(); } // anéis de Fresnel
  return (_led = tex(c));
}
// reflexo no vidro da IHM (faixa diagonal suave; aditivo)
let _gl = null;
export function glassStreak() {
  if (_gl) return _gl; const [c, x] = cnv(256, 160); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 160);
  const g = x.createLinearGradient(40, 0, 200, 160); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.38, 'rgba(255,255,255,0.0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(0.52, 'rgba(255,255,255,0.15)'); g.addColorStop(0.6, 'rgba(255,255,255,0.3)'); g.addColorStop(0.66, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 160); const v = x.createLinearGradient(0, 0, 0, 160); v.addColorStop(0, 'rgba(255,255,255,0.18)'); v.addColorStop(0.4, 'rgba(0,0,0,0)'); x.fillStyle = v; x.fillRect(0, 0, 256, 160);
  return (_gl = tex(c));
}

// ───────────── IHM 10" (1024×640) ─────────────
const C = { bg: '#2c3035', panel: '#373c42', line: '#4d545c', txt: '#e9edf1', dim: '#9aa5b1', ok: '#3ccf6e', warn: '#ffb020', bad: '#ff4a3d', blue: '#4a90d9', water: '#3a83c9', flame: '#ff8a1c' };
function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
export function drawHMI(x, W, H, P, regions, clockStr, test) {
  const s = P.s, blink = Math.floor(s.t * 2) % 2 === 0; regions.length = 0;
  const btn = (X, Y, w, h, label, act, { on = false, dis = false, col = C.blue } = {}) => {
    rr(x, X, Y, w, h, 8); x.fillStyle = dis ? '#30353a' : on ? col : '#454c54'; x.fill(); x.strokeStyle = dis ? '#3c4248' : '#66707a'; x.lineWidth = 2; x.stroke();
    x.fillStyle = dis ? '#5d656d' : '#fff'; x.font = `700 ${Math.min(26, h * 0.42)}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, X + w / 2, Y + h / 2 + 1);
    if (!dis) regions.push({ x: X, y: Y, w, h, a: act });
  };
  x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
  // cabeçalho
  x.fillStyle = '#1b1e22'; x.fillRect(0, 0, W, 58);
  x.fillStyle = C.txt; x.textAlign = 'left'; x.textBaseline = 'middle'; x.font = '800 27px Arial'; x.fillText(`CALDEIRA ${s.num}`, 18, 30);
  x.fillStyle = C.dim; x.font = '600 18px Arial'; x.fillText({ geral: 'VISÃO GERAL', queimador: 'QUEIMADOR', alarmes: 'ALARMES' }[s.page], 178, 31);
  x.textAlign = 'right'; x.fillStyle = C.txt; x.font = '600 20px Arial'; x.fillText(clockStr, W - 18, 30);
  const chip = (X, t, col) => { x.font = '800 18px Arial'; const w = x.measureText(t).width + 22; rr(x, X - w, 14, w, 32, 6); x.fillStyle = col; x.fill(); x.fillStyle = '#111'; x.textAlign = 'center'; x.fillText(t, X - w / 2, 31); return X - w - 10; };
  let cx = W - 120; cx = chip(cx, s.mode === '0' ? 'MODO 0' : s.mode, s.mode === 'AUT' ? '#7fb8ff' : s.mode === 'MAN' ? '#ffd166' : '#b0b6bd');
  chip(cx, s.flame ? 'CHAMA' : 'SEM CHAMA', s.flame ? C.flame : '#7b838c');
  const ft = 'rgba(0,0,0,0)';
  // rodapé: abas
  const tabs = [['geral', 'VISÃO GERAL'], ['queimador', 'QUEIMADOR'], ['alarmes', 'ALARMES']], tw = W / 3, unack = s.alarms.filter((a) => !a.ack).length, act = s.alarms.filter((a) => a.active).length;
  tabs.forEach(([k, l], i) => {
    const X = i * tw, Y = H - 66, sel = s.page === k; x.fillStyle = sel ? '#454c55' : '#23272b'; x.fillRect(X + 2, Y, tw - 4, 66);
    if (sel) { x.fillStyle = C.blue; x.fillRect(X + 2, Y, tw - 4, 5); }
    if (k === 'alarmes' && unack && blink) { x.fillStyle = '#9b1c16'; x.fillRect(X + 2, Y, tw - 4, 66); }
    x.fillStyle = '#fff'; x.font = '800 23px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(l + (k === 'alarmes' && act ? ` (${act})` : ''), X + tw / 2, Y + 35);
    regions.push({ x: X, y: Y, w: tw, h: 66, a: 'tab:' + k });
  });
  // faixa de estado/mensagem
  const msg = s.msg || P.seqText, mcol = s.msg ? C.warn : s.seq === 'LOCK' ? C.bad : C.dim;
  x.fillStyle = '#212529'; x.fillRect(0, H - 108, W, 40); x.fillStyle = mcol; x.font = '700 21px Arial'; x.textAlign = 'left'; x.fillText(msg, 18, H - 87);
  const Y0 = 70, Y1 = H - 118;
  if (s.page === 'geral') {
    // sinótico
    rr(x, 14, Y0, 470, Y1 - Y0, 10); x.fillStyle = C.panel; x.fill();
    const bx = 70, by = 170, bw = 360, bh = 170;
    x.strokeStyle = '#7d8a96'; x.lineWidth = 4; x.fillStyle = '#26292d'; rr(x, bx, by, bw, bh, bh / 2); x.fill();
    x.save(); rr(x, bx, by, bw, bh, bh / 2); x.clip(); const wl = by + bh * (1 - s.lvl); const wav = (X) => wl + Math.sin(X * 0.05 + s.t * 2) * 2.2;
    x.fillStyle = C.water; x.beginPath(); x.moveTo(bx, by + bh); for (let X = bx; X <= bx + bw; X += 8) x.lineTo(X, wav(X)); x.lineTo(bx + bw, by + bh); x.fill();
    // tubo-fornalha + chama
    rr(x, bx + 20, by + bh * 0.52, bw - 70, 46, 23); x.fillStyle = '#1a1c1f'; x.fill(); x.strokeStyle = '#93a0ab'; x.lineWidth = 2; x.stroke();
    if (s.flame) { const L = 80 + 170 * s.load + Math.sin(s.t * 9) * 8; const g = x.createLinearGradient(bx + 24, 0, bx + 24 + L, 0); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.3, '#ff9a1f'); g.addColorStop(1, 'rgba(255,60,0,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(bx + 24, by + bh * 0.52 + 23); x.quadraticCurveTo(bx + 24 + L * 0.5, by + bh * 0.52 + 2, bx + 24 + L, by + bh * 0.52 + 23); x.quadraticCurveTo(bx + 24 + L * 0.5, by + bh * 0.52 + 44, bx + 24, by + bh * 0.52 + 23); x.fill(); }
    x.restore(); x.strokeStyle = '#9aa7b3'; x.lineWidth = 4; rr(x, bx, by, bw, bh, bh / 2); x.stroke();
    // queimador
    x.fillStyle = s.flame ? '#c46a10' : '#59616a'; x.fillRect(bx - 48, by + bh * 0.52 + 6, 50, 34); x.fillStyle = C.txt; x.font = '700 15px Arial'; x.textAlign = 'center'; x.fillText('QUEIM.', bx - 23, by + bh * 0.52 + 58);
    // chaminé + vapor
    x.fillStyle = '#59616a'; x.fillRect(bx + bw - 70, Y0 + 14, 26, by - Y0 - 12); x.fillStyle = C.txt; x.font = '700 17px Arial'; x.fillText(`${Math.round(s.tgas)} °C`, bx + bw - 57, Y0 + 2 + 10);
    x.strokeStyle = s.flame ? '#e9edf1' : '#69737d'; x.lineWidth = 6; x.beginPath(); x.moveTo(bx + 120, by); x.lineTo(bx + 120, Y0 + 40); x.lineTo(bx + 230, Y0 + 40); x.stroke();
    x.fillStyle = C.dim; x.font = '600 15px Arial'; x.textAlign = 'left'; x.fillText('VAPOR', bx + 132, Y0 + 26);
    // bomba de alimentação
    const px = bx + 40, py = by + bh + 60; x.strokeStyle = '#5c9ccf'; x.lineWidth = 5; x.beginPath(); x.moveTo(px + 22, py); x.lineTo(bx + 90, py); x.lineTo(bx + 90, by + bh - 8); x.stroke();
    x.fillStyle = s.pump ? C.ok : '#59616a'; x.beginPath(); x.arc(px, py, 22, 0, 7); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.moveTo(px - 9, py - 12); x.lineTo(px + 13, py); x.lineTo(px - 9, py + 12); x.fill();
    x.fillStyle = C.txt; x.font = '700 16px Arial'; x.textAlign = 'left'; x.fillText(`BOMBA ALIM. ${s.pump ? 'LIGADA' : 'DESLIGADA'}`, px + 34, py + 2);
    x.fillStyle = '#fff'; x.font = '800 22px Arial'; x.textAlign = 'center'; x.fillText(`NÍVEL ${Math.round(s.lvl * 100)} %`, bx + bw / 2, by - 18 + 0);
    // blocos de valores
    const tile = (X, Y, w, h, lbl, val, un, col, frac, mark) => {
      rr(x, X, Y, w, h, 10); x.fillStyle = C.panel; x.fill();
      x.fillStyle = C.dim; x.font = '700 17px Arial'; x.textAlign = 'left'; x.fillText(lbl, X + 14, Y + 22);
      x.fillStyle = col; x.font = '800 50px Arial'; x.fillText(val, X + 14, Y + 72); const vw = x.measureText(val).width; x.fillStyle = C.txt; x.font = '600 18px Arial'; x.fillText(un, X + 22 + vw, Y + 80);
      if (frac != null) { x.fillStyle = '#23272b'; x.fillRect(X + 14, Y + h - 30, w - 28, 12); x.fillStyle = col; x.fillRect(X + 14, Y + h - 30, (w - 28) * Math.max(0, Math.min(1, frac)), 12); if (mark != null) { x.fillStyle = '#fff'; x.fillRect(X + 14 + (w - 28) * mark - 1.5, Y + h - 36, 3, 24); } }
    };
    const pc = s.P > 10.2 ? C.bad : s.P < 7 ? C.warn : C.ok;
    tile(498, Y0, 252, 150, 'PRESSÃO DE VAPOR', s.P.toFixed(1).replace('.', ','), 'kgf/cm²', pc, s.P / 12, 9.5 / 12);
    tile(760, Y0, 250, 150, 'TEMP. GASES', String(Math.round(s.tgas)), '°C', '#ffd23a', s.tgas / 300);
    tile(498, Y0 + 160, 252, 150, 'NÍVEL TUBULÃO', String(Math.round(s.lvl * 100)), '%', s.lvl < 0.35 ? C.bad : '#7ec8ff', s.lvl, 0.5);
    tile(760, Y0 + 160, 250, 150, 'CARGA QUEIMADOR', String(Math.round((s.flame ? s.load : 0) * 100)), '%', '#ff9f43', s.flame ? s.load : 0, s.mode === 'MAN' ? s.loadSP : null);
    const man = s.mode === 'MAN'; btn(900, Y0 + 182, 50, 44, '▲', 'up', { dis: !man }); btn(954, Y0 + 182, 50, 44, '▼', 'dn', { dis: !man });
    // tendência
    const gx = 498, gy = Y0 + 320, gw = 512, gh = Y1 - gy; rr(x, gx, gy, gw, gh, 10); x.fillStyle = C.panel; x.fill();
    x.fillStyle = C.dim; x.font = '700 15px Arial'; x.textAlign = 'left'; x.fillText('PRESSÃO — ÚLTIMOS 3 min', gx + 12, gy + 18);
    const yv = (v) => gy + gh - 10 - (v - 6) / 5.5 * (gh - 34); x.strokeStyle = '#5a646e'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(gx + 10, yv(9.5)); x.lineTo(gx + gw - 10, yv(9.5)); x.stroke(); x.setLineDash([]);
    x.strokeStyle = C.ok; x.lineWidth = 3; x.beginPath(); s.hist.forEach((v, i) => { const X = gx + 10 + (gw - 20) * i / 89, Y = Math.max(gy + 24, Math.min(gy + gh - 6, yv(v))); i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke();
  } else if (s.page === 'queimador') {
    rr(x, 14, Y0, 488, Y1 - Y0, 10); x.fillStyle = C.panel; x.fill();
    x.fillStyle = C.dim; x.font = '700 18px Arial'; x.textAlign = 'left'; x.fillText('SEQUÊNCIA DE PARTIDA', 30, Y0 + 26);
    const order = ['PURGE', 'IGN', 'LOW', 'RUN'], idx = order.indexOf(s.seq), steps = ['PRÉ-PURGA (30 s)', 'IGNIÇÃO — PILOTO', 'CHAMA ESTABELECIDA', 'MODULAÇÃO'];
    steps.forEach((t, i) => {
      const Y = Y0 + 66 + i * 70, done = idx > i || (idx === 3 && i === 3), cur = idx === i;
      x.fillStyle = cur ? (blink ? C.warn : '#7a5a10') : done ? C.ok : '#4f565e'; x.beginPath(); x.arc(46, Y, 15, 0, 7); x.fill();
      x.fillStyle = '#111'; x.font = '800 17px Arial'; x.textAlign = 'center'; x.fillText(String(i + 1), 46, Y + 1);
      x.fillStyle = cur || done ? C.txt : '#7d8791'; x.font = '700 22px Arial'; x.textAlign = 'left'; x.fillText(t, 76, Y + 1);
      if (i === 0 && s.seq === 'PURGE') { const f = Math.min(1, s.tSeq / 30); x.fillStyle = '#23272b'; x.fillRect(76, Y + 18, 300, 12); x.fillStyle = C.warn; x.fillRect(76, Y + 18, 300 * f, 12); x.fillStyle = C.txt; x.font = '800 20px Arial'; x.fillText(`${Math.ceil(30 - s.tSeq)} s`, 390, Y + 25); }
      if (i === 1 && s.seq === 'IGN') { x.fillStyle = C.warn; x.font = '700 16px Arial'; x.fillText('transformador de ignição + válvula do piloto', 76, Y + 26); }
    });
    if (s.seq === 'POST') { x.fillStyle = C.warn; x.font = '800 20px Arial'; x.fillText(`PÓS-PURGA ${Math.ceil(15 - s.tSeq)} s`, 30, Y1 - 24); }
    else if (['OFF', 'STBY', 'LOCK'].includes(s.seq)) { x.fillStyle = s.seq === 'LOCK' ? C.bad : C.dim; x.font = '800 20px Arial'; x.fillText(P.seqText, 30, Y1 - 24); }
    // intertravamentos
    rr(x, 512, Y0, 498, 262, 10); x.fillStyle = C.panel; x.fill(); x.fillStyle = C.dim; x.font = '700 18px Arial'; x.fillText('INTERTRAVAMENTOS', 528, Y0 + 26);
    const il = [['Emergência liberada', !s.estop], ['Chave seletora fora de 0', s.mode !== '0'], ['Pressostato limite (≤ 10,6)', s.P < 10.6], ['Nível mínimo do tubulão', s.lvl > 0.3], ['Pressão de gás (300 mbar)', true], ['Fluxo de ar / ventilador', ['PURGE', 'IGN', 'LOW', 'RUN', 'POST'].includes(s.seq) || s.seq === 'OFF' || s.seq === 'STBY'], ['Sem bloqueio de segurança', s.seq !== 'LOCK']];
    il.forEach(([t, ok], i) => { const Y = Y0 + 56 + i * 29; x.fillStyle = ok ? C.ok : C.bad; x.beginPath(); x.arc(540, Y, 8, 0, 7); x.fill(); x.fillStyle = C.txt; x.font = '600 18px Arial'; x.textAlign = 'left'; x.fillText(t, 558, Y + 1); });
    rr(x, 512, Y0 + 272, 498, Y1 - Y0 - 272, 10); x.fillStyle = C.panel; x.fill();
    const fan = ['PURGE', 'IGN', 'LOW', 'RUN', 'POST'].includes(s.seq), gas = s.flame || s.seq === 'IGN';
    const rows = [['Sinal de chama', `${s.fsig.toFixed(1).replace('.', ',')} µA`, s.fsig / 20, C.flame], ['Registro de ar', `${Math.round(s.damper)} %`, s.damper / 100, C.blue]];
    rows.forEach(([a, b, f, col], i) => { const Y = Y0 + 300 + i * 46; x.fillStyle = C.txt; x.font = '700 18px Arial'; x.fillText(a, 528, Y); x.fillText(b, 900, Y); x.fillStyle = '#23272b'; x.fillRect(528, Y + 12, 460, 10); x.fillStyle = col; x.fillRect(528, Y + 12, 460 * Math.max(0, Math.min(1, f)), 10); });
    x.font = '700 18px Arial'; x.fillStyle = fan ? C.ok : C.dim; x.fillText(`VENTILADOR ${fan ? 'LIGADO' : 'DESLIGADO'}`, 528, Y1 - 16); x.fillStyle = gas ? C.ok : C.dim; x.fillText(`VÁLV. GÁS SV1/SV2 ${gas ? 'ABERTAS' : 'FECHADAS'}`, 760, Y1 - 16);
  } else {
    rr(x, 14, Y0, W - 28, Y1 - Y0, 10); x.fillStyle = C.panel; x.fill();
    x.fillStyle = C.dim; x.font = '700 17px Arial'; x.textAlign = 'left'; x.fillText('HORA', 32, Y0 + 24); x.fillText('DESCRIÇÃO', 150, Y0 + 24); x.fillText('ESTADO', 790, Y0 + 24);
    s.alarms.slice(0, 8).forEach((a, i) => {
      const Y = Y0 + 42 + i * 36; if (a.active && !a.ack && blink) { x.fillStyle = '#7d1712'; x.fillRect(20, Y, W - 40, 32); }
      x.fillStyle = a.active ? (a.ack ? C.bad : '#fff') : '#8e98a2'; x.font = '600 19px Arial'; x.fillText(a.t, 32, Y + 17); x.fillText(a.txt, 150, Y + 17);
      x.fillText(a.active ? (a.ack ? 'ATIVO · RECONH.' : 'ATIVO') : 'NORMALIZADO', 790, Y + 17);
    });
    if (!s.alarms.length) { x.fillStyle = C.dim; x.fillText('SEM REGISTROS', 32, Y0 + 60); }
    btn(W - 300, Y1 - 62, 270, 50, 'RECONHECER', 'ack', { on: unack > 0, col: '#b3261e' });
  }
  if (test) { x.fillStyle = 'rgba(255,255,255,0.92)'; x.fillRect(W / 2 - 230, H / 2 - 50, 460, 80); x.fillStyle = '#111'; x.font = '800 30px Arial'; x.textAlign = 'center'; x.fillText('TESTE DE LÂMPADAS', W / 2, H / 2 - 9); }
  void ft;
}
