// PAINEL DA CALDEIRA — dono: PAINEL. buildPanels(stage, app, ctx) → { cald1, cald2, list, press(id,key), setMode(id,m),
// state(id), touch(id,u,v), update(dt,t) }. Armário de aço (RAL 7035, epóxi texturizado) sobre pedestal, porta com
// dobradiças, fecho com manopla, vedação, pingadeira; IHM 10" com vidro e reflexo; botões 22 mm com anel cromado e LED;
// sinaleiros; chave MAN-0-AUT; botão de emergência; plaquetas gravadas; etiqueta NR-10; prensa-cabos e eletrodutos.
// Clique (raycast em stage.canvas; só em env 'caldeiras'; arrasto > 5 px é ignorado) comanda o controlador (cald_panel_ctl).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOILERS } from './layout_caldeiras.js';
import * as PT from './cald_panel_tex.js';
import { createController, fmtHMS } from './cald_panel_ctl.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const M4 = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => new THREE.Matrix4().compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...(typeof s === 'number' ? [s, s, s] : s)));
const OUT = [Math.PI / 2, 0, 0]; // eixo +y da geometria → normal da porta (+z)
class Bag {
  constructor() { this.m = new Map(); }
  add(k, geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (m) g.applyMatrix4(m); (this.m.get(k) || this.m.set(k, []).get(k)).push(g);
  }
  build(parent, mats, shadow = []) {
    for (const [k, l] of this.m) { const g = mergeGeometries(l, false); l.forEach((x) => x.dispose()); if (!g) continue; const me = new THREE.Mesh(g, mats[k]); me.castShadow = shadow.includes(k); me.receiveShadow = true; me.name = 'cpanel_' + k; parent.add(me); }
    this.m.clear();
  }
}
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const remapUV = (geo, [u0, v0, u1, v1]) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return geo; };

// geometrias compartilhadas
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
const BEZEL = () => geo('bezel', () => lathe([[0.0106, 0], [0.0149, 0], [0.0151, 0.0016], [0.0149, 0.0046], [0.0141, 0.0063], [0.0126, 0.0068], [0.0113, 0.0062], [0.0108, 0.0036], [0.0106, 0]], 40));

const LENS = { LIGA: 0x1fbf4a, DESL: 0xe02a20, REARME: 0x2f74e0, TESTE: 0xf2f2ea, POW: 0xf4f1e6, CHAMA: 0x1fd04e, PART: 0xffa012, FALHA: 0xff2a1e };

export function buildPanels(stage, app, ctx) {
  const group = ctx.group, pm = PT.paintMaps();
  const ral = new THREE.Color('#c9cdc9');
  const mats = {
    body: new THREE.MeshStandardMaterial({ color: ral, roughness: 0.62, roughnessMap: pm.rough, normalMap: pm.normal, normalScale: new THREE.Vector2(0.12, 0.12), metalness: 0.08, map: PT.grimeMap(71, { w: 256, h: 512 }) }),
    paint: new THREE.MeshStandardMaterial({ color: ral, roughness: 0.6, normalMap: pm.normal, normalScale: new THREE.Vector2(0.1, 0.1), metalness: 0.08 }),
    black: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.48, metalness: 0.05 }),
    blackMatte: new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.75, metalness: 0.0 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf0f1f2, roughness: 0.12, metalness: 1 }),
    zinc: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.38, metalness: 0.9 }),
    galv: new THREE.MeshStandardMaterial({ color: 0xa9aeb1, roughness: 0.55, metalness: 0.85 }),
    cable: new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.55 }),
    cableGrey: new THREE.MeshStandardMaterial({ color: 0x6d7175, roughness: 0.6 }),
    hmiBezel: new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.55, metalness: 0.1 }),
    checker: new THREE.MeshStandardMaterial({ color: 0x8e9396, roughness: 0.5, metalness: 0.85 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  };
  const ledT = PT.ledMap();
  const hits = [], P = {};

  for (const b of BOILERS.filter((q) => q.kind === 'flamotubular')) {
    const num = b.id === 'cald1' ? 1 : 2, [cx, , zc] = b.c, zf = zc + b.L / 2;
    const g = new THREE.Group(); g.name = 'painel_' + b.id; g.position.set(cx - 1.95, 0, zf + 0.42); group.add(g);
    const bag = new Bag(), CY = 1.3, ZD = 0.174, DX = (x) => x, DY = (y) => CY + y;
    const ctl = createController(app, b.id, num);
    // ── armário ──
    bag.add('body', new RoundedBoxGeometry(0.8, 1.0, 0.3, 3, 0.006), M4([0, CY, 0]));
    bag.add('rubber', new THREE.BoxGeometry(0.795, 0.995, 0.008), M4([0, CY, 0.154])); // vedação (aparece na fresta da porta)
    bag.add('paint', new THREE.BoxGeometry(0.85, 0.008, 0.35), M4([0, CY + 0.507, 0.012], [0.05, 0, 0])); // pingadeira
    bag.add('paint', new THREE.BoxGeometry(0.85, 0.024, 0.006), M4([0, CY + 0.497, 0.19]));
    for (const sx of [-0.3, 0.3]) bag.add('zinc', new THREE.TorusGeometry(0.014, 0.004, 8, 20), M4([sx, CY + 0.53, 0], [0, 0, 0])); // olhais
    // ventilador com filtro na lateral direita
    bag.add('paint', new RoundedBoxGeometry(0.014, 0.15, 0.15, 2, 0.003), M4([0.405, CY - 0.25, 0]));
    for (let i = 0; i < 7; i++) bag.add('blackMatte', new THREE.BoxGeometry(0.006, 0.006, 0.12), M4([0.413, CY - 0.31 + i * 0.02, 0], [0, 0, -0.5]));
    // porta (chapa dobrada com cantos arredondados) — mapa próprio com sujeira/marcas de mão
    const doorMat = mats.body.clone(); doorMat.map = PT.grimeMap(100 + num * 7, { door: true });
    const door = new THREE.Mesh(new RoundedBoxGeometry(0.786, 0.986, 0.02, 3, 0.0035), doorMat); door.position.set(0, CY, 0.164); door.castShadow = true; door.receiveShadow = true; g.add(door);
    // dobradiças externas (esquerda) e fecho com manopla (direita)
    for (const dy of [-0.36, 0.36]) {
      bag.add('zinc', new THREE.CylinderGeometry(0.0075, 0.0075, 0.075, 14), M4([-0.4, DY(dy), 0.166]));
      bag.add('zinc', new THREE.CylinderGeometry(0.0082, 0.0082, 0.004, 14), M4([-0.4, DY(dy + 0.0395), 0.166]));
      bag.add('zinc', new THREE.BoxGeometry(0.03, 0.07, 0.003), M4([-0.38, DY(dy), 0.1755]));
      for (const yy of [-0.022, 0.022]) bag.add('chrome', new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), M4([-0.372, DY(dy + yy), 0.177], OUT));
    }
    bag.add('black', new RoundedBoxGeometry(0.034, 0.14, 0.01, 2, 0.004), M4([0.345, CY, ZD + 0.004]));
    bag.add('black', new RoundedBoxGeometry(0.02, 0.105, 0.014, 2, 0.006), M4([0.345, CY - 0.012, ZD + 0.016]));
    bag.add('chrome', new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 20), M4([0.345, CY + 0.053, ZD + 0.011], OUT));
    bag.add('rubber', new THREE.BoxGeometry(0.0015, 0.007, 0.001), M4([0.345, CY + 0.053, ZD + 0.0142]));
    // ── IHM 10" ──
    const HY = 0.245;
    bag.add('hmiBezel', new RoundedBoxGeometry(0.29, 0.205, 0.016, 3, 0.004), M4([0, DY(HY), ZD + 0.006]));
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 640; const ht = new THREE.CanvasTexture(cv); ht.colorSpace = THREE.SRGBColorSpace; ht.anisotropy = 8;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2216, 0.1385), new THREE.MeshBasicMaterial({ map: ht, color: new THREE.Color(1.3, 1.3, 1.3) }));
    scr.position.set(0, DY(HY + 0.004), ZD + 0.0142); scr.userData.noBloom = true; g.add(scr);
    bag.add('rubber', new THREE.PlaneGeometry(0.2276, 0.1445), M4([0, DY(HY + 0.004), ZD + 0.0141]));
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.238, 0.152), new THREE.MeshStandardMaterial({ color: 0x0e0e0e, metalness: 1, roughness: 0.05, emissive: 0xffffff, emissiveMap: PT.glassStreak(), emissiveIntensity: 0.12, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glass.position.set(0, DY(HY + 0.004), ZD + 0.0146); glass.userData.noBloom = true; glass.raycast = () => {}; g.add(glass);
    bag.add('black', new THREE.CylinderGeometry(0.0022, 0.0022, 0.001, 10), M4([0.128, DY(HY - 0.087), ZD + 0.0145], OUT)); // LED de status da IHM
    // ── atlas de plaquetas ──
    const items = [
      { key: 'title', w: 0.36, h: 0.036, draw: PT.engraved([`CALDEIRA ${num} — COMANDO DO QUEIMADOR`], { size: 0.62 }) },
      { key: 'tag', w: 0.11, h: 0.026, draw: PT.engraved([`QC-CAL-0${num}`], { size: 0.6 }) },
      { key: 'data', w: 0.085, h: 0.06, draw: PT.dataPlate(num) },
      { key: 'nr10', w: 0.095, h: 0.135, draw: PT.nr10Sticker },
      { key: 'sel', w: 0.056, h: 0.056, draw: PT.selectorLegend },
      { key: 'estop', w: 0.068, h: 0.068, draw: PT.estopDisk },
      ...[['lPOW', 'ENERGIZADO'], ['lCHAMA', 'CHAMA'], ['lPART', 'PARTIDA'], ['lFALHA', 'FALHA'], ['lLIGA', 'LIGA'], ['lDESL', 'DESL.'], ['lREARME', 'REARME'], ['lTESTE', 'TESTE'], ['lMODO', 'MODO'], ['lEM', 'EMERGÊNCIA']]
        .map(([key, t]) => ({ key, w: 0.072, h: 0.018, draw: PT.engraved([t], { size: 0.72, rivets: false }) })),
    ];
    const atlas = PT.plaqueAtlas(items), pmat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.38, metalness: 0.05 });
    const pbag = new Bag();
    const plaque = (key, x, y, w, h, t = 0.0012) => { pbag.add('p', remapUV(new THREE.PlaneGeometry(w, h), atlas.rects[key]), M4([x, DY(y), ZD + t + 0.0002])); bag.add('rubber', new THREE.BoxGeometry(w, h, t), M4([x, DY(y), ZD + t / 2])); };
    plaque('title', 0, 0.447, 0.36, 0.036); plaque('tag', -0.27, 0.395, 0.11, 0.026); plaque('data', -0.27, 0.3, 0.085, 0.06, 0.0008); plaque('nr10', 0.27, 0.27, 0.095, 0.135, 0.0003);
    // ── sinaleiros, botões, chave, emergência ──
    const lensMats = {};
    const lensMat = (k) => (lensMats[k] = new THREE.MeshStandardMaterial({ color: new THREE.Color(LENS[k]).multiplyScalar(0.55), roughness: 0.22, metalness: 0, emissive: LENS[k], emissiveMap: ledT, emissiveIntensity: 0 }));
    const parts = {};
    const xs = [-0.18, -0.06, 0.06, 0.18];
    ['POW', 'CHAMA', 'PART', 'FALHA'].forEach((k, i) => {
      const x = xs[i], y = 0.07; bag.add('chrome', BEZEL(), M4([x, DY(y), ZD], OUT));
      const lens = new THREE.Mesh(geo('pilot', () => lathe([[0, 0.0165], [0.005, 0.016], [0.0085, 0.0145], [0.0102, 0.0118], [0.0104, 0.004], [0.0104, 0]], 28)), lensMat(k));
      lens.position.set(x, DY(y), ZD); lens.rotation.x = Math.PI / 2; g.add(lens); parts[k] = lens;
      plaque('l' + k, x, y - 0.034, 0.072, 0.018);
    });
    ['LIGA', 'DESL', 'REARME', 'TESTE'].forEach((k, i) => {
      const x = xs[i], y = -0.085; bag.add('chrome', BEZEL(), M4([x, DY(y), ZD], OUT));
      bag.add('black', new THREE.CylinderGeometry(0.0107, 0.0107, 0.003, 28), M4([x, DY(y), ZD + 0.0015], OUT));
      const lens = new THREE.Mesh(geo('btn', () => new THREE.CylinderGeometry(0.0098, 0.0098, 0.0058, 32)), lensMat(k));
      lens.position.set(x, DY(y), ZD + 0.0034); lens.rotation.x = Math.PI / 2; lens.userData.z0 = lens.position.z; g.add(lens); parts[k] = lens;
      const h = new THREE.Mesh(geo('hitBtn', () => new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12)), mats.hit); h.position.copy(lens.position); h.rotation.x = Math.PI / 2; h.userData = { id: b.id, key: k.toLowerCase() }; g.add(h); hits.push(h);
      plaque('l' + k, x, y - 0.034, 0.072, 0.018);
    });
    // chave seletora MAN-0-AUT (manopla preta)
    const SX = -0.12, SY = -0.26;
    plaque('sel', SX, SY + 0.004, 0.056, 0.056, 0.0008); bag.add('chrome', BEZEL(), M4([SX, DY(SY), ZD + 0.0008], OUT));
    const knob = new THREE.Group(); knob.position.set(SX, DY(SY), ZD + 0.0008); g.add(knob);
    { const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.0118, 0.0124, 0.009, 28), mats.black); kb.rotation.x = Math.PI / 2; kb.position.z = 0.0045; knob.add(kb);
      const lev = new THREE.Mesh(new RoundedBoxGeometry(0.0095, 0.034, 0.014, 2, 0.003), mats.black); lev.position.z = 0.014; knob.add(lev);
      const mk = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.011, 0.0008), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 })); mk.position.set(0, 0.009, 0.0212); knob.add(mk); }
    plaque('lMODO', SX, SY - 0.045, 0.072, 0.018);
    for (const [k, dx] of [['selL', -0.017], ['selR', 0.017]]) { const h = new THREE.Mesh(geo('hitSel', () => new THREE.BoxGeometry(0.03, 0.05, 0.03)), mats.hit); h.position.set(SX + dx, DY(SY), ZD + 0.012); h.userData = { id: b.id, key: k }; g.add(h); hits.push(h); }
    // emergência (cogumelo vermelho sobre disco amarelo)
    const EX = 0.12, EY = -0.26;
    { const d = remapUV(new THREE.CircleGeometry(0.034, 48), atlas.rects.estop); pbag.add('p', d, M4([EX, DY(EY), ZD + 0.0011])); bag.add('rubber', new THREE.CylinderGeometry(0.034, 0.034, 0.001, 48), M4([EX, DY(EY), ZD + 0.0005], OUT)); }
    bag.add('chrome', BEZEL(), M4([EX, DY(EY), ZD + 0.0011], OUT));
    bag.add('black', new THREE.CylinderGeometry(0.0125, 0.0135, 0.014, 28), M4([EX, DY(EY), ZD + 0.008], OUT));
    const mush = new THREE.Mesh(lathe([[0, 0.0175], [0.009, 0.017], [0.0155, 0.0148], [0.0195, 0.0105], [0.0198, 0.006], [0.017, 0.0035], [0.009, 0.0025], [0.009, 0]], 40), new THREE.MeshStandardMaterial({ color: 0xc8140f, roughness: 0.3 }));
    mush.rotation.x = Math.PI / 2; mush.position.set(EX, DY(EY), ZD + 0.014); mush.userData.z0 = mush.position.z; g.add(mush);
    { const h = new THREE.Mesh(geo('hitEm', () => new THREE.CylinderGeometry(0.028, 0.028, 0.03, 12)), mats.hit); h.position.copy(mush.position); h.rotation.x = Math.PI / 2; h.userData = { id: b.id, key: 'estop' }; g.add(h); hits.push(h); }
    plaque('lEM', EX, EY - 0.05, 0.072, 0.018);
    // tela tocável
    scr.userData = { id: b.id, key: 'hmi', noBloom: true }; hits.push(scr);
    pbag.build(g, { p: pmat });
    // ── pedestal, placa de prensa-cabos, eletrodutos, caixa de passagem ──
    const YB = CY - 0.5;
    for (const sx of [-0.3, 0.3]) {
      bag.add('paint', new THREE.BoxGeometry(0.08, YB, 0.004), M4([sx, YB / 2, -0.1])); // alma do perfil U
      for (const ex of [-0.038, 0.038]) bag.add('paint', new THREE.BoxGeometry(0.004, YB, 0.045), M4([sx + ex, YB / 2, -0.078]));
      bag.add('galv', new THREE.BoxGeometry(0.16, 0.01, 0.16), M4([sx, 0.005, -0.06]));
      for (const ax of [-0.055, 0.055]) { bag.add('zinc', new THREE.CylinderGeometry(0.009, 0.009, 0.008, 6), M4([sx + ax, 0.014, -0.02])); bag.add('zinc', new THREE.CylinderGeometry(0.005, 0.005, 0.022, 8), M4([sx + ax, 0.02, -0.02])); }
      bag.add('paint', new THREE.BoxGeometry(0.12, 0.012, 0.22), M4([sx, YB - 0.006, -0.03]));
    }
    bag.add('paint', new THREE.BoxGeometry(0.56, 0.04, 0.004), M4([0, 0.38, -0.1])); // travessa
    bag.add('blackMatte', new THREE.BoxGeometry(0.66, 0.005, 0.22), M4([0, YB - 0.0025, 0.0])); // placa de prensa-cabos
    // caixa de passagem no piso (tampa xadrez aparafusada)
    bag.add('checker', new THREE.BoxGeometry(0.42, 0.01, 0.24), M4([0, 0.005, 0.03]));
    for (const [bx2, bz2] of [[-0.19, -0.08], [0.19, -0.08], [-0.19, 0.14], [0.19, 0.14]]) bag.add('zinc', new THREE.CylinderGeometry(0.007, 0.007, 0.004, 6), M4([bx2, 0.012, bz2]));
    // eletrodutos rígidos galvanizados (3/4" e 1") com bucha/arruela e luva
    for (const [x, r] of [[-0.21, 0.0134], [-0.13, 0.0167]]) {
      bag.add('galv', new THREE.CylinderGeometry(r, r, YB - 0.01, 18), M4([x, YB / 2, 0.03]));
      bag.add('galv', new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.012, 6), M4([x, YB - 0.012, 0.03]));
      bag.add('galv', new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.04, 18), M4([x, 0.42, 0.03]));
      bag.add('galv', new THREE.CylinderGeometry(r * 1.6, r * 1.6, 0.006, 18), M4([x, 0.013, 0.03]));
    }
    // prensa-cabos de náilon preto + cabos descendo à caixa de passagem; eletroduto flexível ao queimador
    [[-0.04, 0.012, 'cable'], [0.03, 0.01, 'cableGrey'], [0.1, 0.008, 'cable'], [0.16, 0.007, 'cable']].forEach(([x, r, mk], i) => {
      bag.add('black', new THREE.CylinderGeometry(r * 1.9, r * 1.9, 0.008, 6), M4([x, YB - 0.009, 0.03]));
      bag.add('black', new THREE.CylinderGeometry(r * 1.05, r * 1.6, 0.016, 16), M4([x, YB - 0.021, 0.03]));
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, YB - 0.02, 0.03), new THREE.Vector3(x + 0.005, YB - 0.25, 0.04 + i * 0.005), new THREE.Vector3(x + 0.012 * (i - 1.5), 0.25, 0.07), new THREE.Vector3(x + 0.01 * (i - 1.5), 0.01, 0.06)]);
      bag.add(mk, new THREE.TubeGeometry(c, 24, r, 10), null);
    });
    { const x = 0.25, r = 0.014; bag.add('galv', new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.02, 6), M4([x, YB - 0.012, 0.03]));
      const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x, YB - 0.02, 0.03), new THREE.Vector3(x, 0.35, 0.03), new THREE.Vector3(x + 0.08, 0.09, 0.03), new THREE.Vector3(x + 0.3, 0.025, 0.0), new THREE.Vector3(0.66, 0.025, -0.15)]);
      bag.add('cableGrey', new THREE.TubeGeometry(c, 48, r, 12), null); }
    bag.build(g, mats, ['body', 'paint']);
    P[b.id] = { ctl, g, parts, knob, mush, scr, ht, cv, cx2d: cv.getContext('2d'), regions: [], redrawT: num * 0.25, needle: ctx.needles.find((n) => Math.abs(n.seed - num * 1.7) < 1e-6), level: ctx.levels.find((l) => l.seed === num) };
    if (P[b.id].level) P[b.id].level.base0 = P[b.id].level.base;
  }

  // ── interação ──
  const cvEl = stage.canvas, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (e) => {
    const r = cvEl.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera); const h = ray.intersectObjects(hits, false)[0]; return h && h.distance < 7 ? h : null;
  };
  const doHit = (h) => { const { id, key } = h.object.userData; if (key === 'hmi') touch(id, h.uv.x, h.uv.y); else press(id, key); };
  let down = null;
  cvEl.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  cvEl.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; } down = null;
    if (app.state.env !== 'caldeiras') return; const h = pick(e); if (h) doHit(h);
  });
  cvEl.addEventListener('pointermove', (e) => { if (app.state.env !== 'caldeiras' || e.buttons) return; const h = pick(e); if (h) cvEl.style.cursor = 'pointer'; else if (cvEl.style.cursor === 'pointer') cvEl.style.cursor = ''; });

  // clique programático em coordenadas de tela (mesmo caminho do mouse)
  function clickAt(clientX, clientY) { if (app.state.env !== 'caldeiras') return null; const h = pick({ clientX, clientY }); if (h) doHit(h); return h ? h.object.userData.key : null; }
  function press(id, key) { const p = P[id]; if (!p) return; p.ctl.press(key); p.redrawT = 0; }
  function touch(id, u, v) {
    const p = P[id]; if (!p) return; const X = u * 1024, Y = (1 - v) * 640;
    const r = p.regions.find((q) => X >= q.x && X <= q.x + q.w && Y >= q.y && Y <= q.y + q.h); if (r) press(id, r.a);
  }

  const SEL = { MAN: Math.PI / 4, 0: 0, AUT: -Math.PI / 4 };
  function update(dt, t) {
    const vis = group.visible;
    for (const id in P) {
      const p = P[id], c = p.ctl, s = c.s; c.update(dt, t);
      if (!vis) continue;
      const test = s.test > 0, blink = Math.floor(t * 2.5) % 2 === 0, unack = c.alarmUnacked(), active = c.alarmActive();
      const run = ['LOW', 'RUN'].includes(s.seq), starting = ['PURGE', 'IGN'].includes(s.seq);
      const on = {
        POW: true, CHAMA: s.flame, PART: starting && blink, FALHA: (unack && blink) || (active && !unack) || s.seq === 'LOCK',
        LIGA: run || (starting && blink), DESL: !run && !starting, REARME: (unack || s.seq === 'LOCK') && blink, TESTE: test,
      };
      for (const k in p.parts) {
        const m = p.parts[k]; m.material.emissiveIntensity = (test || on[k]) ? (k === 'POW' || k === 'TESTE' ? 2.2 : 4.0) : 0;
        if (m.userData.z0 != null) m.position.z = m.userData.z0 - (s.press[k.toLowerCase()] ? 0.003 : 0);
      }
      p.knob.rotation.z += (SEL[s.mode] - p.knob.rotation.z) * Math.min(1, dt * 18);
      p.mush.position.z = p.mush.userData.z0 - (s.estop ? 0.005 : 0);
      if (p.needle) p.needle.v = s.P;
      if (p.level) p.level.base = p.level.base0 + (s.lvl - 0.52) * 0.25;
      if ((p.redrawT -= dt) <= 0 || s.dirty) {
        const near = stage.camera.position.distanceTo(p.g.getWorldPosition(_p).setY(1.4)) < 9;
        p.redrawT = near ? 0.5 : 2; s.dirty = false;
        PT.drawHMI(p.cx2d, 1024, 640, c, p.regions, fmtHMS(app.state?.clock ?? 0), test); p.ht.needsUpdate = true;
      }
    }
  }
  return {
    cald1: P.cald1?.ctl, cald2: P.cald2?.ctl, list: Object.keys(P), press, touch, clickAt, update,
    setMode: (id, m) => { P[id]?.ctl.setMode(m); if (P[id]) P[id].redrawT = 0; },
    state: (id) => P[id]?.ctl.state(),
    page: (id, pg) => press(id, 'tab:' + pg),
  };
}
