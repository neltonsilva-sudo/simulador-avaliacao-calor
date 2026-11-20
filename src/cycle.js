// Ciclo de exposição da forneira e jornada — dono: ORQUESTRADOR.
// Situação térmica ≠ atividade física (NHO-06): na bancada (S2) ela também transporta esteiras (A4).
export const SITUACOES = {
  S1: { id: 'S1', station: 'forno', label: 'Frente ao forno turbo 1, porta aberta', desc: 'Carga e descarga de esteiras com a porta do forno aberta (a 0,8 m da abertura).' },
  S2: { id: 'S2', station: 'bancada', label: 'Bancada de modelagem', desc: 'Divisão, modelagem e enformamento da massa a cerca de 3 m da linha de fornos.' },
  S3: { id: 'S3', station: 'descanso', label: 'Área de descanso e hidratação', desc: 'Pausa sentada junto ao bebedouro, área ventilada, afastada dos fornos.' },
};
// M conforme Quadro 2 da NR-15 Anexo 3 / Quadro 1 da NHO-06 (escolha didática "correta" — a UI deixa o aluno escolher).
export const ATIVIDADES = {
  A1: { id: 'A1', sit: 'S1', label: 'Carregar e descarregar o forno (esteiras de ~8 kg, empurrar o carrinho)', quadro: 'Outras atividades — Trabalho moderado de levantar ou empurrar', M: 349 },
  A2: { id: 'A2', sit: 'S2', label: 'Modelar e enformar a massa na bancada, em pé', quadro: 'Em pé — Trabalho leve com dois braços', M: 243 },
  A4: { id: 'A4', sit: 'S2', label: 'Levar as esteiras da bancada ao carrinho (~10 kg, andando)', quadro: 'Andando no plano — Com carga de 10 kg, 4 km/h', M: 333 },
  A3: { id: 'A3', sit: 'S3', label: 'Pausa para hidratação, sentada', quadro: 'Sentado — Em repouso', M: 100 },
};
// Jornada (horário de início de cada hora, s do dia). s1 = minutos frente ao forno por hora (n cargas × duração média).
const h = (H) => H * 3600;
export const JORNADA = [
  { start: h(5), label: 'Preparo das massas', cargas: 0, s3: 6 },
  { start: h(6), label: 'Forneamento — pico (pão francês)', cargas: 6, s3: 6 },
  { start: h(7), label: 'Forneamento', cargas: 4, s3: 6 },
  { start: h(8), label: 'Forneamento (pães especiais)', cargas: 3, s3: 6 },
  { start: h(9), label: 'Intervalo para refeição (fora do setor)', off: true },
  { start: h(10), label: 'Forneamento (reposição)', cargas: 2, s3: 6 },
  { start: h(11), label: 'Limpeza e organização', cargas: 0, s3: 6 },
];
export const CARGA_MIN = 4;     // duração média de cada carga/descarga (min) — ver CRONO
export const TRANSP_MIN = 1;    // duração média de cada transporte de esteiras (min), um por carga
export const SHIFT = { start: h(5), end: h(12) };

/** Cronometragens (mín. 3 por situação/atividade, NHO-06 8.2) observadas na hora de pico 06:00–07:00, em segundos. */
export const CRONO = {
  S1: { evento: 'Carga/descarga do forno (porta aberta)', porHora: 6, s: [238, 246, 236] },
  S3: { evento: 'Pausa para hidratação', porHora: 1, s: [365, 350, 365] },
  A4: { evento: 'Transporte de esteiras até o carrinho', porHora: 6, s: [58, 63, 59] },
};

/** Composição de uma hora: minutos em cada situação e em cada atividade (somam 60). */
export function hourComposition(hr) {
  if (hr.off) return null;
  const s1 = hr.cargas * CARGA_MIN, s3 = hr.s3, s2 = 60 - s1 - s3;
  const a4 = hr.cargas * TRANSP_MIN;
  return { sit: { S1: s1, S2: s2, S3: s3 }, act: { A1: s1, A2: s2 - a4, A4: a4, A3: s3 } };
}
export const hourAt = (clock) => { let cur = null; for (const hr of JORNADA) if (clock >= hr.start) cur = hr; return clock < SHIFT.end ? cur : null; };

/**
 * Sequência dentro da hora: n ciclos de [S2 trabalho, S2 transporte, S1 carga], com a pausa S3 no fim da 3ª parte da hora.
 * Retorna {hour, sit, act, station, door (forno1 aberto?), t0, t1 (s do dia)} para o instante `clock`.
 */
export function segmentAt(clock) {
  const hr = hourAt(clock);
  if (!hr || hr.off) return { hour: hr, sit: null, act: null, station: hr?.off ? null : 'descanso', door: false };
  const c = hourComposition(hr); const segs = [];
  const n = hr.cargas;
  if (n === 0) { segs.push(['S2', 'A2', 27 * 60]); segs.push(['S3', 'A3', c.sit.S3 * 60]); segs.push(['S2', 'A2', (60 - 27 - c.sit.S3) * 60]); }
  else {
    const work = (c.act.A2 * 60) / n;
    for (let i = 0; i < n; i++) {
      segs.push(['S2', 'A2', work]); segs.push(['S2', 'A4', TRANSP_MIN * 60]); segs.push(['S1', 'A1', CARGA_MIN * 60]);
      if (i === Math.floor(n / 2) - 1 || (n === 1 && i === 0)) segs.push(['S3', 'A3', c.sit.S3 * 60]);
    }
  }
  let t = hr.start;
  for (const [sit, act, d] of segs) { if (clock < t + d) return { hour: hr, sit, act, station: SITUACOES[sit].station, door: sit === 'S1', t0: t, t1: t + d }; t += d; }
  const [sit, act] = segs.at(-1); return { hour: hr, sit, act, station: SITUACOES[sit].station, door: sit === 'S1', t0: t, t1: t };
}
export const fmtClock = (s) => { s = Math.floor(s); const H = Math.floor(s / 3600) % 24, M = Math.floor(s / 60) % 60; return `${String(H).padStart(2, '0')}:${String(M).padStart(2, '0')}`; };
export const fmtMS = (s) => `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, '0')}"`;

// ════════════ AMBIENTE 2 — casa de caldeiras (operador de caldeira) ════════════
export const SITUACOES_C = {
  S1: { id: 'S1', station: 'caldeira', label: 'Frente da caldeira 1', desc: 'Leitura do visor de nível e dos manômetros, ajuste do queimador e registros no painel, a ~1 m do tampo frontal quente.' },
  S2: { id: 'S2', station: 'valvulas', label: 'Distribuidor de vapor', desc: 'Manobra de válvulas, purgas de fundo e inspeção de purgadores junto ao coletor de vapor sem isolamento (vazamento de vapor na gaxeta).' },
  S3: { id: 'S3', station: 'controle', label: 'Sala de controle', desc: 'Cabine envidraçada e climatizada: registro no livro da caldeira e supervisão pelo painel.' },
};
export const ATIVIDADES_C = {
  A1: { id: 'A1', sit: 'S1', label: 'Inspecionar e operar a frente da caldeira (visor, manômetros, ajuste do queimador)', quadro: 'Em pé — Trabalho moderado com dois braços', M: 279 },
  A2: { id: 'A2', sit: 'S2', label: 'Abrir e fechar válvulas, purga de fundo (volantes pesados)', quadro: 'Outras atividades — Trabalho moderado de levantar ou empurrar', M: 349 },
  A4: { id: 'A4', sit: 'S2', label: 'Ronda até o distribuidor de vapor e o trocador', quadro: 'Andando no plano — Sem carga, 4 km/h', M: 297 },
  A3: { id: 'A3', sit: 'S3', label: 'Registrar no livro da caldeira, sentado', quadro: 'Sentado — Trabalho leve com as mãos', M: 126 },
};
// rondas: cada ronda de 30 min = [S1 A1 s1][S2 A4 2][S2 A2 a2][S2 A4 2][S3 A3 s3]  (min)
export const JORNADA_C = [
  { start: h(6), label: 'Partida e aquecimento das caldeiras', rondas: [[10, 6, 10], [10, 6, 10]] },
  { start: h(7), label: 'Pico de consumo de vapor (produção a plena carga)', rondas: [[15, 6, 5], [15, 6, 5]] },
  { start: h(8), label: 'Operação em regime', rondas: [[12, 6, 8], [12, 6, 8]] },
  { start: h(9), label: 'Operação em regime', rondas: [[12, 6, 8], [12, 6, 8]] },
  { start: h(10), label: 'Intervalo para refeição (fora da casa de caldeiras)', off: true },
  { start: h(11), label: 'Operação em regime + análise da água', rondas: [[10, 6, 10], [10, 6, 10]] },
  { start: h(12), label: 'Operação em regime', rondas: [[10, 6, 10], [10, 6, 10]] },
  { start: h(13), label: 'Passagem de turno', rondas: [[8, 6, 12], [8, 6, 12]] },
];
export const SHIFT_C = { start: h(6), end: h(14) };
export const CRONO_C = {
  S1: { evento: 'Permanência na frente da caldeira por ronda', porHora: 2, s: [905, 890, 905] },
  S3: { evento: 'Registro na sala de controle por ronda', porHora: 2, s: [300, 290, 310] },
  A4: { evento: 'Deslocamento de ida/volta ao distribuidor', porHora: 4, s: [118, 124, 118] },
};
function hourCompositionC(hr) {
  if (!hr || hr.off) return null;
  const sit = { S1: 0, S2: 0, S3: 0 }, act = { A1: 0, A2: 0, A4: 0, A3: 0 };
  for (const [s1, a2, s3] of hr.rondas) { sit.S1 += s1; sit.S2 += a2 + 4; sit.S3 += s3; act.A1 += s1; act.A2 += a2; act.A4 += 4; act.A3 += s3; }
  return { sit, act };
}
const hourAtC = (clock) => { let cur = null; for (const hr of JORNADA_C) if (clock >= hr.start) cur = hr; return clock < SHIFT_C.end ? cur : null; };
function segmentAtC(clock) {
  const hr = hourAtC(clock);
  if (!hr || hr.off) return { hour: hr, sit: null, act: null, station: hr?.off ? null : 'controle', door: false };
  const segs = [];
  for (const [s1, a2, s3] of hr.rondas) segs.push(['S1', 'A1', s1], ['S2', 'A4', 2], ['S2', 'A2', a2], ['S2', 'A4', 2], ['S3', 'A3', s3]);
  let t = hr.start;
  for (const [sit, act, m] of segs) { const d = m * 60; if (clock < t + d) return { hour: hr, sit, act, station: SITUACOES_C[sit].station, door: false, t0: t, t1: t + d }; t += d; }
  return { hour: hr, sit: 'S3', act: 'A3', station: 'controle', door: false, t0: t, t1: t };
}

/** Ciclos por ambiente, com a mesma forma. app.cycle() devolve o do ambiente ativo. */
export const CYCLES = {
  fornos: { env: 'fornos', SITUACOES, ATIVIDADES, JORNADA, CRONO, SHIFT, hourComposition, hourAt, segmentAt, PEAK: h(6), WORKER: 'forneira' },
  caldeiras: { env: 'caldeiras', SITUACOES: SITUACOES_C, ATIVIDADES: ATIVIDADES_C, JORNADA: JORNADA_C, CRONO: CRONO_C, SHIFT: SHIFT_C,
    hourComposition: hourCompositionC, hourAt: hourAtC, segmentAt: segmentAtC, PEAK: h(7), WORKER: 'operadora de caldeira' },
};

/**
 * Ciclo com só alguns postos (situações térmicas) escolhidos pelo usuário. O tempo dos postos retirados passa para o posto
 * "receptor" (o de maior tempo na hora de pico entre os escolhidos), na sua atividade principal. A cronometragem do receptor
 * deixa de existir (ele vira "60 min − os demais"); somem as situações/atividades/cronometragens dos postos retirados.
 * Mesma interface do ciclo original (SITUACOES, ATIVIDADES, JORNADA, CRONO, SHIFT, hourComposition, hourAt, segmentAt, PEAK).
 */
export function filterCycle(C, postos) {
  const all = Object.keys(C.SITUACOES);
  const keep = all.filter((id) => postos.includes(id));
  if (!keep.length || keep.length === all.length) return C;
  const peak = C.JORNADA.find((h) => h.start === C.PEAK) || C.JORNADA.find((h) => !h.off);
  const base = C.hourComposition(peak);
  // receptor: a situação "restante" do ciclo original (sem cronometragem própria), se ficou; senão a de maior tempo no pico
  const rem = all.find((id) => !C.CRONO[id]);
  const R = keep.includes(rem) ? rem : keep.slice().sort((a, b) => base.sit[b] - base.sit[a])[0];
  const actsR = Object.values(C.ATIVIDADES).filter((a) => a.sit === R).map((a) => a.id);
  const mainR = actsR.slice().sort((a, b) => (base.act[b] ?? 0) - (base.act[a] ?? 0))[0];
  const SIT = Object.fromEntries(keep.map((id) => [id, C.SITUACOES[id]]));
  const ACT = Object.fromEntries(Object.entries(C.ATIVIDADES).filter(([, a]) => keep.includes(a.sit)));
  const CRONO = Object.fromEntries(Object.entries(C.CRONO).filter(([id]) => id !== R && (SIT[id] || ACT[id])));
  function hourComposition(hr) {
    const c = C.hourComposition(hr); if (!c) return c;
    const sit = {}, act = {}; let movS = 0, movA = 0;
    for (const id of all) if (keep.includes(id)) sit[id] = c.sit[id]; else movS += c.sit[id];
    for (const [a, m] of Object.entries(c.act)) if (ACT[a]) act[a] = m; else movA += m;
    sit[R] += movS; act[mainR] = (act[mainR] || 0) + movA;
    return { sit, act };
  }
  function segmentAt(clock) {
    const g = C.segmentAt(clock);
    if (!g.sit || keep.includes(g.sit)) return g;
    return { ...g, sit: R, act: mainR, station: C.SITUACOES[R].station, door: R === 'S1' && C.env === 'fornos' };
  }
  return { ...C, SITUACOES: SIT, ATIVIDADES: ACT, CRONO, hourComposition, segmentAt, postos: keep, receptor: R };
}
