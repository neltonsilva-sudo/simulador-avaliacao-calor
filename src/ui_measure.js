// Posicionar + Medir (planilha de campo, estabilização NHO-06 8.2, simulação da porta aberta) — dono: UI/DEMO.
import { CAPTIONS, fwDo, isRec } from './demo.js';

// Situações e estações vêm dos dados (CYC().SITUACOES[id].station → app.STATIONS[...]): nada fixo por ambiente.
const PALETTE = ['#ff7a45', '#f5c451', '#4cc3ff', '#b58cff', '#5fd49a'];
export const SIT_COLOR = new Proxy({}, { get: (_, id) => PALETTE[(parseInt(String(id).replace(/\D/g, ''), 10) - 1 + PALETTE.length) % PALETTE.length] || PALETTE[0] });
const f = (v, d = 1) => (v == null || !isFinite(v) ? '—' : v.toFixed(d).replace('.', ','));

export function createMeasure({ app, ui }) {
  const N = app.N, S = app.state;
  const CYC = () => app.cycle?.() || app.CY; // ciclo do ambiente ativo
  /** sits[id] = {rows:[{clock,tg,tbn,tbs}], stab, mean, t0, t1, done, estimated, door, h} */
  const sits = {};
  let cur = null, measuring = false, placed = null, placing = false, tab = null;
  const ui_ = ui;
  const SIDS = () => Object.keys(CYC().SITUACOES);
  const stKey = (id) => CYC().SITUACOES[id]?.station;
  const stOf = (id) => app.STATIONS[stKey(id)];
  const actOf = (id) => Object.values(CYC().ATIVIDADES).find((a) => a.sit === id)?.id;
  /** situação com fonte principal de curta duração (porta do forno/caldeira aberta) → simulação NHO-06 8.2 */
  const isSim = (id) => { const src = stOf(id)?.source; return !!src && src in (app.field?.doors || {}) && (S.env || 'fornos') === 'fornos'; };
  const cap = (k) => CAPTIONS[`${S.env || ''}:${k}`] || CAPTIONS[k] || { title: k, text: '' };

  app.on('env', () => { for (const k of Object.keys(sits)) delete sits[k]; cur = null; measuring = false; placed = null; tab = null; });
  // ── posicionar ──
  async function place(id, { speak = true } = {}) {
    if (placing) return; placing = true;
    const key = stKey(id), st = app.STATIONS[key];
    try {
      const c = cap(id); ui_.caption(c.title, c.text);
      const fala = speak ? ui_.say(c.text) : Promise.resolve();
      app.setView(key, { animate: true, duration: 2.2 });
      if (S.onTripod === false) await app.mountOnTripod?.(1.2);
      app.worker?.setStation?.(key, { act: actOf(id) });
      await app.placeMeter(key, { duration: 2.0 });
      placed = id; ui_.render();
      await fala;
      if (speak && placed === id && S.phase === 'posicionar') {
        app.worker?.setActivity?.('olhando');
        const ci = cap('informar'); ui_.caption(ci.title, ci.text); await ui_.say(ci.text);
        if (S.phase === 'posicionar') app.worker?.setActivity?.(actOf(id));
      }
    } finally { placing = false; }
    return st;
  }
  const placedId = () => SIDS().find((id) => stKey(id) === S.station) || null;

  // ── medir ──
  async function begin(id) {
    if (placedId() !== id) await place(id, { speak: false });
    cur = id; sits[id] = { rows: [], stab: null, mean: null, t0: S.clock, t1: null, done: false, door: isSim(id), h: S.meterHeight };
    app.setPhase('medicao');
    if (isSim(id)) {
      // NHO-06 8.2: condição de curta duração (porta aberta ~4 min por carga) → simulação (manter a porta aberta)
      S.followCycle = false; app.worker?.setStation?.(stKey(id), { act: actOf(id) });
      const c = cap('simulacao'); ui_.caption(c.title, c.text); const fs = ui_.say(c.text);
      await new Promise((r) => setTimeout(r, 2200)); app.holdDoor(true); await fs;
    } else {
      S.followCycle = true; if (S.doorHold) app.holdDoor(false);
      if (stOf(id)?.source) { const c = cap('continuo'); ui_.caption(c.title, c.text); await ui_.say(c.text); } // fonte contínua: sem simulação
    }
    if (cur !== id || S.phase !== 'medicao') return;
    const ci = cap('iniciar'); ui_.caption(ci.title, ci.text); const fi = ui_.say(ci.text);
    await fwDo.startRec(app);
    sits[id].t0 = S.clock; sits[id].rec = isRec(app);
    measuring = true; app.run(true); ui_.render();
    fi.then(() => { if (measuring && cur === id) ui_.hideCaption(); });
  }
  app.on('minute', (ev) => {
    if (!measuring || !cur || !S.running) return;
    const s = sits[cur]; if (!s || s.done || ev.station !== stKey(cur)) return;
    const r = ev.read || app.readings(); s.rows.push({ clock: ev.clock, tg: r.tg, tbn: r.tbn, tbs: r.tbs, wet: app.wet() });
    if (!s.stab) { const st = N.stabilization(s.rows, 5, 0.4); if (st.stable) { s.stab = st; s.mean = st.mean; onStable(cur); } }
    if (s.rows.length >= 90 && !s.stab) finish(cur, { aborted: true });
    ui_.refreshPanel();
  });
  async function onStable(id) {
    measuring = false; app.run(false); sits[id].t1 = S.clock; ui_.render();
    const c = cap('estabilizou'); ui_.caption(c.title, c.text); await ui_.say(c.text);
    if (cur === id) await finish(id);
  }
  async function finish(id, { aborted = false } = {}) {
    const s = sits[id]; if (!s || s.done) return;
    measuring = false; if (S.running) app.run(false); s.t1 ??= S.clock; s.aborted = aborted && !s.stab;
    s.done = !!s.stab;
    await fwDo.stopRec(app);
    if (s.door && S.doorHold) {
      app.holdDoor(false); S.followCycle = true;
      const seg = app.segment?.(); if (seg?.station) app.worker?.setStation?.(seg.station, { act: seg.act });
      const c = cap('fimSim'); ui_.caption(c.title, c.text); await ui_.say(c.text);
    } else S.followCycle = true;
    if (cur === id) cur = null;
    if (allDone() && ['medicao', 'posicionar'].includes(S.phase)) { const c = cap('todas'); ui_.caption(c.title, c.text); ui_.say(c.text); }
    ui_.render();
  }
  function abort() { if (cur) finish(cur, { aborted: true }); }
  const allDone = () => SIDS().every((k) => sits[k]?.done);
  const nextId = () => SIDS().find((k) => !sits[k]?.done) || null;

  /** Valores de exemplo (equilíbrio do campo térmico no ponto de medição) — só quando a medição não foi feita. */
  function fillExample() {
    const fd = app.field; if (!fd?.at) return;
    const srcs = [...new Set(SIDS().map((id) => stOf(id)?.source).filter((k) => k && k in (fd.doors || {})))];
    const prev = Object.fromEntries(srcs.map((k) => [k, fd.doors?.[k] ?? 0]));
    for (const id of SIDS()) {
      if (sits[id]?.done) continue;
      const st = stOf(id);
      for (const k of srcs) fd.setDoor?.(k, k === st.source && isSim(id) ? 1 : 0);
      const v = fd.at({ x: st.tripod[0], y: st.chest, z: st.tripod[2] });
      const r2 = (x) => Math.round(x * 100) / 100;
      sits[id] = { rows: [], stab: null, mean: { tg: r2(v.tg), tbn: r2(v.tbn), tbs: r2(v.ta) }, done: true, estimated: true, t0: null, t1: null };
    }
    for (const k of srcs) fd.setDoor?.(k, prev[k]);
  }

  // ── painéis ──
  function positionHTML() {
    const pid = placedId();
    const cards = SIDS().map((id) => {
      const st = stOf(id), s = sits[id], sit = CYC().SITUACOES[id];
      const src = st.source ? ([...(app.OVENS || []), ...(app.BOILERS || [])].find((o) => o.id === st.source)?.label?.replace(/\s*[—(].*$/, '') || 'fonte principal') : null;
      const ib = s?.mean ? N.ibutg(s.mean.tbn, s.mean.tg) : null;
      return `<button class="st-card ${pid === id ? 'on' : ''} ${s?.done ? 'done' : ''}" data-place="${id}" style="--c:${SIT_COLOR[id]}">
        <span class="st-id">${id}</span><span class="st-body"><b>${sit.label}</b><small>${sit.desc}</small>
        <em>Tórax ${f(st.chest, 2)} m${src ? ` · fonte: ${src}` : ' · sem fonte principal próxima'}${st.seated ? ' · sentada' : ''}</em></span>
        <span class="st-state">${s?.done ? `✓ ${f(ib, 1)} °C` : pid === id ? 'aqui' : '›'}</span></button>`;
    }).join('');
    let check = '';
    if (pid) {
      const st = stOf(pid), h = S.meterHeight, okH = Math.abs(h - st.chest) < 0.051;
      const items = [
        [okH, `Altura dos sensores <b>${f(h, 2)} m</b> ${okH ? '= tórax' : `(tórax: ${f(st.chest, 2)} m)`} — região mais atingida do corpo`],
        [true, 'Sensores alinhados num <b>plano horizontal</b>, próximos, sem se tocar'],
        [true, st.source ? 'Normal ao plano vertical dos sensores <b>apontada para a fonte</b> (porta aberta)' : 'Sem fonte principal próxima: orientação não crítica'],
        [true, '<b>Visor na face oposta</b> à fonte (leitura sem interferir)'],
        [true, 'Tripé ao lado da forneira: <b>não obstrui</b> o trabalho nem fica entre a fonte e os sensores'],
      ];
      check = `<div class="pn-sub">Montagem e posicionamento — NHO-06 7.2</div><ul class="chk">${items.map(([ok, t]) => `<li class="${ok ? 'ok' : 'no'}">${t}</li>`).join('')}</ul>
        <label class="hrange"><span>Altura dos sensores</span><input type="range" min="0.6" max="1.8" step="0.05" value="${h}" data-h><b>${f(h, 2)} m</b></label>`;
    }
    return `<div class="pn-h">Posicionar o medidor</div><p class="pn-p">Escolha a situação térmica. Cada uma é medida separadamente; o ciclo da forneira passa pelas três.</p>
      <div class="st-list">${cards}</div>${check}`;
  }
  function sheetHTML(id) {
    const s = sits[id]; const sit = CYC().SITUACOES[id];
    if (!s) return `<p class="pn-p">${id} ainda não medida.</p>`;
    if (s.estimated) return `<p class="pn-p warn">${id}: valores de exemplo (equilíbrio do campo térmico), não medidos — tg ${f(s.mean.tg, 2)} · tbn ${f(s.mean.tbn, 2)} · tbs ${f(s.mean.tbs, 2)} °C.</p>`;
    const W = s.stab ? [s.stab.start, s.stab.end] : [-1, -1];
    const rows = s.rows.map((r, i) => `<tr class="${i >= W[0] && i <= W[1] ? 'win' : ''}${r.wet === false ? ' dry' : ''}"><td>${i + 1}</td><td>${app.fmtClock(r.clock)}</td><td>${f(r.tg)}</td><td>${f(r.tbn)}</td><td>${f(r.tbs)}</td><td>${f(N.ibutg(r.tbn, r.tg), 1)}</td></tr>`).join('');
    const mean = s.mean ? `<tr class="mean"><td colspan="2">Média (5)</td><td>${f(s.mean.tg, 2)}</td><td>${f(s.mean.tbn, 2)}</td><td>${f(s.mean.tbs, 2)}</td><td>${f(N.ibutg(s.mean.tbn, s.mean.tg), 2)}</td></tr>` : '';
    const st = s.stab ? `<div class="stab ok">✓ Estável nas leituras ${s.stab.start + 1}–${s.stab.end + 1}: variação tg ${f(s.stab.spans.tg, 1)} · tbn ${f(s.stab.spans.tbn, 1)} · tbs ${f(s.stab.spans.tbs ?? 0, 1)} °C (≤ 0,4)</div>`
      : s.aborted ? '<div class="stab bad">Medição encerrada sem estabilização — repita a situação.</div>'
      : `<div class="stab run"><i></i>Aguardando 5 leituras seguidas dentro de 0,4 °C… ${s.rows.length ? `(${s.rows.length} min)` : ''}</div>`;
    const dry = !app.wet() && !s.done ? '<div class="stab bad">⚠ Pavio seco ou reservatório vazio: o bulbo úmido natural está errado.</div>' : '';
    return `<div class="sheet-h"><b style="color:${SIT_COLOR[id]}">${id}</b> ${sit.label}${s.door ? ' · <span class="tag-door">fonte mantida aberta (simulação)</span>' : ''}</div>
      ${chartSVG(s)}${st}${dry}
      <div class="sheet-wrap"><table class="sheet"><thead><tr><th>#</th><th>Hora</th><th>tg</th><th>tbn</th><th>tbs</th><th>IBUTG</th></tr></thead><tbody>${rows}${mean}</tbody></table></div>`;
  }
  function chartSVG(s) {
    const R = s.rows; if (R.length < 2) return '<div class="chart empty">O gráfico aparece a partir da 2ª leitura.</div>';
    const W = 340, H = 118, pl = 26, pr = 6, pt = 8, pb = 16;
    const vals = R.flatMap((r) => [r.tg, r.tbn, r.tbs]); let lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
    const n = Math.max(R.length - 1, 10), X = (i) => pl + (i / n) * (W - pl - pr), Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const line = (k, c) => `<polyline fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" points="${R.map((r, i) => `${X(i).toFixed(1)},${Y(r[k]).toFixed(1)}`).join(' ')}"/>`;
    const win = s.stab ? `<rect x="${X(s.stab.start) - 3}" y="${pt}" width="${X(s.stab.end) - X(s.stab.start) + 6}" height="${H - pt - pb}" rx="3" fill="rgba(95,212,154,.16)" stroke="rgba(95,212,154,.6)"/>` : '';
    const ticks = [lo, (lo + hi) / 2, hi].map((v) => `<text x="${pl - 4}" y="${Y(v) + 3}" text-anchor="end">${Math.round(v)}</text><line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="g"/>`).join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${ticks}${win}${line('tg', '#ff8a4c')}${line('tbs', '#c9d3dd')}${line('tbn', '#4cc3ff')}
      <text x="${W - pr}" y="${H - 3}" text-anchor="end">min ${R.length}</text></svg>
      <div class="legend"><span><i style="background:#ff8a4c"></i>tg globo</span><span><i style="background:#4cc3ff"></i>tbn úmido nat.</span><span><i style="background:#c9d3dd"></i>tbs seco</span></div>`;
  }
  function measureHTML() {
    const t = tab || cur || nextId() || SIDS()[0];
    const tabs = SIDS().map((id) => `<button class="tab ${t === id ? 'on' : ''} ${sits[id]?.done ? 'done' : ''}" data-tab="${id}" style="--c:${SIT_COLOR[id]}">${id}${sits[id]?.done ? ' ✓' : cur === id ? ' ●' : ''}</button>`).join('');
    return `<div class="pn-h">Planilha de campo <small>leitura a cada minuto</small></div><div class="tabs">${tabs}</div>${sheetHTML(t)}`;
  }
  function bind(el) {
    el.querySelectorAll('[data-place]').forEach((b) => (b.onclick = () => { app.audio?.start?.(); place(b.dataset.place); }));
    el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; ui_.refreshPanel(); }));
    const hr = el.querySelector('[data-h]'); if (hr) hr.oninput = () => { app.setMeterHeight(+hr.value); hr.nextElementSibling.textContent = f(+hr.value, 2) + ' m'; clearTimeout(hr._t); hr._t = setTimeout(() => ui_.refreshPanel(), 400); };
  }
  return {
    sits, SIDS, stKey, stOf, actOf, isSim, place, begin, finish, abort, fillExample, positionHTML, measureHTML, bind, allDone, nextId, placedId,
    get cur() { return cur; }, get measuring() { return measuring; }, get placing() { return placing; }, setTab(t) { tab = t; },
  };
}
