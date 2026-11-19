// Pós-processamento do palco (CENÁRIO): cena HDR + profundidade → GTAO (meia resolução, AO de contato) → reflexo do piso
// em espaço de tela (meia resolução) → composição A: heat haze físico diante das portas abertas dos fornos (desvio da
// imagem por ∇n do ar quente), névoa leve → bokeh DOF (meia resolução) → bloom em pirâmide (vidros e luminárias) →
// AgX/ACES + gradação + vinheta + aberração cromática → SMAA → grão fino. Tudo dentro de um EffectComposer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OVENS, ovenFrontZ } from './layout.js';
import { HALL as HC } from './layout_cams.js';
const HALL_H = HC.h;
const snapC = (v, o) => o + 0.3125 + Math.round((v - o - 0.3125) / 0.625) * 0.625;

const VS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const LAYER_MASK = 5;

const COMMON = /* glsl */`
uniform mat4 projInv; uniform mat4 camWorld; uniform vec3 camPos; uniform float cNear; uniform float cFar;
vec3 viewPosAt(vec2 uv, float d){ vec4 c = vec4(uv*2.0-1.0, d*2.0-1.0, 1.0); vec4 v = projInv*c; return v.xyz/v.w; }
float ign(vec2 p){ return fract(52.9829189*fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

function mat(frag, uniforms, defines = {}) {
  return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
}

// ───────────────────────── shaders ─────────────────────────
const MAXH = 12; // volumes de ar quente (um por abertura de porta)
const NOISE = /* glsl */`
float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
`;
// Reflexo do piso em espaço de tela (meia resolução): só pixels do piso (y≈0, normal para cima); raio refletido marchado
// em espaço de mundo e projetado; acerto quando passa atrás da profundidade da cena (com espessura). Alfa = confiança.
const SSR_FRAG = /* glsl */`
${COMMON}
uniform sampler2D tDepth; uniform sampler2D tColor; uniform mat4 viewProj; uniform float rough;
varying vec2 vUv;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  float d = texture2D(tDepth, vUv).x; if (d >= 1.0) { gl_FragColor = vec4(0.0); return; }
  vec3 vp = viewPosAt(vUv, d); vec3 wp = (camWorld * vec4(vp, 1.0)).xyz;
  if (abs(wp.y) > 0.006) { gl_FragColor = vec4(0.0); return; }
  vec3 rd = normalize(wp - camPos);
  vec2 jj = vec2(h21(gl_FragCoord.xy), h21(gl_FragCoord.yx + 7.3)) - 0.5;
  vec3 r = normalize(vec3(rd.x + jj.x * rough, -rd.y, rd.z + jj.y * rough));
  float t = 0.04 + 0.08 * h21(gl_FragCoord.xy * 1.37); float stepL = 0.11;
  vec3 col = vec3(0.0); float hit = 0.0;
  for (int i = 0; i < 15; i++) {
    vec3 p = wp + r * t; vec4 c = viewProj * vec4(p, 1.0); vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || c.w < 0.0) break;
    float sd = texture2D(tDepth, uv).x; vec3 sp = viewPosAt(uv, sd); float sceneD = length(sp); float rayD = length(p - camPos);
    if (rayD > sceneD + 0.01 && rayD - sceneD < 0.15 + stepL * 1.6) {
      vec2 e = smoothstep(vec2(0.0), vec2(0.08), uv) * smoothstep(vec2(1.0), vec2(0.92), uv);
      col = texture2D(tColor, uv).rgb; if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0); col = clamp(col, vec3(0.0), vec3(30.0)); hit = e.x * e.y * (1.0 - smoothstep(2.0, 4.5, t)); break;
    }
    t += stepL; stepL *= 1.24;
  }
  gl_FragColor = vec4(col * hit, hit);
}`;

const COMPOSE_A = /* glsl */`
${COMMON}
${NOISE}
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tAO; uniform sampler2D tSSR; uniform sampler2D tMask;
uniform vec2 res; uniform vec2 halfTexel; uniform float aoAmt; uniform float useAO; uniform float useMask; uniform float useSSR; uniform float ssrAmt;
uniform float fogDens; uniform float fogK; uniform vec3 fogCool; uniform vec3 fogWarm; uniform vec3 warmPos;
uniform float time; uniform float hazeAmt; uniform float fpx; uniform int hazeN; uniform int dbg;
uniform vec4 hOpen[${MAXH}]; uniform vec3 glassCol; uniform vec3 ledCol; uniform float floorRefl; uniform vec4 ledRows; uniform float ledCols[6]; uniform vec2 gridO; uniform float roomOn; uniform vec4 roomBox; uniform float roomH;
uniform vec3 hMin[${MAXH}]; uniform vec3 hMax[${MAXH}]; uniform vec4 hP[${MAXH}]; // x = intensidade, y = z da frente, z = topo da abertura, w = base
varying vec2 vUv;
// densidade relativa do desvio (gradiente do índice de refração) do penacho de ar quente que sai pela parte de cima da
// abertura e sobe colado à frente do forno, alargando e se misturando (decai com a altura)
float plume(vec3 p, vec3 bmin, vec3 bmax, vec4 P){
  float cx = 0.5 * (bmin.x + bmax.x), hw = 0.5 * (bmax.x - bmin.x);
  float sx = 1.0 - smoothstep(0.55, 1.0, abs(p.x - cx) / hw);
  float top = P.z, bot = P.w, h = max(top - bot, 0.05), dz = p.z - P.y, dy = p.y - top;
  float inside = (1.0 - step(0.0, dz)) * smoothstep(bot, top, p.y) * smoothstep(-0.7, -0.05, dz) * 0.8;
  float yw = smoothstep(bot + 0.4 * h, top - 0.05 * h, p.y) * exp(-max(dy, 0.0) / 0.75);
  float zc = 0.06 + 0.22 * clamp((p.y - top + 0.3 * h) / 1.0, 0.0, 1.0);
  float sz = 0.08 + 0.14 * clamp(dy / 0.9, 0.0, 1.0);
  float zz = (dz - zc) / sz; float pl = exp(-zz * zz) * step(0.0, dz);
  // mais forte nos primeiros ~0,4 m acima da boca (ar mais quente, gradiente maior), depois mistura e enfraquece
  float lip = 1.0 + 4.0 * smoothstep(-0.2 * h, 0.0, dy) * (1.0 - smoothstep(0.05, 0.4, dy));
  return sx * max(inside, yw * pl * lip);
}
// sombreamento de escala de sala (só a sala de fornos): AO das arestas forro-parede, cantos verticais e piso-parede;
// poças de luz no piso sob os painéis; nas paredes, vieiras abaixo dos painéis próximos e decaimento junto ao forro
float roomShade(vec3 p){
  float dx = min(p.x - roomBox.x, roomBox.y - p.x), dz = min(p.z - roomBox.z, roomBox.w - p.z), dW = min(dx, dz);
  float dC = roomH - p.y, dF = max(p.y, 0.0);
  float k = (1.0 - 0.30 * exp(-(dC + dW) / 0.7)) * (1.0 - 0.24 * exp(-(dx + dz) / 0.6)) * (1.0 - 0.2 * exp(-(dF + dW) / 0.2));
  float near = 0.0;
  for (int r = 0; r < 4; r++) for (int c = 0; c < 6; c++) { vec2 q = p.xz - vec2(ledCols[c], ledRows[r]); near += exp(-dot(q, q) / 2.6); }
  if (dW < 0.03) { k *= mix(1.0, 0.74, smoothstep(2.0, 3.98, p.y)) * (0.86 + 0.22 * min(near, 1.2) * smoothstep(3.9, 1.6, p.y)); }
  else if (p.y < 0.006) { k *= 0.86 + 0.15 * min(near, 1.4); }
  else if (dC < 0.02) { k *= 0.9 + 0.1 * min(near, 1.0); }
  return k;
}
void main(){
  float d = texture2D(tDepth, vUv).x;
  vec3 vp = viewPosAt(vUv, d); float dist = d >= 1.0 ? 80.0 : length(vp);
  vec3 wp = (camWorld * vec4(vp, 1.0)).xyz; vec3 rd = normalize(wp - camPos);
  // ── heat haze: soma, ao longo do raio dentro de cada volume, o desvio angular δ ≈ ∫∇n ds (ruído animado que sobe
  // a ~0,6 m/s); o deslocamento na imagem é δ·f·(1 − d_ar/d_fundo) — fundo logo atrás do ar quente quase não se move.
  vec2 hz = vec2(0.0);
  if (hazeAmt > 0.0) {
    const float jit = 0.5; // sem jitter por pixel: o campo de deslocamento precisa ser contínuo (jitter serrilhava as bordas)
    for (int i = 0; i < ${MAXH}; i++) {
      if (i >= hazeN) break;
      vec4 P = hP[i]; if (P.x < 0.005) continue;
      vec3 inv = 1.0 / rd; vec3 ta = (hMin[i] - camPos) * inv, tb = (hMax[i] - camPos) * inv;
      vec3 t0 = min(ta, tb), t1 = max(ta, tb);
      float tn = max(max(t0.x, t0.y), max(t0.z, 0.0)), tf = min(min(t1.x, t1.y), min(t1.z, dist));
      if (tf <= tn) continue;
      float seg = (tf - tn) / 6.0;
      for (int j = 0; j < 6; j++) {
        float t = tn + (float(j) + jit) * seg; vec3 p = camPos + rd * t;
        float den = plume(p, hMin[i], hMax[i], P); if (den < 0.01) continue;
        vec3 q = vec3(p.x * 11.0, p.y * 5.5 - time * 3.4, p.z * 11.0 + time * 0.3);
        vec2 g = vec2(vn(q) - 0.5, vn(q + vec3(19.1, 7.7, 3.3)) - 0.5) + 0.5 * vec2(vn(q * 2.3 + 4.1) - 0.5, vn(q * 2.3 + vec3(1.7, 9.2, 5.4)) - 0.5);
        hz += g * den * seg * P.x * (1.0 - t / max(dist, 0.01));
      }
    }
  }
  vec2 uv = vUv + hz * hazeAmt * fpx / res;
  vec4 c = texture2D(tColor, uv);
  vec3 col = c.rgb;
  // saneamento da entrada HDR: NaN/Inf/negativos de qualquer material (ex.: partículas com mistura especial) não podem
  // entrar na cadeia de bloom/DOF — um único pixel assim vira um disco preto do tamanho da pirâmide de bloom
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  col = clamp(col, vec3(0.0), vec3(3.0e4));
  if (useAO > 0.5) {
    // reamostragem bilateral do AO de meia resolução: só pesam vizinhos de profundidade parecida (sem franja nas silhuetas)
    float ao = 0.0, aw = 0.0;
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(k == 0 || k == 2 ? -0.5 : 0.5, k < 2 ? -0.5 : 0.5) * halfTexel; vec2 u2 = uv + o;
      float dk = texture2D(tDepth, u2).x; float zk = cNear * cFar / (cFar - dk * (cFar - cNear));
      float zc = cNear * cFar / (cFar - d * (cFar - cNear));
      float wk = exp(-abs(zk - zc) / max(zc, 0.05) * 90.0) + 1e-4; ao += texture2D(tAO, u2).r * wk; aw += wk;
    }
    ao = ao / max(aw, 1e-5); ao = mix(1.0, pow(ao, 1.5), aoAmt);
    if (useMask > 0.5) { float m = texture2D(tMask, vUv).r; if (m > 0.0 && abs(m - dist) < 0.05 * dist + 0.02) ao = 1.0; }
    col *= ao;
    if (dbg == 1) { gl_FragColor = vec4(vec3(ao), dist); return; }
  }
  // reflexo especular do piso (porcelanato acetinado): Fresnel de Schlick (F0 0,04), sem reflexo nos rejuntes
  if (useSSR > 0.5 && abs(wp.y) < 0.006) {
    vec2 q = halfTexel * 2.2; // ~1 texel do buffer de ¼ de resolução: filtro em cruz + diagonais
    vec4 s = texture2D(tSSR, uv) * 0.2;
    s += (texture2D(tSSR, uv + vec2(q.x, 0.0)) + texture2D(tSSR, uv - vec2(q.x, 0.0)) + texture2D(tSSR, uv + vec2(0.0, q.y)) + texture2D(tSSR, uv - vec2(0.0, q.y))) * 0.12;
    s += (texture2D(tSSR, uv + q) + texture2D(tSSR, uv - q) + texture2D(tSSR, uv + vec2(q.x, -q.y)) + texture2D(tSSR, uv - vec2(q.x, -q.y))) * 0.08;
    float nv = clamp(-rd.y, 0.0, 1.0); float F = 0.05 + 0.95 * pow(1.0 - nv, 5.0);
    vec2 gq = abs(fract(wp.xz / 0.4 + 0.5) - 0.5) * 0.4; float grout = smoothstep(0.002, 0.0045, min(gq.x, gq.y));
    col += s.rgb * F * ssrAmt * grout;
    // reflexo analítico das fontes mais claras (vidros/bocas dos fornos e painéis LED do forro) — o que mais aparece num piso
    // acetinado; borda borrada que cresce com a distância (rugosidade), sem ruído nem custo de marcha
    vec3 r = vec3(rd.x, -rd.y, rd.z); vec3 em = vec3(0.0);
    for (int i = 0; i < ${MAXH}; i++) {
      if (i >= hazeN) break;
      vec4 P = hP[i]; float zf = P.y; if (r.z > -1e-3 || wp.z < zf) continue;
      float t = (zf - wp.z) / r.z; vec3 q = wp + r * t; float b = 0.015 + t * 0.09;
      float x0 = hMin[i].x + 0.08, x1 = hMax[i].x - 0.08;
      float m = smoothstep(x0 - b, x0 + b, q.x) * (1.0 - smoothstep(x1 - b, x1 + b, q.x)) * smoothstep(P.w - b, P.w + b, q.y) * (1.0 - smoothstep(P.z - b, P.z + b, q.y));
      em += glassCol * m * (1.0 + 2.5 * hOpen[i].x);
    }
    if (r.y > 0.05) { // painéis LED: reflexo borrado e alongado na direção do olhar (vertical na tela), como em piso acetinado
      float t = (${(HALL_H - 0.006).toFixed(3)} - wp.y) / r.y; vec3 q = wp + r * t;
      vec2 dl = normalize(r.xz + 1e-5), dp = vec2(-dl.y, dl.x); float sa = 0.55 + t * 0.32, sl = 0.42 + t * 0.05; vec3 el = vec3(0.0);
      for (int k = 0; k < 4; k++) for (int c = 0; c < 6; c++) {
        vec2 v = q.xz - vec2(ledCols[c], ledRows[k]); float a1 = dot(v, dl) / sa, a2 = dot(v, dp) / sl;
        el += ledCol * exp(-a1 * a1 - a2 * a2);
      }
      em += el;
    }
    col += em * F * floorRefl * mix(0.55, 1.0, grout);
    if (dbg == 2) { gl_FragColor = vec4(s.rgb * F * ssrAmt * grout * 4.0, dist); return; }
  }
  if (dbg == 3) { gl_FragColor = vec4(abs(hz) * hazeAmt * fpx * 0.5, 0.0, dist); return; }
  if (roomOn > 0.5 && d < 1.0) col *= roomShade(wp);
  // névoa leve (vapor/ar úmido; um pouco mais densa no alto e mais quente perto dos fornos)
  float L = min(dist, 60.0);
  float ry = rd.y * fogK; float base = fogDens * exp(fogK * (camPos.y - 1.5));
  float optical = abs(ry) > 1e-4 ? base * (exp(ry * L) - 1.0) / ry : base * L;
  float T = exp(-optical);
  vec3 mid = camPos + rd * L * 0.5; float warmW = exp(-length((mid - warmPos) * vec3(0.12, 0.5, 0.35)));
  vec3 inscat = mix(fogCool, fogWarm, clamp(warmW, 0.0, 1.0));
  col = col * T + inscat * (1.0 - T);
  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  gl_FragColor = vec4(col, dist);
}`;

const DOF_FRAG = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float focus; uniform float amount; uniform float maxR; uniform float nearK;
varying vec2 vUv;
const float GOLDEN = 2.39996323;
float cs(float d){ return clamp(amount * abs(d - focus) / max(d, 0.05) * (d < focus ? nearK : 1.0), 0.0, maxR); }
void main(){
  vec4 c = texture2D(tSrc, vUv); float cd = c.a; float csz = cs(cd);
  vec3 acc = c.rgb; float tot = 1.0; float r = 0.5; float ang = 0.0; // espiral fixa (sem rotação aleatória por pixel → sem pontilhado no bokeh)
  for (int i = 0; i < 260; i++) {
    if (r >= maxR) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * r;
    vec4 s = texture2D(tSrc, tc); if (any(isnan(s))) continue; float ssz = cs(s.a);
    if (s.a > cd) ssz = clamp(ssz, 0.0, csz * 2.0);
    float m = smoothstep(r - 0.5, r + 0.5, ssz);
    acc += mix(acc / tot, min(s.rgb, vec3(40.0)), m); tot += 1.0;
    r += 0.45 / r; ang += GOLDEN;
  }
  gl_FragColor = vec4(acc / tot, csz);
}`;

const BLOOM_PRE = /* glsl */`
uniform sampler2D tSrc; uniform sampler2D tMask; uniform vec2 texel; uniform float thr; uniform float knee; uniform float useMask;
varying vec2 vUv;
vec3 pf(vec2 uv){ vec4 s = texture2D(tSrc, uv); vec3 c = s.rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); c = clamp(c, vec3(0.0), vec3(60.0));
  if (useMask > 0.5) { float m = texture2D(tMask, uv).g; if (m > 0.0 && abs(m - s.a) < 0.05 * s.a + 0.02) c *= 0.0; }
  float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - thr + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
  return c * max(soft, br - thr) / max(br, 1e-4); }
void main(){ vec2 o = texel * 0.5;
  gl_FragColor = vec4((pf(vUv + vec2(-o.x,-o.y)) + pf(vUv + vec2(o.x,-o.y)) + pf(vUv + vec2(-o.x,o.y)) + pf(vUv + vec2(o.x,o.y))) * 0.25, 1.0); }`;
const BLOOM_DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
void main(){ vec2 o = texel; vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv + vec2(-o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x,o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,o.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0); }`;
const BLOOM_UP = /* glsl */`
uniform sampler2D tSrc; uniform vec2 texel; uniform float w; varying vec2 vUv;
void main(){ vec2 o = texel; vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(-o.x,0)).rgb + texture2D(tSrc, vUv + vec2(o.x,0)).rgb + texture2D(tSrc, vUv + vec2(0,-o.y)).rgb + texture2D(tSrc, vUv + vec2(0,o.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + vec2(-o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,-o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x,o.y)).rgb + texture2D(tSrc, vUv + vec2(o.x,o.y)).rgb;
  gl_FragColor = vec4(c / 16.0 * w, 1.0); }`;

const COMPOSE_B = /* glsl */`
uniform sampler2D tA; uniform sampler2D tDof; uniform sampler2D tBloom; uniform vec2 res;
uniform float useDof; uniform float focus; uniform float amountFull; uniform float nearK; uniform vec2 dofTexel; uniform float bloomAmt; uniform float exposure;
uniform float ca; uniform float vign; uniform float sat; uniform float contrast; uniform vec3 liftC; uniform vec3 gainC; uniform float tmo;
varying vec2 vUv;
vec3 agxC(vec3 x){ vec3 x2 = x*x; vec3 x4 = x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 color){
  const mat3 S2R = mat3(vec3(0.6274,0.0691,0.0164), vec3(0.3293,0.9195,0.0880), vec3(0.0433,0.0113,0.8956));
  const mat3 R2S = mat3(vec3(1.6605,-0.1246,-0.0182), vec3(-0.5876,1.1329,-0.1006), vec3(-0.0728,-0.0083,1.1187));
  const mat3 INS = mat3(vec3(0.856627153315983,0.137318972929847,0.11189821299995), vec3(0.0951212405381588,0.761241990602591,0.0767994186031903), vec3(0.0482516061458583,0.101439036467562,0.811302368396859));
  const mat3 OUTS = mat3(vec3(1.1271005818144368,-0.1413297634984383,-0.14132976349843826), vec3(-0.11060664309660323,1.157823702216272,-0.11060664309660294), vec3(-0.016493938717834573,-0.016493938717834257,1.2519364065950405));
  color = S2R * color; color = INS * color; color = max(color, 1e-10); color = log2(color);
  color = (color + 12.47393) / (4.026069 + 12.47393); color = clamp(color, 0.0, 1.0); color = agxC(color);
  color = OUTS * color; color = pow(max(vec3(0.0), color), vec3(2.2)); color = R2S * color; return clamp(color, 0.0, 1.0); }
vec3 aces(vec3 c){ c *= 0.6; return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14), 0.0, 1.0); }
// filmico com preservação de matiz: curva ACES (ajuste de Narkowicz) aplicada ao máximo dos canais, que mantém a razão
// R:G:B (âmbar continua âmbar); só nas intensidades extremas mistura com a versão por canal, que satura para o branco-amarelado
// como num sensor real (lâmpadas da câmara, centro do bloom)
vec3 filmicHP(vec3 c){
  float m = max(c.r, max(c.g, c.b)); float x = m * 0.6;
  float t = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  vec3 hp = c * (t / max(m, 1e-6));
  return mix(hp, aces(c), smoothstep(5.0, 45.0, m));
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 fetch(vec2 uv){
  vec4 a = texture2D(tA, uv);
  if (useDof > 0.5) {
    float sz = clamp(amountFull * abs(a.a - focus) / max(a.a, 0.05) * (a.a < focus ? nearK : 1.0), 0.0, 60.0);
    // Ampliação da meia resolução SENSÍVEL À PROFUNDIDADE: só pesam as amostras cujo desfoque (a = CoC em meia res.)
    // é parecido com o deste pixel — o fundo borrado não "puxa" a cor do objeto em foco (sem halo), e o objeto em foco
    // não é trocado pela versão borrada na borda (a mistura depende só do próprio CoC).
    vec2 o = dofTexel * clamp(sz * 0.2, 0.5, 2.6);
    vec4 t0 = texture2D(tDof, uv), t1 = texture2D(tDof, uv + vec2(o.x, o.y)), t2 = texture2D(tDof, uv - vec2(o.x, o.y)),
         t3 = texture2D(tDof, uv + vec2(o.x, -o.y)), t4 = texture2D(tDof, uv - vec2(o.x, -o.y));
    float k0 = 0.36 / (0.35 + abs(t0.a * 2.0 - sz)), k1 = 0.16 / (0.35 + abs(t1.a * 2.0 - sz)), k2 = 0.16 / (0.35 + abs(t2.a * 2.0 - sz)),
          k3 = 0.16 / (0.35 + abs(t3.a * 2.0 - sz)), k4 = 0.16 / (0.35 + abs(t4.a * 2.0 - sz));
    vec3 b = (t0.rgb * k0 + t1.rgb * k1 + t2.rgb * k2 + t3.rgb * k3 + t4.rgb * k4) / (k0 + k1 + k2 + k3 + k4);
    float m = smoothstep(0.6, 2.2, sz);
    a.rgb = mix(a.rgb, b, m);
  }
  return a.rgb;
}
void main(){
  vec2 cuv = vUv - 0.5; float r2 = dot(cuv, cuv);
  vec2 off = cuv * r2 * ca * 10.0 / res;
  vec3 col;
  if (ca > 0.0) { col.r = fetch(vUv - off).r; col.g = fetch(vUv).g; col.b = fetch(vUv + off).b; } else col = fetch(vUv);
  vec3 bl = texture2D(tBloom, vUv).rgb; if (any(isnan(bl)) || any(isinf(bl))) bl = vec3(0.0);
  col = max(col, vec3(0.0)) + max(bl, vec3(0.0)) * bloomAmt;
  col *= exposure;
  col = tmo > 1.5 ? filmicHP(col) : tmo > 0.5 ? aces(col) : agx(col);
  vec3 g = toSRGB(col);
  g = pow(g, vec3(1.07)); // pé mais escuro: pretos profundos nos vidros/sombras
  float l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  // gradação: sombras frias azul-esverdeadas, realces quentes, curva S de fotografia
  g += liftC * (1.0 - smoothstep(0.0, 0.55, l)) + gainC * smoothstep(0.45, 1.0, l);
  g = mix(g, g * g * (3.0 - 2.0 * g), contrast);
  l = dot(g, vec3(0.2126, 0.7152, 0.0722));
  g = mix(vec3(l), g, sat);
  float v = smoothstep(0.85, 0.18, length(cuv * vec2(1.0, 0.82)));
  g *= mix(1.0 - vign, 1.0, v);
  gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
}`;

const GRAIN = /* glsl */`
uniform sampler2D tDiffuse; uniform float time; uniform float amt; uniform vec2 res; varying vec2 vUv;
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 p = vUv * res + fract(time * 13.7) * 311.0;
  float n = (h(p) + h(p + 17.3) - 1.0); float l = dot(c, vec3(0.3, 0.59, 0.11));
  c += n * amt * (0.55 + 0.45 * (1.0 - abs(l * 2.0 - 1.0)));
  c += (h(p * 1.7 + 3.1) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0); }`;

// ───────────────────────── passe principal ─────────────────────────
class MainPass extends Pass {
  constructor(stage, P) {
    super(); this.stage = stage; this.P = P; this.needsSwap = true;
    const { renderer, scene, camera } = stage; this.renderer = renderer; this.scene = scene; this.camera = camera;
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.depthTex = new THREE.DepthTexture(4, 4, THREE.FloatType);
    this.sceneRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthTexture: this.depthTex, depthBuffer: true });
    this.aRT = new THREE.WebGLRenderTarget(4, 4, opt);
    this.ssrRT = new THREE.WebGLRenderTarget(4, 4, opt);
    this.dofRT = new THREE.WebGLRenderTarget(4, 4, opt);
    this.maskRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.bloomRT = []; for (let i = 0; i < 6; i++) this.bloomRT.push(new THREE.WebGLRenderTarget(4, 4, opt));
    this.quad = new FullScreenQuad(null);
    const cam = () => ({ projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() }, cNear: { value: 0.05 }, cFar: { value: 200 } });
    this.camU = cam();
    this.ssr = mat(SSR_FRAG, Object.assign({}, this.camU, { tDepth: { value: this.depthTex }, tColor: { value: this.sceneRT.texture }, viewProj: { value: new THREE.Matrix4() }, rough: { value: 0.05 } }));
    // volumes de ar quente: um por abertura de porta de cada forno (caixa: largura da porta + folga, da base da porta até
    // ~1,1 m acima do topo, de 0,7 m dentro da câmara até 0,7 m à frente)
    this.hazeSrc = [];
    for (const o of OVENS) for (const d of o.doors) {
      const fz = ovenFrontZ(o), x0 = o.x + d.cx - d.w / 2 - 0.08, x1 = o.x + d.cx + d.w / 2 + 0.08;
      this.hazeSrc.push({ id: o.id, k: Math.max(0.3, (o.setpoint - 25) / 155), min: new THREE.Vector3(x0, d.y0, fz - 0.7), max: new THREE.Vector3(x1, Math.min(3.9, d.y0 + d.h + 1.1), fz + 0.7), p: new THREE.Vector4(0, fz, d.y0 + d.h, d.y0) });
    }
    this.hazeSrc = this.hazeSrc.slice(0, MAXH);
    const pad = (arr, f) => { const a = arr.map(f); while (a.length < MAXH) a.push(f(null)); return a; };
    this.composeA = mat(COMPOSE_A, Object.assign({}, this.camU, {
      tColor: { value: this.sceneRT.texture }, tDepth: { value: this.depthTex }, tAO: { value: null }, tSSR: { value: this.ssrRT.texture },
      tMask: { value: this.maskRT.texture }, res: { value: new THREE.Vector2() }, halfTexel: { value: new THREE.Vector2() },
      aoAmt: { value: P.ao }, useAO: { value: 1 }, useMask: { value: 0 }, useSSR: { value: 1 }, ssrAmt: { value: P.ssr },
      fogDens: { value: P.fogDens }, fogK: { value: P.fogK }, fogCool: { value: P.fogCool }, fogWarm: { value: P.fogWarm },
      warmPos: { value: P.warmPos || new THREE.Vector3(3.5, 1.8, -4.6) },
      time: { value: 0 }, dbg: { value: 0 }, hazeAmt: { value: 0 }, fpx: { value: 600 }, hazeN: { value: this.hazeSrc.length },
      hMin: { value: pad(this.hazeSrc, (h) => (h ? h.min : new THREE.Vector3())) }, hMax: { value: pad(this.hazeSrc, (h) => (h ? h.max : new THREE.Vector3())) },
      hP: { value: pad(this.hazeSrc, (h) => (h ? h.p : new THREE.Vector4())) },
      hOpen: { value: pad(this.hazeSrc, (h) => (h ? (h.open = new THREE.Vector4()) : new THREE.Vector4())) },
      glassCol: { value: new THREE.Vector3(3.2, 1.5, 0.5) }, ledCol: { value: new THREE.Vector3(1.5, 1.45, 1.36) }, floorRefl: { value: P.floorRefl ?? 1 },
      // centro de cada PAR de painéis (borda comum entre as duas células), fileiras ajustadas à grade de 625 mm
      ledRows: { value: new THREE.Vector4(...HC.ledRows.map((z) => snapC(z, HC.z0))) },
      ledCols: { value: HC.ledCols.map((x) => snapC(x - 0.3125, HC.x0) + 0.3125) },
      roomOn: { value: 1 }, roomBox: { value: new THREE.Vector4(HC.x0, HC.x1, HC.z0, HC.z1) }, roomH: { value: HC.h },
    }));
    this.dof = mat(DOF_FRAG, { tSrc: { value: this.aRT.texture }, texel: { value: new THREE.Vector2() }, focus: { value: 2 }, amount: { value: 0 }, maxR: { value: 14 }, nearK: { value: 0.5 } });
    this.pre = mat(BLOOM_PRE, { tSrc: { value: this.aRT.texture }, tMask: { value: this.maskRT.texture }, texel: { value: new THREE.Vector2() }, thr: { value: P.bloomThr }, knee: { value: 1.5 }, useMask: { value: 0 } });
    this.down = mat(BLOOM_DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.up = mat(BLOOM_UP, { tSrc: { value: null }, texel: { value: new THREE.Vector2() }, w: { value: 1 } });
    this.up.blending = THREE.AdditiveBlending; this.up.transparent = true;
    this.composeB = mat(COMPOSE_B, {
      tA: { value: this.aRT.texture }, tDof: { value: this.dofRT.texture }, tBloom: { value: this.bloomRT[0].texture }, res: { value: new THREE.Vector2() },
      useDof: { value: 0 }, focus: { value: 2 }, amountFull: { value: 0 }, nearK: { value: 0.5 }, dofTexel: { value: new THREE.Vector2() }, bloomAmt: { value: P.bloom }, exposure: { value: P.exposure },
      ca: { value: P.ca }, vign: { value: P.vignette }, sat: { value: P.sat }, contrast: { value: P.contrast },
      liftC: { value: P.lift }, gainC: { value: P.gain }, tmo: { value: 0 },
    });
    this.maskMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */`#include <common>
#include <skinning_pars_vertex>
varying float vD; void main(){
#include <skinbase_vertex>
#include <begin_vertex>
#include <skinning_vertex>
#include <project_vertex>
vD = length(mvPosition.xyz); }`,
      fragmentShader: /* glsl */`uniform vec2 flags; varying float vD; void main(){ gl_FragColor = vec4(flags * vD, 0.0, 1.0); }`,
      uniforms: { flags: { value: new THREE.Vector2(1, 1) } },
    });
    this.maskCam = new THREE.PerspectiveCamera(); this.maskList = []; this.maskScanT = 0;
    this.gtao = new GTAOPass(scene, camera, 4, 4);
    this.gtao.output = GTAOPass.OUTPUT.Off;
    this.gtao.setGBuffer(this.depthTex);
    this.gtao.updateGtaoMaterial({ radius: P.aoRadius, distanceExponent: 1.6, thickness: 1.0, scale: 1.0, samples: 8, distanceFallOff: 1.0 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 4, normalPhi: 4, radius: 5, rings: 2, samples: 8 });
    this.composeA.uniforms.tAO.value = this.gtao.gtaoMap;
    this.w = 4; this.h = 4; this.time = 0;
  }
  setSize(w, h) {
    this.w = w; this.h = h; const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.sceneRT.setSize(w, h); this.aRT.setSize(w, h);
    this.ssrRT.setSize(Math.max(2, w >> 2), Math.max(2, h >> 2)); this.dofRT.setSize(hw, hh); this.maskRT.setSize(hw, hh);
    this.gtao.setSize(hw, hh); // meia resolução + reamostragem sensível à profundidade na composição A (sem halo)
    let bw = hw, bh = hh; for (const rt of this.bloomRT) { rt.setSize(Math.max(2, bw), Math.max(2, bh)); bw >>= 1; bh >>= 1; }
    this.composeA.uniforms.res.value.set(w, h); this.composeA.uniforms.halfTexel.value.set(1 / hw, 1 / hh);
    this.dof.uniforms.texel.value.set(1 / hw, 1 / hh);
    this.pre.uniforms.texel.value.set(1 / w, 1 / h);
    this.composeB.uniforms.res.value.set(w, h); this.composeB.uniforms.dofTexel.value.set(1 / hw, 1 / hh);
  }
  scanMask() {
    this.maskList.length = 0;
    this.scene.traverse((o) => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;
      let a = false, b = false; for (let p = o; p; p = p.parent) { a ||= !!p.userData?.noAO; b ||= !!p.userData?.noBloom; }
      if (a || b) { o.layers.enable(LAYER_MASK); o.userData._maskFlags = [a ? 1 : 0, b ? 1 : 0]; this.maskList.push(o); }
      else if (o.layers.isEnabled(LAYER_MASK)) o.layers.disable(LAYER_MASK);
    });
  }
  render(renderer, writeBuffer /*, readBuffer */) {
    const P = this.P, cam = this.camera, scene = this.scene;
    this.time = this.stage._t ?? (this.time + 1 / 60);
    cam.updateMatrixWorld();
    const U = this.camU; U.projInv.value.copy(cam.projectionMatrixInverse); U.camWorld.value.copy(cam.matrixWorld);
    U.camPos.value.setFromMatrixPosition(cam.matrixWorld); U.cNear.value = cam.near; U.cFar.value = cam.far;
    // 1) cena HDR
    renderer.setRenderTarget(this.sceneRT); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, cam);
    // 2) máscara noAO / noBloom (distância à câmera dos objetos marcados)
    if ((this.maskScanT -= 1) <= 0) { this.scanMask(); this.maskScanT = 60; }
    const useMask = this.maskList.length > 0;
    this.composeA.uniforms.useMask.value = useMask ? 1 : 0; this.pre.uniforms.useMask.value = useMask ? 1 : 0;
    if (useMask) {
      const mc = this.maskCam; mc.copy(cam, false); mc.layers.set(LAYER_MASK);
      const ov = scene.overrideMaterial, bg = scene.background; scene.overrideMaterial = this.maskMat; scene.background = null;
      const mm = this.maskMat;
      for (const o of this.maskList) { o.onBeforeRender = function () { mm.uniforms.flags.value.set(...this.userData._maskFlags); mm.uniformsNeedUpdate = true; }; }
      renderer.setRenderTarget(this.maskRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, mc);
      for (const o of this.maskList) o.onBeforeRender = THREE.Object3D.prototype.onBeforeRender;
      scene.overrideMaterial = ov; scene.background = bg;
    }
    // 3) GTAO meia resolução sobre a profundidade da cena
    const useAO = P.ao > 0 && P.quality !== 'low';
    this.composeA.uniforms.useAO.value = useAO ? 1 : 0;
    if (useAO) this.gtao.render(renderer, null, this.sceneRT);
    // 4) reflexo do piso (meia resolução)
    const useSSR = P.ssr > 0;
    this.composeA.uniforms.useSSR.value = useSSR ? 1 : 0;
    if (useSSR) { this.ssr.uniforms.viewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); this.run(this.ssr, this.ssrRT); }
    // 5) composição HDR A (heat haze + AO + reflexo + névoa), alfa = distância
    const A = this.composeA.uniforms; if (P.warmPos) A.warmPos.value = P.warmPos; A.fogDens.value = P.fogDens; A.fogK.value = P.fogK; A.aoAmt.value = P.ao; A.ssrAmt.value = P.ssr;
    A.time.value = this.time; A.dbg.value = P.debug | 0; A.fpx.value = this.h * 0.5 / Math.tan(THREE.MathUtils.degToRad(cam.fov) * 0.5);
    const app = this.stage.app; let anyHaze = 0;
    for (const h of this.hazeSrc) {
      let open = 0; try { open = app?.machines?.doorOpen?.(h.id) ?? app?.field?.doors?.[h.id] ?? 0; } catch { open = 0; }
      open = Math.max(0, Math.min(1, +open || 0)); h.p.x = open * h.k; h.open.x = open; anyHaze += h.p.x;
    }
    A.hazeAmt.value = anyHaze > 0 ? 0.1 * (P.haze ?? 1) : 0; A.floorRefl.value = this.stage.env === 'caldeiras' ? 0 : (P.floorRefl ?? 1); A.roomOn.value = this.stage.env === 'caldeiras' ? 0 : (P.room ?? 1);
    this.run(this.composeA, this.aRT);
    // 6) DOF
    const dof = this.stage._dof; const B = this.composeB.uniforms;
    const useDof = dof.amount > 0.002 && dof.dist > 0;
    B.useDof.value = useDof ? 1 : 0;
    if (useDof) {
      // amount em px (meia res) para "infinito"; escala com a altura da imagem
      const full = dof.amount * P.dofMax * (this.h / 720);
      this.dof.uniforms.focus.value = dof.dist; this.dof.uniforms.amount.value = full * 0.5; this.dof.uniforms.maxR.value = Math.min(18, Math.max(2, full * 0.5));
      B.focus.value = dof.dist; B.amountFull.value = full; B.nearK.value = this.dof.uniforms.nearK.value = P.dofNear ?? 0.5;
      this.run(this.dof, this.dofRT);
    }
    // 7) bloom em pirâmide
    this.pre.uniforms.thr.value = P.bloomThr;
    this.run(this.pre, this.bloomRT[0]);
    for (let i = 1; i < this.bloomRT.length; i++) {
      const s = this.bloomRT[i - 1]; this.down.uniforms.tSrc.value = s.texture; this.down.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      this.run(this.down, this.bloomRT[i]);
    }
    for (let i = this.bloomRT.length - 2; i >= 0; i--) {
      const s = this.bloomRT[i + 1]; this.up.uniforms.tSrc.value = s.texture; this.up.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      this.up.uniforms.w.value = 1.0; this.run(this.up, this.bloomRT[i], false);
    }
    // 8) composição B (DOF + bloom + CA + tonemap + gradação + vinheta) → writeBuffer (LDR, sRGB)
    B.bloomAmt.value = P.bloom; B.exposure.value = P.exposure; B.ca.value = P.ca; B.vign.value = P.vignette;
    B.sat.value = P.sat; B.contrast.value = P.contrast; B.tmo.value = P.tonemap === 'hp' ? 2 : P.tonemap === 'aces' ? 1 : 0;
    this.run(this.composeB, this.renderToScreen ? null : writeBuffer);
  }
  run(material, target, clear = true) {
    this.renderer.setRenderTarget(target); if (clear) { this.renderer.setClearColor(0, 0); this.renderer.clear(); }
    this.quad.material = material; this.quad.render(this.renderer);
  }
}

export function createPost(stage, P) {
  const { renderer } = stage;
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
  const main = new MainPass(stage, P);
  composer.addPass(main);
  const smaa = new SMAAPass(4, 4); composer.addPass(smaa);
  const grain = new ShaderPass(new THREE.ShaderMaterial({ vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: GRAIN, uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amt: { value: P.grain }, res: { value: new THREE.Vector2() } } }));
  composer.addPass(grain);
  return {
    composer, main, smaa, grain,
    setSize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); grain.uniforms.res.value.set(w * pr, h * pr); },
    render(t) { stage._t = t; grain.uniforms.time.value = t; grain.uniforms.amt.value = P.grain; smaa.enabled = P.smaa; composer.render(); },
  };
}
