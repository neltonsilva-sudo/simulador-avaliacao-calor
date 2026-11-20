// AMBIENTAÇÃO — texturas procedurais (canvas). Nada de assets binários; nada de marcas reais.
import * as THREE from 'three';

export function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, { srgb = true, rep = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t;
}
const memo = new Map();
export const once = (k, f) => (memo.has(k) ? memo.get(k) : (memo.set(k, f()), memo.get(k)));
function noise(x, S, amp, R) { const id = x.getImageData(0, 0, S, S), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(id, 0, 0); }
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, sans-serif';

/** inox escovado: cor (leve variação + manchas de dedo/gordura) e rugosidade com riscos direcionais */
export const steelTex = () => once('steel', () => {
  const S = 512, R = rng(11);
  const [c, x] = cv(S, S); x.fillStyle = '#c4c7c9'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1600; i++) { const y = R() * S, v = 150 + R() * 70; x.fillStyle = `rgba(${v},${v + 2},${v + 4},${0.05 + R() * 0.12})`; x.fillRect(0, y, S, 0.6 + R() * 1.4); }
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(120,112,98,${0.03 + R() * 0.05})`; x.beginPath(); x.ellipse(R() * S, R() * S, 10 + R() * 60, 6 + R() * 30, R() * 3, 0, 7); x.fill(); }
  const [c2, y2] = cv(S, S); y2.fillStyle = 'rgb(92,92,92)'; y2.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) { const v = 50 + R() * 110; y2.fillStyle = `rgba(${v},${v},${v},${0.15 + R() * 0.3})`; y2.fillRect(0, R() * S, S, 0.5 + R() * 1.6); }
  for (let i = 0; i < 40; i++) { const v = 150 + R() * 70; y2.fillStyle = `rgba(${v},${v},${v},${0.12 + R() * 0.2})`; y2.beginPath(); y2.ellipse(R() * S, R() * S, 8 + R() * 50, 5 + R() * 30, R() * 3, 0, 7); y2.fill(); }
  for (let i = 0; i < 90; i++) { y2.strokeStyle = `rgba(200,200,200,${0.2 + R() * 0.3})`; y2.lineWidth = 0.6; const px = R() * S, py = R() * S, a = R() * 6.3, l = 5 + R() * 40; y2.beginPath(); y2.moveTo(px, py); y2.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); y2.stroke(); }
  return { map: tex(c, { rep: true }), rough: tex(c2, { srgb: false, rep: true }) };
});

/** saco de farinha 25 kg (papel multifolha branco-creme, impressão genérica). UV planar de cima. */
export function bagTex(variant = 0) {
  return once('bag' + variant, () => {
    const W = 512, H = 820, R = rng(31 + variant * 7);
    const [c, x] = cv(W, H);
    x.fillStyle = variant === 2 ? '#e9dcc0' : '#efeae0'; x.fillRect(0, 0, W, H);
    // fibras do papel
    for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(${150 + R() * 60},${140 + R() * 50},${110 + R() * 40},${0.06 + R() * 0.08})`; x.lineWidth = 0.6; const px = R() * W, py = R() * H, a = R() * 6.3; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6); x.stroke(); }
    // costura nas pontas
    for (const yy of [26, H - 26]) { x.fillStyle = 'rgba(160,150,130,0.6)'; x.fillRect(0, yy - 6, W, 12); for (let k = 0; k < W; k += 9) { x.fillStyle = 'rgba(90,80,64,0.7)'; x.fillRect(k, yy - 2, 5, 4); } }
    // impressão
    const ink = ['#b8231d', '#1f4e93', '#2c6a35'][variant % 3];
    x.save(); x.translate(W / 2, H / 2); x.rotate(-Math.PI / 2);
    x.textAlign = 'center'; x.fillStyle = ink;
    x.fillRect(-300, -170, 600, 18); x.fillRect(-300, 152, 600, 18);
    x.font = `700 74px ${FONT}`; x.fillText('FARINHA DE TRIGO', 0, -70);
    x.font = `700 46px ${FONT}`; x.fillText(variant === 1 ? 'ESPECIAL · TIPO 1' : 'TIPO 1 · PANIFICAÇÃO', 0, -10);
    x.fillStyle = '#222'; x.font = `600 30px ${FONT}`; x.fillText('ENRIQUECIDA COM FERRO E ÁCIDO FÓLICO', 0, 40);
    x.fillStyle = ink; x.font = `700 64px ${FONT}`; x.fillText('25 kg', 0, 120);
    x.restore();
    x.fillStyle = '#222'; x.font = `500 18px ${FONT}`; x.save(); x.translate(40, H - 60); x.fillText('LOTE ' + (2400 + Math.floor(R() * 600)) + '  VAL 03/27', 0, 0); x.restore();
    // sujeira, pó e amassados
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,250,${0.1 + R() * 0.25})`; x.beginPath(); x.ellipse(R() * W, R() * H, 10 + R() * 50, 5 + R() * 20, R() * 3, 0, 7); x.fill(); }
    for (let i = 0; i < 30; i++) { x.strokeStyle = `rgba(120,108,88,${0.08 + R() * 0.12})`; x.lineWidth = 1 + R() * 2; const px = R() * W, py = R() * H; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 120, py + (R() - 0.5) * 40); x.stroke(); }
    const g = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 480); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(90,80,60,0.25)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    noise(x, W, 10, R);
    return tex(c);
  });
}

/** rótulo de balde/caixa: faixa colorida com texto genérico */
export function labelTex(lines, bg = '#efefea', ink = '#1d3f7a', band = '#e0b62a', seed = 1, W = 1024, H = 256) {
  return once('lbl' + lines.join('|') + bg + band, () => {
    const R = rng(seed); const [c, x] = cv(W, H);
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    // rótulo apenas numa face (metade da circunferência)
    x.fillStyle = band; x.fillRect(W * 0.08, H * 0.12, W * 0.36, H * 0.76);
    x.fillStyle = ink; x.textAlign = 'center';
    x.font = `700 ${H * 0.24}px ${FONT}`; x.fillText(lines[0], W * 0.26, H * 0.42);
    x.font = `600 ${H * 0.15}px ${FONT}`; if (lines[1]) x.fillText(lines[1], W * 0.26, H * 0.62);
    x.font = `700 ${H * 0.13}px ${FONT}`; if (lines[2]) x.fillText(lines[2], W * 0.26, H * 0.8);
    for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(110,100,80,${0.04 + R() * 0.08})`; x.beginPath(); x.ellipse(R() * W, H * 0.7 + R() * H * 0.3, 10 + R() * 40, 3 + R() * 10, 0, 0, 7); x.fill(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${0.1 + R() * 0.2})`; x.beginPath(); x.arc(R() * W, R() * H, 1 + R() * 6, 0, 7); x.fill(); }
    noise(x, W, 8, R);
    return tex(c);
  });
}

/** papelão ondulado: kraft, fita adesiva, etiqueta, marcas */
export function cardTex(seed = 1, text = 'FRÁGIL') {
  return once('card' + seed + text, () => {
    const S = 512, R = rng(77 + seed); const [c, x] = cv(S, S);
    x.fillStyle = '#b48a58'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 3) { x.fillStyle = `rgba(80,55,25,${0.03 + R() * 0.04})`; x.fillRect(i, 0, 1, S); }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '70,48,20' : '220,190,150'},${0.04 + R() * 0.07})`; x.beginPath(); x.ellipse(R() * S, R() * S, 10 + R() * 60, 5 + R() * 30, R() * 3, 0, 7); x.fill(); }
    // fita
    x.fillStyle = 'rgba(205,170,110,0.75)'; x.fillRect(S * 0.42, 0, S * 0.16, S); x.fillStyle = 'rgba(255,240,210,0.25)'; x.fillRect(S * 0.43, 0, 6, S);
    x.fillStyle = 'rgba(40,30,20,0.85)'; x.font = `700 44px ${FONT}`; x.textAlign = 'center'; x.fillText(text, S * 0.22, S * 0.3);
    x.font = `600 26px ${FONT}`; x.fillText('↑ ↑', S * 0.8, S * 0.22);
    x.fillStyle = '#f6f4ee'; x.fillRect(S * 0.64, S * 0.62, S * 0.3, S * 0.2); x.fillStyle = '#222'; x.font = `600 20px ${FONT}`; x.textAlign = 'left';
    x.fillText('LOTE ' + (100 + Math.floor(R() * 900)), S * 0.66, S * 0.69); x.fillText('12 × 1 kg', S * 0.66, S * 0.76);
    for (let i = 0; i < 12; i++) { x.fillStyle = `rgba(255,255,250,${0.1 + R() * 0.2})`; x.beginPath(); x.ellipse(R() * S, R() * S, 8 + R() * 40, 4 + R() * 15, R() * 3, 0, 7); x.fill(); }
    noise(x, S, 12, R);
    return tex(c);
  });
}

/** caixa plástica vazada: alpha com rasgos (alphaTest) — cor no material */
export const crateAlpha = () => once('crateA', () => {
  const W = 256, H = 128; const [c, x] = cv(W, H);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#000';
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { const px = 14 + k * 26, py = 30 + r * 30; x.beginPath(); x.roundRect(px, py, 18, 20, 4); x.fill(); }
  // alça
  x.beginPath(); x.roundRect(W * 0.38, 8, W * 0.24, 14, 6); x.fill();
  return tex(c, { srgb: false, rep: false, aniso: 4 });
});
export const crateBottomAlpha = () => once('crateB', () => {
  const S = 256; const [c, x] = cv(S, S); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.fillStyle = '#000';
  for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { x.beginPath(); x.roundRect(14 + k * 30, 14 + r * 30, 20, 20, 3); x.fill(); }
  return tex(c, { srgb: false, aniso: 4 });
});

/** assadeira/esteira: alumínio com pátina de forno (marrom/preto nas bordas), furos opcionais */
export function trayTex(kind = 'alu', seed = 1) {
  return once('tray' + kind + seed, () => {
    const S = 512, R = rng(91 + seed); const [c, x] = cv(S, S);
    const base = kind === 'black' ? '#3a332c' : kind === 'perf' ? '#a9aaa6' : '#b0afa8';
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    // pátina de forno (gordura carbonizada) mais forte nas bordas
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, kind === 'black' ? 'rgba(20,14,8,0.6)' : 'rgba(90,60,30,0.45)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${70 + R() * 50},${45 + R() * 30},${18 + R() * 15},${0.05 + R() * 0.15})`; x.beginPath(); x.ellipse(R() * S, R() * S, 10 + R() * 40, 8 + R() * 30, R() * 3, 0, 7); x.fill(); }
    if (kind === 'perf') { for (let yy = 10; yy < S; yy += 13) for (let xx = (yy / 13) % 2 ? 6 : 12; xx < S; xx += 13) { x.fillStyle = 'rgba(25,22,18,0.85)'; x.beginPath(); x.arc(xx, yy, 3.2, 0, 7); x.fill(); } }
    for (let i = 0; i < 120; i++) { x.strokeStyle = `rgba(220,220,210,${0.08 + R() * 0.15})`; x.lineWidth = 0.7; const px = R() * S, py = R() * S, a = R() * 6.3, l = 6 + R() * 30; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    noise(x, S, 10, R);
    return tex(c, { rep: true });
  });
}

/** pano de prato (algodão listrado) */
export function clothTex(col = '#2f5fa8', seed = 1) {
  return once('cloth' + col, () => {
    const S = 256, R = rng(5 + seed); const [c, x] = cv(S, S);
    x.fillStyle = '#f1efe8'; x.fillRect(0, 0, S, S);
    x.fillStyle = col; for (const p of [0.12, 0.18, 0.8, 0.86]) x.fillRect(0, p * S, S, S * 0.035);
    for (let i = 0; i < S; i += 2) { x.fillStyle = 'rgba(0,0,0,0.035)'; x.fillRect(i, 0, 1, S); x.fillRect(0, i, S, 1); }
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(150,120,80,${0.04 + R() * 0.07})`; x.beginPath(); x.ellipse(R() * S, R() * S, 6 + R() * 20, 4 + R() * 14, R() * 3, 0, 7); x.fill(); }
    noise(x, S, 10, R);
    return tex(c, { rep: true });
  });
}

/** luva térmica de aramida (malha bege com sujeira escura na palma) */
export const gloveTex = () => once('glove', () => {
  const S = 256, R = rng(8); const [c, x] = cv(S, S);
  x.fillStyle = '#c9b78e'; x.fillRect(0, 0, S, S);
  for (let yy = 0; yy < S; yy += 4) for (let xx = 0; xx < S; xx += 4) { x.fillStyle = `rgba(${R() < 0.5 ? '255,245,215' : '90,75,50'},${0.08 + R() * 0.1})`; x.fillRect(xx + ((yy / 4) % 2) * 2, yy, 2, 3); }
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(40,30,15,0.45)'); g.addColorStop(0.5, 'rgba(40,30,15,0.1)'); g.addColorStop(1, 'rgba(40,30,15,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 25; i++) { x.fillStyle = `rgba(50,35,20,${0.06 + R() * 0.12})`; x.beginPath(); x.ellipse(R() * S, R() * S * 0.6, 6 + R() * 22, 4 + R() * 12, R() * 3, 0, 7); x.fill(); }
  // punho azul
  x.fillStyle = '#28487a'; x.fillRect(0, S - 26, S, 26);
  return tex(c, { rep: true });
});

/** madeira (pá de forno, pallet): pinho com veios */
export function woodTex(col = '#c49a62', seed = 1) {
  return once('wood' + col + seed, () => {
    const W = 256, H = 1024, R = rng(13 + seed); const [c, x] = cv(W, H);
    x.fillStyle = col; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) { const px = R() * W; x.strokeStyle = `rgba(110,70,30,${0.08 + R() * 0.18})`; x.lineWidth = 0.6 + R() * 2.4; x.beginPath(); x.moveTo(px, 0); for (let yy = 0; yy <= H; yy += 32) x.lineTo(px + Math.sin(yy * 0.01 + i) * (3 + R() * 6), yy); x.stroke(); }
    for (let i = 0; i < 4; i++) { const px = R() * W, py = R() * H; const g = x.createRadialGradient(px, py, 1, px, py, 14); g.addColorStop(0, 'rgba(90,50,20,0.7)'); g.addColorStop(1, 'rgba(90,50,20,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, 10, 18, 0, 0, 7); x.fill(); }
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(40,28,15,${0.05 + R() * 0.1})`; x.beginPath(); x.ellipse(R() * W, R() * H, 6 + R() * 30, 10 + R() * 60, 0, 0, 7); x.fill(); }
    noise(x, W, 12, R);
    return tex(c, { rep: true });
  });
}

/** mostrador do relógio de parede */
export const clockTex = () => once('clock', () => {
  const S = 512; const [c, x] = cv(S, S);
  x.fillStyle = '#f7f6f1'; x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, 7); x.fill();
  x.translate(S / 2, S / 2);
  for (let i = 0; i < 60; i++) { x.save(); x.rotate((i / 60) * Math.PI * 2); x.fillStyle = '#1a1a1a'; if (i % 5 === 0) x.fillRect(-5, -S * 0.47, 10, 34); else x.fillRect(-1.5, -S * 0.47, 3, 14); x.restore(); }
  x.fillStyle = '#1a1a1a'; x.font = `700 58px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let h = 1; h <= 12; h++) { const a = (h / 12) * Math.PI * 2; x.fillText(String(h), Math.sin(a) * S * 0.34, -Math.cos(a) * S * 0.34); }
  x.font = `600 20px ${FONT}`; x.fillStyle = '#666'; x.fillText('QUARTZ', 0, S * 0.15);
  return tex(c);
});

/** termo-higrômetro digital de parede (atualizado em runtime) */
export function makeThermoCanvas() {
  const [c, x] = cv(256, 192);
  const t = tex(c);
  function draw(ta, rh) {
    x.fillStyle = '#e9ebe6'; x.fillRect(0, 0, 256, 192);
    x.fillStyle = '#9fa89a'; x.fillRect(16, 16, 224, 160);
    x.fillStyle = '#b9c3b0'; x.fillRect(20, 20, 216, 152);
    x.fillStyle = '#1b2118'; x.textAlign = 'right'; x.font = `700 76px ${FONT}`; x.fillText(ta.toFixed(1), 196, 96);
    x.font = `700 26px ${FONT}`; x.fillText('°C', 228, 64);
    x.font = `700 52px ${FONT}`; x.fillText(Math.round(rh).toString(), 176, 158); x.font = `700 24px ${FONT}`; x.fillText('%UR', 232, 158);
    x.textAlign = 'left'; x.font = `600 14px ${FONT}`; x.fillText('IN', 28, 40);
    t.needsUpdate = true;
  }
  draw(28, 55);
  return { tex: t, draw };
}

/** quadro de avisos: cortiça + folhas fixadas com tachinhas (cronograma de produção etc.) */
export const boardTex = () => once('board', () => {
  const W = 1536, H = 1024, R = rng(404); const [c, x] = cv(1024, 683); x.scale(1024 / W, 683 / H); // desenho em 1536×1024, textura 1024 (orçamento de GPU)
  x.fillStyle = '#b98c58'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '90,58,28' : '220,180,130'},${0.15 + R() * 0.3})`; x.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 3); }
  const sheet = (px, py, w, h, rot, draw) => {
    x.save(); x.translate(px + w / 2, py + h / 2); x.rotate(rot);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
    x.fillStyle = '#f8f7f1'; x.fillRect(-w / 2, -h / 2, w, h);
    const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(230,220,180,0)'); g.addColorStop(1, 'rgba(200,180,130,0.18)'); x.fillStyle = g; x.fillRect(-w / 2, -h / 2, w, h);
    x.translate(-w / 2, -h / 2); draw(w, h); x.restore();
    x.fillStyle = ['#d22', '#2a4fd0', '#1a9a3a', '#e8b400'][Math.floor(R() * 4)]; x.beginPath(); x.arc(px + w / 2, py + 14, 9, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.arc(px + w / 2 - 3, py + 11, 3, 0, 7); x.fill();
  };
  // cronograma de produção (tabela)
  sheet(40, 40, 760, 560, -0.012, (w) => {
    x.fillStyle = '#111'; x.font = `700 38px ${FONT}`; x.fillText('CRONOGRAMA DE PRODUÇÃO — TURNO 05:00–12:00', 24, 58);
    const cols = ['HORA', 'PRODUTO', 'QTD', 'FORNO', 'T °C', 'OK'], cx = [24, 120, 400, 480, 610, 690];
    x.font = `700 22px ${FONT}`; cols.forEach((t, i) => x.fillText(t, cx[i], 104));
    x.fillRect(20, 112, w - 40, 3);
    const rows = [['05:10', 'Pão francês 50 g', '1200', 'Turbo 1', '180', '✓'], ['05:40', 'Pão de forma', '160', 'Rotativo', '170', '✓'], ['06:00', 'Bisnaguinha', '600', 'Turbo 1', '175', '✓'],
      ['06:30', 'Baguete', '120', 'Lastro 3c', '230', ''], ['07:00', 'Pão francês 50 g', '1200', 'Turbo 1', '180', ''], ['07:40', 'Pão de queijo', '400', 'Conv. 2', '190', ''],
      ['08:20', 'Pão italiano', '60', 'Lastro 4c', '230', ''], ['10:00', 'Pão francês 50 g', '900', 'Turbo 1', '180', ''], ['11:00', 'Rosca doce', '80', 'Rotativo', '165', '']];
    rows.forEach((r, j) => { const y = 150 + j * 44; x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(20, y + 12, w - 40, 1.5);
      x.fillStyle = '#222'; x.font = `500 24px ${FONT}`; r.forEach((t, i) => { if (i === 5 && t) { x.fillStyle = '#1f3fa0'; x.font = `700 30px ${FONT}`; } x.fillText(t, cx[i], y); }); });
    x.fillStyle = '#1f3fa0'; x.font = `italic 500 26px ${FONT}`; x.fillText('Resp.: Sueli  —  conferir lote da farinha', 24, 548);
  });
  // controle de temperatura dos fornos
  sheet(850, 60, 620, 430, 0.02, (w) => {
    x.fillStyle = '#111'; x.font = `700 30px ${FONT}`; x.fillText('CONTROLE DE TEMPERATURA — FORNOS', 20, 46);
    x.font = `600 20px ${FONT}`; ['DATA', 'TURBO 1', 'ROTATIVO', 'LASTRO', 'VISTO'].forEach((t, i) => x.fillText(t, 20 + i * 118, 92)); x.fillRect(16, 100, w - 32, 2);
    for (let j = 0; j < 7; j++) { const y = 136 + j * 40; x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(16, y + 10, w - 32, 1.2); if (j < 5) { x.fillStyle = '#233c8c'; x.font = `italic 500 22px ${FONT}`; [`${10 + j}/11`, `${178 + Math.floor(R() * 5)}`, `${168 + Math.floor(R() * 5)}`, `${228 + Math.floor(R() * 5)}`, 'ok'].forEach((t, i) => x.fillText(t, 22 + i * 118, y)); } }
  });
  // boas práticas / mãos
  sheet(880, 560, 300, 400, -0.03, (w) => {
    x.fillStyle = '#1b6b2e'; x.fillRect(0, 0, w, 90); x.fillStyle = '#fff'; x.font = `700 34px ${FONT}`; x.textAlign = 'center'; x.fillText('LAVE AS MÃOS', w / 2, 58);
    x.fillStyle = '#1b6b2e'; x.font = `600 22px ${FONT}`; ['ao entrar no setor', 'após usar o banheiro', 'após manusear lixo', 'ao trocar de tarefa'].forEach((t, i) => x.fillText(t, w / 2, 150 + i * 46));
    x.strokeStyle = '#1b6b2e'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, 335, 36, 0, 7); x.stroke(); x.textAlign = 'left';
  });
  // escala de limpeza
  sheet(1230, 540, 270, 380, 0.025, (w) => {
    x.fillStyle = '#111'; x.font = `700 26px ${FONT}`; x.fillText('ESCALA DE LIMPEZA', 16, 40);
    x.font = `500 19px ${FONT}`; ['Seg  Coifas', 'Ter  Piso/ralos', 'Qua  Fornos', 'Qui  Câmara fria', 'Sex  Estantes', 'Sáb  Geral'].forEach((t, i) => x.fillText(t, 16, 90 + i * 40));
  });
  // bilhete
  sheet(120, 650, 330, 260, 0.06, () => { x.fillStyle = '#f2df6b'; x.fillRect(0, 0, 330, 260); x.fillStyle = '#1d2e7a'; x.font = `italic 600 30px ${FONT}`; ['Trocar borracha da', 'porta do turbo 1!', '— manutenção 3ª'].forEach((t, i) => x.fillText(t, 22, 70 + i * 50)); });
  sheet(500, 660, 320, 300, -0.04, (w) => { x.fillStyle = '#c4161c'; x.fillRect(0, 0, w, 64); x.fillStyle = '#fff'; x.font = `700 28px ${FONT}`; x.textAlign = 'center'; x.fillText('HIDRATE-SE', w / 2, 44);
    x.fillStyle = '#222'; x.font = `600 22px ${FONT}`; ['Beba água a cada', '15–20 minutos', 'mesmo sem sede', '(medida de controle)'].forEach((t, i) => x.fillText(t, w / 2, 120 + i * 40)); x.textAlign = 'left'; });
  x.setTransform(1, 0, 0, 1, 0, 0); noise(x, 1024, 6, R);
  return tex(c);
});

/** decal de fuligem/caramelização sobre inox: RGBA (marrom; escurece de baixo p/ cima, estrias) */
export const sootTex = () => once('soot', () => {
  const W = 512, H = 128, R = rng(66); const [c, x] = cv(W, H);
  x.clearRect(0, 0, W, H);
  for (let i = 0; i < 170; i++) {
    const px = R() * W, w = 6 + R() * 40, h = H * (0.3 + R() * 0.7), a = 0.05 + R() * 0.13;
    const g = x.createLinearGradient(0, H, 0, H - h); g.addColorStop(0, `rgba(${60 + R() * 30},${34 + R() * 14},${14 + R() * 8},${a})`); g.addColorStop(1, 'rgba(70,40,16,0)');
    x.fillStyle = g; x.fillRect(px - w / 2, H - h, w, h);
  }
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.1, 'rgba(0,0,0,0)'); g.addColorStop(0.9, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, W, H);
  return tex(c);
});
/** borrão de farinha (dedos/mão) — RGBA branco */
export const smudgeTex = () => once('smudge', () => {
  const S = 256, R = rng(3); const [c, x] = cv(S, S);
  for (let i = 0; i < 4; i++) { const px = 70 + i * 34 + R() * 8, py = 90 + Math.abs(i - 1.5) * 18; const g = x.createRadialGradient(px, py, 2, px, py, 26); g.addColorStop(0, 'rgba(250,248,242,0.7)'); g.addColorStop(1, 'rgba(250,248,242,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, 14, 28, 0.2 - i * 0.12, 0, 7); x.fill(); }
  const g = x.createRadialGradient(130, 170, 10, 130, 170, 70); g.addColorStop(0, 'rgba(250,248,242,0.4)'); g.addColorStop(1, 'rgba(250,248,242,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(130, 170, 60, 44, 0, 0, 7); x.fill();
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(250,248,242,${R() * 0.4})`; x.fillRect(40 + R() * 180, 60 + R() * 160, 1.5, 1.5); }
  return tex(c);
});

/** painel isotérmico (câmara fria): branco com frisos verticais, juntas e encardido junto ao piso */
export const panelTex = () => once('panel', () => {
  const W = 512, H = 1024, R = rng(55); const [c, x] = cv(W, H);
  x.fillStyle = '#eceeec'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < W; i += 32) { x.fillStyle = 'rgba(0,0,0,0.07)'; x.fillRect(i, 0, 2, H); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(i + 2, 0, 2, H); }
  x.fillStyle = 'rgba(60,60,60,0.35)'; x.fillRect(0, 0, 3, H); x.fillRect(W - 3, 0, 3, H);
  const g = x.createLinearGradient(0, H, 0, H * 0.75); g.addColorStop(0, 'rgba(90,80,60,0.28)'); g.addColorStop(1, 'rgba(90,80,60,0)'); x.fillStyle = g; x.fillRect(0, H * 0.75, W, H * 0.25);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '120,110,90' : '255,255,255'},${0.03 + R() * 0.05})`; x.beginPath(); x.ellipse(R() * W, R() * H, 6 + R() * 40, 10 + R() * 60, 0, 0, 7); x.fill(); }
  noise(x, W, 6, R);
  return tex(c, { rep: true });
});
/** display do controlador da câmara fria (LED vermelho) */
export const coldLedTex = () => once('coldled', () => {
  const [c, x] = cv(256, 128); x.fillStyle = '#100404'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#ff3a26'; x.font = `700 74px "Roboto Mono", monospace`; x.textAlign = 'center'; x.fillText('2.0', 128, 92);
  x.fillStyle = '#4cff6a'; x.beginPath(); x.arc(30, 26, 7, 0, 7); x.fill();
  return tex(c);
});
