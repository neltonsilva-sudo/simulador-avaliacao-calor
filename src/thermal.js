// Modelo térmico do setor de fornos + resposta dos sensores — dono: ORQUESTRADOR.
// Campo: ta (ar), e (pressão de vapor, kPa), va (m/s) e temperatura radiante média tr calculada pelos fatores de forma
// (ângulo sólido exato de retângulos / 4π, visto por uma esfera) das portas e frentes dos fornos.
// tg de equilíbrio pelo balanço do globo da ISO 7726 (Ø 0,1524 m, ε 0,95, convecção forçada/natural);
// tbn por bulbo úmido psicrométrico + correções de bulbo NATURAL (pouca ventilação e radiação sobre o pavio).
import { OVENS, HALL, STATIONS, FAN, ovenFrontZ } from './layout.js';
import { BOILERS, PIPES, LEAKS, CONTROL_ROOM, AMB2, isCaldeiras } from './layout_caldeiras.js';

export const AMB = { ta0: 28.0, e: 1.85, P: 101.3, wallT: 30.0, gradY: 0.6 };
const K = 273.15;
export const es = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3)); // kPa

/** Ângulo sólido de um retângulo [x1,x2]×[y1,y2] num plano a distância d (coordenadas relativas ao pé da normal). */
function rectSolidAngle(x1, x2, y1, y2, d) {
  const f = (x, y) => Math.atan((x * y) / (d * Math.sqrt(x * x + y * y + d * d)));
  return f(x2, y2) - f(x1, y2) - f(x2, y1) + f(x1, y1);
}

/** Fator de forma esfera→cilindro (aprox.: silhueta retangular L × 2R voltada para o ponto) + tampos se visíveis. */
function cylF(p, c) {
  const A = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[c.axis];
  const v = [p.x - c.c[0], p.y - c.c[1], p.z - c.c[2]];
  const along = v[0] * A[0] + v[1] * A[1] + v[2] * A[2];
  const perp = Math.hypot(v[0] - along * A[0], v[1] - along * A[1], v[2] - along * A[2]);
  const d = Math.max(0.05, perp - c.R);
  let F = rectSolidAngle(-c.L / 2 - along, c.L / 2 - along, -c.R, c.R, d) / (4 * Math.PI);
  // tampo visível (ponto além da extremidade, dentro do "cone" do tampo)
  const ends = []; const out = Math.abs(along) - c.L / 2;
  if (out > 0.02) ends.push({ side: Math.sign(along), F: rectSolidAngle(-c.R * 0.89 - perp, c.R * 0.89 - perp, -c.R * 0.89, c.R * 0.89, out) / (4 * Math.PI) });
  return { F, ends };
}

/** Estado das fontes: doors[id] = abertura 0..1 (por forno; lastro usa a mesma para as 3 câmaras). */
export function createHeatField() {
  const doors = Object.fromEntries(OVENS.map((o) => [o.id, 0]));
  const on = Object.fromEntries(OVENS.map((o) => [o.id, true]));
  // controladores dos fornos: SV = setpoint ajustado no painel; PV = temperatura real da câmara (1ª ordem: aquece ~8 °C/min,
  // esfria ~3 °C/min, perde calor com a porta aberta). As superfícies (vidro/chapa) e o ar acompanham PV.
  const sp = Object.fromEntries(OVENS.map((o) => [o.id, o.setpoint]));
  const pv = Object.fromEntries(OVENS.map((o) => [o.id, o.setpoint]));
  const heatK = (o) => Math.max(0, (pv[o.id] - AMB.wallT) / (o.setpoint - AMB.wallT)); // 1 = condição de projeto
  let fanOn = true;

  function inControl(p) { const C = CONTROL_ROOM; return p.x > C.x0 && p.x < C.x1 && p.z > C.z0 && p.z < C.z1; }
  function radiant2(p) { // casa de caldeiras
    if (inControl(p)) return { tr: CONTROL_ROOM.ta + 1.2, F: 0, parts: [] };
    let sumF = 0, sum4 = 0; const parts = [];
    for (const b of [...BOILERS, ...PIPES]) {
      const T = (b.shellT ?? b.T) + K; const r = cylF(p, b);
      sumF += r.F; sum4 += r.F * T ** 4; parts.push({ id: b.id, F: r.F });
      for (const e of r.ends) { const Te = (b.front && e.side === b.front.side ? b.front.T : (b.shellT ?? b.T)) + K; sumF += e.F; sum4 += e.F * Te ** 4; parts.push({ id: b.id + ':tampo', F: e.F }); }
    }
    const tr4 = sum4 + (1 - sumF) * (AMB2.wallT + K) ** 4;
    return { tr: tr4 ** 0.25 - K, F: sumF, parts };
  }
  function air2(p) {
    if (inControl(p)) { const C = CONTROL_ROOM; return { ta: C.ta, e: 1.7, va: C.va, rh: Math.min(1, 1.7 / es(C.ta)) }; }
    let ta = AMB2.ta0 + AMB2.gradY * (p.y - 1.1), e = AMB2.e, va = 0.25;
    for (const b of BOILERS) { const r = Math.max(0, Math.hypot(p.x - b.c[0], p.z - b.c[2]) - (b.axis === 'y' ? b.R : b.R + (b.axis === 'z' ? 0 : 0)));
      const ext = b.axis === 'y' ? 0 : b.L / 2; const ax = b.axis === 'z' ? Math.abs(p.z - b.c[2]) : b.axis === 'x' ? Math.abs(p.x - b.c[0]) : 0;
      const rr = b.axis === 'z' ? Math.hypot(Math.max(0, Math.abs(p.x - b.c[0]) - b.R), Math.max(0, ax - ext)) : b.axis === 'x' ? Math.hypot(Math.max(0, Math.abs(p.z - b.c[2]) - b.R), Math.max(0, ax - ext)) : r;
      ta += 2.6 * Math.exp(-rr / 2.2); }
    for (const l of LEAKS) { const r = Math.hypot(p.x - l.pos[0], p.y - l.pos[1], p.z - l.pos[2]);
      e += 1.1 * l.rate * Math.exp(-r / 1.6); ta += 2.0 * l.rate * Math.exp(-r / 1.4); va += 0.15 * l.rate * Math.exp(-r / 1.2); }
    e = Math.min(e, 0.92 * es(ta));
    return { ta, e, va, rh: Math.min(1, e / es(ta)) };
  }
  function radiant(p) { // p: {x,y,z} → { tr (°C), F (fator total das fontes), parts }
    if (isCaldeiras(p)) return radiant2(p);
    let sumF = 0, sum4 = 0; const parts = [];
    const Tw4 = (AMB.wallT + K) ** 4;
    for (const o of OVENS) {
      const zf = ovenFrontZ(o), d = p.z - zf;
      if (d <= 0.02) continue;
      const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2;
      const Ffront = rectSolidAngle(x0 - p.x, x1 - p.x, 0 - p.y, o.h - p.y, d) / (4 * Math.PI);
      const hk = heatK(o), Tf = AMB.wallT + (o.frontT - AMB.wallT) * hk + K;
      let F = Ffront, s4 = Ffront * Tf ** 4;
      for (const dr of o.doors) {
        const dx0 = o.x + dr.cx - dr.w / 2, dx1 = o.x + dr.cx + dr.w / 2;
        const Fd = rectSolidAngle(dx0 - p.x, dx1 - p.x, dr.y0 - p.y, dr.y0 + dr.h - p.y, d) / (4 * Math.PI);
        const open = doors[o.id];
        const Tin = pv[o.id] + (on[o.id] ? 8 : 0) + K; // cavidade vista pela abertura (paredes e resistências um pouco acima do ar de cocção)
        const Tg = AMB.wallT + (o.glassT - AMB.wallT) * hk + K;
        const Td4 = open * Tin ** 4 + (1 - open) * Tg ** 4;
        s4 += Fd * (Td4 - Tf ** 4); // a porta substitui a parte correspondente da chapa
        parts.push({ id: o.id, F: Fd, open });
      }
      sumF += F; sum4 += s4;
    }
    const tr4 = sum4 + (1 - sumF) * Tw4;
    return { tr: tr4 ** 0.25 - K, F: sumF, parts };
  }

  function air(p) {
    if (isCaldeiras(p)) return air2(p);
    let ta = AMB.ta0 + AMB.gradY * (p.y - 1.1);
    let e = AMB.e, va = 0.18;
    for (const o of OVENS) {
      const zf = ovenFrontZ(o);
      const dx = Math.max(0, Math.abs(p.x - o.x) - o.w / 2), dz = Math.max(0, p.z - zf);
      const r = Math.hypot(dx, dz);
      const open = doors[o.id];
      const base = 0.4 + 2.8 * heatK(o);
      ta += base * Math.exp(-r / 2.4) + 6.5 * open * Math.exp(-r / 1.1) * (p.y > 0.6 ? 1 : 0.6);
      e += 0.45 * open * Math.exp(-r / 1.3); // vapor/umidade que sai do forno (vaporização da massa)
      va += 0.22 * open * Math.exp(-r / 1.2); // corrente de convecção junto à porta aberta
    }
    if (fanOn) {
      const r = Math.hypot(p.x - FAN.pos[0], p.z - FAN.pos[2]);
      va += FAN.va * Math.exp(-r / 1.8);
      ta -= 0.6 * Math.exp(-r / 2.5);
    }
    return { ta, e, va, rh: Math.min(1, e / es(ta)) };
  }

  /** Temperatura de globo de equilíbrio (ISO 7726): (tg+273)^4 + h(tg−ta)/εσ ... resolvida por bissecção. */
  function globeEq(ta, tr, va) {
    const eps = 0.95, D = 0.1524;
    const g = (tg) => {
      const forced = 1.1e8 * va ** 0.6 / (eps * D ** 0.4);
      const natural = 0.25e8 / eps * (Math.abs(tg - ta) / D) ** 0.25;
      return (tg + K) ** 4 + Math.max(forced, natural) * (tg - ta) - (tr + K) ** 4;
    };
    let a = Math.min(ta, tr) - 1, b = Math.max(ta, tr) + 1;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (g(m) > 0) b = m; else a = m; }
    return (a + b) / 2;
  }

  /** Bulbo úmido psicrométrico (aspirado) por bissecção: e = es(tw) − γ P (ta − tw). */
  function wetBulb(ta, e) {
    const gam = 6.6e-4;
    let a = -10, b = ta;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (es(m) - gam * AMB.P * (ta - m) > e) b = m; else a = m; }
    return (a + b) / 2;
  }
  /** Bulbo úmido NATURAL: sem aspiração fica mais alto que o psicrométrico; a radiação sobre o pavio eleva mais um pouco. */
  function naturalWet(ta, e, va, tg) {
    const tw = wetBulb(ta, e);
    const kv = 0.03 + 0.12 * Math.max(0, 1 - Math.min(va, 1.5) / 1.5);
    return tw + kv * (ta - tw) + 0.06 * Math.max(0, tg - ta);
  }

  /** Valores de EQUILÍBRIO num ponto (o que sensores ideais indicariam após estabilizar). */
  function at(p, { solar = false } = {}) {
    const A = air(p), R = radiant(p);
    const tg = globeEq(A.ta, R.tr, A.va);
    const tbn = naturalWet(A.ta, A.e, A.va, tg);
    const ib = solar ? 0.7 * tbn + 0.2 * tg + 0.1 * A.ta : 0.7 * tbn + 0.3 * tg;
    return { ta: A.ta, tbs: A.ta, rh: A.rh, e: A.e, va: A.va, tr: R.tr, F: R.F, tg, tbn, ibutg: ib };
  }

  return {
    doors, on, at, radiant, air, globeEq, wetBulb, naturalWet,
    setDoor(id, open) { if (id in doors) doors[id] = Math.max(0, Math.min(1, +open)); },
    setOven(id, b) { if (id in on) on[id] = !!b; },
    sp, pv,
    setSetpoint(id, v) { if (id in sp) sp[id] = Math.max(0, Math.min(300, Math.round(v))); },
    /** avança a temperatura real das câmaras dt segundos simulados */
    stepOvens(dt) {
      for (const o of OVENS) { const id = o.id, tgt = on[id] ? sp[id] : AMB.wallT;
        const r = tgt > pv[id] ? 8 / 60 : 3 / 60; const d = tgt - pv[id];
        pv[id] += Math.sign(d) * Math.min(Math.abs(d), r * dt * (Math.abs(d) < 6 ? Math.max(0.25, Math.abs(d) / 6) : 1));
        pv[id] -= doors[id] * (on[id] ? 0.6 : 1.2) / 60 * dt * Math.max(0, (pv[id] - AMB.wallT) / 150); }
    },
    setFan(b) { fanOn = !!b; }, get fanOn() { return fanOn; },
  };
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function rng(seed = 1) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Sensores do medidor (resposta de 1ª ordem + flutuação turbulenta Ornstein-Uhlenbeck).
 * τ (s simulados): globo 150 mm ≈ 6 min (estabiliza em ~20–25 min), bulbo úmido natural 1,5 min, bulbo seco 1 min.
 * wet=false (reservatório vazio / pavio seco) → o "bulbo úmido" vira um sensor seco: erro grosseiro (didático).
 */
export function createSensors({ ta = AMB.ta0, seed = 3 } = {}) {
  const R = rng(seed); const gauss = () => { let u = 0, v = 0; while (!u) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const S = { tg: ta, tbn: ta - 5, tbs: ta, n: { tg: 0, tbn: 0, tbs: 0 } };
  const TAU = { tg: 360, tbn: 90, tbs: 60 }, SIG = { tg: 0.12, tbn: 0.05, tbs: 0.1 }, TN = 40;
  return {
    S, TAU,
    /** eq = valores de equilíbrio no ponto do globo; dt em s simulados; wet = pavio úmido. */
    step(eq, dt, { wet = true, unsteady = 0 } = {}) {
      const sub = Math.max(1, Math.ceil(dt / 2)), h = dt / sub;
      for (let i = 0; i < sub; i++) {
        for (const k of ['tg', 'tbn', 'tbs']) { // ruído OU (correlação ~40 s)
          const sig = SIG[k] * (1 + 3 * unsteady);
          S.n[k] += -S.n[k] * (h / TN) + sig * Math.sqrt(2 * h / TN) * gauss();
        }
        const tbnT = wet ? eq.tbn : eq.ta + 0.08 * (eq.tg - eq.ta);
        S.tg += (eq.tg + S.n.tg - S.tg) * (1 - Math.exp(-h / TAU.tg));
        S.tbn += (tbnT + S.n.tbn - S.tbn) * (1 - Math.exp(-h / TAU.tbn));
        S.tbs += (eq.tbs + S.n.tbs - S.tbs) * (1 - Math.exp(-h / TAU.tbs));
      }
      return this.read();
    },
    /** Leitura como o aparelho mostra (resolução 0,1 °C). */
    read() { const q = (x) => Math.round(x * 10) / 10; return { tg: q(S.tg), tbn: q(S.tbn), tbs: q(S.tbs) }; },
    reset(eq) { S.tg = eq.tg; S.tbn = eq.tbn; S.tbs = eq.tbs; },
    /** Simula a aclimatação do medidor ao local da maleta (ar ambiente, sem fonte). */
    soak(t) { S.tg = t; S.tbs = t; S.tbn = t - 6; },
  };
}

export { STATIONS, HALL };
