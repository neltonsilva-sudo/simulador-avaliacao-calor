// CIDADE (rua colonial) — texturas procedurais em canvas (≤ 1024), compartilhadas pelos módulos street_city*.js
import * as THREE from 'three';

let seed = 77;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const reseed = (s) => { seed = s; };

export function cv(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const noise = (g, w, h, n, a, col = '0,0,0', s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${a * rnd()})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * s, 1 + rnd() * s); } };
const blot = (g, w, h, n, col, a, r0, r1) => {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = r0 + rnd() * (r1 - r0);
    for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${col},${a * (0.4 + rnd() * 0.6)})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
    }
  }
};

/** cal (caiação) branca gasta — 3 m por ladrilho */
export const calTex = () => cv(1024, 1024, (g, w, h) => {
  g.fillStyle = '#ede6d6'; g.fillRect(0, 0, w, h);
  blot(g, w, h, 40, '150,135,110', 0.12, 40, 220); blot(g, w, h, 18, '215,195,140', 0.12, 60, 240); blot(g, w, h, 22, '80,85,70', 0.10, 20, 110);
  blot(g, w, h, 30, '120,110,95', 0.10, 6, 26);
  for (let i = 0; i < 140; i++) { const x = rnd() * w, y = rnd() * h, L = 40 + rnd() * 260; const gr = g.createLinearGradient(0, y, 0, y + L); gr.addColorStop(0, `rgba(85,80,65,${0.06 + rnd() * 0.12})`); gr.addColorStop(1, 'rgba(85,80,65,0)');
    g.strokeStyle = gr; g.lineWidth = 1 + rnd() * 5; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (rnd() - 0.5) * 6, y + L * 0.3, x + (rnd() - 0.5) * 8, y + L * 0.7, x + (rnd() - 0.5) * 6, y + L); g.stroke(); }
  for (let i = 0; i < 18; i++) { const x = rnd() * w, y = rnd() * h; g.fillStyle = `rgba(170,150,120,${0.25 + rnd() * 0.2})`; g.beginPath(); g.ellipse(x, y, 8 + rnd() * 30, 5 + rnd() * 18, rnd() * 3, 0, 7); g.fill(); } // reboco descascado
  for (let i = 0; i < 25; i++) { g.strokeStyle = `rgba(90,80,65,${0.2 + rnd() * 0.2})`; g.lineWidth = 1; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 25; g.lineTo(x, y); } g.stroke(); } // trincas
  noise(g, w, h, 60000, 0.08); noise(g, w, h, 20000, 0.08, '255,255,255');
});

/** cantaria ocre (quartzito/pedra-sabão) com juntas de fiada — 1,5 m por ladrilho */
export const stoneTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#a88a58'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x0 = ((c * 256) + (r % 2) * 128) % w; g.fillStyle = `rgba(${rnd() < 0.5 ? '80,70,45' : '225,200,150'},${0.06 + rnd() * 0.12})`; g.fillRect(x0, r * 128, 256, 128); g.fillRect(x0 - w, r * 128, 256, 128); }
  blot(g, w, h, 40, '55,58,45', 0.22, 6, 40); blot(g, w, h, 16, '40,38,30', 0.2, 20, 80); blot(g, w, h, 20, '150,160,120', 0.12, 4, 16);
  for (let i = 0; i < 50; i++) { const x = rnd() * w, y = rnd() * h, L = 20 + rnd() * 120; g.strokeStyle = `rgba(40,38,30,${0.1 + rnd() * 0.2})`; g.lineWidth = 1 + rnd() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 5, y + L); g.stroke(); }
  noise(g, w, h, 26000, 0.18); noise(g, w, h, 9000, 0.14, '255,240,210'); noise(g, w, h, 3000, 0.3, '30,28,20', 3);
  g.fillStyle = 'rgba(50,40,25,0.6)'; for (let r = 0; r < 4; r++) { g.fillRect(0, r * 128, w, 3); for (let c = 0; c < 2; c++) g.fillRect(((c * 256) + (r % 2) * 128) % w, r * 128, 3, 128); }
  g.fillStyle = 'rgba(255,235,200,0.22)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * 128 + 3, w, 1);
});

/** sujeira de fachada: metade de cima = escorrimentos sob cimalhas; metade de baixo = umidade ascendente (alfa) */
export const grimeTex = () => cv(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { const x = rnd() * w, L = 30 + rnd() * 220, a = 0.15 + rnd() * 0.45; const gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, `rgba(40,36,28,${a})`); gr.addColorStop(1, 'rgba(40,36,28,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 1, 0); g.lineTo(x + 2 + rnd() * 10, 0); g.quadraticCurveTo(x + 3, L * 0.6, x + 1, L); g.lineTo(x, L); g.closePath(); g.fill(); }
  const gr = g.createLinearGradient(0, 0, 0, 40); gr.addColorStop(0, 'rgba(35,32,25,0.55)'); gr.addColorStop(1, 'rgba(35,32,25,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, 40);
  // umidade ascendente (v 0..0.5 → canvas y 256..512)
  for (let x = 0; x < w; x += 4) { const top = 256 + 40 + Math.sin(x * 0.03) * 25 + Math.sin(x * 0.11) * 12 + rnd() * 10;
    const gg = g.createLinearGradient(0, top, 0, 512); gg.addColorStop(0, 'rgba(60,62,48,0)'); gg.addColorStop(0.25, 'rgba(60,62,48,0.35)'); gg.addColorStop(1, 'rgba(45,45,35,0.75)'); g.fillStyle = gg; g.fillRect(x, top, 4, 512 - top); }
  noise(g, w, 256, 4000, 0.15, '30,30,25'); g.save(); g.translate(0, 256); noise(g, w, 256, 6000, 0.25, '40,40,30'); g.restore();
}, { repeat: false });

/** cúpula de chapa com costuras verticais e pátina cinza */
export const domeTex = () => cv(512, 256, (g, w, h) => {
  g.fillStyle = '#8f9493'; g.fillRect(0, 0, w, h);
  blot(g, w, h, 30, '60,64,62', 0.25, 10, 60); blot(g, w, h, 20, '190,195,190', 0.18, 10, 50);
  for (let i = 0; i < 32; i++) { const x = i * w / 32; g.fillStyle = 'rgba(40,42,40,0.6)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(220,225,220,0.35)'; g.fillRect(x + 2, 0, 1, h); }
  for (let i = 0; i < 90; i++) { const x = rnd() * w; g.fillStyle = `rgba(35,38,36,${0.1 + rnd() * 0.25})`; g.fillRect(x, rnd() * h * 0.6, 1 + rnd() * 3, 40 + rnd() * 120); }
  noise(g, w, h, 8000, 0.15);
});

/** pé-de-moleque do adro */
export const cobbleTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#3b3a35'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h + 20; y += 22) for (let x = -(y % 44 ? 14 : 0); x < w + 20; x += 26 + rnd() * 6) { const v = 80 + rnd() * 50 | 0, b = v + (rnd() * 18 | 0);
    g.fillStyle = `rgb(${v},${v + 2},${b})`; g.beginPath(); g.ellipse(x, y + (rnd() - 0.5) * 4, 10 + rnd() * 4, 8 + rnd() * 3, rnd(), 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(x - 3, y - 3, 5, 3, 0, 0, 7); g.fill(); }
  blot(g, w, h, 20, '70,80,50', 0.15, 6, 30); noise(g, w, h, 12000, 0.15);
});

/** alvenaria de pedra (muro de arrimo do adro) — 2,5 m */
export const ashlarTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#9c927e'; g.fillRect(0, 0, w, h);
  let y = 0; while (y < h) { const rh = 40 + rnd() * 50; let x = -rnd() * 60; while (x < w) { const bw = 60 + rnd() * 90, v = 120 + rnd() * 50 | 0;
    g.fillStyle = `rgb(${v + 8},${v},${v - 18})`; g.fillRect(x + 3, y + 3, bw - 6, Math.min(rh, h - y) - 6); x += bw; } y += rh; }
  blot(g, w, h, 30, '60,62,45', 0.18, 10, 50); noise(g, w, h, 20000, 0.16); noise(g, w, h, 6000, 0.1, '255,250,235');
});

/** lajes de quartzito do adro — 2,5 m */
export const lajeTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#5b554a'; g.fillRect(0, 0, w, h);
  const rows = [0, 150, 300, 420, 512]; for (let r = 0; r < 4; r++) { let x = -rnd() * 80; while (x < w) { const bw = 110 + rnd() * 120, v = 150 + rnd() * 35 | 0;
    g.fillStyle = `rgb(${v},${v - 6},${v - 20})`; g.fillRect(x + 3, rows[r] + 3, bw - 5, rows[r + 1] - rows[r] - 5); x += bw; } }
  blot(g, w, h, 25, '70,70,55', 0.15, 10, 60); blot(g, w, h, 10, '210,200,180', 0.12, 20, 80); noise(g, w, h, 22000, 0.15); noise(g, w, h, 8000, 0.1, '255,255,245');
});

/** telha capa-canal: canais correm ao longo de u (caimento), sobreposições a cada 0,5 m — 2 m */
export const roofTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#5a2c1c'; g.fillRect(0, 0, w, h);
  const bands = 8, bh = h / bands, cols = 4, cw = w / cols;
  for (let b = 0; b < bands; b++) for (let c = 0; c < cols; c++) {
    const r = 150 + rnd() * 45, gg = 70 + rnd() * 30, bb = 45 + rnd() * 20, capa = b % 2 === 0;
    const gr = g.createLinearGradient(0, b * bh, 0, (b + 1) * bh);
    const lo = capa ? 0.55 : 0.4, hi = capa ? 1.12 : 0.82;
    gr.addColorStop(0, `rgb(${r * lo | 0},${gg * lo | 0},${bb * lo | 0})`); gr.addColorStop(0.5, `rgb(${Math.min(255, r * hi) | 0},${gg * hi | 0},${bb * hi | 0})`); gr.addColorStop(1, `rgb(${r * lo | 0},${gg * lo | 0},${bb * lo | 0})`);
    g.fillStyle = gr; g.fillRect(c * cw + (b % 2) * 18, b * bh + 1, cw - 4, bh - 2);
    g.fillStyle = 'rgba(30,15,8,0.55)'; g.fillRect(c * cw + (b % 2) * 18 + cw - 8, b * bh, 6, bh);
  }
  blot(g, w, h, 30, '40,40,30', 0.22, 10, 50); blot(g, w, h, 12, '120,120,95', 0.12, 10, 40); noise(g, w, h, 14000, 0.16);
});

/** porta de duas folhas em almofadas (bordô) com topo em arco — u/v normalizados */
export const doorTex = (col = '#6b2420') => cv(256, 512, (g, w, h) => {
  g.fillStyle = col; g.fillRect(0, 0, w, h); noise(g, w, h, 6000, 0.12);
  for (let x = 0; x < w; x += 6) { g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`; g.fillRect(x, 0, 1, h); }
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(w / 2 - 2, 0, 4, h);
  for (const x0 of [14, w / 2 + 10]) for (const [y0, y1] of [[90, 250], [270, 400], [418, 490]]) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0, y0, w / 2 - 24, y1 - y0); g.fillStyle = 'rgba(255,220,200,0.12)'; g.fillRect(x0 + 6, y0 + 6, w / 2 - 36, y1 - y0 - 12);
    g.strokeStyle = 'rgba(255,230,210,0.18)'; g.lineWidth = 2; g.strokeRect(x0 + 1, y0 + 1, w / 2 - 26, y1 - y0 - 2);
  }
  g.fillStyle = '#c9a24a'; g.fillRect(w / 2 - 12, 300, 6, 22); g.fillRect(w / 2 + 6, 300, 6, 22);
}, { repeat: false });

/** janela de guilhotina com caixilho branco e vidro escuro refletindo o céu */
export const windowTex = () => cv(256, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3d5468'); gr.addColorStop(0.5, '#1a222b'); gr.addColorStop(1, '#2a3846');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(190,215,235,0.18)'; g.beginPath(); g.moveTo(0, 60); g.lineTo(w, 0); g.lineTo(w, 50); g.lineTo(0, 140); g.fill();
  g.fillStyle = '#ece8de'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 18, w, 18); g.fillRect(0, 0, 18, h); g.fillRect(w - 18, 0, 18, h); g.fillRect(0, h / 2 - 9, w, 18);
  for (const x of [w / 3, 2 * w / 3]) g.fillRect(x - 4, 0, 8, h); for (const y of [h / 4, 3 * h / 4]) g.fillRect(0, y - 4, w, 8);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(18, 18, w - 36, 6); noise(g, w, h, 1500, 0.1);
}, { repeat: false });

/** relevo da portada: cartela barroca com concha, volutas e coroa (alfa) — sombreamento pintado */
export const reliefTex = () => cv(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h); const cx = w / 2;
  const stoneFill = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#d9b678'); gr.addColorStop(1, '#8e6c3c'); return gr; };
  const scroll = (x, y, r, dir) => { g.lineWidth = 16; g.strokeStyle = '#6e5230'; g.beginPath(); g.arc(x + 3, y + 4, r, 0, Math.PI * 1.6 * dir, dir < 0); g.stroke(); g.strokeStyle = '#d8b577'; g.lineWidth = 11; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 1.6 * dir, dir < 0); g.stroke(); };
  // cartela
  g.fillStyle = 'rgba(60,40,20,0.5)'; g.beginPath(); g.ellipse(cx + 6, 280, 150, 175, 0, 0, 7); g.fill();
  g.fillStyle = stoneFill(100, 460); g.beginPath(); g.ellipse(cx, 274, 150, 175, 0, 0, 7); g.fill();
  g.fillStyle = '#7e5f35'; g.beginPath(); g.ellipse(cx, 280, 112, 135, 0, 0, 7); g.fill();
  g.fillStyle = stoneFill(150, 420); g.beginPath(); g.ellipse(cx - 3, 276, 106, 129, 0, 0, 7); g.fill();
  // concha (vieira) com raios
  for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.08 + 0.084 * i); g.strokeStyle = 'rgba(80,58,30,0.75)'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, 360); g.lineTo(cx - Math.cos(a) * 95, 360 - Math.sin(a) * 140); g.stroke();
    g.strokeStyle = 'rgba(245,220,170,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 3, 358); g.lineTo(cx - Math.cos(a) * 95 + 4, 358 - Math.sin(a) * 140); g.stroke(); }
  // volutas laterais e coroa
  scroll(cx - 150, 360, 34, 1); scroll(cx + 150, 360, 34, -1); scroll(cx - 130, 150, 26, -1); scroll(cx + 130, 150, 26, 1);
  g.fillStyle = stoneFill(20, 110); g.beginPath(); g.moveTo(cx - 70, 110); for (let i = 0; i <= 4; i++) { g.lineTo(cx - 70 + i * 35, i % 2 ? 60 : 28); } g.lineTo(cx + 70, 110); g.closePath(); g.fill();
  g.strokeStyle = '#6e5230'; g.lineWidth = 4; g.stroke(); g.fillStyle = '#e4c58c'; g.beginPath(); g.arc(cx, 22, 14, 0, 7); g.fill();
  // festões
  for (const s of [-1, 1]) { g.strokeStyle = '#6e5230'; g.lineWidth = 14; g.beginPath(); g.moveTo(cx + s * 100, 470); g.quadraticCurveTo(cx + s * 40, 510, cx, 480); g.stroke(); g.strokeStyle = '#cfab6c'; g.lineWidth = 9; g.stroke(); }
}, { repeat: false });

/** óculo / vidro escuro */
export const darkTex = () => cv(64, 64, (g, w, h) => { g.fillStyle = '#151a1f'; g.fillRect(0, 0, w, h); noise(g, w, h, 300, 0.2, '120,140,160'); });

/** casa distante (variante v: 0–1 térreo, 2–3 sobrado), cor de esquadria variada */
const FRAMES = ['#2f4f86', '#7a2522', '#2f5a40', '#b0802c'];
export const farHouseTex = (v) => cv(256, 256, (g, w, h) => {
  g.fillStyle = '#f2eee6'; g.fillRect(0, 0, w, h); blot(g, w, h, 12, '120,110,90', 0.12, 10, 60); noise(g, w, h, 5000, 0.08);
  const fc = FRAMES[v % 4], two = v >= 2;
  const gr = g.createLinearGradient(0, h - 40, 0, h); gr.addColorStop(0, 'rgba(80,75,60,0)'); gr.addColorStop(1, 'rgba(80,75,60,0.45)'); g.fillStyle = gr; g.fillRect(0, h - 40, w, 40);
  g.fillStyle = 'rgba(60,55,45,0.35)'; g.fillRect(0, 0, w, 10); // sombra do beiral
  const win = (x, y, ww, hh, door) => { g.fillStyle = fc; g.fillRect(x - 5, y - 5, ww + 10, hh + 5); g.fillStyle = door ? '#4a2e20' : '#1c2128'; g.fillRect(x, y, ww, hh); if (!door) { g.fillStyle = 'rgba(230,230,225,0.8)'; g.fillRect(x + ww / 2 - 1, y, 2, hh); g.fillRect(x, y + hh / 2 - 1, ww, 2); } };
  const rows = two ? [[30, 70], [150, 80]] : [[90, 110]];
  rows.forEach(([y, hh], r) => { for (let i = 0; i < 4; i++) { const x = 20 + i * 60; win(x, y, 34, hh - (r === rows.length - 1 && i % 3 ? 20 : 0), r === rows.length - 1 && (i === 1 || (v % 2 && i === 3))); } });
  if (two) { g.fillStyle = '#1a1a1a'; g.fillRect(10, 98, w - 20, 3); for (let x = 12; x < w - 10; x += 6) g.fillRect(x, 82, 1.5, 18); g.fillStyle = 'rgba(80,75,65,0.6)'; g.fillRect(8, 100, w - 16, 6); }
}, { repeat: false });
/** telhado distante (canais ao longo de v, fiadas ao longo de u) */
export const farRoofTex = () => cv(256, 256, (g, w, h) => {
  g.fillStyle = '#a65a3c'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { g.fillStyle = `rgba(${rnd() < 0.5 ? '60,25,15' : '220,150,110'},${0.15 + rnd() * 0.2})`; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(40,18,10,0.4)'; g.fillRect(x + 6, 0, 2, h); }
  for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(40,18,10,0.3)'; g.fillRect(0, y, w, 2); }
  blot(g, w, h, 25, '40,40,30', 0.3, 8, 40); noise(g, w, h, 6000, 0.2);
});

/** atlas de árvores (4 colunas): mata densa, árvore do cerrado retorcida, arbusto, árvore alta — alfa */
export const treeAtlas = () => cv(1024, 512, (g, W, H) => {
  g.clearRect(0, 0, W, H);
  const cw = 256;
  const trunk = (cx, y0, y1, wd, bend) => { g.strokeStyle = '#3e2f22'; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx, y0); g.bezierCurveTo(cx + bend, y0 - (y0 - y1) * 0.4, cx - bend, y0 - (y0 - y1) * 0.7, cx + bend * 0.5, y1); g.stroke(); };
  const crown = (cx, cy, rx, ry, n, cols, sz) => { for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()), x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      const shade = (x - cx) / rx * 0.5 + (y - cy) / ry * 0.6; const c = cols[(rnd() * cols.length) | 0], k = 1 - Math.max(-0.35, Math.min(0.5, shade)) * 0.7;
      g.fillStyle = `rgb(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0})`; g.beginPath(); g.ellipse(x, y, sz * (0.6 + rnd() * 0.8), sz * (0.5 + rnd() * 0.6), rnd() * 3, 0, 7); g.fill(); } };
  const dark = [[44, 70, 34], [56, 84, 40], [38, 60, 30], [70, 96, 48]], cer = [[96, 104, 52], [80, 92, 44], [120, 118, 62], [66, 82, 40]];
  // 0 mata
  trunk(128, 512, 300, 14, 10); crown(128, 220, 118, 190, 900, dark, 14);
  // 1 cerrado retorcido
  g.save(); g.translate(cw, 0);
  trunk(120, 512, 250, 12, 40); g.strokeStyle = '#3e2f22'; g.lineWidth = 6; g.beginPath(); g.moveTo(125, 330); g.quadraticCurveTo(170, 300, 200, 240); g.moveTo(118, 300); g.quadraticCurveTo(70, 270, 50, 220); g.stroke();
  crown(200, 215, 55, 45, 220, cer, 11); crown(55, 205, 50, 40, 200, cer, 11); crown(125, 180, 70, 55, 300, cer, 11); g.restore();
  // 2 arbusto
  g.save(); g.translate(2 * cw, 0); crown(128, 420, 120, 90, 700, [[70, 90, 44], [90, 100, 50], [52, 72, 36]], 12); g.restore();
  // 3 árvore alta (copa estreita)
  g.save(); g.translate(3 * cw, 0); trunk(128, 512, 120, 10, 6); crown(128, 170, 70, 160, 700, dark, 12); g.restore();
}, { repeat: false });

/** placa de comércio pendurada (madeira pintada) */
export const signTex = (txt, bg, fg) => cv(512, 256, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 0.15);
  g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(16, 16, w - 32, h - 32);
  g.fillStyle = fg; g.font = `bold ${txt.length > 9 ? 62 : 80}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4);
  blot(g, w, h, 10, '0,0,0', 0.12, 10, 50);
}, { repeat: false });

/** roupas no varal: camiseta, toalha listrada, calça (alfa) */
export const clothTex = () => cv(768, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = '#c8453a'; g.beginPath(); g.moveTo(40, 20); g.lineTo(90, 10); g.lineTo(166, 10); g.lineTo(216, 20); g.lineTo(240, 80); g.lineTo(200, 90); g.lineTo(196, 240); g.lineTo(60, 240); g.lineTo(56, 90); g.lineTo(16, 80); g.closePath(); g.fill();
  for (let y = 0; y < 240; y += 40) { g.fillStyle = '#e8e2d0'; g.fillRect(270, 10 + y, 220, 22); g.fillStyle = '#3a6aa0'; g.fillRect(270, 32 + y, 220, 18); }
  g.fillStyle = '#34445e'; g.beginPath(); g.moveTo(560, 10); g.lineTo(720, 10); g.lineTo(730, 250); g.lineTo(660, 250); g.lineTo(640, 90); g.lineTo(620, 250); g.lineTo(550, 250); g.closePath(); g.fill();
  noise(g, w, h, 6000, 0.15);
}, { repeat: false });

/** detalhe do terreno (multiplicado pela cor de vértice) */
export const groundTex = () => cv(256, 256, (g, w, h) => { g.fillStyle = '#d6d6cc'; g.fillRect(0, 0, w, h); blot(g, w, h, 30, '60,70,40', 0.18, 5, 30); noise(g, w, h, 9000, 0.2); noise(g, w, h, 3000, 0.15, '255,255,240'); });

/** placa de esmalte azul e branca */
export const plaqueTex = (txt) => cv(512, 200, (g, w, h) => {
  const rr = (x, y, ww, hh, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + ww, y, x + ww, y + hh, r); g.arcTo(x + ww, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + ww, y, r); g.closePath(); };
  g.fillStyle = '#f4f2ec'; rr(2, 2, w - 4, h - 4, 26); g.fill(); g.fillStyle = '#1d4c9a'; rr(14, 14, w - 28, h - 28, 18); g.fill();
  g.strokeStyle = '#f4f2ec'; g.lineWidth = 4; rr(26, 26, w - 52, h - 52, 12); g.stroke();
  g.fillStyle = '#f7f5ef'; g.font = 'bold 76px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4);
  noise(g, w, h, 900, 0.12); g.fillStyle = 'rgba(40,30,20,0.5)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(rnd() * w, rnd() < 0.5 ? 8 + rnd() * 8 : h - 14, 3 + rnd() * 5, 0, 7); g.fill(); }
  for (const [x, y] of [[20, h / 2], [w - 20, h / 2]]) { g.fillStyle = '#8d8a84'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
}, { repeat: false });
