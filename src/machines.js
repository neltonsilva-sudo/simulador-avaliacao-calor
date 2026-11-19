// EQUIPAMENTOS (fornos e mobiliário) — dono: EQUIPAMENTOS.
// buildMachines(stage, app) → {group, update(dt,t), setDoor(id, v01), doorOpen(id) → 0..1, setOven(id, on), panelButton, doorHandle}
// 5 fornos nas posições/medidas exatas de OVENS (layout.js), interiores incandescentes com pães (instancing), portas animadas,
// vapor ao abrir, luz interna que vaza para a sala, displays legíveis; mobiliário em mach_props.js.
import * as THREE from 'three';
import { OVENS, HALL } from './layout.js';
import * as T from './mach_tex.js';
import { makeMaterials, cavityMaterial, bunGeometry, baguetteGeometry, bouleGeometry } from './mach_geo.js';
import { buildTurbo, buildVitrine, buildLastro4, buildLastro, buildRotativo } from './mach_ovens.js';
import { buildProps, setExtMats } from './mach_props.js';

/** ambiente para reflexos do inox: sala de azulejo branco iluminada por LED, piso cinza, fornos acesos (laranja) */
function buildSteelEnv(renderer) {
  const s = new THREE.Scene();
  const tileC = T.canvas(256), x = tileC.getContext('2d'); x.fillStyle = '#d9dad6'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#9a9b97'; x.lineWidth = 6;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke(); x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke(); }
  const tt = T.tex(tileC, true); tt.repeat.set(6, 1.5);
  const wallM = new THREE.MeshBasicMaterial({ map: tt, color: new THREE.Color(0.75, 0.75, 0.74), side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(17, 4, 12), [wallM, wallM, new THREE.MeshBasicMaterial({ color: 0x3a3c3e, side: THREE.BackSide }), new THREE.MeshBasicMaterial({ color: 0x55534f, side: THREE.BackSide }), wallM, wallM]);
  room.position.set(0, 1.6, 2); s.add(room);
  const add = (w, h, color, px, py, pz, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); m.position.set(px, py, pz); m.rotation.set(rx, ry, 0); s.add(m); return m; };
  for (const zz of [-1.2, 1.4, 4, 6.6]) add(13, 0.22, new THREE.Color(8, 8, 7.6), 0, 3.55, zz, 0, Math.PI / 2);
  // massas escuras (outras máquinas, portas, prateleiras) para dar contraste ao reflexo
  add(3, 2.2, 0x1a1b1c, -4, 1.1, 7.9); add(1.0, 2.1, 0x2b2620, 3.5, 1.05, 7.9); add(4, 0.9, 0x24262a, 1, 0.45, 7.85);
  add(2.5, 1.2, 0x15161a, -8.4, 1.0, 2, Math.PI / 2); add(2, 1.6, 0x202326, 8.4, 0.9, 4, Math.PI / 2);
  // janelas altas (luz do dia fria)
  for (const zz of [0, 3.5, 7]) add(1.4, 0.6, new THREE.Color(3.2, 3.5, 3.9), -8.45, 3.0, zz - 2, Math.PI / 2);
  // brilho quente dos fornos (atrás da câmera para quem olha os fornos; visto nos laterais)
  add(2.4, 0.9, new THREE.Color(3, 1.5, 0.5), 0, 1.4, -3.95); add(0.8, 1.0, new THREE.Color(3, 1.6, 0.6), 4.5, 1.1, -3.95);
  // piso: faixa de reflexo mais clara perto das paredes
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.02, 0.1, 50).texture; pm.dispose();
  return t;
}

export function buildMachines(stage, app) {
  const root = new THREE.Group(); root.name = 'machines';
  const env = buildSteelEnv(stage.renderer);
  const M = makeMaterials(env); setExtMats(M);
  // materiais de cavidade (textura HDR × intensidade) por forno
  const cav = (seed, lamps, inten, tint) => cavityMaterial(T.cavityTexture(seed, tint ? { lamps, tint } : { lamps }), inten);
  Object.assign(M, {
    cav1: cav(11, [[0.25, 0.12, 1.0], [0.25, 0.4, 0.8]], 4.4, [1, 0.68, 0.28]), cav1t: cav(12, [[0.3, 0.8, 0.6]], 4.2, [1, 0.68, 0.28]), cav1f: cav(13, [], 2.6, [1, 0.64, 0.25]),
    cav2: cav(21, [[0.35, 0.1, 1.4], [0.65, 0.1, 1.4]], 3.4, [1, 0.42, 0.035]), cav2t: cav(22, [[0.35, 0.8, 1.6], [0.65, 0.8, 1.6]], 3.6, [1, 0.44, 0.04]), cav2f: cav(23, [], 2.4, [1, 0.4, 0.03]),
    cav3: cav(31, [[0.5, 0.05, 0.5]], 3.2), cav3t: cav(32, [[0.5, 0.85, 1.0]], 3.4), cav3f: cav(33, [], 2.0),
    cav4: cav(41, [[0.5, 0.05, 0.5]], 3.2), cav4t: cav(42, [[0.5, 0.85, 1.0]], 3.4), cav4f: cav(43, [], 2.0),
    cavR: cav(51, [[0.5, 0.06, 0.5]], 3.0, [1, 0.55, 0.18]), cavRt: cav(52, [[0.5, 0.5, 1]], 3.2, [1, 0.55, 0.18]), cavRf: cav(53, [], 1.8, [1, 0.52, 0.16]),
    stone: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.42, 0.11, 0.012) }),
  });
  M.stone.userData.noAO = true;
  const fx = (t, k) => { const m = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(k, k, k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    m.userData.noShadow = true; m.userData.order = 3; return m; };
  M.fxTurbo = fx(T.glassFxTexture(5, { bands: 2 }), 0.55);
  M.fxVit = fx(T.glassFxTexture(7, { bands: 1, dots: 2, dotRows: 1 }), 0.4);
  M.fxDeck = fx(T.glassFxTexture(9, { bands: 1, dots: 7, dotRows: 2 }), 0.7);
  M.fxDeck2 = fx(T.glassFxTexture(13, { bands: 2, dots: 12, dotRows: 2 }), 0.6);
  const cavKeys = { forno1: ['cav1', 'cav1t', 'cav1f'], forno2: ['cav2', 'cav2t', 'cav2f'], lastro: ['cav3', 'cav3t', 'cav3f'], vertical: ['cav4', 'cav4t', 'cav4f', 'stone'], rotativo: ['cavR', 'cavRt', 'cavRf'] };
  cavKeys.lastro.push('stone');

  // ── pães (instancing): coletor por tipo × pai × dentro/fora ──
  const breadGeo = {
    bun: bunGeometry('baking', { r: 0.058, h: 0.05, seed: 1 }), bunBaked: bunGeometry('baked', { r: 0.056, h: 0.05, seed: 4 }),
    bunRaw: bunGeometry('raw', { r: 0.052, h: 0.036, seed: 7 }),
    baguette: baguetteGeometry('rustic', { L: 0.48, R: 0.036, cuts: 5 }), baguetteOut: baguetteGeometry('baked', { L: 0.48, R: 0.031, cuts: 5, seed: 5 }),
    baguetteRaw: baguetteGeometry('raw', { L: 0.44, R: 0.026, cuts: 5, seed: 9 }),
    roll: baguetteGeometry('rustic', { L: 0.17, R: 0.036, cuts: 1, seed: 6, NU: 14, NV: 10 }), boule: bouleGeometry('rustic', {}),
  };
  for (const g of Object.values(breadGeo)) { g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); }
  const breadLists = new Map();
  const _o = new THREE.Object3D();
  const ctx = {
    M, mats: [], panelTex: {}, panelButton: null, lightAnchor: {}, doorObjs: {}, steam: {}, spin: [], fan: null, redLight: null,
    bread(type, parent, x, y, z, ry, s, glow) {
      const inside = glow > 0, k = `${type}|${parent.uuid}|${inside ? 1 : 0}`;
      if (!breadLists.has(k)) breadLists.set(k, { type, parent, inside, items: [] });
      _o.position.set(x, y, z); _o.rotation.set(0, ry, 0); _o.scale.setScalar(s); _o.updateMatrix();
      breadLists.get(k).items.push({ m: _o.matrix.clone(), glow: inside ? glow : 0.85 + Math.random() * 0.15 });
    },
    glows: [],
    glow(parent, x, y, z, size, inten) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTexture(), color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(inten * 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.raycast = () => {}; sp.position.set(x, y, z); sp.scale.setScalar(size); sp.userData.noAO = true; sp.renderOrder = 3; parent.add(sp); ctx.glows.push({ sp, base: inten });
    },
    sticker(parent, x, y, z, size) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.92), stickerMat || (stickerMat = new THREE.MeshStandardMaterial({ map: T.signTexture('adesivo'), roughness: 0.35, transparent: true, alphaTest: 0.1 })));
      m.position.set(x, y, z); parent.add(m);
    },
  };
  let stickerMat = null;

  // ── fornos ──
  const B = { turbo: buildTurbo, turbo_vitrine: buildVitrine, lastro4: buildLastro4, lastro: buildLastro, rotativo: buildRotativo };
  const ovenGroups = {};
  for (const o of OVENS) {
    const fn = B[o.kind]; if (!fn) { console.warn('[machines] tipo de forno desconhecido', o.kind); continue; }
    const g = fn(o, ctx); g.position.set(o.x, 0, HALL.z0); g.name = `oven:${o.id}`; root.add(g); ovenGroups[o.id] = g;
  }
  // ── mobiliário ──
  root.add(buildProps(ctx));

  // ── instâncias de pão ──
  for (const L of breadLists.values()) {
    const im = new THREE.InstancedMesh(breadGeo[L.type], L.inside ? (L.type === 'bun' ? M.breadInPale : M.breadIn) : M.breadOut, L.items.length);
    const c = new THREE.Color();
    L.items.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, c.setScalar(it.glow)); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = !L.inside; im.receiveShadow = !L.inside; if (L.inside) im.userData.noAO = true; im.computeBoundingSphere(); im.name = `bread:${L.type}`;
    L.parent.add(im);
  }

  // ── luzes: interior do forno 1 (sempre), vazamento do forno 1 (porta aberta) e uma luz itinerante para os demais ──
  const inner = new THREE.PointLight(0xff9a3c, 0.8, 1.0, 2); inner.position.copy(ctx.lightAnchor.forno1 || new THREE.Vector3(7.1, 1.4, -5.3)); root.add(inner);
  const o1 = OVENS.find((o) => o.id === 'forno1'), d1 = o1.doors[0];
  const spill1 = new THREE.PointLight(0xff9a48, 0, 4.2, 2); spill1.position.set(o1.x + d1.cx, d1.y0 + d1.h * 0.6, HALL.z0 + o1.d + 0.18); root.add(spill1);
  const spill2 = new THREE.PointLight(0xffa050, 0.0, 3.5, 2); root.add(spill2);
  const glowBase = OVENS.find((o) => o.id === 'lastro');
  spill2.position.set(glowBase.x, 1.4, HALL.z0 + glowBase.d + 0.3);
  const red = new THREE.PointLight(0xff2010, 0.5, 1.6, 2); if (ctx.redLight) red.position.copy(ctx.redLight); root.add(red);

  // ── vapor (partículas suaves) ──
  const steam = makeSteam(root);

  // ── estado das portas ──
  const state = {};
  for (const o of OVENS) state[o.id] = { cur: 0, target: 0, on: true, burst: 0, prev: 0 };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const speed = { forno1: 0.75, forno2: 0.8, rotativo: 0.55, lastro: 0.9, vertical: 0.9 };

  // âncoras úteis para a forneira (puxador da porta do forno 1)
  const doorHandle = new THREE.Object3D(); doorHandle.name = 'forno1Handle';
  const p1 = ctx.doorObjs.forno1?.[0]?.pivot; if (p1) { doorHandle.position.set(0.86, 1.14, 0.1); p1.add(doorHandle); }

  stage.scene.add(root);
  let panelMin = -1;
  const api = {
    group: root, panelButton: ctx.panelButton, doorHandle, ovens: ovenGroups,
    setDoor(id, v) { if (state[id]) state[id].target = Math.max(0, Math.min(1, +v)); },
    doorOpen: (id) => state[id]?.cur ?? 0,
    setOven(id, on) {
      if (!state[id]) return; state[id].on = !!on;
      const k = 0.08; for (const key of cavKeys[id] || []) { const m = M[key]; if (m?.userData.base != null) m.color.setScalar(on ? m.userData.base : m.userData.base * k); }
    },
    update(dt, t) {
      dt = Math.min(dt, 0.1);
      for (const o of OVENS) {
        const s = state[o.id]; const sp = speed[o.id] || 0.8;
        if (s.cur !== s.target) s.cur = s.cur < s.target ? Math.min(s.target, s.cur + dt * sp) : Math.max(s.target, s.cur - dt * sp * 1.1);
        if (s.cur > 0.15 && s.prev <= 0.15 && s.target > 0.5) s.burst = 1;
        s.prev = s.cur; s.burst = Math.max(0, s.burst - dt * 0.55);
        const doors = ctx.doorObjs[o.id] || [];
        for (const d of doors) {
          const v = ease(Math.max(0, Math.min(1, (s.cur - (d.delay || 0)) / (1 - (d.delay || 0)))));
          if (d.type === 'hinge') d.pivot.rotation.y = d.sign * d.max * v; else d.pivot.rotation.x = (d.base || 0) + d.max * v;
        }
        // vapor: rajada ao abrir + fluxo contínuo menor enquanto aberta
        const rate = (s.burst * 110 + s.cur * 6) * (s.on ? 1 : 0.1);
        for (const e of ctx.steam[o.id] || []) { e.burst = s.burst; steam.emit(e, rate * dt / (ctx.steam[o.id].length), s.cur); }
      }
      // carrinho do rotativo gira (para com a porta aberta)
      for (const sp of ctx.spin) { const s = state[sp.id]; sp.obj.rotation.y += dt * sp.w * Math.max(0, 1 - s.cur * 4) * (s.on ? 1 : 0); }
      // luzes
      const f1 = state.forno1;
      inner.intensity = f1.on ? 0.8 + f1.cur * 0.3 : 0.05;
      spill1.intensity = f1.on ? 0.25 + f1.cur * 5 * (0.94 + 0.06 * Math.sin(t * 13) * Math.sin(t * 7.3)) : 0;
      let best = null, bv = 0; for (const o of OVENS) if (o.id !== 'forno1' && state[o.id].cur > bv) { bv = state[o.id].cur; best = o; }
      if (best && bv > 0.02) { const d = best.doors[Math.floor(best.doors.length / 2)]; spill2.position.set(best.x + d.cx, d.y0 + d.h * 0.6, HALL.z0 + best.d + 0.25); spill2.intensity = 0.6 + bv * 5; }
      else { spill2.position.set(glowBase.x, 1.4, HALL.z0 + glowBase.d + 0.3); spill2.intensity = 0.6; }
      // ventilador
      if (ctx.fan) { ctx.fan.blades.rotation.x += dt * 38; ctx.fan.head.rotation.y = Math.sin(t * 0.35) * 0.5; }
      // vapor
      steam.update(dt);
      // display do forno 1: minutos restantes da fornada (25 → 0, em ciclo), segue o relógio simulado
      const clock = app?.state?.clock; const pt = ctx.panelTex.forno1;
      if (pt && clock != null) {
        const m = Math.floor(clock / 60), rem = 25 - (((m - 340) % 26) + 26) % 26;
        if (m !== panelMin) { panelMin = m; pt.redraw(f1.cur > 0.5 ? 180 - Math.round(f1.cur * 0) : 180, Math.max(0, rem)); }
      }
    },
  };
  return api;
}

// ───────────── vapor ─────────────
function makeSteam(root) {
  const N = 420, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), age = new Float32Array(N).fill(1e9), life = new Float32Array(N), size = new Float32Array(N), alpha = new Float32Array(N), rot = new Float32Array(N), ceil = new Float32Array(N).fill(9), pk = new Float32Array(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1)); geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: T.puffTexture() }, scale: { value: 600 } },
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute float aRot; varying float vA; varying float vR;
      uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * scale / -mv.z; vA = aAlpha; vR = aRot; }`,
    fragmentShader: `uniform sampler2D map; varying float vA; varying float vR;
      void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); p = mat2(c,-s,s,c) * p; vec4 t = texture2D(map, p + 0.5);
        float a = t.a * vA; if (!(a > 0.003)) discard; gl_FragColor = vec4(vec3(0.86,0.85,0.82) * 0.8, clamp(a, 0.0, 1.0)); }`,
    transparent: true, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; pts.userData.noAO = true; pts.userData.noBloom = true; root.add(pts);
  let next = 0, acc = 0;
  return {
    emit(e, n, open) {
      acc += n; while (acc >= 1) {
        acc -= 1; const i = next; next = (next + 1) % N;
        pos[i * 3] = e.x0 + Math.random() * (e.x1 - e.x0); pos[i * 3 + 1] = e.y - 0.02; pos[i * 3 + 2] = e.z + Math.random() * 0.05;
        vel[i * 3] = (Math.random() - 0.5) * 0.06; vel[i * 3 + 1] = 0.35 + Math.random() * 0.35; vel[i * 3 + 2] = 0.12 + Math.random() * 0.18 * open;
        age[i] = 0; life[i] = 1.8 + Math.random() * 1.2; rot[i] = Math.random() * 6.28; ceil[i] = e.ceil ?? 9; pk[i] = 0.08 + 0.32 * (e.burst || 0);
      }
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (age[i] > life[i]) { alpha[i] = 0; size[i] = 0; continue; }
        age[i] += dt; const k = Math.min(1, age[i] / life[i]);
        vel[i * 3 + 1] *= 1 - dt * 0.35; vel[i * 3 + 2] *= 1 - dt * 0.8; vel[i * 3] += (Math.random() - 0.5) * dt * 0.1;
        const under = ceil[i] - pos[i * 3 + 1];             // sob a coifa: o vapor se espalha e é aspirado
        if (under < 0.35) { vel[i * 3 + 1] *= 1 - dt * 3; vel[i * 3 + 2] += dt * 0.25; }
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.min(ceil[i] - 0.12, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const fadeC = Math.max(0, Math.min(1, (under - 0.12) / 0.4));
        size[i] = 0.12 + k * 0.6; alpha[i] = Math.min(1, k * 6) * Math.pow(Math.max(0, 1 - k), 1.6) * pk[i] * (0.3 + 0.7 * fadeC); rot[i] += dt * 0.3;
      }
      geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = geo.attributes.aRot.needsUpdate = true;
    },
  };
}
