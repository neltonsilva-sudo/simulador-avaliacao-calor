// Escolha de quantos/quais postos de trabalho (situações térmicas S1/S2/S3) a trabalhadora percorre no ciclo.
// app.setPostos(ids) filtra o ciclo (cycle.js filterCycle): o tempo dos postos retirados vai para o posto receptor, e a
// medição, a cronometragem, o resultado e o laudo passam a usar só os postos escolhidos.
const CSS = `
.pst{position:fixed;left:16px;top:84px;z-index:40;max-width:min(430px,calc(100vw - 32px));padding:10px 12px 11px;border-radius:14px;
 background:rgba(14,16,19,.78);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.09);
 color:#e8eaed;font:500 12px Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3)}
.pst .hd{display:flex;align-items:center;gap:8px;justify-content:space-between;cursor:pointer;user-select:none}
.pst .t{font:700 10.5px Inter;letter-spacing:.14em;text-transform:uppercase;color:#ffb36b}
.pst .n{font:700 12px Inter;color:#fff;background:rgba(255,138,76,.18);border:1px solid rgba(255,138,76,.35);border-radius:999px;padding:2px 9px}
.pst .bd{margin-top:8px}.pst.min .bd{display:none}
.pst .chips{display:flex;flex-wrap:wrap;gap:6px}
.pst button.c{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#c9ccd1;border-radius:9px;padding:6px 9px;font:600 12px Inter;cursor:pointer;text-align:left}
.pst button.c b{color:#fff;margin-right:4px}.pst button.c.on{background:rgba(255,138,76,.2);border-color:rgba(255,138,76,.6);color:#fff}
.pst .q{display:flex;gap:6px;margin:8px 0 2px}.pst .q button{flex:1;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#e8eaed;border-radius:8px;padding:5px 0;font:700 12px Inter;cursor:pointer}
.pst .q button.on{background:#e8551c;border-color:#e8551c}
.pst .inf{margin-top:7px;color:#9aa0a6;font-size:11.5px;line-height:1.4}
@media (max-width:640px){.pst{top:auto;bottom:96px}}
`;

export function createPostosUI(app) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.className = 'pst min'; (document.getElementById('ui') || document.body).appendChild(el); // some com ?ui=0
  const base = () => app.CY.CYCLES[app.state.env];
  const fmt = (m) => (Math.round(m * 10) / 10).toString().replace('.', ',');
  function render() {
    const B = base(), all = Object.keys(B.SITUACOES), on = app.postos(), C = app.cycle();
    const pk = C.JORNADA.find((h) => h.start === C.PEAK) || C.JORNADA.find((h) => !h.off), comp = C.hourComposition(pk);
    const who = app.env?.()?.worker || 'trabalhadora';
    el.innerHTML = `<div class="hd"><span class="t">Postos de trabalho</span><span class="n">${on.length} de ${all.length}</span></div>
      <div class="bd">
        <div class="q">${all.map((_, i) => `<button data-n="${i + 1}" class="${on.length === i + 1 ? 'on' : ''}">${i + 1} posto${i ? 's' : ''}</button>`).join('')}</div>
        <div class="chips">${all.map((id) => `<button class="c ${on.includes(id) ? 'on' : ''}" data-id="${id}"><b>${id}</b>${B.SITUACOES[id].label}</button>`).join('')}</div>
        <div class="inf">A ${who} percorre ${on.length === 1 ? 'só este posto' : 'estes postos'} no ciclo. Hora de pico: ${on.map((id) => `${id} ${fmt(comp.sit[id])} min`).join(' · ')}.
        ${on.length < all.length ? `O tempo dos postos retirados passa para ${C.receptor}. Meça só os postos escolhidos.` : ''}</div>
      </div>`;
    el.querySelector('.hd').onclick = () => el.classList.toggle('min');
    el.querySelectorAll('button.c').forEach((b) => (b.onclick = (e) => { e.stopPropagation();
      const id = b.dataset.id, cur = app.postos(); const nx = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      if (!nx.length) return; app.setPostos(nx); }));
    el.querySelectorAll('.q button').forEach((b) => (b.onclick = (e) => { e.stopPropagation();
      const n = +b.dataset.n, B2 = base(), all2 = Object.keys(B2.SITUACOES), pk2 = B2.JORNADA.find((h) => h.start === B2.PEAK), c2 = B2.hourComposition(pk2);
      // n postos: mantém os de maior tempo na hora de pico (sempre inclui o posto quente S1 quando n ≥ 1)
      const order = all2.slice().sort((a, b2) => (b2 === 'S1') - (a === 'S1') || c2.sit[b2] - c2.sit[a]);
      app.setPostos(order.slice(0, n)); }));
  }
  app.on('postos', render); app.on('env', render); render();
  return { render, el };
}
