// TRABALHADORA — dono: TRABALHADORA. Base realista: Microsoft Rocketbox Female_Adult_11 (MIT, assets/rocketbox/F11).
// UNIFORME INDUSTRIAL (worker_uniform.js): camisa de brim marinho manga longa + calça do mesmo tecido (malhas da F01);
// BOTINA DE SEGURANÇA (worker_boots.js) no lugar da bota de salto. Reserva sem uniforme: recoloração do atlas (camisa branca,
// mangas dobradas, fralda, calça escura, botas pretas),
// luvas pretas de malha com punho amarelo, tatuagem fina no antebraço direito interno; colete laranja refletivo (casca solta);
// pose operando o painel (IK de 2 ossos até app.machines.panelButton), olhar para a tela, respiração, piscar.
// Rosto/capacete/óculos/plugs/cabelo: módulo ROSTO (worker_head.js) via gancho buildHead; aqui só versões de reserva.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const DIR = new URL('../assets/rocketbox/F11/', import.meta.url).href;
const HEIGHT = 1.65, RAW_H = 173.6, SC = HEIGHT / RAW_H; // FBX em cm → metros (altura ≈ 1,65 m)
const CM = SC; // metros por cm do FBX
const BTN_DEFAULT = V3(0.45, 1.72, 0.2);

const img = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = DIR + n; });
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const sat = (x) => Math.max(0, Math.min(255, x));

// ── recoloração do atlas do corpo (coordenadas de imagem normalizadas) ──
function recolorBody(im, navy = false) {
  const SHIRT = navy ? [30, 44, 70] : [238, 236, 230]; // camisa: marinho do uniforme (casca sob a malha da F01) ou branca
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S, v = y / S, r = p[i], gg = p[i + 1], b = p[i + 2], L = lum(r, gg, b);
    const side = u < 0.335 || u > 0.665;
    const skin = r > 120 && r > gg && gg > b && r - b > 35;
    if (side && v < 0.235 && (u < 0.2 || u > 0.8)) { p[i] = sat(r * 0.6); p[i + 1] = sat(gg * 0.45); p[i + 2] = sat(b * 0.37); }      // mãos: pele (luvas no shader)
    else if (side && v >= 0.11 && v < 0.29 && u > 0.13 && u < 0.87) { const k = L * 0.32; p[i] = k; p[i + 1] = k; p[i + 2] = k * 1.05; } // cano da bota
    else if (side && v >= 0.27 && v < 0.41) { const k = Math.min(1.0, 0.82 + (L - 40) / 300); p[i] = sat(SHIRT[0] * 0.97 * k); p[i + 1] = sat(SHIRT[1] * 0.97 * k); p[i + 2] = sat(SHIRT[2] * 0.97 * k); } // cinto → camisa por cima
    else if (side && v >= 0.585 && v < 0.85) { const k = 0.55 + L / 300; p[i] = sat(SHIRT[0] * 0.8 * k); p[i + 1] = sat(SHIRT[1] * 0.8 * k); p[i + 2] = sat(SHIRT[2] * 0.8 * k); } // pernas → calça escura
    else if (side && v >= 0.85) { const k = L * 0.33; p[i] = k; p[i + 1] = k; p[i + 2] = k * 1.04; }                                  // botas pretas
    else if (skin) { p[i] = sat(r * 0.6); p[i + 1] = sat(gg * 0.45); p[i + 2] = sat(b * 0.37); }                                       // pele do decote
    else { const k = Math.min(1.04, 0.8 + (L - 52) / 260); p[i] = sat(SHIRT[0] * k); p[i + 1] = sat(SHIRT[1] * k); p[i + 2] = sat(SHIRT[2] * k); }   // blusa/saia → camisa
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function recolorHead(im) {
  const S = 2048, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    const k = Math.max(0, Math.min(1, (r - b - 25) / 40)) * (r > 95 ? 1 : 0) * (r >= gg ? 1 : 0); // grau de "pele"
    if (k <= 0) continue;
    p[i] = r * (1 - k) + sat(r * 0.6) * k; p[i + 1] = gg * (1 - k) + sat(gg * 0.46) * k; p[i + 2] = b * (1 - k) + sat(b * 0.38) * k;
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function roughFromSpec(im, base) { // specular → roughness (invertido), canal G
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const s = lum(p[i], p[i + 1], p[i + 2]) / 255; const r = sat(255 * (base - s * 0.55)); p[i] = p[i + 1] = p[i + 2] = r; }
  g.putImageData(d, 0, 0); return new THREE.CanvasTexture(c);
}
function tattooTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.font = 'italic 38px "Snell Roundhand","Brush Script MT",cursive'; g.textBaseline = 'middle';
  g.fillText('resiliência', 10, 34); g.beginPath(); g.arc(240, 30, 2.5, 0, 7); g.fill();
  return new THREE.CanvasTexture(c);
}

function inject(mat, { decl = '', color = '', rough = '', normal = '', light = '' }, uniforms = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = vec3(position.x, position.z, -position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + decl)
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat wMask = 0.0; float wSkin = 0.0;\n' + color)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rough)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + normal)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + light);
  };
  const ck = 'wk' + (decl + color + rough + normal + light).length + ':' + (color + rough).slice(0, 60); mat.customProgramCacheKey = () => ck;
  return mat;
}
// subsurface aproximado: luz "vaza" no terminador e nas sombras com tom avermelhado (wrap + preenchimento quente)
const SSS = (mask) => `{ float m = ${mask}; vec3 dd = reflectedLight.directDiffuse; float lumD = dot(dd, vec3(0.3, 0.59, 0.11));
  reflectedLight.directDiffuse = mix(dd, dd * vec3(1.06, 0.96, 0.92) + diffuseColor.rgb * vec3(0.55, 0.16, 0.08) * (0.25 * lumD / max(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), 0.02) + 0.0), m);
  reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, reflectedLight.indirectDiffuse * vec3(1.18, 0.98, 0.9), m); }`;
const NOISE = `float h31(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}`;

// eixos do antebraço em repouso (cm, espaço do FBX: y cima, z frente, +x = esquerda dela)
const ELB = V3(35.9, 121.0, -6.3), WRI = V3(52.4, 106.3, 3.1);
function armParam(x, y, z) { // s ao longo do antebraço (0 cotovelo, 1 punho) e distância ao eixo (cm)
  const sx = Math.sign(x) || 1, p = V3(Math.abs(x), y, z), a = WRI.clone().sub(ELB), s = p.clone().sub(ELB).dot(a) / a.lengthSq();
  const dist = p.sub(ELB.clone().add(a.multiplyScalar(s))).length(); return { s, dist, sx };
}

export async function buildWorker(stage, app) {
  // ?avatar=tripo|rocketbox (padrão: rocketbox — escolhido pelo usuário; ?avatar=tripo usa o modelo gerado no Tripo)
  if ((new URLSearchParams(location.search).get('avatar') || 'rocketbox') === 'tripo') {
    try { return await (await import('./worker_tripo.js')).buildWorkerTripo(stage, app); }
    catch (e) { console.warn('[worker] avatar Tripo indisponível, usando Rocketbox:', e); }
  }
  const mgr = new THREE.LoadingManager();
  mgr.setURLModifier((u) => (/\.(tga|png|jpg)$/i.test(u) && !u.startsWith('data:') && !/\.fbx/i.test(u) ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' : u));
  const [fbx, bodyC, bodyN, bodyS, headC, headN, headS, opC] = await Promise.all([
    new FBXLoader(mgr).loadAsync(DIR + 'Female_Adult_11.fbx'),
    img('f011_body_color.jpg'), img('f011_body_normal.jpg'), img('f011_body_specular.jpg'),
    img('f011_head_color.jpg'), img('f011_head_normal.jpg'), img('f011_head_specular.jpg'), img('f011_opacity_color.png')]);
  const group = new THREE.Group(); group.name = 'trabalhadora'; group.rotation.y = 0;
  group.scale.setScalar(SC);
  group.add(fbx); stage.scene.add(group);
  let mesh; fbx.traverse((o) => { if (o.isSkinnedMesh) mesh = o; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const skinned = mesh, geo = mesh.geometry, skel = mesh.skeleton;
  const B = {}; for (const b of skel.bones) B[b.name.replace(/^Bip01_?/, '') || 'Root'] = b;
  const HAND_K = 0.88; // mãos (com a luva) 12 % menores — pedido do usuário; o alcance do braço compensa abaixo
  for (const sd of ['L', 'R']) B[sd + '_Hand']?.scale.setScalar(HAND_K);
  const bones = {}; for (const b of skel.bones) bones[b.name] = b;
  group.updateMatrixWorld(true);

  // ── geometria: saia → fralda curta da camisa; antebraços afinados (manga dobrada, braço nu) ──
  const P = geo.attributes.position, UV = geo.attributes.uv, N = geo.attributes.normal;
  const grpOf = new Int8Array(P.count); for (const gr of geo.groups) grpOf.fill(gr.materialIndex, gr.start, gr.start + gr.count);
  // ── camisa de verdade (malha da F01 presa ao esqueleto da F11); a casca branca da F11 recua por baixo dela ──
  // UNIFORME: camisa de brim marinho manga longa + calça (worker_uniform.js); reserva: camisa branca (worker_shirt.js)
  let shirtF01 = null, uni = null;
  try { const UM = await import('./worker_uniform.js'); uni = await UM.buildUniform({ fbx, bones, mgr, inject, NOISE }); shirtF01 = uni.mesh; }
  catch (e) { uni = null; console.warn('[worker] uniforme indisponível, usando a camisa F01:', e); }
  if (!shirtF01) try { const SM = await import('./worker_shirt.js'); shirtF01 = await SM.buildShirt({ fbx, bones, mgr, inject, NOISE }); }
  catch (e) { console.warn('[worker] camisa F01 indisponível, usando a procedural:', e); }
  const uniPants = !!uni?.pants;
  // (malha do FBX em z-cima: modelo = (x, zRaw, −yRaw))
  const P0 = new Float32Array(P.array); // posições originais: base da casca do colete (não herda o volume da camisa)
  // amostra do atlas: pele do decote fica sem volume de tecido
  const skc = document.createElement('canvas'); skc.width = skc.height = 256; const skg = skc.getContext('2d'); skg.drawImage(bodyC, 0, 0, 256, 256);
  const skd = skg.getImageData(0, 0, 256, 256).data;
  const skinUV = (u, v) => { const j = ((Math.min(255, v * 256 | 0)) * 256 + Math.min(255, u * 256 | 0)) * 4, r = skd[j], g = skd[j + 1], b = skd[j + 2]; return r > 120 && r > g && g > b && r - b > 35; };
  const SH = V3(17.2, 138, -6.1), EL = V3(35.9, 121, -6.3), AD = EL.clone().sub(SH);
  const AE1 = AD.clone().cross(V3(0, 0, 1)).normalize(), AE2 = AD.clone().normalize().cross(AE1);
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const push = (i, d) => P.setXYZ(i, P.getX(i) + N.getX(i) * d, P.getY(i) + N.getY(i) * d, P.getZ(i) + N.getZ(i) * d);
  for (let i = 0; i < P.count; i++) {
    if (grpOf[i] !== 0) continue;
    const u = UV.getX(i), v = 1 - UV.getY(i), x = P.getX(i), y = P.getZ(i), z = -P.getY(i);
    const side = u < 0.335 || u > 0.665, hand = side && v < 0.235 && (u < 0.2 || u > 0.8);
    if (uniPants && !side && y < 92) { const yy = 92 + (y - 92) * 0.12, k = 0.62;  // saia recolhida para dentro da calça
      P.setXYZ(i, x * k, -((z + 1.5) * k - 1.5), yy); continue; }
    if (uniPants && !hand && y < 92 && Math.abs(x) < 26) { push(i, y < 24 ? -1.6 : -1.2); continue; } // pernas/bota de salto sob calça e botina
    if (!side && y < 92) { const yy = 92 + (y - 92) * 0.3; const k = 0.97 + 0.05 * Math.max(0, (yy - 80) / 12); // fralda solta da camisa
      P.setXYZ(i, x * k, -((z + 1.5) * k - 1.5), yy); continue; }
    if (hand || y < 90 || y > 151) continue;
    const a = armParam(x, y, z);
    if (a.s > 0.97 && a.dist < 9) continue;                                          // mão/luva
    if (a.s > 0.3 && a.dist < 8.5) { push(i, -0.75 * Math.min(1, (a.s - 0.3) / 0.05)); continue; } // antebraço nu
    if (skinUV(u, v)) continue;                                                       // pele do decote
    // camisa larga de crepe: volume + dobras macias (cm, repouso)
    const ax = Math.abs(x), q = V3(ax, y, z).sub(SH), su = q.dot(AD) / AD.lengthSq(), rq = q.clone().sub(AD.clone().multiplyScalar(su)), du = rq.length();
    let dT = 1.0 + 0.9 * sstep(122, 100, y) + 0.45 * Math.sin(x * 0.42 + 1.3 * Math.sin(y * 0.17)) * sstep(132, 108, y)
      + 0.3 * Math.sin(y * 0.55 + x * 0.2) * sstep(120, 135, y) * sstep(4, 12, ax);
    if (ax > 11 && du < 11 && su > -0.15) {
      const phi = Math.atan2(rq.dot(AE2), rq.dot(AE1));
      const fo = Math.sin(su * 24 + phi * 1.7 + 0.8 * Math.sin(phi * 3)); const dA = 1.5 + 1.0 * Math.sign(fo) * Math.pow(Math.abs(fo), 0.6) * sstep(0.15, 0.4, su) + 0.4 * Math.sin(su * 51 - phi * 2.3) + 0.8 * sstep(0.6, 1.0, su);
      const wa = sstep(-0.15, 0.2, su); dT = dT * (1 - wa) + dA * wa;
    }
    if (a.s > 0 && a.dist < 9) dT *= 1 - sstep(0.12, 0.28, a.s);                    // some sob o rolo da manga
    const open = z > -1 && ax < 6.5 + Math.max(0, y - 121) * 0.17;                 // só a faixa visível entre as bordas do colete ganha volume
    if (!(ax > 11 && du < 11 && su > 0.05) && !open) dT = Math.min(dT, 0.6);
    push(i, shirtF01 ? (a.s > 0 && a.dist < 9 ? Math.min(dT, 0) : -0.9) : dT);
  }
  P.needsUpdate = true; geo.computeBoundingSphere();

  // ── gancho do módulo ROSTO ──
  let head = null;
  try { const H = await import('./worker_head.js'); head = await H.buildHead({ THREE, stage, app, root: fbx, skinned, bones, headBone: bones.Bip01_Head || B.Head, base: 'rocketbox' }); }
  catch (e) { head = null; if (!/Failed to fetch|Cannot find|404/.test(String(e))) console.warn('[worker] worker_head:', e); }
  const rep = new Set(head?.replaces || []);

  // ── materiais ──
  const armU = { uE: { value: ELB }, uW: { value: WRI }, uTat: { value: tattooTex() }, uUni: { value: uni?.sleeves ? 1 : 0 }, uSleeve: { value: new THREE.Vector3(0.016, 0.027, 0.055) }, uGlove: { value: 0 }, uGloveCol: { value: new THREE.Vector3(0.3, 0.2, 0.11) } };
  const bodyTexN = recolorBody(bodyC, true), bodyTexW = recolorBody(bodyC, false);
  const bodyMat = inject(new THREE.MeshPhysicalMaterial({ map: bodyTexN, normalMap: new THREE.CanvasTexture(bodyN), normalScale: new THREE.Vector2(0.35, 0.35), roughnessMap: roughFromSpec(bodyS, 0.95),
    roughness: 1, metalness: 0, sheen: 0.18, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8, specularIntensity: 0.4 }), {
    decl: NOISE + '\nuniform vec3 uE, uW; uniform sampler2D uTat; uniform float uUni, uGlove; uniform vec3 uSleeve, uGloveCol;',
    color: `vec3 pr = vec3(abs(vRest.x), vRest.y, vRest.z); vec3 ax = uW - uE; float s = dot(pr - uE, ax) / dot(ax, ax);
      vec3 rad = pr - (uE + ax * s); float dd = length(rad);
      float wShirt = 0.0;
      if (dd < 8.5 && s > 0.29 && s < 0.955) { wSkin = 1.0;
        vec3 sk = vec3(0.15, 0.066, 0.038) * (0.86 + 0.22 * vn(vRest * 3.0)) * (0.93 + 0.1 * vn(vRest * 40.0));
        sk *= mix(0.7, 1.0, smoothstep(0.29, 0.4, s));                       // sombra sob o rolo da manga
        if (vRest.x < 0.0 && s > 0.48 && s < 0.9) {                           // tatuagem fina (antebraço direito interno)
          vec3 an = normalize(ax), up = normalize(vec3(0.0, 0.35, 1.0) - an * dot(vec3(0.0, 0.35, 1.0), an)), sd = cross(an, up);
          float ang = atan(dot(rad, sd), dot(rad, up));
          vec2 tu = vec2((s - 0.48) / 0.42, 0.5 + ang / 0.9);
          if (tu.y > 0.0 && tu.y < 1.0) sk *= 1.0 - 0.8 * texture2D(uTat, vec2(tu.x, tu.y)).a; }
        diffuseColor.rgb = sk;
        if (uUni > 0.5) { wSkin = 0.0; diffuseColor.rgb = uSleeve * (0.9 + 0.15 * vn(vRest * 2.0)); } } // manga longa do uniforme por cima
      else if (uGlove > 0.5 && dd < 11.0 && s >= 0.9 && s < 1.12) { wMask = 1.0; vec3 kq = vRest * 9.0; float kn = vn(kq) * 0.6 + vn(kq * 3.1) * 0.4;
        diffuseColor.rgb = uGloveCol * (0.78 + 0.4 * kn) * mix(0.8, 1.0, smoothstep(0.9, 0.93, s)); }
      else if (dd < 11.0 && s >= 0.955 && s < 1.12) { wSkin = 1.0; }
      if (wSkin < 0.5 && wMask < 0.5 && dot(diffuseColor.rgb, vec3(0.333)) > 0.5) {   // crepe branco: microfranzido + leve variação
        wShirt = 1.0; float cr = vn(vec3(vRest.x * 3.2, vRest.y * 0.8, vRest.z * 3.2)) * 0.6 + vn(vRest * 9.0) * 0.4;
        diffuseColor.rgb *= 0.93 + 0.09 * cr; }`,
    light: SSS('wSkin'),
    rough: 'if (wSkin > 0.5) roughnessFactor = 0.45; if (wMask > 0.5) roughnessFactor = 0.9; if (wShirt > 0.5) roughnessFactor = 0.88;',
    normal: `if (wSkin > 0.5) normal = normalize(mix(normal, nonPerturbedNormal, 0.85));
      if (wShirt > 0.5) { vec3 cq = vec3(vRest.x * 3.2, vRest.y * 0.8, vRest.z * 3.2); float e = 0.15;
        vec3 gr = vec3(vn(cq + vec3(e, 0, 0)) - vn(cq - vec3(e, 0, 0)), vn(cq + vec3(0, e, 0)) - vn(cq - vec3(0, e, 0)), vn(cq + vec3(0, 0, e)) - vn(cq - vec3(0, 0, e)));
        vec3 cq2 = vRest * 7.0; vec3 g2 = vec3(vn(cq2 + vec3(e, 0, 0)) - vn(cq2 - vec3(e, 0, 0)), vn(cq2 + vec3(0, e, 0)) - vn(cq2 - vec3(0, e, 0)), vn(cq2 + vec3(0, 0, e)) - vn(cq2 - vec3(0, 0, e)));
        normal = normalize(normal - (mat3(viewMatrix) * (gr * 1.1 + g2 * 0.5))); }`,
  }, armU);
  const headMat = inject(new THREE.MeshPhysicalMaterial({ map: recolorHead(headC), normalMap: new THREE.CanvasTexture(headN), roughnessMap: roughFromSpec(headS, 0.72), roughness: 1,
    sheen: 0.35, sheenColor: new THREE.Color(0x9a3a22), sheenRoughness: 0.45, specularIntensity: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.35 }), { light: SSS('1.0') });
  const opT = new THREE.Texture(opC); opT.colorSpace = THREE.SRGBColorSpace; opT.needsUpdate = true;
  const hairMat = new THREE.MeshStandardMaterial({ map: opT, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7, color: 0x8a6a58 });
  for (const t of [bodyMat.normalMap, headMat.normalMap]) t.needsUpdate = true;
  mesh.material = [bodyMat, headMat, hairMat];

  // ── colete laranja-fluorescente (casca solta com skinning copiado do corpo) ──
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const armIdx = new Set(skel.bones.map((b, i) => (/(UpperArm|Forearm|Hand|Finger)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const domArm = (v) => { let best = 0, bw = 0; for (let k = 0; k < 4; k++) { const w = SW.getComponent(v, k); if (w > bw) { bw = w; best = SI.getComponent(v, k); } } return armIdx.has(best); };
  const X0 = (v) => P0[v * 3], Y0 = (v) => P0[v * 3 + 1], Z0 = (v) => P0[v * 3 + 2];
  const key = (v) => Math.round(X0(v) * 50) + ',' + Math.round(Y0(v) * 50) + ',' + Math.round(Z0(v) * 50);
  function makeShell(filter, offset, material) {
    const weld = new Map(), reps = [], nrm = [], tri = [];
    for (let t = 0; t < P.count; t += 3) {
      if (grpOf[t] !== 0) continue;
      const cx = (X0(t) + X0(t + 1) + X0(t + 2)) / 3, cy = (Z0(t) + Z0(t + 1) + Z0(t + 2)) / 3, cz = -(Y0(t) + Y0(t + 1) + Y0(t + 2)) / 3;
      if (!filter(cx, cy, cz, domArm(t) + domArm(t + 1) + domArm(t + 2) >= 2)) continue;
      for (const v of [t, t + 1, t + 2]) { const k = key(v); let id = weld.get(k); if (id == null) { id = reps.length; weld.set(k, id); reps.push(v); nrm.push(V3()); }
        nrm[id].x += N.getX(v); nrm[id].y += N.getY(v); nrm[id].z += N.getZ(v); tri.push(id); }
    }
    const n = reps.length, pos = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    reps.forEach((v, i) => { const nn = nrm[i].normalize(), x = X0(v), y = Y0(v), z = Z0(v), o = offset(x, z, -y);
      pos.set([x + nn.x * o, y + nn.y * o, z + nn.z * o], i * 3);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = SI.getComponent(v, k); sw[i * 4 + k] = SW.getComponent(v, k); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(tri); g.computeVertexNormals();
    const m = new THREE.SkinnedMesh(g, material); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    mesh.parent.add(m); m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale); m.bind(skel, mesh.bindMatrix);
    return m;
  }
  // contorno suave do colete (cm, espaço de repouso) — recorte por pixel => cava/decote/barra lisos
  const VEST_GLSL = `float vestD(vec3 p) {
    float ax = abs(p.x), y = p.y, z = p.z;
    float dHem = y - 94.0 - 0.6 * smoothstep(0.0, 14.0, ax);
    float vline = 5.2 + max(0.0, y - 121.0) * 0.17;                       // colete aberto na frente
    float dV = z > -1.0 ? ax - vline : 99.0;
    float dBack = (z < -1.0) ? max(ax - (6.8 + max(0.0, y - 141.0) * 0.55), 141.5 - y) : 99.0;
    float e = length(vec2((y - 133.0) / 9.0, (z + 5.0) / 5.6));
    float dArm = (e - 1.0) * 7.0 + max(0.0, 14.8 - ax) * 1.6;
    float strap = 1.0 - smoothstep(1.8, 2.2, abs(y - 101.0));
    float dSide = (16.8 - ax) + max(0.0, y - 118.0) * 2.0 + strap * 30.0;
    float dCap = (15.6 - ax) + max(0.0, 128.0 - y) * 2.0;
    return min(min(min(dHem, dV), min(dBack, dArm)), dCap);
  }`;
  const vestMat = inject(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x000000, emissiveIntensity: 0,
    sheen: 0.2, sheenColor: new THREE.Color(0xff8a30), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }), {
    decl: NOISE + VEST_GLSL,
    color: `float vd = vestD(vRest); if (vd < 0.0) discard;
      float ax = abs(vRest.x), y = vRest.y;
      vec2 dq = vec2(vRest.x + vRest.z * 0.7 + y, vRest.x + vRest.z * 0.7 - y) * 1.9;  // tela de malha em losango (~5 mm)
      vec2 cell = fract(dq) - 0.5; float holes = 1.0 - smoothstep(0.16, 0.3, max(abs(cell.x), abs(cell.y)));
      vec3 col = vec3(1.0, 0.22, 0.03) * (1.0 - 0.3 * holes) * (0.94 + 0.08 * vn(vRest * 1.3));
      float dv = (vRest.z > -1.0) ? ax - (5.2 + max(0.0, y - 121.0) * 0.17) : 99.0;  // distância à abertura da frente
      float st = smoothstep(1.05, 1.2, dv) * (1.0 - smoothstep(5.6, 5.75, dv));        // faixa limão VERTICAL ao lado da abertura
      if (st < 0.5 && vd > 1.15 && holes > 0.93) discard;                            // furos reais da tela (alfa)
      if (st > 0.0) { wMask = st; col = mix(col, vec3(0.80, 0.95, 0.06) * (0.9 + 0.1 * vn(vRest * 2.0)) * (1.0 - 0.06 * holes), st); }
      col = mix(col, vec3(0.008, 0.008, 0.01) * (0.8 + 0.4 * vn(vRest * 6.0)), 1.0 - smoothstep(0.95, 1.15, vd)); wMask = max(wMask, 1.0 - smoothstep(0.95, 1.15, vd)); // debrum preto
      col *= 0.88 + 0.12 * vn(vRest * 0.45);                                            // sujeira/variação
      diffuseColor.rgb = col;`,
    rough: 'roughnessFactor = mix(roughnessFactor, 0.42, wMask);',
  });
  const vestDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  vestDepth.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = vec3(position.x, position.z, -position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + VEST_GLSL).replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vestD(vRest) < 0.0) discard;');
  };
  vestDepth.customProgramCacheKey = () => 'vestDepth';
  const VEST_OFF = +(new URLSearchParams(location.search).get('voff') || 2.7); // folga (cm) do colete sobre o uniforme
  const vest = makeShell((x, y, z, arm) => (!arm || (y > 127 && Math.abs(x) < 18.5)) && y > 92 && y < 151 && Math.abs(x) < 19.5,
    (x, y, z) => VEST_OFF + (y > 134 ? 0.5 : 0) + (Math.abs(x) > 13 ? 0.4 : 0) + (z > 2 && y < 122 ? (122 - y) * 0.025 : 0) + Math.max(0, 100 - y) * 0.03, vestMat); // mais justo ao corpo
  vest.customDepthMaterial = vestDepth;
  vest.name = 'colete'; vest.visible = false;

  const rest = new Map(skel.bones.map((b) => [b, b.quaternion.clone()]));
  const restPos = new Map(skel.bones.map((b) => [b, b.position.clone()]));
  group.updateMatrixWorld(true);
  const gq = group.getWorldQuaternion(new THREE.Quaternion());
  // holder preso ao osso com escala de mundo 1 e eixos do corpo (x = esquerda dela, y = cima, z = frente)
  function holderOn(bone) {
    const h = new THREE.Object3D(); bone.add(h); bone.updateWorldMatrix(true, false);
    const s = bone.getWorldScale(V3()), bq = bone.getWorldQuaternion(new THREE.Quaternion());
    h.quaternion.copy(bq.invert().multiply(gq)); h.scale.set(1 / s.x, 1 / s.y, 1 / s.z); return h;
  }
  const relTo = (bone, cm) => { const bp = bone.getWorldPosition(V3()); const wp = V3(cm[0], cm[1], cm[2]).applyMatrix4(fbx.matrixWorld); return wp.sub(bp).applyQuaternion(gq.clone().invert()); };

  // ── botina de segurança (substitui a bota de salto; malha rígida presa ao osso do pé) ──
  if (uniPants) try { const BM = await import('./worker_boots.js'); BM.buildBoots({ bones, group, floorY: group.getWorldPosition(V3()).y }); }
  catch (e) { console.warn('[worker] botina indisponível:', e); }

  // ── mangas dobradas: punho largo e fofo logo abaixo do cotovelo (dobras grandes e macias) ──
  const shirtM = inject(new THREE.MeshPhysicalMaterial({ color: 0xf1efea, roughness: 0.9, sheen: 0.35, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.7, side: THREE.DoubleSide }), {
    decl: NOISE, color: 'diffuseColor.rgb *= 0.9 + 0.12 * vn(vRest * 2.5);',
    normal: `{ vec3 cq = vRest * vec3(2.6, 0.9, 2.6); float e = 0.15;
      vec3 gr = vec3(vn(cq + vec3(e, 0, 0)) - vn(cq - vec3(e, 0, 0)), vn(cq + vec3(0, e, 0)) - vn(cq - vec3(0, e, 0)), vn(cq + vec3(0, 0, e)) - vn(cq - vec3(0, 0, e)));
      normal = normalize(normal - mat3(viewMatrix) * gr * 1.2); }` });
  function cuffGeo(R, L) {
    const g = new THREE.CylinderGeometry(1, 1, 1, 40, 10, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ph = Math.atan2(z, x), h = y + 0.5;
      const r = R * (0.93 + 0.16 * Math.sin(Math.PI * h) + 0.05 * Math.sin(ph * 3 + 2.1 * h) + 0.04 * Math.sin(ph * 5 - 4 * h + 1.0))
        + 0.55 * Math.max(0, Math.sin(ph * 2 + 0.6)) * Math.sin(Math.PI * h); // dobra grande
      p.setXYZ(i, x * r, y * L, z * r); }
    g.computeVertexNormals();
    const lip = new THREE.TorusGeometry(R * 0.98, 0.75, 8, 40); lip.rotateX(Math.PI / 2);
    const ring = (yy, sc) => { const t = lip.clone(); t.scale(sc, 1, sc); t.translate(0, yy, 0); return t; };
    return [g, ring(L / 2, 1.0), ring(-L / 2, 0.97)];
  }
  if (!shirtF01) for (const sd of ['L', 'R']) {
    const fa = B[sd + '_Forearm'], h = holderOn(fa), sx = sd === 'L' ? 1 : -1;
    const ax = WRI.clone().sub(ELB), c = ELB.clone().add(ax.clone().multiplyScalar(0.2)); c.x *= sx;
    const dir = ax.normalize(); dir.x *= sx;
    const cuff = new THREE.Group(); cuff.position.copy(relTo(fa, [c.x, c.y, c.z])); cuff.quaternion.setFromUnitVectors(V3(0, 1, 0), dir); cuff.scale.setScalar(CM);
    for (const g of cuffGeo(5.1, 6.4)) { const m = new THREE.Mesh(g, shirtM); m.castShadow = true; m.receiveShadow = true; cuff.add(m); }
    h.add(cuff);
  }

  // ── gola aberta da camisa (abas deitadas sobre os ombros, pontas em V no peito) ──
  if (!shirtF01) { const hold = holderOn(B.Spine2);
    const pos = [], idx = [], NU = 26, NV = 4;
    for (const sx of [-1, 1]) {
      const base = new THREE.CatmullRomCurve3([V3(0, 147.6, -13.6), V3(4.6, 147.4, -12.0), V3(6.6, 147.0, -7.6), V3(6.6, 145.6, -3.0), V3(5.4, 142.8, 1.6), V3(3.6, 138.8, 6.0), V3(1.9, 134.6, 8.9)]);
      const off = pos.length / 3;
      for (let i = 0; i <= NU; i++) {
        const t = i / NU, pt = base.getPoint(t), tg = base.getTangent(t);
        const radial = V3(pt.x, 0, pt.z + 6.6).normalize(), front = Math.max(0, (t - 0.45) / 0.55);
        const outw = radial.clone().lerp(V3(1, -0.15, 0.55).normalize(), front).normalize();
        const stand = 2.6 * (1 - front) + 0.5 * front, span = 4.4 + 2.2 * Math.pow(front, 2);
        const nrmOut = tg.clone().cross(V3(0, 1, 0)).normalize(); if (nrmOut.dot(radial) < 0) nrmOut.negate();
        const rows = [pt.clone().addScaledVector(nrmOut, 0.5), pt.clone().addScaledVector(V3(0, 1, 0), stand).addScaledVector(nrmOut, 0.9),
          pt.clone().addScaledVector(V3(0, 1, 0), stand * 0.9).addScaledVector(outw, 1.6),
          pt.clone().addScaledVector(outw, span).addScaledVector(V3(0, -1, 0), 1.0 + 1.4 * front)];
        for (let r = 0; r < NV; r++) { const q = rows[r]; pos.push(q.x * sx, q.y, q.z); }
      }
      for (let i = 0; i < NU; i++) for (let r = 0; r < NV - 1; r++) { const a0 = off + i * NV + r, a1 = a0 + NV;
        if (sx > 0) idx.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1); else idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const collar = new THREE.Mesh(g, shirtM); collar.name = 'gola'; collar.castShadow = true; collar.receiveShadow = true;
    fbx.add(collar); fbx.updateMatrixWorld(true); hold.attach(collar);
  }

  // ── reservas de EPI na cabeça (se o ROSTO não substituir) ──
  const headH = holderOn(B.Head);
  const hp = (x, y, z) => relTo(B.Head, [x, y, z]);
  const earL = new THREE.Object3D(), earR = new THREE.Object3D(); earL.position.copy(hp(7.0, 159.0, -4.2)); earR.position.copy(hp(-7.0, 159.0, -4.2)); headH.add(earL, earR);
  if (!rep.has('helmet')) {
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ee, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    const c0 = hp(0, 166.5, -3.5);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.128, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.5), white); shell.scale.set(0.9, 0.95, 1.08); shell.position.copy(c0); headH.add(shell);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.135, 0.006, 40, 1, false, -0.9, 1.8), white); brim.scale.set(0.95, 1, 1.3); brim.position.copy(c0).add(V3(0, 0, 0.012)); brim.rotation.x = -0.1; headH.add(brim);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 6, 40), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 })); band.rotation.x = Math.PI / 2; band.scale.set(0.8, 1.05, 1); band.position.copy(c0).add(V3(0, -0.006, 0)); headH.add(band);
    const strapM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 });
    for (const sx of [-1, 1]) { const curve = new THREE.CatmullRomCurve3([hp(sx * 7.6, 165, -6), hp(sx * 7.4, 158, -7.5), hp(sx * 6.5, 151, -4), hp(sx * 3.5, 147.5, 2)]);
      headH.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0055, 5), strapM)); }
  }
  if (!rep.has('glasses')) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.042, 32, 1, true, -1.1, 2.2),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, roughness: 0.04, clearcoat: 1, specularIntensity: 1, side: THREE.DoubleSide, depthWrite: false }));
    lens.position.copy(hp(0, 160.6, -3.6)); headH.add(lens);
  }
  if (!rep.has('earplugs')) {
    const plugM = new THREE.MeshStandardMaterial({ color: 0xff7a1c, roughness: 0.95 });
    for (const e of [earL, earR]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0075, 0.016, 12), plugM); p.rotation.z = Math.PI / 2; p.position.x = Math.sign(e.position.x || 1) * 0.004; e.add(p); }
  }

  // ══════════════ MOVIMENTO (procedural): caminhada, sentar, atividades A1–A4 por ambiente ══════════════
  const Y = V3(0, 1, 0), gqNow = new THREE.Quaternion();
  const tq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const wpos = (b) => b.getWorldPosition(V3());
  const W = (x, y, z) => V3(x, y, z).applyQuaternion(gqNow);
  function setWQ(bone, q) { bone.parent.getWorldQuaternion(pq); bone.quaternion.copy(pq.invert().multiply(q)); bone.updateMatrixWorld(true); }
  function aim(bone, child, target, k = 1) {
    const bp = wpos(bone), cur = wpos(child).sub(bp).normalize(), des = target.clone().sub(bp).normalize();
    const d = new THREE.Quaternion().setFromUnitVectors(cur, des); if (k < 1) d.slerp(new THREE.Quaternion(), 1 - k);
    bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(d));
  }
  function rotW(bone, axisW, ang) { if (!bone || !ang) return; bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(new THREE.Quaternion().setFromAxisAngle(axisW, ang))); }
  function ik(side, target, pole) {
    const ua = B[side + '_UpperArm'], fa = B[side + '_Forearm'], ha = B[side + '_Hand'];
    const s = wpos(ua), a = wpos(fa).distanceTo(s), b = wpos(ha).distanceTo(wpos(fa));
    const dv = target.clone().sub(s), d = Math.min(dv.length(), (a + b) * 0.985), dir = dv.normalize();
    const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    aim(ua, fa, s.clone().add(dir.clone().multiplyScalar(along)).add(perp.multiplyScalar(h)));
    aim(fa, ha, s.clone().add(dir.multiplyScalar(d)));
  }
  const _q = new THREE.Quaternion(), FAX = V3(0, 0, 1);
  function finger(side, f, angs) { ['', '1', '2'].forEach((k, i) => { const b = B[side + '_Finger' + f + k]; if (b && angs[i]) b.quaternion.multiply(_q.setFromAxisAngle(FAX, angs[i])); }); }
  function handPose(side, grip, pen = false) {
    if (pen) { finger(side, '1', [0.55, 0.6, 0.35]); finger(side, '2', [0.85, 0.95, 0.5]); finger(side, '3', [1.25, 1.2, 0.7]); finger(side, '4', [1.35, 1.2, 0.7]); finger(side, '0', [0.5, 0.55, 0.35]); B[side + '_Hand']?.updateMatrixWorld(true); return; } // grip: 0 relaxada … 1 fechada (segurando esteira/copo/volante)
    const P = (a, r) => a.map((x, i) => x * grip + r[i] * (1 - grip));
    finger(side, '1', P([0.9, 1.0, 0.6], [0.3, 0.4, 0.25])); finger(side, '2', P([1.0, 1.1, 0.65], [0.38, 0.48, 0.3]));
    finger(side, '3', P([1.05, 1.1, 0.65], [0.45, 0.55, 0.32])); finger(side, '4', P([1.1, 1.05, 0.6], [0.5, 0.55, 0.32]));
    finger(side, '0', P([0.45, 0.6, 0.4], [0.15, 0.25, 0.15]));
    B[side + '_Hand']?.updateMatrixWorld(true);
  }
  const headFwdLocal = V3(0, 0, 1).applyQuaternion(gq).applyQuaternion(B.Head.getWorldQuaternion(new THREE.Quaternion()).invert());
  const lidRest = ['LEyeBlinkTop', 'REyeBlinkTop'].map((n) => B[n]).filter(Boolean);

  // medidas do corpo (repouso, grupo na origem)
  group.updateMatrixWorld(true);
  const hipRest = wpos(B.Pelvis).y, Lt = wpos(B.L_Calf).distanceTo(wpos(B.L_Thigh)), Lc = wpos(B.L_Foot).distanceTo(wpos(B.L_Calf)), ankH = wpos(B.L_Foot).y;
  const hipX = wpos(B.Pelvis).x, hipZ = wpos(B.Pelvis).z;
  const footRest = {}; for (const sd of ['L', 'R']) { const p = wpos(B[sd + '_Foot']); footRest[sd] = { x: p.x, z: p.z, q: B[sd + '_Foot'].getWorldQuaternion(new THREE.Quaternion()) }; }
  function ikB(ua, fa, ha, target, pole) {
    const s = wpos(ua), a = wpos(fa).distanceTo(s), b = wpos(ha).distanceTo(wpos(fa));
    const dv = target.clone().sub(s), d = Math.min(dv.length(), (a + b) * 0.995), dir = dv.normalize();
    const along = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - along * along));
    const perp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    aim(ua, fa, s.clone().add(dir.clone().multiplyScalar(along)).add(perp.multiplyScalar(h)));
    aim(fa, ha, s.clone().add(dir.multiplyScalar(d)));
  }

  // ── âncoras (CONTRATO: head, handL, handR) e adereços ──
  const palm = (sd) => { const h = holderOn(B[sd + '_Hand']); const f = wpos(B[sd + '_Finger2']).sub(wpos(B[sd + '_Hand'])).multiplyScalar(0.5);
    h.updateWorldMatrix(true, false); const o = new THREE.Object3D(); o.position.copy(h.worldToLocal(wpos(B[sd + '_Hand']).add(f))); h.add(o); return o; };
  const anchors = { head: head?.anchors?.head || (() => { const o = new THREE.Object3D(); o.position.copy(hp(0, 160, -3)); headH.add(o); return o; })(), handL: palm('L'), handR: palm('R') };
  const std = (c, r = 0.6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const props = new THREE.Group(); props.name = 'trabalhadora_props'; stage.scene.add(props);
  const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  // esteira 60×40 de alumínio perfurado com 8 pães (cru/assado)
  const tray = new THREE.Group(); props.add(tray);
  { const alu = std(0x9ea2a6, 0.42, 0.75); tray.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.006, 0.4), alu));
    for (const [w, d, x, z] of [[0.6, 0.012, 0, 0.197], [0.6, 0.012, 0, -0.197], [0.012, 0.4, 0.297, 0], [0.012, 0.4, -0.297, 0]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, d), alu); r.position.set(x, 0.008, z); tray.add(r); }
    const bunG = new THREE.SphereGeometry(1, 18, 10); tray.userData.raw = std(0xe9dcc4, 0.85); tray.userData.baked = new THREE.MeshPhysicalMaterial({ color: 0xc27a32, roughness: 0.55, clearcoat: 0.2 });
    tray.userData.buns = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const b = new THREE.Mesh(bunG, tray.userData.raw); b.scale.set(0.055, 0.032, 0.085); b.position.set(-0.21 + i * 0.14, 0.03, -0.09 + j * 0.18); b.rotation.y = (i * 7 + j * 3) % 5 * 0.06; tray.add(b); tray.userData.buns.push(b); } }
  shadowed(tray); tray.visible = false;
  const setBaked = (b) => { for (const m of tray.userData.buns) { m.material = b ? tray.userData.baked : tray.userData.raw; m.scale.y = b ? 0.042 : 0.032; } };
  // copo d'água (descanso), caneta e livro da caldeira (sala de controle), massa (bancada)
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.095, 18, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xf6f6f6, roughness: 0.35, side: THREE.DoubleSide, transmission: 0.3 }));
  cup.add(new THREE.Mesh(new THREE.CircleGeometry(0.033, 18).rotateX(-Math.PI / 2).translate(0, 0.03, 0), new THREE.MeshPhysicalMaterial({ color: 0xbfd8e6, roughness: 0.05 })));
  anchors.handR.add(cup); cup.position.set(0, -0.01, 0.0); shadowed(cup); cup.visible = false;
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.004, 0.14, 8), std(0x1a3a8a, 0.4)); anchors.handR.add(pen); pen.rotation.x = 1.0; pen.visible = false;
  const book = new THREE.Group(); props.add(book);
  { const cov = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.008, 0.31), std(0x1d2c4a, 0.7)); book.add(cov);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 360; const g = cv.getContext('2d'); g.fillStyle = '#f3f1ea'; g.fillRect(0, 0, 512, 360);
    g.strokeStyle = '#9fb3c8'; g.lineWidth = 1; for (let y = 40; y < 350; y += 16) { g.beginPath(); g.moveTo(14, y); g.lineTo(246, y); g.moveTo(266, y); g.lineTo(498, y); g.stroke(); }
    g.fillStyle = '#2a3550'; g.font = 'bold 15px sans-serif'; g.fillText('LIVRO DE REGISTRO — CALDEIRA 1', 18, 26);
    g.font = '12px sans-serif'; g.fillStyle = '#26344f'; for (let k = 0; k < 13; k++) g.fillText(`${String(6 + (k >> 2)).padStart(2, '0')}:${String((k % 4) * 15).padStart(2, '0')}   P 9,6 kgf/cm²   nível OK   ✓`, 18, 54 + k * 16 - 4);
    g.strokeStyle = '#ccc'; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 360); g.stroke();
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.295), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })); pg.rotation.x = -Math.PI / 2; pg.position.y = 0.0105; book.add(pg); }
  shadowed(book); book.visible = false;
  const dough = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 12), new THREE.MeshPhysicalMaterial({ color: 0xeee4d0, roughness: 0.8, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) }));
  props.add(shadowed(dough)); dough.visible = false;
  // volante da válvula de bloqueio no distribuidor, ao alcance do ponto S2 das caldeiras (derivação do coletor)
  const valve = new THREE.Group(); props.add(valve);
  { const cast = std(0x3a3d40, 0.55, 0.6), red = new THREE.MeshPhysicalMaterial({ color: 0xb01a14, roughness: 0.45, clearcoat: 0.3 }), steel = std(0x8a8d90, 0.4, 0.9);
    const vz = -8.25, vx = 47.9, vy = 1.55;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 16).rotateX(Math.PI / 2), std(0x6d6460, 0.5, 0.7)); pipe.position.set(vx, vy, vz + 0.15); valve.add(pipe);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), cast); body.position.set(vx, vy, vz + 0.33); body.scale.set(1, 1, 1.15); valve.add(body);
    for (const dz of [0.22, 0.44]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.022, 20).rotateX(Math.PI / 2), cast); f.position.set(vx, vy, vz + dz); valve.add(f); }
    const bon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 16).rotateX(Math.PI / 2), cast); bon.position.set(vx, vy, vz + 0.5); valve.add(bon);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 8).rotateX(Math.PI / 2), steel); stem.position.set(vx, vy, vz + 0.62); valve.add(stem);
    const wheel = new THREE.Group(); wheel.position.set(vx, vy, vz + 0.66); valve.add(wheel); valve.userData.wheel = wheel; valve.userData.c = V3(vx, vy, vz + 0.66);
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 10, 40), red));
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.31, 6), red); sp.rotation.z = k * Math.PI / 3; wheel.add(sp); }
    wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 12).rotateX(Math.PI / 2), red)); }
  shadowed(valve);

  // ── touca descartável de TNT (forneira): franzida pelo elástico na linha do cabelo, volume solto caído atrás ──
  let touca = null;
  if (head?.frame && head.debug) {
    const d = head.debug, cz = (d.zF + d.zB) / 2 - 0.004, yc = -0.012;
    const rx0 = d.hw + 0.006, rz0 = (d.zF - d.zB) / 2 + 0.006, ry0 = d.T + 0.006 - yc;
    let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    const ph = Array.from({ length: 8 }, () => rnd() * 6.283);
    // linha do elástico: testa (~5,5 cm acima dos olhos), acima das orelhas, nuca baixa
    const rimY = (a, drop = 0) => { const c = Math.cos(a); return (c > 0 ? 0.03 + 0.027 * c * c : 0.03 - 0.108 * c * c) - drop + 0.003 * Math.sin(a * 3 + ph[0]); };
    const skull = (a, y) => { const k = Math.sqrt(Math.max(0, 1 - ((y - yc) / ry0) ** 2)); return V3(Math.sin(a) * rx0 * k, y, cz + Math.cos(a) * rz0 * k); };
    const NA = 144, NE = 26;
    const mk = (offF, rimDrop, colorF) => {
      const pos = [], uv = [], col = [], idx = [];
      for (let j = 0; j <= NE; j++) for (let i = 0; i <= NA; i++) {
        const a = (i / NA) * Math.PI * 2, t = j / NE, y0 = rimY(a, rimDrop), yT = yc + ry0, y = y0 + (yT - y0) * Math.sin(t * Math.PI / 2);
        const p = skull(a, y), n = V3(p.x / (rx0 * rx0), (p.y - yc) / (ry0 * ry0), (p.z - cz) / (rz0 * rz0)).normalize();
        const o = offF(a, t); p.addScaledVector(n, o.r); p.y += o.dy; p.z += o.dz;
        pos.push(p.x, p.y, p.z); uv.push(i / NA * 14, t * 3.5); const cc = colorF(a, t); col.push(cc, cc, cc);
      }
      for (let j = 0; j < NE; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + NA + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    };
    const hairR = (a, t) => 0.0015 + 0.007 * Math.sin(Math.PI * t) * (1 + 0.6 * Math.max(0, -Math.cos(a))) + 0.014 * Math.exp(-(((a - Math.PI) / 0.7) ** 2) - (((t - 0.3) / 0.22) ** 2));
    const capOff = (a, t) => {
      const back = Math.max(0, -Math.cos(a)), s = Math.sin(Math.PI * Math.min(1, t * 1.15));
      // franzido do elástico: pregas finas e irregulares junto à borda, abrindo em rugas largas na copa
      const pf = Math.sin(a * 58 + 2.2 * Math.sin(a * 7 + ph[1]) + ph[2]); const fine = Math.sign(pf) * Math.pow(Math.abs(pf), 0.55) * 0.0042 * Math.pow(1 - t, 2.2);
      const wr = (0.0075 * Math.sin(a * 9 + t * 4 + ph[3]) + 0.005 * Math.sin(a * 5 - t * 7 + ph[4]) + 0.0035 * Math.sin(a * 17 + t * 11 + ph[5])) * s;
      const bun = 0.026 * Math.exp(-(((a - Math.PI) / 0.75) ** 2) - (((t - 0.32) / 0.24) ** 2));
      const r = 0.0035 + 0.022 * Math.pow(s, 0.8) * (1 + 0.55 * back) + bun + fine + wr + 0.004 * Math.sin(a + ph[6]) * s;
      return { r: Math.max(r, hairR(a, t) + 0.0045), dy: -0.016 * back * s * (1 - 0.5 * t), dz: -0.008 * back * s };
    };
    const capCol = (a, t) => { const back = Math.max(0, -Math.cos(a)); return 0.9 + 0.08 * Math.min(1, t * 2.5) - 0.04 * back * (1 - t); };
    const g = mk(capOff, 0, capCol);
    // relevo do TNT (polipropileno spunbond: pontos gravados em losango + fibras)
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cg = cv.getContext('2d'); cg.fillStyle = '#9a9a9a'; cg.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 1400; k++) { const v = (90 + rnd() * 120) | 0; cg.strokeStyle = `rgba(${v},${v},${v},0.5)`; cg.lineWidth = 0.6; cg.beginPath(); const x = rnd() * 128, y = rnd() * 128, an = rnd() * 6.3; cg.moveTo(x, y); cg.lineTo(x + Math.cos(an) * 9, y + Math.sin(an) * 9); cg.stroke(); }
    cg.fillStyle = '#4a4a4a'; for (let y = 0; y < 128; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 128; x += 8) { cg.beginPath(); cg.ellipse(x, y, 1.6, 1.1, 0.785, 0, 7); cg.fill(); }
    const bt = new THREE.CanvasTexture(cv); bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
    const tm = new THREE.MeshPhysicalMaterial({ color: 0xf5f5f2, vertexColors: true, roughness: 0.93, sheen: 0.45, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.85,
      bumpMap: bt, bumpScale: 0.35, side: THREE.DoubleSide, specularIntensity: 0.25 });
    // leve translucidez: a luz "vaza" pelo TNT fino (mais escuro onde o cabelo preso está logo abaixo)
    tm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * 0.06; reflectedLight.directDiffuse *= 0.97;'); };
    touca = new THREE.Group(); touca.name = 'touca'; const capM = new THREE.Mesh(g, tm); touca.add(capM);
    // cabelo preso por baixo: aparece só a linha do cabelo junto à testa/têmporas
    const hairIn = mk((a, t) => ({ r: hairR(a, t), dy: -0.016 * Math.max(0, -Math.cos(a)) * Math.sin(Math.PI * t) * (1 - 0.5 * t) * 0.9, dz: -0.008 * Math.max(0, -Math.cos(a)) * Math.sin(Math.PI * t) * 0.9 }),
      0.009, () => 1);
    const inner = new THREE.Mesh(hairIn, new THREE.MeshPhysicalMaterial({ color: 0x24160f, roughness: 0.6, sheen: 0.7, sheenColor: new THREE.Color(0x6a4a36), bumpMap: bt, bumpScale: 0.8 }));
    touca.add(inner);
    // elástico fino (canal franzido) na borda
    const rim = []; for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 2, y = rimY(a), p = skull(a, y), n = V3(p.x / (rx0 * rx0), (p.y - yc) / (ry0 * ry0), (p.z - cz) / (rz0 * rz0)).normalize();
      rim.push(p.addScaledVector(n, 0.0042 + 0.0012 * Math.sin(a * 58 + ph[2]))); }
    touca.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 400, 0.0019, 6, true), new THREE.MeshPhysicalMaterial({ color: 0xeeeeea, roughness: 0.75 })));
    shadowed(touca); head.frame.add(touca);
  }

  // ══════ R2: luvas volumosas, avental, rede/touca de malha com cabelo preso, coque + abafador (caldeiras) ══════
  const canvasTex = (W, H, draw, rep) => { const c = document.createElement('canvas'); c.width = W; c.height = H; draw(c.getContext('2d'), W, H); const t = new THREE.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  // luvas: térmica (forneira, A1) = manopla acolchoada azul-acinzentada de punho longo; vaqueta (caldeiras) = punho de couro
  const quilt = canvasTex(64, 64, (g) => { g.fillStyle = '#888'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#333'; g.lineWidth = 3; for (let k = -64; k < 128; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 64, 64); g.moveTo(k + 64, 0); g.lineTo(k, 64); g.stroke(); } }, [3, 3]);
  const thermM = new THREE.MeshPhysicalMaterial({ color: 0x4d6280, roughness: 0.95, sheen: 0.6, sheenColor: new THREE.Color(0x9fb4d0), bumpMap: quilt, bumpScale: 2.5 });
  const leathM = new THREE.MeshPhysicalMaterial({ color: 0x8a5a2c, roughness: 0.72, sheen: 0.3, sheenColor: new THREE.Color(0xd8b080) });
  const gloves = { 1: [], 2: [] };
  for (const sd of ['L', 'R']) {
    // eixo da luva = antebraço → mão (sempre aponta para os dedos; o vetor mão → Finger2 saía invertido na mão esquerda)
    const w = wpos(B[sd + '_Hand']), dF = w.clone().sub(wpos(B[sd + '_Forearm'])).normalize(), up0 = Y.clone().sub(dF.clone().multiplyScalar(dF.y)).normalize(), sd3 = dF.clone().cross(up0);
    const basis = new THREE.Matrix4().makeBasis(dF, up0, sd3), q = new THREE.Quaternion().setFromRotationMatrix(basis);
    const mk = (geo, mat, c) => { const m = new THREE.Mesh(geo, mat); m.quaternion.copy(q); m.position.copy(c); m.castShadow = true; scene0.add(m); m.updateMatrixWorld(true); B[sd + '_Hand'].attach(m); return m; };
    const scene0 = stage.scene;
    // luva térmica de forno inteiriça: perfil de revolução (punho longo → mão → ponta arredondada), achatada na espessura
    // da mão, fechada na ponta e no punho (o antebraço some dentro dela; sem oco aparente) + polegar + borda dobrada no punho
    const prof = [[0.0005, -0.058], [0.03, -0.06], [0.045, -0.055], [0.05, -0.04], [0.05, -0.03], [0.054, 0.02], [0.058, 0.07], [0.055, 0.11], [0.046, 0.15], [0.032, 0.178], [0.014, 0.192], [0.0005, 0.196]]
      .map(([r, x]) => new THREE.Vector2(r, x));
    const mittG = new THREE.LatheGeometry(prof, 28).rotateZ(-Math.PI / 2).scale(1, 0.68, 1);
    const tg = null;
    const parts = [mk(mittG, thermM, w.clone()),

      mk(new THREE.CapsuleGeometry(0.019, 0.06, 6, 12).rotateZ(Math.PI / 2), thermM, wpos(B[sd + '_Finger0']).addScaledVector(dF, 0.025))];
    { const fa = wpos(B[sd + '_Forearm']), dA = w.clone().sub(fa).normalize(), upA = Y.clone().sub(dA.clone().multiplyScalar(dA.y)).normalize();
      const qA = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(dA, upA, dA.clone().cross(upA)));
      const cuffP = [[0.0005, -0.13], [0.03, -0.132], [0.05, -0.128], [0.056, -0.11], [0.052, -0.05], [0.048, 0.0], [0.046, 0.02]].map(([r, x]) => new THREE.Vector2(r, x));
      for (const [geo, off] of [[new THREE.LatheGeometry(cuffP, 24).rotateZ(-Math.PI / 2).scale(1, 0.78, 1), 0],
        [new THREE.TorusGeometry(0.055, 0.009, 10, 26).rotateY(Math.PI / 2).scale(1, 0.78, 1), -0.122]]) {
        const m = new THREE.Mesh(geo, thermM); m.quaternion.copy(qA); m.position.copy(w).addScaledVector(dA, off); m.castShadow = true;
        stage.scene.add(m); m.updateMatrixWorld(true); B[sd + '_Forearm'].attach(m); parts.push(m); } }
    gloves[1].push(...parts); void tg;
    gloves[2].push(mk(new THREE.CylinderGeometry(0.047, 0.042, 0.075, 20, 1, true).rotateZ(Math.PI / 2), leathM, w.clone().addScaledVector(dF, -0.035)));
  }
  [...gloves[1], ...gloves[2]].forEach((m) => { m.material.side = THREE.DoubleSide; m.visible = false; });

  // avental branco-cru: peito (Spine2) + saia (pivô no quadril, balança com a coxa) + alça do pescoço + cordão com laço
  const apron = { parts: [], skirtPivot: null };
  {
    const P0g = P0, prof = new Float32Array(200).fill(-99), back = new Float32Array(200).fill(99), half = new Float32Array(200).fill(0);
    for (let i = 0; i < P.count; i++) { if (grpOf[i] !== 0) continue; const x = P0g[i * 3], up = P0g[i * 3 + 2], fz = -P0g[i * 3 + 1], b = Math.round(up); if (b < 0 || b >= 200) continue;
      if (Math.abs(x) < 11) { prof[b] = Math.max(prof[b], fz); back[b] = Math.min(back[b], fz); } if (Math.abs(x) < 24 && up > 85 && up < 115) half[b] = Math.max(half[b], Math.abs(x)); }
    const zf = (u) => { let m = -99; for (let b = Math.round(u) - 2; b <= Math.round(u) + 2; b++) m = Math.max(m, prof[b] ?? -99); return m; };
    const hipZ = Math.max(...[96, 98, 100, 102].map(zf));
    const cloth = canvasTex(128, 128, (g, W, H) => { const im = g.createImageData(W, H); for (let i = 0; i < im.data.length; i += 4) { const x = (i / 4) % W, y = (i / 4 / W) | 0; const v = 200 + 25 * ((x + y) % 2) + 20 * Math.random(); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, [30, 30]);
    const am = new THREE.MeshPhysicalMaterial({ color: 0xe9e2d2, roughness: 0.9, sheen: 0.3, sheenColor: new THREE.Color(0xffffff), bumpMap: cloth, bumpScale: 0.25, side: THREE.DoubleSide });
    const sheet = (u0, u1, wTop, wBot, zOf, NU = 18, NV = 24) => {
      const pos = [], idx = [], uv = [];
      for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const t = j / NV, u = u1 + (u0 - u1) * t, hw = wTop + (wBot - wTop) * t, x = -hw + 2 * hw * i / NU;
        pos.push(x, u, zOf(u, x / hw, t)); uv.push(i / NU, t); }
      for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const toBone = (geo, bone, mat = am) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; fbx.add(m); m.updateMatrixWorld(true); bone.attach(m); apron.parts.push(m); return m; };
    // peito: 101 → 137 cm, alarga para baixo
    toBone(sheet(101, 137, 11, 16, (u, s) => Math.max(zf(u), u < 112 ? hipZ : -99) + 2.4 - 3.2 * s * s), B.Spine2);
    // saia: pivô no quadril
    const hipC = wpos(B.L_Thigh).add(wpos(B.R_Thigh)).multiplyScalar(0.5);
    const piv = holderOn(B.Pelvis); piv.position.copy(relTo(B.Pelvis, fbx.worldToLocal(hipC.clone()).toArray())); apron.skirtPivot = piv; piv.userData.q0 = piv.quaternion.clone();
    const sk = new THREE.Mesh(sheet(54, 102, 20, 24, (u, s, t) => hipZ + 2.6 + 1.2 * t - 7 * s * s + 0.5 * Math.sin(s * 9 + t * 3) * t), am); sk.castShadow = sk.receiveShadow = true;
    fbx.add(sk); sk.updateMatrixWorld(true); piv.attach(sk); apron.parts.push(sk);
    // dobra no joelho: a saia gira com a coxa (pivô), mas a parte abaixo do joelho volta a cair na vertical quando ela senta
    // (antes ficava uma "tábua" reta sobre o colo). Deformação por vértice no espaço local da saia, só quando muda.
    { const hipY = fbx.worldToLocal(hipC.clone()).y;
      apron.sk = sk; apron.base = sk.geometry.attributes.position.array.slice(); apron.lastK = -1;
      apron.axis = V3(1, 0, 0).applyQuaternion(sk.quaternion.clone().invert()).normalize();
      apron.fold = V3(0, hipY + 7, hipZ + 1.5);        // dobra da cintura: o tecido deita sobre o topo das coxas
      apron.fold2 = V3(0, hipY + 7 - 38, hipZ + 1.5); } // dobra do joelho: a barra volta a cair
    // alça do pescoço e cordão da cintura com laço nas costas
    const zN = zf(136) + 2.4;
    const strapP = [[10.5, 136.5, zN - 0.6], [8.6, 143, zN - 2.2], [6.8, 148, -2.5], [3.5, 150.2, -7.5], [0, 150.6, -9.0], [-3.5, 150.2, -7.5], [-6.8, 148, -2.5], [-8.6, 143, zN - 2.2], [-10.5, 136.5, zN - 0.6]].map((p) => V3(...p));
    { // fita plana de ~2 cm rente ao pescoço (não tubo)
      const cv3 = new THREE.CatmullRomCurve3(strapP.map((p) => (p.y > 140 ? V3(p.x * 0.92, p.y, p.z + 0.4) : p))), NS = 64, pos = [], idx = [];
      for (let k = 0; k <= NS; k++) { const u = k / NS, p = cv3.getPointAt(u), tg = cv3.getTangentAt(u), nO = V3(p.x, 0, p.z + 3.0).normalize();
        nO.sub(tg.clone().multiplyScalar(nO.dot(tg))).normalize(); const bn = tg.clone().cross(nO).normalize();
        for (const [sw, sn] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = p.clone().addScaledVector(bn, sw * 1.0).addScaledVector(nO, sn * 0.08); pos.push(q.x, q.y, q.z); } }
      for (let k = 0; k < NS; k++) for (let e = 0; e < 4; e++) { const a0 = k * 4 + e, b0 = k * 4 + (e + 1) % 4; idx.push(a0, a0 + 4, b0, b0, a0 + 4, b0 + 4); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals(); toBone(sg, B.Spine2); }
    // cintura: frente/costas/largura medidas na malha; se a medida das costas falhar (valor sentinela 99) o anel virava um
    // laço gigante fora do corpo — usa profundidade típica (~20 cm) e largura limitada a 12–17 cm de meia-largura.
    const yW = 101.5, zFr = zf(yW) + 1.6;
    let zBk = Math.min(back[100], back[101], back[102], back[103]) - 1.2;
    if (!(zBk < zFr - 10 && zFr - zBk < 32)) zBk = zFr - 21;
    const zc = (zFr + zBk) / 2, zr = (zFr - zBk) / 2, xr = Math.min(17, Math.max(12, half[101] || half[100] || 15)) + 1.4;
    const cord = []; for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2; cord.push(V3(Math.sin(a) * xr, yW, zc + Math.cos(a) * zr)); }
    toBone(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cord, true), 96, 0.8, 6, true), B.Spine);
    const bz = zc - zr - 0.8;
    for (const s of [-1, 1]) { toBone(new THREE.TorusGeometry(3.2, 0.75, 8, 20).scale(1.35, 0.75, 0.45).translate(s * 4.0, yW + 0.6, bz - 0.4), B.Spine);
      toBone(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(0, yW, bz), V3(s * 2.0, yW - 7, bz - 1.2), V3(s * 3.2, yW - 16, bz - 1.0)]), 14, 0.75, 6), B.Spine); }
  }

  // cabelo preso: massa de cabelo sob a rede (forneira) e coque baixo com rede sob o capacete (operadora)
  const hairM = new THREE.MeshPhysicalMaterial({ color: 0x24160f, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0x6a4a36), sheenRoughness: 0.4,
    bumpMap: canvasTex(64, 256, (g) => { for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) { g.fillStyle = `rgb(${(100 + 155 * Math.random()) | 0},0,0)`; g.fillRect(x, y, 1, 3); } }, [10, 2]), bumpScale: 1.5 });
  const netTex = canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke(); }, [6, 3]);
  let bun = null;
  if (head?.frame && head.debug) {
    const d = head.debug;
    bun = new THREE.Group(); bun.name = 'coque';
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16).scale(0.046, 0.038, 0.034), hairM); b.position.set(0, -0.045, d.zB - 0.012); bun.add(b);
    const n = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16).scale(0.049, 0.041, 0.037), new THREE.MeshStandardMaterial({ color: 0x1a1210, alphaMap: netTex, alphaTest: 0.5, transparent: false, roughness: 0.6, side: THREE.DoubleSide })); n.position.copy(b.position); bun.add(n);
    head.frame.add(shadowed(bun));
    // abafador tipo concha acoplado ao capacete (amarelo, almofada preta)
    const cupM = new THREE.MeshPhysicalMaterial({ color: 0xe8b400, roughness: 0.4, clearcoat: 0.5 }), padM = std(0x141414, 0.85), armM2 = std(0x222326, 0.4, 0.6);
    bun.userData.muffs = [];
    for (const s of [1, -1]) { const e = head.anchors?.[s > 0 ? 'earL' : 'earR']; if (!e) continue; const g = new THREE.Group(); g.position.copy(e.position).add(V3(s * 0.03, 0.004, -0.004)); head.frame.add(g);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.04, 0.03, 0.05).rotateZ(-s * Math.PI / 2), cupM); shell.position.x = s * 0.006; g.add(shell);
      const pad = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 8, 24).scale(1, 1.25, 1).rotateY(Math.PI / 2), padM); g.add(pad);
      const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(s * 0.03, 0.03, 0), V3(s * 0.035, 0.065, 0.004), V3(s * 0.02, 0.09, 0.006)]), 10, 0.0045, 6), armM2); g.add(arm);
      shadowed(g); bun.userData.muffs.push(g); }
  }
  // ── ambiente: forneira de branco × operadora de caldeira de azul-marinho ──
  let BM = null; try { BM = await import('./worker_boots.js'); } catch (e) { /* sem botina */ }
  let envCur = null;
  function applyEnv(env) {
    envCur = env; const w = env !== 'caldeiras';
    uni?.setEnv?.(env); bodyMat.map = w ? bodyTexW : bodyTexN; bodyMat.needsUpdate = true;
    armU.uSleeve.value.set(...(w ? [0.8, 0.79, 0.76] : [0.016, 0.027, 0.055]));
    BM?.BOOT_U?.uBootCol.value.setRGB(...(w ? [0.62, 0.62, 0.6] : [0.011, 0.01, 0.0095]));
    const P = head?.parts || {}; for (const k of ['helmet', 'glasses', 'hair', 'strap']) if (P[k]) P[k].visible = !w;
    for (const e of [head?.anchors?.earL, head?.anchors?.earR]) e?.children.forEach((c) => (c.visible = !w));
    if (touca) touca.visible = w; valve.visible = !w; if (P.hair) P.hair.visible = false;
    if (bun) { bun.visible = !w; bun.userData.muffs.forEach((m) => (m.visible = !w)); }
    apron.parts.forEach((m) => (m.visible = w));
    uni?.setTwill?.(w ? 0.22 : 0.5);
  }
  applyEnv(app?.state?.env || 'fornos');
  app?.on?.('env', (e) => applyEnv(e));

  // ── locomoção: rotas por corredores livres (cadeias de pontos até o "hub" de cada ambiente) ──
  const ST = app?.STATIONS || {};
  const envOf = (id) => ((ST[id]?.worker?.[0] ?? 0) > 25 ? 'caldeiras' : 'fornos');
  const HUB = { fornos: [6.3, 0.0], caldeiras: [47.2, 0.6] };
  const CHAIN = { forno: [[6.95, -3.3], [6.95, -0.6]], bancada: [[5.2, -0.5]], descanso: [[-5.2, 3.6], [-4.5, 0.6]],
    caldeira: [[36.2, 0.5]], valvulas: [[47.9, -5.5], [47.6, 0.4]], controle: [[51.3, 6.2], [49.85, 6.2], [49.85, 8.92], [47.4, 8.6]] };
  const SEAT = { descanso: 0.45, controle: 0.505 };
  const PATROL = { 'bancada:A4': [[5.2, -0.5], [6.6, -0.5]], 'valvulas:A4': [[47.9, -5.5], [47.9, -2.6]], 'caldeira:A1': [[35.1, -0.72, -1.88, 18]] };
  const PANEL = V3(34.62, 1.47, -0.86);
  const fwdOf = (r) => new THREE.Vector2(Math.sin(r), Math.cos(r));
  const standOf = (id) => { const s = ST[id], w = new THREE.Vector2(s.worker[0], s.worker[2]); return s.seated ? w.add(fwdOf(s.workerRotY).multiplyScalar(id === 'controle' ? 0.36 : 0.3)) : w; };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const sst = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const L = { pos: new THREE.Vector2(), head: 0, v: 0, path: null, pi: 0, mode: 'stand', queue: [], phase: 0, walkW: 0, sitW: 0, sitT: 0, from: null, to: null,
    st: null, act: 'A2', look: false, actT: 0, turnTo: 0, hipSeat: 0.54, patrol: null, pIdx: 0, wait: 0 };
  const F = { L: { p: new THREE.Vector2(), yaw: 0, lift: 0, u: 0 }, R: { p: new THREE.Vector2(), yaw: 0, lift: 0, u: 0 } }, G = { foot: null, u: 0, from: new THREE.Vector2(), fromYaw: 0, dur: 0.5, last: 'R' };
  const restFoot = (sd, x, z, h) => { const fr = footRest[sd], c = Math.cos(h), s = Math.sin(h); return new THREE.Vector2(x + fr.x * c + fr.z * s, z - fr.x * s + fr.z * c); };
  function planFeet(dt) {
    const moving = L.mode === 'walk' || L.mode === 'turn';
    if (L.sitW > 0.02) { G.foot = null; for (const sd of ['L', 'R']) { F[sd].p.copy(restFoot(sd, L.pos.x, L.pos.y, L.head)); F[sd].yaw = L.head; F[sd].lift = 0; } return; }
    const hT = L.mode === 'turn' ? L.head + Math.sign(wrap(L.turnTo - L.head)) * Math.min(0.7, Math.abs(wrap(L.turnTo - L.head))) : L.head;
    const fw = new THREE.Vector2(Math.sin(L.head), Math.cos(L.head));
    const tgtOf = (sd, u) => { if (L.mode !== 'walk') return restFoot(sd, L.pos.x, L.pos.y, hT);
      const lead = Math.min(L.rem ?? 9, L.v * G.dur * (1 - u) + 0.5 * L.v * G.dur); return restFoot(sd, L.pos.x + fw.x * lead, L.pos.y + fw.y * lead, L.head); };
    if (!G.foot) {
      const err = (sd) => F[sd].p.distanceTo(restFoot(sd, L.pos.x, L.pos.y, L.head)) + 0.3 * Math.abs(wrap(F[sd].yaw - L.head));
      if (moving || err('L') > 0.05 || err('R') > 0.05) {
        const sd = moving ? (G.last === 'L' ? 'R' : 'L') : (err('L') > err('R') ? 'L' : 'R');
        G.foot = sd; G.u = 0; G.from.copy(F[sd].p); G.fromYaw = F[sd].yaw; G.dur = L.mode === 'walk' ? Math.min(0.7, Math.max(0.5, 0.6 / Math.max(L.v, 0.3))) : 0.42;
      }
    }
    if (G.foot) { const sd = G.foot, f = F[sd]; G.dur = L.mode === 'walk' ? Math.min(0.65, Math.max(0.48, 0.55 / Math.max(L.v, 0.45))) : 0.42; G.u = Math.min(1, G.u + dt / G.dur); const e = sst(G.u);
      f.p.copy(G.from).lerp(tgtOf(sd, G.u), e); f.yaw = G.fromYaw + wrap((L.mode === 'walk' ? L.head : hT) - G.fromYaw) * e; f.u = G.u;
      f.lift = Math.sin(Math.PI * G.u) * (L.mode === 'walk' ? 0.075 : 0.04);
      if (G.u >= 1) { f.lift = 0; G.last = sd; G.foot = null; } }
  }
  const next = () => { const f = L.queue.shift(); if (f) f(); else L.mode = L.sitW > 0.5 ? 'seated' : 'stand'; };
  const walk = (pts) => () => { L.path = pts.map((p) => new THREE.Vector2(p[0] ?? p.x, p[1] ?? p.y)); L.pi = 0; L.mode = 'walk';
    const t1 = L.path.find((q) => q.distanceTo(L.pos) > 0.08); if (t1) { const hd = Math.atan2(t1.x - L.pos.x, t1.y - L.pos.y); if (Math.abs(wrap(hd - L.head)) > 0.6) { L.turnTo = L.head + wrap(hd - L.head); L.mode = 'turn'; L.queue.unshift(() => { L.mode = 'walk'; }); } } };
  const navWalk = (tg) => () => { const nav = navFor(envOf(L.st)); const p = nav?.plan(L.pos.clone(), new THREE.Vector2(tg[0], tg[1]), tripodObs()); walk(p || [[L.pos.x, L.pos.y], tg])(); };
  const turn = (r) => () => { L.turnTo = r; L.mode = 'turn'; };
  const sitDown = (id) => () => { const s = ST[id]; L.from = L.pos.clone(); L.to = new THREE.Vector2(s.worker[0], s.worker[2]).sub(fwdOf(s.workerRotY).multiplyScalar(0.03)); L.hipSeat = SEAT[id] + 0.09; L.sitT = 0; L.mode = 'sitdown'; };
  // levanta para a frente do PRÓPRIO assento (estação capturada ao enfileirar; antes usava a estação de destino e ela
  // deslizava sentada até o outro posto)
  const standUp = (seatId = L.st) => () => { L.from = L.pos.clone(); L.to = ST[seatId] ? standOf(seatId) : L.pos.clone(); L.sitT = 0; L.mode = 'standup'; };
  const NAV = {}, NAVB = { fornos: { x0: -8, x1: 8.6, z0: -6, z1: 6 }, caldeiras: { x0: 30, x1: 56, z0: -10, z1: 10 } };
  let navMod = null; import('./worker_nav.js').then((m) => (navMod = m)).catch(() => {});
  function navFor(e) {
    if (NAV[e] !== undefined || !navMod || envCur !== e) return NAV[e] || null;
    try { const skipSet = new Set([group, props, app?.meter?.rig, app?.kit?.group].filter(Boolean));
      NAV[e] = navMod.buildNav(stage.scene, { ...NAVB[e], R: 0.3, skip: (o) => skipSet.has(o) || o.userData?.noNav || o.isLight || o.isPoints || o.isSprite }); }
    catch (err) { console.warn('[worker] nav:', err); NAV[e] = null; }
    return NAV[e];
  }
  const tripodObs = () => { const r = app?.meter?.rig; if (!r) return []; const p = r.getWorldPosition(V3()); return [{ x: p.x, z: p.z, r: 0.28 }]; };
  function route(fromId, toId, cur) {
    const e = envOf(toId), sp0 = standOf(toId), nav = navFor(e);
    if (nav) { const pth = nav.plan(cur, sp0, tripodObs()); if (pth && pth.length >= 2) return pth; }
    const pts = [[cur.x, cur.y]];
    if (fromId && CHAIN[fromId]) pts.push(...CHAIN[fromId]);
    pts.push(HUB[e], ...[...CHAIN[toId]].reverse()); const sp = standOf(toId); pts.push([sp.x, sp.y]);
    return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05);
  }
  function setStation(id, { act, instant } = {}) {
    const s = ST[id]; if (!s) return;
    if (act) { if (act === 'olhando') L.look = true; else { if (act !== L.act) L.actT = 0; L.act = act; L.look = false; } }
    const sameEnv = L.st && envOf(L.st) === envOf(id);
    if (instant || !sameEnv) {
      L.queue = []; L.st = id; L.head = s.workerRotY; L.v = 0; L.walkW = 0;
      if (s.seated) { L.pos.set(s.worker[0], s.worker[2]).sub(fwdOf(s.workerRotY).multiplyScalar(0.03)); L.sitW = 1; L.hipSeat = SEAT[id] + 0.09; L.mode = 'seated'; }
      else { L.pos.set(s.worker[0], s.worker[2]); L.sitW = 0; L.mode = 'stand'; }
      for (const sd of ['L', 'R']) { F[sd].p.copy(restFoot(sd, L.pos.x, L.pos.y, L.head)); F[sd].yaw = L.head; F[sd].lift = 0; } G.foot = null;
      startPatrol(); return;
    }
    if (id === L.st && L.mode !== 'walk' && !L.patrol) { startPatrol(); return; }
    const q = [];
    if (L.mode === 'seated' || L.mode === 'sitdown') q.push(standUp(L.st));
    const from = L.mode === 'walk' ? null : L.st, cur = () => L.pos.clone();
    q.push(() => walk(route(from, id, cur()))(), turn(s.workerRotY));
    if (s.seated) q.push(sitDown(id));
    q.push(() => { startPatrol(); next(); });
    L.st = id; L.patrol = null; L.queue = q; if (L.mode === 'walk') { L.mode = 'stand'; } next();
  }
  function startPatrol() { const p = PATROL[`${L.st}:${L.act}`]; L.patrol = p ? [[ST[L.st].worker[0], ST[L.st].worker[2]], ...p] : null; L.pIdx = 0; L.wait = 1.2; }
  function locomotion(dt) {
    if (L.mode === 'walk' || L.mode === 'turn') L.sitW = Math.max(0, L.sitW - dt * 1.5);
    if (L.mode === 'walk') {
      const tgt = L.path[L.pi], d = tgt.clone().sub(L.pos), dist = d.length();
      if (dist < 0.04) { L.pi++; if (L.pi >= L.path.length) { L.v = 0; next(); } return 0; }
      let rem = dist; for (let k = L.pi + 1; k < L.path.length; k++) rem += L.path[k].distanceTo(L.path[k - 1]); L.rem = rem;
      const dh = wrap(Math.atan2(d.x, d.y) - L.head); L.head += Math.sign(dh) * Math.min(Math.abs(dh), 4.2 * dt);
      const vmax = Math.min(1.1, Math.sqrt(2 * 1.4 * rem) + 0.12) * (Math.abs(dh) > 1.0 ? 0.35 : 1);
      L.v += Math.sign(vmax - L.v) * Math.min(Math.abs(vmax - L.v), 2.0 * dt);
      const step = Math.min(L.v * dt, dist); L.pos.addScaledVector(d.normalize(), step); return step;
    }
    if (L.mode === 'turn') { const dh = wrap(L.turnTo - L.head); const r = Math.sign(dh) * Math.min(Math.abs(dh), 2.4 * dt); L.head += r; if (Math.abs(dh) < 0.01) { L.head = L.turnTo; next(); } return Math.abs(r) * 0.35; }
    if (L.mode === 'sitdown' || L.mode === 'standup') {
      L.sitT = Math.min(1, L.sitT + dt / 1.4); const k = sst(L.sitT); L.pos.copy(L.from).lerp(L.to, sst(L.sitT * 1.3 - (L.mode === 'standup' ? 0.3 : 0)));
      L.sitW = L.mode === 'sitdown' ? k : 1 - k; if (L.sitT >= 1) next(); return 0;
    }
    if (L.mode === 'stand' && L.patrol) { L.wait -= dt; if (L.wait < 0) { L.pIdx = (L.pIdx + 1) % L.patrol.length; const tg = L.patrol[L.pIdx];
      const back = L.pIdx === 0, isC = L.st === 'caldeira'; L.queue = [navWalk(tg), ...(back ? [turn(ST[L.st].workerRotY)] : tg[2] != null ? [turn(tg[2])] : []), () => { L.wait = back ? (isC ? 14 : 2.5) : (tg[3] ?? 1.0); L.mode = 'stand'; }]; next(); } }
    return 0;
  }

  let wheelSearched = false;
  function findWheel() { if (wheelSearched || !app?.cald?.group) return; wheelSearched = true;
    const W0 = V3(ST.valvulas.worker[0], 1.4, ST.valvulas.worker[2]), v = V3(); let best = null, bd = 0.8;
    app.cald.group.traverse((o) => { const hx = o.material?.color?.getHex?.(); if (!o.isMesh || (hx !== 0xc3211b && hx !== 0x1f56b0)) return;
      const P2 = o.geometry.attributes.position; o.updateWorldMatrix(true, false);
      for (let i = 0; i < P2.count; i += 3) { v.fromBufferAttribute(P2, i).applyMatrix4(o.matrixWorld); if (v.y < 0.95 || v.y > 1.85) continue; const d = Math.hypot(v.x - W0.x, v.z - W0.z); if (d < bd) { bd = d; best = v.clone(); } } });
    if (best) { valve.userData.c.copy(best); valve.visible = false; valve.userData.real = true; } }
  // ── pose por atividade ──
  const BP = (x, y, z) => { const c = Math.cos(L.head), s = Math.sin(L.head); return V3(L.pos.x + x * c + z * s, y, L.pos.y - x * s + z * c); };
  const S = { look: V3(0, 1.5, 5), lean: 0, twist: 0, hL: null, hR: null, wL: 0, wR: 0, blinkT: 2.5, blink: 0, rot: 0 };
  const smV = (cur, tgt, rate, dt) => cur.lerp(tgt, 1 - Math.exp(-rate * dt));
  const smN = (cur, tgt, rate, dt) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
  const camPos = () => stage.camera?.position?.clone() || BP(0, 1.5, 3);
  function activityPose(t) {
    const P = { lean: 0.02, twist: 0, hL: null, hR: null, look: BP(0, 1.5, 3), tray: false, baked: false, glove: 0, cup: false, pen: false, book: false, dough: false, gripL: 0.15, gripR: 0.15, fdirL: null, fdirR: null };
    const env = envOf(L.st || 'forno'), a = L.act, T = L.actT, moving = L.mode === 'walk' || L.mode === 'turn';
    if (env === 'caldeiras') P.glove = 2;
    if (env === 'fornos') {
      if (a === 'A1' && L.st === 'forno' && !moving) {
        P.glove = 1; P.tray = true; P.gripL = P.gripR = 0.85; P.fdirL = P.fdirR = 'in';
        const door = app?.machines?.doorOpen?.('forno1') ?? 0;
        let ext = 0; if (door > 0.6) { const u = (T % 7) / 7; ext = u < 0.3 ? sst(u / 0.3) : u < 0.45 ? 1 : u < 0.75 ? 1 - sst((u - 0.45) / 0.3) : 0; P.baked = u >= 0.45 || u < 0.02; }
        P.hL = BP(0.29, 1.0 + 0.03 * ext, 0.3 + 0.36 * ext); P.hR = BP(-0.29, 1.0 + 0.03 * ext, 0.3 + 0.36 * ext); P.lean = 0.08 + 0.32 * ext;
        const pb = app?.machines?.panelButton?.getWorldPosition?.(V3()) || BP(-0.5, 1.5, 0.8);
        P.look = ext > 0.1 ? BP(0, 1.05, 0.9) : (Math.floor(T / 3.5) % 3 === 1 ? pb : BP(0.1, 1.15, 0.85));
      } else if ((a === 'A4' || (a === 'A1' && moving)) ) {
        P.tray = true; P.gripL = P.gripR = 0.85; P.fdirL = P.fdirR = 'in'; P.baked = a === 'A1'; P.glove = a === 'A1' ? 1 : 0;
        P.hL = BP(0.29, 1.0, 0.3); P.hR = BP(-0.29, 1.0, 0.3); P.lean = 0.04;
      } else if (a === 'A2' && L.st === 'bancada' && !moving) {
        const w = (2 * Math.PI) / 1.25, roll = (T % 12) > 8.5, s = Math.sin(T * w);
        if (!roll) { P.hL = BP(0.12, 0.95 + 0.02 * Math.max(0, s), 0.42 + 0.07 * s); P.hR = BP(-0.12, 0.95 + 0.02 * Math.max(0, -s), 0.42 - 0.07 * s); }
        else { const o = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin(T * 3.4)); P.hL = BP(o, 0.94, 0.44 + 0.03 * Math.sin(T * 6.8)); P.hR = BP(-o, 0.94, 0.44 + 0.03 * Math.sin(T * 6.8)); }
        P.lean = 0.3 + 0.04 * s; P.look = BP(0, 0.9, 0.45); P.dough = true; P.fdirL = P.fdirR = 'down'; P.gripL = P.gripR = 0.25;
      } else if (a === 'A3' && L.mode === 'seated') {
        P.cup = true; P.gripR = 0.75; P.lean = -0.04;
        const u = (T % 11) / 11, k = u > 0.55 && u < 0.85 ? Math.sin(((u - 0.55) / 0.3) * Math.PI) : 0;
        const mouth = wpos(B.Head).addScaledVector(W(0, 0, 1), 0.1).addScaledVector(Y, -0.06);
        P.hR = BP(-0.15, 0.66, 0.24).lerp(mouth, Math.min(1, k * 1.4)); P.hL = BP(0.14, 0.64, 0.22); P.drink = k;
        P.look = k > 0.3 ? BP(0, 1.6, 1.0) : (Math.floor(T / 4) % 2 ? camPos() : BP(0.6, 1.0, 2.5));
      }
    } else {
      if (a === 'A1' && L.st === 'caldeira' && !moving && L.pos.distanceTo(new THREE.Vector2(35.1, -0.72)) < 0.3) {
        const tap = Math.max(0, Math.sin(T * 2.6)) ** 6; const dP = PANEL.clone().sub(V3(L.pos.x, 1.35, L.pos.y)).normalize(); P.hR = PANEL.clone().add(V3(0.04 * Math.sin(T * 0.7), 0.05 * Math.sin(T * 0.45), 0)).addScaledVector(dP, -0.15 - 0.02 * (1 - tap)); P.gripR = 0.35; P.fdirR = 'point'; P.lean = 0.1; P.look = PANEL.clone().add(V3(0, 0.03, 0));
      } else if (a === 'A1' && L.st === 'caldeira' && !moving) {
        const u = T % 16;
        if (u < 4) P.look = V3(35.42, 2.3, -1.44); else if (u < 7) P.look = V3(36.85, 3.48, -2.1);
        else if (u < 11) { P.look = V3(36.36, 1.49, -1.0); P.lean = 0.22; } else { P.look = V3(36.0, 1.25, -1.25); P.lean = 0.2; P.hL = V3(36.0, 1.28, -1.22); P.gripL = 0.8; }
      } else if (a === 'A2' && L.st === 'valvulas' && !moving) {
        findWheel(); const c = valve.userData.c, per = 2.2, u = (T % per) / per, rot = u < 0.75 ? sst(u / 0.75) * 0.7 : 0.7 * (1 - sst((u - 0.75) / 0.25));
        S.rot += (u < 0.75 ? 1 : 0) * 0.0; valve.userData.wheel.rotation.z = -(Math.floor(T / per) * 0.7 + (u < 0.75 ? sst(u / 0.75) * 0.7 : 0.7));
        const ang = (b) => V3(c.x + Math.cos(b) * 0.16, c.y + Math.sin(b) * 0.16, c.z + 0.025);
        P.hL = ang(Math.PI - 0.55 - rot); P.hR = ang(0.55 - rot); P.gripL = P.gripR = 0.95; P.fdirL = P.fdirR = c.clone(); P.lean = 0.1; P.look = c.clone();
      } else if (a === 'A3' && L.mode === 'seated') {
        P.book = true; P.pen = true; P.lean = 0.32;
        const bk = BP(0.03, SEAT.controle + 0.27, 0.5), wr = (T % 6) < 4.5;
        P.hR = bk.clone().add(BP(-0.07 + 0.08 * ((T * 0.25) % 1) - L.pos.x * 0, 0, 0).sub(BP(0, 0, 0))).add(V3(0, 0.03 + (wr ? 0.004 * Math.sin(T * 23) : 0.03), 0));
        P.hL = bk.clone().add(BP(0.2, 0, -0.06).sub(BP(0, 0, 0))).add(V3(0, 0.03, 0)); P.gripR = 0.7; P.fdirL = 'down'; P.fdirR = 'down';
        P.look = bk; P.bookPos = bk;
      }
    }
    if (L.look) P.look = camPos();
    else if (moving) P.look = BP(0, 1.45, 3);
    return P;
  }

  function update(dt, t) {
    dt = Math.min(dt || 0, 0.1); L.actT += dt;
    for (const [b, qr] of rest) b.quaternion.copy(qr);
    for (const b of lidRest) b.position.copy(restPos.get(b));
    locomotion(dt); planFeet(dt);
    L.walkW = smN(L.walkW, L.mode === 'walk' ? Math.min(1, L.v / 0.55) : L.mode === 'turn' ? 0.45 : 0, 7, dt);
    const ww = L.walkW, sw = L.sitW, gu = G.foot ? G.u : 0, gs = G.foot === 'L' ? 1 : G.foot === 'R' ? -1 : 0;
    const ph = gs * Math.PI * gu; // fase só para tronco
    const idle = (1 - ww) * (1 - sw), shiftLat = idle * (0.022 * Math.sin(t * 0.37) + 0.006 * Math.sin(t * 1.3));
    const bob = (G.foot ? -0.014 * Math.cos(2 * Math.PI * gu) : 0) * ww - 0.05 * ww;
    const sitDrop = (hipRest - L.hipSeat) * sw + idle * 0.02 + 0.003 * Math.sin(t * 2 * Math.PI / 4.2) * idle;
    group.position.set(L.pos.x + Math.cos(L.head) * shiftLat, bob - sitDrop, L.pos.y - Math.sin(L.head) * shiftLat);
    group.rotation.y = L.head; group.updateMatrixWorld(true); gqNow.copy(group.quaternion);
    const side = W(1, 0, 0), fwd = W(0, 0, 1), P = activityPose(t), br = Math.sin(t * 2 * Math.PI / 4.2);
    // pelve e tronco
    rotW(B.Pelvis, Y, 0.09 * Math.sin(ph) * ww); rotW(B.Pelvis, fwd, 0.035 * Math.cos(ph) * ww + 0.02 * Math.sin(t * 0.6) * (1 - ww) * (1 - sw));
    S.lean = smN(S.lean, P.lean, 4, dt);
    rotW(B.Spine, Y, -0.07 * Math.sin(ph) * ww); rotW(B.Spine1, Y, -0.06 * Math.sin(ph) * ww);
    rotW(B.Spine1, side, S.lean * 0.55 + 0.03 * ww + br * 0.01); rotW(B.Spine2, side, S.lean * 0.45 + br * 0.014);
    // pernas: IK até os pés plantados (planejador de passos) ⟷ sentada (quadril/joelho ~90°), misturadas por sitW
    const legB = ['L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot'].map((n) => B[n]);
    let qa = null;
    if (sw < 0.999) {
      for (const [sd, sx] of [['L', 1], ['R', -1]]) { const f = F[sd];
        ikB(B[sd + '_Thigh'], B[sd + '_Calf'], B[sd + '_Foot'], V3(f.p.x, ankH + f.lift, f.p.y), W(sx * 0.12, 0, 1).normalize());
        const pitch = f.lift > 0 ? (0.4 * (1 - f.u) - 0.3 * f.u) * Math.sin(Math.PI * f.u) : 0;
        setWQ(B[sd + '_Foot'], new THREE.Quaternion().setFromAxisAngle(Y, f.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), pitch)).multiply(footRest[sd].q)); }
      qa = legB.map((b) => b.quaternion.clone());
    }
    const phiS = 0.12, cs = (L.hipSeat - ankH - Lc * Math.cos(phiS)) / Lt, thS = Math.acos(Math.max(-1, Math.min(1, cs)));
    if (sw > 0.001) {
      legB.forEach((b) => b.quaternion.copy(rest.get(b))); B.Pelvis.updateMatrixWorld(true);
      for (const [sd, sx] of [['L', 1], ['R', -1]]) { rotW(B[sd + '_Thigh'], side, -thS); rotW(B[sd + '_Thigh'], fwd, -sx * 0.07); rotW(B[sd + '_Calf'], side, thS - phiS); rotW(B[sd + '_Foot'], side, phiS); }
      if (qa) legB.forEach((b, k) => b.quaternion.copy(qa[k].clone().slerp(b.quaternion, sw)));
      B.Pelvis.updateMatrixWorld(true);
    }
    let maxTh = -1;
    for (const sd of ['L', 'R']) { const d = wpos(B[sd + '_Calf']).sub(wpos(B[sd + '_Thigh'])); maxTh = Math.max(maxTh, Math.atan2(d.dot(fwd), -d.y)); }
    if (apron.skirtPivot) {
      const thp = -Math.min(1.35, Math.max(0, maxTh) * 0.9);
      // em pé/andando a saia inteira balança com a coxa (pivô); sentada, a curvatura passa para o tecido (vértices)
      apron.skirtPivot.quaternion.copy(apron.skirtPivot.userData.q0).multiply(_q.setFromAxisAngle(V3(1, 0, 0), thp * (1 - sw)));
      const kS = Math.round(sw * 40) / 40;
      if (apron.sk && kS !== apron.lastK) {
        apron.lastK = kS; const th = -1.42 * kS, b = apron.base, pa = apron.sk.geometry.attributes.position, f = apron.fold, f2 = apron.fold2, v = V3(0, 0, 0), q = new THREE.Quaternion();
        for (let i = 0; i < pa.count; i++) {
          v.set(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]);
          if (kS > 0 && v.y < f.y) {
            v.x *= 1 - 0.18 * kS * Math.min(1, (f.y - v.y) / 30); // estreita sobre as pernas juntas
            if (v.y < f2.y) { const k2 = Math.min(1, (f2.y - v.y) / 4); v.sub(f2).applyQuaternion(q.setFromAxisAngle(apron.axis, -th * 0.92 * k2)).add(f2); }
            const k1 = Math.min(1, (f.y - v.y) / 4); v.sub(f).applyQuaternion(q.setFromAxisAngle(apron.axis, th * k1)).add(f);
          }
          pa.setXYZ(i, v.x, v.y, v.z);
        }
        pa.needsUpdate = true; apron.sk.geometry.computeVertexNormals(); apron.sk.geometry.computeBoundingSphere();
      }
    }
    // cabeça (antes dos braços: clavículas são filhas do pescoço)
    S.sacT = (S.sacT ?? 0) - dt; if (S.sacT < 0) { S.sacT = 0.8 + Math.random() * 2.2; S.sac = V3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.12); }
    smV(S.look, P.look.clone().add(S.sac || V3()), 3.5, dt);
    { // Giro natural: o tronco (Spine1/Spine2) absorve o excesso acima de ~35°, o pescoço só um pouco (as clavículas são
      // filhas do pescoço — girá-lo muito deforma os ombros) e a cabeça no máximo ~45° em relação ao peito; alvo muito atrás
      // (> ~110°) é ignorado e ela olha para a frente, em vez de torcer o pescoço.
      const look = S.look.clone(); let hp0 = wpos(B.Head).add(V3(0, 0.09, 0)); let dv = look.clone().sub(hp0); const hz = Math.hypot(dv.x, dv.z);
      const bf = W(0, 0, 1); bf.y = 0; bf.normalize(); const h2 = V3(dv.x, 0, dv.z).normalize();
      let ang = Math.atan2(bf.x * h2.z - bf.z * h2.x, bf.dot(h2));
      const back = Math.abs(ang) > 1.9; S.lookW = smN(S.lookW ?? 1, back ? 0 : 1, 3, dt);
      ang *= S.lookW;
      const tw = Math.sign(ang) * Math.min(0.42, Math.max(0, Math.abs(ang) - 0.6) * 0.7);
      S.tw = smN(S.tw ?? 0, tw, 4, dt);
      rotW(B.Spine1, Y, -S.tw * 0.45); rotW(B.Spine2, Y, -S.tw * 0.55);
      hp0 = wpos(B.Head).add(V3(0, 0.09, 0));
      const lim = 0.8 + Math.abs(S.tw), a2 = Math.max(-lim, Math.min(lim, ang));
      const r = bf.clone().applyAxisAngle(Y, -a2); look.x = hp0.x + r.x * hz; look.z = hp0.z + r.z * hz;
      dv = look.clone().sub(hp0); const mx = hz * Math.tan(P.drink > 0.3 ? 0.6 : 0.5);
      if (dv.y > mx) look.y = hp0.y + mx;
      for (const [bone, k] of [[B.Neck, 0.12], [B.Head, 1]]) { const hpw = wpos(B.Head).add(V3(0, 0.09, 0));
        const fwdH = headFwdLocal.clone().applyQuaternion(B.Head.getWorldQuaternion(tq)).normalize();
        const d = new THREE.Quaternion().setFromUnitVectors(fwdH, look.clone().sub(hpw).normalize()); d.slerp(new THREE.Quaternion(), 1 - k);
        bone.getWorldQuaternion(tq); setWQ(bone, tq.premultiply(d)); } }
    // braços: alvo (IK) misturado com o balanço da caminhada
    for (const [sd, sx, tgt, grip, fdir] of [['L', 1, P.hL, P.gripL, P.fdirL], ['R', -1, P.hR, P.gripR, P.fdirR]]) {
      const key = 'h' + sd, wk = 'w' + sd;
      S[wk] = smN(S[wk], tgt ? 1 : 0, 5, dt); if (tgt) S[key] = S[key] ? smV(S[key], tgt, 9, dt) : tgt.clone();
      const opp = F[sd === 'L' ? 'R' : 'L'].p, swing = Math.max(-0.5, Math.min(0.5, ((opp.x - L.pos.x) * fwd.x + (opp.y - L.pos.y) * fwd.z) / 0.3 * 0.4)) * ww;
      const sh = wpos(B[sd + '_UpperArm']);
      const elbowDown = sh.clone().add(W(sx * 0.11, -1, 0.02 + swing).normalize().multiplyScalar(0.27));
      const handDown = elbowDown.clone().add(W(sx * 0.06, -1, 0.22 + swing * 1.4 + 0.15 * sw).normalize().multiplyScalar(0.25));
      const target = S[wk] > 0.01 && S[key] ? handDown.clone().lerp(S[key], S[wk]) : handDown;
      if (sw > 0.5 && !tgt) target.copy(BP(sx * 0.15, L.hipSeat + 0.1, 0.25));
      ik(sd, target, (L.mode === 'seated' && P.book ? W(sx * 0.35, -1, 0.05) : W(sx * 0.75, -0.55, -0.45)).normalize());
      if (fdir === 'point' && S[wk] > 0.5) aim(B[sd + '_Hand'], B[sd + '_Finger2'], PANEL, 0.85);
      if (fdir === 'down' && S[wk] > 0.5) aim(B[sd + '_Hand'], B[sd + '_Finger2'], wpos(B[sd + '_Hand']).add(W(0, -0.55, 1).normalize()), 0.7);
      if (fdir === 'in' && S[wk] > 0.5 && S.hL && S.hR) aim(B[sd + '_Hand'], B[sd + '_Finger2'], S.hL.clone().add(S.hR).multiplyScalar(0.5).add(V3(0, -0.02, 0)).addScaledVector(fwd, 0.06), 0.55);
      if (fdir?.isVector3 && S[wk] > 0.5) aim(B[sd + '_Hand'], B[sd + '_Finger2'], fdir, 0.65);
      handPose(sd, grip * Math.max(S[wk], 0.15) + 0.04 * Math.sin(t * 0.9 + (sd === 'L' ? 0 : 2)), sd === 'R' && P.pen && S[wk] > 0.5);
    }
    // adereços
    const showTray = P.tray && !!S.hL && !!S.hR && S.wL > 0.6;
    tray.visible = showTray; if (showTray) { tray.position.copy(S.hL).add(S.hR).multiplyScalar(0.5).add(V3(0, -0.03, 0)); tray.rotation.set(0, L.head, 0); setBaked(P.baked); }
    cup.visible = !!P.cup; pen.visible = !!P.pen;
    book.visible = !!P.book && !!P.bookPos; if (book.visible) { book.position.copy(P.bookPos).setY(SEAT.controle + 0.2575); book.rotation.set(0, L.head + Math.PI, 0); }
    dough.visible = !!P.dough && envCur !== 'caldeiras'; if (dough.visible) { const sq = 0.5 + 0.5 * Math.abs(Math.sin(L.actT * 2.5)); dough.position.copy(BP(0, 0.9 + 0.03, 0.44)); dough.scale.set(1 + 0.25 * sq, 0.55 - 0.12 * sq, 1.1 + 0.2 * sq); }
    gloves[1].forEach((m) => (m.visible = P.glove === 1)); gloves[2].forEach((m) => (m.visible = P.glove === 2));
    armU.uGlove.value = P.glove ? 1 : 0; armU.uGloveCol.value.set(...(P.glove === 2 ? [0.42, 0.27, 0.13] : [0.42, 0.42, 0.4]));
    // piscar
    S.blinkT -= dt; if (S.blinkT < 0) { S.blink = 0.14; S.blinkT = 2.5 + Math.random() * 3.5; }
    if (S.blink > 0) { S.blink -= dt; const k = Math.sin(Math.max(0, S.blink) / 0.14 * Math.PI);
      for (const b of lidRest) { b.parent.updateWorldMatrix(true, false); const inv = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); const s = b.parent.getWorldScale(V3()).x;
        b.position.add(V3(0, -0.0055 * k, 0.001 * k).applyQuaternion(inv).divideScalar(s)); } }
    try { head?.update?.(dt, t); } catch (e) { /* cabelo */ }
  }
  setStation(app?.env?.()?.stations?.[1] || 'bancada', { instant: true, act: 'A2' });
  update(0, 0);

  return { group, anchors, update, setStation, setActivity(a) { if (a === 'olhando') L.look = true; else { if (a !== L.act) L.actT = 0; L.act = a; L.look = false; if (L.mode === 'stand') startPatrol(); } },
    get station() { return L.st; }, get activity() { return L.act; }, debug: () => ({ mode: L.mode, pos: L.pos.toArray(), head: L.head, st: L.st, act: L.act, sitW: L.sitW }) };
}
