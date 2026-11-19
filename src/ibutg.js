// Núcleo normativo — dono: ORQUESTRADOR. NHO-06 (Fundacentro, 3ª ed.) + NR-15 Anexo 3 (Portaria SEPRT 1.359/2019).
// Tabelas extraídas do PDF por tools/parse_tables.mjs (src/ibutg_tables.js). Teste: node tools/ibutg_test.mjs
// Observações sobre a impressão da NHO-06: a Tabela 1 salta de M=464 para M=479 (falta a linha 471/22,2) e a Tabela 4
// traz 164 e 288 onde a Tabela 2 traz 165 e 289. O simulador usa as tabelas como impressas.
import { NHO_T1, NHO_T2, NHO_T3, NHO_T4 } from './ibutg_tables.js';
export { NHO_T1, NHO_T2, NHO_T3, NHO_T4 };
/** NR-15 Anexo 3, Quadro 1 = NHO-06 Tabela 2 (idênticos, conferido em tools/ibutg_test.mjs). */
export const NR15_Q1 = NHO_T2;

/** Quadro 2 da NR-15 Anexo 3 = Quadro 1 da NHO-06 (taxa metabólica por tipo de atividade, W). */
export const QUADRO_M = [
  { grupo: 'Sentado', itens: [
    ['Em repouso', 100], ['Trabalho leve com as mãos', 126], ['Trabalho moderado com as mãos', 153], ['Trabalho pesado com as mãos', 171],
    ['Trabalho leve com um braço', 162], ['Trabalho moderado com um braço', 198], ['Trabalho pesado com um braço', 234],
    ['Trabalho leve com dois braços', 216], ['Trabalho moderado com dois braços', 252], ['Trabalho pesado com dois braços', 288],
    ['Trabalho leve com braços e pernas', 324], ['Trabalho moderado com braços e pernas', 441], ['Trabalho pesado com braços e pernas', 603]] },
  { grupo: 'Em pé, agachado ou ajoelhado', itens: [
    ['Em repouso', 126], ['Trabalho leve com as mãos', 153], ['Trabalho moderado com as mãos', 180], ['Trabalho pesado com as mãos', 198],
    ['Trabalho leve com um braço', 189], ['Trabalho moderado com um braço', 225], ['Trabalho pesado com um braço', 261],
    ['Trabalho leve com dois braços', 243], ['Trabalho moderado com dois braços', 279], ['Trabalho pesado com dois braços', 315],
    ['Trabalho leve com o corpo', 351], ['Trabalho moderado com o corpo', 468], ['Trabalho pesado com o corpo', 630]] },
  { grupo: 'Em pé, em movimento — andando no plano', itens: [
    ['Sem carga, 2 km/h', 198], ['Sem carga, 3 km/h', 252], ['Sem carga, 4 km/h', 297], ['Sem carga, 5 km/h', 360],
    ['Com carga de 10 kg, 4 km/h', 333], ['Com carga de 30 kg, 4 km/h', 450]] },
  { grupo: 'Correndo no plano', itens: [['9 km/h', 787], ['12 km/h', 873], ['15 km/h', 990]] },
  { grupo: 'Subindo rampa', itens: [
    ['Sem carga, 5° de inclinação, 4 km/h', 324], ['Sem carga, 15° de inclinação, 3 km/h', 378], ['Sem carga, 25° de inclinação, 3 km/h', 540],
    ['Com carga de 20 kg, 15° de inclinação, 4 km/h', 486], ['Com carga de 20 kg, 25° de inclinação, 4 km/h', 738]] },
  { grupo: 'Descendo rampa (5 km/h) sem carga', itens: [['5° de inclinação', 243], ['15° de inclinação', 252], ['25° de inclinação', 324]] },
  { grupo: 'Escada (80 degraus/min, degrau de 0,17 m)', itens: [
    ['Subindo sem carga', 522], ['Subindo com carga (20 kg)', 648], ['Descendo sem carga', 279], ['Descendo com carga (20 kg)', 400]] },
  { grupo: 'Outras atividades', itens: [
    ['Trabalho moderado de braços (ex.: varrer, trabalho em almoxarifado)', 320], ['Trabalho moderado de levantar ou empurrar', 349],
    ['Trabalho de empurrar carrinhos de mão, no mesmo plano, com carga', 391],
    ['Trabalho de carregar pesos ou com movimentos vigorosos com os braços (ex.: trabalho com foice)', 495],
    ['Trabalho pesado de levantar, empurrar ou arrastar pesos (ex.: remoção com pá, abertura de valas)', 524]] },
];

/** NHO-06 Quadro 2 — incrementos de ajuste do IBUTG médio por vestimenta (°C). Capuz: +1 °C. */
export const VESTIMENTAS = [
  { id: 'curta', label: 'Calça e camisa de manga curta', add: -1 },
  { id: 'uniforme', label: 'Uniforme de trabalho (calça e camisa de manga longa)', add: 0 },
  { id: 'macacao', label: 'Macacão de tecido simples', add: 0 },
  { id: 'sms', label: 'Macacão de polipropileno SMS (Spun-Melt-Spun)', add: 0.5 },
  { id: 'poliolefina', label: 'Macacão de poliolefina', add: 1 },
  { id: 'forrado', label: 'Vestimenta ou macacão forrado (tecido duplo)', add: 3 },
  { id: 'avental', label: 'Avental longo de manga longa impermeável ao vapor', add: 4 },
  { id: 'impermeavel', label: 'Macacão impermeável ao vapor', add: 10 },
  { id: 'imp_sobre', label: 'Macacão impermeável ao vapor sobreposto à roupa de trabalho', add: 12 },
];

const r1 = (x) => Math.round(x * 10 + 1e-9) / 10;
export const round1 = r1;
export const fmt = (x, d = 1) => (x == null || !isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));

/** Equações 5.1 (interno ou externo sem carga solar) e 5.2 (externo com carga solar direta). */
export function ibutg(tbn, tg, tbs = null, solar = false) {
  return solar ? 0.7 * tbn + 0.2 * tg + 0.1 * tbs : 0.7 * tbn + 0.3 * tg;
}

/** Equações 5.3/5.4 — média ponderada no tempo. parts: [{v, t(min)}]; a soma dos tempos deve ser 60 min. */
export function weighted(parts) {
  const T = parts.reduce((s, p) => s + p.t, 0);
  const v = parts.reduce((s, p) => s + p.v * p.t, 0) / (T || 1);
  return { value: v, totalMin: T, ok: Math.abs(T - 60) < 1e-6 };
}

/** Valor da tabela para a M "imediatamente mais elevada" (NHO-06 item 9). M acima da tabela → fora (null). */
export function lookup(table, M) {
  for (const row of table) if (row[0] >= M - 1e-9) return { M: row[0], v: row[1], row };
  return null;
}
/** Tabela 3 (valor teto): M ≤ 240 → 38,0. */
export function valorTeto(M) { return M <= 240 ? { M: 240, v: 38.0 } : lookup(NHO_T3, M); }
export function regiaoIncerteza(M) { const r = lookup(NHO_T4, M); return r ? { M: r.M, lo: r.row[1], hi: r.row[2] } : null; }

/**
 * Estabilização (NHO-06 item 8.2): leituras a cada minuto; atingida quando ≥ 5 leituras consecutivas variam dentro de
 * 0,4 °C (máx − mín ≤ 0,4) — exigido para tg, tbn e tbs. Os valores atribuídos são as médias do intervalo estabilizado.
 * readings: [{tg, tbn, tbs}] (1 por minuto). Retorna o PRIMEIRO trecho estabilizado de n leituras (n = 5 por padrão).
 */
export function stabilization(readings, n = 5, band = 0.4) {
  const keys = ['tg', 'tbn', 'tbs'];
  for (let i = 0; i + n <= readings.length; i++) {
    const win = readings.slice(i, i + n);
    const spans = {}; let ok = true;
    for (const k of keys) {
      const vals = win.map((r) => r[k]).filter((v) => v != null);
      if (vals.length < n) { if (k === 'tbs') continue; ok = false; break; }
      spans[k] = Math.max(...vals) - Math.min(...vals);
      if (spans[k] > band + 1e-9) { ok = false; break; }
    }
    if (ok) {
      const mean = {}; for (const k of keys) { const vals = win.map((r) => r[k]).filter((v) => v != null); mean[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; }
      return { stable: true, start: i, end: i + n - 1, mean, spans };
    }
  }
  return { stable: false };
}

/**
 * Avaliação completa.
 * situacoes: [{id, label, tbn, tg, tbs, t (min no período de 60 min), M (taxa da atividade nela, p/ valor teto)}]
 * atividades: [{id, label, M, t (min)}]
 * opts: {solar=false, vest='uniforme', capuz=false, aclimatizado=true}
 */
export function evaluate(situacoes, atividades, { solar = false, vest = 'uniforme', capuz = false, aclimatizado = true } = {}) {
  const sits = situacoes.map((s) => ({ ...s, ibutg: ibutg(s.tbn, s.tg, s.tbs, solar) }));
  const Ib = weighted(sits.map((s) => ({ v: s.ibutg, t: s.t })));
  const Mm = weighted(atividades.map((a) => ({ v: a.M, t: a.t })));
  const v = VESTIMENTAS.find((x) => x.id === vest) || VESTIMENTAS[1];
  const ajuste = v.add + (capuz ? 1 : 0);
  const ibMed = Ib.value, ibAdj = ibMed + ajuste;
  const M = Mm.value;
  const NA = lookup(NHO_T1, M), LE = lookup(NHO_T2, M), INC = regiaoIncerteza(M), NR = lookup(NR15_Q1, M);
  const teto = sits.map((s) => { const vt = s.M != null ? valorTeto(s.M) : null; return { id: s.id, ibutg: s.ibutg, M: s.M, vt: vt?.v ?? null, vtM: vt?.M ?? null, excede: vt ? s.ibutg > vt.v : false }; });
  const tetoExcedido = teto.some((t) => t.excede);
  // Decisão NHO-06 (Quadro 3). Comparação feita com o IBUTG ajustado (vestimenta) arredondado a 0,1 °C.
  const x = r1(ibAdj);
  let decisao, atuacao, cls;
  const limite = aclimatizado ? LE : NA;
  if (!LE || !NA) { decisao = 'M fora da faixa das tabelas'; atuacao = 'Avaliar caso a caso'; cls = 'warn'; }
  else if (!aclimatizado) {
    if (x > NA.v || tetoExcedido) { decisao = 'Limite de exposição ultrapassado (não aclimatizado)'; atuacao = 'Adoção imediata de medidas corretivas'; cls = 'bad'; }
    else { decisao = 'Aceitável (não aclimatizado)'; atuacao = 'No mínimo, manutenção da condição existente'; cls = 'ok'; }
  } else if (x > LE.v || tetoExcedido) { decisao = 'Limite de exposição ultrapassado'; atuacao = 'Adoção imediata de medidas corretivas'; cls = 'bad'; }
  else if (INC && x >= INC.lo) { decisao = 'Região de incerteza'; atuacao = 'Adoção de medidas preventivas e corretivas visando à redução da exposição'; cls = 'warn'; }
  else if (x > NA.v) { decisao = 'Nível de ação ultrapassado'; atuacao = 'No mínimo, adoção de medidas preventivas'; cls = 'info'; }
  else { decisao = 'Aceitável'; atuacao = 'No mínimo, manutenção da condição existente'; cls = 'ok'; }
  // NR-15 Anexo 3 item 2.3: insalubre quando o IBUTG médio ultrapassa o limite do Quadro 1 para a M média; grau médio (2.6).
  const nr15 = NR ? { limite: NR.v, Mtab: NR.M, insalubre: x > NR.v, grau: x > NR.v ? 'médio' : null, adicional: x > NR.v ? '20% do salário mínimo (NR-15, item 15.2, grau médio)' : null } : null;
  return {
    sits, ibutgMedio: ibMed, ibutgAjustado: ibAdj, ajuste, vest: v, capuz, M, tempos: { ibutg: Ib.totalMin, M: Mm.totalMin, ok: Ib.ok && Mm.ok },
    NA, LE, INC, teto, tetoExcedido, aclimatizado, limite, decisao, atuacao, cls, nr15,
    arred: { ibutg: x, M: Math.round(M) },
  };
}

/** Taxa metabólica: procura no quadro pelo texto (ajuda a UI). */
export function findM(text) {
  for (const g of QUADRO_M) for (const [l, w] of g.itens) if ((g.grupo + ' ' + l).toLowerCase().includes(text.toLowerCase())) return { grupo: g.grupo, label: l, M: w };
  return null;
}
