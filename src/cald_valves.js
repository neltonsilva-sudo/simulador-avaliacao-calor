// VÁLVULAS do distribuidor de vapor (casa de caldeiras, ambiente 2): clique num volante → painel com TAG, abertura (%),
// Abrir/Fechar/±25 %. O volante gira (sentido horário para fechar, várias voltas proporcionais ao curso), a haste sobe/desce;
// o bloqueio do purgador comanda app.setLeak('purgador', …) (o IBUTG percebe a umidade), a purga de fundo solta um jato curto
// de água/vapor no ralo, e os manômetros a jusante caem quando a válvula fecha. Volantes vêm de app.cald.valves (dono: CALDEIRAS).
// Uso: createValves(app) → { valves, set(id, open), open(id), close(id), select(id), update(dt), dispose() }
import * as THREE from 'three';
import { LEAKS } from './layout_caldeiras.js';
import { createValvePanel } from './cald_valves_ui.js';
import { createPurgeJet } from './cald_valves_fx.js';

const P0 = 9.6; // kgf/cm² — pressão de trabalho do coletor
const INFO = {
  'V-01': { tag: 'VG-101', name: 'Bloqueio geral do distribuidor — alimentação de vapor das caldeiras', pLabel: 'Pressão no coletor', role: 'supply' },
  'V-02': { tag: 'VG-102', name: 'Saída de vapor para o processo 1', pLabel: 'Pressão a jusante' },
  'V-03': { tag: 'VG-103', name: 'Saída de vapor para o processo 2', pLabel: 'Pressão a jusante' },
  'V-04': { tag: 'VG-104', name: 'Saída de vapor para o trocador de calor', pLabel: 'Pressão a jusante' },
  'V-07': { tag: 'VGL-107', name: 'Bloqueio a montante do purgador (gaxeta vazando)', pLabel: 'Pressão na linha do purgador' },
  'V-PURGA': { tag: 'VP-108', name: 'Purga de fundo do coletor — descarga no ralo', pLabel: 'Pressão no coletor' },
};
const KIND = { gaveta: ['Válvula gaveta', 'VG', 7, 'os'], globo: ['Válvula globo', 'VGL', 4, 'rise'], purga: ['Válvula de purga', 'VP', 2, 'rise'] };
const eff = (kind, o) => (kind === 'gaveta' ? 1 - Math.pow(1 - o, 3) : kind === 'purga' ? Math.min(1, o * 1.6) : o);
const ease = (x) => x * x * (3 - 2 * x);

export function createValves(app) {
  const stage = app.stage, cv = stage.canvas, cam = stage.camera;
  const root = new THREE.Group(); root.name = 'cald_valves'; (app.cald?.group || stage.scene).add(root);
  const M = app.cald?.ctx?.M || {};
  const stemMat = M.chrome || new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.15 });
  const stemGeo = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0);
  const V = [];
  let pCol = P0, nextId = 101;

  function adopt(src) {
    if (V.some((v) => v.id === src.id)) return;
    const g = src.group || app.cald?.group?.getObjectByName('volante:' + src.id); if (!g) return;
    const wheel = g.children[0], nut = g.children[1];
    const kind = KIND[src.kind] ? src.kind : 'globo';
    const [typeName, pre, turns, stemMode] = KIND[kind];
    const info = INFO[src.id] || { tag: `${pre}-${nextId++}`, name: src.label || 'Válvula do distribuidor de vapor', pLabel: 'Pressão a jusante' };
    const rw = wheel ? wheel.scale.x : 0.12, sr = nut ? nut.scale.x / 3 : 0.01;
    const open0 = kind === 'purga' ? 0 : 1;
    const v = {
      id: src.id, src, g, wheel, kind, typeName, turns, stemMode, rw, ...info, leak: src.leak || null,
      wheelColor: wheel && wheel.material === M.wheelBlueI ? 'blue' : 'red',
      open: open0, open0, target: open0, anim: null, angle: 0, pDown: kind === 'purga' || info.role === 'supply' ? P0 : P0 * 0.97, needles: [],
      basePos: g.position.clone(), baseQuat: g.quaternion.clone(), axis: Array.isArray(src.axis) ? new THREE.Vector3(...src.axis) : (src.axis || g.userData.axis || new THREE.Vector3(0, 1, 0)).clone(),
      stroke: stemMode === 'os' ? Math.min(0.26, rw * 0.8) : kind === 'purga' ? 0.012 : Math.min(0.05, rw * 0.25),
      purgeT: 0,
    };
    if (stemMode === 'os') { // haste ascendente (OS&Y): o volante fica no lugar e a haste rosqueada aparece acima dele
      v.stem = new THREE.Mesh(stemGeo, stemMat); v.stem.scale.set(sr * 0.95, 0.03 + v.stroke * v.open, sr * 0.95); v.stem.castShadow = true; g.add(v.stem);
    }
    V.push(v);
  }
  function scan() { for (const s of app.cald?.valves || []) adopt(s); bindNeedles(); }

  // manômetros/termômetros: os do corpo do coletor seguem a pressão do coletor (V-01); outros, a válvula mais próxima a montante
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  let colNeedles = [];
  function bindNeedles() {
    const N = app.cald?.ctx?.needles || []; colNeedles = [];
    for (const n of N) {
      if (n._vl) continue; n.n.getWorldPosition(tmp);
      const onCol = Math.abs(tmp.x - 47.5) < 4.2 && Math.abs(tmp.z + 8.4) < 0.7 && tmp.y < 2.6;
      if (onCol) { n._vl = { v0: n.v, temp: n.v > 30 }; colNeedles.push(n); continue; }
      let best = null, bd = 0.8;
      for (const v of V) { if (v.kind === 'purga' || v.role === 'supply') continue; v.g.getWorldPosition(tmp2); const d = tmp.distanceTo(tmp2); if (d < bd) { bd = d; best = v; } }
      if (best) { n._vl = { v0: n.v, temp: n.v > 30 }; best.needles.push(n); }
    }
  }
  scan();

  // ───── comandos ─────
  function set(v, target) {
    if (typeof v === 'string') v = V.find((q) => q.id === v); if (!v) return;
    target = Math.max(0, Math.min(1, Math.round(target * 100) / 100)); if (Math.abs(target - v.target) < 1e-3 && !v.anim) return;
    const d = Math.abs(target - v.open), dur = Math.max(2, Math.min(4, 1.5 + 2.5 * d));
    if (v.kind === 'purga' && v.open < 0.02 && target > v.open) v.purgeT = 0;
    v.target = target; v.anim = { from: v.open, to: target, t: 0, dur };
    try { app.audio?.beep?.('key'); } catch (e) { /* áudio opcional */ }
    panel.refresh();
  }
  const panel = createValvePanel({
    onCmd(v, c) { set(v, c === 'open' ? 1 : c === 'close' ? 0 : v.target + (c === '+25' ? 0.25 : -0.25)); },
  });

  // ───── seleção (raycast contra o disco do volante; clique ≠ arrasto) ─────
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new THREE.Vector3(), c0 = new THREE.Vector3(), ax = new THREE.Vector3();
  const active = () => app.state.env === 'caldeiras' && (!app.cald?.group || app.cald.group.visible);
  function pick(e) {
    const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam); let best = null, bt = Infinity;
    for (const v of V) {
      v.g.getWorldPosition(c0); ax.set(0, 1, 0).applyQuaternion(v.g.getWorldQuaternion(new THREE.Quaternion()));
      plane.setFromNormalAndCoplanarPoint(ax, c0);
      if (!ray.ray.intersectPlane(plane, hitP)) continue;
      const t = ray.ray.origin.distanceTo(hitP); if (t > 14) continue;
      if (hitP.distanceTo(c0) < Math.max(v.rw * 1.25, 0.07) && t < bt) { bt = t; best = v; }
    }
    return best;
  }
  let hover = null, setCursor = false, down = null;
  function highlight(v) {
    if (hover === v) return;
    if (hover?.wheel && hover._mat) { hover.wheel.material.dispose(); hover.wheel.material = hover._mat; hover._mat = null; }
    hover = v;
    if (v?.wheel) { v._mat = v.wheel.material; const m = v._mat.clone(); m.emissive = new THREE.Color(0xffc890); m.emissiveIntensity = 0.2; v.wheel.material = m; }
    if (v) { cv.style.cursor = 'pointer'; setCursor = true; } else if (setCursor) { cv.style.cursor = ''; setCursor = false; }
  }
  const onMove = (e) => { if (!active() || e.buttons) { if (!active()) highlight(null); return; } if (!V.length) scan(); highlight(pick(e)); };
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e) => {
    if (!down || !active()) return; const d = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (d > 6 || dt > 600) return;
    if (!V.length) scan();
    const v = pick(e); if (v) { panel.show(v, e.clientX, e.clientY); highlight(v); }
  };
  cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointerup', onUp);
  const offEnv = app.on?.('env', (id) => { if (id !== 'caldeiras') { panel.hide(); highlight(null); } else scan(); });

  // ───── efeitos ─────
  const drainE = () => app.cald?.steam?.emitters?.find((e) => e.id === 'dreno');
  const drainPos = app.cald?.ctx?.emitters?.dreno?.pos || new THREE.Vector3(49.4, 0.08, -8.84);
  const jet = createPurgeJet(root, drainPos.clone().setY(Math.max(0.05, drainPos.y)));
  const leakBase = Object.fromEntries(LEAKS.map((l) => [l.id, l.rate]));
  let leakSent = {}, leakT = 0;
  const qy = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);

  function update(dt) {
    if (!active()) return; dt = Math.min(dt, 0.1);
    const sup = V.find((v) => v.role === 'supply');
    // pressão do coletor (alimentação pelo VG-101): cai quando o bloqueio geral fecha, volta quando abre
    const pColT = P0 * (sup ? eff(sup.kind, sup.open) : 1);
    pCol += (pColT - pCol) * (1 - Math.exp(-dt / (pColT < pCol ? 2.2 : 1.2)));
    let moving = false;
    for (const v of V) {
      if (v.anim) {
        const a = v.anim; a.t += dt; const k = Math.min(1, a.t / a.dur);
        v.open = a.from + (a.to - a.from) * ease(k); moving = true;
        if (k >= 1) { v.open = a.to; v.anim = null; }
      }
      // volante: anti-horário (visto de frente) abre, horário fecha
      v.angle = v.turns * Math.PI * 2 * (v.open - v.open0);
      v.g.quaternion.copy(v.baseQuat).multiply(qy.setFromAxisAngle(Y, v.angle));
      if (v.stemMode === 'os') v.stem.scale.y = 0.03 + v.stroke * v.open;
      else v.g.position.copy(v.basePos).addScaledVector(v.axis, v.stroke * (v.open - v.open0));
      if (v.role === 'supply' || v.kind === 'purga') v.pDown = pCol;
      else { const t = pCol * eff(v.kind, v.open); v.pDown += (t - v.pDown) * (1 - Math.exp(-dt / (t < v.pDown ? 1.6 : 0.9))); }
      for (const n of v.needles) n.v = n._vl.temp ? 100 + (n._vl.v0 - 100) * Math.sqrt(Math.max(0, v.pDown / P0)) : n._vl.v0 * v.pDown / P0;
      v.note = null; v.noteOk = false;
      if (v.leak) {
        v.note = v.open < 0.02 ? 'Bloqueio para manutenção do purgador — linha isolada, o vazamento de vapor parou.' : 'Bloqueio para manutenção do purgador: feche para isolar a gaxeta que vaza vapor.';
        v.noteOk = v.open < 0.02;
      } else if (v.role === 'supply' && v.open < 0.98) v.note = 'Coletor sem alimentação: a pressão do distribuidor e de todas as saídas cai.';
      else if (v.kind === 'purga') v.note = v.open > 0.02 ? 'Purga aberta: condensado e vapor descarregando no ralo.' : 'Purga de fundo: abra por alguns segundos para drenar o condensado do coletor.';
    }
    for (const n of colNeedles) {
      const f = Math.max(0, pCol / P0);
      if (n._vl.temp) { const tT = 100 + (n._vl.v0 - 100) * Math.sqrt(f); n.v += (tT - n.v) * (1 - Math.exp(-dt / 25)); } else n.v = n._vl.v0 * f;
    }
    // vazamento na gaxeta: só existe com pressão na linha (bloqueio do purgador aberto e coletor pressurizado)
    if ((leakT -= dt) <= 0) {
      leakT = 0.1;
      for (const v of V) if (v.leak && leakBase[v.leak] != null) {
        const r = Math.round(leakBase[v.leak] * Math.max(0, v.pDown / P0) * 100) / 100;
        if (leakSent[v.leak] !== r) { leakSent[v.leak] = r; app.setLeak?.(v.leak, r); }
      }
    }
    // purga de fundo: golfada de condensado nos primeiros segundos, depois vapor de flash; volta ao gotejamento quando fecha
    const pg = V.find((v) => v.kind === 'purga');
    if (pg) {
      const o = pg.open > 0.02 ? eff('purga', pg.open) * Math.max(0, pCol / P0) : 0;
      if (o > 0) pg.purgeT += dt;
      const water = o * (0.12 + 0.88 * Math.exp(-pg.purgeT / 2.8));
      jet.update(dt, water);
      const e = drainE(); if (e) e.on = 1 + o * (6 + 10 * (1 - Math.exp(-pg.purgeT / 1.5)));
    } else jet.update(dt, 0);
    if (panel.current) panel.refresh();
  }
  const offFrame = stage.onFrame?.((dt) => update(dt));

  const api = {
    get valves() { return V; }, root, panel,
    set: (id, o) => set(id, o), open: (id) => set(id, 1), close: (id) => set(id, 0),
    select(id) { const v = V.find((q) => q.id === id || q.tag === id); if (!v) return null; v.g.updateWorldMatrix(true, false); v.g.getWorldPosition(tmp).project(cam); panel.show(v, (tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight); highlight(v); return v; },
    state: () => Object.fromEntries(V.map((v) => [v.tag, Math.round(v.open * 100)])), get pCol() { return pCol; }, update,
    dispose() { cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointerup', onUp); offFrame?.(); offEnv?.(); highlight(null); panel.el.remove(); root.removeFromParent(); },
  };
  return api;
}
