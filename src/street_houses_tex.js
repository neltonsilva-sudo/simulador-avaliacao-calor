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
      wrap3(w, (o) => blob(g, x + o, y, r, k ? '255,255,250' : '140,128,104', k ? 0.25 : 0.11)); }
    // pinceladas de cal (horizontais, suaves)
    for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(${rnd() < 0.5 ? '255,255,252' : '170,160,140'},${0.05 * rnd()})`;
      g.lineWidth = 2 + rnd() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + rnd() * 90, y + (rnd() - 0.5) * 8); g.stroke(); }
    // umidade ascendente (base)
    let gr = g.createLinearGradient(0, h, 0, h * 0.72); gr.addColorStop(0, 'rgba(72,70,56,0.75)'); gr.addColorStop(0.5, 'rgba(95,98,78,0.3)'); gr.addColorStop(1, 'rgba(95,98,78,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
    for (let i = 0; i < 70; i++) { const x = rnd() * w, y = h - rnd() * h * 0.2, r = 30 + rnd() * 80; wrap3(w, (o) => blob(g, x + o, y, r, rnd() < 0.6 ? '90,92,70' : '120,105,80', 0.22)); }
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = h * (0.78 + rnd() * 0.12); wrap3(w, (o) => { g.strokeStyle = 'rgba(110,100,80,0.18)'; g.lineWidth = 1.5; g.beginPath();
      g.moveTo(x + o - 60, y); g.bezierCurveTo(x + o - 20, y - 18 * rnd(), x + o + 20, y + 14 * rnd(), x + o + 60, y); g.stroke(); }); }
    // encardido sob o beiral + escorridos largos e irregulares (água do beiral)
    gr = g.createLinearGradient(0, 0, 0, h * 0.2); gr.addColorStop(0, 'rgba(62,56,46,0.6)'); gr.addColorStop(1, 'rgba(62,56,46,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h * 0.2);
    for (let i = 0; i < 26; i++) { const x = rnd() * w, L = h * (0.12 + rnd() * 0.42), lw = 14 + rnd() * 50, a = 0.08 + rnd() * 0.14, col = rnd() < 0.7 ? '60,58,48' : '96,84,60';
      wrap3(w, (o) => { g.save(); g.beginPath(); g.moveTo(x + o, 0); let yy = 0, xl = x + o, xr = x + o + lw;
        const pts = []; for (let k = 0; k <= 12; k++) { yy = L * k / 12; pts.push([xl + (rnd() - 0.5) * lw * 0.3 + lw * 0.3 * (k / 12), yy]); }
        for (const [px, py] of pts) g.lineTo(px, py); for (let k = 12; k >= 0; k--) g.lineTo(xr - lw * 0.3 * (k / 12) + (rnd() - 0.5) * lw * 0.3, L * k / 12);
        g.closePath(); const lg = g.createLinearGradient(0, 0, 0, L); lg.addColorStop(0, `rgba(${col},${a})`); lg.addColorStop(0.7, `rgba(${col},${a * 0.5})`); lg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = lg; g.fill(); g.restore(); }); }
    for (let i = 0; i < 50; i++) { const x = rnd() * w, L = h * (0.05 + rnd() * 0.2), lw = 2 + rnd() * 5, a = 0.05 + rnd() * 0.08;
      wrap3(w, (o) => { const lg = g.createLinearGradient(0, 0, 0, L); lg.addColorStop(0, `rgba(70,64,54,${a})`); lg.addColorStop(1, 'rgba(70,64,54,0)'); g.fillStyle = lg; g.fillRect(x + o, 0, lw, L); }); }
    // linha de maré da umidade (sobre o barrado) e manchas escorrendo de peitoris
    for (let i = 0; i < 30; i++) { const x = rnd() * w, y = h * (0.74 + rnd() * 0.06); wrap3(w, (o) => blob(g, x + o, y, 30 + rnd() * 50, '110,108,84', 0.16)); }
    // reboco descascado mostrando tijolo / pedra
    for (let i = 0; i < 5; i++) { const cx = rnd() * w, cy = h * (0.35 + rnd() * 0.5), R = 14 + rnd() * 34, brick = rnd() < 0.6;
      wrap3(w, (o) => { g.save(); g.beginPath(); for (let k = 0; k < 16; k++) { const an = k / 16 * Math.PI * 2, rr = R * (0.55 + rnd() * 0.6); g.lineTo(cx + o + Math.cos(an) * rr * 1.6, cy + Math.sin(an) * rr); }
        g.closePath(); g.fillStyle = 'rgba(150,135,115,1)'; g.fill(); g.clip();
        if (brick) { for (let yy = cy - R * 1.2, row = 0; yy < cy + R * 1.2; yy += 9, row++) for (let xx = cx + o - R * 2 + (row % 2) * 9; xx < cx + o + R * 2; xx += 19) {
            g.fillStyle = `rgb(${128 + rnd() * 30 | 0},${88 + rnd() * 20 | 0},${68 + rnd() * 14 | 0})`; g.fillRect(xx, yy, 17, 7); } }
        else { for (let k = 0; k < 14; k++) { g.fillStyle = `rgb(${120 + rnd() * 50 | 0},${110 + rnd() * 40 | 0},${90 + rnd() * 30 | 0})`; g.beginPath(); g.ellipse(cx + o + (rnd() - 0.5) * R * 3, cy + (rnd() - 0.5) * R * 2, 6 + rnd() * 10, 5 + rnd() * 7, rnd() * 3, 0, 7); g.fill(); } }
        g.restore(); g.save(); g.beginPath(); for (let k = 0; k < 16; k++) { const an = k / 16 * Math.PI * 2, rr = R * (0.7 + 0.5 * rnd()); g.lineTo(cx + o + Math.cos(an) * rr * 1.7, cy + Math.sin(an) * rr * 1.1); }
        g.closePath(); g.strokeStyle = 'rgba(110,100,85,0.18)'; g.lineWidth = 6; g.stroke(); g.restore(); }); }
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
    for (const [x, y, ww, hh, dx, dy] of [[0, 0, 40, h, 1, 0], [w - 40, 0, 40, h, -1, 0], [0, 0, w, 90, 0, 1]]) { const lg = g.createLinearGradient(dx < 0 ? w : 0, dy ? 0 : 0, dx ? (dx > 0 ? 40 : w - 40) : 0, dy ? 90 : 0); lg.addColorStop(0, 'rgba(20,16,12,0.55)'); lg.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = lg; g.fillRect(x, y, ww, hh); }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(80,66,52,0.7)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1 + rnd() * 4, 2 + rnd() * 9, 0, 0, 7); g.fill(); }
    speck(g, w, h, 5000, '40,35,30', 0.12);
  });
}
/** interior visto pelo vidro: penumbra + cortinas de renda (uv 0..1 no vão) */
export function glassTex() {
  return mk('glass', 256, 512, (g, w, h) => {
    reseed(41); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgb(40,38,36)'); gr.addColorStop(1, 'rgb(18,17,16)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    blob(g, w * 0.6, h * 0.45, 120, '90,80,66', 0.35);
    for (const [x0, x1] of [[0, w * 0.34], [w * 0.66, w]]) { for (let x = x0; x < x1; x += 5) { g.fillStyle = `rgba(190,182,166,${0.06 + 0.1 * Math.sin(x * 0.55) ** 2})`; g.fillRect(x, h * 0.12, 4, h * 0.88); }
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
/** porta almofadada (duas folhas com almofadas em relevo pintado) */
export function panelDoorTex() {
  return mk('door2', 512, 1024, (g, w, h) => {
    reseed(33); g.fillStyle = 'rgb(222,220,214)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 200; i++) { const x = rnd() * w; g.strokeStyle = `rgba(120,110,100,${0.04 + rnd() * 0.05})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 6, h); g.stroke(); }
    for (const x0 of [0, w / 2]) for (const [v0, v1] of [[0.08, 0.36], [0.42, 0.62], [0.68, 0.9]]) { const x = x0 + 30, y = h * (1 - v1), pw = w / 2 - 60, ph = h * (v1 - v0);
      g.fillStyle = 'rgba(40,34,28,0.45)'; g.fillRect(x, y, pw, 5); g.fillRect(x, y, 5, ph); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x, y + ph - 5, pw, 5); g.fillRect(x + pw - 5, y, 5, ph);
      g.strokeStyle = 'rgba(40,34,28,0.35)'; g.lineWidth = 2; g.strokeRect(x + 14, y + 14, pw - 28, ph - 28); }
    g.fillStyle = 'rgba(10,8,6,0.95)'; g.fillRect(w / 2 - 3, 0, 6, h);
    g.fillStyle = 'rgb(30,28,26)'; g.fillRect(w / 2 + 12, h * 0.5, 18, 50);
    let gr = g.createLinearGradient(0, h, 0, h * 0.85); gr.addColorStop(0, 'rgba(60,50,40,0.5)'); gr.addColorStop(1, 'rgba(60,50,40,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.85, w, h * 0.15);
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(80,66,52,0.6)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1 + rnd() * 4, 2 + rnd() * 8, 0, 0, 7); g.fill(); }
    speck(g, w, h, 4000, '40,35,30', 0.1);
  });
}
/** veneziana (palhetas horizontais) — uv 0..1 por folha */
export function louverTex() {
  return mk('louver', 256, 512, (g, w, h) => {
    reseed(35); g.fillStyle = 'rgb(220,218,214)'; g.fillRect(0, 0, w, h);
    for (let y = 30; y < h - 30; y += 14) { g.fillStyle = 'rgba(30,28,26,0.55)'; g.fillRect(22, y + 9, w - 44, 4); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(22, y, w - 44, 3); }
    g.strokeStyle = 'rgba(40,36,30,0.6)'; g.lineWidth = 4; g.strokeRect(20, 26, w - 40, h - 52);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(80,66,52,0.6)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 1 + rnd() * 3, 2 + rnd() * 5, 0, 0, 7); g.fill(); }
    speck(g, w, h, 3000, '40,35,30', 0.12);
  });
}
