// Núcleo lógico do firmware do medidor de IBUTG "iTemp" — dono: FIRMWARE. PURO (sem DOM): testável em node
// (node tools/fw_test.mjs). Navegação e comportamento documentados em docs/FIRMWARE.md.
//  • ⏻ segurar 2 s liga/desliga (abertura: logo → versão → autoteste). ⏻ curto alterna Principal ↔ Mostradores.
//  • ▶‖ inicia / pausa / retoma a gravação (bipe).  • ■ segurar 2 s para e salva a sessão na memória.
//  • ≡ abre o menu. No menu: ▶‖ desce, ≡ entra/confirma, ■ volta (cancela), ⏻ curto sai do menu.
//    Campos numéricos (data/hora, duração): ▶‖ aumenta, ≡ próximo campo/confirma, ■ campo anterior/cancela.
// Separador decimal: PONTO ("26.0°C"), como no visor do aparelho da FOTO 1 (firmware em padrão internacional).
// O aparelho NÃO detecta pavio seco ou reservatório vazio: ele só mede o que o sensor indica (erro do avaliador).
// Os registros são sempre armazenados em °C (a unidade escolhida só muda o visor).

export const LONG_MS = 2000;                 // pressão longa (⏻ e ■)
export const BOOT_S = 4.6;                   // abertura: logo 0–1,4 s, versão 1,4–2,4 s, autoteste 2,4–4,6 s
export const OFF_S = 0.9;                    // "Desligando…"
export const INTERVALS = [10, 30, 60, 300];  // s
export const AUTONOMY_H = 30;                // autonomia com 100 % de carga (h)
export const LOW_BATT = 20, CRIT_BATT = 3;   // %
export const MAX_SESSIONS = 40;
export const DEVICE = {
  model: 'iTemp', name: 'Medidor de IBUTG', serial: 'IT-2611-0473', firmware: 'v2.4.1', hardware: 'rev. C',
  cert: 'LCT-0918/26', calDate: '14/03/2026', calValid: '14/03/2027', lab: 'Laboratório acreditado (RBC/Inmetro)',
  ranges: { tg: [0, 120], tbs: [0, 100], tbn: [0, 60] }, resolution: 0.1, accuracy: 0.5,
};

const clampI = (v, a, b) => Math.max(a, Math.min(b, v));
export const pad2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
export const hms = (t) => { t = Math.max(0, Math.floor(t)); return `${pad2(t / 3600)}:${pad2((t / 60) % 60)}:${pad2(t % 60)}`; };
export const hhmm = (t) => { t = ((Math.floor(t) % 86400) + 86400) % 86400; return `${pad2(t / 3600)}:${pad2((t / 60) % 60)}`; };
export const hhmmss = (t) => { t = ((Math.floor(t) % 86400) + 86400) % 86400; return `${pad2(t / 3600)}:${pad2((t / 60) % 60)}:${pad2(t % 60)}`; };
export const r1 = (x) => Math.round(x * 10 + (x >= 0 ? 1e-9 : -1e-9)) / 10;
/** Eq. 5.1 da NHO-06 (ambiente interno / externo sem carga solar) e Eq. 5.2 (externo com carga solar). */
export const ibutgInt = (tg, tbn) => 0.7 * tbn + 0.3 * tg;
export const ibutgExt = (tg, tbn, tbs) => 0.7 * tbn + 0.2 * tg + 0.1 * tbs;
const esat = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3)); // kPa
/** UR estimada (psicrométrica, γ = 6,6e-4 K⁻¹, 101,3 kPa) a partir de tbs e tbn. Informativa: o bulbo úmido natural não é
 *  aspirado e recebe radiação, então a estimativa sai alta junto a fontes radiantes. */
export function rhEstimate(tbs, tbn) {
  if (!(isFinite(tbs) && isFinite(tbn))) return null;
  const e = esat(tbn) - 6.6e-4 * 101.3 * (tbs - tbn);
  return clampI((e / esat(tbs)) * 100, 0, 100);
}
export const toF = (c) => c * 1.8 + 32;
/** formata temperatura com ponto decimal (padrão do visor) na unidade escolhida */
export const fmtT = (c, unit = 'C') => (c == null || !isFinite(c) ? '---.-' : (unit === 'F' ? toF(c) : c).toFixed(1));
export const fmtInterval = (s) => (s < 60 ? `${s} s` : `${s / 60} min`);

// ── data (calendário simples) ──
const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const dim = (m, y) => (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 29 : DIM[m - 1]);
function addDays(d, n) {
  let { d: dd, m, y } = d;
  while (n > 0) { dd++; if (dd > dim(m, y)) { dd = 1; m++; if (m > 12) { m = 1; y++; } } n--; }
  while (n < 0) { dd--; if (dd < 1) { m--; if (m < 1) { m = 12; y--; } dd = dim(m, y); } n++; }
  return { d: dd, m, y };
}
export const fmtDate = (d) => `${pad2(d.d)}/${pad2(d.m)}/${d.y}`;

// ── estrutura do menu ──
export const MENUS = {
  main: { title: 'Menu', items: [['Gravação', 'gravacao'], ['Memória', 'memoria'], ['Data e hora', 'datahora'], ['Unidade', 'unidade'],
    ['Tela', 'tela'], ['Brilho', 'brilho'], ['Desligamento automático', 'autooff'], ['Informações', 'info'], ['Voltar', null]] },
  gravacao: { title: 'Gravação', items: [['Intervalo de registro', 'intervalo'], ['Duração programada', 'duracao'], ['Bloqueio do teclado', 'bloqueio'], ['Voltar', null]] },
};
export const PAGES = {
  intervalo: { type: 'options', title: 'Intervalo de registro', lockRec: true, options: INTERVALS.map(fmtInterval),
    get: (st) => INTERVALS.indexOf(st.interval), set: (st, i) => (st.interval = INTERVALS[i]) },
  duracao: { type: 'fields', title: 'Duração programada', lockRec: true, fields: [['h', 0, 24, 1], ['mi', 0, 50, 10]], sep: ':',
    load: (st) => ({ h: Math.floor(st.duration / 3600), mi: Math.floor((st.duration % 3600) / 60 / 10) * 10 }),
    save: (st, v) => (st.duration = clampI(v.h * 3600 + v.mi * 60, 600, 24 * 3600)) },
  bloqueio: { type: 'options', title: 'Bloqueio do teclado', sub: 'Durante a gravação', options: ['Desligado', 'Ligado'],
    get: (st) => (st.lockKeys ? 1 : 0), set: (st, i) => (st.lockKeys = i === 1) },
  memoria: { type: 'memory', title: 'Memória' },
  datahora: { type: 'fields', title: 'Data e hora', lockRec: true, fields: [['d', 1, 31, 1], ['m', 1, 12, 1], ['y', 2024, 2035, 1], ['h', 0, 23, 1], ['mi', 0, 59, 1]] },
  unidade: { type: 'options', title: 'Unidade', options: ['°C (Celsius)', '°F (Fahrenheit)'], get: (st) => (st.unit === 'F' ? 1 : 0), set: (st, i) => (st.unit = i ? 'F' : 'C') },
  tela: { type: 'options', title: 'Tela inicial', options: ['Principal (valores)', 'Mostradores'], get: (st) => st.homeScreen, set: (st, i) => (st.homeScreen = i) },
  brilho: { type: 'options', title: 'Brilho', options: ['20 %', '40 %', '60 %', '80 %', '100 %'], get: (st) => st.brightness - 1, set: (st, i) => (st.brightness = i + 1) },
  autooff: { type: 'options', title: 'Desligamento automático', sub: 'Sem gravação em curso', options: ['Nunca', '10 min', '30 min', '60 min'],
    get: (st) => [0, 10, 30, 60].indexOf(st.autoOff), set: (st, i) => (st.autoOff = [0, 10, 30, 60][i]) },
  info: { type: 'info', title: 'Informações' },
};
export const SCREENS = ['Principal', 'Mostradores'];

// Sessões antigas já na memória (o aparelho do avaliador tem histórico de campo).
function seedMemory() {
  return [
    { n: 1, date: { d: 22, m: 9, y: 2026 }, start: 8 * 3600 + 12 * 60, stop: 9 * 3600 + 40 * 60, interval: 60, count: 88, old: true, place: 'Caldeiraria' },
    { n: 2, date: { d: 23, m: 9, y: 2026 }, start: 13 * 3600 + 5 * 60, stop: 14 * 3600 + 10 * 60, interval: 60, count: 65, old: true, place: 'Fundição' },
    { n: 3, date: { d: 6, m: 10, y: 2026 }, start: 7 * 3600 + 30 * 60, stop: 8 * 3600 + 2 * 60, interval: 30, count: 64, old: true, place: 'Lavanderia' },
  ];
}

/**
 * createCore({getInput}) → núcleo. getInput() → {tg, tbn, tbs, wet, battery, globeOn?}.
 * state.power: 'off' | 'boot' | 'on' | 'shutdown'.  state.mode: 'idle' | 'rec' | 'pause'.
 * state.menuPath: [] (fora do menu) ou ['main', ...]. state.page: página-folha aberta.  state.popup: aviso modal.
 */
export function createCore({ getInput } = {}) {
  getInput ||= () => ({ tg: 26, tbn: 21, tbs: 26, wet: true, battery: 94 });
  const listeners = {};
  const emit = (ev, d) => { (listeners[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); };
  const settings = { interval: 60, duration: 8 * 3600, unit: 'C', homeScreen: 0, brightness: 5, autoOff: 0, lockKeys: false };
  const s = {
    power: 'off', mode: 'idle', screen: 0, menuPath: [], menuSel: {}, menuTop: {}, page: null, popup: null, msg: null,
    bootT: 0, offT: 0, clock: 6 * 3600, clockOffset: 0, baseDate: { d: 17, m: 11, y: 2026 }, dayOffset: 0,
    shown: { tg: null, tbn: null, tbs: null }, battery: 94, drain: 0, lowWarned: false, globeOk: true,
    memory: seedMemory(), session: null, saved: [], keysLocked: false, idleReal: 0, blinkT: 0, rev: 1, settings, selfTest: null,
  };
  let sampleT = 1, lastMin = -1;
  const bump = () => { s.rev++; };
  const change = () => { bump(); emit('change', s); };
  const beep = (kind) => emit('beep', kind);
  const say = (text, t = 2.2, kind = 'info') => { s.msg = { text, t, kind }; bump(); };
  const nowClock = () => s.clock + s.clockOffset;
  const today = () => addDays(s.baseDate, s.dayOffset + Math.floor(nowClock() / 86400));
  const recording = () => s.mode === 'rec' || s.mode === 'pause';
  const inp = () => { const i = getInput() || {}; return i; };
  function battery() { const b = inp().battery; return clampI((b ?? 94) - s.drain, 0, 100); }
  const autonomyH = () => (battery() / 100) * AUTONOMY_H;

  function sample() {
    const i = inp();
    s.globeOk = i.globeOn !== false;
    s.shown = { tg: s.globeOk ? i.tg : null, tbn: i.tbn, tbs: i.tbs };
    s.battery = battery();
  }

  // ── liga / desliga ──
  function boot() {
    s.power = 'boot'; s.bootT = 0; s.screen = settings.homeScreen; s.menuPath = []; s.page = null; s.popup = null; s.msg = null;
    sample();
    const mem = s.memory.length;
    s.selfTest = [
      ['Sensor de globo', s.globeOk ? 'OK' : 'NÃO DETECTADO', s.globeOk],
      ['Sensor de bulbo seco', 'OK', true],
      ['Sensor de bulbo úmido', 'OK', true],
      ['Memória', `${mem} sessões · ${Math.max(0, 100 - Math.round((mem / MAX_SESSIONS) * 100))}% livre`, mem < MAX_SESSIONS],
      ['Relógio', `${fmtDate(today())} ${hhmm(nowClock())}`, true],
      ['Bateria', `${Math.round(s.battery)} % (~${Math.floor(autonomyH())} h)`, s.battery >= LOW_BATT],
      ['Calibração', `válida até ${DEVICE.calValid}`, true],
    ];
    beep('boot'); change(); emit('power', { on: true });
  }
  function finishBoot() {
    s.power = 'on'; s.idleReal = 0; sample(); change(); beep('ok');
    if (!s.globeOk) popup('Globo não detectado', ['Rosqueie o globo negro no', 'conector antes de medir.'], 'warn');
    else if (s.battery < LOW_BATT) lowBatteryPopup();
    else if (autonomyH() * 3600 < settings.duration) popup('Bateria insuficiente', [`Autonomia ~${autonomyH().toFixed(1)} h, menor que a`, `duração programada (${hms(settings.duration).slice(0, 5)}).`], 'warn');
  }
  function powerOff(reason = 'tecla') {
    if (recording() && reason === 'tecla') { say('Pare a gravação (■ 2 s) antes de desligar', 2.6, 'warn'); beep('error'); return; }
    s.power = 'shutdown'; s.offT = 0; s.menuPath = []; s.page = null; s.popup = null; s.msg = null; beep('off'); change();
  }
  function popup(title, lines, kind = 'info', t = 3.2) { s.popup = { title, lines, kind, t }; beep(kind === 'info' ? 'ok' : 'warn'); change(); }
  function lowBatteryPopup() { s.lowWarned = true; popup('Bateria baixa', [`Carga ${Math.round(battery())} % (~${autonomyH().toFixed(1)} h).`, 'Troque as pilhas antes de medir.'], 'warn', 3.6); }

  // ── gravação ──
  function startRec() {
    if (!s.globeOk) { say('Globo não detectado', 2.4, 'warn'); beep('error'); return; }
    const saved = s.memory.length;
    if (saved >= MAX_SESSIONS) { say('Memória cheia — apague sessões', 2.6, 'warn'); beep('error'); return; }
    const n = (s.memory.reduce((a, r) => Math.max(a, r.n), 0) || 0) + 1;
    s.session = { n, date: today(), start: s.clock, stop: null, interval: settings.interval, duration: settings.duration, unit: settings.unit,
      rows: [], pauses: [], elapsed: 0, acc: 0, lowBattery: s.battery < LOW_BATT, battStart: Math.round(s.battery), stopReason: null };
    s.mode = 'rec'; s.screen = s.screen; beep('start'); change();
    emit('started', { session: n, clock: s.clock, interval: settings.interval, duration: settings.duration });
    if (autonomyH() * 3600 < settings.duration) say(`Atenção: autonomia ~${autonomyH().toFixed(1)} h`, 2.8, 'warn');
  }
  function pauseRec(on) {
    const ss = s.session; if (!ss) return;
    if (on) { s.mode = 'pause'; ss.pauses.push({ from: s.clock, to: null }); beep('pause'); }
    else { s.mode = 'rec'; const p = ss.pauses[ss.pauses.length - 1]; if (p && p.to == null) p.to = s.clock; beep('start'); }
    change(); emit('paused', { paused: on, clock: s.clock, session: ss.n });
  }
  function stopRec(reason = 'manual') {
    const ss = s.session; if (!ss) return null;
    ss.stop = s.clock; ss.stopReason = reason;
    for (const p of ss.pauses) if (p.to == null) p.to = s.clock;
    ss.count = ss.rows.length; ss.battEnd = Math.round(s.battery);
    s.memory.push(ss); s.saved.push(ss); s.session = null; s.mode = 'idle'; s.keysLocked = false;
    beep('stop'); change();
    say(reason === 'duracao' ? `Duração atingida · sessão ${pad2(ss.n)} salva` : reason === 'bateria' ? `Bateria esgotada · sessão ${pad2(ss.n)} salva` : `Sessão ${pad2(ss.n)} salva · ${ss.rows.length} registros`, 3);
    const out = pubSession(ss); emit('stopped', out); return out;
  }
  function pushRow(ss) {
    const i = inp(); const tg = i.globeOn === false ? null : r1(i.tg), tbn = r1(i.tbn), tbs = r1(i.tbs);
    const row = { clock: s.clock, tg, tbn, tbs, ii: tg == null ? null : r1(ibutgInt(tg, tbn)), ie: tg == null ? null : r1(ibutgExt(tg, tbn, tbs)) };
    ss.rows.push(row); emit('record', row); return row;
  }

  // ── teclas ──
  function press(key, holdMs = 0) {
    const long = holdMs >= LONG_MS;
    s.idleReal = 0;
    if (s.power === 'off') { if (key === 'power' && long) boot(); return; }
    if (s.power === 'boot' || s.power === 'shutdown') return;
    if (s.popup) { s.popup = null; beep('key'); change(); if (!(key === 'power' && long)) return; }
    if (s.keysLocked && recording()) {
      if (key === 'menu' && long) { s.keysLocked = false; say('Teclado liberado', 1.6); beep('long'); return; }
      say('Teclado bloqueado · segure ≡ 2 s', 2, 'warn'); beep('error'); return;
    }
    if (key === 'power' && long) { powerOff('tecla'); return; }
    if (s.menuPath.length) return menuKey(key, long);
    mainKey(key, long);
  }
  function mainKey(key, long) {
    if (key === 'power') { s.screen = (s.screen + 1) % SCREENS.length; beep('key'); return change(); }
    if (key === 'play') {
      if (s.mode === 'idle') startRec(); else pauseRec(s.mode === 'rec');
      return;
    }
    if (key === 'stop') {
      if (!recording()) { say('Nenhuma gravação em curso', 1.6); beep('key'); return; }
      if (!long) { say('Segure ■ por 2 s para parar e salvar', 2); beep('key'); return; }
      stopRec('manual'); return;
    }
    if (key === 'menu') {
      if (long && recording() && settings.lockKeys) { s.keysLocked = true; say('Teclado bloqueado', 1.6); beep('long'); return; }
      s.menuPath = ['main']; s.menuSel.main = 0; s.menuTop.main = 0; beep('key'); change();
    }
  }
  function openPage(key) {
    const P = PAGES[key];
    if (P.lockRec && recording()) { say('Indisponível durante a gravação', 2, 'warn'); beep('error'); return; }
    const pg = { key, sel: 0, field: 0, values: null, view: null, top: 0 };
    if (P.type === 'options') pg.sel = Math.max(0, P.get(settings));
    else if (P.type === 'fields') {
      if (key === 'datahora') { const t = nowClock(), d = today(); pg.values = { d: d.d, m: d.m, y: d.y, h: Math.floor(t / 3600) % 24, mi: Math.floor(t / 60) % 60 }; }
      else pg.values = P.load(settings);
    }
    s.menuPath.push(key); s.page = pg; beep('key'); change();
  }
  function closePage() { s.menuPath.pop(); s.page = null; change(); }
  function menuKey(key, long) {
    const top = s.menuPath[s.menuPath.length - 1];
    if (key === 'power') { s.menuPath = []; s.page = null; beep('key'); return change(); }  // ⏻ curto: sai do menu
    const M = MENUS[top];
    if (M) {
      const n = M.items.length; let sel = s.menuSel[top] || 0;
      if (key === 'play') { sel = (sel + 1) % n; beep('key'); }
      else if (key === 'stop') { s.menuPath.pop(); beep('key'); return change(); }
      else if (key === 'menu') {
        const target = M.items[sel][1];
        if (!target) { s.menuPath.pop(); beep('key'); return change(); }
        if (MENUS[target]) { s.menuPath.push(target); s.menuSel[target] = 0; s.menuTop[target] = 0; beep('key'); return change(); }
        return openPage(target);
      }
      s.menuSel[top] = sel; return change();
    }
    pageKey(PAGES[top], s.page, key, long);
  }
  function pageKey(P, pg, key) {
    beep('key');
    if (P.type === 'info') { if (key === 'play') { pg.sel = (pg.sel + 1) % 2; return change(); } return closePage(); }
    if (P.type === 'options') {
      const n = P.options.length;
      if (key === 'play') pg.sel = (pg.sel + 1) % n;
      else if (key === 'stop') return closePage();
      else { P.set(settings, pg.sel); say('Salvo', 1.2); if (P === PAGES.tela) s.screen = settings.homeScreen; return closePage(); }
      return change();
    }
    if (P.type === 'fields') {
      const [k, mn, mx, st] = P.fields[pg.field];
      if (key === 'play') pg.values[k] = pg.values[k] + st > mx ? mn : pg.values[k] + st;
      else if (key === 'stop') { if (pg.field === 0) return closePage(); pg.field--; }
      else {
        pg.field++;
        if (pg.field >= P.fields.length) {
          if (pg.key === 'datahora') {
            const v = pg.values; v.d = Math.min(v.d, dim(v.m, v.y));
            const cur = Math.floor(s.clock), want = v.h * 3600 + v.mi * 60;
            s.clockOffset = want - ((cur - (cur % 60)) % 86400);
            // a data passa a valer a partir de hoje no relógio ajustado
            const dayNow = Math.floor((s.clock + s.clockOffset) / 86400);
            s.baseDate = { d: v.d, m: v.m, y: v.y }; s.dayOffset = -dayNow;
          } else P.save(settings, pg.values);
          say('Salvo', 1.2); return closePage();
        }
      }
      return change();
    }
    if (P.type === 'memory') return memoryKey(pg, key);
  }
  // Memória: lista (mais recente primeiro) + "Apagar todas" + "Voltar" → detalhes (Ver registros / Apagar / Voltar) → registros
  function memList() { return [...s.memory].reverse(); }
  function memoryKey(pg, key) {
    const list = memList();
    if (!pg.view) {
      const n = list.length + 2;
      if (key === 'play') pg.sel = (pg.sel + 1) % n;
      else if (key === 'stop') return closePage();
      else {
        if (pg.sel === list.length) { pg.view = 'confirmAll'; pg.csel = 0; }
        else if (pg.sel === list.length + 1) return closePage();
        else { pg.view = 'detail'; pg.rec = list[pg.sel]; pg.dsel = 0; }
      }
      return change();
    }
    if (pg.view === 'detail') {
      if (key === 'play') pg.dsel = (pg.dsel + 1) % 3;
      else if (key === 'stop') pg.view = null;
      else if (pg.dsel === 0) { pg.view = 'rows'; pg.rtop = 0; }
      else if (pg.dsel === 1) { pg.view = 'confirm'; pg.csel = 0; }
      else pg.view = null;
      return change();
    }
    if (pg.view === 'rows') {
      const nrows = pg.rec.rows ? pg.rec.rows.length : pg.rec.count || 0;
      if (key === 'play') pg.rtop = nrows ? (pg.rtop + 6 >= nrows ? 0 : pg.rtop + 6) : 0;
      else pg.view = 'detail';
      return change();
    }
    if (pg.view === 'confirm' || pg.view === 'confirmAll') {
      if (key === 'play') pg.csel = (pg.csel + 1) % 2;
      else if (key === 'stop') pg.view = pg.view === 'confirm' ? 'detail' : null;
      else {
        if (pg.csel === 1) {
          if (pg.view === 'confirm') { s.memory = s.memory.filter((r) => r !== pg.rec); say(`Sessão ${pad2(pg.rec.n)} apagada`, 1.8); }
          else { s.memory = []; say('Memória apagada', 1.8); }
          pg.sel = 0; beep('ok');
        }
        pg.view = pg.view === 'confirm' && pg.csel === 0 ? 'detail' : null;
      }
      return change();
    }
  }

  // ── tempo simulado ──
  function feed(read, dt, clock) {
    if (clock != null) setClock(clock);
    if (!(dt > 0)) return;
    if (s.power === 'on' || s.power === 'boot') {
      // consumo: gravação em tempo simulado (o visor em tempo real é descontado em update)
      if (s.mode === 'rec' || s.mode === 'pause') s.drain += (dt * 100) / (AUTONOMY_H * 3600);
    }
    const ss = s.session;
    if (!ss || s.mode !== 'rec' || s.power !== 'on') return;
    ss.elapsed += dt; ss.acc += dt;
    while (ss.acc >= ss.interval - 1e-9) { ss.acc -= ss.interval; pushRow(ss); }
    if (s.battery < LOW_BATT) ss.lowBattery = true;
    if (ss.elapsed >= ss.duration) { stopRec('duracao'); return; }
    bump();
  }
  function setClock(sec) {
    s.clock = sec; const m = Math.floor(nowClock() / 60);
    if (m !== lastMin) { lastMin = m; bump(); }
  }

  // ── tempo real (visor, temporizadores) ──
  function update(dt) {
    dt = Math.min(Math.max(dt || 0, 0), 0.25);
    if (s.power === 'off') return;
    if (s.power === 'shutdown') { s.offT += dt; if (s.offT >= OFF_S) { s.power = 'off'; change(); emit('power', { on: false }); } else bump(); return; }
    if (s.power === 'boot') {
      const prev = s.bootT; s.bootT += dt;
      if (Math.floor(prev * 20) !== Math.floor(s.bootT * 20)) bump();
      // bipe curto a cada item do autoteste
      const k0 = Math.floor((prev - 2.4) / 0.3), k1 = Math.floor((s.bootT - 2.4) / 0.3);
      if (s.bootT > 2.4 && k1 !== k0 && k1 >= 0 && k1 < 7) beep('tick');
      if (s.bootT >= BOOT_S) finishBoot();
      return;
    }
    if (!recording()) s.drain += (dt * 100) / (AUTONOMY_H * 3600);
    sampleT += dt;
    if (sampleT >= 0.5) { sampleT = 0; const before = JSON.stringify(s.shown) + Math.round(s.battery); sample(); if (JSON.stringify(s.shown) + Math.round(s.battery) !== before) bump(); }
    if (s.battery < LOW_BATT && !s.lowWarned) lowBatteryPopup();
    if (s.battery <= CRIT_BATT) {
      if (recording()) stopRec('bateria');
      powerOff('bateria'); return;
    }
    if (s.msg) { s.msg.t -= dt; if (s.msg.t <= 0) { s.msg = null; bump(); } }
    if (s.popup) { s.popup.t -= dt; if (s.popup.t <= 0) { s.popup = null; bump(); } }
    const pb = Math.floor(s.blinkT * 2); s.blinkT += dt; if (Math.floor(s.blinkT * 2) !== pb) bump();
    s.idleReal += dt;
    if (settings.autoOff && !recording() && s.idleReal > settings.autoOff * 60) powerOff('auto');
  }

  // ── resultados ──
  function pubSession(ss) {
    return { n: ss.n, date: fmtDate(ss.date), start: ss.start, stop: ss.stop, interval: ss.interval, duration: ss.duration,
      elapsed: ss.elapsed, rows: ss.rows.map((r) => ({ ...r })), pauses: ss.pauses.map((p) => ({ ...p })), lowBattery: !!ss.lowBattery,
      stopReason: ss.stopReason };
  }
  function results() {
    return {
      sessions: s.saved.filter((x) => s.memory.includes(x)).map(pubSession),
      recording: s.session ? { ...pubSession(s.session), paused: s.mode === 'pause' } : null,
      device: { ...DEVICE }, settings: { ...settings }, battery: Math.round(s.battery), power: s.power,
    };
  }

  function quickStart() {
    s.power = 'on'; s.bootT = BOOT_S; s.screen = settings.homeScreen; s.menuPath = []; s.page = null; s.popup = null; s.msg = null;
    s.idleReal = 0; sample(); change(); emit('power', { on: true });
  }

  return {
    state: s, settings, press, update, feed, setClock, quickStart, results,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)); },
    // auxiliares para o visor/testes
    clockShown: nowClock, today, battery, autonomyH, memList, recording,
    elapsed: () => (s.session ? s.session.elapsed : 0),
  };
}
