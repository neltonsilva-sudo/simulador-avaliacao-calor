// Interface + apresentação narrada — dono: UI/DEMO.
// Fluxo (docs/SPEC.md): explorar → Medidor de IBUTG (apresentação em capítulos) → preparação/montagem → posicionar (S1/S2/S3)
// → medir (planilha, estabilização, simulação da porta aberta) → cronometragem + M + vestimenta → resultado → laudo.
import { STEPS, CHAPTERS, CAPTIONS, fwDo, demoClock, camPart, isOn, isRec, mesaView, overviewView } from './demo.js';
import { createVoice } from './ui_voice.js';
import { createMeasure, SIT_COLOR } from './ui_measure.js';
import { createEval, RESULT_STEPS } from './ui_eval.js';
import { createActivity } from './ui_atividade.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const f = (v, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const PHASES = [['explorar', 'Explorar'], ['apresentacao', 'Medidor'], ['montagem', 'Preparação'], ['posicionar', 'Posicionar'], ['medicao', 'Medir'],
  ['cronometragem', 'Cronometragem'], ['resultado', 'Resultado'], ['laudo', 'Laudo']];
// Nomes curtos (vista/estação/atividade); chaves desconhecidas (outro ambiente) caem no rótulo dos dados.
const VIEW_NAME = { overview: 'Visão geral', forno: 'Forno', bancada: 'Bancada', descanso: 'Descanso', mesa: 'Mesa' };
const ACT_SHORT = { A1: 'Carga e descarga do forno', A2: 'Modelagem na bancada', A4: 'Transporte de esteiras', A3: 'Pausa para hidratação' };
const cap1 = (k) => k.charAt(0).toUpperCase() + k.slice(1);

export function createUI(root, app) {
  const S = app.state;
  root.innerHTML = ''; root.classList.add('ui-root');
  const narrow = () => innerWidth < 760;
  const SIDS = () => Object.keys((app.cycle?.() || app.CY).SITUACOES);
  const CYC = () => app.cycle?.() || app.CY; // ciclo do ambiente ativo
  const capt = (k) => CAPTIONS[`${S.env}:${k}`] || CAPTIONS[k];
  const VIEWS = () => app.env?.()?.views || [['overview', 'Visão geral'], ...SIDS().map((id) => CYC().SITUACOES[id].station).filter(Boolean).map((k) => [k, VIEW_NAME[k] || cap1(k)]), ['mesa', 'Mesa']];
  const stationName = (k) => { if (k === 'kit') return 'na mesa do avaliador'; if (k === 'livre') return 'em transporte';
    const id = SIDS().find((i) => CYC().SITUACOES[i].station === k); return id ? `${id} · ${CYC().SITUACOES[id].label.toLowerCase()}` : k; };
  const actShort = (a) => ((S.env || 'fornos') === 'fornos' ? ACT_SHORT[a] : null) || CYC().ATIVIDADES[a]?.label || a;
  const workerName = () => app.env?.()?.worker || CYC().WORKER || 'trabalhadora';
  const voice = createVoice(app);
  const say = (t) => voice.say(t);

  // ── cabeçalho com etapas ──
  const top = h('div', 'ui-top glass', `<div class="ui-brand"><b>Avaliação de Calor</b><button class="env-sw" title="Trocar de ambiente"></button></div><nav class="ui-steps"></nav>`);
  const stepsNav = top.querySelector('.ui-steps'), envSw = top.querySelector('.env-sw');
  envSw.onclick = () => { app.audio?.start?.(); const ids = Object.keys(app.ENVS || {}); if (ids.length > 1) setEnv(ids[(ids.indexOf(S.env) + 1) % ids.length]); };
  // ── cartão do ambiente (relógio, forneira, leituras; "campo" opcional para o professor) ──
  const live = h('div', 'ui-live glass', `<div class="pn-toggle lv-h"><span>Ambiente e medidor</span><span class="chev">▾</span></div><div class="lv-body"></div>`);
  const liveBody = live.querySelector('.lv-body');
  let showField = false;
  // ── visor do medidor (espelho do canvas do firmware) + teclas ──
  const lcdWrap = h('div', 'ui-lcd glass hidden', `<div class="pn-toggle"><span>Visor do medidor</span><span class="chev">▾</span></div><div class="lcd-body"><canvas width="640" height="480"></canvas><div class="ui-keys"></div><div class="ui-hint">Clique = toque curto · segure ⏻ 2 s para ligar/desligar</div></div>`);
  const lcd = lcdWrap.querySelector('canvas'), lctx = lcd.getContext('2d');
  // ── painel lateral (capítulos / posicionar / planilha / cronometragem / resultado) ──
  const side = h('div', 'ui-side glass hidden', `<div class="pn-toggle side-h"><span class="side-t">Painel</span><span class="chev">▾</span></div><div class="side-body"></div>`);
  const sideBody = side.querySelector('.side-body'), sideT = side.querySelector('.side-t');
  const cap = h('div', 'ui-caption glass hidden', '');
  const bar = h('div', 'ui-bar glass', '');
  const modal = h('div', 'ui-modal hidden', '');
  const toastEl = h('div', 'ui-toast hidden', '');
  root.append(top, live, lcdWrap, side, cap, bar, modal, toastEl);
  for (const p of [live, lcdWrap, side]) {
    p.querySelector('.pn-toggle').onclick = () => { p.classList.toggle('collapsed'); p.dataset.user = '1'; };
    if (narrow()) p.classList.add('collapsed');
  }
  let toastTm = 0;
  function toast(msg, ms = 3800) { toastEl.innerHTML = msg; toastEl.classList.remove('hidden'); clearTimeout(toastTm); toastTm = setTimeout(() => toastEl.classList.add('hidden'), ms); }
  app.on('toast', (m) => toast(m));

  // teclas do aparelho (toque curto ao soltar; ⏻ dispara sozinha aos 2 s com o dedo no botão)
  const keysEl = lcdWrap.querySelector('.ui-keys');
  for (const [k, sym, tip] of [['power', '⏻', 'Liga/desliga (segure 2 s)'], ['play', '▶❙❙', 'Iniciar/pausar gravação'], ['stop', '■', 'Parar e salvar'], ['menu', '☰', 'Menu']]) {
    const b = h('button', 'ui-key', `<span>${sym}</span><i class="hold"></i>`); b.title = tip;
    let t0 = 0, raf = 0, fired = false; const LONG = 2000;
    const tick = () => { const e = performance.now() - t0; b.style.setProperty('--p', Math.min(1, e / LONG));
      if (k === 'power' && e >= LONG && !fired) { fired = true; app.fw?.press?.(k, LONG + 100); app.meter?.pressAnim?.(k); b.classList.add('fired'); }
      raf = requestAnimationFrame(tick); };
    const end = (send) => { if (!t0) return; cancelAnimationFrame(raf); const e = performance.now() - t0; t0 = 0; b.classList.remove('down', 'fired'); b.style.setProperty('--p', 0);
      if (send && !fired) { app.fw?.press?.(k, Math.round(e)); app.meter?.pressAnim?.(k); } };
    b.onpointerdown = (ev) => { ev.preventDefault(); b.setPointerCapture?.(ev.pointerId); app.audio?.start?.(); t0 = performance.now(); fired = false; b.classList.add('down'); tick(); };
    b.onpointerup = () => end(true); b.onpointercancel = () => end(false);
    keysEl.appendChild(b);
  }

  const uiApi = {}; // preenchido abaixo (measure/eval chamam em tempo de execução)
  const measure = createMeasure({ app, ui: uiApi });
  const ev = createEval({ app, ui: uiApi, measure });
  const D = ev.D;

  // ── botões ──
  function btn(label, cls, fn, title) { const b = h('button', 'ui-btn ' + (cls || ''), label); b.onclick = (e) => { app.audio?.start?.(); fn(e); }; if (title) b.title = title; return b; }
  function setBar(items) { bar.innerHTML = ''; items.forEach((i) => i && bar.appendChild(i)); }
  const volIcon = () => (app.audio?.muted || (app.audio?.volume ?? 0.8) === 0 ? '🔇' : (app.audio?.volume ?? 0.8) < 0.4 ? '🔈' : '🔊');
  const soundBtn = () => {
    const w = h('div', 'ui-vol'); const b = h('button', 'ui-btn ghost ui-vol-btn', volIcon()); b.title = 'Som liga/desliga';
    const r = h('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = Math.round((app.audio?.volume ?? 0.8) * 100); r.title = 'Volume'; r.setAttribute('aria-label', 'Volume');
    const paint = () => { r.style.setProperty('--v', r.value + '%'); b.textContent = volIcon(); };
    b.onclick = () => { app.audio?.start?.(); app.audio?.setMuted?.(!app.audio?.muted); voice.applyVolume(); paint(); };
    r.oninput = () => { app.audio?.start?.(); if (app.audio?.muted && +r.value > 0) app.audio.setMuted?.(false); app.audio?.setVolume?.(+r.value / 100); voice.applyVolume(); paint(); };
    paint(); w.append(b, r); return w;
  };
  let curView = null;
  app.on('view', (v) => (curView = v));
  const view = (v, d = 1.8) => { curView = v; app.setView(v, { animate: true, duration: d }); };
  const viewSeg = () => { const w = h('div', 'ui-seg views'); for (const [v, l] of VIEWS()) w.appendChild(btn(l, 'seg' + (curView === v ? ' on' : ''), () => { view(v); w.querySelectorAll('.seg').forEach((x) => x.classList.toggle('on', x.textContent === l)); })); return w; };
  const envSeg = () => { const w = h('div', 'ui-seg env'); for (const [id, E] of Object.entries(app.ENVS || {})) w.appendChild(btn((id === 'fornos' ? '🍞 ' : '♨ ') + E.short, 'seg' + (S.env === id ? ' on' : ''), () => setEnv(id), E.label)); return w; };
  async function setEnv(id) {
    if (!app.setEnv || id === S.env) return;
    token++; stopResult(); voice.stop(); if (measure.measuring) measure.abort();
    modal.classList.add('hidden'); visited.clear(); visited.add('explorar');
    await app.setEnv(id); curView = overviewView(app);
    if (S.phase !== 'explorar') app.setPhase('explorar'); else render();
    const c = capt('inicio'); caption(c.title, c.text + envChoiceHTML()); bindEnvChoice(); say(c.text);
  }
  const envChoiceHTML = () => app.ENVS ? `<div class="env-pick">${Object.entries(app.ENVS).map(([id, E]) => `<button class="env-card ${S.env === id ? 'on' : ''}" data-env="${id}"><b>${id === 'fornos' ? '🍞' : '♨'} ${E.short}</b><span>${E.label} · ${E.worker}</span></button>`).join('')}</div>` : '';
  function bindEnvChoice() { cap.querySelectorAll('[data-env]').forEach((b) => (b.onclick = () => { app.audio?.start?.(); setEnv(b.dataset.env); })); }
  const speedSeg = () => { const w = h('div', 'ui-seg'); w.appendChild(h('span', 'ui-lbl', 'Tempo')); for (const s of [30, 60, 120, 300]) w.appendChild(btn(s + '×', 'seg' + (S.speed === s ? ' on' : ''), () => { app.setSpeed(s); render(); })); return w; };

  // ── legenda ──
  function caption(title, text, count = '') {
    cap.classList.remove('hidden');
    cap.innerHTML = `<div class="ui-cap-h">${count ? `<span>${count}</span>` : ''}<b>${title}</b><button class="cap-x" title="Fechar legenda">✕</button></div><div class="ui-cap-t">${text}</div>`;
    cap.querySelector('.cap-x').onclick = () => { cap.classList.add('hidden'); voice.stop(); };
  }
  const hideCaption = () => cap.classList.add('hidden');

  // ── etapas (cabeçalho) ──
  const visited = new Set(['explorar']);
  function drawSteps() {
    const cur = S.phase === 'pronto' ? 'posicionar' : S.phase; visited.add(cur);
    const ci = PHASES.findIndex(([p]) => p === cur);
    stepsNav.innerHTML = PHASES.map(([p, l], i) => `<button class="stp ${p === cur ? 'on' : ''} ${i < ci || visited.has(p) ? 'seen' : ''}" data-ph="${p}" title="${i + 1}. ${l}"><i>${i + 1}</i><span>${l}</span></button>`).join('');
    stepsNav.querySelectorAll('.stp').forEach((b) => (b.onclick = () => { app.audio?.start?.(); go(b.dataset.ph); }));
    stepsNav.classList.remove('compact'); if (stepsNav.scrollWidth > stepsNav.clientWidth + 2) stepsNav.classList.add('compact');
    const on = stepsNav.querySelector('.stp.on'); if (on && narrow()) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  // ── apresentação narrada ──
  let steps = STEPS, stepIdx = 0, token = 0, resumeP = null, chapterId = 'tudo';
  const pwait = (ms) => new Promise((r) => { let left = ms, last = performance.now();
    const tick = () => { const now = performance.now(); if (!demoClock.paused) left -= now - last; last = now; if (left <= 0) r(); else setTimeout(tick, 50); }; setTimeout(tick, 50); });
  async function ensurePresent() { if (S.onTripod !== false) { camPart(app, 'all', 1.8); await app.present?.(1.5); } }
  async function startPresentation(ch = 'tudo') {
    app.audio?.start?.(); modal.classList.add('hidden'); stopResult();
    if (measure.measuring) measure.abort();
    chapterId = ch; steps = ch === 'tudo' ? STEPS : STEPS.filter((x) => x.chapter === ch);
    token++; app.setPhase(steps[0]?.phase || 'apresentacao');
    if (ch !== 'tudo' && ch !== 'aparelho') { await ensurePresent(); if (ch === 'menu') await fwDo.powerOn(app); }
    goStep(0);
  }
  function openChooser() {
    const n = (c) => (c === 'tudo' ? STEPS : STEPS.filter((x) => x.chapter === c)).length;
    modal.innerHTML = `<div class="ui-dialog glass ui-chooser"><button class="ui-x">✕</button><div class="dlg-k">🎓 Demonstração</div><h2>Medidor de IBUTG</h2>
      <p class="sub">Partes e requisitos da NHO-06, visor e teclas, configuração e preparação, com narração e o aparelho em 3D.</p>
      <div class="ui-chapters">${CHAPTERS.map((c) => `<button class="ui-chap" data-ch="${c.id}"><b>${c.label}</b><span>${c.sub}</span><em>${n(c.id)} passos</em></button>`).join('')}</div>
      <p class="voice ${voice.recorded ? 'ok' : ''}">🗣 Narração: <b>${voice.name()}</b></p></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = () => modal.classList.add('hidden');
    modal.querySelectorAll('.ui-chap').forEach((b) => (b.onclick = () => startPresentation(b.dataset.ch)));
  }
  function toggleDemoPause() {
    if (demoClock.paused) { demoClock.paused = false; resumeP = voice.resume(); } else { demoClock.paused = true; voice.pause(); }
    render();
  }
  async function goStep(i) {
    demoClock.paused = false; resumeP = null;
    if (i < 0) i = 0;
    if (i >= steps.length) return finishPresentation();
    const my = ++token; stepIdx = i; const st = steps[i];
    const ph = st.phase || 'apresentacao'; if (S.phase !== ph) app.setPhase(ph); else render();
    caption(st.title, st.text, `${i + 1}/${steps.length}`);
    app.meter?.highlight?.(st.highlight || null);
    if (st.cam === 'present' || st.cam === 'all') camPart(app, 'all', 1.8);
    else if (st.cam === 'mesa') view(mesaView(app)); else if (st.cam === 'overview') view(overviewView(app));
    else if (st.cam) camPart(app, st.cam, 1.6);
    const speech = say(st.text);
    try { await st.run?.(app, { wait: pwait, alive: () => my === token }); } catch (e) { console.error('[demo]', e); }
    if (my !== token) return;
    if (st.cam && st.cam !== 'mesa' && st.cam !== 'present' && st.cam !== 'all' && st.run) camPart(app, st.cam, 1.0); // reenquadra após mover o aparelho
    await speech;
    while (my === token && demoClock.paused) await new Promise((r) => setTimeout(r, 100));
    if (resumeP) await resumeP;
    if (my === token && ['apresentacao', 'montagem'].includes(S.phase)) { await pwait(900); if (my === token) goStep(i + 1); }
  }
  async function ensureReady({ quiet = false } = {}) {
    const auto = S.wick !== 'limpo' || S.water < 0.9 || S.onTripod === false;
    if (S.wick !== 'limpo') app.setWick('limpo');
    if (S.water < 0.9) app.setWater(1);
    if (S.onTripod === false) await app.mountOnTripod?.(1.2);
    await fwDo.powerOn(app); await fwDo.exitMenu(app);
    if (auto && !quiet) toast('Preparação concluída: pavio novo, reservatório cheio, aparelho no tripé e ligado.');
  }
  async function finishPresentation() {
    token++; voice.stop(); demoClock.paused = false; app.meter?.highlight?.(null);
    await ensureReady({ quiet: true });
    app.setPhase('posicionar'); view(overviewView(app), 2.2);
    caption(capt('posicionar').title, capt('posicionar').text); say(capt('posicionar').text);
  }

  // ── resultado narrado ──
  let rToken = 0, rActive = -1;
  function stopResult() { rToken++; rActive = -1; }
  async function explainResult() {
    const my = ++rToken;
    for (let i = 0; i < RESULT_STEPS.length; i++) {
      if (my !== rToken || S.phase !== 'resultado') return;
      rActive = i; refreshPanel();
      sideBody.querySelector(`[data-r="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      caption(RESULT_STEPS[i].title, RESULT_STEPS[i].text, `${i + 1}/${RESULT_STEPS.length}`);
      await say(RESULT_STEPS[i].text); await new Promise((r) => setTimeout(r, 600));
    }
    if (my === rToken) { rActive = -1; refreshPanel(); hideCaption(); }
  }

  // ── navegação entre etapas ──
  async function go(p) {
    if (p === 'apresentacao') return openChooser();
    if (p === 'montagem') return startPresentation('prep');
    token++; stopResult(); voice.stop(); demoClock.paused = false; app.meter?.highlight?.(null);
    if (p === 'explorar') { if (measure.measuring) measure.abort(); app.setPhase('explorar'); view(overviewView(app)); return; }
    if (['posicionar', 'medicao'].includes(p)) { await ensureReady(); if (p === 'posicionar') { app.setPhase('posicionar'); caption(capt('posicionar').title, capt('posicionar').text); } else app.setPhase('medicao'); return; }
    if (p === 'cronometragem' || p === 'resultado' || p === 'laudo') {
      if (measure.measuring) measure.abort();
      if (!measure.allDone()) { measure.fillExample(); toast('Situações não medidas receberam <b>valores de exemplo</b> (equilíbrio do campo térmico).'); }
      if (p !== 'cronometragem' && !ev.allM()) { ev.useGabarito(); toast('Taxas metabólicas preenchidas com o <b>gabarito</b> (Quadro 2 da NR-15).'); }
      if (p === 'cronometragem') { app.setPhase('cronometragem'); view(overviewView(app), 2.4); const c = capt('crono'); caption(c.title, c.text); say(c.text).then(() => { if (S.phase === 'cronometragem') { caption(CAPTIONS.taxaM.title, CAPTIONS.taxaM.text); return say(CAPTIONS.taxaM.text); } }); return; }
      if (p === 'resultado') { app.setPhase('resultado'); view(overviewView(app), 2.4); explainResult(); return; }
      app.setPhase('laudo'); showLaudo();
    }
  }

  // ── laudo ──
  function showLaudo() {
    modal.innerHTML = `<div class="ui-dialog laudo-wrap"><div class="laudo-bar"><button class="ui-btn primary" data-print>🖨 Imprimir / PDF</button><button class="ui-btn ghost" data-close>✕ Fechar</button></div>${ev.laudoHTML()}</div>`;
    modal.classList.remove('hidden'); document.body.classList.add('laudo-open');
    modal.querySelector('[data-print]').onclick = () => window.print();
    modal.querySelector('[data-close]').onclick = () => { modal.classList.add('hidden'); document.body.classList.remove('laudo-open'); };
    ev.bind(modal);
  }

  // ── painel lateral ──
  function chaptersHTML() {
    return `<div class="pn-h">${CHAPTERS.find((c) => c.id === chapterId)?.label || 'Apresentação'}</div><ol class="chap-steps">${steps.map((s, i) =>
      `<li class="${i === stepIdx ? 'on' : i < stepIdx ? 'done' : ''}" data-st="${i}"><span>${s.title}</span></li>`).join('')}</ol>`;
  }
  function refreshPanel() {
    const p = S.phase; const keep = sideBody.scrollTop;
    const wrap = sideBody.querySelector('.sheet-wrap'); const atBottom = !wrap || wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 8;
    let html = '', title = '';
    if (p === 'apresentacao' || p === 'montagem') { html = chaptersHTML(); title = p === 'montagem' ? 'Preparação' : 'Apresentação'; }
    else if (p === 'posicionar') { html = measure.positionHTML(); title = 'Posicionar'; }
    else if (p === 'medicao') { html = measure.measureHTML(); title = 'Planilha de campo'; }
    else if (p === 'cronometragem') { html = ev.cronoHTML(); title = 'Cronometragem e M'; }
    else if (p === 'resultado') { html = ev.resultHTML(rActive); title = 'Resultado'; }
    sideT.textContent = title;
    sideBody.innerHTML = html; sideBody.scrollTop = keep;
    const w2 = sideBody.querySelector('.sheet-wrap'); if (w2 && atBottom) w2.scrollTop = w2.scrollHeight;
    sideBody.querySelectorAll('[data-st]').forEach((li) => (li.onclick = () => goStep(+li.dataset.st)));
    measure.bind(sideBody); ev.bind(sideBody);
  }

  // ── fases ──
  let lastPhase = null;
  function render() {
    const p = S.phase; drawSteps();
    envSw.innerHTML = `${app.env?.()?.short || 'Sala de fornos'} <i>⇄</i>`; envSw.style.display = app.ENVS ? '' : 'none';
    const changed = p !== lastPhase; lastPhase = p;
    root.dataset.phase = p; document.body.dataset.uiPhase = p; // o painel "Postos de trabalho" (.pst) só aparece no Explorar
    const showSide = ['apresentacao', 'montagem', 'posicionar', 'medicao', 'cronometragem', 'resultado'].includes(p);
    side.classList.toggle('hidden', !showSide); side.classList.toggle('wide', ['cronometragem', 'resultado'].includes(p));
    lcdWrap.classList.toggle('hidden', !['apresentacao', 'montagem', 'posicionar', 'medicao', 'atividade'].includes(p));
    if (changed && narrow()) for (const el of [side, lcdWrap, live]) if (!el.dataset.user) el.classList.toggle('collapsed', !(el === side && ['posicionar', 'medicao', 'cronometragem', 'resultado'].includes(p)));
    if (changed && p !== 'laudo') { modal.classList.add('hidden'); document.body.classList.remove('laudo-open'); }
    if (showSide) refreshPanel();
    if (p === 'explorar') {
      setBar([soundBtn(), viewSeg(), btn(S.running ? '❙❙ Jornada' : '▶ Jornada', 'ghost', () => { app.run(!S.running); render(); }, 'A forneira segue o ciclo de trabalho em tempo acelerado'),
        btn('🎓 Demonstração', '', openChooser), btn('📝 Atividade', '', () => ativ.open(), 'O aluno faz a avaliação sozinho (guiada ou avaliação)'),
        btn('<span class="ic">◉</span> Medidor de IBUTG', 'primary big', () => startPresentation('tudo'))]);
    } else if (p === 'apresentacao' || p === 'montagem') {
      setBar([soundBtn(), btn('◀', '', () => goStep(stepIdx - 1), 'Passo anterior'), btn('Próximo ▶', 'primary', () => goStep(stepIdx + 1)),
        btn(demoClock.paused ? '▶ Continuar' : '❙❙ Pausar', 'ghost' + (demoClock.paused ? ' on' : ''), toggleDemoPause),
        btn(voice.on ? '🗣 Voz' : '🔈 Voz off', 'ghost', () => { voice.on = !voice.on; render(); }), btn('Pular ⏭', 'ghost', finishPresentation, 'Concluir a preparação e ir para o posicionamento')]);
    } else if (p === 'posicionar') {
      const pid = measure.placedId(), nx = measure.nextId();
      setBar([soundBtn(), viewSeg(), measure.allDone() ? btn('Cronometragem ▶', 'primary big', () => go('cronometragem'))
        : pid && !measure.sits[pid]?.done ? btn(`<span class="ic">●</span> Iniciar medição em ${pid}`, 'primary big', () => measure.begin(pid))
        : btn(`Posicionar em ${nx || SIDS()[0]} ➜`, 'primary big', () => measure.place(nx || SIDS()[0]))]);
    } else if (p === 'medicao') {
      const cur = measure.cur;
      if (cur && measure.measuring) {
        setBar([soundBtn(), viewSeg(), speedSeg(), btn(S.running ? '❙❙ Pausar' : '▶ Continuar', 'ghost', () => { app.run(!S.running); render(); }),
          measure.isSim(cur) ? btn(S.doorHold ? '🚪 Porta aberta (simulação)' : '🚪 Porta fechada', 'ghost' + (S.doorHold ? ' on' : ''), () => { app.holdDoor(!S.doorHold); render(); }, 'NHO-06 8.2: manter a condição até estabilizar') : null,
          btn('■ Encerrar', 'danger', () => measure.abort(), 'Encerrar a medição desta situação')]);
      } else {
        const nx = measure.nextId();
        setBar([soundBtn(), viewSeg(), nx ? btn(`➜ Levar o medidor para ${nx}`, 'primary big', async () => { app.setPhase('posicionar'); await measure.place(nx); })
          : btn('Cronometragem ▶', 'primary big', () => go('cronometragem'))]);
      }
    } else if (p === 'cronometragem') {
      const ok = ev.allM();
      setBar([soundBtn(), btn('◀ Medições', 'ghost', () => app.setPhase('medicao')), !ok ? btn('Usar gabarito de M', '', () => { ev.useGabarito(); refreshPanel(); render(); }) : null,
        btn('Resultado ▶', 'primary big' + (ok ? '' : ' disabled'), () => (ok ? go('resultado') : toast('Escolha a taxa metabólica de todas as atividades (ou use o gabarito).')))]);
    } else if (p === 'resultado') {
      setBar([soundBtn(), btn('◀ Cronometragem', 'ghost', () => { stopResult(); voice.stop(); app.setPhase('cronometragem'); }), btn('▶ Explicar passo a passo', '', () => explainResult()),
        btn('📄 Laudo', 'primary big', () => go('laudo'))]);
    } else if (p === 'atividade') {
      setBar([soundBtn(), viewSeg(), speedSeg(), btn(S.running ? '❙❙ Pausar' : '▶ Continuar', 'ghost', () => { if (!S.running && !ativ.A?.sheets?.[ativ.A?.cur]) return toast('Inicie as leituras pelo painel da atividade.'); app.run(!S.running); render(); }),
        btn('✕ Sair da atividade', 'ghost', () => ativ.exit())]);
    } else if (p === 'laudo') {
      setBar([soundBtn(), btn('◀ Resultado', 'ghost', () => { modal.classList.add('hidden'); document.body.classList.remove('laudo-open'); app.setPhase('resultado'); }),
        btn('📄 Abrir laudo', 'primary', showLaudo), btn('↺ Nova avaliação', 'ghost', () => location.reload())]);
    }
    requestAnimationFrame(() => layout());
  }
  Object.assign(uiApi, { render, refreshPanel, caption, hideCaption, say: (t) => say(t), toast });
  uiApi.voice = voice;
  const ativ = createActivity({ app, ui: uiApi, ev, root, h });

  // ── atualização contínua: cartão do ambiente, visor ──
  function liveHTML() {
    const seg = app.segment?.() || {}; const hr = seg.hour;
    const r = app.readings?.() || {}; const ib = r.tbn != null ? app.N.ibutg(r.tbn, r.tg) : null;
    const on = isOn(app), rec = isRec(app);
    const st = stationName(S.station);
    let fieldH = '';
    if (showField) {
      const e = app.fieldAtSensor?.();
      if (e) fieldH = `<div class="lv-field"><div class="lv-k">Valores de equilíbrio no ponto do globo <small>(professor)</small></div>
        <div class="lv-grid"><span>tar</span><b>${f(e.ta)}</b><span>tg</span><b>${f(e.tg)}</b><span>tbn</span><b>${f(e.tbn)}</b><span>UR</span><b>${f(e.rh * 100, 0)}%</b>
        <span>var</span><b>${f(e.va, 2)} m/s</b><span>trm</span><b>${f(e.tr)}</b><span class="w">IBUTG de equilíbrio</span><b class="w">${f(e.ibutg)} °C</b></div></div>`;
    }
    const sitTag = seg.sit ? `<i class="dot" style="background:${SIT_COLOR[seg.sit]}"></i>${seg.sit} · ` : '';
    return `<div class="lv-row"><div class="lv-clock"><span>Relógio</span><b>${app.fmtClock(S.clock)}</b><small>${S.running ? `${S.speed}× ▶` : 'tempo real'}</small></div>
      <div class="lv-act"><span>${cap1(workerName())}${hr?.label ? ` · ${hr.label}` : ''}</span><b>${seg.act ? sitTag + actShort(seg.act) : hr?.off ? 'Intervalo (fora do setor)' : `Fora do turno (${app.fmtClock(CYC().SHIFT?.start ?? 0)}–${app.fmtClock(CYC().SHIFT?.end ?? 0)})`}</b>${S.doorHold ? '<small class="hot">porta mantida aberta (simulação)</small>' : Object.values(app.field?.doors || {}).some((v) => v > 0.5) ? '<small class="hot">porta de fonte aberta</small>' : ''}</div></div>
      <div class="lv-meter"><div class="lv-k">Medidor ${st ? `<em>${st}</em>` : ''}<span class="pill ${rec ? 'rec' : on ? 'on' : ''}">${rec ? '● gravando' : on ? 'ligado' : 'desligado'}</span></div>
      <div class="lv-vals"><div><span>tg</span><b>${f(r.tg)}</b></div><div><span>tbn</span><b>${f(r.tbn)}</b></div><div><span>tbs</span><b>${f(r.tbs)}</b></div><div class="ib"><span>IBUTG</span><b>${f(ib)}</b></div></div>
      ${!app.wet?.() ? '<div class="lv-warn">⚠ pavio seco / reservatório vazio</div>' : ''}</div>
      <button class="lv-campo ${showField ? 'on' : ''}">${showField ? '▾' : '▸'} Leitura de campo (professor)</button>${fieldH}`;
  }
  liveBody.addEventListener('click', (e) => { if (e.target.closest('.lv-campo')) { showField = !showField; liveBody.innerHTML = liveHTML(); } });
  let acc = 0, acc2 = 0;
  app.stage?.onFrame?.((dt) => {
    acc += dt; acc2 += dt;
    if (acc >= 0.25) { acc = 0; layout(); if (!live.classList.contains('collapsed')) liveBody.innerHTML = liveHTML(); else live.querySelector('.lv-h span').textContent = `${app.fmtClock(S.clock)} · IBUTG ${f(app.N.ibutg(app.readings().tbn, app.readings().tg))}`; }
    if (acc2 >= 0.12 && !lcdWrap.classList.contains('hidden') && !lcdWrap.classList.contains('collapsed')) {
      acc2 = 0; const fw = app.fw, c = fw?.canvas;
      if (fw?.drawHi && lcd.clientWidth) { // visor vetorial na resolução do painel (nítido em qualquer DPR)
        const W = Math.round(lcd.clientWidth * Math.min(3, devicePixelRatio || 1)), H = Math.round(W * 0.75);
        if (lcd.width !== W || lcd.height !== H) { lcd.width = W; lcd.height = H; }
        try { fw.drawHi(lctx, W / 320); } catch { lctx.drawImage(c, 0, 0, W, H); }
      } else if (c?.width) { if (lcd.width !== c.width || lcd.height !== c.height) { lcd.width = c.width; lcd.height = c.height; } lctx.drawImage(c, 0, 0); }
    }
  });
  if (!narrow()) live.querySelector('.lv-h span').textContent = 'Ambiente e medidor';
  live.querySelector('.pn-toggle').addEventListener('click', () => { if (!live.classList.contains('collapsed')) live.querySelector('.lv-h span').textContent = 'Ambiente e medidor'; });

  // ── arranjo dos painéis (cartão → visor → painel; legenda entre o painel lateral e a borda) ──
  function layout() {
    root.style.setProperty('--bar-h', bar.offsetHeight + 'px');
    const vis = (e) => !e.classList.contains('hidden');
    if (narrow()) {
      let y = top.offsetTop + top.offsetHeight + 6, ySide = y;
      live.style.top = y + 'px'; y += live.offsetHeight + 6;
      if (vis(lcdWrap)) { lcdWrap.style.top = y + 'px'; y += lcdWrap.offsetHeight + 6; }
      // painel lateral recolhido fica à esquerda, na altura do cartão; aberto, abaixo de tudo
      side.style.top = (side.classList.contains('collapsed') && live.classList.contains('collapsed') ? ySide : y) + 'px';
      side.style.maxHeight = Math.max(160, Math.min(innerHeight * (['cronometragem', 'resultado'].includes(S.phase) ? 0.72 : 0.44), innerHeight - (side.classList.contains('collapsed') ? ySide : y) - bar.offsetHeight - 24)) + 'px'; // a cena continua visível
      cap.style.left = ''; cap.style.width = ''; cap.style.transform = '';
      return;
    }
    side.style.top = ''; side.style.maxHeight = ''; live.style.top = '';
    lcdWrap.style.top = (live.offsetTop + live.offsetHeight + 10) + 'px';
    const ap = root.querySelector('.ativ-panel:not(.hidden)'), lp = ap || (vis(side) && !side.classList.contains('collapsed') ? side : null);
    if (lp) {
      const r = lp.offsetLeft + lp.offsetWidth + 14, w = Math.min(720, innerWidth - r - 16);
      cap.style.left = r + Math.max(0, (innerWidth - r - 16 - w) / 2) + 'px'; cap.style.width = w + 'px'; cap.style.transform = 'none';
    } else { cap.style.left = ''; cap.style.width = ''; cap.style.transform = ''; }
  }
  addEventListener('resize', () => { render(); layout(); });
  for (const p of [live, lcdWrap, side]) p.querySelector('.pn-toggle').addEventListener('click', () => setTimeout(layout, 0));

  app.on('phase', render);
  app.on('shiftEnd', () => { toast('Fim da jornada (12:00).'); render(); });
  app.on('ready', () => { curView = new URLSearchParams(location.search).get('cam') || app.env?.()?.ref || null; if (S.phase === 'explorar' && new URLSearchParams(location.search).get('ui') !== '0') { const c = capt('inicio'); caption(c.title, c.text + envChoiceHTML()); bindEnvChoice(); } render(); });
  app.on('env', () => render());
  render(); layout();
  return { ativ, setEnv, render, refreshPanel, caption, say: (t) => say(t), voice, go, startPresentation, finishPresentation, goStep, explainResult, showLaudo, measure, eval: ev, data: D, toast,
    get stepIdx() { return stepIdx; }, get steps() { return steps; } };
}
