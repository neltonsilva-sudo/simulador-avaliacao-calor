// CALDEIRAS (ambiente 2 — casa de caldeiras) — dono: CALDEIRAS.
// buildCaldeiras(stage, app) → { group, update(dt, t) }. Tudo do ambiente 2 fica dentro de `group`, visível só quando
// app.state.env === 'caldeiras'. Prédio (cald_build), equipamentos (cald_equip), sala de controle e acessórios (cald_props),
// plumas de vapor (cald_steam), texturas procedurais (cald_tex), geometria (cald_geo).
// Luzes próprias (dentro do grupo, SEM sombra — a luz do dia com sombra é a "chave" do palco reposicionada por stage.setEnv):
// preenchimento hemisférico, janelas (RectAreaLight), luminária da sala de controle.
import * as THREE from 'three';
import { HALL2, CONTROL_ROOM } from './layout_caldeiras.js';
import * as G from './cald_geo.js';
import * as TX from './cald_tex.js';
import { buildBuilding, TRUSS_Y } from './cald_build.js';
import { buildEquipment } from './cald_equip.js';
import { buildProps } from './cald_props.js';
import { createSteam } from './cald_steam.js';

function makeMaterials(stage) {
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const clad = TX.cladTextures(), st = TX.steelTextures(), pt = TX.paintTextures(), wl = TX.wallTextures(), rf = TX.roofTextures(), fd = TX.floorDetail(), fm = TX.floorMacro();
  for (const t of [clad, st, pt, wl, rf, fd]) for (const k of Object.keys(t)) t[k].anisotropy = aniso;
  const N = (s) => new THREE.Vector2(s, s);
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  const paint = (color, rough = 1, o = {}) => std({ color, roughness: rough, roughnessMap: pt.rough, map: pt.map, normalMap: pt.normal, normalScale: N(0.35), metalness: 0.05, ...o });
  const M = {
    clad: std({ color: 0xd9dcdf, metalness: 1, roughness: 0.62, map: clad.map, roughnessMap: clad.rough, normalMap: clad.normal, normalScale: N(0.28) }),
    door: std({ color: 0xf2f0ec, metalness: 1, roughness: 1.35, map: TX.spunTextures().map, roughnessMap: TX.spunTextures().rough, normalMap: TX.spunTextures().normal, normalScale: N(0.18) }),
    steelHot: std({ color: 0xcfccc6, metalness: 1, roughness: 0.95, map: st.map, roughnessMap: st.rough, normalMap: st.normal, normalScale: N(0.35) }),
    steel: std({ color: 0xc8cacc, metalness: 1, roughness: 0.75, map: st.map, roughnessMap: st.rough, normalMap: st.normal, normalScale: N(0.3) }),
    steelDark: std({ color: 0x7d8186, metalness: 0.9, roughness: 0.42 }),
    chrome: std({ color: 0xf2f2f2, metalness: 1, roughness: 0.1 }),
    cast: paint(0x6f7377, 0.9, { metalness: 0.5 }),
    brass: std({ color: 0xc6a05a, metalness: 1, roughness: 0.32 }),
    weld: std({ color: 0x8b7a62, metalness: 0.9, roughness: 0.45 }),
    galv: std({ color: 0xb7bcc0, metalness: 0.85, roughness: 0.45 }),
    alu: std({ color: 0xc9cdd1, metalness: 0.9, roughness: 0.3 }),
    paintBlue: paint(0x2c5f9e), pumpBlue: paint(0x2b63a8, 0.8), frpBlue: std({ color: 0x2a6db8, roughness: 0.35 }),
    struct: paint(0x6c7680), craneYellow: paint(0xd9a514, 0.9), paintYellow: paint(0xe2b419, 0.9), gasYellow: paint(0xe0b21b, 0.85),
    paintRed: paint(0xb3221c, 0.8), svRed: paint(0xa81e1a, 0.75), extRed: std({ color: 0xc0201a, roughness: 0.28 }), toolRed: paint(0xb0261f, 0.7),
    wheelRed: paint(0xc3211b, 0.7), wheelBlue: paint(0x1f56b0, 0.7), paintGreen: paint(0x2f7a46, 0.8), paintDark: paint(0x3b4148),
    paintAlu: paint(0xa9abad, 0.9, { metalness: 0.55 }), burner: paint(0x30363d, 0.7), burnerCover: paint(0x59606a, 0.6), motor: paint(0x3d6c9a, 0.7), motorDark: paint(0x23272b),
    gasRegulator: paint(0x2e3236, 0.8), cabinet: paint(0xd6dad7, 0.65), drumBlue: paint(0x1f4f9a, 0.8), drumBlack: paint(0x1f2124, 0.8),
    wallLow: paint(0x7b8286, 1), wallBlock: paint(0xb4b9b9, 1), wallPanel: std({ color: 0xbcc2c7, map: wl.map, roughnessMap: wl.rough, normalMap: wl.normal, normalScale: N(0.9), roughness: 1, metalness: 0.25 }),
    frame: std({ color: 0x4b5258, metalness: 0.6, roughness: 0.45 }), gateDoor: paint(0xb9c0c5, 0.8), concrete: std({ color: 0x9c9c97, roughness: 0.9, map: pt.map }),
    rubber: std({ color: 0x161718, roughness: 0.75 }), rubberMat: std({ color: 0x222325, roughness: 0.9 }), blackPlastic: std({ color: 0x18191b, roughness: 0.45 }),
    grating: std({ color: 0x7b7f82, metalness: 0.7, roughness: 0.5 }), white: std({ color: 0xeef0ef, roughness: 0.45 }), pvc: std({ color: 0xd6d8d6, roughness: 0.4 }),
    label: std({ color: 0xf4f4f0, roughness: 0.5 }), ledGreen: std({ color: 0x1f8f3f, emissive: 0x33ff66, emissiveIntensity: 1.5 }), ledRed: std({ color: 0x8f1f1f, emissive: 0xff3322, emissiveIntensity: 1.2 }),
    cabFloor: std({ color: 0x8a8f93, roughness: 0.5 }), cabWall: paint(0xdde0e2, 0.8), desk: std({ color: 0xbfc3c4, roughness: 0.55 }), board: std({ color: 0xf0f0ec, roughness: 0.35 }),
    paper: std({ color: 0xf6f5f0, roughness: 0.9 }), bookBlue: std({ color: 0x1c3a6e, roughness: 0.7 }), mug: std({ color: 0xf2f2ee, roughness: 0.3 }), lampPanel: std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.5 }),
    wood: std({ color: 0x9a7a52, roughness: 0.85 }), sack: std({ color: 0xe8e6de, roughness: 0.95 }), gasket: std({ color: 0x2b2b2b, roughness: 0.8 }), glassFrame: std({ color: 0xd8e2e8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.4 }),
    fabric: std({ color: 0x23262b, roughness: 0.95 }), bottle: std({ color: 0x9ec9ec, roughness: 0.1, transparent: true, opacity: 0.6 }),
  };
  M.concrete.map = null;
  // variantes sem cor de vértice (malhas avulsas / instâncias)
  for (const k of Object.keys(M)) { const c = M[k].clone(); c.vertexColors = false; M[k + 'I'] = c; }
  // instâncias
  M.nut = new THREE.MeshStandardMaterial({ color: 0x9a9da0, metalness: 0.9, roughness: 0.38 });
  M.steelDarkI = new THREE.MeshStandardMaterial({ color: 0x5c6064, metalness: 0.9, roughness: 0.45 });
  M.lampBody = new THREE.MeshStandardMaterial({ color: 0xa4aaae, metalness: 0.85, roughness: 0.3, side: THREE.DoubleSide });
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1.0, 0.97, 0.92), emissiveIntensity: 14 });
  // especiais
  M.needle = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 });
  M.gaugeGlass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false });
  M.levelGlass = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  M.levelWater = new THREE.MeshStandardMaterial({ color: 0x5b7f96, emissive: 0x1b3c55, emissiveIntensity: 0.6, roughness: 0.05, transparent: true, opacity: 0.85 });
  M.flame = new THREE.MeshBasicMaterial({ map: TX.flameTexture(), color: new THREE.Color(6, 3.2, 1.2) });
  M.glass = new THREE.MeshStandardMaterial({ color: 0xe8eef2, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, alphaMap: TX.glassGrime() });
  M.cabGlass = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.13, depthWrite: false });
  M.outside = new THREE.MeshBasicMaterial({ map: TX.outsideTexture(), color: new THREE.Color(1.45, 1.5, 1.55), fog: false });
  M.skylight = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 2.35, 2.45), side: THREE.DoubleSide });
  M.roof = new THREE.MeshStandardMaterial({ color: 0x7d858c, map: rf.map, normalMap: rf.normal, normalScale: N(1), roughness: 0.55, metalness: 0.45 });
  rf.map.repeat.set(1, 1); rf.normal.repeat.set(1, 1);
  // piso: macro (UV 0) × detalhe tileável 4 m (UV 1)
  fd.normal.channel = 1; fd.det.channel = 1; fd.rough.channel = 1;
  M.floor = new THREE.MeshStandardMaterial({ map: fm.map, roughnessMap: fm.rough, normalMap: fd.normal, normalScale: N(0.55), roughness: 1, metalness: 0, envMapIntensity: 1.0 });
  M.floor.onBeforeCompile = (sh) => {
    sh.uniforms.tDet = { value: fd.det }; sh.uniforms.tDetR = { value: fd.rough };
    sh.fragmentShader = 'uniform sampler2D tDet; uniform sampler2D tDetR;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= texture2D(tDet, vNormalMapUv).rgb * 1.06;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor * (0.55 + 1.2 * texture2D(tDetR, vNormalMapUv).g), 0.04, 1.0);');
  };
  M.floor.customProgramCacheKey = () => 'caldFloor';
  return M;
}

export function buildCaldeiras(stage, app) {
  const group = new THREE.Group(); group.name = 'caldeiras';
  group.visible = app.state.env === 'caldeiras'; stage.scene.add(group);
  const M = makeMaterials(stage);
  const ctx = { group, batch: new G.Batch(), inst: new G.Inst(), M, TRUSS_Y, needles: [], flames: [], screens: [], levels: [], emitters: {} };
  buildBuilding(ctx);
  buildEquipment(ctx);
  buildProps(ctx);
  // sujeira/AO assada nas cores de vértice
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const dirt = (p) => 0.74 + 0.26 * ss(0.0, 0.45, p.y);
  const shellAO = (p, n) => (0.8 + 0.2 * (n.y * 0.5 + 0.5)) * dirt(p);
  const shade = {};
  for (const k of Object.keys(M)) shade[k] = dirt;
  for (const k of ['clad', 'steelHot', 'steel', 'paintAlu']) shade[k] = shellAO;
  shade.wallLow = (p) => 0.78 + 0.22 * ss(0.0, 0.5, p.y);
  shade.wallPanel = (p) => 0.9 + 0.1 * ss(7.3, 8.5, p.y);
  shade.struct = (p) => 0.85 + 0.15 * ss(0.0, 1.0, p.y);
  ctx.batch.build(group, M, shade);
  ctx.inst.build(group);
  group.traverse((o) => { if (o.isMesh && (o.material === M.outside || o.material === M.skylight || o.material === M.glass || o.material === M.cabGlass)) { o.castShadow = false; } });

  // ───── luzes próprias (sem sombra) ─────
  const L = new THREE.Group(); L.name = 'cald_lights'; group.add(L);
  const hemi = new THREE.HemisphereLight(0xf4f7fb, 0x6c6a64, 0.18); L.add(hemi);
  const sky = new THREE.Color(0.93, 0.96, 1.0);
  const winLight = (w, h, pos, look, I) => { const r = new THREE.RectAreaLight(sky, I, w, h); r.position.set(...pos); r.lookAt(...look); L.add(r); return r; };
  const ym = (2.2 + 7.3) / 2, wh = 5.1;
  // poucas áreas (cada RectAreaLight soma uniforms em TODOS os materiais; muitas estouram o limite do fragment shader)
  winLight(HALL2.x1 - HALL2.x0 - 1, wh, [(HALL2.x0 + HALL2.x1) / 2, ym, HALL2.z0 + 0.2], [(HALL2.x0 + HALL2.x1) / 2, ym - 1.5, 0], 1.8);
  winLight(HALL2.z1 - HALL2.z0 - 1, wh, [HALL2.x0 + 0.2, ym, 0], [HALL2.x1, ym - 1.5, 0], 1.8);
  // luminárias high-bay: uma área larga cobrindo as fileiras, sem sombra
  { const r = new THREE.RectAreaLight(new THREE.Color(1.0, 0.96, 0.9), 1.6, 20, 10); r.position.set(43, TRUSS_Y - 0.5, -1.2); r.lookAt(43, 0, -1.2); L.add(r); }
  hemi.intensity = 0.26;


  // ───── vapor ─────
  const steam = createSteam(ctx, ctx.emitters);
  let warmed = false;

  // ───── IHMs (redesenho a cada 1 s) ─────
  const hmiState = (id, t) => ({ id, p: 9.6 + Math.sin(t * 0.21 + id) * 0.12, lvl: 0.52 + Math.sin(t * 0.13 + id * 2) * 0.03, flame: true, mod: 62 + Math.sin(t * 0.09 + id) * 8 + id * 4, tgas: 214 + Math.sin(t * 0.05 + id) * 3 + id * 6, tfeed: 104, alarm: id === 1 ? false : false, clock: app.fmtClock ? app.fmtClock(app.state.clock) + ':00'.slice(0, 0) : '' });
  function drawScreens(t) {
    for (const s of ctx.screens) {
      if (s.kind === 'cald') TX.drawHMI(s.ctx, s.W, s.H, hmiState(s.id, t), 'cald');
      else TX.drawHMI(s.ctx, s.W, s.H, { b: [hmiState(1, t), hmiState(2, t)], t, alarm: true, clock: hmiState(1, t).clock }, 'scada');
      s.tex.needsUpdate = true;
    }
  }
  drawScreens(0);
  let scrT = 0;

  const show = (env) => { group.visible = env === 'caldeiras'; if (group.visible && !warmed) { steam.warm(9, stage.camera); warmed = true; } };
  app.on('env', show); show(app.state.env);

  function update(dt, t) {
    if (!group.visible) return;
    steam.update(dt, stage.camera);
    for (const f of ctx.flames) { const k = 0.75 + 0.25 * Math.sin(t * 23 + f.seed) * Math.sin(t * 7.3 + f.seed * 2) + 0.1 * Math.sin(t * 51 + f.seed); f.m.material.color.setRGB(6 * k * f.k, 3.1 * k * f.k, 1.1 * k * f.k); f.m.material.map.offset.set(Math.sin(t * 3 + f.seed) * 0.03, t * 0.4 % 1); }
    for (const n of ctx.needles) { const v = n.v + Math.sin(t * 1.7 + n.seed) * n.jit + Math.sin(t * 13 + n.seed * 3) * n.jit * 0.3; n.n.rotation.z = n.ang(v) - Math.PI / 2; }
    for (const l of ctx.levels) { const y = Math.sin(t * 2.1 + l.seed) * 0.006 + Math.sin(t * 7.7 + l.seed) * 0.002; l.m.position.y = l.base + 0.15 + y; }
    if ((scrT -= dt) <= 0) { scrT = 1.0; drawScreens(t); }
  }
  return { group, update, steam, ctx };
}
