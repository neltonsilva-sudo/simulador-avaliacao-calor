// Painéis funcionais dos fornos — clique num controlador (3D) abre o painel: PV (temperatura real da câmara), SV (setpoint),
// ajuste ▲▼, liga/desliga. A física (thermal.js) faz a câmara aquecer ~8 °C/min ou esfriar ~3 °C/min em tempo simulado,
// e o calor radiante que chega ao globo do medidor acompanha a temperatura real.
import * as THREE from 'three';

const CSS = `
.ovp{position:fixed;z-index:60;width:280px;padding:14px 16px 16px;border-radius:16px;background:rgba(14,16,19,.86);backdrop-filter:blur(14px);
 -webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.45);color:#e8eaed;font:500 13px Inter,system-ui,sans-serif}
.ovp h3{margin:0 26px 2px 0;font:700 14px Inter,system-ui;letter-spacing:.01em}
.ovp .sub{color:#9aa0a6;font-size:11.5px;margin-bottom:10px}
.ovp .x{position:absolute;right:10px;top:8px;border:0;background:none;color:#9aa0a6;font-size:20px;cursor:pointer}
.ovp .row{display:flex;align-items:center;justify-content:space-between;background:#050606;border-radius:10px;padding:8px 12px;margin:6px 0}
.ovp .lb{font:600 10.5px Inter;letter-spacing:.12em;color:#8b9096;text-transform:uppercase}
.ovp .v{font:700 34px "Roboto Mono",monospace;letter-spacing:.02em}
.ovp .pv{color:#ff3a2a;text-shadow:0 0 12px rgba(255,58,42,.45)} .ovp .sv{color:#3cff58;text-shadow:0 0 12px rgba(60,255,88,.4)}
.ovp .btns{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.ovp button.k{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#e8eaed;border-radius:9px;padding:8px 0;font:700 13px Inter;cursor:pointer}
.ovp button.k:hover{background:rgba(255,255,255,.14)}
.ovp .pw{margin-top:8px;width:100%;border-radius:9px;padding:8px 0;font:700 13px Inter;cursor:pointer;border:0}
.ovp .pw.on{background:#c62f22;color:#fff}.ovp .pw.off{background:#2b8a3e;color:#fff}
.ovp .st{margin-top:8px;font-size:11.5px;color:#c9ccd1;line-height:1.4}
.ovp .bar{height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:6px}.ovp .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff7a2a,#ff3a2a)}
`;

export function createOvenPanel(app) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const cv = app.stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let box = null, cur = null, down = null;
  const meshes = () => (app.machines?.ctrls || []).map((c) => c.mesh).filter((m) => m && m.visible !== false);
  const pick = (e) => {
    const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, app.stage.camera); const hit = ray.intersectObjects(meshes(), false)[0];
    if (!hit || hit.distance > 7) return null; return (app.machines.ctrls || []).find((c) => c.mesh === hit.object) || null;
  };
  cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; down = null;
    if (app.state.env !== 'fornos') return;
    const c = pick(e); if (c) open(c.id, c.k, e.clientX, e.clientY);
  });
  cv.addEventListener('pointermove', (e) => { if (app.state.env !== 'fornos' || e.buttons) return; cv.style.cursor = pick(e) ? 'pointer' : ''; });

  function open(id, k, x, y) {
    close(); cur = id; const o = app.oven(id);
    box = document.createElement('div'); box.className = 'ovp';
    box.innerHTML = `<button class="x" title="Fechar">×</button><h3>${o.label || id}</h3>
      <div class="sub">Controlador${k ? ` — câmara ${k + 1}` : ''} · temperatura em °C</div>
      <div class="row"><span class="lb">PV · câmara</span><span class="v pv" data-pv></span></div>
      <div class="row"><span class="lb">SV · ajuste</span><span class="v sv" data-sv></span></div>
      <div class="btns"><button class="k" data-d="-10">−10</button><button class="k" data-d="-5">−5</button><button class="k" data-d="5">+5</button><button class="k" data-d="10">+10</button></div>
      <button class="pw" data-pw></button><div class="bar"><i data-bar></i></div><div class="st" data-st></div>`;
    document.body.appendChild(box);
    const W = 280, H = 330; box.style.left = Math.max(12, Math.min(innerWidth - W - 12, x + 16)) + 'px'; box.style.top = Math.max(12, Math.min(innerHeight - H - 12, y - 120)) + 'px';
    box.querySelector('.x').onclick = close;
    box.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { const o2 = app.oven(cur); app.setOvenSetpoint(cur, o2.sp + +b.dataset.d); render(); }));
    box.querySelector('[data-pw]').onclick = () => { const o2 = app.oven(cur); app.setOvenOn(cur, !o2.on); render(); };
    render();
  }
  function render() {
    if (!box || !cur) return; const o = app.oven(cur), pv = Math.round(o.pv), sv = Math.round(o.sp);
    box.querySelector('[data-pv]').textContent = o.on || pv > 40 ? pv : '—';
    box.querySelector('[data-sv]').textContent = o.on ? sv : '—';
    const pw = box.querySelector('[data-pw]'); pw.textContent = o.on ? 'Desligar o forno' : 'Ligar o forno'; pw.className = 'pw ' + (o.on ? 'on' : 'off');
    const tgt = o.on ? sv : 30, d = tgt - pv;
    box.querySelector('[data-bar]').style.width = Math.max(2, Math.min(100, (pv / 300) * 100)) + '%';
    box.querySelector('[data-st]').textContent = Math.abs(d) < 2 ? (o.on ? 'Temperatura estabilizada no ajuste.' : 'Forno desligado e frio.')
      : `${d > 0 ? 'Aquecendo' : 'Esfriando'}: faltam ${Math.abs(d)} °C (≈ ${Math.ceil(Math.abs(d) / (d > 0 ? 8 : 3))} min de jornada; acelere com a simulação). O calor radiante no medidor acompanha a câmara.`;
  }
  function close() { box?.remove(); box = null; cur = null; }
  app.on('tick', render); app.on('env', close);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { open, close };
}
