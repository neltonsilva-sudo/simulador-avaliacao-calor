// EQUIPAMENTOS — texturas e materiais procedurais (canvas/DataTexture, sem assets binários).
// Inox escovado anisotrópico (riscos, digitais, manchas de calor), vidro temperado escuro, interiores incandescentes,
// displays de comando (7 segmentos), placas NR-26, chapa xadrez, grelhas de ventilação, pães (normal de miolo/crosta).
import * as THREE from 'three';

// ───────────── utilidades ─────────────
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sst = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, srgb, rep = true, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; else t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = aniso; return t;
}
/** ruído de valor tileável 2D (cx×cy células) somado em out (N×M) */
function vnoise(N, M, cx, cy, seed, out, amp = 1) {
  const r = rng(seed), lat = new Float32Array(cx * cy);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const sx = new Float32Array(N), i0 = new Int32Array(N), i1 = new Int32Array(N);
  for (let x = 0; x < N; x++) { const f = (x * cx) / N, i = Math.floor(f), t = f - i; sx[x] = t * t * (3 - 2 * t); i0[x] = i % cx; i1[x] = (i + 1) % cx; }
  for (let y = 0; y < M; y++) {
    const f = (y * cy) / M, j = Math.floor(f); let t = f - j; t = t * t * (3 - 2 * t);
    const r0 = (j % cy) * cx, r1 = ((j + 1) % cy) * cx, o = y * N;
    for (let x = 0; x < N; x++) {
      const a = lat[r0 + i0[x]], b = lat[r0 + i1[x]], c = lat[r1 + i0[x]], d = lat[r1 + i1[x]], u = sx[x];
      const top = a + (b - a) * u, bot = c + (d - c) * u; out[o + x] += (top + (bot - top) * t) * amp;
    }
  }
}
export function fbm(N, M, cx, cy, oct, seed, gain = 0.5) {
  const out = new Float32Array(N * M); let amp = 1, tot = 0;
  for (let i = 0; i < oct; i++) { vnoise(N, M, cx << i, cy << i, seed + i * 977, out, amp); tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function normalFromHeight(h, N, M, strength, rep = true) {
  const c = canvas(N, M), ctx = c.getContext('2d'), img = ctx.createImageData(N, M), d = img.data;
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    const xm = (x - 1 + N) % N, xp = (x + 1) % N, ym = (y - 1 + M) % M, yp = (y + 1) % M;
    const dx = (h[y * N + xp] - h[y * N + xm]) * strength, dy = (h[yp * N + x] - h[ym * N + x]) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * N + x) * 4; d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (nz / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return tex(c, false, rep);
}

// ───────────── inox escovado ─────────────
// Escovado na direção v (vertical nas faces verticais com UV de mundo). G = rugosidade; normal = sulcos finos.
let _steel = null;
export function steelTextures() {
  if (_steel) return _steel;
  const N = 1024, M = 1024;
  // sulcos: ruído 1D por coluna (muitas frequências) levemente modulado ao longo de v
  const r = rng(71), col = new Float32Array(N);
  for (const [cells, amp] of [[1024, 0.5], [512, 0.35], [341, 0.22], [256, 0.12]]) {
    const lat = Array.from({ length: cells }, () => r());
    for (let x = 0; x < N; x++) { const f = (x * cells) / N, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t); col[x] += (lat[i % cells] * (1 - s) + lat[(i + 1) % cells] * s) * amp; }
  }
  let mn = 1e9, mx = -1e9; for (const v of col) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let x = 0; x < N; x++) col[x] = (col[x] - mn) / (mx - mn);
  const along = fbm(N, M, 8, 64, 3, 73);         // variação ao longo dos sulcos (quebra a repetição)
  const blot = fbm(N, M, 3, 3, 5, 79);           // manchas largas (polimento irregular)
  const heat = fbm(N, M, 2, 2, 4, 83);           // leve tom de calor/oxidação
  // digitais e manchas de mão (canvas): elipses com cristas concêntricas
  const fc = canvas(N, M), fx = fc.getContext('2d'); fx.fillStyle = '#000'; fx.fillRect(0, 0, N, M);
  const rf = rng(91);
  for (let k = 0; k < 26; k++) {
    const cx = rf() * N, cy = rf() * M, rx = 9 + rf() * 9, ry = rx * (1.2 + rf() * 0.4), a = rf() * Math.PI;
    for (let ring = 0; ring < 11; ring++) {
      fx.strokeStyle = `rgba(255,255,255,${0.05 + rf() * 0.07})`; fx.lineWidth = 1;
      fx.beginPath(); fx.ellipse(cx, cy, rx * (ring + 1) / 11, ry * (ring + 1) / 11, a, 0, Math.PI * 2); fx.stroke();
    }
  }
  for (let k = 0; k < 9; k++) { // borrões de pano/mão
    const g = fx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    fx.save(); fx.translate(rf() * N, rf() * M); fx.rotate(rf() * 3); fx.scale(40 + rf() * 120, 20 + rf() * 50); fx.fillStyle = g; fx.beginPath(); fx.arc(0, 0, 1, 0, 7); fx.fill(); fx.restore();
  }
  // riscos finos em várias direções
  fx.lineCap = 'round';
  for (let k = 0; k < 220; k++) {
    const x = rf() * N, y = rf() * M, L = 8 + rf() * 90, a = (rf() < 0.6 ? Math.PI / 2 + (rf() - 0.5) * 0.5 : rf() * Math.PI);
    fx.strokeStyle = `rgba(255,255,255,${0.12 + rf() * 0.3})`; fx.lineWidth = 0.5 + rf() * 0.7;
    fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); fx.stroke();
  }
  const fd = fx.getImageData(0, 0, N, M).data;
  const cR = canvas(N, M), R = cR.getContext('2d').createImageData(N, M);
  const cA = canvas(N, M), A = cA.getContext('2d').createImageData(N, M);
  const h = new Float32Array(N * M);
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, s = col[x] * (0.75 + 0.5 * along[i]) - 0.35 * along[i], f = fd[i * 4] / 255;
    const rough = clamp01(0.22 + (s - 0.5) * 0.07 + (blot[i] - 0.5) * 0.06 + f * 0.22);
    R.data[i * 4] = 255; R.data[i * 4 + 1] = rough * 255; R.data[i * 4 + 2] = 255; R.data[i * 4 + 3] = 255;
    const v = 0.88 + (s - 0.5) * 0.045 + (blot[i] - 0.5) * 0.05 - f * 0.03;
    const ht = sst(0.62, 0.8, heat[i]) * 0.06;
    A.data[i * 4] = clamp01(v + ht * 0.4) * 255; A.data[i * 4 + 1] = clamp01(v + ht * 0.1) * 255; A.data[i * 4 + 2] = clamp01(v * 1.01 - ht * 0.3) * 255; A.data[i * 4 + 3] = 255;
    h[i] = s * 0.35 - f * 0.08;
  }
  cR.getContext('2d').putImageData(R, 0, 0); cA.getContext('2d').putImageData(A, 0, 0);
  _steel = { rough: tex(cR, false), albedo: tex(cA, true), normal: normalFromHeight(h, N, M, 1.0) };
  return _steel;
}

// ───────────── chapa xadrez de alumínio (rampas) ─────────────
let _tread = null;
export function treadTextures() {
  if (_tread) return _tread;
  const N = 512, h = new Float32Array(N * N), cell = N / 8;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const lx = (x % cell) / cell - 0.5, ly = (y % cell) / cell - 0.5;
    const rot = (cx + cy) % 2 ? 1 : -1; // padrão diamante alternado
    const ca = Math.cos(rot * 0.785), sa = Math.sin(rot * 0.785);
    const u = lx * ca - ly * sa, v = lx * sa + ly * ca;
    const d = (u * u) / (0.36 * 0.36) + (v * v) / (0.07 * 0.07);
    h[y * N + x] = d < 1 ? Math.sqrt(1 - d) : 0;
  }
  const n = fbm(N, N, 6, 6, 4, 131), sc = canvas(N), ctx = sc.getContext('2d'), img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const v = 0.55 + (n[i] - 0.5) * 0.25 + h[i] * 0.08; img.data[i * 4] = img.data[i * 4 + 1] = v * 255; img.data[i * 4 + 2] = v * 250; img.data[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const rc = canvas(N), rx = rc.getContext('2d'), ri = rx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const v = clamp01(0.42 + (n[i] - 0.5) * 0.4 - h[i] * 0.18); ri.data[i * 4] = 255; ri.data[i * 4 + 1] = v * 255; ri.data[i * 4 + 2] = 255; ri.data[i * 4 + 3] = 255; }
  rx.putImageData(ri, 0, 0);
  _tread = { albedo: tex(sc, true), rough: tex(rc, false), normal: normalFromHeight(h, N, N, 3.5) };
  return _tread;
}

// ───────────── grelha de ventilação (fendas) — alpha/escuro ─────────────
export function slotTexture(slots = 24, vertical = true) {
  const W = 512, H = 64, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#000';
  for (let i = 0; i < slots; i++) {
    const px = (i + 0.5) * W / slots, w = W / slots * 0.45;
    if (vertical) { roundRect(x, px - w / 2, 8, w, H - 16, w / 2); x.fill(); }
  }
  const t = tex(c, true, false); return t;
}
export function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

// ───────────── interior incandescente da câmara (parede/teto) ─────────────
// Textura HDR "falsa": aço do interior iluminado por lâmpadas (manchas quentes), cantos escuros, escorridos de gordura.
export function cavityTexture(seed, { lamps = [[0.5, 0.12]], tint = [1, 0.34, 0.03], hot = [1, 0.76, 0.34], dark = 0.3, grad = 0.75 } = {}) {
  // âmbar 2700 K: base saturada, gradiente vertical (topo/lâmpadas mais quentes e claros), núcleo branco-amarelado nas lâmpadas.
  // Codificado em LDR (0..1); a intensidade HDR vem do material (× 3–5).
  const N = 256, c = canvas(N), x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data;
  const n = fbm(N, N, 4, 4, 4, seed), st = fbm(N, N, 64, 2, 2, seed + 5);
  for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
    const u = px / N, v = py / N, i = py * N + px;
    let L = (0.32 + 0.1 * n[i] + 0.03 * (st[i] - 0.5)) * (1 - grad + grad * (1 - v) * 1.25);
    let H = 0;
    for (const [lx, ly, s2 = 1] of lamps) { const dd = Math.hypot((u - lx) * 1.3, v - ly); H += s2 * (0.9 * Math.exp(-dd * dd / 0.004) + 0.25 * Math.exp(-dd * dd / 0.03)); L += s2 * 0.35 * Math.exp(-dd * dd / 0.08); }
    const edge = Math.min(u, 1 - u, v, 1 - v), e = dark + (1 - dark) * sst(0, 0.16, edge); L *= e; H *= e;
    L *= 1 - 0.3 * sst(0.55, 0.9, n[i]) * sst(0.5, 1, v); // gordura escurecida embaixo
    for (let k = 0; k < 3; k++) d[i * 4 + k] = clamp01(L * tint[k] + H * hot[k]) * 255;
    d[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0); return tex(c, true, false);
}
/** reflexo no vidro (aditivo): faixas de luminária, véu de gordura/digitais e, opcional, fileira de pontos das lâmpadas internas */
export function glassFxTexture(seed, { dots = 0, dotRows = 1, bands = 2 } = {}) {
  const W = 512, H = 256, c = canvas(W, H), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  // faixas diagonais suaves (luminárias do teto refletidas)
  for (let k = 0; k < bands; k++) {
    const x0 = W * (0.15 + 0.6 * r()), w = 30 + r() * 60;
    const g = x.createLinearGradient(x0 - w, 0, x0 + w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(235,240,245,${0.32 + r() * 0.2})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.save(); x.translate(x0, H / 2); x.transform(1, 0, -0.35, 1, 0, 0); x.translate(-x0, -H / 2); x.fillStyle = g; x.fillRect(x0 - w, 0, 2 * w, H); x.restore();
  }
  // véu: gordura mais forte embaixo e nas bordas, digitais perto do puxador
  const n = fbm(W, H, 6, 3, 4, seed + 3), img = x.getImageData(0, 0, W, H), dd = img.data;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const i = yy * W + xx, v = yy / H, edge = Math.min(xx / W, 1 - xx / W, v, 1 - v);
    const haze = (0.05 + 0.1 * sst(0.5, 1, v) + 0.08 * (1 - sst(0, 0.08, edge))) * (0.6 + 0.8 * n[i]);
    dd[i * 4] = Math.min(255, dd[i * 4] + haze * 150); dd[i * 4 + 1] = Math.min(255, dd[i * 4 + 1] + haze * 145); dd[i * 4 + 2] = Math.min(255, dd[i * 4 + 2] + haze * 135);
  }
  x.putImageData(img, 0, 0);
  // pontos: reflexo das lâmpadas internas no vidro interno (FOTO 4)
  for (let row = 0; row < dotRows; row++) for (let k = 0; k < dots; k++) {
    const px = W * (0.08 + 0.84 * (k + 0.5) / dots) + (row ? W * 0.04 : 0), py = H * (0.22 + row * 0.28);
    const g = x.createRadialGradient(px, py, 0, px, py, 14); g.addColorStop(0, 'rgba(255,230,170,1)'); g.addColorStop(0.3, 'rgba(255,170,70,0.6)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    x.fillStyle = g; x.fillRect(px - 14, py - 14, 28, 28);
  }
  return tex(c, true, false);
}
/** lâmpada (sprite radial) */
let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const N = 128, c = canvas(N), x = c.getContext('2d'), g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,240,200,0.9)'); g.addColorStop(0.35, 'rgba(255,170,80,0.25)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = g; x.fillRect(0, 0, N, N); _glow = tex(c, true, false); return _glow;
}
/** vapor: puff macio irregular */
let _puff = null;
export function puffTexture() {
  if (_puff) return _puff;
  const N = 128, n = fbm(N, N, 4, 4, 4, 211), c = canvas(N), x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) {
    const r = Math.hypot(X - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2), i = y * N + X;
    const a = clamp01((1 - r) * 1.4) ** 1.6 * (0.55 + 0.9 * (n[i] - 0.3));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = clamp01(a) * 255;
  }
  x.putImageData(img, 0, 0); _puff = tex(c, false, false); return _puff;
}
/** vidro: sujeira/gordura/digitais (G = rugosidade, A = opacidade extra) */
let _glassGrime = null;
export function glassGrime() {
  if (_glassGrime) return _glassGrime;
  const N = 512, n = fbm(N, N, 3, 3, 5, 307), c = canvas(N), x = c.getContext('2d'), img = x.createImageData(N, N);
  const fc = canvas(N), f = fc.getContext('2d'); f.fillStyle = '#000'; f.fillRect(0, 0, N, N); const r = rng(311);
  for (let k = 0; k < 14; k++) { const cx = r() * N, cy = r() * N, rx = 6 + r() * 6; for (let ring = 0; ring < 9; ring++) { f.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.08})`; f.beginPath(); f.ellipse(cx, cy, rx * (ring + 1) / 9, rx * 1.3 * (ring + 1) / 9, r() * 3, 0, 7); f.stroke(); } }
  for (let k = 0; k < 6; k++) { f.strokeStyle = `rgba(255,255,255,0.06)`; f.lineWidth = 18 + r() * 30; f.beginPath(); const y0 = r() * N; f.moveTo(0, y0); f.bezierCurveTo(N * 0.3, y0 + (r() - 0.5) * 80, N * 0.6, y0 + (r() - 0.5) * 80, N, y0 + (r() - 0.5) * 40); f.stroke(); }
  const fd = f.getImageData(0, 0, N, N).data;
  for (let y = 0; y < N; y++) for (let X = 0; X < N; X++) {
    const i = y * N + X, v = y / N, haze = sst(0.55, 1, v) * 0.5 + sst(0.6, 0.9, n[i]) * 0.4 + fd[i * 4] / 255;
    img.data[i * 4] = 255; img.data[i * 4 + 1] = clamp01(0.04 + haze * 0.35) * 255; img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0); _glassGrime = tex(c, false, false); return _glassGrime;
}
/** bump da crosta do pão (poros, fissuras) — tileável */
let _crust = null;
export function crustNormal() {
  if (_crust) return _crust;
  const N = 256, a = fbm(N, N, 16, 16, 3, 401), b = fbm(N, N, 48, 48, 2, 409), h = new Float32Array(N * N);
  for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.6 + b[i] * 0.4 - sst(0.66, 0.72, b[i]) * 0.5;
  _crust = normalFromHeight(h, N, N, 2.2); return _crust;
}

// ───────────── displays de comando (canvas) ─────────────
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '', P: 'abefg', E: 'adefg', r: 'eg', o: 'cdeg', n: 'ceg', F: 'aefg', C: 'adef', A: 'abcefg', H: 'bcefg', t: 'defg', L: 'def', d: 'bcdeg', b: 'cdefg' };
/** desenha dígitos de 7 segmentos (itálicos), apagados em tom escuro e acesos com brilho */
export function draw7(x, str, X, Y, h, on, off = 'rgba(255,255,255,0.035)', glow = true) {
  const w = h * 0.52, t = h * 0.11, sl = h * 0.1, gap = h * 0.17;
  let cx = X;
  for (const ch of String(str)) {
    if (ch === '.') { x.fillStyle = on; x.beginPath(); x.arc(cx - gap * 0.5, Y + h, t * 0.6, 0, 7); x.fill(); continue; }
    const lit = SEG[ch] ?? '';
    const P = (px, py) => [cx + px * w + (1 - py / h) * sl, Y + py];
    const tu = t / w, gp = h * 0.012;
    const H6 = (yy) => [[tu * 0.6, yy], [tu * 1.1, yy - t / 2], [1 - tu * 1.1, yy - t / 2], [1 - tu * 0.6, yy], [1 - tu * 1.1, yy + t / 2], [tu * 1.1, yy + t / 2]];
    const V6 = (u0, y0, y1) => [[u0 + tu / 2, y0], [u0 + tu, y0 + t / 2], [u0 + tu, y1 - t / 2], [u0 + tu / 2, y1], [u0, y1 - t / 2], [u0, y0 + t / 2]];
    const segs = { a: H6(t / 2), g: H6(h / 2), d: H6(h - t / 2),
      f: V6(0, t / 2 + gp, h / 2 - gp), e: V6(0, h / 2 + gp, h - t / 2 - gp), b: V6(1 - tu, t / 2 + gp, h / 2 - gp), c: V6(1 - tu, h / 2 + gp, h - t / 2 - gp) };
    for (const k of 'abcdefg') {
      const poly = segs[k].map(([u, v]) => P(u, v));
      x.beginPath(); poly.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
      if (lit.includes(k)) { x.save(); if (glow) { x.shadowColor = on; x.shadowBlur = h * 0.18; } x.fillStyle = on; x.fill(); x.restore(); }
      else { x.fillStyle = off; x.fill(); }
    }
    cx += w + gap;
  }
}
/** ícone de linha simples (branco/cinza) */
function icon(x, kind, X, Y, s, col = 'rgba(225,230,235,0.85)') {
  x.save(); x.translate(X, Y); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = Math.max(1.5, s * 0.08); x.lineCap = 'round'; x.lineJoin = 'round';
  const r = s / 2;
  switch (kind) {
    case 'power': x.beginPath(); x.arc(0, 0, r * 0.7, -1.1, Math.PI + 1.1, false); x.stroke(); x.beginPath(); x.moveTo(0, -r * 0.9); x.lineTo(0, -r * 0.1); x.stroke(); break;
    case 'temp': x.beginPath(); x.moveTo(-r * 0.12, r * 0.3); x.lineTo(-r * 0.12, -r * 0.7); x.arc(0, -r * 0.7, r * 0.12, Math.PI, 0); x.lineTo(r * 0.12, r * 0.3); x.stroke(); x.beginPath(); x.arc(0, r * 0.5, r * 0.28, 0, 7); x.fill(); break;
    case 'clock': x.beginPath(); x.arc(0, 0, r * 0.75, 0, 7); x.stroke(); x.beginPath(); x.moveTo(0, -r * 0.45); x.lineTo(0, 0); x.lineTo(r * 0.35, r * 0.2); x.stroke(); break;
    case 'fan': for (let k = 0; k < 3; k++) { x.rotate(2.094); x.beginPath(); x.ellipse(0, -r * 0.42, r * 0.2, r * 0.42, 0.4, 0, 7); x.stroke(); } x.beginPath(); x.arc(0, 0, r * 0.1, 0, 7); x.fill(); break;
    case 'steam': for (const dx of [-0.35, 0, 0.35]) { x.beginPath(); x.moveTo(dx * r, r * 0.7); x.bezierCurveTo(dx * r - r * 0.3, r * 0.2, dx * r + r * 0.3, -r * 0.2, dx * r, -r * 0.7); x.stroke(); } break;
    case 'light': x.beginPath(); x.arc(0, -r * 0.15, r * 0.45, Math.PI * 0.8, Math.PI * 2.2); x.stroke(); x.beginPath(); x.moveTo(-r * 0.22, r * 0.45); x.lineTo(r * 0.22, r * 0.45); x.moveTo(-r * 0.18, r * 0.65); x.lineTo(r * 0.18, r * 0.65); x.stroke(); break;
    case 'up': x.beginPath(); x.moveTo(-r * 0.45, r * 0.2); x.lineTo(0, -r * 0.3); x.lineTo(r * 0.45, r * 0.2); x.stroke(); break;
    case 'down': x.beginPath(); x.moveTo(-r * 0.45, -r * 0.2); x.lineTo(0, r * 0.3); x.lineTo(r * 0.45, -r * 0.2); x.stroke(); break;
    case 'play': x.beginPath(); x.moveTo(-r * 0.3, -r * 0.45); x.lineTo(r * 0.45, 0); x.lineTo(-r * 0.3, r * 0.45); x.closePath(); x.stroke(); break;
    case 'stop': x.strokeRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8); break;
    case 'prog': x.beginPath(); x.moveTo(-r * 0.5, -r * 0.4); x.lineTo(r * 0.5, -r * 0.4); x.moveTo(-r * 0.5, 0); x.lineTo(r * 0.5, 0); x.moveTo(-r * 0.5, r * 0.4); x.lineTo(r * 0.2, r * 0.4); x.stroke(); break;
    case 'bread': x.beginPath(); x.ellipse(0, r * 0.1, r * 0.6, r * 0.35, 0, Math.PI, 0); x.lineTo(r * 0.6, r * 0.35); x.lineTo(-r * 0.6, r * 0.35); x.closePath(); x.stroke(); break;
    case 'oven': x.strokeRect(-r * 0.6, -r * 0.55, r * 1.2, r * 1.1); x.strokeRect(-r * 0.42, -r * 0.3, r * 0.84, r * 0.7); x.beginPath(); x.moveTo(-r * 0.45, -r * 0.45); x.lineTo(r * 0.45, -r * 0.45); x.stroke(); break;
  }
  x.restore();
}
function text(x, s, X, Y, size, col = 'rgba(220,225,230,0.8)', align = 'center', weight = 600) {
  x.fillStyle = col; x.font = `${weight} ${size}px "Roboto Condensed", "Arial Narrow", Arial, sans-serif`; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(s, X, Y);
}
/** botão de toque desenhado (contorno arredondado + ícone) */
function key(x, X, Y, s, ic, col = 'rgba(200,205,210,0.55)') { x.strokeStyle = col; x.lineWidth = 2; roundRect(x, X - s / 2, Y - s / 2, s, s, s * 0.16); x.stroke(); icon(x, ic, X, Y, s * 0.62); }

/**
 * Painel do forno turbo 1 (FOTO 2): vidro preto, ícones serigrafados, 7 seg. vermelho "180" e verde "25", teclas de toque.
 * Retorna { map, emissive } (canvas 256×1024 mapeado na coluna inteira) e redraw(temp, time).
 */
export function turboPanel({ temp = 180, time = 25, hTop = 0.95 } = {}) {
  const W = 256, H = 1024, cm = canvas(W, H), ce = canvas(W, H);
  const draw = (tC, tm) => {
    const x = cm.getContext('2d'), e = ce.getContext('2d');
    x.fillStyle = '#060707'; x.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    // faixa superior: ícones/legendas serigrafados
    text(x, 'CONTROLE', W / 2, 40, 17, 'rgba(210,214,218,0.55)'); text(x, 'DE COZIMENTO', W / 2, 60, 15, 'rgba(210,214,218,0.45)');
    icon(x, 'oven', W / 2, 108, 54); text(x, 'MODO VAPOR', W / 2, 152, 14, 'rgba(210,214,218,0.42)');
    // temperatura (vermelho) e tempo (verde)
    const rows = [[tC, '#ff2a1e', 210, 'temp'], [String(tm).padStart(2, ' '), '#3cff52', 290, 'clock']];
    for (const [val, colr, y, ic] of rows) {
      x.strokeStyle = 'rgba(200,205,210,0.5)'; x.lineWidth = 2; roundRect(x, 18, y - 18, 34, 34, 6); x.stroke();
      for (const c of [x, e]) draw7(c, String(val).padStart(3, ' '), 76, y - 30, 60, colr, c === x ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0)', c === e);
    }
    // teclas (grade 2×4) com ícones
    const ics = [['up', 'down'], ['fan', 'steam'], ['light', 'prog'], ['play', 'stop'], ['bread', 'power']];
    ics.forEach((rowI, j) => rowI.forEach((ic, i) => key(x, 80 + i * 96, 380 + j * 92, 58, ic)));
    // LED de status
    e.fillStyle = '#ff3a1a'; e.beginPath(); e.arc(W / 2, 852, 5, 0, 7); e.fill(); x.fillStyle = '#ff3a1a'; x.beginPath(); x.arc(W / 2, 852, 5, 0, 7); x.fill();
    text(x, 'AQUECENDO', W / 2, 880, 13, 'rgba(210,214,218,0.4)');
  };
  draw(temp, time);
  const map = tex(cm, true, false), emissive = tex(ce, true, false);
  return { map, emissive, redraw(t, m) { draw(t, m); map.needsUpdate = emissive.needsUpdate = true; } };
}
/** controlador digital de câmara (FOTO 4): moldura preta, display vermelho (temperatura) em cima e verde embaixo, 4 teclas */
export function deckController(vals = [[230, 250], [228, 245]]) {
  const W = 256, H = 384, cm = canvas(W, H), ce = canvas(W, H), x = cm.getContext('2d'), e = ce.getContext('2d');
  x.fillStyle = '#0c0d0e'; x.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  x.fillStyle = '#151718'; roundRect(x, 10, 10, W - 20, H - 20, 14); x.fill();
  text(x, 'TEMP °C', W / 2, 36, 16, 'rgba(220,220,220,0.55)');
  for (const c of [x, e]) { c.fillStyle = '#020202'; if (c === x) { roundRect(c, 28, 52, W - 56, 210, 8); c.fill(); } }
  const [top, bot] = vals[0];
  for (const c of [x, e]) {
    draw7(c, String(top).padStart(3, ' '), 54, 66, 72, '#ff2a20', c === x ? 'rgba(255,60,40,0.06)' : 'rgba(0,0,0,0)', c === e);
    draw7(c, String(bot).padStart(3, ' '), 54, 168, 72, '#33ff4a', c === x ? 'rgba(60,255,80,0.06)' : 'rgba(0,0,0,0)', c === e);
  }
  ['up', 'down', 'prog', 'power'].forEach((ic, i) => key(x, 50 + i * 52, 300, 40, ic));
  text(x, 'SUP     INF', W / 2, 350, 14, 'rgba(220,220,220,0.4)');
  return { map: tex(cm, true, false), emissive: tex(ce, true, false) };
}
/** IHM azul-clara do rotativo (FOTO 3) */
export function rotativoPanel() {
  const W = 256, H = 512, cm = canvas(W, H), ce = canvas(W, H), x = cm.getContext('2d'), e = ce.getContext('2d');
  x.fillStyle = '#1a1c1e'; x.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  for (const c of [x, e]) {
    const g = c.createLinearGradient(0, 30, 0, 230); g.addColorStop(0, '#9fd6ff'); g.addColorStop(1, '#5aa8e8');
    c.fillStyle = g; roundRect(c, 24, 30, W - 48, 200, 8); c.fill();
    c.fillStyle = '#0d2a48'; c.font = '700 22px "Roboto Condensed", Arial'; c.textAlign = 'left'; c.fillText('PROG 04  PÃO FRANCÊS', 38, 62);
    c.fillStyle = 'rgba(13,42,72,0.9)'; c.font = '700 64px "Roboto Mono", monospace'; c.fillText('200°', 40, 140);
    c.font = '600 26px "Roboto Mono", monospace'; c.fillText('18:00  VAPOR 6s', 40, 196);
    c.fillStyle = 'rgba(13,42,72,0.6)'; c.fillRect(38, 152, (W - 76) * 0.62, 10);
  }
  // teclado
  const lbl = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '◄', '0', '►'];
  lbl.forEach((l, i) => { const cx = 62 + (i % 3) * 66, cy = 278 + Math.floor(i / 3) * 52; x.fillStyle = '#d8dadc'; roundRect(x, cx - 26, cy - 19, 52, 38, 6); x.fill(); text(x, l, cx, cy + 1, 22, '#222', 'center', 700); });
  x.fillStyle = '#2bbd4a'; roundRect(x, 30, 470 - 18, 90, 34, 6); x.fill(); x.fillStyle = '#d42a20'; roundRect(x, W - 120, 470 - 18, 90, 34, 6); x.fill();
  text(x, 'LIGA', 75, 470, 18, '#fff', 'center', 700); text(x, 'DESL', W - 75, 470, 18, '#fff', 'center', 700);
  return { map: tex(cm, true, false), emissive: tex(ce, true, false) };
}
/** torre de comando da FOTO 5: painel preto, display vermelho, teclas, botão de emergência, pictogramas */
export function towerPanel() {
  const W = 256, H = 768, cm = canvas(W, H), ce = canvas(W, H), x = cm.getContext('2d'), e = ce.getContext('2d');
  x.fillStyle = '#080909'; x.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  for (const c of [x, e]) {
    draw7(c, '190', 46, 40, 64, '#ff3322', c === x ? 'rgba(255,60,40,0.06)' : 'rgba(0,0,0,0)', c === e);
    draw7(c, '35', 70, 128, 40, '#ff6a20', c === x ? 'rgba(255,60,40,0.06)' : 'rgba(0,0,0,0)', c === e);
  }
  text(x, 'TEMPO  min', W / 2, 192, 15, 'rgba(220,220,220,0.5)');
  const ics = ['temp', 'clock', 'fan', 'steam', 'light', 'prog'];
  ics.forEach((ic, i) => { const cx = 60 + (i % 3) * 68, cy = 248 + Math.floor(i / 3) * 62; icon(x, ic, cx, cy, 34); x.fillStyle = 'rgba(210,210,210,0.6)'; x.beginPath(); x.arc(cx, cy + 24, 3, 0, 7); x.fill(); });
  // anel do botão de emergência (o botão é geometria)
  x.fillStyle = '#e8c21a'; x.beginPath(); x.arc(W / 2, 470, 58, 0, 7); x.fill(); text(x, 'EMERGÊNCIA', W / 2, 545, 15, 'rgba(230,230,230,0.6)');
  return { map: tex(cm, true, false), emissive: tex(ce, true, false) };
}
/** plaquinha de pictogramas (adesivo) da torre: triângulo amarelo + círculo azul */
export function pictoTexture() {
  const W = 128, H = 256, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#c9cbcd'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#f4c400'; x.strokeStyle = '#111'; x.lineWidth = 5; x.beginPath(); x.moveTo(64, 20); x.lineTo(104, 90); x.lineTo(24, 90); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#111'; x.font = '900 46px Arial'; x.textAlign = 'center'; x.fillText('!', 64, 84);
  x.fillStyle = '#1e5aa8'; x.beginPath(); x.arc(64, 170, 38, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '900 40px Arial'; x.fillText('i', 64, 186);
  return tex(c, true, false);
}

// ───────────── sinalização NR-26 ─────────────
function hotSymbol(x, cx, cy, s) {
  // superfície quente (ISO 7010 W017): três ondas de calor sobre uma superfície
  x.save(); x.translate(cx, cy); x.strokeStyle = '#111'; x.fillStyle = '#111'; x.lineWidth = s * 0.07; x.lineCap = 'round';
  for (const dx of [-0.28, 0, 0.28]) { x.beginPath(); x.moveTo(dx * s, s * 0.18); x.bezierCurveTo(dx * s - s * 0.12, s * 0.02, dx * s + s * 0.12, -s * 0.12, dx * s, -s * 0.3); x.stroke(); }
  x.fillRect(-s * 0.45, s * 0.25, s * 0.9, s * 0.09); x.restore();
}
function gloveSymbol(x, cx, cy, s) {
  // luva (ISO 7010 M009)
  x.save(); x.translate(cx, cy); x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(-s * 0.26, s * 0.42); x.lineTo(-s * 0.26, -s * 0.05);
  for (let i = 0; i < 4; i++) { const fx0 = -s * 0.26 + i * s * 0.13; x.lineTo(fx0, -s * (0.36 + (i === 1 || i === 2 ? 0.06 : 0))); x.arc(fx0 + s * 0.055, -s * (0.36 + (i === 1 || i === 2 ? 0.06 : 0)), s * 0.055, Math.PI, 0); x.lineTo(fx0 + s * 0.11, -s * 0.05); }
  x.lineTo(s * 0.26, s * 0.05); x.lineTo(s * 0.42, -s * 0.12); x.arc(s * 0.4, -s * 0.06, s * 0.06, -1.2, 1.4); x.lineTo(s * 0.26, s * 0.24); x.lineTo(s * 0.26, s * 0.42); x.closePath(); x.fill();
  x.fillStyle = '#1f5fa8'; x.fillRect(-s * 0.3, s * 0.3, s * 0.6, s * 0.035); x.restore();
}
/** placa: 'quente' (amarela, triângulo, "CUIDADO — SUPERFÍCIE QUENTE"), 'luva' (azul, "USE LUVA TÉRMICA"), 'extintor' */
export function signTexture(kind) {
  const W = 512, H = kind === 'adesivo' ? 512 : 360, c = canvas(W, H), x = c.getContext('2d');
  if (kind === 'quente' || kind === 'adesivo') {
    x.fillStyle = '#f7f5ee'; x.fillRect(0, 0, W, H);
    if (kind === 'quente') { x.fillStyle = '#f4c400'; x.fillRect(0, 0, W, 78); text(x, 'CUIDADO', W / 2, 42, 58, '#111', 'center', 800); }
    const cy = kind === 'quente' ? 190 : 230, s = kind === 'quente' ? 200 : 380;
    x.fillStyle = '#f4c400'; x.strokeStyle = '#111'; x.lineWidth = s * 0.06; x.lineJoin = 'round';
    x.beginPath(); x.moveTo((kind === 'quente' ? 130 : W / 2), cy - s * 0.48); x.lineTo((kind === 'quente' ? 130 : W / 2) + s * 0.55, cy + s * 0.45); x.lineTo((kind === 'quente' ? 130 : W / 2) - s * 0.55, cy + s * 0.45); x.closePath(); x.fill(); x.stroke();
    hotSymbol(x, kind === 'quente' ? 130 : W / 2, cy + s * 0.12, s * 0.5);
    if (kind === 'quente') { text(x, 'SUPERFÍCIE', 370, 160, 46, '#111', 'center', 800); text(x, 'QUENTE', 370, 214, 52, '#111', 'center', 800); text(x, 'RISCO DE QUEIMADURA', W / 2, 322, 30, '#222', 'center', 700); }
  } else if (kind === 'luva') {
    x.fillStyle = '#f7f5ee'; x.fillRect(0, 0, W, H); x.fillStyle = '#1f5fa8'; x.fillRect(0, 0, W, 78); text(x, 'USO OBRIGATÓRIO', W / 2, 42, 46, '#fff', 'center', 800);
    x.fillStyle = '#1f5fa8'; x.beginPath(); x.arc(130, 205, 100, 0, 7); x.fill(); gloveSymbol(x, 130, 205, 150);
    text(x, 'USE LUVA', 370, 175, 50, '#111', 'center', 800); text(x, 'TÉRMICA', 370, 232, 50, '#111', 'center', 800); text(x, 'NA CARGA E DESCARGA', W / 2, 322, 28, '#222', 'center', 700);
  } else if (kind === 'extintor') {
    x.fillStyle = '#d0141c'; x.fillRect(0, 0, W, H); x.strokeStyle = '#fff'; x.lineWidth = 10; x.strokeRect(14, 14, W - 28, H - 28);
    x.fillStyle = '#fff'; roundRect(x, 190, 120, 70, 190, 22); x.fill(); x.fillRect(208, 86, 34, 40); x.fillRect(240, 92, 70, 14); x.beginPath(); x.moveTo(310, 92); x.lineTo(340, 140); x.lineTo(326, 146); x.lineTo(300, 104); x.fill();
    text(x, 'EXTINTOR', W / 2, 60, 44, '#fff', 'center', 800);
  } else if (kind === 'hidrate') {
    x.fillStyle = '#f7f5ee'; x.fillRect(0, 0, W, H); x.fillStyle = '#1b8a3c'; x.fillRect(0, 0, W, 78); text(x, 'HIDRATAÇÃO', W / 2, 42, 48, '#fff', 'center', 800);
    x.fillStyle = '#1b8a3c'; x.beginPath(); x.arc(120, 210, 90, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(120, 140); x.bezierCurveTo(170, 210, 165, 270, 120, 270); x.bezierCurveTo(75, 270, 70, 210, 120, 140); x.fill();
    text(x, 'BEBA ÁGUA', 360, 170, 46, '#111', 'center', 800); text(x, 'A CADA 20 MIN', 360, 226, 38, '#111', 'center', 700); text(x, 'ÁREA DE DESCANSO TÉRMICO', W / 2, 322, 26, '#222', 'center', 700);
  }
  const t = tex(c, true, false); return t;
}
