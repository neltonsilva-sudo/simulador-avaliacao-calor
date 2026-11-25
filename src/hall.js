// Sala de fornos (CENÁRIO): piso de porcelanato industrial antiderrapante com rejunte, desgaste e ralos lineares inox;
// paredes de azulejo branco 30×30 (proporção da FOTO 2) até 2,10 m + pintura epóxi acima, rodapé sanitário; parede direita da FOTO 2 (tubulação
// de gás amarela com registro cromado, torneira, tomadas); forro de isopainel com luminárias LED herméticas, duto de
// exaustão e de insuflamento; portas, janelas altas basculantes, prateleiras inox com caixas e bandejas (FOTO 5),
// quadro elétrico, sinalização de rota de fuga, extintor e EPI.
// buildHall(stage, app) → { group, update(dt, t) }
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HALL, OVENS, ovenFrontZ } from './layout.js';
import { HALL as HC } from './layout_cams.js';
import * as TX from './hall_tex.js';
// ruído de valor (GLSL) para sujeira/variação procedural em espaço de mundo — quebra a repetição das texturas tileáveis
const GLN = '\nfloat gHn(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat gVn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gHn(i), gHn(i + vec2(1.0, 0.0)), f.x), mix(gHn(i + vec2(0.0, 1.0)), gHn(i + 1.0), f.x), f.y); }\n';

const V3 = THREE.Vector3;
const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0, HT = HALL.h, TT = HC.tileTop; // 2,10 m = 7 fiadas de 30 cm

// sistemas de coordenadas das paredes: u ao longo da parede, y para cima, n = normal para dentro da sala
const WALLS = {
  back: { o: [HALL.x0, HALL.z0], ry: 0, len: W },
  right: { o: [HALL.x1, HALL.z0], ry: -Math.PI / 2, len: D },
  front: { o: [HALL.x1, HALL.z1], ry: Math.PI, len: W },
  left: { o: [HALL.x0, HALL.z1], ry: Math.PI / 2, len: D },
};
const uOf = { back: (x) => x - HALL.x0, front: (x) => HALL.x1 - x, right: (z) => z - HALL.z0, left: (z) => HALL.z1 - z };

// ralos lineares (canaletas inox com grelha) e ralos quadrados
const DRAINS = [
  { x0: -3.25, x1: 6.45, z0: -3.3, z1: -3.18 },
  { x0: 6.55, x1: 6.7, z0: 0.3, z1: 0.45, sq: true }, { x0: -4.95, x1: -4.8, z0: 0.9, z1: 1.05, sq: true }, { x0: 1.5, x1: 1.65, z0: 3.9, z1: 4.05, sq: true },
];

export function buildHall(stage, app) {
  const group = new THREE.Group(); group.name = 'hall';
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());

  // ───────── materiais ─────────
  const tile = TX.tileTextures(), paint = TX.paintTextures(), fl = TX.floorTextures(), ceil = TX.ceilingTextures(), brushed = TX.brushedTexture();
  for (const t of [tile, paint, fl, ceil]) for (const k of ['map', 'rough', 'normal']) { t[k].repeat.set(1 / t.size, 1 / t.size); t[k].anisotropy = aniso; }
  const M = {};
  M.floor = new THREE.MeshStandardMaterial({ map: fl.map, roughnessMap: fl.rough, normalMap: fl.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: 0, envMapIntensity: 0.9 });
  M.tile = new THREE.MeshStandardMaterial({ map: tile.map, roughnessMap: tile.rough, normalMap: tile.normal, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, metalness: 0, vertexColors: true, envMapIntensity: 1.0 });
  M.paint = new THREE.MeshStandardMaterial({ map: paint.map, roughnessMap: paint.rough, normalMap: paint.normal, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 1, vertexColors: true });
  // forro: albedo alto; o rebote do piso e das paredes claras (que a sala de 4 m recebe em peso) entra como emissivo calibrado
  // (≈65% da luminância das paredes, como na FOTO 5) — o IBL de um ponto só e as luzes voltadas para baixo não o iluminam
  M.ceil = new THREE.MeshStandardMaterial({ map: ceil.map, roughnessMap: ceil.rough, normalMap: ceil.normal, roughness: 1, envMapIntensity: 1.0, color: 0xf2f2ef,
    emissive: new THREE.Color(1.0, 0.975, 0.94), emissiveMap: ceil.map, emissiveIntensity: 0.3, normalScale: new THREE.Vector2(0.6, 0.6) });
  // azulejo: tom por peça (lotes de queima), respingo/encardido na faixa baixa e escorridos verticais de vapor/gordura
  M.tile.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + GLN)
      .replace('#include <map_fragment>', '#include <map_fragment>\n { vec2 wu = vMapUv * ' + tile.size.toFixed(3) + '; vec2 ti = floor(wu / 0.3 + 0.001); float h1 = gHn(ti), h2 = gHn(ti + 9.1);'
        + ' float sp = (1.0 - smoothstep(0.0, 0.42, wu.y)) * (0.55 + 0.45 * gVn(wu * vec2(5.0, 9.0)));'
        + ' float st = smoothstep(0.58, 0.9, gVn(vec2(wu.x * 7.0, wu.y * 0.45))) * smoothstep(0.2, 1.4, wu.y);'
        + ' vec3 k = vec3(0.975 + 0.035 * h1) * vec3(1.0, 1.0 - 0.01 * h2, 1.0 - 0.02 * h2);'
        + ' k *= mix(vec3(1.0), vec3(0.8, 0.77, 0.71), sp * 0.55); k *= mix(vec3(1.0), vec3(0.9, 0.87, 0.8), st * 0.4);'
        + ' k *= 0.965 + 0.05 * gVn(wu * 1.3); diffuseColor.rgb *= k; }');
  };
  M.tile.customProgramCacheKey = () => 'hallTile';
  // forro: placas de lotes/idades diferentes, algumas com mancha d'água (infiltração) e véu de gordura/fuligem difuso
  M.ceil.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + GLN + 'vec3 gCeilK;\n')
      .replace('#include <map_fragment>', '#include <map_fragment>\n { vec2 wu = vMapUv * ' + ceil.size.toFixed(3) + '; vec2 pi = floor(wu / 0.625 + 0.001), pf = fract(wu / 0.625 + 0.001); float h1 = gHn(pi), h2 = gHn(pi + 5.7), h3 = gHn(pi + 23.1);'
        + ' vec3 k = vec3(0.95 + 0.07 * h1) * vec3(1.0, 1.0 - 0.012 * h2, 1.0 - 0.03 * h2);'
        + ' if (h3 > 0.93) { vec2 c = vec2(0.3 + 0.4 * gHn(pi + 2.0), 0.3 + 0.4 * gHn(pi + 3.0)); float r = 0.18 + 0.2 * gHn(pi + 4.0);'
        + '   float d = length(pf - c) * (0.85 + 0.3 * gVn(pf * 9.0 + pi)); float inside = 1.0 - smoothstep(r - 0.06, r, d); float ring = smoothstep(r - 0.05, r - 0.01, d) * inside;'
        + '   k *= mix(vec3(1.0), vec3(0.92, 0.87, 0.76), inside * 0.35 + ring * 0.4); }'
        + ' k *= 0.94 + 0.07 * gVn(wu * 0.8); gCeilK = k; diffuseColor.rgb *= k; }')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= gCeilK;');
  };
  M.ceil.customProgramCacheKey = () => 'hallCeil';
  M.cove = new THREE.MeshStandardMaterial({ color: 0x9a9993, roughness: 0.45 });
  M.inox = new THREE.MeshStandardMaterial({ color: 0xd2d5d8, metalness: 1, roughness: 0.95, roughnessMap: brushed });
  M.inoxDark = new THREE.MeshStandardMaterial({ color: 0xa4a8ac, metalness: 1, roughness: 1.0, roughnessMap: brushed });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xe8eaec, metalness: 1, roughness: 0.07 });
  M.galv = new THREE.MeshStandardMaterial({ color: 0xc9ccce, metalness: 0.35, roughness: 0.5, envMapIntensity: 2.0 });
  M.yellow = new THREE.MeshStandardMaterial({ color: 0xf5c400, roughness: 0.26, metalness: 0 }); // amarelo-segurança (gás, NBR 6493)
  M.alu = new THREE.MeshStandardMaterial({ color: 0xc9ccce, metalness: 0.6, roughness: 0.35, envMapIntensity: 2.0 });
  M.panelFrame = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.5, emissive: new THREE.Color(1, 0.98, 0.95), emissiveIntensity: 0.35 }); // moldura branca do painel (pintura eletrostática)
  M.trim = new THREE.MeshStandardMaterial({ color: 0xe4e4e0, roughness: 0.4 }); // perfil de arremate (PVC/alumínio anodizado claro)
  M.dark = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.6 });
  M.drainDark = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.15 });
  M.grate = new THREE.MeshStandardMaterial({ color: 0xc0c4c7, metalness: 1, roughness: 0.32, alphaMap: TX.grateTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  M.ledBody = new THREE.MeshStandardMaterial({ color: 0xd9dbdc, roughness: 0.55 });
  M.led = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1.0, 0.965, 0.92), emissiveIntensity: 5.0, roughness: 0.5 });
  M.grey = new THREE.MeshStandardMaterial({ color: 0xa9adb0, roughness: 0.45, metalness: 0.2 });
  M.panel = new THREE.MeshStandardMaterial({ color: 0xc8cac6, roughness: 0.38, metalness: 0.1 });
  M.doorPaint = new THREE.MeshStandardMaterial({ color: 0xd2d4d0, roughness: 0.4 });
  M.red = new THREE.MeshStandardMaterial({ color: 0xb01a1a, roughness: 0.35 });
  M.blue = new THREE.MeshStandardMaterial({ color: 0x1d4f9c, roughness: 0.4 });
  M.white = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.5 });
  M.cloth = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.95 });
  M.box = new THREE.MeshStandardMaterial({ map: TX.cardboardTexture(), roughness: 0.85 });
  M.boxPlain = new THREE.MeshStandardMaterial({ color: 0xb48654, roughness: 0.9 });
  M.crate = new THREE.MeshStandardMaterial({ color: 0x3d6fb3, roughness: 0.55 });
  M.glassPort = new THREE.MeshStandardMaterial({ color: 0x20262a, metalness: 0.2, roughness: 0.05, envMapIntensity: 1.4 });
  const winTex = TX.windowTexture();
  M.windows = [0.32, 0.4, 0.48].map((k) => new THREE.MeshStandardMaterial({ color: 0xd8dde0, emissive: new THREE.Color(0.9, 0.94, 1.0), emissiveMap: winTex, emissiveIntensity: k, roughness: 0.25, metalness: 0 })); // vidro mini-boreal translúcido
  M.window = M.windows[1];
  M.sky = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 1.0, 1.08).multiplyScalar(1.3) });
  M.emerg = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.5 });
  M.rubber = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85 });

  // ───────── lotes (geometrias mescladas por material) ─────────
  const batches = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function put(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = [1, 1, 1], cast = false) {
    _m.compose(new V3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), new V3(...s));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(_m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    const key = mat.uuid + (cast ? 'c' : '') + (g.attributes.color ? 'v' : '');
    if (!batches.has(key)) batches.set(key, { mat, cast, list: [] });
    batches.get(key).list.push(g);
  }
  // em coordenadas de parede (u, y, n) com rotação local
  function wput(w, mat, geo, u, y, n, rx = 0, ry = 0, rz = 0, s, cast = false) {
    const W_ = WALLS[w]; const c = Math.cos(W_.ry), si = Math.sin(W_.ry);
    // eixo u da parede no mundo = (cos ry, 0, -sin ry); n = (sin ry, 0, cos ry)
    const x = W_.o[0] + u * c + n * si, z = W_.o[1] - u * si + n * c;
    _m.compose(new V3(0, 0, 0), _q.setFromEuler(_e.set(rx, ry, rz)), new V3(...(s || [1, 1, 1])));
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(_m);
    put(mat, g, x, y, z, 0, W_.ry, 0, [1, 1, 1], cast);
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // cilindro entre dois pontos
  function tube(mat, a, b, r, seg = 14, cast = false) {
    const A = new V3(...a), B = new V3(...b), d = B.clone().sub(A), L = d.length();
    const g = new THREE.CylinderGeometry(r, r, L, seg, 1, false);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize()); const e = new THREE.Euler().setFromQuaternion(q);
    const mid = A.add(B).multiplyScalar(0.5); put(mat, g, mid.x, mid.y, mid.z, e.x, e.y, e.z, [1, 1, 1], cast);
  }
  const ball = (mat, p, r, cast = false) => put(mat, new THREE.SphereGeometry(r, 14, 10), p[0], p[1], p[2], 0, 0, 0, [1, 1, 1], cast);

  // ───────── piso (com recortes para os ralos) ─────────
  {
    const sh = new THREE.Shape([new THREE.Vector2(HALL.x0, -HALL.z1), new THREE.Vector2(HALL.x1, -HALL.z1), new THREE.Vector2(HALL.x1, -HALL.z0), new THREE.Vector2(HALL.x0, -HALL.z0)]);
    for (const d of DRAINS) sh.holes.push(new THREE.Path([new THREE.Vector2(d.x0, -d.z1), new THREE.Vector2(d.x0, -d.z0), new THREE.Vector2(d.x1, -d.z0), new THREE.Vector2(d.x1, -d.z1)]));
    const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
    const macro = TX.floorMacro(DRAINS);
    M.floor.onBeforeCompile = (s) => {
      s.uniforms.macroMap = { value: macro.map }; s.uniforms.macroRough = { value: macro.rough }; s.uniforms.macroBox = { value: new THREE.Vector4(HALL.x0, HALL.z0, W, D) };
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMac; uniform vec4 macroBox;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\n{ vec4 wpM = modelMatrix * vec4(transformed, 1.0); vMac = (wpM.xz - macroBox.xy) / macroBox.zw; }');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMac; uniform vec4 macroBox; uniform sampler2D macroMap; uniform sampler2D macroRough;' + GLN)
        .replace('#include <map_fragment>', '#include <map_fragment>\n { vec3 mc = 1.0 + (texture2D(macroMap, vMac).rgb * 2.0 - 1.0) * 1.8; vec2 wq = vMac * macroBox.zw + macroBox.xy; vec2 ti = floor(wq / 0.4 + 0.001);'
          + ' float h1 = gHn(ti), h2 = gHn(ti + 17.3); float nb = gVn(wq * 0.9) * 0.6 + gVn(wq * 3.1) * 0.4;'
          + ' diffuseColor.rgb *= mc * (0.955 + 0.07 * h1) * vec3(1.0 + (h2 - 0.5) * 0.025, 1.0, 1.0 - (h2 - 0.5) * 0.035) * (0.95 + 0.07 * nb); }')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor * (1.0 + (texture2D(macroRough, vMac).r * 2.0 - 1.0) * 1.5) * (0.9 + 0.2 * gVn(vMac * vec2(41.0, 30.0))), 0.05, 1.0);');
    };
    const floor = new THREE.Mesh(g, M.floor); floor.receiveShadow = true; floor.name = 'floor'; group.add(floor);
    // canaletas
    for (const d of DRAINS) {
      const cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2, lw = d.x1 - d.x0, ld = d.z1 - d.z0;
      put(M.drainDark, new THREE.PlaneGeometry(lw, ld), cx, -0.07, cz, -Math.PI / 2);
      put(M.inoxDark, new THREE.PlaneGeometry(lw, 0.07), cx, -0.035, d.z0, 0, 0, 0); put(M.inoxDark, new THREE.PlaneGeometry(lw, 0.07), cx, -0.035, d.z1, 0, Math.PI, 0);
      put(M.inoxDark, new THREE.PlaneGeometry(ld, 0.07), d.x0, -0.035, cz, 0, Math.PI / 2, 0); put(M.inoxDark, new THREE.PlaneGeometry(ld, 0.07), d.x1, -0.035, cz, 0, -Math.PI / 2, 0);
      const gg = new THREE.PlaneGeometry(lw, ld); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * lw / 0.32 * (d.sq ? 3 : 1));
      put(M.grate, gg, cx, -0.004, cz, -Math.PI / 2);
      // aro (moldura) inox rente ao piso
      const r = 0.012; for (const [x, z, a, b] of [[cx, d.z0 - r / 2, lw + 2 * r, r], [cx, d.z1 + r / 2, lw + 2 * r, r], [d.x0 - r / 2, cz, r, ld], [d.x1 + r / 2, cz, r, ld]])
        put(M.inox, new THREE.PlaneGeometry(a, b), x, 0.0015, z, -Math.PI / 2);
    }
  }

  // ───────── paredes: azulejo até 2,10 m + pintura (cores por vértice = encardido junto ao piso e manchas de calor) ─────────
  function grime(x, y, z, part) {
    let k = 1;
    if (part === 'tile') { k *= 0.93 + 0.07 * Math.min(1, y / 0.35);
    // gordura/calor junto aos fornos (azulejo amarelado/acinzentado ao redor e acima das bocas)
    for (const o of OVENS) { const ex = Math.max(0, Math.abs(x - o.x) - o.w / 2), ez = Math.max(0, z - (HALL.z0 + o.d)); const d = Math.hypot(ex, ez);
      if (d < 0.9) k *= 1 - 0.1 * (1 - d / 0.9) * Math.min(1, Math.max(0, (y - 0.6) / 1.4)); }
    }
    else {
      // manchas de calor/gordura acima dos fornos (pintura amarelada/acinzentada junto ao forro)
      for (const o of OVENS) if (z < HALL.z0 + 0.05) { const dx = Math.abs(x - o.x) / (o.w * 0.7); if (dx < 1) k *= 1 - 0.07 * (1 - dx * dx) * Math.min(1, Math.max(0, (y - 2.4) / 1.2)); }
      k *= 0.97 + 0.03 * Math.min(1, (HT - y) / 0.4);
    }
    return k;
  }
  for (const [name, w] of Object.entries(WALLS)) {
    for (const part of ['tile', 'paint']) {
      const h = part === 'tile' ? TT : HT - TT, y0 = part === 'tile' ? 0 : TT;
      const g = new THREE.PlaneGeometry(w.len, h, Math.ceil(w.len / 0.6), part === 'tile' ? 6 : 6);
      g.translate(w.len / 2, h / 2 + y0, 0);
      const pos = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(pos.count * 3);
      const c = Math.cos(w.ry), s = Math.sin(w.ry);
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i), y = pos.getY(i); uv.setXY(i, u, y);
        const x = w.o[0] + u * c, z = w.o[1] - u * s; const k = grime(x, y, z, part);
        col[i * 3] = k; col[i * 3 + 1] = k * (part === 'paint' && k < 0.99 ? 0.995 : 1); col[i * 3 + 2] = k * (part === 'paint' && k < 0.99 ? 0.97 : 1);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, part === 'tile' ? M.tile : M.paint); m.position.set(w.o[0], 0, w.o[1]); m.rotation.y = w.ry; m.receiveShadow = true; m.name = 'wall_' + name + '_' + part; group.add(m);
    }
    // rodapé sanitário côncavo (r = 6 cm) e perfil de acabamento no topo do azulejo
    const r = 0.08; // meia-cana sanitária R 80 mm
    const cg = new THREE.ExtrudeGeometry(coveShape(r), { depth: w.len, bevelEnabled: false, curveSegments: 8 });
    cg.rotateY(-Math.PI / 2); // extrusão (z) → −u; perfil x → n
    wput(name, M.cove, cg, w.len, 0, 0);
    wput(name, M.trim, box(w.len, 0.016, 0.014), w.len / 2, TT, 0.007); wput(name, M.trim, box(w.len, 0.004, 0.02), w.len / 2, TT + 0.006, 0.01);
  }
  function coveShape(r) { // perfil no plano (n, y): quarto de círculo côncavo
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, r); // na parede
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; s.lineTo(r - Math.cos(a) * r, r - Math.sin(a) * r); }
    s.lineTo(0, 0); return s;
  }

  // ───────── forro de isopainel + luminárias LED herméticas ─────────
  {
    const g = new THREE.PlaneGeometry(W, D); const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * W, uv.getY(i) * D);
    const m = new THREE.Mesh(g, M.ceil); m.userData.noAO = true; m.rotation.x = Math.PI / 2; m.position.set((HALL.x0 + HALL.x1) / 2, HT, (HALL.z0 + HALL.z1) / 2); m.name = 'ceiling'; group.add(m);
    // luminárias LED embutidas 625×625 (painel opalino em moldura de alumínio) na grade do forro modulado
    const pan = new THREE.PlaneGeometry(0.585, 0.585), fr = box(0.625, 0.012, 0.02), fr2 = box(0.02, 0.012, 0.625);
    const snap = (v, o) => o + 0.3125 + Math.round((v - o - 0.3125) / 0.625) * 0.625; // centro da célula da grade (origem no canto da sala)
    for (const z0 of HC.ledRows) for (const x of HC.ledCols) for (const dx of [-0.3125, 0.3125]) {
      const cx = snap(x + dx, HALL.x0), z = snap(z0, HALL.z0);
      put(M.led, pan, cx, HT - 0.006, z, Math.PI / 2);
      put(M.panelFrame, fr, cx, HT - 0.006, z - 0.3025); put(M.panelFrame, fr, cx, HT - 0.006, z + 0.3025);
      put(M.panelFrame, fr2, cx - 0.3025, HT - 0.006, z); put(M.panelFrame, fr2, cx + 0.3025, HT - 0.006, z);
    }
    // eletroduto que alimenta cada fileira
  }

  // ───────── exaustão: coletor redondo galvanizado ao longo da parede do fundo; insuflamento retangular com difusores ─────────
  {
    const y = 3.62, z = HALL.z0 + 0.22, r = 0.17;
    tube(M.galv, [-3.3, y, z], [HALL.x1, y, z], r, 28, false);
    for (let x = -3.2; x < HALL.x1; x += 1.5) tube(M.galv, [x, y, z], [x + 0.03, y, z], r + 0.012, 28);
    put(M.galv, new THREE.CircleGeometry(r, 28), -3.3, y, z, 0, -Math.PI / 2, 0);
    for (let x = -2.5; x < HALL.x1; x += 3) { tube(M.galv, [x, y + 0.14, z], [x, HT, z], 0.008, 6); tube(M.galv, [x, HT - 0.005, z - 0.1], [x, HT - 0.005, z + 0.1], 0.01, 6); }
    // insuflamento (ar de reposição): duto retangular junto ao forro, com 4 difusores de aletas
    const zd = 1.15, yd = HT - 0.17;
    put(M.galv, box(13.4, 0.3, 0.5), -1.0, yd, zd);
    for (let x = -6.6; x <= 5.6; x += 0.9) put(M.galv, box(0.02, 0.32, 0.52), x, yd, zd);
    for (const x of [-5.6, -2.2, 1.2, 4.6]) { put(M.alu, box(0.42, 0.03, 0.42), x, yd - 0.165, zd); for (let k = -3; k <= 3; k++) put(M.dark, box(0.36, 0.02, 0.012), x, yd - 0.182, zd + k * 0.05); }
    for (let x = -7.2; x <= 5.4; x += 2.0) { tube(M.galv, [x, yd + 0.15, zd - 0.2], [x, HT, zd - 0.2], 0.006, 6); tube(M.galv, [x, yd + 0.15, zd + 0.2], [x, HT, zd + 0.2], 0.006, 6); }
  }

  // ───────── tubulação de gás (amarela, NBR/NR-26) ─────────
  {
    // descida no vão entre o forno turbo 1 e a parede direita, a 2,5 cm da parede do FUNDO (centro a 4,5 cm), presa por
    // abraçadeiras "U"; a alimentação sai da parede direita por niple + registro de esfera cromados (como na FOTO 2)
    const rp = 0.021, yv = 1.7, yb = 1.06, xp = HALL.x1 - 0.17, zp = HALL.z0 + 0.045;
    const f1 = OVENS.find((o) => o.id === 'forno1'); const xs = f1.x + f1.w / 2;
    put(M.chrome, new THREE.CylinderGeometry(0.04, 0.04, 0.006, 24), HALL.x1 - 0.003, yv, zp, 0, 0, Math.PI / 2); // espelho
    tube(M.chrome, [HALL.x1, yv, zp], [xp, yv, zp], 0.018, 16);
    put(M.chrome, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), HALL.x1 - 0.035, yv, zp, 0, 0, Math.PI / 2); // sextavado
    put(M.chrome, new THREE.SphereGeometry(0.042, 20, 14), HALL.x1 - 0.085, yv, zp, 0, 0, 0, [1.2, 1, 1]); // corpo do registro
    put(M.chrome, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), HALL.x1 - 0.135, yv, zp, 0, 0, Math.PI / 2);
    tube(M.chrome, [HALL.x1 - 0.085, yv, zp], [HALL.x1 - 0.085, yv + 0.07, zp], 0.009, 10);
    put(M.chrome, new THREE.CylinderGeometry(0.016, 0.016, 0.018, 6), HALL.x1 - 0.085, yv + 0.075, zp);
    put(M.yellow, box(0.17, 0.014, 0.018), HALL.x1 - 0.085 - 0.075, yv + 0.084, zp + 0.004); // alavanca (aberta: paralela ao niple)
    put(M.rubber, box(0.06, 0.02, 0.024), HALL.x1 - 0.085 - 0.15, yv + 0.084, zp + 0.004);
    ball(M.chrome, [xp, yv, zp], 0.029); tube(M.chrome, [xp, yv, zp], [xp, yv - 0.06, zp], rp + 0.004, 16); // cotovelo + luva
    tube(M.yellow, [xp, yv - 0.06, zp], [xp, yb + 0.01, zp], rp, 16);
    put(M.yellow, new THREE.CylinderGeometry(0.03, 0.03, 0.038, 6), xp, yv - 0.3, zp); // união
    put(M.yellow, new THREE.CylinderGeometry(0.025, 0.025, 0.055, 16), xp, yv - 0.3, zp);
    ball(M.chrome, [xp, yb, zp], 0.027); tube(M.chrome, [xp, yb, zp], [xp - 0.06, yb, zp], rp + 0.004, 16);
    tube(M.yellow, [xp - 0.06, yb, zp], [xs, yb, zp], rp, 16);
    put(M.chrome, new THREE.CylinderGeometry(0.027, 0.027, 0.03, 6), xs + 0.03, yb, zp, 0, 0, Math.PI / 2); // conector no forno
    const uc = new THREE.TorusGeometry(rp + 0.003, 0.0035, 6, 14, Math.PI);
    for (const y of [1.4, 1.17]) {
      put(M.galv, uc, xp, y, zp, Math.PI / 2, 0, 0); // meia-volta do lado da sala
      for (const sx of [-1, 1]) { put(M.galv, box(0.004, 0.007, 0.045), xp + sx * (rp + 0.003), y, HALL.z0 + 0.022); put(M.galv, box(0.018, 0.02, 0.004), xp + sx * (rp + 0.012), y, HALL.z0 + 0.002); }
    }
    // rede principal junto ao forro (parede do fundo) e descida para o forno rotativo a gás
    const ym = 3.3, zm = HALL.z0 + 0.07, rot = OVENS.find((o) => o.id === 'rotativo'), xr = rot.x + rot.w / 2 + 0.17;
    tube(M.yellow, [xr, ym, zm], [HALL.x1, ym, zm], 0.024, 14);
    ball(M.yellow, [xr, ym, zm], 0.03);
    tube(M.yellow, [xr, ym, zm], [xr, 0.95, zm], 0.0165, 14);
    put(M.chrome, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 6), xr, 1.25, zm); ball(M.chrome, [xr, 1.25, zm], 0.028);
    put(M.yellow, box(0.12, 0.012, 0.012), xr + 0.05, 1.29, zm + 0.02);
    ball(M.yellow, [xr, 0.95, zm], 0.022); tube(M.yellow, [xr, 0.95, zm], [rot.x + rot.w / 2, 0.95, zm], 0.0165, 12);
    for (let x = xr + 1.2; x < HALL.x1; x += 1.8) { put(M.galv, box(0.04, 0.05, 0.004), x, ym, HALL.z0 + 0.002); put(M.galv, new THREE.TorusGeometry(0.028, 0.004, 6, 16), x, ym, zm, 0, Math.PI / 2, 0); }
    // a rede passa pela parede direita (bucha)
    put(M.yellow, new THREE.CylinderGeometry(0.04, 0.04, 0.01, 20), HALL.x1 - 0.005, ym, zm, 0, 0, Math.PI / 2);
  }

  // ───────── torneira cromada de lavagem (parede direita) + tomadas industriais ─────────
  {
    const z = -4.25, y = 0.72;
    wput('right', M.chrome, new THREE.CylinderGeometry(0.035, 0.035, 0.008, 24), uOf.right(z), y, 0.004, Math.PI / 2);
    wput('right', M.chrome, new THREE.CylinderGeometry(0.014, 0.014, 0.06, 16), uOf.right(z), y, 0.03, Math.PI / 2);
    wput('right', M.chrome, new THREE.CylinderGeometry(0.022, 0.02, 0.07, 16), uOf.right(z), y, 0.085, Math.PI / 2);
    wput('right', M.chrome, new THREE.CylinderGeometry(0.012, 0.011, 0.07, 16), uOf.right(z), y - 0.04, 0.11);
    wput('right', M.chrome, new THREE.CylinderGeometry(0.016, 0.014, 0.025, 16), uOf.right(z), y - 0.085, 0.11);
    wput('right', M.chrome, new THREE.CylinderGeometry(0.008, 0.008, 0.05, 10), uOf.right(z), y + 0.03, 0.085);
    wput('right', M.chrome, box(0.09, 0.012, 0.016), uOf.right(z), y + 0.058, 0.085);
    // tomadas 3P+T (caixa cinza + tampa azul/vermelha) junto à bancada e ao fundo
    for (const [w, u, yy] of [['right', uOf.right(-1.6), 1.3], ['back', uOf.back(-3.6), 1.35], ['left', uOf.left(-2.5), 1.3]]) {
      for (const [k, mat] of [[-0.075, M.blue], [0.075, M.red]]) {
        wput(w, M.grey, box(0.12, 0.16, 0.08), u + k, yy, 0.04, 0, 0, 0, undefined, true);
        wput(w, mat, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 20), u + k, yy + 0.01, 0.1, 0.5);
      }
      wput(w, M.galv, new THREE.CylinderGeometry(0.012, 0.012, 2.9 - yy - 0.08, 8), u, (2.9 + yy + 0.08) / 2, 0.02);
    }
    // eletroduto horizontal a 2,9 m nas paredes laterais
    for (const w of ['right', 'left']) {
      wput(w, M.galv, new THREE.CylinderGeometry(0.014, 0.014, D - 0.4, 10), D / 2, 2.9, 0.022, 0, 0, Math.PI / 2);
      for (let u = 0.6; u < D - 0.3; u += 1.5) { wput(w, M.galv, new THREE.TorusGeometry(0.017, 0.003, 5, 12, Math.PI), u, 2.9, 0.022, 0, Math.PI / 2, Math.PI / 2); wput(w, M.galv, box(0.012, 0.05, 0.004), u, 2.9, 0.002); }
    }
  }

  // ───────── portas ─────────
  {
    // porta principal (vaivém dupla, inox, visores redondos) na parede da frente
    const u0 = uOf.front(1.8), Wd = 1.6, Hd = 2.1;
    wput('front', M.alu, box(Wd + 0.16, 0.08, 0.06), u0 + Wd / 2, Hd + 0.04, 0.03, 0, 0, 0, undefined, true);
    for (const s of [0, 1]) wput('front', M.alu, box(0.08, Hd, 0.06), u0 - 0.04 + s * (Wd + 0.08), Hd / 2, 0.03);
    for (const s of [0, 1]) {
      const cu = u0 + Wd * 0.25 + s * Wd * 0.5;
      wput('front', M.inox, box(Wd / 2 - 0.012, Hd - 0.03, 0.04), cu, Hd / 2 + 0.01, 0.025);
      wput('front', M.inoxDark, box(Wd / 2 - 0.05, 0.3, 0.004), cu, 0.2, 0.047); // chapa de chute
      wput('front', M.rubber, new THREE.TorusGeometry(0.16, 0.018, 8, 32), cu, 1.5, 0.047);
      wput('front', M.glassPort, new THREE.CircleGeometry(0.16, 32), cu, 1.5, 0.046);
      wput('front', M.inoxDark, box(0.1, 0.3, 0.004), cu + (s ? -0.24 : 0.24), 1.1, 0.047); // placa de empurrar
    }
    // saída de emergência (parede esquerda): porta de aço pintada com barra antipânico
    const ue = uOf.left(1.6), We = 1.0;
    wput('left', M.alu, box(We + 0.14, 0.07, 0.06), ue + We / 2, Hd + 0.035, 0.03);
    for (const s of [0, 1]) wput('left', M.alu, box(0.07, Hd, 0.06), ue - 0.035 + s * (We + 0.07), Hd / 2, 0.03);
    wput('left', M.doorPaint, box(We - 0.01, Hd - 0.02, 0.045), ue + We / 2, Hd / 2, 0.025);
    wput('left', M.red, box(We - 0.18, 0.05, 0.04), ue + We / 2, 1.0, 0.075);
    for (const k of [-1, 1]) wput('left', M.inoxDark, box(0.06, 0.1, 0.06), ue + We / 2 + k * (We / 2 - 0.08), 1.0, 0.06);
    // luminárias de emergência sobre as portas
    for (const [w, u] of [['front', u0 + Wd / 2], ['left', ue + We / 2]]) { wput(w, M.white, box(0.34, 0.07, 0.05), u, 2.62, 0.025); wput(w, M.emerg, box(0.28, 0.012, 0.01), u, 2.592, 0.045); }
  }

  // ───────── janelas altas basculantes (alumínio + vidro mini-boreal translúcido) ─────────
  {
    const wins = [['left', uOf.left(-3.2), 1.6], ['left', uOf.left(-0.6), 1.6], ['front', uOf.front(-5.4), 1.6], ['front', uOf.front(-2.6), 1.6], ['front', uOf.front(4.4), 1.6], ['front', uOf.front(7.0), 1.4]];
    const y0 = 2.75, Hh = 0.8;
    const tilt = 0.32; // bandeiras basculantes entreabertas (topo para dentro)
    let wi = 0;
    for (const [w, u, Ww] of wins) {
      wi++;
      wput(w, M.paint, box(Ww + 0.1, 0.05, 0.14), u, y0 - 0.025, 0.07); // peitoril
      wput(w, M.sky, new THREE.PlaneGeometry(Ww, Hh), u, y0 + Hh / 2, 0.004); // claridade externa vista pelas frestas
      // marco
      for (const sx of [-1, 1]) wput(w, M.alu, box(0.05, Hh + 0.05, 0.07), u + sx * (Ww / 2 + 0.0), y0 + Hh / 2, 0.035);
      for (const yy of [y0, y0 + Hh]) wput(w, M.alu, box(Ww + 0.05, 0.05, 0.07), u, yy, 0.035);
      const ph = Hh / 3 - 0.02;
      for (let k = 0; k < 3; k++) {
        const yb = y0 + 0.025 + k * (Hh / 3), cy = yb + (ph / 2) * Math.cos(tilt), cn = 0.035 + (ph / 2) * Math.sin(tilt);
        wput(w, M.alu, box(Ww - 0.07, ph, 0.022), u, cy, cn, tilt, 0, 0); // caixilho da bandeira
        wput(w, M.windows[(k + wi) % 3], new THREE.PlaneGeometry(Ww - 0.12, ph - 0.05), u, cy - 0.012 * Math.sin(tilt), cn + 0.012 * Math.cos(tilt), tilt, 0, 0);
        wput(w, M.dark, box(0.08, 0.012, 0.02), u, yb + ph * Math.cos(tilt) - 0.02, 0.035 + ph * Math.sin(tilt) + 0.012, tilt, 0, 0); // fecho
      }
      wput(w, M.alu, box(0.03, Hh, 0.012), u, y0 + Hh / 2, 0.06); // haste do comando
    }
  }

  // ───────── quadro elétrico (parede esquerda, fundo) ─────────
  {
    const u = uOf.left(-5.05);
    wput('left', M.panel, box(0.8, 1.2, 0.25), u, 1.6, 0.125, 0, 0, 0, undefined, true);
    wput('left', M.grey, box(0.76, 1.16, 0.01), u, 1.6, 0.255);
    wput('left', M.dark, box(0.03, 0.12, 0.03), u + 0.3, 1.6, 0.27);
    wput('left', M.galv, new THREE.CylinderGeometry(0.025, 0.025, HT - 2.2, 8), u - 0.2, (HT + 2.2) / 2, 0.06);
    wput('left', M.galv, new THREE.CylinderGeometry(0.025, 0.025, HT - 2.2, 8), u + 0.2, (HT + 2.2) / 2, 0.06);
  }

  // ───────── prateleiras inox de parede com caixas, cubas, bandejas e panos (FOTO 5) ─────────
  {
    const R = TX.rng(17);
    const shelfRun = (w, uA, uB, levels) => {
      const L = uB - uA, dep = 0.38;
      for (const y of levels) {
        wput(w, M.inox, box(L, 0.025, dep), (uA + uB) / 2, y, dep / 2 + 0.01, 0, 0, 0, undefined, true);
        wput(w, M.inox, box(L, 0.045, 0.012), (uA + uB) / 2, y - 0.01, dep + 0.016); // borda dobrada
        wput(w, M.inox, box(L, 0.07, 0.01), (uA + uB) / 2, y + 0.045, 0.012); // espelho traseiro
        for (let u = uA + 0.1; u <= uB - 0.09; u += Math.max(0.6, (L - 0.2) / Math.ceil((L - 0.2) / 0.9))) {
          wput(w, M.inoxDark, box(0.012, 0.28, 0.03), u, y - 0.15, 0.03); // mão-francesa
          wput(w, M.inoxDark, box(0.012, 0.03, dep - 0.06), u, y - 0.03, dep / 2, 0, 0, 0);
          wput(w, M.inoxDark, box(0.012, 0.38, 0.02), u, y - 0.14, dep * 0.45, -0.85, 0, 0);
        }
        // itens
        let u = uA + 0.08;
        while (u < uB - 0.3) {
          const kind = R(), top = y + 0.0125;
          if (kind < 0.32) { const bw = 0.34 + R() * 0.12, bh = 0.16 + R() * 0.1, n = 1 + Math.floor(R() * 2);
            for (let k = 0; k < n; k++) wput(w, k === n - 1 ? M.box : M.boxPlain, box(bw, bh, 0.3), u + bw / 2, top + bh / 2 + k * bh, 0.2, 0, (R() - 0.5) * 0.08, 0, undefined, true); u += bw + 0.04; }
          else if (kind < 0.55) { const n = 2 + Math.floor(R() * 4); // cubas gastronômicas empilhadas
            for (let k = 0; k < n; k++) { wput(w, M.inox, box(0.32, 0.012, 0.26), u + 0.16, top + 0.06 + k * 0.028, 0.2); wput(w, M.inox, box(0.3, 0.055, 0.24), u + 0.16, top + 0.03 + k * 0.028, 0.2); }
            u += 0.38; }
          else if (kind < 0.72) { const n = 3 + Math.floor(R() * 5); // esteiras/assadeiras perfuradas empilhadas
            for (let k = 0; k < n; k++) wput(w, M.alu, box(0.58, 0.012, 0.3), u + 0.29, top + 0.008 + k * 0.016, 0.2, 0, (R() - 0.5) * 0.04, 0, undefined, true); u += 0.62; }
          else if (kind < 0.86) { const n = 2 + Math.floor(R() * 3); // panos brancos dobrados
            for (let k = 0; k < n; k++) wput(w, M.cloth, box(0.3, 0.045, 0.22), u + 0.16, top + 0.024 + k * 0.047, 0.2, 0, (R() - 0.5) * 0.12, 0); u += 0.36; }
          else { wput(w, M.crate, box(0.4, 0.17, 0.3), u + 0.2, top + 0.085, 0.2, 0, 0, 0, undefined, true); u += 0.45; }
        }
      }
    };
    shelfRun('right', uOf.right(0.35), uOf.right(3.55), [1.42, 1.86]);
    shelfRun('left', uOf.left(-1.0), uOf.left(-4.2), [1.42, 1.86]);
  }

  // ───────── sinalização ─────────
  {
    const sign = (kind, w, u, y, sw, sh) => { const m = new THREE.MeshStandardMaterial({ map: TX.signTexture(kind), roughness: 0.45 }); wput(w, m, new THREE.PlaneGeometry(sw, sh), u, y, 0.006); };
    sign('saida', 'front', uOf.front(1.0), 2.38, 0.42, 0.21);
    sign('saida', 'left', uOf.left(1.1), 2.38, 0.42, 0.21);
    sign('rota_r', 'right', uOf.right(4.6), 1.75, 0.36, 0.18);
    sign('rota_l', 'back', uOf.back(-5.8), 1.75, 0.36, 0.18);
    sign('rota_r', 'left', uOf.left(-1.6), 2.4, 0.36, 0.18);
    sign('touca', 'front', uOf.front(2.35), 1.55, 0.36, 0.18);
    sign('eletrico', 'left', uOf.left(-5.05), 2.38, 0.3, 0.15);
  }

  // ───────── mescla e cena ─────────
  for (const { mat, cast, list } of batches.values()) {
    const g = mergeGeometries(list, false); if (!g) { console.warn('[hall] lote vazio', mat); continue; }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; group.add(m);
    for (const l of list) l.dispose();
  }
  stage.scene.add(group);
  // ambiente: o prédio da sala de fornos só aparece quando env === 'fornos'
  const showFor = (id) => { group.visible = (id ?? 'fornos') === 'fornos'; };
  showFor(app?.state?.env); app?.on?.('env', showFor);

  // Luzes do prédio vêm do palco (scene.js); aqui só o brilho das luminárias acompanha a exposição.
  return {
    group, materials: M, drains: DRAINS,
    update() {},
  };
}
void ovenFrontZ;
