// CALDEIRAS — texturas procedurais (canvas/DataTexture, sem assets binários): chapa de alumínio do isolamento (costuras,
// sobreposições, amassados), inox escovado com tons de calor, piso de concreto/epóxi (macro com faixas amarelas, manchas,
// poça de condensado), painel de fechamento trapezoidal, telha, exterior das janelas, placas NR-13/NR-26, IHMs, manômetros,
// sprites de vapor.
import * as THREE from 'three';
import { HALL2, BOILERS, PIPES, LEAKS, STATIONS2, CONTROL_ROOM, TABLE2 } from './layout_caldeiras.js';

export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sst = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export function tex(c, { srgb = false, rep = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.anisotropy = aniso; return t;
}
function vnoise(N, M, cx, cy, seed, out, amp = 1) {
  const r = rng(seed), lat = new Float32Array(cx * cy); for (let i = 0; i < lat.length; i++) lat[i] = r();
  const sx = new Float32Array(N), i0 = new Int32Array(N), i1 = new Int32Array(N);
  for (let x = 0; x < N; x++) { const f = (x * cx) / N, i = Math.floor(f), t = f - i; sx[x] = t * t * (3 - 2 * t); i0[x] = i % cx; i1[x] = (i + 1) % cx; }
  for (let y = 0; y < M; y++) {
    const f = (y * cy) / M, j = Math.floor(f); let t = f - j; t = t * t * (3 - 2 * t);
    const r0 = (j % cy) * cx, r1 = ((j + 1) % cy) * cx, o = y * N;
    for (let x = 0; x < N; x++) { const a = lat[r0 + i0[x]], b = lat[r0 + i1[x]], c = lat[r1 + i0[x]], d = lat[r1 + i1[x]], u = sx[x]; const top = a + (b - a) * u, bot = c + (d - c) * u; out[o + x] += (top + (bot - top) * t) * amp; }
  }
}
export function fbm(N, M, cx, cy, oct, seed, gain = 0.5) {
  const out = new Float32Array(N * M); let amp = 1, tot = 0;
  for (let i = 0; i < oct; i++) { vnoise(N, M, cx << i, cy << i, seed + i * 977, out, amp); tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot; return out;
}
function normalFromHeight(h, N, M, strength) {
  const [c, ctx] = cnv(N, M), img = ctx.createImageData(N, M), d = img.data;
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    const xm = (x - 1 + N) % N, xp = (x + 1) % N, ym = (y - 1 + M) % M, yp = (y + 1) % M;
    const dx = (h[y * N + xp] - h[y * N + xm]) * strength, dy = (h[yp * N + x] - h[ym * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return tex(c);
}
function putGray(N, M, f) { // f(i) → [r,g,b] 0..1
  const [c, ctx] = cnv(N, M), img = ctx.createImageData(N, M), d = img.data;
  for (let i = 0; i < N * M; i++) { const v = f(i); d[i * 4] = clamp01(v[0]) * 255; d[i * 4 + 1] = clamp01(v[1]) * 255; d[i * 4 + 2] = clamp01(v[2]) * 255; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return c;
}
export function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

// ───────────── chapa de alumínio do isolamento (u = circunferência, v = comprimento; 1 repetição = 1,2 m × 1,0 m) ─────────────
// Folhas sobrepostas (degrau na costura longitudinal e na circunferencial), amassados suaves de montagem, rebites, manchas
// de dedos e de condensado escorrido, oxidação branca leve. Saída: albedo (sRGB), roughness (G), normal.
let _clad = null;
export function cladTextures() {
  if (_clad) return _clad;
  const N = 1024, M = 1024, r = rng(17);
  const dent = fbm(N, M, 6, 5, 4, 23), big = fbm(N, M, 2, 2, 3, 29), blot = fbm(N, M, 4, 4, 5, 31), fine = fbm(N, M, 64, 8, 2, 37);
  const h = new Float32Array(N * M);
  // amassados: elipses alongadas
  const [dc, dx] = cnv(N, M); dx.fillStyle = '#808080'; dx.fillRect(0, 0, N, M);
  for (let k = 0; k < 70; k++) {
    const cx = r() * N, cy = r() * M, rx = 20 + r() * 90, ry = rx * (0.25 + r() * 0.6), a = r() * Math.PI, s = r() < 0.5 ? -1 : 1;
    for (const ox of [-N, 0, N]) for (const oy of [-M, 0, M]) {
      const g = dx.createRadialGradient(0, 0, 0, 0, 0, 1); const v = 128 + s * (10 + r() * 20);
      g.addColorStop(0, `rgba(${v},${v},${v},0.55)`); g.addColorStop(1, 'rgba(128,128,128,0)');
      dx.save(); dx.translate(cx + ox, cy + oy); dx.rotate(a); dx.scale(rx, ry); dx.fillStyle = g; dx.beginPath(); dx.arc(0, 0, 1, 0, 7); dx.fill(); dx.restore();
    }
  }
  const dd = dx.getImageData(0, 0, N, M).data;
  // marcas (riscos, digitais, escorridos)
  const [mc, mx] = cnv(N, M); mx.fillStyle = '#000'; mx.fillRect(0, 0, N, M); mx.lineCap = 'round';
  for (let k = 0; k < 160; k++) { const x = r() * N, y = r() * M, L = 10 + r() * 120, a = r() * Math.PI; mx.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.3})`; mx.lineWidth = 0.6 + r(); mx.beginPath(); mx.moveTo(x, y); mx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); mx.stroke(); }
  for (let k = 0; k < 14; k++) { const g = mx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); mx.save(); mx.translate(r() * N, r() * M); mx.rotate(r() * 3); mx.scale(30 + r() * 90, 14 + r() * 30); mx.fillStyle = g; mx.beginPath(); mx.arc(0, 0, 1, 0, 7); mx.fill(); mx.restore(); }
  const md = mx.getImageData(0, 0, N, M).data;
  const seamU = 0.0, seamV = 0.0; void seamU; void seamV;
  for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, u = x / N, v = y / M;
    // costura longitudinal em u≈0 (degrau de 1 mm: a folha de cima sobrepõe) e circunferencial em v≈0
    const du = u < 0.5 ? u : u - 1, dv = v < 0.5 ? v : v - 1;
    let s = 0;
    s += du > 0 ? -0.6 * sst(0.0, 0.006, du) : 0; // degrau
    s += 0.35 * Math.exp(-((dv * M) ** 2) / 6) - 0.25 * Math.exp(-(((dv - 0.012) * M) ** 2) / 10); // dobra circunferencial
    s += 0.5 * Math.exp(-(((Math.abs(dv) - 0.025) * M) ** 2) / 2); // friso de reforço
    s += (dd[i * 4] - 128) / 128 * 0.9 + (dent[i] - 0.5) * 0.5 + (fine[i] - 0.5) * 0.04;
    h[i] = s;
  }
  // rebites ao longo da costura longitudinal
  for (let k = 0; k < 10; k++) { const cy = (k + 0.5) * M / 10, cx = 6; for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) { const d2 = xx * xx + yy * yy; if (d2 < 16) { const ii = ((Math.round(cy) + yy + M) % M) * N + ((cx + xx + N) % N); h[ii] += 0.8 * Math.sqrt(1 - d2 / 16); } } }
  const alb = putGray(N, M, (i) => {
    const m = md[i * 4] / 255; const v = 0.88 + (big[i] - 0.5) * 0.04 + (blot[i] - 0.5) * 0.03 - m * 0.025;
    return [v * 0.995, v, v * 1.01];
  });
  const rough = putGray(N, M, (i) => { const m = md[i * 4] / 255; const v = 0.27 + (blot[i] - 0.5) * 0.08 + sst(0.55, 0.8, big[i]) * 0.05 + m * 0.12; return [1, v, 1]; });
  _clad = { map: tex(alb, { srgb: true }), rough: tex(rough), normal: normalFromHeight(h, N, M, 1.3) };
  return _clad;
}

// ───────────── inox escovado (u = circunferência, v = comprimento) ─────────────
let _steel = null;
export function steelTextures() {
  if (_steel) return _steel;
  const N = 512, M = 512, r = rng(71), col = new Float32Array(M);
  for (const [cells, amp] of [[512, 0.5], [256, 0.35], [128, 0.2], [64, 0.12]]) {
    const lat = Array.from({ length: cells }, () => r());
    for (let x = 0; x < M; x++) { const f = (x * cells) / M, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t); col[x] += (lat[i % cells] * (1 - s) + lat[(i + 1) % cells] * s) * amp; }
  }
  let mn = 1e9, mxv = -1e9; for (const v of col) { mn = Math.min(mn, v); mxv = Math.max(mxv, v); } for (let x = 0; x < M; x++) col[x] = (col[x] - mn) / (mxv - mn);
  const along = fbm(N, M, 64, 6, 3, 73), blot = fbm(N, M, 3, 3, 5, 79), heat = fbm(N, M, 2, 3, 4, 83);
  const [fc, fx] = cnv(N, M); fx.fillStyle = '#000'; fx.fillRect(0, 0, N, M); fx.lineCap = 'round';
  for (let k = 0; k < 260; k++) { const x = r() * N, y = r() * M, L = 8 + r() * 90, a = r() < 0.6 ? (r() - 0.5) * 0.4 : r() * Math.PI; fx.strokeStyle = `rgba(255,255,255,${0.12 + r() * 0.3})`; fx.lineWidth = 0.5 + r() * 0.7; fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); fx.stroke(); }
  // escorridos de condensado (mineral) — verticais em v? no costado são ao longo da circunferência (u)
  for (let k = 0; k < 40; k++) { const x = r() * N, y = r() * M, L = 30 + r() * 140; const g = fx.createLinearGradient(x, y, x + L, y); g.addColorStop(0, 'rgba(255,255,255,0.0)'); g.addColorStop(0.2, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); fx.strokeStyle = g; fx.lineWidth = 2 + r() * 4; fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + L, y + (r() - 0.5) * 6); fx.stroke(); }
  const fd = fx.getImageData(0, 0, N, M).data;
  const h = new Float32Array(N * M);
  const alb = putGray(N, M, (i) => {
    const y = (i / N) | 0, s = col[y] * (0.75 + 0.5 * along[i]) - 0.3 * along[i], f = fd[i * 4] / 255;
    const v = 0.86 + (s - 0.5) * 0.05 + (blot[i] - 0.5) * 0.06 - f * 0.05;
    const ht = sst(0.58, 0.82, heat[i]); // tom de calor: palha → bronze
    h[i] = s * 0.3 - f * 0.05;
    return [v + ht * 0.008, v - ht * 0.004, v - ht * 0.02];
  });
  const rough = putGray(N, M, (i) => { const y = (i / N) | 0, s = col[y], f = fd[i * 4] / 255; return [1, 0.2 + (s - 0.5) * 0.08 + (blot[i] - 0.5) * 0.1 + f * 0.2, 1]; });
  _steel = { map: tex(alb, { srgb: true }), rough: tex(rough), normal: normalFromHeight(h, N, M, 0.9) };
  return _steel;
}

// ───────────── tinta industrial (estrutura, bases, gabinetes): desgaste, poeira, riscos — tileável 2 m ─────────────
let _paint = null;
export function paintTextures() {
  if (_paint) return _paint;
  const N = 512, r = rng(5), n = fbm(N, N, 4, 4, 5, 7), f = fbm(N, N, 32, 32, 2, 9);
  const [mc, mx] = cnv(N); mx.fillStyle = '#000'; mx.fillRect(0, 0, N, N); mx.lineCap = 'round';
  for (let k = 0; k < 90; k++) { const x = r() * N, y = r() * N, L = 4 + r() * 40, a = r() * Math.PI; mx.strokeStyle = `rgba(255,255,255,${0.2 + r() * 0.5})`; mx.lineWidth = 0.5 + r() * 1.2; mx.beginPath(); mx.moveTo(x, y); mx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); mx.stroke(); }
  const md = mx.getImageData(0, 0, N, N).data; const h = new Float32Array(N * N);
  const alb = putGray(N, N, (i) => { const m = md[i * 4] / 255; const v = 1 - (n[i] - 0.5) * 0.12 - (f[i] - 0.5) * 0.05 - m * 0.18; h[i] = -m * 0.2 + f[i] * 0.05; return [v, v, v]; });
  const rough = putGray(N, N, (i) => [1, 0.45 + (n[i] - 0.5) * 0.25 + md[i * 4] / 255 * 0.2, 1]);
  _paint = { map: tex(alb, { srgb: true }), rough: tex(rough), normal: normalFromHeight(h, N, N, 2) };
  return _paint;
}

// ───────────── concreto/epóxi do piso: detalhe tileável (4 m) ─────────────
let _floor = null;
export function floorDetail() {
  if (_floor) return _floor;
  const N = 512, r = rng(41), n1 = fbm(N, N, 8, 8, 5, 43), n2 = fbm(N, N, 48, 48, 3, 47), n3 = fbm(N, N, 3, 3, 4, 53);
  const [mc, mx] = cnv(N); mx.fillStyle = '#000'; mx.fillRect(0, 0, N, N); mx.lineCap = 'round';
  for (let k = 0; k < 340; k++) { const x = r() * N, y = r() * N, L = 6 + r() * 80, a = r() * Math.PI; mx.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.3})`; mx.lineWidth = 0.4 + r() * 1.2; mx.beginPath(); mx.moveTo(x, y); mx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); mx.stroke(); }
  // poros/pites
  for (let k = 0; k < 900; k++) { mx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`; mx.beginPath(); mx.arc(r() * N, r() * N, 0.6 + r() * 1.6, 0, 7); mx.fill(); }
  const md = mx.getImageData(0, 0, N, N).data; const h = new Float32Array(N * N);
  // junta de dilatação na borda do tile (4 m → a cada 4 m)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, m = md[i * 4] / 255, jx = Math.min(x, N - 1 - x), jy = Math.min(y, N - 1 - y);
    h[i] = (n2[i] - 0.5) * 0.35 + (n1[i] - 0.5) * 0.2 - m * 0.25 - (jx < 2 || jy < 2 ? 1.2 : 0);
  }
  const det = putGray(N, N, (i) => { const m = md[i * 4] / 255; const x = i % N, y = (i / N) | 0, j = Math.min(x, N - 1 - x, y, N - 1 - y) < 2 ? 0.55 : 1; const v = (0.92 + (n1[i] - 0.5) * 0.14 + (n2[i] - 0.5) * 0.07 + (n3[i] - 0.5) * 0.1 - m * 0.08) * j; return [v, v, v]; });
  const rough = putGray(N, N, (i) => [1, 0.42 + (n3[i] - 0.5) * 0.3 + (n2[i] - 0.5) * 0.1 + md[i * 4] / 255 * 0.15, 1]);
  _floor = { det: tex(det, { srgb: true }), rough: tex(rough), normal: normalFromHeight(h, N, N, 1.6) };
  return _floor;
}

// ───────────── macro do piso (todo o galpão): cor base, faixas amarelas, manchas de óleo, poças, sujeira junto às bases ─────────────
// u: x ∈ [x0,x1], v: z ∈ [z0,z1] (v = 0 em z0). Retorna {map (sRGB), rough (G)}.
export function floorMacro() {
  const W = HALL2.x1 - HALL2.x0, D = HALL2.z1 - HALL2.z0, PX = 56; // 56 px/m
  const N = W * PX, M = D * PX; // 1664 × 1280
  const [c, x] = cnv(N, M), [rc, rx] = cnv(N, M);
  const X = (wx) => (wx - HALL2.x0) * PX, Z = (wz) => (wz - HALL2.z0) * PX, S = (m) => m * PX;
  const r = rng(77);
  x.fillStyle = '#8d8f8c'; x.fillRect(0, 0, N, M);
  rx.fillStyle = 'rgb(255,92,255)'; rx.fillRect(0, 0, N, M); // rugosidade base ~0.36 (epóxi gasto)
  // mosqueado amplo
  for (let k = 0; k < 1100; k++) {
    const px = r() * N, py = r() * M, rr = S(0.4 + r() * 2.2), dk = r() < 0.5;
    const g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, dk ? `rgba(52,50,44,${0.07 + r() * 0.12})` : `rgba(190,192,186,${0.05 + r() * 0.07})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  // zonas de equipamento: epóxi verde (como FOTO 5) sob as caldeiras e o trocador, com borda
  const zone = (x0, z0, x1, z1) => {
    x.fillStyle = 'rgba(66,112,92,0.92)'; x.fillRect(X(x0), Z(z0), S(x1 - x0), S(z1 - z0));
    rx.fillStyle = 'rgb(255,60,255)'; rx.fillRect(X(x0), Z(z0), S(x1 - x0), S(z1 - z0));
  };
  for (const b of BOILERS.filter((b) => b.kind === 'flamotubular')) zone(b.c[0] - 1.75, b.c[2] - b.L / 2 - 0.6, b.c[0] + 1.75, b.c[2] + b.L / 2 - 0.15);
  // faixas amarelas de demarcação (10 cm) — corredores e contornos
  const lineW = S(0.1);
  const yline = (x0, z0, x1, z1) => {
    x.strokeStyle = 'rgba(226,182,22,0.95)'; x.lineWidth = lineW; x.lineCap = 'butt'; x.beginPath(); x.moveTo(X(x0), Z(z0)); x.lineTo(X(x1), Z(z1)); x.stroke();
    rx.strokeStyle = 'rgb(255,70,255)'; rx.lineWidth = lineW; rx.beginPath(); rx.moveTo(X(x0), Z(z0)); rx.lineTo(X(x1), Z(z1)); rx.stroke();
  };
  const rect = (x0, z0, x1, z1) => { yline(x0, z0, x1, z0); yline(x1, z0, x1, z1); yline(x1, z1, x0, z1); yline(x0, z1, x0, z0); };
  for (const b of BOILERS.filter((b) => b.kind === 'flamotubular')) rect(b.c[0] - 1.85, b.c[2] - b.L / 2 - 0.7, b.c[0] + 1.85, b.c[2] + b.L / 2 - 0.05);
  const tr = BOILERS.find((b) => b.id === 'trocador'); rect(tr.c[0] - tr.L / 2 - 0.55, tr.c[2] - 0.95, tr.c[0] + tr.L / 2 + 0.55, tr.c[2] + 0.95);
  const de = BOILERS.find((b) => b.id === 'desaerador'); rect(de.c[0] - 1.45, de.c[2] - 1.45, HALL2.x1 - 0.3, de.c[2] + 2.2);
  // corredor principal (faixa dupla) paralelo a x em z ≈ 0,9 e 3,9
  yline(31.0, 0.55, 49.0, 0.55); yline(31.0, 4.1, 47.8, 4.1);
  // contorno da sala de controle
  const C = CONTROL_ROOM; rect(C.x0 - 0.15, C.z0 - 0.15, C.x1 + 0.1, C.z1 + 0.1);
  // zebrado diante dos painéis (área de acesso livre)
  const zebra = (x0, z0, x1, z1) => {
    x.save(); x.beginPath(); x.rect(X(x0), Z(z0), S(x1 - x0), S(z1 - z0)); x.clip();
    x.fillStyle = 'rgba(226,182,22,0.92)'; x.fillRect(X(x0), Z(z0), S(x1 - x0), S(z1 - z0));
    x.fillStyle = 'rgba(25,25,25,0.92)'; const w = S(0.12);
    for (let t = -S(4); t < S(4) + S(x1 - x0); t += w * 2) { x.beginPath(); x.moveTo(X(x0) + t, Z(z0)); x.lineTo(X(x0) + t + w, Z(z0)); x.lineTo(X(x0) + t + w - S(z1 - z0), Z(z1)); x.lineTo(X(x0) + t - S(z1 - z0), Z(z1)); x.fill(); }
    x.restore();
  };
  // quadrados dos extintores (vermelho com borda amarela, NR-23/IT)
  for (const [ex, ez] of [[30.75, -3.0], [55.3, 1.5], [45.6, 9.3], [54.95, -8.95], [36.0, 9.35]]) {
    x.fillStyle = 'rgba(178,30,26,0.95)'; x.fillRect(X(ex - 0.5), Z(ez - 0.5), S(1), S(1));
    x.strokeStyle = 'rgba(226,182,22,1)'; x.lineWidth = S(0.1); x.strokeRect(X(ex - 0.45), Z(ez - 0.45), S(0.9), S(0.9));
    rx.fillStyle = 'rgb(255,70,255)'; rx.fillRect(X(ex - 0.5), Z(ez - 0.5), S(1), S(1));
  }
  zebra(33.9, -0.95, 35.3, -0.6);
  // sujeira/fuligem junto às bases e manchas de óleo sob os queimadores e bombas
  const stain = (wx, wz, rad, a, col = '30,26,20') => { const g = x.createRadialGradient(X(wx), Z(wz), 0, X(wx), Z(wz), S(rad)); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.6, `rgba(${col},${a * 0.45})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.beginPath(); x.ellipse(X(wx), Z(wz), S(rad), S(rad * (0.6 + r() * 0.5)), r() * 3, 0, 7); x.fill(); };
  for (const b of BOILERS.filter((b) => b.kind === 'flamotubular')) { stain(b.c[0], b.c[2] + b.L / 2 + 0.25, 0.7, 0.3); stain(b.c[0] + 0.4, b.c[2] + b.L / 2 + 0.1, 0.35, 0.35, '20,18,14'); for (let k = 0; k < 6; k++) stain(b.c[0] + (r() - 0.5) * 2.6, b.c[2] + (r() - 0.5) * 5, 0.3 + r() * 0.5, 0.12 + r() * 0.12); }
  for (let k = 0; k < 90; k++) stain(HALL2.x0 + 1 + r() * (W - 2), HALL2.z0 + 1 + r() * (D - 2), 0.15 + r() * 0.6, 0.05 + r() * 0.1);
  // poça de condensado sob o vazamento da gaxeta (molhado: escuro e espelhado) + rastro até o ralo
  const lk = LEAKS.find((l) => l.id === 'purgador');
  const wet = (wx, wz, rx0, rz0, a) => {
    const g = x.createRadialGradient(X(wx), Z(wz), 0, X(wx), Z(wz), S(Math.max(rx0, rz0)));
    g.addColorStop(0, `rgba(40,42,40,${a})`); g.addColorStop(0.75, `rgba(40,42,40,${a * 0.8})`); g.addColorStop(1, 'rgba(40,42,40,0)');
    x.fillStyle = g; x.beginPath(); x.ellipse(X(wx), Z(wz), S(rx0), S(rz0), 0.3, 0, 7); x.fill();
    const gr = rx.createRadialGradient(X(wx), Z(wz), 0, X(wx), Z(wz), S(Math.max(rx0, rz0)));
    gr.addColorStop(0, 'rgba(255,8,255,1)'); gr.addColorStop(0.8, 'rgba(255,14,255,0.9)'); gr.addColorStop(1, 'rgba(255,90,255,0)');
    rx.fillStyle = gr; rx.beginPath(); rx.ellipse(X(wx), Z(wz), S(rx0), S(rz0), 0.3, 0, 7); rx.fill();
  };
  wet(lk.pos[0] + 0.05, -8.2, 0.75, 0.45, 0.42); wet(lk.pos[0] + 0.35, -8.7, 0.35, 0.25, 0.35); wet(lk.pos[0] - 0.4, -8.0, 0.25, 0.18, 0.3);
  wet(53.6, -5.3, 0.35, 0.25, 0.3);
  // mais vida: manchas d'água das purgas/descargas, ferrugem sob suportes, marcas de paleteira, poeira junto às paredes
  for (const b of BOILERS.filter((q) => q.kind === 'flamotubular')) { wet(b.c[0] + 0.1, -9.0, 0.45, 0.3, 0.32); wet(b.c[0] - 1.6, b.c[2] + b.L / 2 - 1.2, 0.3, 0.22, 0.25); wet(b.c[0] - 0.95, b.c[2] + b.L / 2 + 0.15, 0.22, 0.16, 0.3); }
  for (const [px, pz] of [[51.7, -4.0], [53.5, -4.0]]) { wet(px - 0.4, pz + 0.35, 0.4, 0.25, 0.3); stain(px + 0.3, pz, 0.35, 0.3, '24,22,18'); }
  wet(49.45, -8.6, 0.25, 0.5, 0.35); wet(51.6, 2.0, 0.4, 0.3, 0.22); wet(53.6, -5.6, 0.5, 0.3, 0.28);
  for (const x of [44.4, 47.4, 50.7]) stain(x, -8.25, 0.18, 0.35, '96,54,26');
  x.lineCap = 'round';
  for (let k = 0; k < 14; k++) { const x0 = X(32 + r() * 20), z0 = Z(0.6 + r() * 3.4), L = S(2 + r() * 5), a = (r() - 0.5) * 0.5; x.strokeStyle = `rgba(30,30,28,${0.05 + r() * 0.06})`; x.lineWidth = S(0.06); x.beginPath(); x.moveTo(x0, z0); x.quadraticCurveTo(x0 + L * 0.5, z0 + Math.sin(a) * L * 0.3, x0 + L * Math.cos(a), z0 + L * Math.sin(a)); x.stroke(); x.beginPath(); x.moveTo(x0, z0 + S(0.5)); x.quadraticCurveTo(x0 + L * 0.5, z0 + S(0.5) + Math.sin(a) * L * 0.3, x0 + L * Math.cos(a), z0 + S(0.5) + L * Math.sin(a)); x.stroke(); }
  for (const [ax, az, bx, bz] of [[HALL2.x0, HALL2.z0, HALL2.x1, HALL2.z0 + 0.6], [HALL2.x0, HALL2.z0, HALL2.x0 + 0.6, HALL2.z1], [HALL2.x1 - 0.6, HALL2.z0, HALL2.x1, HALL2.z1], [HALL2.x0, HALL2.z1 - 0.6, HALL2.x1, HALL2.z1]]) { x.fillStyle = 'rgba(70,66,58,0.12)'; x.fillRect(X(ax), Z(az), S(bx - ax), S(bz - az)); }
  // canaleta de drenagem ao longo da parede do fundo (z ≈ −9,55) — grelha desenhada
  x.fillStyle = '#2c2d2c'; x.fillRect(X(31.0), Z(-9.7), S(24), S(0.25));
  for (let gx = X(31.0); gx < X(55); gx += S(0.035)) { x.fillStyle = 'rgba(150,152,150,0.9)'; x.fillRect(gx, Z(-9.68), S(0.012), S(0.21)); }
  rx.fillStyle = 'rgb(255,120,255)'; rx.fillRect(X(31.0), Z(-9.7), S(24), S(0.25));
  // ralo quadrado sob a poça
  x.fillStyle = '#2a2b2a'; x.fillRect(X(49.25), Z(-8.95), S(0.25), S(0.25)); x.strokeStyle = '#9a9c9a'; x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(X(49.27) + k * S(0.04), Z(-8.93)); x.lineTo(X(49.27) + k * S(0.04), Z(-8.72)); x.stroke(); }
  // faixas amarelas: texto "ÁREA RESTRITA — CALDEIRAS" no piso diante das caldeiras
  x.save(); x.fillStyle = 'rgba(226,182,22,0.85)'; x.font = `900 ${S(0.32)}px Arial, sans-serif`; x.textAlign = 'center';
  x.translate(X(39.5), Z(0.15)); x.fillText('ÁREA RESTRITA', 0, 0); x.restore();
  const map = tex(c, { srgb: true, rep: false }), rough = tex(rc, { rep: false });
  return { map, rough };
}

// ───────────── painel de fechamento trapezoidal (parede): tileável 1 m (u) × 1 m (v) ─────────────
let _wall = null;
export function wallTextures() {
  if (_wall) return _wall;
  const N = 512, h = new Float32Array(N * N), n = fbm(N, N, 4, 8, 4, 61), st = fbm(N, N, 24, 2, 3, 63);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * 4 % 1; // 4 nervuras por metro (passo 250 mm)
    const p = u < 0.18 ? 1 : u < 0.26 ? 1 - (u - 0.18) / 0.08 : u < 0.92 ? 0 : (u - 0.92) / 0.08; // trapézio
    h[y * N + x] = p * 3 + (n[y * N + x] - 0.5) * 0.1;
  }
  const alb = putGray(N, N, (i) => { const v = 0.84 + (n[i] - 0.5) * 0.06 - sst(0.55, 0.8, st[i]) * 0.05; return [v, v * 1.005, v * 1.01]; });
  const rough = putGray(N, N, (i) => [1, 0.48 + (n[i] - 0.5) * 0.15, 1]);
  _wall = { map: tex(alb, { srgb: true }), rough: tex(rough), normal: normalFromHeight(h, N, N, 1.2) };
  return _wall;
}
// telha trapezoidal do telhado (vista de baixo) — nervuras ao longo de z
let _roof = null;
export function roofTextures() {
  if (_roof) return _roof;
  const N = 512, h = new Float32Array(N * N), n = fbm(N, N, 3, 6, 4, 67);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = (x / N) * 3 % 1; h[y * N + x] = (u < 0.2 ? 1 : u < 0.3 ? 1 - (u - 0.2) / 0.1 : u < 0.9 ? 0 : (u - 0.9) / 0.1) * 3; }
  const alb = putGray(N, N, (i) => { const v = 0.62 + (n[i] - 0.5) * 0.12; return [v, v, v * 1.02]; });
  _roof = { map: tex(alb, { srgb: true }), normal: normalFromHeight(h, N, N, 1.4) };
  return _roof;
}

// ───────────── exterior visto pelas janelas (emissivo, superexposto como nas fotos) ─────────────
export function outsideTexture(seed = 3) {
  const W = 1024, H = 512, [c, x] = cnv(W, H), r = rng(seed);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f4f7fa'); g.addColorStop(0.55, '#e9eef2'); g.addColorStop(1, '#d9dfe2'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // silhuetas desbotadas: galpão vizinho, árvores, postes (contraluz na névoa clara)
  x.fillStyle = 'rgba(170,180,186,0.45)';
  for (let k = 0; k < 6; k++) { const bx = r() * W, bw = 120 + r() * 300, bh = 60 + r() * 120; x.fillRect(bx, H * 0.78 - bh, bw, bh + H); }
  // copas de árvores muito desbotadas (contraluz), em faixa irregular
  x.fillStyle = 'rgba(176,186,178,0.22)';
  for (let k = 0; k < 160; k++) { const tx = r() * W, ty = H * (0.66 + r() * 0.1) + Math.sin(tx * 0.01) * 12, tr = 6 + r() * 16; x.beginPath(); x.arc(tx, ty, tr, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(140,150,156,0.35)'; for (let k = 0; k < 4; k++) { const px = r() * W; x.fillRect(px, H * 0.3, 4, H); }
  const t = tex(c, { srgb: true, rep: true }); t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// ───────────── vidro das janelas: sujeira/fuligem (alfa) ─────────────
export function glassGrime() {
  const N = 256, n = fbm(N, N, 4, 4, 5, 101), [c, x] = cnv(N), img = x.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const y = (i / N) | 0; const v = 0.12 + n[i] * 0.25 + (y / N) * 0.12; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v * 255; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); return tex(c);
}

// ───────────── manômetro (mostrador branco, escala 0–16 kgf/cm², faixa vermelha acima da PMTA) ─────────────
export function gaugeFace({ max = 16, red = 10.5, unit = 'kgf/cm²', label = '' } = {}) {
  const S = 256, [c, x] = cnv(S), cx = S / 2, R = S * 0.47;
  x.fillStyle = '#f4f3ee'; x.beginPath(); x.arc(cx, cx, R, 0, 7); x.fill();
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (v) => a0 + (a1 - a0) * (v / max);
  x.lineWidth = S * 0.05; x.strokeStyle = '#c4231c'; x.beginPath(); x.arc(cx, cx, R * 0.8, ang(red), ang(max)); x.stroke();
  x.lineWidth = S * 0.05; x.strokeStyle = '#2f8a3a'; x.beginPath(); x.arc(cx, cx, R * 0.8, ang(max * 0.35), ang(red * 0.96)); x.stroke();
  x.strokeStyle = '#111'; x.fillStyle = '#111';
  for (let v = 0; v <= max * 2; v++) { const a = ang(v / 2), big = v % 4 === 0, L = big ? R * 0.17 : R * 0.09; x.lineWidth = big ? 3 : 1.5; x.beginPath(); x.moveTo(cx + Math.cos(a) * R * 0.9, cx + Math.sin(a) * R * 0.9); x.lineTo(cx + Math.cos(a) * (R * 0.9 - L), cx + Math.sin(a) * (R * 0.9 - L)); x.stroke(); }
  x.font = `700 ${S * 0.085}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let v = 0; v <= max; v += 2) { const a = ang(v); x.fillText(String(v), cx + Math.cos(a) * R * 0.58, cx + Math.sin(a) * R * 0.58); }
  x.font = `600 ${S * 0.06}px Arial, sans-serif`; x.fillText(unit, cx, cx + R * 0.36); if (label) { x.font = `600 ${S * 0.05}px Arial, sans-serif`; x.fillText(label, cx, cx - R * 0.3); }
  x.fillStyle = '#222'; x.beginPath(); x.arc(cx, cx, S * 0.035, 0, 7); x.fill();
  const t = tex(c, { srgb: true, rep: false }); return { tex: t, ang: (v) => -(a0 + (a1 - a0) * (v / max)) };
}

// ───────────── placas ─────────────
function wrapText(x, text, X, Y, maxW, lh) { const words = text.split(' '); let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { x.fillText(line, X, Y); Y += lh; line = w; } else line = t; } if (line) x.fillText(line, X, Y); return Y; }
// placa de identificação NR-13 (aço inox gravado), 13.4.1.3 a)–h) + categoria
export function nr13Plate({ tag = 'CALDEIRA 1', serie = '0417/2016', cap = '3.000 kg/h', area = '92,0 m²' } = {}) {
  const W = 512, H = 352, [c, x] = cnv(W, H), r = rng(serie.length * 31);
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#c9ccce'); g.addColorStop(0.5, '#e3e5e6'); g.addColorStop(1, '#b9bcbe'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let k = 0; k < 300; k++) { x.strokeStyle = `rgba(255,255,255,${r() * 0.15})`; x.beginPath(); const yy = r() * H; x.moveTo(0, yy); x.lineTo(W, yy + (r() - 0.5) * 3); x.stroke(); }
  x.strokeStyle = '#333'; x.lineWidth = 4; x.strokeRect(10, 10, W - 20, H - 20);
  x.fillStyle = '#1c1c1c'; for (const [px, py] of [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]]) { x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill(); }
  x.textAlign = 'center'; x.font = '900 30px Arial, sans-serif'; x.fillText('PLACA DE IDENTIFICAÇÃO — NR-13', W / 2, 52);
  x.font = '800 24px Arial, sans-serif'; x.fillText(`${tag} — FLAMOTUBULAR — CATEGORIA B`, W / 2, 86);
  x.textAlign = 'left'; x.font = '600 19px Arial, sans-serif';
  const rows = [['Fabricante', 'Caldeiraria Industrial (ver prontuário)'], ['Nº de ordem / série', serie], ['Ano de fabricação', '2016'], ['PMTA', '10,5 kgf/cm² (1,03 MPa)'],
    ['Pressão teste hidrostático', '15,8 kgf/cm²'], ['Produção de vapor', cap], ['Superfície de aquecimento', area], ['Código de projeto', 'ASME Sec. I — ed. 2015']];
  rows.forEach(([k, v], i) => { const y = 122 + i * 27; x.fillStyle = '#2a2a2a'; x.fillText(k, 30, y); x.fillStyle = '#111'; x.font = '700 19px Arial, sans-serif'; x.fillText(v, 262, y); x.font = '600 19px Arial, sans-serif'; });
  return tex(c, { srgb: true, rep: false });
}
// sinal de segurança: kind = 'quente' | 'auricular' | 'capacete' | 'restrito' | 'cat' | 'saida' | 'extintor' | 'operador' | 'luvas'
export function signTexture(kind, text2) {
  const W = 512, H = 640, [c, x] = cnv(W, H); x.fillStyle = '#fbfbf7'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#d8d8d2'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const band = (col, txt, tcol = '#fff') => { x.fillStyle = col; x.fillRect(0, 0, W, 120); x.fillStyle = tcol; x.font = '900 70px Arial, sans-serif'; x.fillText(txt, W / 2, 64); };
  const foot = (lines, size = 46) => { x.fillStyle = '#111'; x.font = `900 ${size}px Arial, sans-serif`; lines.forEach((l, i) => x.fillText(l, W / 2, 470 + i * (size + 10))); };
  if (kind === 'quente') {
    band('#f2c200', 'CUIDADO', '#111');
    x.fillStyle = '#f2c200'; x.strokeStyle = '#111'; x.lineWidth = 16; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(W / 2, 150); x.lineTo(W / 2 + 165, 420); x.lineTo(W / 2 - 165, 420); x.closePath(); x.fill(); x.stroke();
    // símbolo superfície quente (ISO 7010 W017): linha + 3 ondas
    x.lineWidth = 10; x.beginPath(); x.moveTo(W / 2 - 80, 385); x.lineTo(W / 2 + 80, 385); x.stroke();
    for (let k = -1; k <= 1; k++) { x.beginPath(); for (let t = 0; t <= 1; t += 0.05) { const yy = 365 - t * 140, xx = W / 2 + k * 42 + Math.sin(t * Math.PI * 2.5) * 12; t === 0 ? x.moveTo(xx, yy) : x.lineTo(xx, yy); } x.stroke(); }
    foot(['SUPERFÍCIE', 'QUENTE']);
  } else if (kind === 'auricular' || kind === 'capacete' || kind === 'luvas') {
    band('#1d4f9c', 'OBRIGATÓRIO');
    x.fillStyle = '#1d5fb8'; x.beginPath(); x.arc(W / 2, 290, 150, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    if (kind === 'auricular') { // cabeça com abafador
      x.beginPath(); x.ellipse(W / 2, 300, 62, 80, 0, 0, 7); x.fill();
      x.fillStyle = '#1d5fb8'; x.beginPath(); x.ellipse(W / 2, 300, 50, 68, 0, 0, 7); x.fill(); x.fillStyle = '#fff';
      x.lineWidth = 16; x.beginPath(); x.arc(W / 2, 290, 90, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
      x.fillRect(W / 2 - 112, 262, 40, 76); x.fillRect(W / 2 + 72, 262, 40, 76);
      foot(['USO DE PROTETOR', 'AURICULAR'], 42);
    } else if (kind === 'capacete') {
      x.beginPath(); x.arc(W / 2, 320, 95, Math.PI, 0); x.fill(); x.fillRect(W / 2 - 125, 316, 250, 22); x.fillStyle = '#1d5fb8'; x.fillRect(W / 2 - 6, 228, 12, 90);
      foot(['USO DE', 'CAPACETE']);
    } else {
      x.beginPath(); x.ellipse(W / 2, 300, 55, 75, 0, 0, 7); x.fill(); for (let k = 0; k < 4; k++) x.fillRect(W / 2 - 52 + k * 28, 190, 20, 80); x.fillRect(W / 2 + 40, 260, 70, 22);
      foot(['USO DE LUVAS', 'TÉRMICAS'], 42);
    }
  } else if (kind === 'restrito') {
    band('#c4231c', 'PERIGO');
    x.fillStyle = '#111'; x.font = '900 54px Arial, sans-serif'; x.fillText('CASA DE', W / 2, 220); x.fillText('CALDEIRAS', W / 2, 285);
    x.font = '700 38px Arial, sans-serif'; x.fillText('ACESSO RESTRITO', W / 2, 380); x.fillText('A PESSOAS', W / 2, 425); x.fillText('AUTORIZADAS', W / 2, 470);
    x.font = '600 30px Arial, sans-serif'; x.fillText('NR-13', W / 2, 560);
  } else if (kind === 'operador') {
    band('#1d4f9c', 'ATENÇÃO');
    x.fillStyle = '#111'; x.font = '800 44px Arial, sans-serif';
    wrapText(x, 'OPERAÇÃO SOMENTE POR OPERADOR DE CALDEIRA CAPACITADO (NR-13, ANEXO I)', W / 2, 230, W - 70, 58);
  } else if (kind === 'cat') { // identificação pintada (13.4.1.4)
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.fillStyle = '#111'; x.font = '900 92px Arial, sans-serif'; x.fillText(text2 || 'CALD-01', W / 2, 250); x.font = '800 60px Arial, sans-serif'; x.fillText('CAT. B', W / 2, 380);
  } else if (kind === 'saida') {
    x.fillStyle = '#138a3e'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff'; x.font = '900 96px Arial, sans-serif'; x.fillText('SAÍDA', W / 2, 260);
    x.lineWidth = 26; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(110, 440); x.lineTo(380, 440); x.moveTo(300, 360); x.lineTo(390, 440); x.lineTo(300, 520); x.stroke();
  } else if (kind === 'extintor') {
    x.fillStyle = '#c4231c'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff';
    x.beginPath(); roundRect(x, W / 2 - 60, 170, 120, 300, 50); x.fill(); x.fillRect(W / 2 - 22, 120, 44, 60); x.fillRect(W / 2 + 20, 130, 90, 22);
    x.font = '900 64px Arial, sans-serif'; x.fillText('EXTINTOR', W / 2, 560);
  }
  return tex(c, { srgb: true, rep: false });
}

// ───────────── IHM (painel da caldeira / sala de controle) — desenhada a cada atualização ─────────────
export function drawHMI(x, W, H, s, kind = 'cald') {
  // s: {p, lvl, flame, mod, tgas, tfeed, flow, alarm, t, id}
  x.fillStyle = '#0e1f33'; x.fillRect(0, 0, W, H);
  const k = W / 512;
  x.fillStyle = '#1f4a7a'; x.fillRect(0, 0, W, 38 * k); x.fillStyle = '#fff'; x.font = `800 ${20 * k}px Arial, sans-serif`; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(kind === 'cald' ? `CALDEIRA ${s.id} — VISÃO GERAL` : 'SUPERVISÓRIO — CASA DE CALDEIRAS', 10 * k, 19 * k);
  x.textAlign = 'right'; x.font = `600 ${16 * k}px Arial, sans-serif`; x.fillText(s.clock || '07:32:10', W - 10 * k, 19 * k);
  if (kind === 'cald') {
    // sinótico: caldeira com nível
    const bx = 18 * k, by = 70 * k, bw = 250 * k, bh = 120 * k;
    x.strokeStyle = '#9fb3c8'; x.lineWidth = 3 * k; roundRect(x, bx, by, bw, bh, bh / 2); x.stroke();
    x.save(); roundRect(x, bx, by, bw, bh, bh / 2); x.clip(); x.fillStyle = '#2b78c4'; x.fillRect(bx, by + bh * (1 - s.lvl), bw, bh); x.restore();
    x.fillStyle = s.flame ? '#ff8a1c' : '#444'; x.beginPath(); x.moveTo(bx + 30 * k, by + bh * 0.78); x.lineTo(bx + 110 * k, by + bh * 0.7); x.lineTo(bx + 30 * k, by + bh * 0.62); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 ${15 * k}px Arial, sans-serif`; x.fillText(`NÍVEL ${Math.round(s.lvl * 100)} %`, bx + bw / 2, by + bh + 22 * k);
    const box = (X, Y, lbl, val, un, col = '#33e07a') => {
      x.fillStyle = '#081322'; x.fillRect(X, Y, 205 * k, 62 * k); x.strokeStyle = '#2d5a8a'; x.lineWidth = 2 * k; x.strokeRect(X, Y, 205 * k, 62 * k);
      x.textAlign = 'left'; x.fillStyle = '#9fb3c8'; x.font = `700 ${13 * k}px Arial, sans-serif`; x.fillText(lbl, X + 8 * k, Y + 15 * k);
      x.fillStyle = col; x.font = `800 ${28 * k}px Arial, sans-serif`; x.fillText(val, X + 8 * k, Y + 42 * k); x.fillStyle = '#cfe0f0'; x.font = `600 ${14 * k}px Arial, sans-serif`; x.fillText(un, X + 140 * k, Y + 44 * k);
    };
    box(290 * k, 52 * k, 'PRESSÃO DE VAPOR', s.p.toFixed(1), 'kgf/cm²');
    box(290 * k, 122 * k, 'TEMP. GASES CHAMINÉ', String(Math.round(s.tgas)), '°C', '#ffd23a');
    box(290 * k, 192 * k, 'CARGA QUEIMADOR', String(Math.round(s.mod)), '%', '#7ec8ff');
    x.textAlign = 'left'; x.font = `700 ${15 * k}px Arial, sans-serif`;
    const st = [['CHAMA', s.flame ? 'OK' : 'APAGADA', s.flame ? '#33e07a' : '#ff4040'], ['BOMBA ALIM.', 'LIGADA', '#33e07a'], ['ÁGUA ALIM.', `${Math.round(s.tfeed)} °C`, '#cfe0f0']];
    st.forEach(([a, b, col], i) => { x.fillStyle = '#9fb3c8'; x.fillText(a, 20 * k, (232 + i * 24) * k); x.fillStyle = col; x.fillText(b, 140 * k, (232 + i * 24) * k); });
    x.fillStyle = s.alarm ? '#b3261e' : '#14324f'; x.fillRect(0, H - 34 * k, W, 34 * k); x.fillStyle = '#fff'; x.font = `700 ${14 * k}px Arial, sans-serif`;
    x.fillText(s.alarm ? '⚠ ALARME: VAZAMENTO DE VAPOR — GAXETA V-07' : 'SEM ALARMES ATIVOS', 10 * k, H - 17 * k);
  } else {
    // supervisório: duas caldeiras + coletor + tendências
    for (let i = 0; i < 2; i++) {
      const bx = (16 + i * 250) * k, by = 54 * k; const b = s.b[i];
      x.fillStyle = '#081322'; x.fillRect(bx, by, 236 * k, 110 * k); x.strokeStyle = '#2d5a8a'; x.lineWidth = 2 * k; x.strokeRect(bx, by, 236 * k, 110 * k);
      x.fillStyle = '#fff'; x.textAlign = 'left'; x.font = `800 ${15 * k}px Arial, sans-serif`; x.fillText(`CALDEIRA ${i + 1}`, bx + 8 * k, by + 16 * k);
      x.fillStyle = b.flame ? '#33e07a' : '#ff4040'; x.beginPath(); x.arc(bx + 220 * k, by + 16 * k, 7 * k, 0, 7); x.fill();
      x.font = `800 ${26 * k}px Arial, sans-serif`; x.fillStyle = '#33e07a'; x.fillText(`${b.p.toFixed(1)} kgf/cm²`, bx + 8 * k, by + 48 * k);
      x.font = `700 ${14 * k}px Arial, sans-serif`; x.fillStyle = '#cfe0f0'; x.fillText(`Nível ${Math.round(b.lvl * 100)} %   Carga ${Math.round(b.mod)} %`, bx + 8 * k, by + 76 * k); x.fillText(`Gases ${Math.round(b.tgas)} °C`, bx + 8 * k, by + 96 * k);
    }
    // tendência de pressão
    const gx = 16 * k, gy = 178 * k, gw = 480 * k, gh = 110 * k; x.fillStyle = '#081322'; x.fillRect(gx, gy, gw, gh); x.strokeStyle = '#21405f'; x.lineWidth = 1;
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(gx, gy + gh * i / 4); x.lineTo(gx + gw, gy + gh * i / 4); x.stroke(); }
    x.strokeStyle = '#33e07a'; x.lineWidth = 2 * k; x.beginPath(); for (let i = 0; i <= 120; i++) { const v = Math.sin(i * 0.17 + s.t * 0.3) * 0.25 + Math.sin(i * 0.05 + 1.3) * 0.2; const X = gx + gw * i / 120, Y = gy + gh * (0.45 - v * 0.6); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
    x.strokeStyle = '#ffd23a'; x.beginPath(); for (let i = 0; i <= 120; i++) { const v = Math.sin(i * 0.11 + s.t * 0.2 + 2) * 0.2; const X = gx + gw * i / 120, Y = gy + gh * (0.7 - v * 0.6); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
    x.fillStyle = '#9fb3c8'; x.font = `600 ${12 * k}px Arial, sans-serif`; x.textAlign = 'left'; x.fillText('Pressão coletor (verde)  ·  Vazão de vapor (amarelo) — 60 min', gx + 6 * k, gy + 12 * k);
    x.fillStyle = s.alarm ? '#b3261e' : '#14324f'; x.fillRect(0, H - 34 * k, W, 34 * k); x.fillStyle = '#fff'; x.font = `700 ${14 * k}px Arial, sans-serif`;
    x.fillText(s.alarm ? '⚠ VAZAMENTO DE VAPOR — GAXETA V-07 (DISTRIBUIDOR)   ⚠ NÍVEL DE RUÍDO ELEVADO' : 'SEM ALARMES', 10 * k, H - 17 * k);
  }
}

// ───────────── sprites de vapor: atlas 2×2 de tufos suaves (alfa em R, "normal" de volume em G/B) ─────────────
export function puffAtlas() {
  const S = 256, N = S * 2, [c, x] = cnv(N), img = x.createImageData(N, N), d = img.data;
  for (let q = 0; q < 4; q++) {
    const n = fbm(S, S, 4, 4, 5, 300 + q * 13), n2 = fbm(S, S, 9, 9, 3, 400 + q * 7), ox = (q % 2) * S, oy = ((q / 2) | 0) * S;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const u = xx / S * 2 - 1, v = y / S * 2 - 1, rr = Math.hypot(u, v);
      const i = y * S + xx, w = (n[i] - 0.5) * 0.9 + (n2[i] - 0.5) * 0.35;
      const a = clamp01(sst(1.0, 0.25, rr + w * 0.55)) * (0.65 + n[i] * 0.5);
      const o = ((oy + y) * N + ox + xx) * 4;
      // G: "iluminação de cima" (mais claro no topo), B: espessura
      d[o] = clamp01(a) * 255; d[o + 1] = clamp01(0.5 - v * 0.35 + (n2[i] - 0.5) * 0.5) * 255; d[o + 2] = clamp01(a * 1.1) * 255; d[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0); const t = tex(c, { rep: false }); t.generateMipmaps = true; return t;
}

// ───────────── visor de chama (fornalha): disco laranja turbulento ─────────────
export function flameTexture() {
  const S = 128, n = fbm(S, S, 5, 5, 4, 211), [c, x] = cnv(S), img = x.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const xx = i % S, y = (i / S) | 0, rr = Math.hypot(xx / S - 0.5, y / S - 0.5) * 2; const v = clamp01(1.2 - rr) * (0.55 + n[i] * 0.8); img.data[i * 4] = 255 * clamp01(v * 1.4); img.data[i * 4 + 1] = 255 * clamp01(v * 0.8); img.data[i * 4 + 2] = 255 * clamp01(v * 0.25); img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); return tex(c, { srgb: true, rep: false });
}
// gabinete: grade de ventilação / etiquetas — textura do painel de comando (botões desenhados)
export function panelFront(label = 'CALDEIRA 1') {
  const W = 512, H = 640, [c, x] = cnv(W, H), n = fbm(128, 160, 4, 4, 3, 99);
  x.fillStyle = '#c3c7c4'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 128 * 160; i++) { const v = (n[i] - 0.5) * 14; x.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`; x.fillRect((i % 128) * 4, ((i / 128) | 0) * 4, 4, 4); }
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.strokeRect(14, 14, W - 28, H - 28);
  // etiqueta
  x.fillStyle = '#fafafa'; x.fillRect(150, 40, 212, 40); x.fillStyle = '#111'; x.font = '800 24px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, W / 2, 61);
  // área da IHM (preto — a tela real é outro mesh)
  x.fillStyle = '#1a1c1e'; x.fillRect(96, 104, 320, 248);
  // botões e sinaleiros
  const btn = (X, Y, col, lbl, ring = '#333') => { x.fillStyle = ring; x.beginPath(); x.arc(X, Y, 24, 0, 7); x.fill(); const g = x.createRadialGradient(X - 6, Y - 6, 2, X, Y, 20); g.addColorStop(0, '#fff'); g.addColorStop(0.25, col); g.addColorStop(1, col); x.fillStyle = g; x.beginPath(); x.arc(X, Y, 18, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '700 14px Arial, sans-serif'; x.fillText(lbl, X, Y + 40); };
  btn(120, 410, '#28b04a', 'LIGA'); btn(200, 410, '#d12a22', 'DESL.'); btn(280, 410, '#f0c419', 'REARME'); btn(360, 410, '#2f6fd0', 'MANUAL'); btn(430, 410, '#eeeeea', 'TESTE');
  // chave seletora e placa de advertência
  x.fillStyle = '#222'; x.beginPath(); x.arc(150, 520, 30, 0, 7); x.fill(); x.fillStyle = '#ddd'; x.fillRect(146, 494, 8, 52); x.font = '700 14px Arial, sans-serif'; x.fillStyle = '#111'; x.fillText('MAN  0  AUT', 150, 570);
  x.fillStyle = '#f2c200'; x.beginPath(); x.moveTo(330, 480); x.lineTo(380, 565); x.lineTo(280, 565); x.closePath(); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 5; x.stroke(); x.fillStyle = '#111'; x.font = '900 46px Arial, sans-serif'; x.fillText('⚡', 330, 540);
  return tex(c, { srgb: true, rep: false });
}

// ───────────── inox repuxado/torneado (tampo frontal): sulcos concêntricos, centro em (0,5; 0,5) ─────────────
let _spun = null;
export function spunTextures() {
  if (_spun) return _spun;
  const N = 512, r = rng(501), ring = new Float32Array(2048);
  for (const [cells, amp] of [[520, 0.45], [180, 0.3], [40, 0.25]]) { const lat = Array.from({ length: cells + 1 }, () => r()); for (let i = 0; i < 2048; i++) { const f = (i * cells) / 2048, k = Math.floor(f), t = f - k, s2 = t * t * (3 - 2 * t); ring[i] += (lat[k] * (1 - s2) + lat[k + 1] * s2) * amp; } }
  const blot = fbm(N, N, 4, 4, 5, 503), h = new Float32Array(N * N);
  const [fc, fx] = cnv(N); fx.fillStyle = '#000'; fx.fillRect(0, 0, N, N); fx.lineCap = 'round';
  for (let k = 0; k < 140; k++) { const x = r() * N, y = r() * N, L = 10 + r() * 80, a = r() * Math.PI; fx.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.3})`; fx.lineWidth = 0.6 + r(); fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); fx.stroke(); }
  for (let k = 0; k < 18; k++) { const x = r() * N, y = r() * N, L = 40 + r() * 160; const g = fx.createLinearGradient(x, y, x, y + L); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.15, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); fx.strokeStyle = g; fx.lineWidth = 3 + r() * 5; fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x + (r() - 0.5) * 6, y + L); fx.stroke(); }
  const fd = fx.getImageData(0, 0, N, N).data;
  const ri = (i) => { const x = i % N, y = (i / N) | 0; return Math.hypot(x - N / 2, y - N / 2) / (N / 2); };
  const alb = putGray(N, N, (i) => { const rr = ri(i), k = Math.min(2047, (rr * 2047) | 0), f = fd[i * 4] / 255; h[i] = ring[k] * 0.4 - f * 0.05; const v = 0.86 + (ring[k] - 0.6) * 0.06 + (blot[i] - 0.5) * 0.06 - f * 0.06 - sst(0.9, 1.0, rr) * 0.04; return [v + 0.01, v, v - 0.015]; });
  const rough = putGray(N, N, (i) => { const rr = ri(i), k = Math.min(2047, (rr * 2047) | 0), f = fd[i * 4] / 255; return [1, 0.26 + (ring[k] - 0.6) * 0.1 + (blot[i] - 0.5) * 0.12 + f * 0.2, 1]; });
  // normal: derivada radial dos sulcos
  const [nc, nx] = cnv(N), img = nx.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, dx = x - N / 2, dy = y - N / 2, rr = Math.hypot(dx, dy) || 1, k = Math.min(2046, ((rr / (N / 2)) * 2047) | 0);
    const g = (ring[k + 1] - ring[Math.max(0, k - 1)]) * 2.0; const ux = dx / rr, uy = dy / rr;
    let ax = -g * ux, ay = g * uy, az = 1; const l = Math.hypot(ax, ay, az); d[i * 4] = (ax / l * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ay / l * 0.5 + 0.5) * 255; d[i * 4 + 2] = (az / l * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
  }
  nx.putImageData(img, 0, 0);
  _spun = { map: tex(alb, { srgb: true, rep: false }), rough: tex(rough, { rep: false }), normal: tex(nc, { rep: false }) };
  return _spun;
}
