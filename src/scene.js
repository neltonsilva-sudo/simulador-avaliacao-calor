// Palco (CENÁRIO): renderer físico, sala de fornos fechada iluminada por fileiras de luminárias LED herméticas 4000 K
// (RectAreaLight por fileira, sem sombra) + uma luz de cima com sombra suave (sombras de contato no piso), IBL capturado da
// PRÓPRIA sala (cubo HDR → PMREM) depois que os módulos montam, pós-processamento (scene_post.js: GTAO, reflexo do piso,
// heat haze diante das portas abertas, névoa leve, DOF, bloom, tonemap fílmico, grão), vistas com transição suave,
// fitFov para telas estreitas, resolução dinâmica sem piscar e window.__fps.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { CAMS, PRESENT, PRESENT2, HALL, HALL2 } from './layout_cams.js';
import { OVENS, ovenFrontZ } from './layout.js';
import { createPost } from './scene_post.js';

const K4000 = new THREE.Color(1.0, 0.95, 0.885); // 4000 K após o balanço de branco da câmera (neutro, levemente quente)

// IBL provisório (antes da captura da sala real): caixa com azulejo claro, fileiras de luminárias e o brilho dos fornos
function buildEnvScene() {
  const s = new THREE.Scene(); const c = new THREE.Vector3(...HALL.probe);
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0;
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, HALL.h, D), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.53), side: THREE.BackSide }));
  room.position.set((HALL.x0 + HALL.x1) / 2 - c.x, HALL.h / 2 - c.y, (HALL.z0 + HALL.z1) / 2 - c.z); s.add(room);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.22, 0.21) }));
  fl.rotation.x = -Math.PI / 2; fl.position.set(room.position.x, -c.y + 0.01, room.position.z); s.add(fl);
  const ledM = new THREE.MeshBasicMaterial({ color: K4000.clone().multiplyScalar(40) });
  for (const z of HALL.ledRows) for (const x of HALL.ledCols) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.1), ledM); m.rotation.x = Math.PI / 2; m.position.set(x - c.x, HALL.h - 0.08 - c.y, z - c.z); s.add(m);
  }
  const ovenM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.33, 0.34) });
  const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 1.9, 0.6) });
  for (const o of OVENS) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, o.d), ovenM); b.position.set(o.x - c.x, o.h / 2 - c.y, HALL.z0 + o.d / 2 - c.z); s.add(b);
    for (const d of o.doors) { const g = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), glowM); g.position.set(o.x + d.cx - c.x, d.y0 + d.h / 2 - c.y, ovenFrontZ(o) + 0.01 - c.z); s.add(g); }
  }
  return s;
}

export async function createStage(canvas, { quality = 'high', app } = {}) {
  const qs = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // tonemap fílmico feito no pós
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x202224);

  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = pmrem.fromScene(buildEnvScene(), 0.02, 0.05, 40);
  scene.environment = envRT.texture; scene.environmentIntensity = 0.3;

  // ── luzes ──
  // 1) fileiras de luminárias LED herméticas (área retangular longa, voltada para baixo) — luz difusa e reflexo no inox
  const lightRig = new THREE.Group(); lightRig.name = 'lights_salaFornos'; scene.add(lightRig);
  const rows = [];
  const xa = Math.min(...HALL.ledCols) - 0.65, xb = Math.max(...HALL.ledCols) + 0.65;
  for (const z of HALL.ledRows) {
    const L = new THREE.RectAreaLight(K4000, 11, xb - xa, 0.62); // fileira de painéis 625×625 embutidos (≈48% de preenchimento)
    L.position.set((xa + xb) / 2, HALL.h - 0.085, z); L.lookAt((xa + xb) / 2, 0, z); lightRig.add(L); rows.push(L);
  }
  // 2) "chave" de cima, com sombra suave: representa a soma das luminárias (sombras de contato sob mesas, tripé, pessoa)
  const key = new THREE.DirectionalLight(K4000, 0.4);
  key.position.set(1.8, 14, 5.5); key.target.position.set(0.4, 0, -0.5);
  key.castShadow = true; const sm = quality === 'low' ? 1024 : 2048; key.shadow.mapSize.set(sm, sm);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 9, bottom: -9, near: 4, far: 26 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  scene.add(key, key.target);
  // 3) preenchimento: rebatimento do piso/paredes claras
  const hemi = new THREE.HemisphereLight(0xf2f0ec, 0x6d6a64, 0.05); lightRig.add(hemi);
  // 4) luz quente (≈2700 K) que sai pelos vidros/bocas dos fornos acesos e banha piso, tripé e pessoa à frente — sem sombra;
  // intensidade ∝ área envidraçada, ×3,5 com a porta aberta (lida a cada quadro de machines.doorOpen / field.doors)
  const K2700 = new THREE.Color(1.0, 0.68, 0.38);
  const ovenGlow = OVENS.map((o) => {
    const a = o.doors.reduce((s, d) => s + d.w * d.h, 0), cx = o.x + o.doors.reduce((s, d) => s + d.cx * d.w * d.h, 0) / a;
    const cy = o.doors.reduce((s, d) => s + (d.y0 + d.h / 2) * d.w * d.h, 0) / a, fz = ovenFrontZ(o);
    const L = new THREE.SpotLight(K2700, 0, 7, 1.35, 1.0, 2); L.position.set(cx, cy, fz + 0.03); L.target.position.set(cx, cy - 0.9, fz + 3);
    lightRig.add(L, L.target); return { id: o.id, L, a };
  });

  const camera = new THREE.PerspectiveCamera(46, 1, 0.03, 80);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.12, maxDistance: 18, maxPolarAngle: Math.PI * 0.93, rotateSpeed: 0.6, zoomSpeed: 0.8, panSpeed: 0.7 });

  // parâmetros do pós (ajustáveis em __stage.P)
  const P = {
    quality, ao: quality === 'low' ? 0 : 1.0, aoRadius: 0.28,
    fogDens: 0.0025, fogK: 0.18, fogCool: new THREE.Vector3(0.11, 0.11, 0.105), fogWarm: new THREE.Vector3(0.24, 0.16, 0.09), ovenGlow: 8.0,
    ssr: quality === "low" ? 0 : 1.2, floorRefl: 1.4, warmPos: new THREE.Vector3(3.5, 1.8, -4.6), haze: quality === 'low' ? 0.6 : 1.0,
    bloomThr: 1.1, bloom: 0.34, exposure: 0.8, ca: 0.15, vignette: 0.22, sat: 1.05, contrast: 0.22, room: 1,
    lift: new THREE.Vector3(0.0, 0.0, 0.0), gain: new THREE.Vector3(0.02, 0.008, -0.012),
    grain: 0.014, smaa: true, dofMax: 22, dofNear: 0.4, tonemap: qs.get('tmo') || 'hp',
  };
  const stage = { THREE, renderer, scene, camera, controls, canvas, quality, P, app, hallBounds: HALL, bounds: { ...HALL }, lightRig, key, hemi, rows, _dof: { amount: 0, dist: 2, target: null, want: 0 } };

  let post = null;
  try { post = createPost(stage, P); } catch (e) { console.error('[scene] pós-processamento indisponível:', e); }
  stage.post = post;

  // ── IBL da própria sala: cubo HDR no ponto HALL.probe → PMREM (refeito quando os módulos ficam prontos) ──
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.05, 40, cubeRT); cubeCam.position.set(...HALL.probe); scene.add(cubeCam);
  function captureEnv(probe) {
    try {
      if (probe) cubeCam.position.set(...(probe.isVector3 ? probe.toArray() : probe));
      const prevBg = scene.background; scene.background = new THREE.Color(0.3, 0.3, 0.3);
      cubeCam.update(renderer, scene);
      scene.background = prevBg;
      cleanCam.update(renderer, cleanScene);
      const rt = pmrem.fromCubemap(cleanRT.texture);
      envRT?.dispose(); envRT = rt; scene.environment = rt.texture; scene.environmentIntensity = envI;
      stage.envCaptured = (stage.envCaptured || 0) + 1;
    } catch (e) { console.error('[scene] captura do IBL:', e); }
  }
  stage.captureEnv = captureEnv;
  // cópia saneada do cubo (NaN/Inf → 0, limite de brilho): um pixel NaN de qualquer módulo contaminaria todo o PMREM
  const cleanRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cleanCam = new THREE.CubeCamera(0.1, 10, cleanRT);
  const cleanScene = new THREE.Scene();
  cleanScene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthTest: false, depthWrite: false, uniforms: { tCube: { value: cubeRT.texture } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform samplerCube tCube; varying vec3 vDir; void main(){ vec3 c = textureCube(tCube, vDir).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(clamp(c, 0.0, 400.0), 1.0); }',
  })));
  let envT = -1, envI = 0.3; // segundos até a próxima captura; intensidade do IBL capturado
  const envChain = (d = 0.3) => { envT = d; for (const ms of [1300, 2600, 4200]) setTimeout(() => (envT = 0.05), ms + d * 1000); }; // capturas encadeadas: cada uma já vê o inox iluminado pela anterior
  if (app?.on) app.on('ready', () => envChain(0.3));
  else setTimeout(() => (envT = 0.05), 1500);

  // ── tamanho + resolução dinâmica ──
  const basePR = Math.min(devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'med' ? 1.5 : 2);
  // Resolução dinâmica SEM piscar: o redimensionamento é adiado para o início do próximo quadro, antes de desenhar, com
  // histerese (baixa após 3 medições < 40 fps; sobe após 8 s > 58 fps; nada nos primeiros 8 s).
  let dyn = 1, lastDynT = 0, pendingResize = false, lowN = 0, highN = 0;
  const dynOn = qs.get('dynres') !== '0';
  let tween = null, baseFov = null, baseAsp = 1.5;
  function resize() {
    window.__resizes = (window.__resizes || 0) + 1;
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; const pr = basePR * dyn;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; if (baseFov != null && !tween) camera.fov = fitFov(baseFov, baseAsp); camera.updateProjectionMatrix();
    post?.setSize(w, h, pr);
  }

  // ── vistas ──
  const views = { ...CAMS, present: { ...PRESENT.cam, aspect: PRESENT.cam.aspect ?? 1.5 }, c_present: { ...PRESENT2.cam } };
  stage.views = views;
  let firstView = true;
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  function orbitView(str) {
    const [ang = 35, h = 2, r = 4, tx = 0, ty = 1.2, tz = 0, fov = 45] = (str || '').split(',').map(Number);
    const a = (ang * Math.PI) / 180;
    return { pos: [tx + r * Math.sin(a), h, tz + r * Math.cos(a)], target: [tx, ty, tz], fov };
  }
  // Cada vista foi enquadrada para a proporção `aspect` (padrão 3:2). Em tela mais estreita (celular em pé) abre o campo
  // vertical para manter ~85% da largura original (até 64°, ou o fov original se já for maior) em vez de cortar os lados.
  function fitFov(f, designAsp = 1.5) {
    const asp = camera.aspect || 1.5; if (asp >= designAsp - 1e-3) return f;
    const keep = designAsp >= 1.45 ? 0.85 : 1.0;
    const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * designAsp * keep);
    const need = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hf / 2) / asp));
    return Math.max(f, Math.min(Math.max(64, f), need));
  }
  stage.fitFov = fitFov;
  addEventListener('resize', resize); resize();

  function flyTo(v, duration = 1.6) {
    const pos = new THREE.Vector3(...(v.pos.isVector3 ? v.pos.toArray() : v.pos));
    const target = new THREE.Vector3(...(v.target.isVector3 ? v.target.toArray() : v.target));
    baseFov = v.fov ?? baseFov ?? camera.fov; baseAsp = v.aspect ?? 1.5; const fov = fitFov(baseFov, baseAsp);
    if (tween) { tween.resolve(); tween = null; }
    if (!duration || duration <= 0.01) {
      camera.position.copy(pos); controls.target.copy(target); camera.fov = fov; camera.updateProjectionMatrix(); controls.update();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      tween = { t: 0, d: duration, p0: camera.position.clone(), t0: controls.target.clone(), f0: camera.fov, p1: pos, t1: target, f1: fov, resolve };
    });
  }
  function setFocus(o) {
    const D = stage._dof;
    if (o == null) { D.target = null; D.want = 0; return; }
    D.target = o; if (D.want === 0) D.want = 0.25;
  }
  function setView(name, { animate = true, duration = 1.6, orbit } = {}) {
    if (name === 'present' && stage.env === 'caldeiras') name = 'c_present';
    const v = name === 'orbit' ? orbitView(orbit || qs.get('orbit')) : views[name];
    if (!v) { console.warn('[scene] vista desconhecida', name); return Promise.resolve(); }
    stage.view = name;
    const D = stage._dof;
    if (v.focus && v.dof) { D.target = new THREE.Vector3(...v.focus); D.want = v.dof; } else if (name !== 'orbit') { D.target = null; D.want = 0; }
    const p = flyTo(v, animate && !firstView ? duration : 0); firstView = false; return p;
  }
  controls.addEventListener('start', () => { if (tween) { tween.resolve(); tween = null; } });

  const fns = new Set();
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  function updateDof(dt) {
    const D = stage._dof;
    let want = D.want, dist = D.dist;
    if (D.target) {
      const t = D.target.isVector3 ? tmp.copy(D.target) : (D.target.updateWorldMatrix?.(true, false), D.target.getWorldPosition(tmp));
      camera.getWorldDirection(fwd); dist = Math.max(0.1, tmp.sub(camera.position).dot(fwd));
    } else want = 0;
    const k = 1 - Math.exp(-dt * 6);
    D.dist += (dist - D.dist) * k; D.amount += (want - D.amount) * k;
  }
  function clampCam() {
    const b = stage.bounds || HALL, p = camera.position, t = controls.target;
    p.x = THREE.MathUtils.clamp(p.x, b.x0 + 0.25, b.x1 - 0.25); p.z = THREE.MathUtils.clamp(p.z, b.z0 + 0.25, b.z1 - 0.25);
    p.y = THREE.MathUtils.clamp(p.y, (b.y0 ?? 0) + 0.12, (b.eave ?? b.h) - 0.2); t.y = Math.max(0, t.y);
  }

  const clock = new THREE.Clock(); let fc = 0, ft = 0, tAll = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.1, clock.getDelta()); tAll += dt;
    if (pendingResize) { pendingResize = false; resize(); }
    for (const f of [...fns]) { try { f(dt, tAll); } catch (e) { console.error('[scene] onFrame:', e); fns.delete(f); } }
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.d); const e = ease(tween.t);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      const lift = Math.sin(Math.PI * e) * Math.min(0.5, tween.p0.distanceTo(tween.p1) * 0.08); camera.position.y += lift;
      camera.fov = tween.f0 + (tween.f1 - tween.f0) * e; camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      if (tween.t >= 1) { const r = tween.resolve; tween = null; controls.update(); r(); }
    } else { controls.update(); clampCam(); }
    updateDof(dt);
    if (envT >= 0 && (envT -= dt) < 0) captureEnv();
    for (const g of ovenGlow) { let op = 0; try { op = app?.machines?.doorOpen?.(g.id) ?? app?.field?.doors?.[g.id] ?? 0; } catch { op = 0; } g.L.intensity = P.ovenGlow * g.a * (1 + 2.5 * Math.max(0, Math.min(1, +op || 0))); }
    if (post) post.render(tAll, dt); else renderer.render(scene, camera);
    fc++; ft += dt;
    if (ft > 0.5) {
      window.__fps = Math.round(fc / ft); fc = 0; ft = 0;
      if (dynOn && tAll > 8 && !document.hidden) {
        lowN = window.__fps < 40 ? lowN + 1 : 0; highN = window.__fps > 58 ? highN + 1 : 0;
        if (lowN >= 3 && dyn > 0.6 && tAll - lastDynT > 3) { dyn = Math.max(0.6, dyn - 0.1); pendingResize = true; lastDynT = tAll; lowN = 0; }
        else if (highN >= 16 && dyn < 1 && tAll - lastDynT > 8) { dyn = Math.min(1, dyn + 0.1); pendingResize = true; lastDynT = tAll; highN = 0; }
      }
    }
  });

  // ── ambientes: limites de câmera, luzes do palco, sombra, IBL, exposição e névoa ──
  // fornos: luzes do palco (fileiras LED + chave com sombra). caldeiras: o grupo do agente CALDEIRAS traz as luzes dele; o palco
  // só reposiciona a chave com sombra (luz do dia vinda do alto/janelas) sobre o galpão e recaptura o IBL lá dentro.
  const ENVS = {
    fornos: { bounds: HALL, probe: HALL.probe, rig: true, exposure: 0.8, contrast: 0.22, envI: 0.3, fog: [0.0025, 0.18, [0.11, 0.11, 0.105], [0.24, 0.16, 0.09]], warm: [3.5, 1.8, -4.6],
      key: { pos: [1.8, 14, 5.5], target: [0.4, 0, -0.5], box: [-11, 11, 9, -9], near: 4, far: 26, i: 0.4, color: K4000 } },
    // sol da manhã entrando pelas janelas altas da parede x0 (−x), ~37° de elevação: manchas de sol e sombras de pilares,
    // caixilhos e tesouras no piso (o vidro não projeta sombra); névoa de vapor mais densa sob o telhado (fogK alto)
    caldeiras: { bounds: HALL2, probe: HALL2.probe, rig: false, exposure: 0.86, contrast: 0.3, envI: 0.6, fog: [0.0035, 0.2, [0.36, 0.38, 0.40], [0.62, 0.56, 0.47]], warm: [36, 5.5, 0],
      key: { pos: [43 - 27, 21, 7], target: [43, 0, 0], box: [-22, 22, 20, -20], near: 5, far: 80, i: 3.2, color: new THREE.Color(1.0, 0.92, 0.8) } },
  };
  stage.env = 'fornos';
  function setEnv(id) {
    const E = ENVS[id]; if (!E) return; stage.env = id;
    stage.bounds = { ...E.bounds }; lightRig.visible = E.rig;
    key.position.set(...E.key.pos); key.target.position.set(...E.key.target); key.intensity = E.key.i; key.color.copy(E.key.color);
    Object.assign(key.shadow.camera, { left: E.key.box[0], right: E.key.box[1], top: E.key.box[2], bottom: E.key.box[3], near: E.key.near, far: E.key.far });
    key.shadow.camera.updateProjectionMatrix(); key.target.updateMatrixWorld();
    P.exposure = E.exposure; P.contrast = E.contrast ?? P.contrast; P.fogDens = E.fog[0]; P.fogK = E.fog[1]; P.fogCool.set(...E.fog[2]); P.fogWarm.set(...E.fog[3]); P.warmPos.set(...E.warm);
    cubeCam.position.set(...E.probe); envI = E.envI; envChain(0.4);
  }

  Object.assign(stage, {
    setEnv,
    onFrame(fn) { fns.add(fn); return () => fns.delete(fn); },
    setView, flyTo, setFocus,
    setExposure(v) { P.exposure = v; },
    // Preparado para mais de um ambiente: limites da câmera ({x0,x1,z0,z1,h|eave,y0}), luzes ativas e novo IBL.
    setBounds(b) { stage.bounds = b ? { ...b } : { ...HALL }; },
    resize,
  });
  return stage;
}
