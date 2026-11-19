// Áudio procedural espacializado da sala de fornos — dono: FIRMWARE (áudio). WebAudio + PannerNode HRTF, ouvinte = câmera.
// Sem arquivos: tudo sintetizado. API (docs/CONTRACT.md): createAudio(stage, app) →
// {start() (após gesto do usuário), setMuted(b), setVolume(v), beep(kind), update(dt, t)} + duck(b) (narração), get started.
// Mixagem: sala de fornos de padaria (≈ 65–72 dB(A) reais) — exaustão das coifas e ventiladores de convecção dominam,
// queimador do rotativo grave, ventilador da área de descanso; eventos: portas, bipes dos painéis, bandejas, bipes do medidor.
import { OVENS, ovenFrontZ, FAN, HALL, STATIONS, BENCH } from './layout.js';

export function createAudio(stage, app) {
  let ctx = null, master = null, bus = null, fx = null, started = false, muted = false, ducked = false;
  let vol = 0.7; try { const v = parseFloat(localStorage.getItem('calor.vol')); if (v >= 0 && v <= 1) vol = v; } catch {}
  const gainFor = () => (muted ? 0 : 1.4 * vol * vol);
  const src = {};               // fontes contínuas por id
  let white = null, pink = null, brown = null, irBuf = null;
  let nextPanel = 6 + Math.random() * 20, nextTray = 4 + Math.random() * 10, tAcc = 0;
  const camPos = new stage.THREE.Vector3(), fwd = new stage.THREE.Vector3(), up = new stage.THREE.Vector3(), tmpV = new stage.THREE.Vector3();

  // ── utilidades ──
  function noise(sec, color) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') { // Paul Kellet
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    // emenda suave do laço
    const f = Math.min(2048, n >> 3); for (let i = 0; i < f; i++) { const a = i / f; d[i] = d[i] * a + d[n - f + i] * (1 - a); }
    return b;
  }
  function loop(buf, rate = 1) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * buf.duration); return s; }
  function filt(type, f, Q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function panner(p, ref = 1.6, roll = 1) {
    const pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = ref; pn.rolloffFactor = roll; pn.maxDistance = 60;
    pn.positionX.value = p[0]; pn.positionY.value = p[1]; pn.positionZ.value = p[2]; return pn;
  }
  /** saída espacializada: gain → panner → bus (+ envio para a reverberação) */
  function spatial(p, { ref = 1.6, send = 0.25 } = {}) {
    const out = gain(1), pn = panner(p, ref); out.connect(pn); pn.connect(bus);
    if (send > 0) { const sg = gain(send); pn.connect(sg).connect(fx); }
    return out;
  }
  function impulse(sec = 1.4, decay = 3.2) { // sala azulejada: reflexões curtas e brilhantes, cauda média
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < ctx.sampleRate * 0.004 ? 0 : 1); } }
    return b;
  }
  const ovenPos = (o, dy = 0) => [o.x, dy, ovenFrontZ(o)];
  const camDist = (p) => Math.hypot(p[0] - camPos.x, p[1] - camPos.y, p[2] - camPos.z);

  // ── grafo ──
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    white = noise(3, 'white'); pink = noise(4, 'pink'); brown = noise(4, 'brown');
    master = gain(gainFor());
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    bus = gain(ducked ? 0.5 : 1); bus.connect(master);
    const conv = ctx.createConvolver(); irBuf = impulse(); conv.buffer = irBuf;
    fx = gain(1); const fxLp = filt('lowpass', 5200); const fxOut = gain(0.55); fx.connect(conv).connect(fxLp).connect(fxOut).connect(bus);

    // tom da sala (fundo difuso, não espacializado): ar em movimento e máquinas distantes
    { const s = loop(pink), lp = filt('lowpass', 520), hp = filt('highpass', 45), g = gain(0.035); s.connect(hp).connect(lp).connect(g).connect(bus); }

    for (const o of OVENS) {
      const z0 = HALL.z0;
      // exaustão da coifa sobre cada forno: ruído de ar largo + ronco do exaustor (motor na coifa)
      { const out = spatial([o.x, 3.1, z0 + Math.min(o.d, 1.4) * 0.6], { ref: 2.2, send: 0.3 });
        const s = loop(pink, 0.9 + Math.random() * 0.2), bp = filt('bandpass', 650 + Math.random() * 150, 0.55), g = gain(0.09);
        s.connect(bp).connect(g).connect(out);
        const r = loop(brown), lp = filt('lowpass', 160), gr = gain(0.11); r.connect(lp).connect(gr).connect(out);
        const hum = ctx.createOscillator(); hum.frequency.value = 29 + Math.random() * 3; hum.type = 'triangle'; const hg = gain(0.012); hum.connect(hg).connect(out); hum.start();
        out.gain.value = o.id === 'rotativo' || o.id === 'lastro' ? 0.9 : 0.7;
        src['coifa_' + o.id] = { out };
      }
      // ventilador de convecção (fornos turbo/convecção): tom de pás + sopro; mais alto e brilhante com a porta aberta
      if (/turbo|convec/.test(o.kind)) {
        const out = spatial(ovenPos(o, 1.25), { ref: 1.4, send: 0.22 });
        const s = loop(white), bp = filt('bandpass', 420, 0.9), g = gain(0.12); s.connect(bp).connect(g).connect(out);
        const blow = loop(pink, 1.1), bpb = filt('bandpass', 1400, 0.6), gb = gain(0); blow.connect(bpb).connect(gb).connect(out);
        const blade = ctx.createOscillator(); blade.type = 'sawtooth'; blade.frequency.value = 48 + Math.random() * 4; // 1450 rpm × 2 pás
        const bl = filt('lowpass', 240), bg = gain(0.035); blade.connect(bl).connect(bg).connect(out); blade.start();
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.21 + Math.random() * 0.1; const lg = gain(0.025); lfo.connect(lg).connect(g.gain); lfo.start();
        out.gain.value = 0.55;
        src['fan_' + o.id] = { out, bp, blow: gb, body: g, open: 0, o };
      }
      // queimador do forno rotativo: chama de gás (ronco grave com cintilação) + motor do carro giratório
      if (o.kind === 'rotativo') {
        const out = spatial([o.x + 0.55, 1.0, ovenFrontZ(o) - 0.3], { ref: 1.5, send: 0.2 });
        const s = loop(brown), lp = filt('lowpass', 280, 0.9), g = gain(0.42); s.connect(lp).connect(g).connect(out);
        const roar = loop(white), bp = filt('bandpass', 900, 0.5), gr = gain(0.03); roar.connect(bp).connect(gr).connect(out);
        const flick = loop(noise(2, 'brown'), 0.12), fg = gain(0.18); flick.connect(fg).connect(g.gain);
        const mot = ctx.createOscillator(); mot.frequency.value = 100; const mg = gain(0.008); mot.connect(mg).connect(out); mot.start();
        out.gain.value = 0.6; src.burner = { out };
      }
    }
    // ventilador / ar da área de descanso (ventilador de parede): sopro suave + tom de pás
    { const out = spatial(FAN.pos, { ref: 1.4, send: 0.15 });
      const s = loop(pink, 1.05), bp = filt('bandpass', 750, 0.5), g = gain(0.18); s.connect(bp).connect(g).connect(out);
      const blade = ctx.createOscillator(); blade.type = 'triangle'; blade.frequency.value = 37; const bg = gain(0.02); blade.connect(bg).connect(out); blade.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12; const lg = gain(0.04); lfo.connect(lg).connect(g.gain); lfo.start(); // oscilação do ventilador
      out.gain.value = 0.55; src.restFan = { out };
    }
    // estado inicial das portas
    for (const k in src) if (k.startsWith('fan_')) src[k].open = app.field?.doors?.[src[k].o.id] || 0;
  }

  // ── eventos ──
  function doorSound(id, open) {
    if (!ctx) return;
    const o = OVENS.find((x) => x.id === id); if (!o) return;
    const d = o.doors[0]; const p = [o.x + d.cx, d.y0 + d.h * 0.55, ovenFrontZ(o) + 0.05];
    const out = spatial(p, { ref: 1.3, send: 0.35 }); const t = ctx.currentTime;
    // trinco (clique metálico)
    click(out, t, 3200, 0.5); click(out, t + 0.035, 5200, 0.25);
    if (open) {
      // dobradiça (rangido curto, atrito metal-metal)
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(190, t + 0.05);
      o1.frequency.linearRampToValueAtTime(260, t + 0.32); o1.frequency.linearRampToValueAtTime(215, t + 0.55);
      const j = ctx.createOscillator(); j.frequency.value = 23; const jg = gain(22); j.connect(jg).connect(o1.frequency);
      const bp = filt('bandpass', 1300, 4), g = gain(0); g.gain.setValueAtTime(0, t + 0.05); g.gain.linearRampToValueAtTime(0.06, t + 0.12); g.gain.linearRampToValueAtTime(0.0, t + 0.6);
      o1.connect(bp).connect(g).connect(out); o1.start(t + 0.05); j.start(t + 0.05); o1.stop(t + 0.65); j.stop(t + 0.65);
      // sopro de ar quente saindo pela porta (+ chiado de vapor)
      const s = ctx.createBufferSource(); s.buffer = pink; const f = filt('bandpass', 300, 0.7); const gw = gain(0);
      f.frequency.setValueAtTime(260, t + 0.1); f.frequency.exponentialRampToValueAtTime(1300, t + 0.7); f.frequency.exponentialRampToValueAtTime(500, t + 2.4);
      gw.gain.setValueAtTime(0, t + 0.1); gw.gain.linearRampToValueAtTime(1.6, t + 0.45); gw.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
      s.connect(f).connect(gw).connect(out); s.start(t + 0.1, Math.random() * 2); s.stop(t + 2.7);
      const v = ctx.createBufferSource(); v.buffer = white; const hp = filt('highpass', 3800), gv = gain(0);
      gv.gain.setValueAtTime(0, t + 0.15); gv.gain.linearRampToValueAtTime(0.05, t + 0.35); gv.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      v.connect(hp).connect(gv).connect(out); v.start(t + 0.15, Math.random()); v.stop(t + 1.7);
    } else {
      // batida da porta (painel de vidro duplo + borracha de vedação): baque grave + vibração do vidro
      thump(out, t + 0.02, 0.9);
      const glass = [1180, 1730, 2410]; glass.forEach((fr, i) => ping(out, t + 0.03, fr * (0.98 + Math.random() * 0.04), 0.012 / (i + 1), 0.16));
      click(out, t + 0.09, 2600, 0.45);
    }
    setTimeout(() => out.disconnect(), 3200);
  }
  function click(out, t, f, a) {
    const s = ctx.createBufferSource(); s.buffer = white; const bp = filt('bandpass', f, 2.5), g = gain(0);
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.connect(bp).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.05);
  }
  function thump(out, t, a) {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    const g = gain(0); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24); o.connect(g).connect(out); o.start(t); o.stop(t + 0.26);
    const s = ctx.createBufferSource(); s.buffer = brown; const lp = filt('lowpass', 700), gn = gain(0);
    gn.gain.setValueAtTime(a * 0.9, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.12); s.connect(lp).connect(gn).connect(out); s.start(t, Math.random()); s.stop(t + 0.14);
  }
  function ping(out, t, f, a, dec) {
    const o = ctx.createOscillator(); o.frequency.value = f; const g = gain(0);
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec); o.connect(g).connect(out); o.start(t); o.stop(t + dec + 0.02);
  }
  /** bandeja/esteira de alumínio batendo (parciais inarmônicas de chapa fina + transiente) */
  function tray(p, a = 1) {
    if (!ctx) return; const out = spatial(p, { ref: 1.2, send: 0.4 }); const t = ctx.currentTime;
    const base = 380 + Math.random() * 120, ratios = [1, 2.32, 3.89, 5.41, 7.3, 9.6];
    ratios.forEach((r, i) => ping(out, t, base * r * (0.98 + Math.random() * 0.04), (0.09 * a) / (1 + i * 0.6), 0.5 / (1 + i * 0.35)));
    click(out, t, 4200, 0.35 * a);
    if (Math.random() < 0.6) { const t2 = 0.09 + Math.random() * 0.12; ratios.slice(0, 4).forEach((r, i) => ping(out, t + t2, base * 1.07 * r, (0.025 * a) / (1 + i), 0.3)); click(out, t + t2, 3800, 0.18 * a); }
    setTimeout(() => out.disconnect(), 1500);
  }
  /** bipe do painel do forno (fim de tempo: 3 bipes de 2,7 kHz) */
  function panelBeep(o) {
    if (!ctx) return; const p = [o.x + (o.panel?.cx || 0), 1.45, ovenFrontZ(o) + 0.02];
    const out = spatial(p, { ref: 1.0, send: 0.3 }); const t = ctx.currentTime;
    const n = o.id === 'lastro' ? 4 : 3;
    for (let i = 0; i < n; i++) tone(out, t + i * 0.32, 2700, 0.18, 0.05, 'square', 4500);
    setTimeout(() => out.disconnect(), 2000);
  }
  function tone(out, t, f, dur, a, type = 'square', lp = 6000) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const l = filt('lowpass', lp), g = gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.004); g.gain.setValueAtTime(a, t + dur - 0.008); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(l).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }

  // bipes do medidor (piezo pequeno, ~4 kHz) na posição do aparelho
  const METER = {
    key: [[4000, 0.035]], tick: [[3600, 0.02]], long: [[4000, 0.12]], start: [[3200, 0.07], [4300, 0.1]], pause: [[4300, 0.07], [3200, 0.1]],
    stop: [[4000, 0.08], [4000, 0.08], [3000, 0.22]], ok: [[4000, 0.06], [4000, 0.06]], error: [[1800, 0.09], [1800, 0.09], [1800, 0.09]],
    warn: [[3000, 0.12], [3000, 0.12]], boot: [[2600, 0.06], [3300, 0.06], [4100, 0.1]], off: [[4100, 0.06], [3300, 0.06], [2600, 0.14]],
  };
  function meterBeep(kind = 'key') {
    if (!ctx || ctx.state !== 'running') return;
    const seq = METER[kind] || METER.key;
    const dev = app.meter?.device; let p = [STATIONS.forno.tripod[0], 1.2, STATIONS.forno.tripod[2]];
    if (dev) { dev.getWorldPosition(tmpV); p = [tmpV.x, tmpV.y + 0.04, tmpV.z]; }
    const out = spatial(p, { ref: 0.6, send: 0.12 }); let t = ctx.currentTime + 0.005;
    for (const [f, d] of seq) { tone(out, t, f, d, kind === 'tick' ? 0.05 : 0.11, 'square', 7000); t += d + 0.05; }
    setTimeout(() => out.disconnect(), 1500);
  }

  // ── atualização por quadro ──
  function update(dt) {
    if (!ctx || !started) return;
    const L = ctx.listener, cam = stage.camera;
    cam.getWorldPosition(camPos); cam.getWorldDirection(fwd); up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const now = ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(camPos.x, now, 0.03); L.positionY.setTargetAtTime(camPos.y, now, 0.03); L.positionZ.setTargetAtTime(camPos.z, now, 0.03);
      L.forwardX.setTargetAtTime(fwd.x, now, 0.03); L.forwardY.setTargetAtTime(fwd.y, now, 0.03); L.forwardZ.setTargetAtTime(fwd.z, now, 0.03);
      L.upX.setTargetAtTime(up.x, now, 0.03); L.upY.setTargetAtTime(up.y, now, 0.03); L.upZ.setTargetAtTime(up.z, now, 0.03);
    } else { L.setPosition(camPos.x, camPos.y, camPos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    // ventiladores de convecção: porta aberta → sopro mais alto e brilhante
    const doors = app.field?.doors || {};
    for (const k in src) {
      const v = src[k]; if (!v.o) continue;
      const open = Math.max(doors[v.o.id] || 0, app.machines?.doorOpen?.(v.o.id) || 0);
      if (Math.abs(open - v.open) > 0.01) {
        v.open += (open - v.open) * Math.min(1, dt * 4);
        v.out.gain.setTargetAtTime(0.55 + 0.75 * v.open, now, 0.15);
        v.bp.frequency.setTargetAtTime(420 + 500 * v.open, now, 0.2);
        v.blow.gain.setTargetAtTime(0.16 * v.open, now, 0.2);
      }
    }
    // eventos aleatórios: bipes de painel e bandejas
    tAcc += dt;
    nextPanel -= dt;
    if (nextPanel <= 0) { nextPanel = 35 + Math.random() * 70; const o = OVENS[Math.floor(Math.random() * OVENS.length)]; panelBeep(o); }
    nextTray -= dt;
    if (nextTray <= 0) {
      const busy = app.state?.running;
      nextTray = (busy ? 7 : 14) + Math.random() * (busy ? 14 : 28);
      const ws = app.worker?.station || 'bancada';
      const p = ws === 'forno' ? [STATIONS.forno.worker[0] - 0.2, 1.0, STATIONS.forno.worker[2] - 0.3]
        : Math.random() < 0.6 ? [BENCH.pos[0] + (Math.random() - 0.5) * BENCH.w, BENCH.h + 0.02, BENCH.pos[2]]
          : [OVENS[1].x + (Math.random() - 0.5) * 2, 0.95, ovenFrontZ(OVENS[1]) + 0.9];
      if (camDist(p) < 25) tray(p, 0.6 + Math.random() * 0.5);
    }
  }

  const api = {
    get started() { return started; },
    get context() { return ctx; },
    start() {
      try {
        if (!ctx) build();
        if (ctx.state === 'suspended' && !(ctx instanceof (window.OfflineAudioContext || Object))) ctx.resume().catch(() => {});
        started = true; return true;
      } catch (e) { console.error('[audio]', e); return false; }
    },
    setMuted(b) { muted = !!b; if (master) master.gain.setTargetAtTime(gainFor(), ctx.currentTime, 0.05); },
    setVolume(v) { vol = Math.max(0, Math.min(1, +v || 0)); try { localStorage.setItem('calor.vol', String(vol)); } catch {} if (master) master.gain.setTargetAtTime(gainFor(), ctx.currentTime, 0.05); },
    get volume() { return vol; }, get muted() { return muted; },
    /** narração: abaixa o ambiente ≈ 6 dB */
    duck(b) { ducked = !!b; if (bus) bus.gain.setTargetAtTime(ducked ? 0.5 : 1, ctx.currentTime, 0.2); },
    beep: (kind) => meterBeep(kind),
    tray: (p) => tray(p || [STATIONS.forno.worker[0], 1, STATIONS.forno.worker[2]]),
    panelBeep: (id = 'forno1') => panelBeep(OVENS.find((o) => o.id === id) || OVENS[0]),
    update,
  };
  app.on?.('door', ({ id, open }) => doorSound(id, open));
  app.fw?.on?.('beep', (k) => api.beep(k));
  return api;
}
