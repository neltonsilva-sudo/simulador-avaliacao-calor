// Texturas procedurais do MEDIDOR 3D (sem assets binários): ruídos periódicos, mapas normais, rótulos em canvas.
// Tudo em cache (compartilhado entre medidor, tripé e maleta). Dono: MEDIDOR 3D.
import * as THREE from 'three';

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

export function h2(x, y, s = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const mod = (a, n) => ((a % n) + n) % n;
const sm = (t) => t * t * (3 - 2 * t);
function vnoise(x, y, P, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
  const a = h2(mod(xi, P), mod(yi, P), s), b = h2(mod(xi + 1, P), mod(yi, P), s);
  const c = h2(mod(xi, P), mod(yi + 1, P), s), d = h2(mod(xi + 1, P), mod(yi + 1, P), s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(u, v, P0 = 8, oct = 4, s = 1) {
  let sum = 0, amp = 0.5, norm = 0, P = P0;
  for (let o = 0; o < oct; o++) { sum += amp * vnoise(u * P, v * P, P, s + o * 17); norm += amp; amp *= 0.5; P *= 2; }
  return sum / norm;
}
export function worley(u, v, N, s = 3, jitter = 0.9) {
  const x = u * N, y = v * N, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = mod(cx, N), wy = mod(cy, N);
    const px = cx + 0.5 + (h2(wx, wy, s) - 0.5) * jitter, py = cy + 0.5 + (h2(wx, wy, s + 9) - 0.5) * jitter;
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return { f1, f2 };
}
function dataTex(data, w, h = w, srgb = false) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
export function heightToNormal(H, W, strength = 2, Hh = W) {
  const d = new Uint8Array(W * Hh * 4);
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const l = H[y * W + mod(x - 1, W)], r = H[y * W + mod(x + 1, W)];
    const u = H[mod(y - 1, Hh) * W + x], b = H[mod(y + 1, Hh) * W + x];
    const nx = (l - r) * strength, ny = (b - u) * strength, k = 1 / Math.hypot(nx, ny, 1);
    const o = (y * W + x) * 4; d[o] = (nx * k * 0.5 + 0.5) * 255; d[o + 1] = (ny * k * 0.5 + 0.5) * 255; d[o + 2] = (k * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  return dataTex(d, W, Hh);
}
function field(W, f, Hh = W) { const H = new Float32Array(W * Hh); for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) H[y * W + x] = f(x / W, y / Hh); return H; }
function grayTex(H, W, lo, hi, srgb = false, Hh = W) {
  const d = new Uint8Array(W * Hh * 4);
  for (let i = 0; i < W * Hh; i++) { const v = (lo + (hi - lo) * H[i]) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  return dataTex(d, W, Hh, srgb);
}
export const repeat = (t, x, y = x) => { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; };

/** TPE emborrachado: grão fino de molde (normal) + variação de rugosidade (oleosidade de mão, poeira) */
export const rubberMaps = () => once('rubber', () => {
  const S = 256;
  const H = field(S, (u, v) => 0.6 * fbm(u, v, 32, 3, 11) + 0.4 * worley(u, v, 56, 5).f1);
  const R = field(S, (u, v) => 0.7 * fbm(u, v, 4, 4, 23) + 0.3 * fbm(u, v, 16, 2, 5));
  return { normal: heightToNormal(H, S, 1.5), rough: grayTex(R, S, 0.82, 1.0) };
});
/** pintura eletrostática preta fosca do globo: casca-de-laranja + grão de pó */
export const powderMaps = () => once('powder', () => {
  const S = 512;
  const H = field(S, (u, v) => 0.55 * fbm(u, v, 24, 3, 41) + 0.45 * (1 - Math.min(1, worley(u, v, 140, 7).f1 * 1.3)));
  const R = field(S, (u, v) => fbm(u, v, 6, 4, 77));
  return { normal: heightToNormal(H, S, 2.2), rough: grayTex(R, S, 0.86, 1.0) };
});
/** recartilhado (diamante) para o conector cromado e manoplas do tripé */
export const knurlMaps = () => once('knurl', () => {
  const S = 128, N = 16;
  const H = field(S, (u, v) => { const a = Math.abs(((u + v) * N) % 1 - 0.5), b = Math.abs(((u - v + 1) * N) % 1 - 0.5); return Math.min(a, b) * 2; });
  return { normal: heightToNormal(H, S, 3.0) };
});
/** estrias retas (manoplas de borracha) */
export const ribMaps = () => once('rib', () => {
  const S = 128, N = 12;
  const H = field(S, (u) => { const a = Math.abs((u * N) % 1 - 0.5) * 2; return sm(Math.min(1, a * 1.4)); });
  return { normal: heightToNormal(H, S, 4.0) };
});
/** malha tubular de algodão (pavio): laçadas em "V" (meia-malha) + fibras soltas. variant: limpo|sujo|seco */
export const wickMaps = () => once('wick', () => {
  const S = 256, WA = 6, CO = 10; // 6 colunas × 10 carreiras por ladrilho
  const seg = (px, py, ax, ay, bx, by) => { const vx = bx - ax, vy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy))); return Math.hypot(px - ax - vx * t, py - ay - vy * t); };
  const H = field(S, (u, v) => {
    const x = u * WA, y = v * CO; const fx = x - Math.floor(x), fy = y - Math.floor(y);
    const w = 0.24;
    let h = 0;
    for (const dy of [-1, 0, 1]) {
      const yy = fy - dy;
      const dl = seg(fx, yy, 0.06, 1.05, 0.5, -0.05), dr = seg(fx, yy, 0.94, 1.05, 0.5, -0.05);
      h = Math.max(h, Math.sqrt(Math.max(0, 1 - (dl / w) ** 2)), Math.sqrt(Math.max(0, 1 - (dr / w) ** 2)));
    }
    const fib = fbm(u * 3, v, 48, 2, 91);
    return h * 0.8 + fib * 0.25;
  });
  const fuzz = field(S, (u, v) => fbm(u, v, 16, 4, 13));
  const dirt = field(S, (u, v) => fbm(u, v, 3, 5, 57));
  const mk = (kind) => {
    const d = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) {
      const ao = 0.8 + 0.2 * Math.min(1, H[i]);
      let r = 0.96, g = 0.955, b = 0.93;
      if (kind === 'sujo') { const k = sm(Math.min(1, Math.max(0, (dirt[i] - 0.38) * 3.2))); r *= 1 - 0.36 * k; g *= 1 - 0.43 * k; b *= 1 - 0.58 * k; const gr = 0.82 + 0.18 * fuzz[i]; r *= gr; g *= gr; b *= gr; }
      if (kind === 'seco') { r = 0.985; g = 0.98; b = 0.965; }
      const f = (0.92 + 0.08 * fuzz[i]) * ao;
      d[i * 4] = Math.min(255, r * f * 255); d[i * 4 + 1] = Math.min(255, g * f * 255); d[i * 4 + 2] = Math.min(255, b * f * 255); d[i * 4 + 3] = 255;
    }
    return dataTex(d, S, S, true);
  };
  return { normal: heightToNormal(H, S, 3.2), color: { limpo: mk('limpo'), sujo: mk('sujo'), seco: mk('seco') } };
});
/** espuma de PE da maleta (células finas) */
export const foamMaps = () => once('foam', () => {
  const S = 256;
  const H = field(S, (u, v) => { const w = worley(u, v, 40, 41); return 0.55 * Math.min(1, w.f1 * 1.4) + 0.45 * fbm(u, v, 16, 3, 8); });
  return { normal: heightToNormal(H, S, 3.0), color: grayTex(H, S, 0.7, 1.0, true) };
});
/** polipropileno texturizado da maleta ("pebble") */
export const caseMaps = () => once('case', () => {
  const S = 256;
  const H = field(S, (u, v) => { const w = worley(u, v, 36, 31); return Math.sqrt(Math.min(1, w.f1)) * 0.8 + 0.2 * fbm(u, v, 16, 2, 4); });
  return { normal: heightToNormal(H, S, 2.6) };
});
/** papel (fibras) */
export const paperMaps = () => once('paper', () => {
  const S = 256;
  const H = field(S, (u, v) => 0.7 * fbm(u, v, 32, 3, 61) + 0.3 * fbm(u * 4, v, 32, 2, 3));
  return { normal: heightToNormal(H, S, 0.8) };
});

export function canvasTex(w, h, draw, { srgb = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}
export const FONT = '"Helvetica Neue", Arial, system-ui, sans-serif';

/** topo das teclas: quadrado arredondado azul com ícone branco (UV planar sobre a tecla 11,6 × 10 mm) */
export function keyTex(kind) {
  return once('key_' + kind, () => canvasTex(256, 220, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#3f9be6'); grd.addColorStop(1, '#2a7fcf');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const cx = W / 2, cy = H / 2, s = 0.82;
    if (kind === 'power') { g.lineWidth = 15 * s; g.beginPath(); g.arc(cx, cy + 5 * s, 40 * s, -Math.PI / 2 + 0.68, -Math.PI / 2 - 0.68 + Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx, cy - 46 * s); g.lineTo(cx, cy - 2 * s); g.stroke(); }
    if (kind === 'play') { g.beginPath(); g.moveTo(cx - 50 * s, cy - 38 * s); g.lineTo(cx + 2 * s, cy); g.lineTo(cx - 50 * s, cy + 38 * s); g.closePath(); g.fill(); g.fillRect(cx + 12 * s, cy - 38 * s, 14 * s, 76 * s); g.fillRect(cx + 36 * s, cy - 38 * s, 14 * s, 76 * s); }
    if (kind === 'stop') { const r = 36 * s; g.beginPath(); g.roundRect(cx - r, cy - r, 2 * r, 2 * r, 6 * s); g.fill(); }
    if (kind === 'menu') { for (const dy of [-27, 0, 27]) { g.beginPath(); g.roundRect(cx - 44 * s, cy + dy * s - 8 * s, 88 * s, 16 * s, 8 * s); g.fill(); } }
  }));
}
/** textos serigrafados no painel preto (decalque do tamanho do painel): só o modelo "itemp" acima do visor (sem marca) */
export function panelTextTex(pw, ph, items) {
  return once('panel_txt2', () => canvasTex(1024, Math.round(1024 * ph / pw), (g, W, H) => {
    g.clearRect(0, 0, W, H); const k = W / pw; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    for (const it of items) {
      const x = (it.x + pw / 2) * k, y = (ph / 2 - it.y) * k; g.font = `${it.weight} ${it.size * k}px ${FONT}`;
      const parts = it.parts; const fnt = (p) => `${p[2] || it.weight} ${it.size * k}px ${FONT}`;
      const tw = parts.reduce((a, p) => { g.font = fnt(p); return a + g.measureText(p[0]).width; }, 0) + (parts.length - 1) * it.gap * k;
      let xx = x - tw / 2; for (const p of parts) { g.font = fnt(p); g.fillStyle = p[1]; g.fillText(p[0], xx, y); xx += g.measureText(p[0]).width + it.gap * k; }
    }
  }));
}
/** máscara de relevo da lateral esquerda — vazia: a marca do fabricante foi retirada a pedido do usuário */
export const embossTex = () => once('emboss', () => canvasTex(16, 16, (g, W, H) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }, { srgb: false }));
/** etiqueta prateada da traseira (dados do aparelho, sem marca) */
export const backLabelTex = () => once('lbl_back', () => canvasTex(768, 384, (g, W, H) => {
  const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, '#d9dcdf'); grd.addColorStop(0.5, '#c4c8cc'); grd.addColorStop(1, '#d4d7da');
  g.fillStyle = grd; g.fillRect(0, 0, W, H); g.strokeStyle = '#2b2f33'; g.lineWidth = 4; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#1d2125'; g.font = `700 46px ${FONT}`; g.fillText('iTemp', 34, 70);
  g.font = `500 26px ${FONT}`; g.fillText('Medidor de stress térmico — IBUTG', 170, 66);
  g.font = `400 24px ${FONT}`;
  ['Globo Ø 152,4 mm · tg 0 a 120 °C · tbs/tbn 0 a 100 °C', 'Resolução 0,1 °C · Exatidão ± 0,5 °C', 'Alimentação: bateria Li-ion 3,7 V / USB 5 V',
    'Nº de série: IT26-04817', 'Uso interno / externo · IP54'].forEach((s, i) => g.fillText(s, 34, 130 + i * 40));
  // código de barras
  for (let i = 0, x = 560; x < 730; i++) { const w = 2 + Math.floor(h2(i, 3, 5) * 4); if (i % 2 === 0) g.fillRect(x, 270, w, 70); x += w; }
}));
/** rótulo da pisseta */
export const pissetaLabelTex = () => once('lbl_pis', () => canvasTex(512, 256, (g, W, H) => {
  g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1f66b5'; g.fillRect(0, 0, W, 64); g.fillRect(0, H - 34, W, 34);
  g.fillStyle = '#fff'; g.font = `700 40px ${FONT}`; g.textAlign = 'center'; g.fillText('ÁGUA DESTILADA', W / 2, 46);
  g.fillStyle = '#1f66b5'; g.font = `800 92px ${FONT}`; g.fillText('H₂O', W / 2, 166);
  g.fillStyle = '#334'; g.font = `500 22px ${FONT}`; g.fillText('Pisseta 500 mL — uso no bulbo úmido', W / 2, 206);
}));

/** certificado de calibração impresso (A4) */
export const certTex = () => once('cert', () => canvasTex(1024, 1448, (g, W, H) => {
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
  const M = 70; g.fillStyle = '#16212c';
  g.strokeStyle = '#1e4f86'; g.lineWidth = 6; g.beginPath(); g.moveTo(M, 150); g.lineTo(W - M, 150); g.stroke();
  g.font = `700 50px ${FONT}`; g.fillText('CERTIFICADO DE CALIBRAÇÃO', M, 110);
  g.font = `500 26px ${FONT}`; g.fillStyle = '#1e4f86'; g.fillText('Nº 2026/1187-T   ·   Laboratório de Calibração acreditado — RBC/Cgcre', M, 196);
  g.fillStyle = '#16212c'; g.font = `600 27px ${FONT}`;
  const rows = [['Instrumento', 'Medidor de stress térmico (IBUTG), eletrônico'], ['Modelo', 'iTemp'], ['Nº de série', 'IT26-04817'],
    ['Sensores', 'Globo Ø 152,4 mm (tg), bulbo seco (tbs), bulbo úmido natural (tbn)'], ['Data da calibração', '12/08/2026'], ['Próxima calibração', '12/08/2027 (12 meses)'],
    ['Condições', '23,0 ± 1,0 °C   ·   UR 50 ± 10 %']];
  rows.forEach(([a, b], i) => { g.font = `600 26px ${FONT}`; g.fillText(a + ':', M, 270 + i * 46); g.font = `400 26px ${FONT}`; g.fillText(b, M + 290, 270 + i * 46); });
  // tabela de resultados
  let y = 640; g.font = `700 28px ${FONT}`; g.fillText('Resultados', M, y); y += 26;
  const cols = [M, M + 190, M + 410, M + 600, M + 740]; const head = ['Sensor', 'Referência (°C)', 'Indicação (°C)', 'Erro (°C)', 'U (k=2) (°C)'];
  g.fillStyle = '#dfe7f0'; g.fillRect(M, y, W - 2 * M, 50); g.fillStyle = '#16212c'; g.font = `600 22px ${FONT}`;
  head.forEach((h, i) => g.fillText(h, cols[i] + 8, y + 33)); y += 50;
  const data = [['Globo', 30.0, 30.1], ['Globo', 60.0, 60.2], ['Globo', 90.0, 89.9], ['Seco', 20.0, 20.1], ['Seco', 40.0, 39.9], ['Úmido', 20.0, 20.0], ['Úmido', 40.0, 40.2]];
  g.font = `400 23px ${FONT}`;
  data.forEach(([s, r, ind], i) => { if (i % 2) { g.fillStyle = '#f1f3f5'; g.fillRect(M, y, W - 2 * M, 44); } g.fillStyle = '#16212c';
    const e = (ind - r).toFixed(1).replace('.', ','); const vals = [s, r.toFixed(1).replace('.', ','), ind.toFixed(1).replace('.', ','), (ind - r >= 0 ? '+' : '') + e, s === 'Globo' ? '0,3' : '0,2'];
    vals.forEach((v, k) => g.fillText(v, cols[k] + 8, y + 30)); y += 44; });
  g.strokeStyle = '#7d8a96'; g.lineWidth = 1.5; g.strokeRect(M, 666, W - 2 * M, y - 666);
  y += 50; g.font = `400 21px ${FONT}`; g.fillStyle = '#2b3640';
  ['A incerteza expandida de medição relatada é declarada como a incerteza padrão multiplicada pelo fator de abrangência k = 2,',
    'que para uma distribuição t com graus de liberdade efetivos corresponde a uma probabilidade de abrangência de ~95 %.',
    'Rastreabilidade: padrões calibrados por laboratórios acreditados ao Inmetro (NHO-06, item 7.1).',
    'Este certificado refere-se exclusivamente ao instrumento calibrado. Reprodução somente na íntegra.'].forEach((s, i) => g.fillText(s, M, y + i * 32));
  y += 230; g.strokeStyle = '#16212c'; g.lineWidth = 2; g.beginPath(); g.moveTo(W - 470, y); g.lineTo(W - M, y); g.stroke();
  g.font = `400 22px ${FONT}`; g.fillText('Responsável técnico — signatário autorizado', W - 470, y + 32);
  // assinatura manuscrita
  g.strokeStyle = '#1b3a8a'; g.lineWidth = 3; g.beginPath(); let x = W - 440; g.moveTo(x, y - 12);
  for (let i = 0; i < 26; i++) { x += 12; g.quadraticCurveTo(x - 6, y - 40 * h2(i, 1, 2) - 4, x, y - 10 - 18 * h2(i, 2, 3)); } g.stroke();
  g.font = `400 18px ${FONT}`; g.fillStyle = '#6b7680'; g.fillText('Página 1 de 1', M, H - 60);
}));
