// PAINEL DA CALDEIRA — lógica de comando do queimador (CLP simplificado) de uma caldeira flamotubular.
// Sequência: LIGA → pré-purga 30 s → ignição (piloto) 5 s → chama estabelecida / baixa chama 10 s → modulação.
// Chave MAN-0-AUT (0 bloqueia; AUT modula pela pressão com pressostato de operação; MAN = carga ajustada na IHM).
// Pressão de vapor, nível do tubulão (bomba liga/desliga), temperatura dos gases evoluem de forma plausível.
// A física do calor (IBUTG) é acionada por app.setBoiler(id, {on, load}).
const SP = 9.5, P_STOP = 10.0, P_RESTART = 8.8, P_TRIP = 10.6;
const SEQ_TXT = {
  OFF: 'QUEIMADOR DESLIGADO', PURGE: 'PRÉ-PURGA DA FORNALHA', IGN: 'IGNIÇÃO — PILOTO ACESO', LOW: 'CHAMA ESTABELECIDA — BAIXA CHAMA',
  RUN: 'EM OPERAÇÃO — MODULANDO', POST: 'PÓS-PURGA', STBY: 'EM ESPERA — PRESSÃO ATINGIDA', LOCK: 'BLOQUEIO DE SEGURANÇA — REARME',
};
export const fmtHMS = (s) => { s = Math.floor(s); const H = Math.floor(s / 3600) % 24, M = Math.floor(s / 60) % 60, S = s % 60; return [H, M, S].map((v) => String(v).padStart(2, '0')).join(':'); };

export function createController(app, id, num) {
  const b0 = (app.boiler && app.boiler(id)) || { on: true, load: 0.75 };
  const clock = () => fmtHMS(app.state?.clock ?? 0);
  const s = {
    id, num, mode: 'AUT', seq: b0.on ? 'RUN' : 'OFF', tSeq: 0, P: b0.on ? 9.5 + num * 0.05 : 6.2, lvl: 0.52 + num * 0.02, tgas: b0.on ? 205 + num * 6 : 70,
    load: b0.load ?? 0.75, loadSP: b0.load ?? 0.75, flame: !!b0.on, pump: num === 2, estop: false, test: 0, msg: '', msgT: 0, page: 'geral',
    fsig: b0.on ? 14 : 0, damper: b0.on ? 20 + 80 * (b0.load ?? 0.75) : 0, t: 0, hist: [], histT: 0, dirty: true, sendT: 0, lastSent: b0.load ?? 0.75,
    alarms: num === 1
      ? [{ code: 'H1', txt: 'Nível baixo do tubulão (alarme)', t: '05:12:40', active: false, ack: true }, { code: 'H2', txt: 'Falha de chama na partida', t: '04:47:03', active: false, ack: true }]
      : [{ code: 'H3', txt: 'Pressão de gás baixa', t: '05:58:21', active: false, ack: true }],
    press: {}, // animação de botões (tempo restante pressionado)
  };
  for (let i = 0; i < 90; i++) s.hist.push(s.P + Math.sin(i * 0.31 + num) * 0.06);
  let self = false;
  const send = (o) => { self = true; try { app.setBoiler?.(id, o); } finally { self = false; } };
  // mudanças externas (UI, demo) mantêm o painel coerente
  app.on?.('boiler', (e) => {
    if (self || !e || e.id !== id) return;
    if (e.on && !s.flame) { s.flame = true; s.seq = 'RUN'; s.fsig = 14; }
    if (e.on === false && s.flame) { s.flame = false; s.seq = 'OFF'; }
    if (e.load != null && Math.abs(e.load - s.load) > 0.02) { s.load = s.loadSP = s.lastSent = e.load; }
    s.dirty = true;
  });

  const say = (m, T = 3.5) => { s.msg = m; s.msgT = T; s.dirty = true; };
  const alarm = (code, txt) => { const a = s.alarms.find((q) => q.code === code && q.active); if (a) return; s.alarms.unshift({ code, txt, t: clock(), active: true, ack: false }); s.alarms.length = Math.min(s.alarms.length, 12); s.page = 'alarmes'; };
  const flameOn = () => { s.flame = true; send({ on: true, load: s.load }); s.lastSent = s.load; };
  const flameOff = () => { if (s.flame) send({ on: false }); s.flame = false; };
  const burning = () => ['PURGE', 'IGN', 'LOW', 'RUN'].includes(s.seq);
  const blocked = () => {
    if (s.estop) return 'EMERGÊNCIA ACIONADA — LIBERE O BOTÃO E REARME';
    if (s.mode === '0') return 'CHAVE EM 0 — COMANDO BLOQUEADO';
    if (s.seq === 'LOCK' || s.alarms.some((a) => a.active && !a.ack)) return 'FALHA ATIVA — PRESSIONE REARME';
    return null;
  };
  const start = () => { s.seq = 'PURGE'; s.tSeq = 0; s.page = 'queimador'; say('PARTIDA: PRÉ-PURGA DE 30 s'); };

  const actions = {
    liga() {
      const b = blocked(); if (b) return say(b);
      if (burning()) return say('QUEIMADOR JÁ EM OPERAÇÃO');
      start();
    },
    desl() {
      if (burning()) { flameOff(); s.seq = 'POST'; s.tSeq = 0; say('QUEIMADOR DESLIGADO PELO OPERADOR'); }
      else if (s.seq === 'STBY') { s.seq = 'OFF'; say('QUEIMADOR DESLIGADO PELO OPERADOR'); }
      else say('QUEIMADOR JÁ DESLIGADO');
    },
    rearme() {
      let n = 0;
      for (const a of s.alarms) { if (!a.ack) { a.ack = true; n++; } if (a.active && !cond(a.code)) { a.active = false; n++; } }
      if (s.seq === 'LOCK' && !s.estop) { s.seq = 'OFF'; n++; }
      say(n ? 'ALARMES RECONHECIDOS / REARMADOS' : 'SEM ALARMES PARA REARMAR');
    },
    teste() { s.test = 3; say('TESTE DE LÂMPADAS', 3); },
    estop() {
      s.estop = !s.estop;
      if (s.estop) { flameOff(); s.seq = 'LOCK'; alarm('EM', 'Parada de emergência acionada no painel'); say('PARADA DE EMERGÊNCIA'); }
      else say('EMERGÊNCIA LIBERADA — PRESSIONE REARME');
    },
    up() { if (s.mode !== 'MAN') return say('AJUSTE DE CARGA SÓ EM MANUAL'); s.loadSP = Math.min(1, Math.round((s.loadSP + 0.05) * 20) / 20); say(`CARGA MANUAL: ${Math.round(s.loadSP * 100)} %`, 2); },
    dn() { if (s.mode !== 'MAN') return say('AJUSTE DE CARGA SÓ EM MANUAL'); s.loadSP = Math.max(0.25, Math.round((s.loadSP - 0.05) * 20) / 20); say(`CARGA MANUAL: ${Math.round(s.loadSP * 100)} %`, 2); },
    ack() { actions.rearme(); },
  };
  function setMode(m) {
    if (!['MAN', '0', 'AUT'].includes(m) || m === s.mode) return;
    s.mode = m;
    if (m === '0') { if (burning()) { flameOff(); s.seq = 'POST'; s.tSeq = 0; } else if (s.seq === 'STBY') s.seq = 'OFF'; say('CHAVE EM 0 — QUEIMADOR BLOQUEADO'); }
    else if (m === 'MAN') { s.loadSP = Math.max(0.25, s.load); say('MODO MANUAL — AJUSTE A CARGA NA IHM (▲▼)'); }
    else say('MODO AUTOMÁTICO — CARGA PELA PRESSÃO');
  }
  const cond = (code) => (code === 'EM' ? s.estop : code === 'PA' ? s.P > P_STOP : code === 'NB' ? s.lvl < 0.3 : false);

  function press(key) {
    s.press[key] = 0.18; s.dirty = true;
    if (key === 'selL') return setMode(s.mode === 'AUT' ? '0' : 'MAN');
    if (key === 'selR') return setMode(s.mode === 'MAN' ? '0' : 'AUT');
    if (key.startsWith('tab:')) { s.page = key.slice(4); return; }
    actions[key]?.();
  }

  function update(dt, t) {
    dt = Math.min(dt, 0.25); s.t += dt;
    for (const k in s.press) if ((s.press[k] -= dt) <= 0) delete s.press[k];
    if (s.test > 0) s.test -= dt;
    if (s.msgT > 0 && (s.msgT -= dt) <= 0) { s.msg = ''; s.dirty = true; }
    const prev = s.seq;
    s.tSeq += dt;
    switch (s.seq) {
      case 'PURGE': if (s.tSeq >= 30) { s.seq = 'IGN'; s.tSeq = 0; } break;
      case 'IGN': if (s.tSeq >= 5) { s.seq = 'LOW'; s.tSeq = 0; s.load = 0.3; flameOn(); say('CHAMA ESTABELECIDA'); } break;
      case 'LOW': if (s.tSeq >= 10) { s.seq = 'RUN'; s.tSeq = 0; } break;
      case 'POST': if (s.tSeq >= 15) { s.seq = 'OFF'; s.tSeq = 0; } break;
      case 'STBY': if (s.mode === 'AUT' && s.P <= P_RESTART && !blocked()) start(); break;
    }
    // modulação
    if (s.seq === 'RUN') {
      const tgt = s.mode === 'MAN' ? s.loadSP : Math.max(0.25, Math.min(1, 0.75 + 0.9 * (SP - s.P)));
      s.load += Math.sign(tgt - s.load) * Math.min(Math.abs(tgt - s.load), dt * 0.04); // servomotor do registro ≈ 25 s de curso
      if (s.mode === 'AUT' && s.P >= P_STOP) { flameOff(); s.seq = 'STBY'; s.tSeq = 0; say('PRESSÃO ATINGIDA — QUEIMADOR EM ESPERA'); }
      if (s.P >= P_TRIP) { flameOff(); s.seq = 'LOCK'; alarm('PA', 'Pressão alta — desarme pelo pressostato de segurança'); }
    }
    // processo: vapor, nível, gases
    const firing = s.flame ? s.load : 0;
    const dem = (0.72 + 0.06 * Math.sin(t / 47 + num) + 0.03 * Math.sin(t / 13 + num * 2)) * Math.max(0, Math.min(1.15, s.P / SP));
    s.P = Math.max(0, s.P + (firing - dem) * 0.06 * dt);
    if (s.lvl < 0.47) s.pump = true; else if (s.lvl > 0.58) s.pump = false;
    s.lvl += ((s.pump ? 0.0075 : 0) - 0.0042 * dem - 0.0006) * dt;
    if (s.lvl < 0.3) alarm('NB', 'Nível baixo do tubulão');
    const tg = s.flame ? 150 + 85 * s.load : ['PURGE', 'POST'].includes(s.seq) ? 95 : 70;
    s.tgas += (tg - s.tgas) * (1 - Math.exp(-dt / 25));
    s.fsig += ((s.flame ? 13.5 + 1.2 * Math.sin(t * 3.1) : s.seq === 'IGN' ? 6 * Math.min(1, s.tSeq / 2) : 0) - s.fsig) * (1 - Math.exp(-dt / 0.6));
    const dmp = s.seq === 'PURGE' ? 100 : s.seq === 'POST' ? 100 : s.seq === 'IGN' || s.seq === 'LOW' ? 20 : s.flame ? 20 + 80 * s.load : 0;
    s.damper += (dmp - s.damper) * (1 - Math.exp(-dt / 4));
    // sincroniza a carga com a física (sem inundar eventos)
    s.sendT -= dt;
    if (s.flame && s.sendT <= 0 && Math.abs(s.load - s.lastSent) > 0.03) { send({ load: s.load }); s.lastSent = s.load; s.sendT = 2; }
    if ((s.histT -= dt) <= 0) { s.histT = 2; s.hist.push(s.P); if (s.hist.length > 90) s.hist.shift(); }
    if (prev !== s.seq) s.dirty = true;
  }

  return {
    id, num, s, press, setMode, update,
    get seqText() { return SEQ_TXT[s.seq]; },
    alarmUnacked: () => s.alarms.some((a) => !a.ack),
    alarmActive: () => s.alarms.some((a) => a.active),
    state: () => ({ id, mode: s.mode, seq: s.seq, flame: s.flame, P: +s.P.toFixed(2), level: +s.lvl.toFixed(3), tgas: Math.round(s.tgas), load: +s.load.toFixed(2),
      pump: s.pump, estop: s.estop, page: s.page, alarms: s.alarms.filter((a) => a.active).map((a) => a.txt), purgeLeft: s.seq === 'PURGE' ? Math.ceil(30 - s.tSeq) : 0 }),
  };
}
