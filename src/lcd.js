// Visor TFT 320×240 do medidor de IBUTG "iTemp" — dono: FIRMWARE. Desenho vetorial em Canvas2D (fontes reais, linhas
// suaves) numa tela 640×480 (2×). Layout medido na FOTO 1 (refs/ref_medidor.png: tela principal) e na FOTO 2
// (refs/ref_ambiente.webp: tela de mostradores circulares). Separador decimal: ponto, como no aparelho.
import { MENUS, PAGES, DEVICE, INTERVALS, hms, hhmm, pad2, fmtT, fmtDate, fmtInterval, ibutgInt, ibutgExt, rhEstimate, BOOT_S, OFF_S, LOW_BATT } from './fw_core.js';

export const LW = 320, LH = 240, SCALE = 2;
const F = {
  sans: 'Inter, "Helvetica Neue", Arial, sans-serif',
  cond: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
  mono: '"Roboto Mono", Menlo, Consolas, monospace',
};
const C = {
  bg0: '#06080c', bg1: '#020305', white: '#f3f5f9', txt: '#dfe7f3', val: '#d4e1f6', dim: '#8d9ab0', faint: '#4a566c',
  blue: '#3a7af2', blueHi: '#6aa0ff', blueDk: '#1d4fc4', navy: '#0b1f52', sq: '#3d72e8', red: '#ef3b32', amber: '#ffb72e',
  green: '#3fd14a', warn: '#ffb72e', err: '#ff5a4a', sel0: '#3a7cf4', sel1: '#2257d6',
};

export function createLCD() {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  canvas.width = LW * SCALE; canvas.height = LH * SCALE;
  const ctx0 = canvas.getContext('2d');
  let X = ctx0; // contexto ativo (o mesmo desenho serve para o painel em alta resolução da UI)
  let fontsReady = false;
  const lcd = { canvas, backlight: 1, draw, drawTo, onFonts: null };
  if (typeof document !== 'undefined' && document.fonts) {
    Promise.all(['700 20px Inter', '500 13px Inter', '400 20px Inter', '700 13px "Roboto Condensed"', '500 11px "Roboto Mono"']
      .map((f) => document.fonts.load(f).catch(() => null))).then(() => { fontsReady = true; lcd.onFonts?.(); });
  }

  // ── primitivas ──
  const font = (w, px, fam = 'sans') => { X.font = `${w} ${px}px ${F[fam]}`; };
  function text(str, x, y, { w = 500, px = 12, fam = 'sans', col = C.txt, align = 'left', maxW, ls } = {}) {
    font(w, px, fam); X.fillStyle = col; X.textAlign = align; X.textBaseline = 'alphabetic';
    if (ls != null && 'letterSpacing' in X) X.letterSpacing = `${ls}px`;
    if (maxW) { const m = X.measureText(str).width; if (m > maxW) { X.save(); const k = maxW / m; const ax = align === 'center' ? x : align === 'right' ? x : x; X.translate(ax, y); X.scale(k, 1); X.fillText(str, 0, 0); X.restore(); if (ls != null && 'letterSpacing' in X) X.letterSpacing = '0px'; return maxW; } }
    X.fillText(str, x, y);
    const m = X.measureText(str).width;
    if (ls != null && 'letterSpacing' in X) X.letterSpacing = '0px';
    return m;
  }
  const measure = (str, w, px, fam = 'sans') => { font(w, px, fam); return X.measureText(str).width; };
  function rr(x, y, w, h, r) { X.beginPath(); X.roundRect(x, y, w, h, r); }
  function hline(x0, x1, y, col = '#4b84f6', lw = 2.7) {
    X.save(); X.strokeStyle = col; X.lineWidth = lw; X.lineCap = 'round';
    X.shadowColor = 'rgba(70,130,255,0.55)'; X.shadowBlur = 2.5;
    X.beginPath(); X.moveTo(x0, y); X.lineTo(x1, y); X.stroke(); X.restore();
  }
  function background() {
    const g = X.createRadialGradient(LW * 0.5, LH * 0.45, 20, LW * 0.5, LH * 0.5, LW * 0.75);
    g.addColorStop(0, C.bg0); g.addColorStop(1, C.bg1); X.fillStyle = g; X.fillRect(0, 0, LW, LH);
  }
  function blueBar(x, y, w, h, r = 7) {
    const g = X.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#4b8af6'); g.addColorStop(0.5, '#336de4'); g.addColorStop(1, '#2457cc');
    rr(x, y, w, h, r); X.fillStyle = g; X.fill();
    X.save(); rr(x + 0.6, y + 0.6, w - 1.2, h - 1.2, r - 0.6); X.strokeStyle = 'rgba(190,215,255,0.45)'; X.lineWidth = 0.8; X.stroke(); X.restore();
  }
  function batteryIcon(x, y, pct, { vertical = true, blink = false, big = false } = {}) {
    const low = pct < LOW_BATT; const col = low ? C.err : C.green;
    if (low && blink) return;
    if (vertical) { // ícone vertical como na FOTO 1 (x,y = canto superior esquerdo; 7×13)
      const bw = big ? 8 : 7, bh = big ? 14 : 12;
      X.fillStyle = '#d8dee8'; X.fillRect(x + bw / 2 - 1.6, y, 3.2, 1.6);
      rr(x, y + 1.5, bw, bh, 1.4); X.strokeStyle = '#d8dee8'; X.lineWidth = 1; X.stroke();
      const h = Math.max(1, (bh - 2.2) * Math.min(1, pct / 100)); X.fillStyle = col; X.fillRect(x + 1.1, y + 1.5 + bh - 1.1 - h, bw - 2.2, h);
    } else {
      rr(x, y, 16, 8, 1.5); X.strokeStyle = '#eef3ff'; X.lineWidth = 0.9; X.stroke(); X.fillStyle = '#eef3ff'; X.fillRect(x + 16, y + 2.5, 1.6, 3);
      X.fillStyle = low ? C.err : '#eef3ff'; X.fillRect(x + 1.3, y + 1.3, 13.4 * Math.min(1, pct / 100), 5.4);
    }
  }
  function stateIcon(mode, x, y, size, blinkOn) { // quadrado azul parado / círculo vermelho gravando / pausa
    if (mode === 'rec') {
      const r = size / 2; const g = X.createRadialGradient(x + r * 0.8, y + r * 0.75, 1, x + r, y + r, r);
      g.addColorStop(0, '#ff6a5c'); g.addColorStop(1, '#d92a22');
      X.beginPath(); X.arc(x + r, y + r, r * 0.92, 0, Math.PI * 2); X.fillStyle = g; X.fill();
      if (blinkOn) { X.beginPath(); X.arc(x + r, y + r, r * 0.92 + 1.6, 0, Math.PI * 2); X.strokeStyle = 'rgba(255,90,80,0.45)'; X.lineWidth = 1.2; X.stroke(); }
    } else if (mode === 'pause') {
      const bw = size * 0.3; X.fillStyle = C.amber;
      rr(x + size * 0.12, y + size * 0.06, bw, size * 0.88, 2); X.fill(); rr(x + size * 0.58, y + size * 0.06, bw, size * 0.88, 2); X.fill();
    } else {
      const g = X.createLinearGradient(0, y, 0, y + size); g.addColorStop(0, '#4680f0'); g.addColorStop(1, '#3466dc');
      X.fillStyle = g; X.fillRect(x, y, size, size);
    }
  }
  function keyGlyph(k, x, y, r = 6.5) { // tecla azul redonda com o símbolo (como no aparelho)
    const g = X.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, '#4d8cf8'); g.addColorStop(1, '#245ad0');
    X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fillStyle = g; X.fill();
    X.strokeStyle = '#fff'; X.fillStyle = '#fff'; X.lineWidth = 1.1; X.lineCap = 'round';
    const s = r * 0.5;
    if (k === 'power') { X.beginPath(); X.arc(x, y + 0.4, s, -Math.PI * 0.32, Math.PI * 1.32); X.stroke(); X.beginPath(); X.moveTo(x, y - s - 0.6); X.lineTo(x, y); X.stroke(); }
    else if (k === 'play') { X.beginPath(); X.moveTo(x - s, y - s); X.lineTo(x - s, y + s); X.lineTo(x + s * 0.15, y); X.closePath(); X.fill(); X.fillRect(x + s * 0.35, y - s, s * 0.28, 2 * s); X.fillRect(x + s * 0.8, y - s, s * 0.28, 2 * s); }
    else if (k === 'stop') { X.fillRect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6); }
    else if (k === 'menu') { for (const dy of [-s * 0.8, 0, s * 0.8]) { X.beginPath(); X.moveTo(x - s, y + dy); X.lineTo(x + s, y + dy); X.stroke(); } }
  }
  function hints(list, y = 229) { // rodapé de navegação: [[tecla, texto], ...]
    X.fillStyle = 'rgba(14,22,40,0.92)'; X.fillRect(0, y - 13, LW, LH - y + 13);
    X.fillStyle = 'rgba(80,130,240,0.5)'; X.fillRect(0, y - 13, LW, 0.8);
    let total = 0; const ws = list.map(([, t]) => measure(t, 600, 10.5, 'cond') + 18); total = ws.reduce((a, b) => a + b, 0) + (list.length - 1) * 10;
    let x = (LW - total) / 2;
    list.forEach(([k, t], i) => { keyGlyph(k, x + 6.5, y - 3.5, 6); text(t, x + 16, y + 0.5, { w: 600, px: 10.5, fam: 'cond', col: '#dbe6fa' }); x += ws[i] + 10; });
  }
  function titleBar(title, core, s) {
    blueBar(3, 3, LW - 6, 21, 7);
    text(title, 11, 18, { w: 700, px: 13, fam: 'sans', col: '#fff', maxW: 210 });
    text(hhmm(core.clockShown()), LW - 32, 18, { w: 600, px: 11.5, col: '#eaf1ff', align: 'right' });
    batteryIcon(LW - 27, 9.5, s.battery, { vertical: false, blink: s.battery < LOW_BATT && Math.floor(s.blinkT * 2) % 2 });
  }
  const unitTxt = (s) => (s.settings.unit === 'F' ? '°F' : '°C');

  // ── telas ──
  function mainScreen(s, core) { // FOTO 1
    const u = unitTxt(s), U = s.settings.unit;
    background();
    // barra superior: data, hora, bateria
    text(fmtDate(core.today()), 7, 21.5, { w: 600, px: 14, col: C.txt, ls: 0.5 });
    text(hhmm(core.clockShown()), 114, 21.5, { w: 600, px: 14, col: C.txt, ls: 0.3 });
    const blink = s.battery < LOW_BATT && Math.floor(s.blinkT * 2) % 2;
    text(`${Math.round(s.battery)}%`, 300, 21.5, { w: 600, px: 14, col: s.battery < LOW_BATT ? C.err : C.txt, align: 'right' });
    batteryIcon(303, 7.5, s.battery, { blink, big: true });
    hline(5, 315, 33);
    // Globo / Seco / Úmido
    const cols = [58, 159, 259];
    ['Globo', 'Seco', 'Úmido'].forEach((t, i) => text(t, cols[i], 64, { w: 700, px: 23.5, col: C.white, align: 'center', ls: 0.4 }));
    [s.shown.tg, s.shown.tbs, s.shown.tbn].forEach((v, i) => text(`${fmtT(v, U)}${u}`, cols[i], 90.5, { w: 600, px: 14.2, col: C.val, align: 'center', ls: 0.3 }));
    hline(5, 315, 104);
    // IBUTG interno (Eq. 5.1) e externo (Eq. 5.2)
    const { tg, tbn, tbs } = s.shown;
    const ii = tg == null ? null : ibutgInt(tg, tbn), ie = tg == null ? null : ibutgExt(tg, tbn, tbs);
    text('IBUTG Interno:', 182, 133, { w: 700, px: 15.5, col: C.white, align: 'right', ls: 0.6 });
    text('IBUTG Externo:', 182, 157, { w: 700, px: 15.5, col: C.white, align: 'right', ls: 0.6 });
    text(`${fmtT(ii, U)} ${u}`, 198, 133, { w: 600, px: 15.5, col: C.val, ls: 0.5 });
    text(`${fmtT(ie, U)} ${u}`, 198, 157, { w: 600, px: 15.5, col: C.val, ls: 0.5 });
    // rodapé: estado + cronômetro da gravação / duração programada
    const blinkOn = Math.floor(s.blinkT * 2) % 2 === 0;
    stateIcon(s.mode, 84, 177, 49, blinkOn);
    const el = s.session ? s.session.elapsed : 0;
    text(hms(el), 142, 199, { w: 500, px: 21, col: '#e4ebf5', ls: 0.2 });
    text(hms(s.session ? s.session.duration : s.settings.duration), 142, 223, { w: 500, px: 21, col: '#c9d3e2', ls: 0.2 });
  }

  function gauge(cx, cy, r, v, lo, hi, { big = false, label = '', valTxt = '', inside = false } = {}) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const t = v == null ? 0 : Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    const lw = big ? 6.4 : 5.2;
    X.save(); X.lineCap = 'round';
    X.beginPath(); X.arc(cx, cy, r, a0, a1); X.strokeStyle = '#18294a'; X.lineWidth = lw + 1.2; X.stroke();
    if (t > 0.002) {
      const g = X.createConicGradient(a0, cx, cy); g.addColorStop(0, '#2a6cf2'); g.addColorStop(0.1, '#78a8ff'); g.addColorStop(0.26, '#e9f1ff'); g.addColorStop(1, '#ffffff');
      X.shadowColor = 'rgba(110,160,255,0.55)'; X.shadowBlur = 3;
      X.beginPath(); X.arc(cx, cy, r, a0, a0 + (a1 - a0) * t); X.strokeStyle = g; X.lineWidth = lw; X.stroke();
    }
    X.restore();
    // disco interno azul-marinho com ponto central (FOTO 2)
    const ri = r - lw - 3;
    const g2 = X.createRadialGradient(cx - ri * 0.25, cy - ri * 0.3, ri * 0.1, cx, cy, ri);
    g2.addColorStop(0, '#163f9c'); g2.addColorStop(0.7, '#0c2565'); g2.addColorStop(1, '#081a46');
    X.beginPath(); X.arc(cx, cy, ri, 0, Math.PI * 2); X.fillStyle = g2; X.fill();
    if (!inside) {
      X.beginPath(); X.arc(cx, cy, ri * 0.32, 0, Math.PI * 2); X.fillStyle = '#3d86ff'; X.fill();
      X.beginPath(); X.arc(cx - ri * 0.08, cy - ri * 0.1, ri * 0.12, 0, Math.PI * 2); X.fillStyle = 'rgba(200,225,255,0.6)'; X.fill();
      text(label, cx, cy - r - 4, { w: 600, px: 10, fam: 'cond', col: '#aebfda', align: 'center' });
      text(valTxt, cx, cy + r + 6, { w: 700, px: 12.5, col: C.white, align: 'center' });
    } else {
      text(label, cx, cy - 2, { w: 600, px: 9.5, fam: 'cond', col: '#b9cbea', align: 'center', maxW: ri * 1.8 });
      text(valTxt, cx, cy + 12, { w: 700, px: 13.5, col: C.white, align: 'center' });
    }
  }
  function gaugeScreen(s, core) { // FOTO 2
    const u = unitTxt(s), U = s.settings.unit;
    background();
    blueBar(4, 3, LW - 8, 20, 8);
    text(fmtDate(core.today()), 12, 17.5, { w: 600, px: 11, col: '#fff' });
    text(hhmm(core.clockShown()), LW / 2, 17.5, { w: 700, px: 11.5, col: '#fff', align: 'center' });
    text(`${Math.round(s.battery)} %`, LW - 33, 17.5, { w: 600, px: 11, col: '#fff', align: 'right' });
    batteryIcon(LW - 29, 9, s.battery, { vertical: false, blink: s.battery < LOW_BATT && Math.floor(s.blinkT * 2) % 2 });
    const { tg, tbn, tbs } = s.shown;
    const cv = (c) => (c == null ? null : U === 'F' ? c * 1.8 + 32 : c);
    const lo = U === 'F' ? 50 : 10, span = (a, b) => (U === 'F' ? [a * 1.8 + 32, b * 1.8 + 32] : [a, b]);
    const [g0, g1] = span(0, 60), [s0, s1] = span(0, 45), [w0, w1] = span(0, 35), [i0, i1] = span(0, 40);
    gauge(62, 61, 21, cv(tg), g0, g1, { label: 'Globo', valTxt: `${fmtT(tg, U)}${u}` });
    gauge(160, 61, 21, cv(tbs), s0, s1, { label: 'Seco', valTxt: `${fmtT(tbs, U)}${u}` });
    gauge(258, 61, 21, cv(tbn), w0, w1, { label: 'Úmido', valTxt: `${fmtT(tbn, U)}${u}` });
    const ii = tg == null ? null : ibutgInt(tg, tbn), ie = tg == null ? null : ibutgExt(tg, tbn, tbs);
    gauge(62, 154, 34, cv(ii), i0, i1, { big: true, inside: true, label: 'IBUTG int.', valTxt: `${fmtT(ii, U)}${u}` });
    gauge(258, 154, 34, cv(ie), i0, i1, { big: true, inside: true, label: 'IBUTG ext.', valTxt: `${fmtT(ie, U)}${u}` });
    const rh = rhEstimate(tbs, tbn);
    gauge(160, 162, 21, rh, 0, 100, { label: 'UR estimada', valTxt: rh == null ? '--- %' : `${Math.round(rh)} %` });
    void lo;
    // barra inferior: estado + cronômetro, intervalo
    blueBar(4, 215, LW - 8, 21, 8);
    const blinkOn = Math.floor(s.blinkT * 2) % 2 === 0;
    stateIcon(s.mode, 12, 219, 13, blinkOn);
    const st = s.mode === 'rec' ? 'REC' : s.mode === 'pause' ? 'PAUSA' : 'PARADO';
    text(st, 31, 230, { w: 700, px: 10.5, fam: 'cond', col: '#fff' });
    text(`${hms(s.session ? s.session.elapsed : 0)} / ${hms(s.session ? s.session.duration : s.settings.duration).slice(0, 5)}`, 31 + measure(st, 700, 10.5, 'cond') + 6, 230, { w: 600, px: 11, col: '#eaf2ff' });
    text(`Interv. ${fmtInterval(s.session ? s.session.interval : s.settings.interval)}`, LW - 12, 230, { w: 600, px: 11, fam: 'cond', col: '#eaf2ff', align: 'right' });
  }

  function listRows(items, sel, y0, rowH, maxRows, drawRow) {
    const n = items.length; let top = 0;
    if (n > maxRows) top = Math.max(0, Math.min(n - maxRows, sel - Math.floor(maxRows / 2)));
    for (let i = top; i < Math.min(n, top + maxRows); i++) {
      const y = y0 + (i - top) * rowH;
      if (i === sel) {
        const g = X.createLinearGradient(0, y, 0, y + rowH - 2); g.addColorStop(0, C.sel0); g.addColorStop(1, C.sel1);
        rr(6, y + 1, LW - 18, rowH - 2, 5); X.fillStyle = g; X.fill();
        X.save(); rr(6.5, y + 1.5, LW - 19, rowH - 3, 4.5); X.strokeStyle = 'rgba(180,210,255,0.55)'; X.lineWidth = 0.8; X.stroke(); X.restore();
      }
      drawRow(items[i], i, y + rowH / 2 + 4.5, i === sel);
    }
    if (n > maxRows) { // barra de rolagem
      const h = maxRows * rowH, th = Math.max(14, (h * maxRows) / n), ty = y0 + ((h - th) * top) / (n - maxRows);
      X.fillStyle = '#1b2944'; rr(LW - 8, y0 + 1, 3.5, h - 2, 2); X.fill();
      X.fillStyle = '#6f9cf5'; rr(LW - 8, ty + 1, 3.5, th - 2, 2); X.fill();
    }
  }
  function valueOf(key, s, core) {
    const st = s.settings;
    switch (key) {
      case 'gravacao': return `${fmtInterval(st.interval)} · ${hms(st.duration).slice(0, 5)}`;
      case 'intervalo': return fmtInterval(st.interval);
      case 'duracao': return hms(st.duration).slice(0, 5);
      case 'bloqueio': return st.lockKeys ? 'Ligado' : 'Desligado';
      case 'memoria': return `${s.memory.length} sessões`;
      case 'datahora': return `${fmtDate(core.today()).slice(0, 5)} ${hhmm(core.clockShown())}`;
      case 'unidade': return st.unit === 'F' ? '°F' : '°C';
      case 'tela': return st.homeScreen ? 'Mostradores' : 'Principal';
      case 'brilho': return `${st.brightness * 20} %`;
      case 'autooff': return st.autoOff ? `${st.autoOff} min` : 'Nunca';
      default: return '';
    }
  }
  function menuScreen(s, core) {
    background();
    const top = s.menuPath[s.menuPath.length - 1];
    const M = MENUS[top];
    if (M) {
      titleBar(M.title === 'Menu' ? 'Menu' : `Menu › ${M.title}`, core, s);
      const sel = s.menuSel[top] || 0;
      listRows(M.items, sel, 28, 23, 8, ([label, key], i, by, on) => {
        const locked = key && PAGES[key]?.lockRec && core.recording();
        text(label, 15, by, { w: on ? 700 : 600, px: 13, fam: 'sans', col: on ? '#fff' : locked ? C.faint : C.txt, maxW: 150 });
        const v = key ? valueOf(key, s, core) : '';
        if (v) text(v, LW - 28, by, { w: 600, px: 11.5, fam: 'cond', col: on ? '#e2ecff' : '#7ea6f2', align: 'right' });
        if (key) text('›', LW - 17, by + 0.5, { w: 700, px: 14, col: on ? '#fff' : '#5a7bc0', align: 'center' });
      });
      hints([['play', 'desce'], ['menu', 'entra'], ['stop', 'volta']]);
      return;
    }
    const P = PAGES[top], pg = s.page;
    titleBar(P.title, core, s);
    if (P.type === 'options') {
      let y0 = 30;
      if (P.sub) { text(P.sub, 12, 42, { w: 600, px: 11, fam: 'cond', col: C.dim }); y0 = 48; }
      const cur = P.get(s.settings);
      listRows(P.options, pg.sel, y0, 24, 7, (label, i, by, on) => {
        X.beginPath(); X.arc(20, by - 4.5, 5.2, 0, Math.PI * 2); X.strokeStyle = on ? '#fff' : '#7ea6f2'; X.lineWidth = 1.2; X.stroke();
        if (i === cur) { X.beginPath(); X.arc(20, by - 4.5, 2.6, 0, Math.PI * 2); X.fillStyle = on ? '#fff' : '#7ea6f2'; X.fill(); }
        text(label, 33, by, { w: on ? 700 : 600, px: 13, col: on ? '#fff' : C.txt });
      });
      hints([['play', 'desce'], ['menu', 'salva'], ['stop', 'cancela']]);
    } else if (P.type === 'fields') {
      const v = pg.values;
      const parts = P === PAGES.datahora
        ? [['d', pad2(v.d), 'Dia'], ['m', pad2(v.m), 'Mês'], ['y', String(v.y), 'Ano'], ['h', pad2(v.h), 'Hora'], ['mi', pad2(v.mi), 'Min']]
        : [['h', pad2(v.h), 'Horas'], ['mi', pad2(v.mi), 'Minutos']];
      const seps = P === PAGES.datahora ? ['/', '/', '', ':'] : [':'];
      const ws = parts.map(([k]) => (k === 'y' ? 62 : 40));
      const gap = 14, total = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1) + (P === PAGES.datahora ? 14 : 0);
      let x = (LW - total) / 2; const y = 92;
      text(P === PAGES.datahora ? 'Ajuste a data e a hora do relógio' : 'Tempo total de gravação', LW / 2, 56, { w: 600, px: 11.5, fam: 'cond', col: C.dim, align: 'center' });
      parts.forEach(([k, str, lab], i) => {
        const on = P.fields[pg.field][0] === k, w = ws[i];
        if (on) { const g = X.createLinearGradient(0, y - 24, 0, y + 10); g.addColorStop(0, C.sel0); g.addColorStop(1, C.sel1); rr(x, y - 24, w, 34, 6); X.fillStyle = g; X.fill(); }
        else { rr(x, y - 24, w, 34, 6); X.strokeStyle = '#2c4475'; X.lineWidth = 1; X.stroke(); }
        text(str, x + w / 2, y + 2, { w: 700, px: 22, col: on ? '#fff' : C.txt, align: 'center' });
        text(lab, x + w / 2, y + 24, { w: 600, px: 10, fam: 'cond', col: on ? '#9fc0ff' : C.faint, align: 'center' });
        if (on) { X.fillStyle = '#9fc0ff'; X.beginPath(); X.moveTo(x + w / 2 - 4, y - 28); X.lineTo(x + w / 2 + 4, y - 28); X.lineTo(x + w / 2, y - 33); X.fill(); }
        x += w;
        if (i < parts.length - 1) { const sp = seps[i] || ''; if (sp) text(sp, x + gap / 2, y, { w: 600, px: 18, col: C.dim, align: 'center' }); x += gap + (i === 2 && P === PAGES.datahora ? 14 : 0); }
      });
      if (P === PAGES.duracao) text('Mínimo 00:10 · máximo 24:00', LW / 2, 150, { w: 500, px: 11, col: C.faint, align: 'center' });
      hints([['play', '+1'], ['menu', 'próximo'], ['stop', 'anterior']]);
    } else if (P.type === 'info') {
      const D = DEVICE;
      const lines = pg.sel === 0
        ? [['Modelo', `${D.model} · ${D.name}`], ['Nº de série', D.serial], ['Firmware', `${D.firmware} (${D.hardware})`], ['Faixas', `tg ${D.ranges.tg.join('–')} · tbs ${D.ranges.tbs.join('–')} · tbn ${D.ranges.tbn.join('–')} °C`], ['Resolução', `${D.resolution.toFixed(1)} °C · erro ≤ ±${D.accuracy.toFixed(1)} °C`], ['Globo', 'Ø 152,4 mm · preto fosco ε ≥ 0,95']]
        : [['Certificado', `nº ${D.cert}`], ['Calibrado em', D.calDate], ['Válido até', D.calValid], ['Laboratório', D.lab], ['Memória', `${s.memory.length} de 40 sessões`], ['Bateria', `${Math.round(s.battery)} % · ~${core.autonomyH().toFixed(0)} h`]];
      lines.forEach(([k, v], i) => {
        const y = 41 + i * 28;
        text(k, 12, y, { w: 600, px: 10, fam: 'cond', col: '#7ea6f2' });
        text(v, 12, y + 14, { w: 600, px: 12, col: C.txt, maxW: LW - 24 });
      });
      text(`${pg.sel + 1}/2`, LW - 12, 206, { w: 600, px: 10, fam: 'cond', col: C.faint, align: 'right' });
      hints([['play', 'página'], ['menu', 'sai'], ['stop', 'volta']]);
    } else if (P.type === 'memory') memoryScreen(s, core, pg);
  }
  function memoryScreen(s, core, pg) {
    const list = core.memList();
    const recLine = (r) => `${pad2(r.date.d)}/${pad2(r.date.m)}  ${hhmm(r.start)}`;
    const nReg = (r) => (r.rows ? r.rows.length : r.count || 0);
    if (!pg.view) {
      text(`${list.length} sessões gravadas`, 12, 41, { w: 600, px: 11, fam: 'cond', col: C.dim });
      const items = [...list.map((r) => ['rec', r]), ['all'], ['back']];
      listRows(items, pg.sel, 46, 22, 7, ([k, r], i, by, on) => {
        const col = on ? '#fff' : C.txt;
        if (k === 'rec') {
          text(pad2(r.n), 15, by, { w: 700, px: 12.5, fam: 'mono', col: on ? '#fff' : '#7ea6f2' });
          text(recLine(r), 44, by, { w: 600, px: 12.5, col });
          text(`${nReg(r)} reg.`, LW - 20, by, { w: 600, px: 11.5, fam: 'cond', col: on ? '#e2ecff' : C.dim, align: 'right' });
        } else text(k === 'all' ? 'Apagar todas' : 'Voltar', 15, by, { w: on ? 700 : 600, px: 12.5, col: k === 'all' ? (on ? '#fff' : '#ff8c80') : col });
      });
      hints([['play', 'desce'], ['menu', 'abre'], ['stop', 'volta']]);
      return;
    }
    const r = pg.rec;
    if (pg.view === 'detail') {
      text(`Sessão ${pad2(r.n)}${r.place ? ' · ' + r.place : ''}`, 12, 44, { w: 700, px: 14, col: C.white });
      const pauses = r.pauses ? r.pauses.length : 0;
      const kv = [['Data', fmtDate(r.date)], ['Início', hhmm(r.start)], ['Fim', r.stop != null ? hhmm(r.stop) : '—'], ['Intervalo', fmtInterval(r.interval)], ['Registros', String(nReg(r))], ['Pausas', String(pauses)]];
      kv.forEach(([k, v], i) => { const x = 12 + (i % 2) * 150, y = 64 + Math.floor(i / 2) * 18; text(k, x, y, { w: 600, px: 10.5, fam: 'cond', col: '#7ea6f2' }); text(v, x + 58, y, { w: 600, px: 12, col: C.txt }); });
      if (r.lowBattery) text('⚠ Bateria baixa durante a gravação', 12, 128, { w: 600, px: 11, fam: 'cond', col: C.warn });
      listRows([['Ver registros'], ['Apagar sessão'], ['Voltar']], pg.dsel, 134, 22, 3, ([t], i, by, on) => text(t, 15, by, { w: on ? 700 : 600, px: 12.5, col: on ? '#fff' : i === 1 ? '#ff8c80' : C.txt }));
      hints([['play', 'desce'], ['menu', 'escolhe'], ['stop', 'volta']]);
    } else if (pg.view === 'rows') {
      const rows = r.rows || [];
      const hdr = ['Hora', 'tg', 'tbs', 'tbn', 'IBUTG'], xs = [12, 92, 142, 192, 250];
      hdr.forEach((h, i) => text(h, xs[i], 42, { w: 700, px: 11, fam: 'cond', col: '#7ea6f2' }));
      X.fillStyle = '#24365c'; X.fillRect(10, 47, LW - 20, 0.8);
      if (!rows.length) text(r.old ? 'Registros arquivados (exportar via USB)' : 'Sem registros', LW / 2, 110, { w: 500, px: 12, col: C.dim, align: 'center' });
      const U = s.settings.unit;
      rows.slice(pg.rtop, pg.rtop + 6).forEach((row, i) => {
        const y = 66 + i * 22; const c = i % 2 ? C.txt : '#eef3fb';
        text(hhmmss(row.clock), xs[0], y, { w: 500, px: 12, fam: 'mono', col: c });
        text(fmtT(row.tg, U), xs[1], y, { w: 500, px: 12, fam: 'mono', col: c });
        text(fmtT(row.tbs, U), xs[2], y, { w: 500, px: 12, fam: 'mono', col: c });
        text(fmtT(row.tbn, U), xs[3], y, { w: 500, px: 12, fam: 'mono', col: c });
        text(fmtT(row.ii, U), xs[4], y, { w: 700, px: 12, fam: 'mono', col: '#ffffff' });
      });
      if (rows.length) text(`${pg.rtop + 1}–${Math.min(rows.length, pg.rtop + 6)} de ${rows.length}`, LW - 12, 202, { w: 600, px: 10, fam: 'cond', col: C.faint, align: 'right' });
      hints([['play', 'próximos'], ['menu', 'volta'], ['stop', 'volta']]);
    } else {
      const all = pg.view === 'confirmAll';
      text(all ? 'Apagar TODAS as sessões?' : `Apagar a sessão ${pad2(r.n)}?`, LW / 2, 80, { w: 700, px: 15, col: C.white, align: 'center' });
      text('Esta ação não pode ser desfeita.', LW / 2, 100, { w: 500, px: 11.5, col: C.dim, align: 'center' });
      ['Não', 'Sim'].forEach((t, i) => {
        const x = 70 + i * 100, on = pg.csel === i;
        if (on) { const g = X.createLinearGradient(0, 120, 0, 150); g.addColorStop(0, i ? '#e2463c' : C.sel0); g.addColorStop(1, i ? '#b42a22' : C.sel1); rr(x, 122, 80, 30, 6); X.fillStyle = g; X.fill(); }
        else { rr(x, 122, 80, 30, 6); X.strokeStyle = '#2c4475'; X.lineWidth = 1; X.stroke(); }
        text(t, x + 40, 142, { w: 700, px: 14, col: on ? '#fff' : C.txt, align: 'center' });
      });
      hints([['play', 'alterna'], ['menu', 'confirma'], ['stop', 'volta']]);
    }
  }
  const hhmmss = (t) => { t = ((Math.floor(t) % 86400) + 86400) % 86400; return `${pad2(t / 3600)}:${pad2((t / 60) % 60)}:${pad2(t % 60)}`; };

  function logo(cx, cy, size, alpha = 1) { // "itemp": i azul, temp branco (marca de modelo, sem logotipo de fabricante)
    X.save(); X.globalAlpha *= alpha;
    font(700, size, 'sans'); X.textBaseline = 'alphabetic'; X.textAlign = 'left';
    const wi = X.measureText('i').width, wt = X.measureText('temp').width, x0 = cx - (wi + wt) / 2;
    X.fillStyle = '#3a86ff'; X.shadowColor = 'rgba(60,130,255,0.6)'; X.shadowBlur = size * 0.15; X.fillText('i', x0, cy);
    X.shadowBlur = 0; X.fillStyle = '#f4f7fc'; X.fillText('temp', x0 + wi + size * 0.02, cy);
    X.restore();
  }
  function bootScreen(s, core) {
    X.fillStyle = '#000'; X.fillRect(0, 0, LW, LH);
    const t = s.bootT;
    if (t < 2.4) {
      const a = Math.min(1, t / 0.6);
      const k = t < 1.4 ? 0 : Math.min(1, (t - 1.4) / 0.35);
      background(); X.globalAlpha = 1;
      logo(LW / 2, 118 - k * 34, 48 - k * 12, a);
      X.globalAlpha = a; text('Medidor de IBUTG', LW / 2, 146 - k * 38, { w: 600, px: 13, col: '#9fb4d6', align: 'center', ls: 1.2 }); X.globalAlpha = 1;
      if (k > 0) {
        X.globalAlpha = k;
        text(`Firmware ${DEVICE.firmware}`, LW / 2, 140, { w: 600, px: 12, col: C.txt, align: 'center' });
        text(`Nº de série ${DEVICE.serial}`, LW / 2, 158, { w: 500, px: 11.5, col: C.dim, align: 'center' });
        const p = Math.min(1, (t - 1.4) / 1.0);
        rr(70, 182, 180, 6, 3); X.fillStyle = '#152240'; X.fill();
        rr(70, 182, 180 * p, 6, 3); X.fillStyle = C.blue; X.fill();
        X.globalAlpha = 1;
      }
      return;
    }
    background();
    logo(46, 24, 20, 1);
    text('Autoteste', LW - 12, 22, { w: 700, px: 13, col: C.txt, align: 'right' });
    hline(8, LW - 8, 32, C.blue, 1.4);
    const items = s.selfTest || [];
    items.forEach(([k, v, okk], i) => {
      const ti = 2.4 + i * 0.3; if (t < ti) return;
      const y = 52 + i * 22;
      text(k, 12, y, { w: 600, px: 12, col: C.txt });
      const done = t > ti + 0.18;
      if (!done) { text('…', LW - 12, y, { w: 700, px: 12, col: C.dim, align: 'right' }); return; }
      text(v, LW - 12, y, { w: 700, px: 11.5, fam: okk ? 'sans' : 'sans', col: okk ? C.green : C.warn, align: 'right', maxW: 170 });
    });
    if (t > 2.4 + items.length * 0.3 + 0.1) text('Pronto', LW / 2, 222, { w: 700, px: 12, col: C.blueHi, align: 'center' });
  }
  function shutdownScreen(s) {
    X.fillStyle = '#000'; X.fillRect(0, 0, LW, LH);
    const a = Math.max(0, 1 - s.offT / OFF_S);
    X.save(); X.globalAlpha = a; background(); logo(LW / 2, 112, 40, 1);
    text('Desligando…', LW / 2, 146, { w: 600, px: 13, col: '#9fb4d6', align: 'center' }); X.restore();
  }
  function overlays(s) {
    if (s.popup) {
      const p = s.popup; X.fillStyle = 'rgba(0,0,0,0.55)'; X.fillRect(0, 0, LW, LH);
      const w = 262, h = 40 + p.lines.length * 17, x = (LW - w) / 2, y = (LH - h) / 2 - 6;
      rr(x, y, w, h, 9); X.fillStyle = '#0f1a30'; X.fill();
      X.strokeStyle = p.kind === 'warn' ? C.warn : C.blue; X.lineWidth = 1.6; X.stroke();
      if (p.kind === 'warn') { // triângulo de alerta
        X.fillStyle = C.warn; X.beginPath(); X.moveTo(x + 20, y + 10); X.lineTo(x + 29, y + 26); X.lineTo(x + 11, y + 26); X.closePath(); X.fill();
        text('!', x + 20, y + 24.5, { w: 800, px: 12, col: '#111', align: 'center' });
      }
      text(p.title, x + 36, y + 23, { w: 700, px: 14, col: p.kind === 'warn' ? '#ffd27a' : '#fff' });
      p.lines.forEach((l, i) => text(l, x + 14, y + 44 + i * 17, { w: 500, px: 12, col: C.txt, maxW: w - 28 }));
    }
    if (s.msg) {
      const m = s.msg; const w = Math.min(LW - 20, measure(m.text, 600, 12.5) + 28), h = 26, x = (LW - w) / 2, y = 186;
      X.save(); X.shadowColor = 'rgba(0,0,0,0.7)'; X.shadowBlur = 8;
      rr(x, y, w, h, 13); X.fillStyle = m.kind === 'warn' ? '#3a2208' : '#10224a'; X.fill(); X.restore();
      rr(x, y, w, h, 13); X.strokeStyle = m.kind === 'warn' ? C.warn : C.blueHi; X.lineWidth = 1.1; X.stroke();
      text(m.text, LW / 2, y + 17.5, { w: 600, px: 12.5, col: '#fff', align: 'center', maxW: w - 20 });
    }
  }

  /** desenha o estado completo do aparelho num contexto qualquer, com px de ctx por px lógico = scale */
  function drawTo(ctx, scale, s, core) {
    X = ctx; X.save(); X.setTransform(scale, 0, 0, scale, 0, 0);
    X.imageSmoothingEnabled = true;
    if (s.power === 'off') { X.fillStyle = '#000'; X.fillRect(0, 0, LW, LH); X.restore(); X = ctx0; return; }
    if (s.power === 'boot') bootScreen(s, core);
    else if (s.power === 'shutdown') shutdownScreen(s);
    else {
      if (s.menuPath.length) menuScreen(s, core);
      else if (s.screen === 1) gaugeScreen(s, core);
      else mainScreen(s, core);
      overlays(s);
    }
    const b = s.settings.brightness;
    if (b < 5) { X.fillStyle = `rgba(0,0,0,${(5 - b) * 0.16})`; X.fillRect(0, 0, LW, LH); }
    X.restore(); X = ctx0;
  }
  function draw(s, core) {
    drawTo(ctx0, SCALE, s, core);
    lcd.backlight = s.power === 'off' ? 0 : s.power === 'shutdown' ? Math.max(0, 1 - s.offT / OFF_S) : 0.4 + 0.12 * s.settings.brightness;
  }
  void fontsReady; void BOOT_S; void INTERVALS;
  return lcd;
}
