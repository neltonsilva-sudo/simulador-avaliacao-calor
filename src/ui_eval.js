// Cronometragem, taxa metabólica, vestimenta, resultado passo a passo e laudo — dono: UI/DEMO.
// Todos os números vêm do núcleo normativo (app.N = ibutg.js) e do ciclo (app.CY = cycle.js); nada digitado à mão.
import { SIT_COLOR } from './ui_measure.js';

const f = (v, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const fr = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Textos descritivos do laudo por ambiente (app.state.env); números e tabelas vêm sempre dos dados. */
export const LAUDO_TXT = {
  fornos: {
    cab: 'Panificação industrial (cenário didático) · Setor: sala de fornos · Função avaliada: forneira',
    obj: 'Avaliar quantitativamente a exposição ocupacional ao calor da forneira da sala de fornos, para fins de prevenção (NHO-06 da Fundacentro) e de caracterização de insalubridade (NR-15, Anexo 3, Portaria SEPRT 1.359/2019). Justificativa: atividade em ambiente fechado com fontes artificiais de calor (fornos), com carga e descarga junto à porta aberta do forno turbo.',
    fontes: 'Fontes: linha de fornos (rotativo a gás, lastro, turbo sobre lastro com armário de fermentação, lastro vertical e forno turbo 1, junto ao qual ocorre a carga e descarga). Calor radiante elevado com a porta aberta, ar aquecido e vapor liberado da massa.',
    grupo: 'Grupo de exposição: forneiras do turno da manhã (05:00–12:00).',
    controles: 'Coifas de exaustão sobre os fornos; área de descanso ventilada, afastada dos fornos, com bebedouro (hidratação); pausa de cerca de 6 minutos por hora; uniforme de manga longa e luvas térmicas na carga do forno. As medidas reduzem a exposição horária, mas não eliminam o calor radiante da porta aberta durante as cargas.',
    corretivas: 'reduzir o tempo de porta aberta (carga mais rápida, carrinho de esteiras), barreira refletora ou cortina de ar na frente do forno, reforço da exaustão, alternância de tarefas e pausas em local termicamente ameno.',
    vestNota: 'A forneira usa o uniforme branco de calça e camisa de manga longa e avental de tecido comum (não impermeável): sem ajuste. Trabalha no setor todos os dias → aclimatizada.',
  },
  caldeiras: {
    cab: 'Indústria com geração de vapor (cenário didático) · Setor: casa de caldeiras · Função avaliada: operadora de caldeira',
    obj: 'Avaliar quantitativamente a exposição ocupacional ao calor da operadora de caldeira, para fins de prevenção (NHO-06 da Fundacentro) e de caracterização de insalubridade (NR-15, Anexo 3, Portaria SEPRT 1.359/2019). Justificativa: atividade em ambiente fechado com fontes artificiais de calor contínuas (caldeiras flamotubulares, coletor de vapor e trocador sem isolamento, vazamentos de vapor).',
    fontes: 'Fontes: tampo frontal quente das caldeiras 1 e 2, coletor e distribuidor de vapor sem isolamento térmico, trocador casco-tubo e desaerador; vapor liberado em gaxetas e purgas eleva a umidade junto às válvulas. As condições térmicas são contínuas durante a operação: não há condição de curta duração a simular.',
    grupo: 'Grupo de exposição: operadoras de caldeira do turno da manhã (06:00–14:00), em rondas de 30 minutos.',
    controles: 'Sala de controle envidraçada e climatizada para registros e supervisão; isolamento térmico da linha aérea de vapor; uniforme de manga longa, capacete e protetor auricular. A frente das caldeiras e o distribuidor de vapor permanecem sem barreira e o coletor sem isolamento.',
    corretivas: 'isolar termicamente o coletor, o distribuidor e o trocador, eliminar os vazamentos de vapor (gaxetas e purgadores), instalar barreira refletora na frente das caldeiras, ventilação local na área de válvulas, automação das purgas e redução do tempo de permanência por ronda com pausas na sala de controle.',
    vestNota: 'A operadora usa uniforme de calça e camisa de manga longa (tecido simples): sem ajuste. Trabalha no setor todos os dias → aclimatizada.',
  },
};

export const RESULT_STEPS = [
  { id: 'r1', title: '1 · IBUTG de cada situação (equação 5.1)',
    text: 'Primeiro, o IBUTG de cada situação térmica, com as médias do intervalo estabilizado e a equação 5.1, de ambiente interno: 0,7 vezes o bulbo úmido natural mais 0,3 vezes o globo.' },
  { id: 'r2', title: '2 · Médias ponderadas nos 60 minutos mais desfavoráveis',
    text: 'Depois, as médias ponderadas no tempo, nos 60 minutos corridos mais desfavoráveis da jornada: o IBUTG médio pela equação 5.3 e a taxa metabólica média pela equação 5.4.' },
  { id: 'r3', title: '3 · Ajuste da vestimenta (Quadro 2 da NHO-06)',
    text: 'Se a vestimenta não for a tradicional, o IBUTG médio recebe o ajuste do Quadro 2 antes de ser comparado com os limites.' },
  { id: 'r4', title: '4 · Limites para a taxa metabólica média',
    text: 'Com a taxa metabólica média, buscamos os limites nas tabelas. Quando o valor de M fica entre duas linhas, usamos a linha da M imediatamente mais elevada, que tem o limite mais baixo.' },
  { id: 'r5', title: '5 · Valor teto em cada situação (Tabela 3)',
    text: 'Cada situação térmica também é comparada com o valor teto da Tabela 3, usando a taxa metabólica da atividade feita nela.' },
  { id: 'r6', title: '6 · Decisão pela NHO-06 (Quadro 3)',
    text: 'A decisão segue o Quadro 3 da NHO-06: aceitável, nível de ação ultrapassado, região de incerteza ou limite de exposição ultrapassado, cada um com a sua atuação recomendada.' },
  { id: 'r7', title: '7 · Insalubridade pela NR-15, Anexo 3',
    text: 'Para a NR-15, o IBUTG médio é comparado com o Quadro 1 do Anexo 3, para a taxa metabólica média. Se ultrapassar o limite, a atividade é caracterizada como insalubre, em grau médio.' },
];

export function createEval({ app, ui, measure }) {
  const N = app.N, CY = app.CY; // CY só para formatação (fmtClock/fmtMS)
  const CYC = () => app.cycle?.() || app.CY;
  const D = { M: {}, vest: 'uniforme', capuz: false, aclim: true, avaliador: '', hint: {} };
  app.on('env', () => { D.M = {}; D.hint = {}; D.vest = 'uniforme'; D.capuz = false; D.aclim = true; });
  const ACTS_ = () => Object.keys(CYC().ATIVIDADES);
  const SIDS = () => Object.keys(CYC().SITUACOES);
  const actsOf = (sid) => ACTS_().filter((a) => CYC().ATIVIDADES[a].sit === sid);
  const PEAK_ = () => { const C = CYC(); return C.JORNADA.find((h) => h.start === C.PEAK) || C.JORNADA.find((h) => !h.off); };

  // ── cronometragem (NHO-06 8.2: média aritmética de ≥ 3 cronometragens) ──
  function crono() {
    // situações/atividades com cronometragem própria: tempo = média × ocorrências por hora; a situação sem cronometragem é o
    // restante dos 60 min; numa situação com várias atividades, a atividade sem cronometragem é o restante dela.
    const C = CYC().CRONO, mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const ev = Object.entries(C).map(([id, c]) => ({ id, ...c, mean: mean(c.s), min: (mean(c.s) * c.porHora) / 60 }));
    const g = (id) => ev.find((e) => e.id === id)?.min;
    const sit = {}, rest = [];
    for (const id of SIDS()) { const v = g(id); if (v != null) sit[id] = v; else rest.push(id); }
    const used = Object.values(sit).reduce((a, b) => a + b, 0);
    for (const id of rest) sit[id] = (60 - used) / rest.length;
    const act = {};
    for (const sid of SIDS()) {
      const as = actsOf(sid), known = as.filter((a) => g(a) != null), unk = as.filter((a) => g(a) == null);
      for (const a of known) act[a] = g(a);
      const left = sit[sid] - known.reduce((t, a) => t + act[a], 0);
      for (const a of unk) act[a] = left / unk.length;
    }
    return { ev, sit, act, rest };
  }
  // gabarito do Quadro 2 (cycle.js ATIVIDADES.quadro "Grupo — Item")
  function gabarito(aid) {
    const a = CYC().ATIVIDADES[aid]; const [gp, item] = a.quadro.split(' — ');
    for (let gi = 0; gi < N.QUADRO_M.length; gi++) { const G = N.QUADRO_M[gi]; if (!G.grupo.toLowerCase().includes(gp.toLowerCase())) continue;
      const ii = G.itens.findIndex(([l]) => l === item); if (ii >= 0) return { gi, ii, M: G.itens[ii][1], label: `${G.grupo} — ${item}` }; }
    for (let gi = 0; gi < N.QUADRO_M.length; gi++) { const ii = N.QUADRO_M[gi].itens.findIndex(([, w]) => w === a.M); if (ii >= 0) return { gi, ii, M: a.M, label: `${N.QUADRO_M[gi].grupo} — ${N.QUADRO_M[gi].itens[ii][0]}` }; }
    return { gi: -1, ii: -1, M: a.M, label: a.quadro };
  }
  function useGabarito() { for (const a of ACTS_()) { const g = gabarito(a); D.M[a] = { gi: g.gi, ii: g.ii, M: g.M, label: g.label }; } }
  const allM = () => ACTS_().every((a) => D.M[a]?.M);

  function cronoHTML() {
    const c = crono(), C = CYC().CRONO;
    const evRows = c.ev.map((e) => `<tr><td><b>${e.id}</b> ${e.evento}</td>${e.s.map((s) => `<td>${CY.fmtMS(s)}</td>`).join('')}<td><b>${CY.fmtMS(e.mean)}</b></td><td>${e.porHora}×</td><td><b>${f(e.min, 0)} min</b></td></tr>`).join('');
    const peakTxt = `${CY.fmtClock(PEAK_().start)}–${CY.fmtClock(PEAK_().start + 3600)}`;
    const known = SIDS().filter((id) => !c.rest.includes(id));
    const sitRows = SIDS().map((id) => `<tr><td><i class="dot" style="background:${SIT_COLOR[id]}"></i><b>${id}</b> ${CYC().SITUACOES[id].label}</td><td><b>${f(c.sit[id], 0)} min</b></td><td class="muted">${c.rest.includes(id) ? `60 − ${known.map((k) => f(c.sit[k], 0)).join(' − ')}` : 'cronometrado'}</td></tr>`).join('');
    // seletor de M por atividade (Quadro 2 da NR-15 = Quadro 1 da NHO-06)
    const opts = (aid) => `<option value="">— escolha no quadro —</option>` + N.QUADRO_M.map((G, gi) => `<optgroup label="${esc(G.grupo)}">${G.itens.map(([l, w], ii) =>
      `<option value="${gi}.${ii}" ${D.M[aid]?.gi === gi && D.M[aid]?.ii === ii ? 'selected' : ''}>${esc(l)} — ${w} W</option>`).join('')}</optgroup>`).join('');
    const mRows = ACTS_().map((aid) => {
      const a = CYC().ATIVIDADES[aid], g = gabarito(aid), sel = D.M[aid];
      const st = !sel ? '' : sel.M === g.M ? '<span class="ok">✓ igual ao gabarito</span>' : `<span class="warn">≠ gabarito (${g.M} W)</span>`;
      return `<div class="mrow"><div class="mrow-h"><b>${aid}</b> ${a.label}<span class="muted"> · ${a.sit} · ${f(c.act[aid], 0)} min</span></div>
        <div class="mrow-c"><select data-m="${aid}">${opts(aid)}</select><b class="mval">${sel ? sel.M + ' W' : '—'}</b>
        <button class="ui-btn mini ghost" data-hint="${aid}" title="Dica">💡</button></div>
        <div class="mrow-s">${st}${D.hint[aid] ? `<span class="hint">Gabarito: ${esc(g.label)} = <b>${g.M} W</b></span>` : ''}</div></div>`;
    }).join('');
    const vopts = N.VESTIMENTAS.map((v) => `<option value="${v.id}" ${D.vest === v.id ? 'selected' : ''}>${esc(v.label)} (${v.add > 0 ? '+' : ''}${f(v.add, 1)} °C)</option>`).join('');
    return `<div class="pn-h">Cronometragem <small>hora de pico ${peakTxt}</small></div>
      <p class="pn-p">Tempo de cada evento = média aritmética de no mínimo 3 cronometragens (NHO-06 8.2), observando a forneira no trabalho.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Evento</th><th>1ª</th><th>2ª</th><th>3ª</th><th>Média</th><th>Por hora</th><th>Na hora</th></tr></thead><tbody>${evRows}</tbody></table></div>
      <div class="pn-sub">Tempo em cada situação térmica (soma = 60 min)</div>
      <table class="tbl"><tbody>${sitRows}</tbody></table>
      ${peakHTML()}
      <div class="pn-sub">Taxa metabólica de cada atividade <button class="ui-btn mini" data-gab>Usar gabarito</button></div>
      <p class="pn-p small">Quadro 2 da NR-15 Anexo 3 = Quadro 1 da NHO-06. Atividade fora do quadro → atividade similar (NR-15 2.2.1).</p>
      <div class="mlist">${mRows}</div>
      <div class="pn-sub">Vestimenta (NHO-06 Quadro 2) e aclimatização (5.4)</div>
      <div class="vrow"><select data-vest>${vopts}</select></div>
      <div class="vrow"><label class="chkbox"><input type="checkbox" data-capuz ${D.capuz ? 'checked' : ''}> Com capuz (+1 °C)</label>
        <label class="chkbox"><input type="radio" name="acl" data-acl="1" ${D.aclim ? 'checked' : ''}> Aclimatizada</label>
        <label class="chkbox"><input type="radio" name="acl" data-acl="0" ${!D.aclim ? 'checked' : ''}> Não aclimatizada</label></div>
      <p class="pn-p small muted">${(LAUDO_TXT[app.state.env] || LAUDO_TXT.fornos).vestNota || 'A trabalhadora usa o uniforme de calça e camisa de manga longa e avental de tecido comum (não impermeável): sem ajuste. Trabalha no setor todos os dias → aclimatizada.'}</p>`;
  }
  // justificativa da hora de pico: IBUTG médio e M média em cada hora da jornada (mesmos valores medidos)
  function peakHTML() {
    const ms = measure.sits; if (!SIDS().every((k) => ms[k]?.mean)) return '';
    const Mx = (a) => D.M[a]?.M ?? CYC().ATIVIDADES[a].M;
    const rows = CYC().JORNADA.filter((h) => !h.off).map((hr) => {
      const c = CYC().hourComposition(hr);
      const ib = SIDS().reduce((s, k) => s + N.ibutg(ms[k].mean.tbn, ms[k].mean.tg) * c.sit[k], 0) / 60;
      const M = ACTS_().reduce((s, a) => s + Mx(a) * c.act[a], 0) / 60; const LE = N.lookup(N.NHO_T2, M);
      return { hr, ib, M, LE: LE?.v, m: ib - (LE?.v ?? 99), s1: c.sit[SIDS()[0]] };
    });
    const worst = rows.reduce((a, b) => (b.m > a.m ? b : a));
    return `<div class="pn-sub">Por que ${CY.fmtClock(worst.hr.start)}–${CY.fmtClock(worst.hr.start + 3600)}? (60 min corridos mais desfavoráveis)</div>
      <div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Hora</th><th>${SIDS()[0]} (min)</th><th>IBUTG</th><th>M</th><th>LE</th><th>Folga</th></tr></thead><tbody>${rows.map((r) =>
        `<tr class="${r === worst ? 'hi' : ''}"><td>${CY.fmtClock(r.hr.start)}</td><td>${f(r.s1, 0)}</td><td>${f(r.ib, 1)}</td><td>${f(r.M, 0)}</td><td>${f(r.LE, 1)}</td><td>${f(r.LE - r.ib, 1)}</td></tr>`).join('')}</tbody></table></div>
      <p class="pn-p small muted">Mais tempo junto à fonte por hora → IBUTG e M médios mais altos. A hora com a menor folga até o limite é a usada na avaliação (NHO-06 5.3; NR-15 2.4).</p>`;
  }

  // ── resultado ──
  function compute() {
    const ms = measure.sits; if (!SIDS().every((k) => ms[k]?.mean) || !allM()) return null;
    const c = crono();
    const actBySit = Object.fromEntries(SIDS().map((id) => [id, actsOf(id)]));
    const situacoes = SIDS().map((id) => ({ id, label: CYC().SITUACOES[id].label, tbn: ms[id].mean.tbn, tg: ms[id].mean.tg, tbs: ms[id].mean.tbs, t: c.sit[id],
      M: Math.max(...actBySit[id].map((a) => D.M[a].M)), acts: actBySit[id] }));
    const atividades = ACTS_().map((a) => ({ id: a, label: CYC().ATIVIDADES[a].label, M: D.M[a].M, t: c.act[a] }));
    const E = N.evaluate(situacoes, atividades, { vest: D.vest, capuz: D.capuz, aclimatizado: D.aclim });
    return { E, situacoes, atividades, c };
  }
  const CLS_COLOR = { ok: '#30a46c', info: '#3b82f6', warn: '#f59e0b', bad: '#e5484d' };
  function scaleHTML(E) {
    const x = E.arred.ibutg, NA = E.NA?.v, LE = (E.aclimatizado ? E.LE : E.NA)?.v, lo = E.aclimatizado ? E.INC?.lo : null;
    if (NA == null || LE == null) return '';
    const a = Math.min(NA, x) - 2.5, b = Math.max(LE, x) + 2.5, P = (v) => ((v - a) / (b - a)) * 100;
    const zones = E.aclimatizado
      ? [[a, NA, '#30a46c', 'Aceitável'], [NA, lo, '#3b82f6', 'Nível de ação'], [lo, LE, '#f59e0b', 'Incerteza'], [LE, b, '#e5484d', 'LE ultrapassado']]
      : [[a, NA, '#30a46c', 'Aceitável'], [NA, b, '#e5484d', 'Limite ultrapassado']];
    return `<div class="scale"><div class="sc-track">${zones.map(([z0, z1, c, l]) => `<i style="left:${P(z0)}%;width:${P(z1) - P(z0)}%;background:${c}" title="${l}"><span>${l}</span></i>`).join('')}
      <em class="mk" style="left:${P(x)}%"><b>${f(x, 1)} °C</b></em></div>
      <div class="sc-ticks"><span style="left:${P(NA)}%">NA ${f(NA, 1)}</span>${lo != null ? `<span style="left:${P(lo)}%">${f(lo, 1)}</span>` : ''}<span style="left:${P(LE)}%">LE ${f(LE, 1)}</span></div></div>`;
  }
  function resultHTML(active = -1) {
    const R = compute();
    if (!R) return `<div class="pn-h">Resultado</div><p class="pn-p warn">Faltam dados: ${!SIDS().every((k) => measure.sits[k]?.mean) ? 'meça todas as situações térmicas' : 'atribua a taxa metabólica de todas as atividades'}.</p>`;
    const { E, situacoes, atividades } = R;
    const card = (i, body) => `<section class="rcard ${active === i ? 'on' : ''}" data-r="${i}"><h4>${RESULT_STEPS[i].title}</h4>${body}</section>`;
    const s1 = situacoes.map((s) => `<div class="eq"><b style="color:${SIT_COLOR[s.id]}">IBUTG<sub>${s.id}</sub></b> = 0,7 × ${f(s.tbn, 2)} + 0,3 × ${f(s.tg, 2)} = <b>${f(E.sits.find((x) => x.id === s.id).ibutg, 2)} °C</b></div>`).join('')
      + `<p class="eqn">tbn e tg = médias das 5 leituras estabilizadas. Ambiente interno, sem carga solar → equação 5.1 (tbs não entra).</p>`;
    const num = E.sits.map((s) => `${f(s.ibutg, 2)} × ${f(s.t, 0)}`).join(' + ');
    const numM = atividades.map((a) => `${a.M} × ${f(a.t, 0)}`).join(' + ');
    const s2 = `<div class="eq"><span class="ov">IBUTG</span> = ${fr(num, '60')} = <b>${f(E.ibutgMedio, 2)} °C</b></div>
      <div class="eq"><span class="ov">M</span> = ${fr(numM, '60')} = <b>${f(E.M, 1)} W</b></div>
      <p class="eqn">Tempos da cronometragem na hora de pico: ${situacoes.map((s) => `${s.id} ${f(s.t, 0)}`).join(' · ')} min; ${atividades.map((a) => `${a.id} ${f(a.t, 0)}`).join(' · ')} min (somas = 60).</p>`;
    const s3 = `<div class="eq"><span class="ov">IBUTG</span><sub>ajustado</sub> = ${f(E.ibutgMedio, 2)} ${E.ajuste >= 0 ? '+' : '−'} ${f(Math.abs(E.ajuste), 1)} = <b>${f(E.ibutgAjustado, 2)} → ${f(E.arred.ibutg, 1)} °C</b></div>
      <p class="eqn">${esc(E.vest.label)} (${E.vest.add > 0 ? '+' : ''}${f(E.vest.add, 1)} °C)${E.capuz ? ' + capuz (+1 °C)' : ''}. Valor arredondado a 0,1 °C para a comparação.</p>`;
    const s4 = `<div class="eq"><span class="ov">M</span> = ${f(E.M, 1)} W → linha <b>${E.LE?.M ?? '—'} W</b> <small>(M imediatamente mais elevada, NHO-06 item 9)</small></div>
      <table class="tbl small"><tbody>
      <tr><td>Nível de ação — Tabela 1 ${E.aclimatizado ? '' : '<small>(= limite p/ não aclimatizado)</small>'}</td><td><b>${f(E.NA?.v, 1)} °C</b></td></tr>
      <tr><td>Limite de exposição — Tabela 2 (aclimatizado)</td><td><b>${f(E.LE?.v, 1)} °C</b></td></tr>
      <tr><td>Região de incerteza — Tabela 4</td><td><b>${f(E.INC?.lo, 1)} a ${f(E.INC?.hi, 1)} °C</b></td></tr>
      <tr><td>NR-15 Anexo 3 — Quadro 1</td><td><b>${f(E.nr15?.limite, 1)} °C</b></td></tr></tbody></table>`;
    const s5 = `<table class="tbl small"><thead><tr><th>Situação</th><th>IBUTG</th><th>M atividade</th><th>Teto</th><th></th></tr></thead><tbody>${E.teto.map((t) => {
      const s = situacoes.find((x) => x.id === t.id);
      return `<tr><td><b style="color:${SIT_COLOR[t.id]}">${t.id}</b> ${s.acts.join('/')}</td><td>${f(t.ibutg, 1)}</td><td>${t.M} W → ${t.vtM}</td><td>${f(t.vt, 1)}</td><td>${t.excede ? '<span class="bad">excede</span>' : '<span class="ok">ok</span>'}</td></tr>`; }).join('')}</tbody></table>
      ${situacoes.some((x) => x.acts.length > 1) ? `<p class="eqn">Em situação com mais de uma atividade (${situacoes.filter((x) => x.acts.length > 1).map((x) => `${x.id}: ${x.acts.join(' e ')}`).join('; ')}) usa-se a maior M, que dá o teto mais baixo.</p>` : ''}`;
    const s6 = `${scaleHTML(E)}<div class="verdict" style="--c:${CLS_COLOR[E.cls]}"><b>${E.decisao}</b><span>${E.atuacao}</span></div>
      <p class="eqn"><span class="ov">IBUTG</span> ${f(E.arred.ibutg, 1)} °C · <span class="ov">M</span> ${f(E.M, 0)} W · ${E.aclimatizado ? 'trabalhadora aclimatizada (Tabela 2)' : 'trabalhadora não aclimatizada (Tabela 1)'}${E.tetoExcedido ? ' · valor teto excedido' : ''}.</p>
      ${E.cls !== 'ok' && E.aclimatizado ? '<p class="eqn">Acima do nível de ação: trabalhadores novos ou afastados há mais de 7 dias precisam de plano de aclimatização (NHO-06 5.4).</p>' : ''}`;
    const nr = E.nr15;
    const s7 = nr ? `<div class="eq"><span class="ov">IBUTG</span> ${f(E.arred.ibutg, 1)} °C ${nr.insalubre ? '>' : '≤'} ${f(nr.limite, 1)} °C <small>(Quadro 1, M ${nr.Mtab} W)</small></div>
      <div class="verdict" style="--c:${nr.insalubre ? '#e5484d' : '#30a46c'}"><b>${nr.insalubre ? 'Insalubre — grau médio' : 'Não caracteriza insalubridade'}</b><span>${nr.insalubre ? 'NR-15 Anexo 3 itens 2.3 e 2.6 · adicional de ' + nr.adicional : 'NR-15 Anexo 3 item 2.3: o IBUTG médio não ultrapassa o limite do Quadro 1'}</span></div>` : '';
    return `<div class="pn-h">Resultado <small>${app.env?.().short || ''} · passo a passo</small></div>${[s1, s2, s3, s4, s5, s6, s7].map((b, i) => card(i, b)).join('')}`;
  }

  // ── laudo (NR-15 Anexo 3 item 3.1 a–g + NHO-06 item 11) ──
  function laudoHTML() {
    const R = compute(); if (!R) return '<p>Complete a medição e a cronometragem para gerar o laudo.</p>';
    const { E, situacoes, atividades, c } = R, ms = measure.sits;
    const bd = app.fw?.state?.baseDate; // mesma data do relógio do medidor (registros das sessões)
    const hoje = bd ? `${String(bd.d).padStart(2, '0')}/${String(bd.m).padStart(2, '0')}/${bd.y}` : new Date().toLocaleDateString('pt-BR');
    const T = LAUDO_TXT[app.state.env] || LAUDO_TXT.fornos;
    const fwInfo = app.fw?.info || app.fw?.state?.info || {};
    const serie = fwInfo.serial || fwInfo.serie || '—', cert = fwInfo.cert || fwInfo.certificado || '—', val = fwInfo.validade || fwInfo.valid || '—', fwv = fwInfo.firmware || fwInfo.version || '—';
    const sheet = (id) => { const s = ms[id]; if (s.estimated) return `<p class="muted">Valores de exemplo (não medidos): tg ${f(s.mean.tg, 2)}, tbn ${f(s.mean.tbn, 2)}, tbs ${f(s.mean.tbs, 2)} °C.</p>`;
      const W = s.stab ? [s.stab.start, s.stab.end] : [-1, -1];
      return `<table class="lt sheet-print"><thead><tr><th>#</th><th>Hora</th><th>tg</th><th>tbn</th><th>tbs</th><th>IBUTG</th></tr></thead><tbody>${s.rows.map((r, i) =>
        `<tr class="${i >= W[0] && i <= W[1] ? 'win' : ''}"><td>${i + 1}</td><td>${app.fmtClock(r.clock)}</td><td>${f(r.tg)}</td><td>${f(r.tbn)}</td><td>${f(r.tbs)}</td><td>${f(N.ibutg(r.tbn, r.tg))}</td></tr>`).join('')}
        <tr class="mean"><td colspan="2">Média (leituras ${s.stab ? `${s.stab.start + 1}–${s.stab.end + 1}` : '—'})</td><td>${f(s.mean.tg, 2)}</td><td>${f(s.mean.tbn, 2)}</td><td>${f(s.mean.tbs, 2)}</td><td>${f(N.ibutg(s.mean.tbn, s.mean.tg), 2)}</td></tr></tbody></table>`; };
    const sitTable = situacoes.map((s) => { const m = ms[s.id], st = app.STATIONS[CYC().SITUACOES[s.id].station];
      return `<tr><td><b>${s.id}</b> ${esc(CYC().SITUACOES[s.id].label)}<br><small>${esc(CYC().SITUACOES[s.id].desc)}</small></td><td>${f(m.h ?? st.chest, 2)} m</td><td>${m.t0 != null ? `${hoje} ${app.fmtClock(m.t0)}–${app.fmtClock(m.t1 ?? m.t0)}` : '—'}${m.door ? '<br><small>porta mantida aberta (simulação, NHO-06 8.2)</small>' : ''}</td><td>${f(s.tg, 2)}</td><td>${f(s.tbn, 2)}</td><td>${f(s.tbs, 2)}</td><td><b>${f(E.sits.find((x) => x.id === s.id).ibutg, 2)}</b></td><td>${f(s.t, 0)}</td></tr>`; }).join('');
    const actTable = atividades.map((a) => `<tr><td><b>${a.id}</b> ${esc(a.label)}</td><td>${esc(D.M[a.id].label)}</td><td>${a.M}</td><td>${f(a.t, 0)}</td></tr>`).join('');
    const cronoTable = c.ev.map((e) => `<tr><td>${e.id} — ${esc(e.evento)}</td><td>${e.s.map((s) => CY.fmtMS(s)).join(' · ')}</td><td>${CY.fmtMS(e.mean)}</td><td>${e.porHora}</td><td>${f(e.min, 0)} min</td></tr>`).join('');
    const rec = { ok: 'Manter a condição existente e o monitoramento periódico.', info: 'Adotar, no mínimo, medidas preventivas (NHO-06 10.1).', warn: 'Adotar medidas preventivas e corretivas visando à redução da exposição (NHO-06 10.1 e 10.2).', bad: 'Adotar imediatamente medidas corretivas (NHO-06 10.2).' }[E.cls];
    return `<article class="laudo">
      <header><div class="lh-k">Laudo técnico · NR-15 Anexo 3 · NHO-06</div><h1>Avaliação da exposição ocupacional ao calor</h1>
      <p>${T.cab} · Data: ${hoje}</p></header>
      <h2>a) Introdução, objetivos e justificativa</h2>
      <p>${T.obj}</p>
      <h2>b) Avaliação dos riscos</h2>
      <p>${T.fontes} Ciclo de exposição com ${SIDS().length} situações térmicas (${SIDS().map((id) => `${id} ${CYC().SITUACOES[id].label.toLowerCase()}`).join('; ')}) e ${ACTS_().length} atividades físicas. ${T.grupo}</p>
      <h2>c) Metodologia e critério de avaliação</h2>
      <p>NHO-06 (Fundacentro): IBUTG para ambiente interno sem carga solar, IBUTG = 0,7 tbn + 0,3 tg (eq. 5.1); leituras a cada minuto até a estabilização (≥ 5 leituras consecutivas dentro de 0,4 °C), valores = médias do intervalo estabilizado (8.2); ${SIDS().some((id) => ms[id]?.door) ? 'situação de curta duração (porta aberta) avaliada por simulação (8.2);' : 'fontes de calor contínuas durante a operação, sem necessidade de simulação (8.2);'} tempos pela média de 3 cronometragens; M pelo Quadro 1; <span class="ov">IBUTG</span> e <span class="ov">M</span> ponderados nos 60 minutos corridos mais desfavoráveis (eq. 5.3 e 5.4); ajuste da vestimenta (Quadro 2); comparação com as Tabelas 1 a 4 e decisão pelo Quadro 3. NR-15 Anexo 3: comparação do <span class="ov">IBUTG</span> com o Quadro 1 para a <span class="ov">M</span> (item 2.3). Montagem: sensores em plano horizontal, na altura do tórax, normal ao plano vertical dos sensores voltada para a fonte principal e visor na face oposta (7.2).</p>
      <table class="lt"><thead><tr><th>Situação / local</th><th>Altura</th><th>Data e horário</th><th>tg</th><th>tbn</th><th>tbs</th><th>IBUTG</th><th>t (min)</th></tr></thead><tbody>${sitTable}</tbody></table>
      <h2>d) Instrumental</h2>
      <p>Medidor de IBUTG eletrônico (modelo iTemp) com globo de cobre negro fosco Ø 152,4 mm, bulbo úmido natural com pavio de algodão e água destilada, bulbo seco com abrigo contra radiação; nº de série ${esc(serie)}; firmware ${esc(fwv)}; certificado de calibração ${esc(cert)} (validade ${esc(val)}), emitido por laboratório acreditado pelo Inmetro. Tripé telescópico preto fosco. Cronômetro. Pavio trocado e reservatório cheio com água destilada no início da medição; integridade, bateria e certificado conferidos (8.1).</p>
      <h2>e) Avaliação dos resultados</h2>
      <h3>Planilhas de campo (leitura a cada minuto; intervalo estabilizado destacado)</h3>
      ${SIDS().map((id) => `<h4>${id} — ${esc(CYC().SITUACOES[id].label)}</h4>${sheet(id)}`).join('')}
      <h3>Cronometragens (hora de pico ${CY.fmtClock(PEAK_().start)}–${CY.fmtClock(PEAK_().start + 3600)})</h3>
      <table class="lt"><thead><tr><th>Evento</th><th>Cronometragens</th><th>Média</th><th>Por hora</th><th>Tempo</th></tr></thead><tbody>${cronoTable}</tbody></table>
      <h3>Atividades físicas e taxa metabólica (Quadro 2 da NR-15 / Quadro 1 da NHO-06)</h3>
      <table class="lt"><thead><tr><th>Atividade</th><th>Enquadramento</th><th>M (W)</th><th>t (min)</th></tr></thead><tbody>${actTable}</tbody></table>
      <h3>Cálculos</h3>
      <p><span class="ov">IBUTG</span> = (${E.sits.map((s) => `${f(s.ibutg, 2)} × ${f(s.t, 0)}`).join(' + ')}) / 60 = <b>${f(E.ibutgMedio, 2)} °C</b>; vestimenta: ${esc(E.vest.label)}${E.capuz ? ' com capuz' : ''} (${E.ajuste >= 0 ? '+' : ''}${f(E.ajuste, 1)} °C) → <b>${f(E.arred.ibutg, 1)} °C</b>.<br>
      <span class="ov">M</span> = (${atividades.map((a) => `${a.M} × ${f(a.t, 0)}`).join(' + ')}) / 60 = <b>${f(E.M, 1)} W</b> → linha de ${E.LE?.M} W (M imediatamente mais elevada).<br>
      Nível de ação (Tabela 1): ${f(E.NA?.v, 1)} °C · Limite de exposição (Tabela 2): ${f(E.LE?.v, 1)} °C · Região de incerteza (Tabela 4): ${f(E.INC?.lo, 1)} a ${f(E.INC?.hi, 1)} °C · Valor teto (Tabela 3): ${E.teto.map((t) => `${t.id} ${f(t.vt, 1)} °C ${t.excede ? '(excedido)' : '(atendido)'}`).join(', ')}.</p>
      <h2>f) Medidas de controle existentes</h2>
      <p>${T.controles}</p>
      <h2>g) Conclusão</h2>
      <p class="concl"><b>NHO-06 (Quadro 3):</b> ${E.decisao} — ${E.atuacao}.<br><b>NR-15, Anexo 3:</b> ${E.nr15?.insalubre ? `atividade <b>caracterizada como insalubre, em grau médio</b> (<span class="ov">IBUTG</span> ${f(E.arred.ibutg, 1)} °C > ${f(E.nr15.limite, 1)} °C do Quadro 1 para <span class="ov">M</span> ${f(E.M, 0)} W)` : `atividade <b>não caracterizada como insalubre</b> por calor (<span class="ov">IBUTG</span> ${f(E.arred.ibutg, 1)} °C ≤ ${f(E.nr15?.limite, 1)} °C do Quadro 1 para <span class="ov">M</span> ${f(E.M, 0)} W)`}.</p>
      <h3>Recomendações (NHO-06 item 10)</h3>
      <p>${rec} Preventivas: monitoramento periódico, água e sais minerais conforme orientação médica, treinamento sobre sinais de sobrecarga térmica, controle médico e liberdade para interromper o trabalho em desconforto extremo. Corretivas: ${T.corretivas}</p>
      <h2>Responsável pela avaliação</h2>
      <p class="sign"><span contenteditable="true" data-aval>${esc(D.avaliador || 'Nome do avaliador · registro profissional')}</span><br><small>Assinatura</small></p>
    </article>`;
  }

  function bind(el) {
    el.querySelectorAll('select[data-m]').forEach((s) => (s.onchange = () => {
      const aid = s.dataset.m; if (!s.value) { delete D.M[aid]; ui.refreshPanel(); return; }
      const [gi, ii] = s.value.split('.').map(Number); const G = N.QUADRO_M[gi];
      D.M[aid] = { gi, ii, M: G.itens[ii][1], label: `${G.grupo} — ${G.itens[ii][0]}` }; ui.refreshPanel(); ui.render();
    }));
    el.querySelectorAll('[data-hint]').forEach((b) => (b.onclick = () => { D.hint[b.dataset.hint] = !D.hint[b.dataset.hint]; ui.refreshPanel(); }));
    const g = el.querySelector('[data-gab]'); if (g) g.onclick = () => { useGabarito(); ui.refreshPanel(); ui.render(); };
    const v = el.querySelector('[data-vest]'); if (v) v.onchange = () => { D.vest = v.value; ui.refreshPanel(); };
    const c = el.querySelector('[data-capuz]'); if (c) c.onchange = () => { D.capuz = c.checked; };
    el.querySelectorAll('[data-acl]').forEach((r) => (r.onchange = () => { D.aclim = r.dataset.acl === '1'; }));
    const a = el.querySelector('[data-aval]'); if (a) a.oninput = () => { D.avaliador = a.textContent; };
  }
  return { D, crono, cronoHTML, resultHTML, laudoHTML, compute, bind, useGabarito, allM, RESULT_STEPS };
}
