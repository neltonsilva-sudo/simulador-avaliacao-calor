// CASARIO da rua colonial — texturas procedurais (canvas ≤1024, compartilhadas). Tons neutros/claros: a cor vem de
// vertexColors / instanceColor (caiação, molduras), assim um único mapa serve para todas as casas.
import * as THREE from 'three';

let seed = 4242;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const reseed = (s) => { seed = s; };
const cache = {};
function mk(key, w, h, draw, srgb = true) {
  if (cache[key]) return cache[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return (cache[key] = t);
}
const blob = (g, x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); };
const speck = (g, w, h, n, col, a, s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * s, 1 + rnd() * s); } };
// desenha fn(x) três vezes (x, x±w) → textura contínua na horizontal
const wrap3 = (w, fn) => { fn(0); fn(-w); fn(w); };

/** reboco caiado: v=0 base (umidade ascendente), v=1 topo (encardido sob o beiral com escorridos) */
export function wallTex() {
  return mk('wall', 1024, 1024, (g, w, h) => {
    reseed(11);
    g.fillStyle = 'rgb(238,236,230)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90, k = rnd() < 0.5;
      wrap3(w, (o) => blob(g, x + o, y, r, k ? '255,255,250' : '150,140,120', k ? 0.25 : 0.06)); }
    // pinceladas de cal (horizontais, suaves)
    for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,252' : '170,160,140'},${0.05 * rnd()})`;
      g.lineWidth = 2 + rnd() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + rnd() * 90, y + (rnd() - 0.5) * 8); g.stroke(); }
    // umidade ascendente (base)
    let gr = g.createLinearGradient(0, h, 0, h * 0.72); gr.addColorStop(0, 'rgba(95,98,78,0.55)'); gr.addColorStop(1, 'rgba(95,98,78,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
    for (let i = 0; i < 70; i++) { const x = rnd() * w, y = h - rnd() * h * 0.2, r = 30 + rnd() * 80; wrap3(w, (o) => blob(g, x + o, y, r, rnd() < 0.6 ? '90,92,70' : '120,105,80', 0.22)); }
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = h * (0.78 + rnd() * 0.12); wrap3(w, (o) => { g.strokeStyle = 'rgba(110,100,80,0.18)'; g.lineWidth = 1.5; g.beginPath();
      g.moveTo(x + o - 60, y); g.bezierCurveTo(x + o - 20, y - 18 * rnd(), x + o + 20, y + 14 * rnd(), x + o + 60, y); g.stroke(); }); }
    // encardido sob o beiral + escorridos
    gr = g.createLinearGradient(0, 0, 0, h * 0.16); gr.addColorStop(0, 'rgba(70,62,52,0.5)'); gr.addColorStop(1, 'rgba(70,62,52,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.16);
    for (let i = 0; i < 70; i++) { const x = rnd() * w, L = h * (0.05 + rnd() * 0.28), lw = 3 + rnd() * 14, a = 0.03 + rnd() * 0.06;
      wrap3(w, (o) => { const lg = g.createLinearGradient(0, 0, 0, L); lg.addColorStop(0, `rgba(75,68,58,${a})`); lg.addColorStop(1, 'rgba(75,68,58,0)'); g.fillStyle = lg; g.fillRect(x + o, 0, lw, L); }); }
    // reboco caído mostrando adobe/pedra (poucos)
    for (let i = 0; i < 2; i++) { const cx = rnd() * w, cy = h * (0.6 + rnd() * 0.25), R = 10 + rnd() * 16;
      wrap3(w, (o) => { g.beginPath(); for (let k = 0; k < 14; k++) { const an = k / 14 * Math.PI * 2, rr = R * (0.6 + rnd() * 0.6); g.lineTo(cx + o + Math.cos(an) * rr * 1.5, cy + Math.sin(an) * rr); }
        g.closePath(); g.fillStyle = 'rgba(176,150,120,0.85)'; g.fill(); g.strokeStyle = 'rgba(110,95,80,0.5)'; g.lineWidth = 2; g.stroke();
        for (let k = 0; k < 8; k++) blob(g, cx + o + (rnd() - 0.5) * R * 2, cy + (rnd() - 0.5) * R, 4 + rnd() * 6, '130,110,90', 0.4); }); }
    // trincas finas
    for (let i = 0; i < 10; i++) { let x = rnd() * w, y = h * (0.2 + rnd() * 0.6); g.strokeStyle = 'rgba(80,72,62,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 10; k++) { x += (rnd() - 0.5) * 18; y += 6 + rnd() * 10; g.lineTo(x, y); } g.stroke(); }
    speck(g, w, h, 14000, '90,80,70', 0.12);
  });
}
export function wallBump() {
  return mk('wallB', 512, 512, (g, w, h) => {
    reseed(12); g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { const x = rnd() * w, y = rnd() * h; wrap3(w, (o) => blob(g, x + o, y, 4 + rnd() * 26, rnd() < 0.5 ? '255,255,255' : '0,0,0', 0.12)); }
    speck(g, w, h, 30000, rnd() < 0.5 ? '255,255,255' : '0,0,0', 0.25);
    speck(g, w, h, 20000, '0,0,0', 0.2);
  }, false);
}
/** madeira pintada com tinta descascada (clara, tingida por instanceColor) */
export function woodTex() {
  return mk('wood', 512, 512, (g, w, h) => {
    reseed(21); g.fillStyle = 'rgb(226,224,220)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = rnd() * w; g.strokeStyle = `rgba(120,110,100,${0.03 + rnd() * 0.07})`; g.lineWidth = 0.6 + rnd() * 2; g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + (rnd() - 0.5) * 12, h * 0.3, x + (rnd() - 0.5) * 12, h * 0.7, x + (rnd() - 0.5) * 8, h); g.stroke(); }
    for (let i = 0; i < 90; i++) { const x = rnd() * w, y = rnd() * h, r = 1.5 + rnd() * 7; g.fillStyle = 'rgba(70,58,46,0.75)'; g.beginPath(); g.ellipse(x, y, r * 0.6, r * (1.5 + rnd() * 2), 0, 0, 7); g.fill(); }
    speck(g, w, h, 6000, '255,255,255', 0.12); speck(g, w, h, 6000, '40,35,30', 0.1);
  });
}
/** porta de duas folhas em tábuas verticais com ferragens (uv 0..1 em toda a porta) */
export function doorTex() {
  return mk('door', 512, 1024, (g, w, h) => {
    reseed(31); g.fillStyle = 'rgb(222,220,215)'; g.fillRect(0, 0, w, h);
    const pw = w / 8;
    for (let k = 0; k < 8; k++) { const x = k * pw; g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '150,140,130'},${0.06 + rnd() * 0.08})`; g.fillRect(x, 0, pw, h);
      for (let i = 0; i < 18; i++) { const gx = x + rnd() * pw; g.strokeStyle = `rgba(110,100,90,${0.05 + rnd() * 0.08})`; g.lineWidth = 0.8 + rnd() * 1.5; g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx + (rnd() - 0.5) * 6, h); g.stroke(); }
      g.fillStyle = 'rgba(30,25,20,0.75)'; g.fillRect(x - 1.5, 0, 3, h); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 2, 0, 1.5, h); }
    g.fillStyle = 'rgba(10,8,6,0.95)'; g.fillRect(w / 2 - 3, 0, 6, h); // junta das folhas
    // dobradiças em "T" e cravos
    for (const v of [0.14, 0.48, 0.82]) for (const side of [0, 1]) { const y = h * (1 - v), x0 = side ? w - 8 : 8, dir = side ? -1 : 1;
      g.fillStyle = 'rgb(38,36,34)'; g.beginPath(); g.moveTo(x0, y - 9); g.lineTo(x0 + dir * w * 0.3, y - 5); g.lineTo(x0 + dir * w * 0.33, y); g.lineTo(x0 + dir * w * 0.3, y + 5); g.lineTo(x0, y + 9); g.fill();
      for (let k = 1; k < 5; k++) { g.fillStyle = 'rgb(20,18,16)'; g.beginPath(); g.arc(x0 + dir * k * w * 0.065, y, 2.6, 0, 7); g.fill(); } }
    for (let r = 0; r < 14; r++) for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(30,26,22,0.8)'; g.beginPath(); g.arc(k * pw + pw / 2, h * (0.06 + r * 0.068), 2, 0, 7); g.fill(); }
    // espelho de fechadura e aldrava
    g.fillStyle = 'rgb(34,32,30)'; g.fillRect(w / 2 + 14, h * 0.5, 22, 60); g.fillStyle = 'rgb(5,5,5)'; g.fillRect(w / 2 + 22, h * 0.5 + 34, 5, 12);
    g.strokeStyle = 'rgb(40,38,36)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2 - 34, h * 0.42, 18, 0, 7); g.stroke();
    // encardido na base e no centro (mãos)
    let gr = g.createLinearGradient(0, h, 0, h * 0.82); gr.addColorStop(0, 'rgba(60,50,40,0.55)'); gr.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.8, w, h * 0.2);
    blob(g, w / 2, h * 0.5, 90, '70,60,50', 0.18);
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(80,66,52,0.7)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1 + rnd() * 4, 2 + rnd() * 9, 0, 0, 7); g.fill(); }
    speck(g, w, h, 5000, '40,35,30', 0.12);
  });
}
/** interior visto pelo vidro: penumbra + cortinas de renda (uv 0..1 no vão) */
export function glassTex() {
  return mk('glass', 256, 512, (g, w, h) => {
    reseed(41); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgb(40,38,36)'); gr.addColorStop(1, 'rgb(18,17,16)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blob(g, w * 0.6, h * 0.45, 120, '90,80,66', 0.35);
    for (const [x0, x1] of [[0, w * 0.34], [w * 0.66, w]]) { for (let x = x0; x < x1; x += 5) { g.fillStyle = `rgba(200,192,176,${0.12 + 0.16 * Math.sin(x * 0.55) ** 2})`; g.fillRect(x, h * 0.12, 4, h * 0.88); }
      for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(30,28,26,0.35)'; g.beginPath(); g.arc(x0 + rnd() * (x1 - x0), h * 0.12 + rnd() * h * 0.88, 1.6, 0, 7); g.fill(); } }
  });
}
/** quartzito (soleiras, degraus, peitoris, lajes das sacadas) */
export function stoneTex() {
  return mk('stone', 512, 512, (g, w, h) => {
    reseed(51); g.fillStyle = 'rgb(160,154,140)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) { const x = rnd() * w, y = rnd() * h; wrap3(w, (o) => blob(g, x + o, y, 10 + rnd() * 60, rnd() < 0.5 ? '200,194,178' : '100,96,86', 0.18)); }
    for (let i = 0; i < 30; i++) { let x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(${rnd() < 0.5 ? '215,210,195' : '90,86,78'},0.3)`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += 10 + rnd() * 30; y += (rnd() - 0.5) * 16; g.lineTo(x, y); } g.stroke(); }
    speck(g, w, h, 16000, '60,58,52', 0.25); speck(g, w, h, 8000, '230,225,210', 0.2);
  });
}
/** telha capa-canal: 4 telhas por metro em u; v=1 = borda exposta (baixo) */
export function tileTex() {
  return mk('tile', 512, 256, (g, w, h) => {
    reseed(61); const tw = w / 8;
    for (let k = 0; k < 8; k++) { const r = 160 + rnd() * 40, gg = 80 + rnd() * 25, b = 48 + rnd() * 15; g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(k * tw, 0, tw, h);
      for (let i = 0; i < 6; i++) blob(g, k * tw + rnd() * tw, rnd() * h, 10 + rnd() * 30, rnd() < 0.5 ? '110,60,40' : '200,120,80', 0.3); }
    // líquen negro e cinza, encardido na borda exposta
    for (let i = 0; i < 160; i++) blob(g, rnd() * w, rnd() * h, 3 + rnd() * 14, rnd() < 0.65 ? '35,30,26' : '190,185,165', 0.4 + rnd() * 0.3);
    const gr = g.createLinearGradient(0, 0, 0, h * 0.35); gr.addColorStop(0, 'rgba(40,30,24,0.5)'); gr.addColorStop(1, 'rgba(40,30,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.35);
    speck(g, w, h, 9000, '40,30,25', 0.25);
  });
}
/** tabuleta de comércio pendurada */
export function signTex(text, bg = 'rgb(40,62,44)', fg = 'rgb(236,214,150)') {
  return mk('sign:' + text, 512, 192, (g, w, h) => {
    reseed(text.length * 97); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`; g.lineWidth = 1 + rnd() * 2; const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (rnd() - 0.5) * 6); g.stroke(); }
    g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24); g.lineWidth = 1.5; g.strokeRect(22, 22, w - 44, h - 44);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n'); const fs = lines.length > 1 ? 50 : 76;
    lines.forEach((ln, i) => { g.font = `bold ${fs}px Georgia, 'Times New Roman', serif`; let s = fs; while (g.measureText(ln).width > w - 70) { s -= 2; g.font = `bold ${s}px Georgia, serif`; }
      g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1); });
    speck(g, w, h, 3000, '0,0,0', 0.25); speck(g, w, h, 1500, '255,255,255', 0.12);
  });
}
/** letreiro pintado à mão na parede (transparente, desbotado) */
export function paintedText(text) {
  return mk('paint:' + text, 1024, 128, (g, w, h) => {
    reseed(77); g.fillStyle = 'rgb(52,62,70)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 84px Georgia, 'Times New Roman', serif`;
    g.save(); g.scale(1, 1); g.fillText(text, w / 2, h / 2 + 4, w - 20); g.restore();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.7})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); }
    for (let i = 0; i < 40; i++) blob(g, rnd() * w, rnd() * h, 10 + rnd() * 30, '0,0,0', 0.4);
  });
}
