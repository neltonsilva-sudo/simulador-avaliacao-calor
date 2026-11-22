// Painel flutuante das válvulas do distribuidor de vapor (vidro escuro, Inter — mesmo estilo de ui_oven.js).
const CSS = `
.vlp{position:fixed;z-index:61;width:268px;padding:13px 15px 14px;border-radius:16px;background:rgba(14,16,19,.86);backdrop-filter:blur(14px);
 -webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.45);color:#e8eaed;font:500 13px Inter,system-ui,sans-serif;
 transition:opacity .18s ease,transform .18s ease}
.vlp.hid{opacity:0;transform:translateY(6px);pointer-events:none}
.vlp .tag{display:inline-block;font:700 11px "Roboto Mono",monospace;letter-spacing:.06em;padding:2px 7px;border-radius:6px;background:#b3261e;color:#fff;margin-right:6px}
.vlp .tag.b{background:#1d5fbf}
.vlp h3{margin:0 24px 2px 0;font:700 14px Inter,system-ui;letter-spacing:.01em;display:flex;align-items:center}
.vlp .sub{color:#9aa0a6;font-size:11.5px;margin:3px 0 9px;line-height:1.35}
.vlp .x{position:absolute;right:10px;top:7px;border:0;background:none;color:#9aa0a6;font-size:20px;cursor:pointer}
.vlp .row{display:flex;align-items:baseline;justify-content:space-between;background:#050606;border-radius:10px;padding:7px 12px;margin:5px 0}
.vlp .lb{font:600 10.5px Inter;letter-spacing:.12em;color:#8b9096;text-transform:uppercase}
.vlp .v{font:700 26px "Roboto Mono",monospace;color:#f2f3f5}
.vlp .v small{font-size:12px;color:#9aa0a6;margin-left:3px}
.vlp .mv{font:600 11px Inter;color:#ffb35c;min-height:14px}
.vlp .bar{height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin:2px 0 4px}.vlp .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#2b8a3e,#58d26b)}
.vlp .p{display:flex;justify-content:space-between;font-size:12px;color:#c9ccd1;padding:2px 2px}
.vlp .p b{font:700 12px "Roboto Mono",monospace;color:#e8eaed}
.vlp .btns{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-top:8px}
.vlp button.k{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8eaed;border-radius:9px;padding:8px 0;font:700 12.5px Inter;cursor:pointer}
.vlp button.k:hover{background:rgba(255,255,255,.14)} .vlp button.k:disabled{opacity:.35;cursor:default}
.vlp button.k.o{background:#2b8a3e;border-color:#2b8a3e} .vlp button.k.c{background:#c62f22;border-color:#c62f22}
.vlp .note{margin-top:9px;font-size:11.5px;line-height:1.4;color:#ffd7a8;background:rgba(255,140,40,.12);border:1px solid rgba(255,140,40,.25);border-radius:9px;padding:7px 9px}
.vlp .note.ok{color:#bfe8c7;background:rgba(60,200,90,.1);border-color:rgba(60,200,90,.25)}
`;

export function createValvePanel({ onCmd }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.className = 'vlp hid';
  el.innerHTML = `<button class="x" title="Fechar">×</button><h3><span class="tag"></span><span class="nm"></span></h3><div class="sub"></div>
  <div class="row"><span class="lb">Abertura</span><span class="v"><span class="pc">100</span><small>%</small></span></div>
  <div class="bar"><i></i></div><div class="mv"></div>
  <div class="p"><span class="pl">Pressão a jusante</span><b class="pv">–</b></div>
  <div class="btns"><button class="k o" data-c="open">Abrir</button><button class="k" data-c="-25">−25%</button><button class="k" data-c="+25">+25%</button><button class="k c" data-c="close">Fechar</button></div>
  <div class="note" hidden></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  let cur = null;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  $('.x').onclick = () => hide();
  el.querySelectorAll('button.k').forEach((b) => (b.onclick = () => cur && onCmd(cur, b.dataset.c)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  function show(v, x, y) {
    cur = v; el.classList.remove('hid');
    const tg = $('.tag'); tg.textContent = v.tag; tg.classList.toggle('b', v.wheelColor === 'blue');
    $('.nm').textContent = v.typeName; $('.sub').textContent = v.name;
    const W = 268, H = el.offsetHeight || 250;
    const right = x + 60 + W < innerWidth - 12; // ao lado do volante, sem cobri-lo
    el.style.left = (right ? x + 60 : Math.max(12, x - 60 - W)) + 'px';
    el.style.top = Math.max(12, Math.min(innerHeight - H - 12, y - H * 0.5)) + 'px';
    refresh();
  }
  function hide() { cur = null; el.classList.add('hid'); }
  let last = '';
  function refresh() {
    if (!cur) return;
    const v = cur, pc = Math.round(v.open * 100);
    const moving = v.anim != null;
    const pd = v.pDown != null ? `${v.pDown.toFixed(1).replace('.', ',')} kgf/cm²` : '–';
    const key = [v.id, pc, moving, v.target, pd, v.note].join('|'); if (key === last) return; last = key;
    $('.pc').textContent = pc; $('.bar i').style.width = pc + '%';
    $('.mv').textContent = moving ? (v.target > v.open ? 'Abrindo… (volante no sentido anti-horário)' : 'Fechando… (volante no sentido horário)') : (pc === 0 ? 'Fechada' : pc === 100 ? 'Totalmente aberta' : 'Parcialmente aberta');
    $('.pl').textContent = v.pLabel || 'Pressão a jusante'; $('.pv').textContent = pd;
    el.querySelectorAll('button.k').forEach((b) => { const c = b.dataset.c; b.disabled = (c === 'open' || c === '+25') ? v.target >= 1 : v.target <= 0; });
    const n = $('.note'); n.hidden = !v.note; if (v.note) { n.textContent = v.note; n.classList.toggle('ok', !!v.noteOk); }
  }
  return { show, hide, refresh, get current() { return cur; }, el };
}
