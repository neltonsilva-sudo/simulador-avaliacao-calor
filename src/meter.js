// MEDIDOR 3D — medidor de IBUTG eletrônico da FOTO 1 (corpo TPE azul 182 × 78 × 52 mm medido na foto pela escala do globo
// Ø 152,4 mm; painel preto brilhante com visor colorido 2,5" (fw.canvas 640×480) e 4 teclas azuis ⏻ ▶‖ ■ ≡; globo negro fosco
// em conector cromado à esquerda; bulbo seco com abrigo de 4 pratos ao centro; bulbo úmido com pavio de algodão e reservatório
// à direita) + tripé telescópico preto fosco com cabeça esférica (FOTO 2) + maleta (buildKit). Dono: MEDIDOR 3D.
// Convenções (CONTRACT.md): rig com origem no piso; −z local aponta para a fonte; visor em +z. device: origem no centro da base
// do corpo (rosca do tripé). Os 3 sensores ficam no MESMO plano horizontal (y = 168 mm) e no MESMO plano vertical (z = 0)
// — NHO-06 7.2. Bulbo úmido: ponta inferior do sensor a 25 mm da borda do reservatório; pavio cobre o sensor + 2× seu comprimento
// e desce até o fundo do reservatório (NHO-06 7.1.2).
import * as THREE from 'three';
import { roundRect, extrudeSmooth, lathe, cyl, roundedCyl, rbox, place, merge } from './meter_geo.js';
import { rubberMaps, powderMaps, knurlMaps, wickMaps, keyTex, panelTextTex, embossTex, backLabelTex, repeat, h2 } from './meter_tex.js';
import { buildTripod, HEAD_H } from './meter_tripod.js';
import { buildKitImpl, buildPisseta } from './meter_kit.js';

const MM = 0.001;
// ── dimensões (mm) ──
const BW = 182, BH = 75, BD = 52, ZF = BD / 2;
const SENSOR_Y = 168;                       // plano horizontal dos sensores (centro do globo) acima da base do corpo
const GX = -72, GR = 76.2;                  // globo Ø 152,4 mm
const DRY_X = 31, WET_X = 71;
const SENSOR_L = 14;                        // comprimento do sensor do bulbo úmido
const RIM_Y = SENSOR_Y - SENSOR_L / 2 - 25; // borda do reservatório: ponta do sensor 25 mm acima dela (NHO-06 7.1.2)
const CUP_B = 87;                           // fundo do reservatório
const PANEL = { x: 11.4, y: 33.2, w: 85.7, h: 52.3 };
const SCREEN = { x: -3.1, y: 32.6, w: 46.2, h: 34.65 };
const KEY_X = 36.6, KEY_Y = { power: 49.8, play: 38.6, stop: 27.4, menu: 16.2 }, KEY_W = 12.4, KEY_H = 10.4;
const PANEL_Z = ZF + 1.0;                   // frente do painel

// relevo procedural do corpo (mm, espaço do objeto): linha de partição frontal, friso lateral, pontos de pega, ícone sem fio,
// estrias da ponta esquerda. Normal perturbada por gradiente de superfície (independe da resolução) + oclusão das ranhuras.
const BODY_GLSL = /* glsl */`
float gDust = 0.0;
float bh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float bn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bh3(i), bh3(i + vec3(1,0,0)), f.x), mix(bh3(i + vec3(0,1,0)), bh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bh3(i + vec3(0,0,1)), bh3(i + vec3(1,0,1)), f.x), mix(bh3(i + vec3(0,1,1)), bh3(i + vec3(1,1,1)), f.x), f.y), f.z); }
varying vec3 vLoc; varying vec3 vLocN; varying vec3 vUpV; varying vec3 vRtV;
uniform sampler2D uEmb;
float gr(float d, float w) { return exp(-d * d / (w * w)); }
float smaxk(float a, float b, float k) { float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) + k * h * (1.0 - h); }
// fronteira da face frontal principal: friso curvo no topo (desce da esquerda para a direita) e vinco vertical na ponta direita
float frontD(vec3 p) {
  float t = smoothstep(-70.0, -30.0, p.x);
  float yc = mix(76.0, 64.5, t);
  return smaxk(p.y - yc, p.x - 67.5, 5.0);
}
float bodyH(vec3 p, vec3 n, out float cav, out vec2 tilt) {
  float fw = length(fwidth(p));
  float aa = clamp(2.2 - fw * 1.6, 0.0, 1.0);
  float h = 0.0; cav = 0.0; tilt = vec2(0.0);
  float wF = smoothstep(0.5, 0.85, n.z);
  float wS = 1.0 - smoothstep(0.3, 0.65, abs(n.z));
  float d = frontD(p);
  float g = gr(d, 0.55);
  float g2 = gr(d, 0.8); h += wF * (-0.55 * smoothstep(-0.5, 0.9, d) - 0.75 * g2); cav += wF * g2 * 1.1;
  // faixa superior (fora da face principal) inclinada para cima; tira da ponta direita inclinada para fora
  float o = wF * smoothstep(0.0, 1.6, d);
  float top = smoothstep(-1.0, 2.0, p.y - mix(76.0, 64.5, smoothstep(-70.0, -30.0, p.x)));
  tilt = vec2(0.22 * o * (1.0 - top) * step(60.0, p.x), 0.5 * o * top);
  // (relevo da marca na ponta esquerda removido a pedido do usuário — máscara uEmb vazia)
  vec2 uv = vec2((p.y - 13.5) / 38.0, (p.x + 85.0) / 9.0);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) { float e = texture2D(uEmb, vec2(uv.x, 1.0 - uv.y)).r; h += wF * 0.45 * e; }
  // friso de partição das duas metades da carcaça (laterais, topo e base)
  float gs = gr(p.z + 6.0, 0.48); h -= wS * 0.5 * gs; cav += wS * gs * 0.85;
  // rebarba fina do molde junto ao friso de partição
  h += wS * 0.12 * gr(p.z + 5.15, 0.16);
  // oclusão de contato: em volta das bossas dos sensores (topo) e da borda do painel (frente)
  float wT = smoothstep(0.5, 0.85, n.y);
  float eb = min(min(length(vec2((p.x - (${GX.toFixed(1)})) / 12.5, p.z / 10.0)), length(vec2((p.x - ${DRY_X.toFixed(1)}) / 11.8, p.z / 9.6))), length(vec2((p.x - ${WET_X.toFixed(1)}) / 11.8, p.z / 9.6)));
  cav += wT * (1.0 - smoothstep(0.92, 1.45, eb)) * 0.6;
  vec2 q2 = abs(p.xy - vec2(${PANEL.x.toFixed(1)}, ${PANEL.y.toFixed(1)})) - vec2(${(PANEL.w / 2 - 6).toFixed(2)}, ${(PANEL.h / 2 - 6).toFixed(2)});
  float dp = length(max(q2, 0.0)) + min(max(q2.x, q2.y), 0.0) - 6.0;
  cav += wF * step(0.0, dp) * (1.0 - smoothstep(0.0, 2.4, dp)) * 0.5;
  // poeira leve: superfícies voltadas para cima e reentrâncias
  gDust = clamp(wT * (0.25 + 0.75 * bn3(p * 0.12)) * 0.7 + cav * 0.45, 0.0, 1.0) * (0.55 + 0.45 * bn3(p * 0.9));
  cav *= aa; tilt *= mix(0.6, 1.0, aa); return h * aa;
}`;
function bodyDetail(mat) {
  const emb = embossTex();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uEmb = { value: emb };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc; varying vec3 vLocN; varying vec3 vUpV; varying vec3 vRtV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = position; vLocN = normal; vUpV = normalize(normalMatrix * vec3(0.0, 1.0, 0.0)); vRtV = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + BODY_GLSL)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float cav; vec2 tilt; float hh = bodyH(vLoc, normalize(vLocN), cav, tilt) * 0.001;
        vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
        det = abs(det) < 1e-16 ? 1e-16 : det;
        vec3 grad = (dFdx(hh) * r1 + dFdy(hh) * r2) / det;
        normal = normalize(normal - grad + vUpV * tilt.y + vRtV * tilt.x);
        diffuseColor.rgb *= 1.0 - 0.55 * clamp(cav, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.31, 0.32), 0.13 * gDust); roughnessFactor = min(1.0, roughnessFactor + 0.12 * gDust);
        roughnessFactor = min(1.0, roughnessFactor + 0.1 * clamp(cav, 0.0, 1.0)); }`)
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb *= mix(0.3, 1.0, smoothstep(0.0, 9.0, vLoc.y));');
  };
  mat.customProgramCacheKey = () => 'meterBody4';
  return mat;
}
/** "casca de laranja" sutil da pintura do globo: relevo procedural 3D (sem UV → sem arcos), some com a distância */
const NOISE_GLSL = `
      float gh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float gn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(gh3(i), gh3(i + vec3(1,0,0)), f.x), mix(gh3(i + vec3(0,1,0)), gh3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(gh3(i + vec3(0,0,1)), gh3(i + vec3(1,0,1)), f.x), mix(gh3(i + vec3(0,1,1)), gh3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
/** plástico branco usado (hastes, abrigo, copo): leve variação/encardido, oclusão nos encaixes com o corpo e no gargalo,
 *  translucidez barata (brilho difuso nas bordas, sem passe extra). occ(y): faixas de oclusão em mm (espaço do aparelho). */
function usedPlastic(mat, key, occGLSL) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vUp;' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float n = gn3(vUp * 0.22) * 0.6 + gn3(vUp * 0.9) * 0.4;
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.955, 0.94, 0.9), smoothstep(0.45, 0.85, n));
        float y = vUp.y; float occ = 1.0; ${occGLSL}
        diffuseColor.rgb *= occ; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0); totalEmissiveRadiance += diffuseColor.rgb * 0.05 * pow(1.0 - nv, 2.0); }`);
  };
  mat.customProgramCacheKey = () => 'meterPlastic_' + key;
  return mat;
}
function globePeel(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGp = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vGp;
      float gh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float gn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(gh3(i), gh3(i + vec3(1,0,0)), f.x), mix(gh3(i + vec3(0,1,0)), gh3(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(gh3(i + vec3(0,0,1)), gh3(i + vec3(1,0,1)), f.x), mix(gh3(i + vec3(0,1,1)), gh3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { vec3 wn = (vec4(normal, 0.0) * viewMatrix).xyz; float dn = clamp(-wn.y, 0.0, 1.0);
        totalEmissiveRadiance += vec3(0.055, 0.06, 0.066) * (0.35 + 0.65 * dn) * dn; }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { float fw = length(fwidth(vGp)); float aa = clamp(1.6 - fw * 1.2, 0.0, 1.0);
        float hh = (gn3(vGp * 0.75) * 0.6 + gn3(vGp * 1.9) * 0.4) * 0.035 * aa * 0.001;
        vec3 sp = -vViewPosition; vec3 dpx = dFdx(sp), dpy = dFdy(sp);
        vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1); det = abs(det) < 1e-16 ? 1e-16 : det;
        normal = normalize(normal - (dFdx(hh) * r1 + dFdy(hh) * r2) / det); }`);
  };
  mat.customProgramCacheKey = () => 'meterGlobe2';
  return mat;
}
/** casca de contorno (realce): infla a malha ao longo da normal, faces de trás */
function outlineOf(mesh, thick = 1.2) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.12).multiplyScalar(1.7), side: THREE.BackSide, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${thick.toFixed(3)};`); };
  mat.customProgramCacheKey = () => 'meterOutline' + thick.toFixed(3);
  const o = new THREE.Mesh(mesh.geometry, mat); o.visible = false; o.renderOrder = 3; o.userData.noAO = true; o.raycast = () => {}; o.castShadow = false;
  mesh.add(o); return o;
}

export function buildMeter(stage, fw, app) {
  const device = new THREE.Group(); device.name = 'medidorIBUTG';
  const D = new THREE.Group(); D.scale.setScalar(MM); device.add(D);
  const meshes = [];
  const add = (g, m, parent = D, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; parent.add(o); meshes.push(o); return o; };

  // ── materiais ──
  const rm = rubberMaps(), pm = powderMaps(), km = knurlMaps(), wm = wickMaps();
  const bodyMat = bodyDetail(new THREE.MeshPhysicalMaterial({ color: 0x0a8cff, roughness: 0.56, roughnessMap: repeat(rm.rough, 1 / 70), normalMap: repeat(rm.normal, 1 / 20), normalScale: new THREE.Vector2(0.5, 0.5),
    sheen: 0.3, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x3d8bff), specularIntensity: 0.85 }));
  const panelMat = new THREE.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.035, specularIntensity: 0.8 });
  const blackRub = new THREE.MeshStandardMaterial({ color: 0x0f1011, roughness: 0.8, normalMap: repeat(rm.normal, 1 / 6), normalScale: new THREE.Vector2(0.4, 0.4) });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe4e6e9, roughness: 0.16, metalness: 1, normalMap: repeat(km.normal, 3, 3.5), normalScale: new THREE.Vector2(0.55, 0.55) });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6d7278, roughness: 0.34, metalness: 1 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a463, roughness: 0.3, metalness: 1 });
  // preto fosco (pintura eletrostática): brilho largo e suave, sem mapa normal (evita ondulações em arcos ao longo das latitudes)
  const globeMat = globePeel(new THREE.MeshPhysicalMaterial({ color: 0x1b1d20, roughness: 0.4, specularIntensity: 0.9, envMapIntensity: 1.4, clearcoat: 0.18, clearcoatRoughness: 0.5, sheen: 0.3, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x7d8a99) }));
  const white = usedPlastic(new THREE.MeshPhysicalMaterial({ color: 0xfafaf8, roughness: 0.36, clearcoat: 0.15, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: new THREE.Color(0xffffff), normalMap: repeat(rm.normal, 1, 1), normalScale: new THREE.Vector2(0.04, 0.04) }), 'white',
    'occ *= mix(0.62, 1.0, smoothstep(BH + 4.0, BH + 16.0, y)); float rr = length(vUp.xz - vec2(DRY_X, 0.0)); occ *= mix(1.0, mix(0.68, 1.0, smoothstep(5.0, 9.0, rr)), step(155.0, y) * step(rr, 16.0));'.replace(/BH/g, BH.toFixed(1)).replace(/DRY_X/g, DRY_X.toFixed(1)));
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0xb4c2c6, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 1.8, specularIntensity: 1, depthWrite: false });
  const wickMat = new THREE.MeshPhysicalMaterial({ map: repeat(wm.color.limpo, 4, 4), normalMap: repeat(wm.normal, 4, 4), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.6,
    sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(0xffffff) });
  const wickU = { wet: { value: 1 } };
  wickMat.onBeforeCompile = (sh) => {
    sh.uniforms.uWet = wickU.wet;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWy = position.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWy; uniform float uWet;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float band = 1.0 - smoothstep(${RIM_Y.toFixed(1)} - 2.0, ${RIM_Y.toFixed(1)} + 34.0, vWy);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.8, 0.82, 0.83), band * uWet); }`);
  };
  wickMat.customProgramCacheKey = () => 'meterWick1';
  const wickMaps3 = { limpo: wickMat.map, sujo: repeat(wm.color.sujo, 4, 4), seco: repeat(wm.color.seco, 4, 4) };

  // ── corpo ──
  const bodyGeo = extrudeSmooth(roundRect(BW, BH, 11, 0, BH / 2), BD, { bt: 6.5, bs: 6.5, seg: 7, curve: 18, uvScale: 1 });
  const body = add(bodyGeo, bodyMat); body.name = 'corpo';
  // painel frontal de acrílico preto brilhante
  const panel = add(extrudeSmooth(roundRect(PANEL.w, PANEL.h, 6), 1.8, { bt: 0.6, bs: 0.6, seg: 3, curve: 12 }), panelMat);
  panel.position.set(PANEL.x, PANEL.y, PANEL_Z - 0.9);
  // visor: área inativa (moldura do LCD) + área ativa com fw.canvas (emissivo) sob o vidro (clearcoat)
  const lcdFrame = add(new THREE.PlaneGeometry(SCREEN.w + 3.2, SCREEN.h + 3.0), new THREE.MeshPhysicalMaterial({ color: 0x010102, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1 }), D, false);
  lcdFrame.position.set(SCREEN.x, SCREEN.y, PANEL_Z + 0.02);
  let screenTex = null;
  if (fw?.canvas) { screenTex = new THREE.CanvasTexture(fw.canvas); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = stage.renderer?.capabilities?.getMaxAnisotropy?.() || 16; }
  // visor em alta resolução (fw.drawHi) enquanto o aparelho está na vitrine
  let hiCv = null, hiCtx = null, hiTex = null;
  if (fw?.drawHi) { hiCv = document.createElement('canvas'); hiCv.width = 1280; hiCv.height = 960; hiCtx = hiCv.getContext('2d'); hiTex = new THREE.CanvasTexture(hiCv); hiTex.colorSpace = THREE.SRGBColorSpace; hiTex.anisotropy = screenTex?.anisotropy || 16; }
  const screenMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.025, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: screenTex ? 1.3 : 0, toneMapped: false }); // branco do TFT sem acinzentar no tonemap
  const screen = add(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat, D, false); screen.name = 'visor';
  screen.position.set(SCREEN.x, SCREEN.y, PANEL_Z + 0.04); screen.userData.noBloom = false;
  // nome do modelo "iTemp" serigrafado (sem logotipo de fabricante)
  const txt = add(new THREE.PlaneGeometry(PANEL.w, PANEL.h), new THREE.MeshStandardMaterial({ map: panelTextTex(PANEL.w, PANEL.h, [
    { x: SCREEN.x - PANEL.x, y: 54.5 - 1.6 - PANEL.y, size: 4.6, weight: 500, gap: 0.25, parts: [['i', '#8fd0ff', 800], ['temp', '#f4f6f8']] },
  ]), transparent: true, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -2 }), D, false);
  txt.position.set(PANEL.x, PANEL.y, PANEL_Z + 0.03);
  // teclas: quadrados arredondados azuis com ícone branco, levemente abaulados; afundam ao clicar
  const keyGeo = (() => {
    const g = extrudeSmooth(roundRect(KEY_W, KEY_H, 3.4), 3.2, { bt: 1.3, bs: 1.3, seg: 5, curve: 10, uv: 'planar' });
    g.translate(0, 0, 0.9);
    return g;
  })();
  const keys = {}, keyRest = {}, keyOutline = {};
  for (const k of ['power', 'play', 'stop', 'menu']) {
    const m = add(keyGeo, new THREE.MeshPhysicalMaterial({ map: keyTex(k), bumpMap: keyTex(k), bumpScale: 0.7, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.45, sheenRoughness: 0.35, sheenColor: new THREE.Color(0x9fd0ff), emissive: 0x0b3a6e, emissiveIntensity: 0.12 }));
    m.position.set(KEY_X, KEY_Y[k], PANEL_Z); m.userData.key = k; m.name = 'tecla_' + k; keys[k] = m; keyRest[k] = PANEL_Z;
    keyOutline[k] = outlineOf(m, 0.8);
  }
  // destaque de tecla: halo âmbar suave no painel ao redor da tecla (aditivo, pulsa) + a própria tecla acende
  const keyHalo = {};
  { keyGeo.computeBoundingBox(); const bb = keyGeo.boundingBox, kw = bb.max.x - bb.min.x, kh = bb.max.y - bb.min.y;
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.filter = 'blur(16px)'; g.fillStyle = 'rgba(255,190,70,0.85)'; rr(52, 52, 152, 152, 34); g.fill();
    g.filter = 'none'; g.strokeStyle = 'rgba(255,235,170,1)'; g.lineWidth = 9; rr(70, 70, 116, 116, 24); g.stroke();
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    for (const k in keys) {
      const hm = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(2.2, 1.9, 1.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 });
      const h = new THREE.Mesh(new THREE.PlaneGeometry(kw * 2.6, kh * 2.6), hm); h.position.set(KEY_X, KEY_Y[k], PANEL_Z + 0.35); h.renderOrder = 4; h.visible = false; h.raycast = () => {}; h.userData.noAO = true;
      D.add(h); keyHalo[k] = h;
    }
  }
  // borracha preta: vãos das teclas, ilhoses das hastes, anel de vedação do globo, pés, tampa USB, rebaixos dos parafusos
  const rub = [];
  rub.push(roundedCyl(6.4, 2.6, 1.0, 32, BH + 12.0).translate(GX, 0, 0));
  for (const [x, z] of [[-74, -15], [74, -15], [-74, 15], [74, 15]]) rub.push(roundedCyl(4.2, 1.4, 0.6, 20, -0.7).translate(x, 0, z));
  rub.push(rbox(2.4, 24, 11, 1.1).translate(BW / 2 + 0.2, 38, 0), rbox(3.0, 4, 6, 1).translate(BW / 2 + 1.0, 50.5, 0));
  for (const [x, y] of [[-80, 12], [80, 12], [-80, 63], [80, 63]]) rub.push(new THREE.RingGeometry(2.6, 3.7, 24).rotateY(Math.PI).translate(x, y, -ZF - 0.05));
  const rubMesh = add(merge(rub), blackRub);
  // ressaltos azuis de borracha na base de cada sensor (FOTO 1)
  const boss = (x, w, d) => [
    extrudeSmooth(roundRect(w, d, d / 2), 7.0, { bt: 2.6, bs: 2.6, seg: 6, curve: 16 }).rotateX(-Math.PI / 2).translate(x, BH + 1.1, 0),          // bossa oval
    extrudeSmooth(roundRect(w + 7, d + 6, (d + 6) / 2), 4.0, { bt: 1.9, bs: 3.2, seg: 6, curve: 16 }).rotateX(-Math.PI / 2).translate(x, BH - 0.9, 0), // concordância (filete) com o topo
  ];
  const pads = add(merge([...boss(GX, 17, 13), ...boss(DRY_X, 15.5, 12), ...boss(WET_X, 15.5, 12)]), bodyMat);
  // parafusos Phillips na traseira + inserto 1/4" na base
  const scr = [];
  for (const [x, y] of [[-80, 12], [80, 12], [-80, 63], [80, 63]]) {
    scr.push(lathe([[0, 0], [2.6, 0], [2.6, 0.5], [2.2, 1.1], [0, 1.25]], 20).rotateX(-Math.PI / 2).translate(x, y, -ZF + 0.2));
  }
  add(merge(scr), steel, D, false);
  const cross = [];
  for (const [x, y] of [[-80, 12], [80, 12], [-80, 63], [80, 63]]) cross.push(new THREE.PlaneGeometry(2.6, 0.55).translate(x, y, 0), new THREE.PlaneGeometry(0.55, 2.6).translate(x, y, 0));
  const crossMesh = add(merge(cross.map((g) => g.rotateY(Math.PI).translate(0, 0, -ZF - 1.07))), new THREE.MeshBasicMaterial({ color: 0x08090a }), D, false);
  crossMesh.position.z = 0;
  add(lathe([[3.2, -0.05], [5.6, -0.05], [5.6, 0.4], [3.2, 0.4]], 24), brass, D, false);
  add(new THREE.CircleGeometry(3.2, 20).rotateX(Math.PI / 2).translate(0, 0.3, 0), new THREE.MeshBasicMaterial({ color: 0x050505 }), D, false);
  // etiqueta prateada da traseira
  const back = add(new THREE.PlaneGeometry(66, 33), new THREE.MeshStandardMaterial({ map: backLabelTex(), roughness: 0.32, metalness: 0.35 }), D, false);
  back.rotation.y = Math.PI; back.position.set(0, 37.5, -ZF - 0.08);

  // ── globo negro fosco Ø 152,4 mm (duas semiesferas com aba na junção equatorial) + conector cromado recartilhado ──
  const conn = add(lathe([[0, BH], [8.6, BH], [8.6, BH + 1.6], [7.1, BH + 2.4], [7.1, BH + 11.4], [5.8, BH + 12.2], [4.6, BH + 12.2], [4.6, SENSOR_Y - GR + 3], [0, SENSOR_Y - GR + 3]], 40, 1 / 12).translate(GX, 0, 0), chrome);
  conn.name = 'conector';
  const globeG = new THREE.Group(); globeG.position.set(GX, SENSOR_Y, 0); D.add(globeG);
  const gp = [];
  const a0 = -Math.PI / 2 + Math.asin(6.2 / GR);
  for (let i = 0; i <= 90; i++) { const a = a0 + (i / 90) * (-0.004 - a0); gp.push([GR * Math.cos(a), GR * Math.sin(a)]); }
  gp.push([GR + 0.05, -0.3], [GR + 0.5, -0.28], [GR + 0.68, 0.05], [GR + 0.7, 1.15], [GR + 0.5, 1.6], [GR + 0.22, 1.85]);
  const RU = GR + 0.12;
  const a1 = Math.asin(1.95 / RU);
  for (let i = 0; i <= 96; i++) { const a = a1 + (i / 96) * (Math.PI / 2 - a1); gp.push([Math.max(0, RU * Math.cos(a)), RU * Math.sin(a)]); }
  gp.unshift([4.6, -GR + 0.5]);
  const globe = add(lathe(gp, 128, 1 / 40), globeMat, globeG); globe.name = 'globo';

  // ── bulbo seco: haste branca + abrigo contra radiação (4 pratos empilhados com colunas) ──
  const dry = [];
  dry.push(lathe([[0, BH + 4.4], [4.4, BH + 4.4], [4.4, 154], [3.6, 155.5], [3.6, 182], [0, 182]], 28, 1 / 40).translate(DRY_X, 0, 0));
  // pratos abaulados (contorno fechado, normais para fora): fundo plano, borda arredondada, topo em cúpula
  // pratos finos (≈2,4 mm), cônicos, côncavos por baixo, borda viva; frestas escuras entre eles; colunas internas
  const plate = (yb, top) => lathe(top
    ? [[0, yb + 4.4], [6, yb + 3.0], [12, yb + 0.6], [14.4, yb - 0.4], [14.6, yb + 0.35], [13.6, yb + 2.7], [11.2, yb + 5.4], [7.2, yb + 7.6], [3.4, yb + 8.6], [0, yb + 8.9]]
    : [[5.6, yb + 3.0], [12, yb + 0.6], [14.4, yb - 0.4], [14.6, yb + 0.35], [12, yb + 3.0], [5.6, yb + 5.4], [5.6, yb + 3.0]], 48, 1 / 40).translate(DRY_X, 0, 0);
  for (const yb of [156.0, 163.8, 171.6]) dry.push(plate(yb, false));
  dry.push(plate(179.4, true));
  for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3 + 0.4; dry.push(cyl(1.15, 25, 156, 8).translate(DRY_X + Math.cos(a) * 9.8, 0, Math.sin(a) * 9.8)); }
  const dryMesh = add(merge(dry), white); dryMesh.name = 'bulbo_seco';

  // ── bulbo úmido: haste, gargalo, reservatório (copo branco), água, pavio de algodão ──
  // copo em tronco de cone com aba saliente de 8 mm no topo, fundo arredondado; gargalo e haste brancos
  const cupProfile = [[0, CUP_B], [15.8, CUP_B], [18.4, CUP_B + 0.9], [19.4, CUP_B + 3.4], [21.9, RIM_Y - 8.6], [22.2, RIM_Y - 8.2], [24.3, RIM_Y - 8.1], [25.0, RIM_Y - 7.4],
    [25.1, RIM_Y - 1.0], [24.6, RIM_Y], [23.2, RIM_Y], [22.9, RIM_Y - 0.8], [20.6, RIM_Y - 8.6], [18.0, CUP_B + 3.4], [17.0, CUP_B + 2.8], [0, CUP_B + 2.8]];
  const cupGeo = merge([lathe(cupProfile, 64, 1 / 40), lathe([[0, BH + 4.4], [5.2, BH + 4.4], [5.2, CUP_B - 4.6], [8.4, CUP_B - 4.4], [8.6, CUP_B - 3.6], [8.6, CUP_B + 0.5], [0, CUP_B + 0.5]], 32, 1 / 40)]).translate(WET_X, 0, 0);
  const cupMat = usedPlastic(new THREE.MeshPhysicalMaterial({ color: 0xf6f5f1, roughness: 0.32, clearcoat: 0.25, clearcoatRoughness: 0.3, sheen: 0.5, sheenRoughness: 0.3, sheenColor: new THREE.Color(0xffffff), specularIntensity: 0.8 }), 'cup',
    'occ *= mix(0.6, 1.0, smoothstep(BH + 4.0, BH + 14.0, y)); occ *= mix(0.72, 1.0, smoothstep(CUP_B - 4.5, CUP_B + 5.0, y) + step(CUP_B + 5.0, y)); occ *= mix(0.8, 1.0, smoothstep(RIM_Y - 9.5, RIM_Y - 7.0, y) + step(y, RIM_Y - 12.0));'.replace(/BH/g, BH.toFixed(1)).replace(/CUP_B/g, CUP_B.toFixed(1)).replace(/RIM_Y/g, RIM_Y.toFixed(1)));
  const cup = add(cupGeo, cupMat); cup.name = 'reservatorio';
  const water = add(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), waterMat, D, false); water.position.set(WET_X, CUP_B + 10, 0); water.renderOrder = 2; water.name = 'agua';
  { // menisco: anel junto à parede que sobe ~0,9 mm (curvo) — pega o reflexo do ambiente
    const mg = new THREE.RingGeometry(0.86, 1.0, 48, 4).rotateX(-Math.PI / 2); const P = mg.attributes.position;
    for (let i = 0; i < P.count; i++) { const r = Math.hypot(P.getX(i), P.getZ(i)); const t = (r - 0.86) / 0.14; P.setY(i, 0.05 + 0.9 * t * t); }
    mg.computeVertexNormals(); const men = new THREE.Mesh(mg, waterMat); men.renderOrder = 2; men.raycast = () => {}; water.add(men); }
  const wickG = new THREE.Group(); wickG.position.set(WET_X, 0, 0); D.add(wickG);
  const WTOP = SENSOR_Y + SENSOR_L / 2 + 2.5;
  const wickProf = [[0, CUP_B + 3.0], [6.6, CUP_B + 3.0], [5.9, CUP_B + 6], [5.6, CUP_B + 12], [5.5, RIM_Y], [5.2, WTOP - 2.5], [4.9, WTOP - 0.8], [3.8, WTOP], [0, WTOP]];
  const wickGeo = lathe(wickProf, 40, 1 / 40);
  { // tecido: leve ondulação irregular do tubo (não é um cilindro rígido)
    const P = wickGeo.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), r = Math.hypot(x, z); if (r < 0.5) continue; const a = Math.atan2(z, x);
      const yy = y * 0.32, yi = Math.floor(yy), yf = yy - yi, ys = yf * yf * (3 - 2 * yf); const rn = h2(yi, 7, 3) * (1 - ys) + h2(yi + 1, 7, 3) * ys;
      const k = 1 + 0.045 * Math.sin(a * 3 + y * 0.21) + 0.03 * Math.sin(a * 5 - y * 0.37) + 0.1 * (rn - 0.5) + 0.025 * Math.sin(a * 2 + 1.3);
      const bend = Math.max(0, y - RIM_Y) * 0.02; P.setXYZ(i, x * k + bend * 0.6, y, z * k); }
    wickGeo.computeVertexNormals();
  }
  const wick = add(wickGeo, wickMat, wickG); wick.name = 'pavio';
  // ponta do pavio: tecido dobrado e amarrado, fibras soltas (irregular)
  const tipG = new THREE.IcosahedronGeometry(1, 3); { const P = tipG.attributes.position; for (let i = 0; i < P.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(P, i); const n = 1 + 0.07 * (h2(Math.round(v.x * 7), Math.round(v.y * 7), Math.round(v.z * 7)) - 0.5) + 0.08 * Math.sin(v.y * 9 + v.x * 5); v.multiplyScalar(n); P.setXYZ(i, v.x * 5.0 + v.y * 1.2 + (WTOP - RIM_Y) * 0.012, v.y * 4.2 + WTOP + 1.0, v.z * 4.3); } tipG.computeVertexNormals(); }
  const tipMat = new THREE.MeshPhysicalMaterial({ color: 0xf4efe2, roughness: 0.9, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xfff7e8), normalMap: repeat(wm.normal, 2, 2), normalScale: new THREE.Vector2(1.2, 1.2) });
  { // fiapos soltos na ponta do pavio
    const fib = [tipG];
    for (let k = 0; k < 9; k++) { const a = h2(k, 1, 9) * Math.PI * 2, el = 0.35 + 0.6 * h2(k, 2, 9), L = 2.5 + 4 * h2(k, 3, 9);
      const o = new THREE.Vector3(Math.cos(a) * 3.6 + (WTOP - RIM_Y) * 0.012, WTOP + 2.0 + 1.5 * h2(k, 4, 9), Math.sin(a) * 3.2);
      const d = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
      const c = new THREE.QuadraticBezierCurve3(o, o.clone().addScaledVector(d, L * 0.6), o.clone().addScaledVector(d, L).add(new THREE.Vector3(0, -L * 0.35, 0)));
      fib.push(new THREE.TubeGeometry(c, 6, 0.09 + 0.05 * h2(k, 5, 9), 4, false)); }
    tipG.dispose(); var tipAll = merge(fib);
  }
  const wickTip = add(tipAll, tipMat, wickG); wickTip.name = 'pavio_ponta';

  // sombra de contato (oclusão suave sob a base) — só quando o aparelho está apoiado na vitrine/mesa, fora do tripé
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 192; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 192); g.filter = 'blur(16px)'; g.fillStyle = 'rgb(150,150,150)'; g.beginPath(); g.roundRect(40, 36, 432, 120, 50); g.fill();
    g.filter = 'blur(4px)'; g.fillStyle = 'rgb(235,235,235)'; g.beginPath(); g.roundRect(74, 64, 364, 64, 20); g.fill();
    const t = new THREE.CanvasTexture(c); return t; })();
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(BW * 1.35, BD * 3.0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  blob.position.y = 0.25; blob.renderOrder = 1; blob.raycast = () => {}; blob.visible = false; D.add(blob);

  // luz de produto da vitrine: softbox alto à esquerda, rebatedor à direita e recorte por trás (RectAreaLight; sem sombra)
  const prodLights = new THREE.Group(); prodLights.name = 'luzVitrine'; prodLights.matrixAutoUpdate = false; prodLights.visible = false;
  const ctr = new THREE.Vector3(-0.03, 0.14, 0);
  const rect = (col, I, w, h, pos) => { const l = new THREE.RectAreaLight(col, I, w, h); l.position.set(...pos); l.lookAt(ctr); prodLights.add(l); return l; };
  rect(0xfff6ea, 13, 0.6, 0.45, [-0.34, 0.66, 0.36]);   // softbox principal, alto à esquerda (ilumina ombros e topo do globo)
  rect(0xeef3ff, 6, 0.6, 0.12, [0.25, 0.42, -0.4]);    // recorte/rebatedor por trás à direita (bordas do globo e ombros)
  stage.scene.add(prodLights); let frameN = 0;

  // ── tripé ──
  const tri = buildTripod();
  const rig = tri.rig, mountPoint = tri.mountPoint;
  mountPoint.add(device);
  const globeCenter = new THREE.Object3D(); globeCenter.name = 'globeCenter'; globeCenter.position.set(GX * MM, SENSOR_Y * MM, 0); device.add(globeCenter);
  stage.scene.add(rig);

  // ── estado ──
  let water01 = app?.state?.water ?? 1, waterLevel = water01, wickKind = app?.state?.wick ?? 'limpo', wet = 1, fillOverride = null;
  const press = { power: 0, play: 0, stop: 0, menu: 0 }, pulses = {}, held = new Map();
  const tweens = new Set();
  const tween = (dur, fn) => new Promise((res) => { const tw = { t: 0, dur, fn, res }; fn(0); tweens.add(tw); });
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2), eout = (x) => 1 - (1 - x) ** 3;
  const cupR = (y) => { const k = THREE.MathUtils.clamp((y - (CUP_B + 3.4)) / (RIM_Y - 8.6 - (CUP_B + 3.4)), 0, 1); return Math.min(22.6, 18.0 + (20.6 - 18.0) * k) - 0.15; };
  function applyWater() {
    const lvl = fillOverride ?? waterLevel;
    const y = CUP_B + 3.4 + lvl * (RIM_Y - 3.5 - (CUP_B + 3.4));
    water.visible = lvl > 0.01; water.position.y = y; const r = cupR(y); water.scale.set(r, 1, r);
  }
  function applyWick() {
    wickMat.map = wickMaps3[wickKind] || wickMaps3.limpo;
    // molhado: tecido mais escuro, fibras assentadas, leve brilho; seco: branco, felpudo, fosco
    const w = wet, dirty = wickKind === 'sujo';
    wickMat.color.setRGB(1.0, 0.985, 0.95).multiplyScalar(1 - 0.05 * w);
    wickMat.roughness = 0.93 - 0.4 * w; wickMat.sheen = 1 - 0.65 * w; wickMat.normalScale.setScalar(1.0 - 0.3 * w); wickU.wet.value = w;
    tipMat.color.set(dirty ? 0xb79f78 : 0xf4efe2).multiplyScalar(1 - 0.05 * w);
  }
  function setHeight(h) { tri.setPlate(h - SENSOR_Y * MM); }
  function setWater(v) { water01 = THREE.MathUtils.clamp(+v || 0, 0, 1); }
  function setWick(w) { if (['limpo', 'sujo', 'seco'].includes(w)) { wickKind = w; if (w === 'seco') wet = Math.min(wet, 0.15); applyWick(); } }

  // ── realce ──
  const OL = {
    globe: [outlineOf(globe, 1.6)], dry: [outlineOf(dryMesh, 0.9)], reservoir: [outlineOf(cup, 0.9)], wick: [outlineOf(wick, 0.8), outlineOf(wickTip, 0.15)],
    tripod: tri.meshes.map((m) => outlineOf(m, 1.6)),
  };
  OL.wet = [...OL.reservoir, ...OL.wick];
  for (const k in keyOutline) OL[k] = [keyOutline[k]];
  { // moldura luminosa em volta do visor
    const s = roundRect(SCREEN.w + 6, SCREEN.h + 6, 2.5); s.holes.push(roundRect(SCREEN.w + 3.2, SCREEN.h + 3.2, 1.5, 0, 0, THREE.Path));
    const fr = new THREE.Mesh(new THREE.ShapeGeometry(s, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.12).multiplyScalar(1.7), transparent: true, depthWrite: false, toneMapped: false }));
    fr.position.set(SCREEN.x, SCREEN.y, PANEL_Z + 0.08); fr.visible = false; fr.renderOrder = 3; fr.userData.noAO = true; fr.raycast = () => {}; D.add(fr); OL.screen = [fr];
  }
  let hl = null, hlT = 0;
  function highlight(name) {
    hl = name || null; hlT = 0;
    for (const k in OL) OL[k].forEach((o) => (o.visible = false));
    (OL[hl] || []).forEach((o) => (o.visible = true));
    for (const k in keyHalo) { const on = hl === k || hl === 'keys' || hl === 'all'; keyHalo[k].visible = on; if (!on) { keys[k].material.emissive.setHex(0x0b3a6e); keys[k].material.emissiveIntensity = 0.12; } }
  }
  let flashKey = null, flashT = 0;
  /** acende a tecla apertada por ~0,9 s (além do destaque do passo) */
  function flash(key, ms = 900) { const k = String(key).split('+')[0]; if (keys[k]) { flashKey = k; flashT = ms / 1000; } }
  function pressAnim(key) { if (key in press) pulses[key] = 0.22; flash(key); }

  // ── interação: clique/segure nas teclas do aparelho 3D → fw.press(key, holdMs). ⏻ segurada 2 s dispara na hora. ──
  const cv = stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); const keyMeshes = Object.values(keys);
  function pick(e) {
    if (!stage.camera || !device.visible) return null; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(keyMeshes, false)[0]; return hit ? hit.object.userData.key : null;
  }
  const holding = (k) => [...held.values()].some((h) => h.key === k && !h.fired);
  function fire(key, ms) { pressAnim(key); try { fw?.press?.(key, Math.round(ms)); } catch (err) { console.error('[meter] fw.press', err); } app?.emit?.('change'); }
  if (cv) {
    cv.addEventListener('pointerdown', (e) => {
      const k = pick(e); if (!k) return;
      e.stopImmediatePropagation(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
      if (stage.controls) stage.controls.enabled = false;
      held.set(e.pointerId, { key: k, t0: performance.now(), fired: false });
    }, { capture: true });
    const up = (e) => {
      const h = held.get(e.pointerId); if (!h) return; held.delete(e.pointerId);
      if (!h.fired) fire(h.key, performance.now() - h.t0);
      if (!held.size && stage.controls) stage.controls.enabled = true;
    };
    cv.addEventListener('pointerup', up, { capture: true }); cv.addEventListener('pointercancel', up, { capture: true });
    let last = 0;
    cv.addEventListener('pointermove', (e) => { const n = performance.now(); if (n - last < 60 || held.size) return; last = n;
      const k = pick(e); if (k) { cv.style.cursor = 'pointer'; cv.__meterHover = true; } else if (cv.__meterHover) { cv.style.cursor = ''; cv.__meterHover = false; } });
  }

  // ── animações da montagem ──
  let pis = null;
  async function animate(step) {
    if (step === 'globe') {
      globeG.position.y = SENSOR_Y + 70; globeG.rotation.y = 0;
      await tween(0.75, (t) => { globeG.position.y = SENSOR_Y + 12 + 58 * (1 - eout(t)); });
      await tween(1.5, (t) => { const e = ease(t); globeG.position.y = SENSOR_Y + 12 * (1 - e); globeG.rotation.y = -3 * Math.PI * (1 - e); });
      globeG.position.y = SENSOR_Y; globeG.rotation.y = 0;
    } else if (step === 'fill') {
      if (!pis) { pis = buildPisseta(); pis.rotation.set(-0.62, Math.PI / 2, 0, 'XYZ'); pis.updateMatrix(); }
      const tip = pis.userData.tip.clone().applyEuler(pis.rotation); const target = new THREE.Vector3(WET_X, RIM_Y + 16, 3); const base = target.clone().sub(tip);
      const away = new THREE.Vector3(0, 60, 260); D.add(pis);
      await tween(0.8, (t) => { const e = eout(t); pis.position.copy(base).addScaledVector(away, 1 - e); });
      const l0 = Math.min(waterLevel, 0.15);
      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 1, 10, 1, true).translate(0, -0.5, 0), waterMat); D.add(stream); stream.position.copy(target);
      await tween(2.4, (t) => {
        fillOverride = l0 + (1 - l0) * ease(t); applyWater();
        const yb = water.position.y; stream.scale.set(1, Math.max(0.1, target.y - yb), 1); stream.visible = t > 0.04 && t < 0.97;
        pis.scale.set(1 - 0.035 * Math.sin(t * Math.PI * 6) ** 2, 1, 1);
      });
      D.remove(stream); stream.geometry.dispose(); water01 = 1; waterLevel = 1; fillOverride = null; applyWater();
      await tween(0.7, (t) => { const e = ease(t); pis.position.copy(base).addScaledVector(away, e); });
      D.remove(pis);
    } else if (step === 'wick') {
      await tween(0.8, (t) => { const e = ease(t); wickG.position.y = 62 * e; wickG.scale.setScalar(1 - 0.1 * e); });
      wickG.visible = false; wickKind = 'limpo'; wet = 0; applyWick(); wickG.visible = true;
      await tween(1.2, (t) => { const e = eout(t); wickG.position.y = 62 * (1 - e); wickG.scale.setScalar(1); });
      wickG.position.y = 0;
    } else if (step === 'mount') {
      if (device.parent !== mountPoint) { if (app?.mountOnTripod) await app.mountOnTripod(1.2); else { device.removeFromParent(); mountPoint.add(device); } }
      const k0 = tri.knob.rotation.z;
      await tween(0.9, (t) => { const e = ease(t); device.position.y = 0.012 * (1 - e); device.rotation.y = -0.8 * (1 - e); });
      device.position.set(0, 0, 0); device.rotation.set(0, 0, 0); tri.knob.rotation.z = k0;
    }
  }

  // ── atualização por quadro ──
  const _camP = new THREE.Vector3();
  function update(dt = 0.016) {
    dt = Math.min(dt, 0.1);
    // visor em alta resolução na vitrine OU quando a câmera chega perto (< 0,8 m) do aparelho
    device.getWorldPosition(_camP); const near = stage.camera.position.distanceTo(_camP) < 0.8;
    const inShow = (!!device.parent && device.parent === app?.anchors?.presentDevice) || near;
    const wantTex = inShow && hiTex ? hiTex : screenTex;
    if (wantTex && screenMat.emissiveMap !== wantTex) { screenMat.emissiveMap = wantTex; if (wantTex === hiTex) fw.dirty = true; }
    if (screenTex && fw?.dirty) { if (wantTex === hiTex) { try { fw.drawHi(hiCtx, 4); } catch (e) { console.error('[meter] drawHi', e); } hiTex.needsUpdate = true; } else screenTex.needsUpdate = true; fw.dirty = false; }
    // luz de produto (softbox + rebatedor + recorte) só na vitrine; acesa 2 quadros no início para pré-compilar os shaders
    frameN++; const lightsOn = inShow || (frameN > 1 && frameN < 4);
    if (prodLights.visible !== lightsOn) prodLights.visible = lightsOn;
    if (lightsOn && app?.anchors?.presentDevice) { const a = app.anchors.presentDevice; a.updateWorldMatrix(true, false); prodLights.matrix.copy(a.matrixWorld); prodLights.matrixWorldNeedsUpdate = true; }
    blob.visible = inShow;
    for (const tw of [...tweens]) { tw.t = Math.min(1, tw.t + dt / tw.dur); tw.fn(tw.t); if (tw.t >= 1) { tweens.delete(tw); tw.res(); } }
    // ⏻ segurada: dispara aos 2 s sem esperar soltar
    const now = performance.now();
    for (const h of held.values()) if (!h.fired && h.key === 'power' && now - h.t0 >= 2000) { h.fired = true; fire('power', 2000); }
    for (const k in press) {
      if (pulses[k] > 0) pulses[k] -= dt;
      const down = holding(k) || pulses[k] > 0;
      press[k] += ((down ? 1 : 0) - press[k]) * Math.min(1, dt * 28);
      keys[k].position.z = keyRest[k] - press[k] * 1.25;
    }
    // água (nível animado) e umidade do pavio (molha rápido por capilaridade, seca devagar)
    if (fillOverride == null) { waterLevel += (water01 - waterLevel) * Math.min(1, dt * 2.2); applyWater(); }
    const wetT = (fillOverride ?? waterLevel) > 0.05 && wickKind !== 'seco' ? 1 : 0;
    const nw = wet + (wetT - wet) * Math.min(1, dt * (wetT > wet ? 0.6 : 0.04));
    if (Math.abs(nw - wet) > 1e-4) { wet = nw; applyWick(); }
    if (hl) { hlT += dt; const a = 0.5 + 0.45 * Math.sin(hlT * 5.5); (OL[hl] || []).forEach((o) => (o.material.opacity = a));
      const p = 0.5 + 0.5 * Math.sin(hlT * 4.2);
 }
    // halos das teclas: tecla destacada pelo passo (hl) e/ou tecla apertada agora (flash), em todos os passos
    if (flashKey) { flashT -= dt; if (flashT <= 0) flashKey = null; }
    for (const k in keyHalo) {
      const base = !flashKey && (hl === k || hl === 'keys' || hl === 'all'), fl = flashKey === k, on = base || fl, h = keyHalo[k], km = keys[k].material;
      h.visible = on;
      if (!on) { if (km.emissiveIntensity !== 0.12) { km.emissive.setHex(0x0b3a6e); km.emissiveIntensity = 0.12; } continue; }
      const p = fl ? 1 : 0.5 + 0.5 * Math.sin(hlT * 4.2);
      h.material.opacity = fl ? 1 : 0.55 + 0.45 * p; h.scale.setScalar(fl ? 1.1 : 1 + 0.06 * p);
      km.emissive.setRGB(0.55, 0.38, 0.08); km.emissiveIntensity = fl ? 0.9 : 0.35 + 0.45 * p;
    }
    if (!hl && flashKey) hlT += dt;
  }

  setHeight(app?.state?.meterHeight ?? 1.3); applyWater(); applyWick(); update(0);
  const parts = { body, pads, panel, screen, lcdFrame, labels: txt, keys, globe, globeGroup: globeG, connector: conn, dry: dryMesh, reservoir: cup, water, wick, wickTip, wickGroup: wickG, rubber: rubMesh,
    tripod: tri.meshes, tripodHead: tri.knob };
  return { rig, mountPoint, device, globeCenter, keys, screen, setHeight, setWater, setWick, animate, highlight, pressAnim, parts, update,
    get water() { return water01; }, get wick() { return wickKind; } };
}

export function buildKit(stage, app) { return buildKitImpl(stage, app); }
