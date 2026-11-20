// Orquestrador — dono: ORQUESTRADOR. Liga cena ↔ fornos ↔ forneira ↔ medidor/firmware ↔ modelo térmico ↔ áudio ↔ UI.
// Módulos carregados com import dinâmico protegido: um módulo quebrado não derruba o resto (erro aparece no console).
import * as THREE from 'three';
import * as N from './ibutg.js';
import * as CY from './cycle.js';
import { createHeatField, createSensors, AMB } from './thermal.js';
import { STATIONS as ST1, OVENS, TABLE, PRESENT, HALL, BENCH } from './layout.js';
import { STATIONS2, TABLE2, PRESENT2, HALL2, BOILERS, PIPES, LEAKS, CONTROL_ROOM, AMB2 } from './layout_caldeiras.js';
// Dois ambientes no mesmo mundo (caldeiras deslocadas em x). STATIONS reúne as estações dos dois.
const STATIONS = { ...ST1, ...STATIONS2 };
const ENVS = {
  fornos: { id: 'fornos', label: 'Sala de fornos — panificação industrial', short: 'Sala de fornos', worker: 'forneira', ref: 'ref',
    views: [['overview', 'Visão geral'], ['forno', 'Forno'], ['bancada', 'Bancada'], ['descanso', 'Descanso'], ['mesa', 'Mesa']],
    stations: ['forno', 'bancada', 'descanso'], TABLE, PRESENT, HALL, ta0: AMB.ta0 },
  caldeiras: { id: 'caldeiras', label: 'Casa de caldeiras', short: 'Caldeiras', worker: 'operadora de caldeira', ref: 'c_ref',
    views: [['c_overview', 'Visão geral'], ['caldeira', 'Caldeira'], ['valvulas', 'Válvulas'], ['controle', 'Sala de controle'], ['c_mesa', 'Mesa']],
    stations: ['caldeira', 'valvulas', 'controle'], TABLE: TABLE2, PRESENT: PRESENT2, HALL: HALL2, ta0: AMB2.ta0 },
};

const qs = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const boot = document.getElementById('boot');
const bootStep = (pct, txt) => { const b = document.getElementById('bootbar'), t = document.getElementById('bootst'); if (b) b.style.width = pct + '%'; if (t && txt) t.textContent = txt; };
const listeners = {};
const V = (a) => new THREE.Vector3(...a);
async function load(path) { try { return await import(path); } catch (e) { console.error(`[main] falha ao carregar ${path}:`, e); return null; } }
async function safe(name, fn) { try { return await fn(); } catch (e) { console.error(`[main] ${name}:`, e); return null; } }

const field = createHeatField();
const sensors = createSensors({ seed: +(qs.get('seed') || 3) });
sensors.soak(AMB.ta0 - 0.5);

const state = {
  phase: 'explorar',          // explorar | apresentacao | montagem | posicionar | medicao | cronometragem | resultado
  speed: +(qs.get('speed') || 60), // s simulados por s real enquanto a simulação da jornada corre
  clock: 6 * 3600 - 20 * 60,  // 05:40
  running: false,              // jornada/medição correndo em tempo acelerado
  station: 'kit',              // onde está o tripé: 'kit' (junto à mesa do avaliador) | chave de STATIONS | 'livre'
  meterHeight: 1.3,            // altura dos sensores (centro do globo) acima do piso, m
  water: 1, wick: 'limpo',     // reservatório (0..1) e pavio ('limpo' | 'sujo' | 'seco')
  globeOn: true,               // globo rosqueado no aparelho
  onTripod: true,              // aparelho montado no tripé
  doorHold: false,             // NHO-06 8.2: simular a condição (manter a porta do forno aberta) para permitir a estabilização
  followCycle: true,           // forneira segue o ciclo de trabalho (cycle.js) quando a simulação corre
  solar: false,
  env: ENVS[qs.get('env')] ? qs.get('env') : 'fornos', // 'fornos' | 'caldeiras'
};

const app = {
  THREE, N, CY, STATIONS, OVENS, TABLE, PRESENT, HALL, BENCH, state, field, sensors, ENVS, BOILERS, PIPES, LEAKS, CONTROL_ROOM, HALL2,
  /** ambiente ativo (registro com views, stations, TABLE, PRESENT, HALL) e ciclo de trabalho dele (mesma forma do cycle.js) */
  env: () => ENVS[state.env],
  cycle: () => CY.CYCLES[state.env],
  /** Troca de ambiente: módulos ouvem app.on('env') e mostram só o grupo ativo. */
  async setEnv(id, { view = true } = {}) {
    if (!ENVS[id] || id === state.env && app._envReady) return;
    state.env = id; app._envReady = true; const E = ENVS[id], C = CY.CYCLES[id];
    state.running = false; state.doorHold = false; if (field.doors.forno1 > 0) app.setDoor('forno1', false);
    anchors.presentDevice?.position.copy(V(E.PRESENT.device.pos)); if (anchors.presentDevice) anchors.presentDevice.rotation.y = E.PRESENT.device.rotY || 0;
    state.clock = C.SHIFT.start - 20 * 60; lastSeg = null;
    app.stage?.setEnv?.(id); app.emit('env', id);
    if (app.meter?.device && !state.onTripod) await app.mountOnTripod(0.01);
    await app.placeMeter('kit', { duration: 0 });
    sensors.soak(E.ta0 - 0.5);
    const seg = C.segmentAt(state.clock + 25 * 60);
    app.worker?.setStation?.(seg.station || E.stations[1], { instant: true, act: seg.act || 'A2' });
    if (view) app.stage?.setView?.(id === 'fornos' ? 'overview' : 'c_overview');
    app.emit('change');
  },
  stage: null, hall: null, machines: null, worker: null, meter: null, kit: null, fw: null, audio: null, ui: null,
  on(ev, fn) { (listeners[ev] ||= []).push(fn); return () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)); },
  emit(ev, d) { (listeners[ev] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } }); },
  setPhase(p) { state.phase = p; app.emit('phase', p); app.emit('change'); },
  setSpeed(s) { state.speed = s; app.emit('change'); },
  setView: (v, o) => app.stage?.setView(v, o),
  /** posição do centro do globo no mundo (ponto de medição real). */
  sensorWorld(out = new THREE.Vector3()) {
    const g = app.meter?.globeCenter; if (g) { g.updateWorldMatrix(true, false); return g.getWorldPosition(out); }
    const s = STATIONS[state.station], T = ENVS[state.env].TABLE; return s ? out.set(s.tripod[0], state.meterHeight, s.tripod[2]) : out.set(T.pos[0], 1.2, T.pos[2]);
  },
  /** valores de equilíbrio do campo térmico onde estão os sensores agora */
  fieldAtSensor() { const p = app.sensorWorld(tmpP); return field.at(p, { solar: state.solar }); },
  readings: () => sensors.read(),
  setDoor(id, open) { field.setDoor(id, open ? 1 : 0); app.machines?.setDoor?.(id, open ? 1 : 0); app.emit('door', { id, open: !!open }); },
  /** Painéis dos fornos: setpoint (SV) e liga/desliga; a temperatura real (PV) evolui em stepOvens. */
  setOvenSetpoint(id, v) { field.setSetpoint(id, v); app.emit('oven', { id }); app.emit('change'); },
  setOvenOn(id, b) { field.setOven(id, b); app.machines?.setOven?.(id, b); app.emit('oven', { id }); app.emit('change'); },
  oven: (id) => ({ id, pv: field.pv[id], sp: field.sp[id], on: field.on[id] !== false, label: OVENS.find((o) => o.id === id)?.label }),
  holdDoor(b) { state.doorHold = !!b; applyDoor(); app.emit('change'); },
  setWater(v) { state.water = v; app.meter?.setWater?.(v); app.emit('change'); },
  setWick(w) { state.wick = w; app.meter?.setWick?.(w); app.emit('change'); },
  wet: () => state.water > 0.05 && state.wick !== 'seco',
  setMeterHeight(h) { state.meterHeight = h; app.meter?.setHeight?.(h); app.emit('change'); },
  /** Leva o tripé com o medidor para um ponto de medição (ou 'kit'). Animação de voo + altura + orientação (face). */
  async placeMeter(id, { height, face, duration = 1.6 } = {}) {
    const m = app.meter; const s = STATIONS[id];
    const T = ENVS[state.env].TABLE;
    const pos = s ? V(s.tripod) : V([T.pos[0] + 0.75, 0, T.pos[2] + 0.1]);
    const rotY = face ?? (s ? s.face : 0);
    const h = height ?? (s ? s.chest : 1.3);
    state.station = id; app.emit('change');
    if (m?.rig) await flyRig(m.rig, pos, rotY, duration);
    app.setMeterHeight(h); app.emit('placed', id);
  },
  /** Aparelho (sem tripé) diante da câmera de apresentação, e de volta ao tripé. */
  async present(duration = 1.4) { const d = app.meter?.device; if (d) await flyObjectTo(d, anchors.presentDevice, duration); state.onTripod = false; app.emit('change'); },
  async mountOnTripod(duration = 1.4) { const m = app.meter; if (m?.device && m.mountPoint) await flyObjectTo(m.device, m.mountPoint, duration); state.onTripod = true; app.emit('change'); },
  /** Inicia/para a simulação acelerada (jornada da forneira + sensores + firmware). */
  run(b = true) { state.running = !!b; app.emit(b ? 'started' : 'paused'); app.emit('change'); },
  setClock(sec) { state.clock = sec; app.fw?.setClock?.(sec); app.emit('change'); },
  segment: () => CY.CYCLES[state.env].segmentAt(state.clock),
  results: () => app.fw?.results?.() ?? null,
  timeOfDay: () => state.clock,
  fmtClock: CY.fmtClock,
};
window.__sim = app;
const anchors = {};
const tmpP = new THREE.Vector3();

function applyDoor() {
  if (state.env !== 'fornos') return;
  const seg = CY.segmentAt(state.clock);
  const open = state.doorHold || (state.followCycle && state.running && seg.door);
  if ((field.doors.forno1 > 0.5) !== open) app.setDoor('forno1', open);
}

// ─── tweens ───
function flyObjectTo(obj, anchor, duration) {
  return new Promise((resolve) => {
    if (!obj || !anchor) return resolve();
    const scene = app.stage.scene;
    obj.updateWorldMatrix(true, true); scene.attach(obj);
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
    const p1 = new THREE.Vector3(), q1 = new THREE.Quaternion(), sc = new THREE.Vector3();
    let t = 0;
    const off = app.stage.onFrame((dt) => {
      anchor.updateWorldMatrix(true, false); anchor.matrixWorld.decompose(p1, q1, sc);
      t = Math.min(1, t + dt / Math.max(0.01, duration)); const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      obj.position.lerpVectors(p0, p1, e); obj.position.y += Math.sin(Math.PI * e) * 0.08;
      obj.quaternion.slerpQuaternions(q0, q1, e);
      if (t >= 1) { off?.(); anchor.attach(obj); obj.position.set(0, 0, 0); obj.quaternion.identity(); resolve(); }
    });
  });
}
function flyRig(rig, pos, rotY, duration) {
  return new Promise((resolve) => {
    const p0 = rig.position.clone(), r0 = rig.rotation.y; let dr = rotY - r0; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    if (duration <= 0.01) { rig.position.copy(pos); rig.rotation.y = r0 + dr; return resolve(); }
    let t = 0;
    const off = app.stage.onFrame((dt) => {
      t = Math.min(1, t + dt / duration); const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      rig.position.lerpVectors(p0, pos, e); rig.position.y = Math.sin(Math.PI * e) * 0.12; rig.rotation.y = r0 + dr * e;
      if (t >= 1) { off?.(); rig.position.copy(pos); resolve(); }
    });
  });
}

// ─── simulação (passos de 1 s simulado) ───
let simAcc = 0, lastMinute = -1, lastSeg = null;
function stepSimulation(dt) {
  const fw = app.fw;
  const nSec = state.running ? dt * state.speed : dt;
  simAcc += nSec;
  let n = Math.floor(simAcc); simAcc -= n; n = Math.min(n, 7200);
  const unsteady = state.station === 'forno' ? field.doors.forno1 * 0.6 : 0; // turbulência junto à porta aberta
  for (let i = 0; i < n; i++) {
    state.clock += 1;
    field.stepOvens(1);
    if (state.running) {
      const seg = CY.CYCLES[state.env].segmentAt(state.clock);
      if (state.followCycle && (!lastSeg || seg.act !== lastSeg.act || seg.station !== lastSeg.station)) {
        app.worker?.setStation?.(seg.station, { act: seg.act }); lastSeg = seg; app.emit('segment', seg);
      }
      applyDoor();
      if (state.clock >= CY.CYCLES[state.env].SHIFT.end) { state.running = false; app.emit('shiftEnd'); app.emit('change'); }
    }
    const eq = app.fieldAtSensor();
    const r = sensors.step(eq, 1, { wet: app.wet(), unsteady });
    fw?.feed?.(r, 1, state.clock);
    const minute = Math.floor(state.clock / 60);
    if (minute !== lastMinute) { lastMinute = minute; app.emit('minute', { clock: state.clock, read: r, station: state.station, eq }); }
  }
  fw?.setClock?.(state.clock);
  app.emit('tick');
}
function getInput() {
  const r = sensors.read();
  return { ...r, wet: app.wet(), battery: state.battery ?? 94, ambient: 'interno' };
}

// ─── boot ───
(async () => {
  bootStep(8, 'Preparando a cena…');
  const sceneMod = await load('./scene.js');
  if (!sceneMod) { bootStep(100, 'Erro ao carregar a cena'); return; }
  const stage = (app.stage = await sceneMod.createStage(canvas, { quality: qs.get('q') || 'high', app }));
  window.__stage = stage;
  const [hallM, machM, workM, meterM, fwM, audM, uiM] = await Promise.all(
    ['./hall.js', './machines.js', './worker.js', './meter.js', './firmware.js', './audio.js', './ui.js'].map(load));
  bootStep(28, 'Montando o setor de fornos…');
  app.hall = await safe('hall', () => hallM?.buildHall(stage, app));
  bootStep(44, 'Acendendo os fornos…');
  app.machines = await safe('machines', () => machM?.buildMachines(stage, app));
  bootStep(56, 'Ligando o medidor de IBUTG…');
  app.fw = await safe('firmware', () => fwM?.createFirmware({ app, getInput }));
  app.meter = await safe('meter', () => meterM?.buildMeter(stage, app.fw, app));
  app.kit = await safe('kit', () => meterM?.buildKit?.(stage, app));
  bootStep(68, 'Chamando a forneira…');
  app.worker = await safe('worker', () => workM?.buildWorker(stage, app));
  bootStep(74, 'Acendendo as caldeiras…');
  const caldM = await load('./cald.js');
  app.cald = await safe('cald', () => caldM?.buildCaldeiras?.(stage, app));
  const propsM = await load('./props.js');
  bootStep(78, 'Detalhes da sala…');
  app.props = await safe('props', () => propsM?.buildProps?.(stage, app));
  bootStep(84, 'Ajustando o som…');
  app.audio = await safe('audio', () => audM?.createAudio(stage, app));
  const o = new THREE.Object3D(); o.name = 'presentDevice'; const PD = ENVS[state.env].PRESENT.device; o.position.copy(V(PD.pos)); o.rotation.y = PD.rotY || 0; stage.scene.add(o); anchors.presentDevice = o;
  app.anchors = anchors;

  stage.onFrame((dt, t) => {
    stepSimulation(dt);
    app.machines?.update?.(dt, t); app.worker?.update?.(dt, t); app.fw?.update?.(dt);
    app.meter?.update?.(dt, t); app.kit?.update?.(dt, t); app.hall?.update?.(dt, t); app.props?.update?.(dt, t); app.cald?.update?.(dt, t); app.audio?.update?.(dt, t);
  });

  bootStep(94, 'Quase pronto…');
  app.ui = await safe('ui', () => uiM?.createUI(document.getElementById('ui'), app));
  const ovM = await load('./ui_oven.js'); app.ovenPanel = await safe('ui_oven', () => ovM?.createOvenPanel?.(app));
  // atalhos de captura/teste: ?st=forno|bancada|descanso (tripé no ponto), ?door=1 (porta do forno 1 aberta),
  // ?t=HH:MM (relógio), ?run=1 (simulação correndo), ?on=1 (medidor ligado), ?present=1 (aparelho na vitrine), ?worker=forno|bancada|descanso
  if (state.env !== 'fornos') { const e = state.env; state.env = 'fornos'; await app.setEnv(e, { view: false }); }
  if (qs.get('st')) await app.placeMeter(qs.get('st'), { duration: 0 });
  else await app.placeMeter('kit', { duration: 0 });
  if (qs.get('door') === '1') app.holdDoor(true);
  if (qs.get('t')) { const [h, m] = qs.get('t').split(':').map(Number); state.clock = h * 3600 + (m || 0) * 60; }
  const ws = qs.get('worker') || app.cycle().segmentAt(state.clock).station || ENVS[state.env].stations[1];
  const actOf = { forno: 'A1', bancada: 'A2', descanso: 'A3', caldeira: 'A1', valvulas: 'A2', controle: 'A3' };
  app.worker?.setStation?.(ws, { instant: true, act: actOf[ws] });
  if (qs.get('on') === '1') app.fw?.quickStart?.();
  if (qs.get('present') === '1') await app.present(0.01);
  if (qs.get('run') === '1') app.run(true);
  if (qs.get('soak') === '1') sensors.reset(app.fieldAtSensor());
  stage.setView(qs.get('cam') || ENVS[state.env].ref);
  app._envReady = true;
  if (qs.get('ui') === '0') document.getElementById('ui').style.display = 'none';
  bootStep(100, 'Pronto');
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))));
  boot.style.opacity = 0; boot.style.pointerEvents = 'none'; setTimeout(() => boot.remove(), 700);
  app.emit('ready'); app.emit('change');
})();
