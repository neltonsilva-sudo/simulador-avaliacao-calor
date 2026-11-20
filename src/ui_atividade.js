// Atividade prática avaliada de calor (📝 Atividade) — dono: UI/DEMO. Padrão aprovado na dosimetria (atividade.js):
// modo "Avaliação" (sem dicas, mensagens neutras, narração só do enunciado) e modo "Com orientação passo a passo"
// (caixa .ativ-guia + narração de cada etapa). Cenário sorteado (ambiente, postos, setpoint, vestimenta, aclimatização,
// armadilhas de preparação); o aluno prepara, posiciona, mede (escolhe a janela estabilizada), cronometra, atribui M,
// calcula e conclui. Boletim 0–10 com gabarito de N.evaluate sobre as PRÓPRIAS leituras do aluno.
import { fwDo, camPart, isOn, isRec } from './demo.js';

export const ATIV_TXT = {
  prova: { text: 'Atividade avaliativa de calor. Realize as etapas de 1 a 6. Ao terminar, clique em Entregar.' },
  guia: { text: 'Atividade prática de avaliação de calor, com orientação passo a passo. Leia o enunciado: ele traz os postos, a vestimenta e a aclimatização da trabalhadora. Cumpra as seis etapas: preparar o medidor, posicionar, medir até estabilizar, cronometrar e atribuir a taxa metabólica, calcular e concluir. Ao terminar, clique em Entregar para ver a sua nota.' },
  passos: [
    { text: 'Etapa 1, preparar. Inspecione o medidor antes de sair a campo. Troque o pavio se estiver sujo, encha o reservatório com água destilada e confira a bateria e o certificado de calibração. Ligue o aparelho segurando a tecla liga e desliga, e no menu, em Gravação, ajuste o intervalo de registro para 1 minuto.' },
    { text: 'Etapa 2, posicionar. Para cada posto, leve o tripé até o ponto da trabalhadora, com os sensores na altura do tórax, a normal ao plano dos sensores voltada para a fonte de calor e o visor na face oposta. Informe a trabalhadora antes de medir.' },
    { text: 'Etapa 3, medir. Inicie a gravação no aparelho e as leituras de cada minuto. Na frente do forno, a porta só fica aberta alguns minutos por carga: use a simulação, mantendo a porta aberta até estabilizar. Encerre e clique na primeira de cinco leituras seguidas que variam no máximo 0,4 grau nos três sensores.' },
    { text: 'Etapa 4, cronometrar. Com as três cronometragens de cada evento, calcule a média e o tempo de cada situação e de cada atividade na hora de pico, que somam 60 minutos. Escolha a taxa metabólica de cada atividade no Quadro 2 da NR-15 e a vestimenta no Quadro 2 da NHO-06.' },
    { text: 'Etapa 5, calcular. Calcule o IBUTG de cada situação com 0,7 vezes o bulbo úmido natural mais 0,3 vezes o globo. Depois, a média ponderada no tempo, o IBUTG médio, e a taxa metabólica média, nos 60 minutos. Some o ajuste da vestimenta, se houver.' },
    { text: 'Etapa 6, concluir. Busque os limites na linha da taxa metabólica imediatamente mais elevada, decida pelo Quadro 3 da NHO-06 e diga se há insalubridade pela NR-15, e em que grau. Depois clique em Entregar.' },
  ],
  medirCont: { text: 'Etapa 3, medir. Inicie a gravação no aparelho e as leituras de cada minuto. Aqui as fontes de calor são contínuas, então não há simulação. Encerre e clique na primeira de cinco leituras seguidas que variam no máximo 0,4 grau nos três sensores.' },
};
const TABS = ['Preparar', 'Posicionar', 'Medir', 'Cronometrar', 'Calcular', 'Concluir'];
const NEUTRO = 'Ação não permitida neste momento.';
const DECISOES = ['Aceitável', 'Nível de ação ultrapassado', 'Região de incerteza', 'Limite de exposição ultrapassado'];
const NR15 = ['Não caracteriza insalubridade', 'Insalubre — grau mínimo', 'Insalubre — grau médio', 'Insalubre — grau máximo'];
const f = (v, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));
const num = (s) => { const v = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(v) ? v : null; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export function createActivity({ app, ui, ev, root, h }) {
  const S = app.state, N = app.N;
  const CYC = () => app.cycle?.() || app.CY;
  const SIDS = () => Object.keys(CYC().SITUACOES);
  const ACTS = () => Object.keys(CYC().ATIVIDADES);
  const stKey = (id) => CYC().SITUACOES[id]?.station, stOf = (id) => app.STATIONS[stKey(id)];
  const hasDoor = (id) => { const s = stOf(id)?.source; return !!s && s in (app.field?.doors || {}) && S.env === 'fornos'; };
  const panel = h('div', 'ativ-panel glass hidden', ''); root.appendChild(panel);
  const modal = h('div', 'ui-modal ativ-modal hidden', ''); root.appendChild(modal);
  let A = null, tab = 0, aluno = '', guiado = false;
  try { aluno = localStorage.getItem('calor.aluno') || ''; guiado = localStorage.getItem('calor.modo') === 'guiado'; } catch {}
  const passo = (i) => (i === 2 && S.env !== 'fornos' ? ATIV_TXT.medirCont : ATIV_TXT.passos[i]).text;
  const neutral = (msg) => ui.toast(A?.guiado ? msg : NEUTRO);

  // ── abertura: ambiente + modo ──
  function open() {
    const envs = Object.entries(app.ENVS || { fornos: { short: 'Sala de fornos', label: 'Sala de fornos' } });
    modal.innerHTML = `<div class="ui-dialog glass ativ-choose"><button class="ui-x">✕</button><div class="dlg-k">📝 Atividade</div><h2>Monitoramento do calor</h2>
      <p class="sub">Você fará sozinho a avaliação completa pela NHO-06 e pela NR-15 Anexo 3, num cenário sorteado. Ao entregar, recebe o boletim de 0 a 10.</p>
      <label class="ativ-name">Nome do aluno <input type="text" maxlength="60" value="${esc(aluno)}" placeholder="Digite seu nome"></label>
      <div class="ativ-opt"><span>Ambiente</span>${envs.map(([id, E]) => `<label><input type="radio" name="env" value="${id}" ${S.env === id ? 'checked' : ''}> <b>${E.short}</b></label>`).join('')}</div>
      <div class="ativ-opt"><span>Modo</span><label><input type="radio" name="modo" value="prova" ${guiado ? '' : 'checked'}> <b>Avaliação</b> — sem orientação</label>
        <label><input type="radio" name="modo" value="guiado" ${guiado ? 'checked' : ''}> <b>Guiada</b> — orientação e narração em cada etapa</label></div>
      <div class="ui-row"><button class="ui-btn primary big" data-go>Começar</button></div></div>`;
    modal.classList.remove('hidden');
    modal.querySelector('.ui-x').onclick = () => modal.classList.add('hidden');
    modal.querySelector('[data-go]').onclick = () => {
      aluno = modal.querySelector('.ativ-name input').value.trim();
      if (!aluno) { ui.toast('Digite o nome do aluno para começar.'); modal.querySelector('.ativ-name input').focus(); return; }
      guiado = modal.querySelector('input[name="modo"]:checked')?.value === 'guiado';
      try { localStorage.setItem('calor.aluno', aluno); localStorage.setItem('calor.modo', guiado ? 'guiado' : 'prova'); } catch {}
      start({ env: modal.querySelector('input[name="env"]:checked')?.value || S.env, guiado, aluno });
    };
  }

  // ── cenário sorteado ──
  async function start({ env = S.env, guiado: g = false, aluno: al = aluno, seed } = {}) {
    modal.classList.add('hidden'); ui.voice?.stop?.();
    if (app.setEnv && env !== S.env) await app.setEnv(env);
    app.setPostos?.(Object.keys((app.CY.CYCLES?.[S.env] || app.CY).SITUACOES)); // ciclo completo antes de sortear
    const all = SIDS(); let postos = all;
    if (all.length > 2 && Math.random() < 0.45) postos = [all[0], pick(all.slice(1))].sort();
    app.setPostos?.(postos);
    const sp = S.env === 'fornos' ? 170 + 10 * Math.floor(Math.random() * 7) : null;
    if (sp != null) { app.setOvenSetpoint?.('forno1', sp); if (app.field?.pv) app.field.pv.forno1 = sp; }
    const vest = pick([['uniforme', false], ['uniforme', false], ['macacao', false], ['curta', false], ['avental', false], ['sms', true]]);
    const aclim = Math.random() < 0.75;
    const traps = shuffle(['agua', 'pavio', 'intervalo', 'altura']).slice(0, 1 + Math.floor(Math.random() * 3));
    // estado inicial do aparelho: na maleta, montado no tripé, desligado
    if (S.onTripod === false) await app.mountOnTripod?.(0.01);
    await app.placeMeter?.('kit', { duration: 0 });
    app.setWick('limpo'); app.setWater(1); app.setMeterHeight(1.3);
    const st = app.fw?.state; if (st?.settings) { st.settings.interval = 60; }
    if (traps.includes('agua')) app.setWater(0);
    if (traps.includes('pavio')) app.setWick('sujo');
    if (traps.includes('intervalo') && st?.settings) { st.settings.interval = pick([10, 300]); st.rev = (st.rev || 0) + 1; }
    if (traps.includes('altura')) app.setMeterHeight(1.75);
    if (isRec(app)) await fwDo.stopRec(app);
    if (isOn(app)) app.fw?.press?.('power', 2100); // começa desligado (o aluno liga)
    S.followCycle = true; if (S.doorHold) app.holdDoor(false); app.run(false);
    S.clock = CYC().PEAK - 30 * 60;
    A = { on: true, guiado: g, aluno: al, env: S.env, postos, sp, vest: vest[0], capuz: vest[1], aclim, traps,
      prep: { inspec: false, pavio: false, agua: false, torneira: false, bateria: false }, place: {}, sheets: {}, cur: null,
      inp: { tsit: {}, tact: {}, M: {}, vest: '', capuz: false, aclim: '', ib: '', Mm: '', dec: '', nr: '' }, t0: Date.now() };
    tab = 0; root.classList.add('ativ-on'); root.classList.toggle('ativ-prova', !g); app.setPhase('atividade'); app.setView(app.env?.()?.views?.at(-1)?.[0] || 'mesa', { animate: true, duration: 1.6 });
    draw(); const intro = g ? ATIV_TXT.guia.text : ATIV_TXT.prova.text; ui.caption('📝 Atividade', intro); ui.say(intro);
  }
  function exit() {
    if (!A) return; A.on = false; app.run(false); if (S.doorHold) app.holdDoor(false); S.followCycle = true;
    app.setPostos?.(Object.keys((app.CY.CYCLES?.[S.env] || app.CY).SITUACOES));
    root.classList.remove('ativ-on', 'ativ-prova'); panel.classList.add('hidden'); modal.classList.add('hidden'); A = null; app.setPhase('explorar');
  }

  // ── leituras a cada minuto (só no posto onde o tripé está, enquanto o aluno mede) ──
  app.on('minute', (e) => {
    if (!A?.on || !A.cur || !S.running) return; const sh = A.sheets[A.cur];
    if (!sh || sh.closed || e.station !== stKey(A.cur)) return;
    const r = e.read || app.readings(); sh.rows.push({ clock: e.clock, tg: r.tg, tbn: r.tbn, tbs: r.tbs, door: !!S.doorHold });
    if (tab === 2) draw();
  });

  // ── ações ──
  const act = {
    inspec() { A.prep.inspec = true; camPart(app, 'wet', 1.4); draw(); },
    pavio() { if (S.station !== 'kit') return neutral('Prepare o medidor na mesa, antes de levá-lo ao posto.'); app.setWick('limpo'); app.meter?.animate?.('wick'); A.prep.pavio = true; draw(); },
    agua(dest) { if (S.station !== 'kit') return neutral('Prepare o medidor na mesa, antes de levá-lo ao posto.'); app.setWater(1); app.meter?.animate?.('fill'); A.prep[dest ? 'agua' : 'torneira'] = true; draw(); },
    bateria() { A.prep.bateria = true; draw(); },
    async place(id) {
      const p = A.place[id] ||= {}; const st = stOf(id);
      const hIn = num(panel.querySelector(`[data-h="${id}"]`)?.value), ori = panel.querySelector(`[name="ori-${id}"]:checked`)?.value;
      const inf = panel.querySelector(`[data-inf="${id}"]`)?.checked;
      if (hIn == null || hIn < 0.3 || hIn > 2.2 || !ori) return neutral('Informe a altura (m) e a orientação dos sensores.');
      if (A.cur && A.sheets[A.cur] && !A.sheets[A.cur].closed) return neutral('Encerre a medição em andamento antes de mudar o tripé.');
      Object.assign(p, { h: hIn, ori, inf: !!inf, chest: st.chest, src: !!st.source });
      const face = st.face + (ori === 'fonte' ? 0 : ori === 'visor' ? Math.PI : Math.PI / 2);
      app.setView(stKey(id), { animate: true, duration: 2 }); await app.placeMeter(stKey(id), { height: hIn, face, duration: 1.8 });
      if (inf) app.worker?.setActivity?.('olhando');
      A.cur = id; draw();
    },
    begin(id) {
      if (S.station !== stKey(id)) return neutral('Leve o medidor a este posto antes de medir.');
      if (!isOn(app)) return neutral('O medidor está desligado.');
      const sh = A.sheets[id] = { rows: [], closed: false, sel: null, rec: isRec(app), interval: app.fw?.state?.settings?.interval ?? null, wet: app.wet(), door: false };
      A.cur = id; app.setSpeed(Math.max(S.speed, 60)); app.run(true); draw();
    },
    stop(id) { const sh = A.sheets[id]; if (!sh || sh.closed) return neutral(NEUTRO); sh.closed = true; app.run(false); sh.rec = sh.rec || isRec(app);
      sh.doorFrac = sh.rows.length ? sh.rows.filter((r) => r.door).length / sh.rows.length : 0; if (S.doorHold) app.holdDoor(false); S.followCycle = true; draw(); },
    door(b) { if (!A.cur || !hasDoor(A.cur) || S.station !== stKey(A.cur)) return neutral('Não há porta de forno a manter aberta neste posto.'); S.followCycle = !b; app.holdDoor(b); draw(); },
    sel(id, i) { const sh = A.sheets[id]; if (!sh?.closed) return neutral('Encerre a medição antes de escolher as leituras.'); if (i + 5 > sh.rows.length) return neutral('Escolha a primeira de cinco leituras seguidas.'); sh.sel = i; draw(); },
  };

  // ── avaliação (gabarito sobre as leituras do aluno) ──
  const meanOf = (sh) => { if (!sh || sh.sel == null) return null; const w = sh.rows.slice(sh.sel, sh.sel + 5); const m = (k) => w.reduce((a, r) => a + r[k], 0) / w.length;
    const span = (k) => Math.max(...w.map((r) => r[k])) - Math.min(...w.map((r) => r[k])); return { tg: m('tg'), tbn: m('tbn'), tbs: m('tbs'), ok: ['tg', 'tbn', 'tbs'].every((k) => span(k) <= 0.4 + 1e-9) }; };
  function reference({ own = false } = {}) {
    const c = ev.crono(); const sits = SIDS().map((id) => { const m = meanOf(A.sheets[id]); return m ? { id, label: CYC().SITUACOES[id].label, tbn: m.tbn, tg: m.tg, tbs: m.tbs,
      t: own ? num(A.inp.tsit[id]) : c.sit[id], M: Math.max(...ACTS().filter((a) => CYC().ATIVIDADES[a].sit === id).map((a) => (own ? A.inp.M[a] : CYC().ATIVIDADES[a].M) || 0)) } : null; });
    if (sits.some((s) => !s || s.t == null)) return null;
    const atv = ACTS().map((a) => ({ id: a, label: CYC().ATIVIDADES[a].label, M: own ? A.inp.M[a] : CYC().ATIVIDADES[a].M, t: own ? num(A.inp.tact[a]) : c.act[a] }));
    if (atv.some((a) => !a.M || a.t == null)) return null;
    return N.evaluate(sits, atv, own ? { vest: A.inp.vest || 'uniforme', capuz: A.inp.capuz, aclimatizado: A.inp.aclim !== 'nao' } : { vest: A.vest, capuz: A.capuz, aclimatizado: A.aclim });
  }
  function grade() {
    const c = ev.crono(), P = A.postos, items = [];
    const sh = P.map((id) => A.sheets[id]);
    // 1 Preparação (2,0)
    const pv = (A.traps.includes('pavio') ? A.prep.pavio : true) && S.wick === 'limpo';
    const ag = !A.prep.torneira && (A.traps.includes('agua') ? A.prep.agua : true) && sh.every((s) => !s || s.wet);
    const it = sh.length && sh.every((s) => s && s.interval === 60);
    const bt = A.prep.bateria;
    items.push(['1. Preparação', 2, 0.5 * (pv + ag + it + bt), [`pavio limpo ${pv ? '✓' : '✗'}`, `água destilada no reservatório ${ag ? '✓' : '✗'}`, `intervalo de 1 min ${it ? '✓' : '✗'}`, `bateria e certificado conferidos ${bt ? '✓' : '✗'}`]]);
    // 2 Posicionamento (1,5)
    const pp = P.map((id) => { const p = A.place[id]; if (!p) return [0, `${id}: não posicionado`]; const hOk = Math.abs(p.h - p.chest) <= 0.05, oOk = !p.src || p.ori === 'fonte';
      return [(hOk + oOk + p.inf) / 3, `${id}: altura ${f(p.h, 2)} m ${hOk ? '✓' : `✗ (tórax ${f(p.chest, 2)})`} · orientação ${oOk ? '✓' : '✗'} · trabalhadora informada ${p.inf ? '✓' : '✗'}`]; });
    items.push(['2. Posicionamento', 1.5, 1.5 * pp.reduce((a, x) => a + x[0], 0) / P.length, pp.map((x) => x[1])]);
    // 3 Estabilização (2,0)
    const es = P.map((id) => { const s = A.sheets[id], m = meanOf(s); if (!s) return [0, `${id}: não medido`];
      const rec = s.rec ? 1 : 0, win = m?.ok ? 1 : 0, door = hasDoor(id) ? (s.doorFrac >= 0.8 ? 1 : 0) : 1;
      return [(rec + 2 * win + door) / 4, `${id}: gravação ${rec ? '✓' : '✗'} · janela de 5 leituras ≤ 0,4 °C ${win ? '✓' : m ? '✗' : '✗ (não escolhida)'}${hasDoor(id) ? ` · simulação da porta aberta ${door ? '✓' : '✗'}` : ''}`]; });
    items.push(['3. Medição e estabilização', 2, 2 * es.reduce((a, x) => a + x[0], 0) / P.length, es.map((x) => x[1])]);
    // 4 Cronometragem, M e vestimenta (1,5)
    const tOk = [...SIDS().map((id) => Math.abs((num(A.inp.tsit[id]) ?? -99) - c.sit[id]) <= 0.15), ...ACTS().map((a) => Math.abs((num(A.inp.tact[a]) ?? -99) - c.act[a]) <= 0.15)];
    const mOk = ACTS().map((a) => A.inp.M[a] === CYC().ATIVIDADES[a].M);
    const vOk = A.inp.vest === A.vest && !!A.inp.capuz === A.capuz && (A.inp.aclim === 'nao') === !A.aclim;
    const s4 = 0.5 * tOk.filter(Boolean).length / tOk.length + 0.75 * mOk.filter(Boolean).length / mOk.length + 0.25 * vOk;
    items.push(['4. Cronometragem, M e vestimenta', 1.5, s4, [`tempos ${tOk.filter(Boolean).length}/${tOk.length} ✓ (gabarito: ${SIDS().map((id) => `${id} ${f(c.sit[id], 0)}`).join(', ')}; ${ACTS().map((a) => `${a} ${f(c.act[a], 0)}`).join(', ')} min)`,
      `M ${mOk.filter(Boolean).length}/${mOk.length} ✓ (gabarito: ${ACTS().map((a) => `${a} ${CYC().ATIVIDADES[a].M} W`).join(', ')})`, `vestimenta/capuz/aclimatização ${vOk ? '✓' : '✗'}`]]);
    // 5 Cálculo (1,5) — coerência com os próprios dados do aluno
    const own = reference({ own: true }), ref = reference();
    const ib = num(A.inp.ib), Mm = num(A.inp.Mm);
    const ibOk = own && ib != null && Math.abs(ib - own.ibutgAjustado) <= 0.2 + 1e-9, mOk2 = own && Mm != null && Math.abs(Mm - own.M) <= 5 + 1e-9;
    items.push(['5. Cálculo', 1.5, 0.75 * ibOk + 0.75 * mOk2, [own ? `IBUTG médio (ajustado) ${f(ib, 1)} → esperado ${f(own.ibutgAjustado, 2)} ± 0,2 °C ${ibOk ? '✓' : '✗'}` : 'faltam dados próprios (leituras, tempos ou M) para conferir',
      own ? `M média ${f(Mm, 0)} → esperado ${f(own.M, 1)} ± 5 W ${mOk2 ? '✓' : '✗'}` : '']]);
    // 6 Conclusões (1,5)
    const base = own || ref; const nrTrue = base?.nr15?.insalubre ? 2 : 0;
    const dOk = base && A.inp.dec !== '' && DECISOES[+A.inp.dec] === base.decisao.replace(/ \(não aclimatizado\)$/, '').replace('Limite de exposição ultrapassado', 'Limite de exposição ultrapassado');
    const decN = base ? (/ultrapassado/.test(base.decisao) && /Limite/.test(base.decisao) ? 3 : /incerteza/.test(base.decisao) ? 2 : /ação/.test(base.decisao) ? 1 : 0) : -1;
    const d2 = base && A.inp.dec !== '' && +A.inp.dec === decN, n2 = base && A.inp.nr !== '' && +A.inp.nr === nrTrue;
    items.push(['6. Conclusões', 1.5, 0.75 * d2 + 0.75 * n2, [base ? `NHO-06: ${A.inp.dec !== '' ? DECISOES[+A.inp.dec] : '—'} → esperado ${DECISOES[decN]} ${d2 ? '✓' : '✗'}` : 'sem dados', base ? `NR-15: ${A.inp.nr !== '' ? NR15[+A.inp.nr] : '—'} → esperado ${NR15[nrTrue]} ${n2 ? '✓' : '✗'}` : '']]);
    void dOk;
    const total = Math.round(items.reduce((a, x) => a + x[2], 0) * 10) / 10;
    return { items, total, ref, own };
  }

  // ── painel ──
  function caseHTML() {
    const E = app.env?.(); const V = N.VESTIMENTAS.find((v) => v.id === A.vest);
    return `<div class="ativ-case"><b>${E?.label || ''}</b> · ${esc(CYC().WORKER || E?.worker || 'trabalhadora')}. Postos do ciclo: ${A.postos.map((id) => `<b>${id}</b> ${esc(CYC().SITUACOES[id].label)}`).join('; ')}.
      ${A.sp != null ? ` Forno turbo 1 programado em <b>${A.sp} °C</b>.` : ' Caldeiras operando a plena carga.'} Vestimenta: <b>${esc(V?.label)}</b>${A.capuz ? ' <b>com capuz</b>' : ''}.
      ${A.aclim ? 'Trabalhadora há anos no setor.' : 'Trabalhadora <b>admitida há 3 dias</b>, vinda de setor sem exposição ao calor.'} Hora de pico: ${app.fmtClock(CYC().PEAK)}–${app.fmtClock(CYC().PEAK + 3600)}.</div>`;
  }
  function tabHTML() {
    const G = A.guiado;
    if (tab === 0) {
      const insp = A.prep.inspec ? `<ul class="ativ-obs"><li>Pavio: ${S.wick === 'limpo' ? 'branco, limpo' : 'amarelado, com resíduos'}</li><li>Reservatório: ${S.water > 0.5 ? 'com água' : 'vazio'}</li>
        <li>Visor: ${isOn(app) ? 'ligado' : 'desligado'}</li></ul>` : '';
      const bat = A.prep.bateria ? `<p class="pn-p small">Bateria ${Math.round(app.fw?.state?.battery ?? 94)} % · certificado ${esc(app.fw?.device?.cert || '—')}, válido até ${esc(app.fw?.device?.calValid || '—')}.</p>` : '';
      return `<div class="ativ-act"><button class="ui-btn" data-a="inspec">🔍 Inspecionar o medidor</button><button class="ui-btn" data-a="pavio">Trocar o pavio</button>
        <button class="ui-btn" data-a="agua1">Encher com água destilada</button><button class="ui-btn" data-a="agua0">Encher com água da torneira</button>
        <button class="ui-btn" data-a="bateria">Conferir bateria e certificado</button></div>${insp}${bat}
        <p class="pn-p small">Ligar, configurar e gravar: use as teclas do <b>visor do medidor</b> (painel à direita).${G ? ' Intervalo: ☰ → Gravação → Intervalo de registro → ▶‖ até 1 min → ☰ salva → ⏻ sai.' : ''}</p>`;
    }
    if (tab === 1) return A.postos.map((id) => { const st = stOf(id), p = A.place[id] || {};
      return `<div class="ativ-posto ${S.station === stKey(id) ? 'here' : ''}"><b>${id}</b> ${esc(CYC().SITUACOES[id].label)}
        <div class="ativ-row"><label>Altura dos sensores (m) <input data-h="${id}" inputmode="decimal" value="${p.h != null ? f(p.h, 2) : f(S.meterHeight, 2)}"></label>
        <label class="chkbox"><input type="checkbox" data-inf="${id}" ${p.inf ? 'checked' : ''}> Informei a trabalhadora</label></div>
        <div class="ativ-row ori">${[['fonte', 'Sensores voltados para a fonte, visor oposto'], ['visor', 'Visor voltado para a fonte'], ['lado', 'Sensores de lado para a fonte']].map(([v, l]) =>
          `<label class="chkbox"><input type="radio" name="ori-${id}" value="${v}" ${p.ori === v ? 'checked' : ''}> ${l}</label>`).join('')}</div>
        ${G ? `<p class="pn-p small">Tórax ${st.seated ? 'sentada' : 'em pé'}: ${f(st.chest, 2)} m${st.source ? '' : ' · sem fonte principal: orientação não crítica'}.</p>` : ''}
        <button class="ui-btn" data-place="${id}">Levar o medidor para ${id}</button></div>`; }).join('');
    if (tab === 2) {
      const id = A.cur && A.postos.includes(A.cur) ? A.cur : A.postos[0]; const sh = A.sheets[id];
      const tabs = A.postos.map((k) => `<button class="tab ${k === id ? 'on' : ''}" data-cur="${k}">${k}${A.sheets[k]?.sel != null ? ' ✓' : ''}</button>`).join('');
      const rows = sh ? sh.rows.map((r, i) => `<tr data-row="${i}" class="${sh.sel != null && i >= sh.sel && i < sh.sel + 5 ? 'win' : ''}"><td>${i + 1}</td><td>${app.fmtClock(r.clock)}</td><td>${f(r.tg)}</td><td>${f(r.tbn)}</td><td>${f(r.tbs)}</td></tr>`).join('') : '';
      const m = meanOf(sh);
      return `<div class="tabs">${tabs}</div>
        <div class="ativ-act">${!sh || sh.closed ? `<button class="ui-btn primary" data-a="begin">▶ ${sh ? 'Medir de novo' : 'Iniciar leituras'} em ${id}</button>` : `<button class="ui-btn danger" data-a="stop">■ Encerrar leituras</button>`}
        ${hasDoor(id) ? `<label class="chkbox"><input type="checkbox" data-door ${S.doorHold ? 'checked' : ''}> Manter a porta do forno aberta (simulação)</label>` : ''}</div>
        ${sh?.closed ? `<p class="pn-p small">Clique na <b>primeira</b> das 5 leituras que serão usadas.</p>` : sh ? '<p class="pn-p small">Lendo a cada minuto…</p>' : ''}
        ${sh ? `<div class="sheet-wrap"><table class="sheet ativ-sheet"><thead><tr><th>#</th><th>Hora</th><th>tg</th><th>tbn</th><th>tbs</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
        ${m ? `<p class="pn-p">Médias escolhidas: tg <b>${f(m.tg, 2)}</b> · tbn <b>${f(m.tbn, 2)}</b> · tbs <b>${f(m.tbs, 2)}</b> °C</p>` : ''}`;
    }
    if (tab === 3) {
      const C = CYC().CRONO;
      const qopts = (a) => `<option value="">—</option>` + N.QUADRO_M.map((G2) => `<optgroup label="${esc(G2.grupo)}">${G2.itens.map(([l, w]) => `<option value="${w}|${esc(G2.grupo)}|${esc(l)}" ${A.inp.Mlab?.[a] === `${G2.grupo}|${l}` ? 'selected' : ''}>${esc(l)} — ${w} W</option>`).join('')}</optgroup>`).join('');
      return `<table class="tbl small"><thead><tr><th>Evento</th><th>Cronometragens (s)</th><th>Por hora</th></tr></thead><tbody>${Object.entries(C).map(([k, e]) =>
          `<tr><td><b>${k}</b> ${esc(e.evento)}</td><td>${e.s.join(' · ')}</td><td>${e.porHora}×</td></tr>`).join('')}</tbody></table>
        <div class="pn-sub">Tempo na hora de pico (min)</div><div class="ativ-grid">${SIDS().map((id) => `<label>${id} <input data-tsit="${id}" inputmode="decimal" value="${esc(A.inp.tsit[id] ?? '')}"></label>`).join('')}
        ${ACTS().map((a) => `<label>${a} <input data-tact="${a}" inputmode="decimal" value="${esc(A.inp.tact[a] ?? '')}"></label>`).join('')}</div>
        <div class="pn-sub">Taxa metabólica (Quadro 2 da NR-15)</div>${ACTS().map((a) => `<div class="mrow"><div class="mrow-h"><b>${a}</b> ${esc(CYC().ATIVIDADES[a].label)} <span class="muted">· ${CYC().ATIVIDADES[a].sit}</span></div><div class="mrow-c"><select data-M="${a}">${qopts(a)}</select></div></div>`).join('')}
        <div class="pn-sub">Vestimenta e aclimatização</div><div class="vrow"><select data-vest><option value="">—</option>${N.VESTIMENTAS.map((v) => `<option value="${v.id}" ${A.inp.vest === v.id ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></div>
        <div class="vrow"><label class="chkbox"><input type="checkbox" data-capuz ${A.inp.capuz ? 'checked' : ''}> Com capuz</label>
        <label class="chkbox"><input type="radio" name="acl" value="sim" ${A.inp.aclim === 'sim' ? 'checked' : ''}> Aclimatizada</label><label class="chkbox"><input type="radio" name="acl" value="nao" ${A.inp.aclim === 'nao' ? 'checked' : ''}> Não aclimatizada</label></div>`;
    }
    if (tab === 4) return `${A.guiado ? `<div class="eq">IBUTG = 0,7 tbn + 0,3 tg</div><div class="eq"><span class="ov">IBUTG</span> = Σ(IBUTG<sub>i</sub> × t<sub>i</sub>) / 60 + ajuste</div><div class="eq"><span class="ov">M</span> = Σ(M<sub>i</sub> × t<sub>i</sub>) / 60</div>` : ''}
      <div class="ativ-grid two"><label>IBUTG médio, já com o ajuste da vestimenta (°C) <input data-ib inputmode="decimal" value="${esc(A.inp.ib)}"></label><label>M média (W) <input data-Mm inputmode="decimal" value="${esc(A.inp.Mm)}"></label></div>`;
    return `<div class="pn-sub">NHO-06 — Quadro 3</div><div class="vrow"><select data-dec><option value="">—</option>${DECISOES.map((d, i) => `<option value="${i}" ${A.inp.dec === String(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="pn-sub">NR-15 — Anexo 3</div><div class="vrow"><select data-nr><option value="">—</option>${NR15.map((d, i) => `<option value="${i}" ${A.inp.nr === String(i) ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="ui-row"><button class="ui-btn primary big" data-entregar>Entregar</button></div>`;
  }
  function draw() {
    if (!A?.on) return; panel.classList.remove('hidden');
    const keep = panel.querySelector('.ativ-body')?.scrollTop || 0, sw = panel.querySelector('.sheet-wrap'), atB = !sw || sw.scrollTop + sw.clientHeight >= sw.scrollHeight - 8;
    panel.innerHTML = `<div class="ativ-h"><span>📝 Atividade · ${A.guiado ? 'Guiada' : 'Avaliação'} · ${esc(A.aluno)}</span><button class="ui-btn mini ghost" data-sair>Sair</button></div>
      ${caseHTML()}<div class="ativ-tabs">${TABS.map((t, i) => `<button data-t="${i}" class="${i === tab ? 'on' : ''}">${i + 1}. ${t}</button>`).join('')}</div>
      ${A.guiado ? `<div class="ativ-guia">💡 ${passo(tab)}</div>` : ''}<div class="ativ-body">${tabHTML()}</div>
      <div class="ativ-foot"><button class="ui-btn ghost mini" data-ouvir>🔊 Ouvir</button><button class="ui-btn mini" data-entregar>Entregar</button></div>`;
    const b = panel.querySelector('.ativ-body'); b.scrollTop = keep; const w2 = panel.querySelector('.sheet-wrap'); if (w2 && atB) w2.scrollTop = w2.scrollHeight;
    bind();
  }
  function bind() {
    const q = (s) => panel.querySelectorAll(s), on = (s, ev2, fn) => q(s).forEach((e) => e.addEventListener(ev2, fn));
    on('[data-t]', 'click', (e) => { tab = +e.currentTarget.dataset.t; draw(); if (A.guiado) ui.say(passo(tab)); });
    on('[data-sair]', 'click', () => exit());
    on('[data-ouvir]', 'click', () => ui.say(A.guiado ? passo(tab) : ATIV_TXT.prova.text));
    on('[data-entregar]', 'click', () => deliver());
    on('[data-a]', 'click', (e) => { const a = e.currentTarget.dataset.a, cur = A.cur || A.postos[0];
      if (a === 'agua1') act.agua(true); else if (a === 'agua0') act.agua(false); else if (a === 'begin') act.begin(cur); else if (a === 'stop') act.stop(cur); else act[a]?.(); });
    on('[data-place]', 'click', (e) => act.place(e.currentTarget.dataset.place));
    on('[data-cur]', 'click', (e) => { if (A.sheets[A.cur] && !A.sheets[A.cur].closed) return neutral('Encerre a medição em andamento.'); A.cur = e.currentTarget.dataset.cur; draw(); });
    on('[data-row]', 'click', (e) => act.sel(A.cur || A.postos[0], +e.currentTarget.dataset.row));
    on('[data-door]', 'change', (e) => act.door(e.currentTarget.checked));
    on('[data-tsit]', 'input', (e) => (A.inp.tsit[e.currentTarget.dataset.tsit] = e.currentTarget.value));
    on('[data-tact]', 'input', (e) => (A.inp.tact[e.currentTarget.dataset.tact] = e.currentTarget.value));
    on('[data-M]', 'change', (e) => { const [w, g, l] = e.currentTarget.value.split('|'); const a = e.currentTarget.dataset.m; A.inp.M[a] = +w || null; (A.inp.Mlab ||= {})[a] = w ? `${g}|${l}` : ''; });
    on('[data-vest]', 'change', (e) => (A.inp.vest = e.currentTarget.value));
    on('[data-capuz]', 'change', (e) => (A.inp.capuz = e.currentTarget.checked));
    on('[name="acl"]', 'change', (e) => (A.inp.aclim = e.currentTarget.value));
    on('[data-ib]', 'input', (e) => (A.inp.ib = e.currentTarget.value)); on('[data-Mm]', 'input', (e) => (A.inp.Mm = e.currentTarget.value));
    on('[data-dec]', 'change', (e) => (A.inp.dec = e.currentTarget.value)); on('[data-nr]', 'change', (e) => (A.inp.nr = e.currentTarget.value));
  }

  // ── boletim ──
  function deliver() {
    if (A.sheets[A.cur] && !A.sheets[A.cur].closed) act.stop(A.cur);
    const G = grade(); A.result = G; const E = G.ref;
    const min = Math.round((Date.now() - A.t0) / 60000);
    modal.innerHTML = `<div class="ui-dialog laudo-wrap"><div class="laudo-bar"><button class="ui-btn primary" data-print>🖨 Imprimir</button><button class="ui-btn ghost" data-close>✕ Fechar</button></div>
      <article class="laudo boletim"><header><div class="lh-k">Boletim · Atividade de monitoramento do calor · ${A.guiado ? 'modo guiado' : 'modo avaliação'}</div>
      <h1>${esc(A.aluno)} — nota ${f(G.total, 1)} / 10</h1><p>${esc(app.env?.()?.label || '')} · postos ${A.postos.join(', ')} · ${new Date().toLocaleDateString('pt-BR')} · ${min} min</p></header>
      <table class="lt"><thead><tr><th>Critério</th><th>Pontos</th><th>Detalhes</th></tr></thead><tbody>${G.items.map(([n, mx, v, d]) =>
        `<tr><td><b>${n}</b></td><td>${f(v, 2)} / ${f(mx, 1)}</td><td>${d.filter(Boolean).map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table>
      <h2>Gabarito (com as suas leituras, tempos e M de referência)</h2>
      ${E ? `<p>IBUTG por situação: ${E.sits.map((s) => `${s.id} ${f(s.ibutg, 2)} °C`).join(' · ')}. IBUTG médio ${f(E.ibutgMedio, 2)} °C${E.ajuste ? ` + ${f(E.ajuste, 1)} = ${f(E.ibutgAjustado, 2)}` : ''} °C · M média ${f(E.M, 1)} W (linha ${E.LE?.M} W).<br>
        NA ${f(E.NA?.v, 1)} · LE ${f(E.LE?.v, 1)} · incerteza ${f(E.INC?.lo, 1)}–${f(E.INC?.hi, 1)} °C → <b>${E.decisao}</b>. NR-15: <b>${E.nr15?.insalubre ? 'insalubre, grau médio' : 'não insalubre'}</b>.</p>` : '<p>Medições incompletas: não foi possível calcular o gabarito.</p>'}
      <p class="muted">Armadilhas sorteadas: ${A.traps.map((t) => ({ agua: 'reservatório vazio', pavio: 'pavio sujo', intervalo: 'intervalo de gravação errado', altura: 'tripé na altura errada' })[t]).join(', ')}.</p>
      <p class="sign"><span>${esc(A.aluno)}</span><br><small>Aluno</small></p></article></div>`;
    modal.classList.remove('hidden'); document.body.classList.add('laudo-open');
    modal.querySelector('[data-print]').onclick = () => window.print();
    modal.querySelector('[data-close]').onclick = () => { modal.classList.add('hidden'); document.body.classList.remove('laudo-open'); };
    ui.say(`Atividade entregue. Nota ${f(G.total, 1)}.`);
    return G;
  }
  return { open, start, exit, deliver, grade, act, get A() { return A; }, setTab: (t) => { tab = t; draw(); }, draw };
}
