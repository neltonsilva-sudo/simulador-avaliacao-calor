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
export const calTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#efe9dc'; g.fillRect(0, 0, w, h);
  blot(g, w, h, 26, '150,135,110', 0.10, 30, 120); blot(g, w, h, 14, '220,200,150', 0.10, 40, 140); blot(g, w, h, 10, '95,100,85', 0.06, 20, 70);
  for (let i = 0; i < 60; i++) { const x = rnd() * w, y = rnd() * h; g.strokeStyle = `rgba(110,100,85,${0.05 + rnd() * 0.07})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y + 20 + rnd() * 70); g.stroke(); }
  noise(g, w, h, 16000, 0.07); noise(g, w, h, 5000, 0.08, '255,255,255');
});

/** cantaria ocre (quartzito/pedra-sabão) com juntas de fiada — 1,5 m por ladrilho */
export const stoneTex = () => cv(512, 512, (g, w, h) => {
  g.fillStyle = '#b48f55'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x0 = ((c * 256) + (r % 2) * 128) % w; g.fillStyle = `rgba(${rnd() < 0.5 ? '90,70,40' : '235,205,150'},${0.05 + rnd() * 0.1})`; g.fillRect(x0, r * 128, 256, 128); g.fillRect(x0 - w, r * 128, 256, 128); }
  blot(g, w, h, 30, '70,66,48', 0.16, 8, 40); blot(g, w, h, 12, '60,50,35', 0.12, 20, 70);
  noise(g, w, h, 22000, 0.14); noise(g, w, h, 9000, 0.12, '255,240,210');
  g.fillStyle = 'rgba(60,45,28,0.55)'; for (let r = 0; r < 4; r++) { g.fillRect(0, r * 128, w, 2); for (let c = 0; c < 2; c++) g.fillRect(((c * 256) + (r % 2) * 128) % w, r * 128, 2, 128); }
  g.fillStyle = 'rgba(255,235,200,0.25)'; for (let r = 0; r < 4; r++) g.fillRect(0, r * 128 + 2, w, 1);
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

/** casa distante: parede caiada com janelas e porta (faces do cubo instanciado) */
export const farHouseTex = () => cv(128, 128, (g, w, h) => {
  g.fillStyle = '#f2eee6'; g.fillRect(0, 0, w, h); noise(g, w, h, 1500, 0.08);
  g.fillStyle = 'rgba(120,110,95,0.35)'; g.fillRect(0, h - 10, w, 10);
  for (const y of [22, 70]) for (const x of [16, 54, 92]) { if (y === 70 && x === 54) { g.fillStyle = '#5b3624'; g.fillRect(x - 2, y - 2, 24, 60); continue; } g.fillStyle = '#3e5a7a'; g.fillRect(x - 3, y - 3, 26, 34); g.fillStyle = '#1b2026'; g.fillRect(x, y, 20, 28); }
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
