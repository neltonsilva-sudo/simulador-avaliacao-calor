// Maleta rígida aberta do medidor de IBUTG sobre a mesa do avaliador (TABLE): espuma recortada, pisseta de água destilada,
// pavios reserva (em saquinho com rótulo), cabo USB e certificado de calibração impresso. Dono: FIRMWARE (kit; antes MEDIDOR 3D).
// Unidades internas em mm. Texturas próprias (espuma de célula aberta, rótulo dos pavios) geradas em canvas aqui mesmo.
import * as THREE from 'three';
import { TABLE } from './layout.js';
import { roundRect, circlePath, lathe, cyl, roundedCyl, rbox, place, merge } from './meter_geo.js';
import { caseMaps, wickMaps, paperMaps, ribMaps, certTex, pissetaLabelTex, repeat } from './meter_tex.js';

let ldpe = null, capMat = null, labelMat = null, waterMat = null;
const KT = {};
function cv(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
function tex(c, srgb = true, rep = 1) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8; return t; }
/** espuma de poliuretano de célula aberta (cinza-grafite): poros escuros irregulares + paredes claras; cor e relevo, ladrilhável */
function foamCellMaps() {
  if (KT.foam) return KT.foam;
  let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const N = 512, pores = [];
  for (let i = 0; i < 7800; i++) pores.push([R() * N, R() * N, 0.9 + R() ** 2.2 * 4.2, R() * Math.PI, 0.55 + R() * 0.45]);
  const paint = (g, col, dark, lite) => {
    g.fillStyle = col; g.fillRect(0, 0, N, N);
    for (const [x, y, r, a, e] of pores) for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
      const X = x + ox, Y = y + oy; if (X < -8 || Y < -8 || X > N + 8 || Y > N + 8) continue;
      g.fillStyle = lite; g.beginPath(); g.ellipse(X - 0.5, Y - 0.6, r * 1.15, r * e * 1.15, a, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark; g.beginPath(); g.ellipse(X, Y, r, r * e, a, 0, Math.PI * 2); g.fill();
    }
  };
  const color = cv(N, N, (g) => paint(g, '#55585d', 'rgba(16,17,19,0.82)', 'rgba(120,124,130,0.35)'));
  const bump = cv(N, N, (g) => paint(g, '#b4b4b4', 'rgba(0,0,0,0.9)', 'rgba(255,255,255,0.5)'));
  return (KT.foam = { color: tex(color), bump: tex(bump, false) });
}
/** rótulo do saquinho de pavios reserva */
function wickLabelTex() {
  return (KT.wl ||= tex(cv(512, 224, (g, W, H) => {
    g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, W, H); g.fillStyle = '#1f66b5'; g.fillRect(0, 0, W, 54);
    g.fillStyle = '#fff'; g.font = '700 34px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.fillText('PAVIO DE REPOSIÇÃO', W / 2, 39);
    g.fillStyle = '#1b2430'; g.font = '700 30px Inter, Arial, sans-serif'; g.fillText('Bulbo úmido natural · iTemp', W / 2, 98);
    g.font = '500 24px Inter, Arial, sans-serif'; g.fillStyle = '#3a4656';
    g.fillText('100% algodão · tubular · 3 unidades', W / 2, 138); g.fillText('Trocar a cada medição (NHO-06 8.1)', W / 2, 172);
    g.fillStyle = '#222'; for (let i = 0; i < 46; i++) { const w = (i * 7) % 3 + 1; g.fillRect(150 + i * 4.6, 186, w, 26); }
  }), true, 1));
}
/** pisseta de LDPE leitoso 500 mL (origem no centro do fundo, mm; bico curvo apontando para +x) */
export function buildPisseta() {
  // PEBD leitoso translúcido: deixa ver a coluna de água (mais densa) e o nível; sem transmissão (custo) — opacidade + sheen
  ldpe ||= new THREE.MeshPhysicalMaterial({ color: 0xeef2f1, roughness: 0.4, metalness: 0, sheen: 0.5, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff),
    clearcoat: 0.3, clearcoatRoughness: 0.35, transparent: true, opacity: 0.58, depthWrite: false });
  waterMat ||= new THREE.MeshPhysicalMaterial({ color: 0xc5d9df, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.5, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05 });
  capMat ||= new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5, normalMap: repeat(ribMaps().normal, 6, 1), normalScale: new THREE.Vector2(0.6, 0.6) });
  labelMat ||= new THREE.MeshStandardMaterial({ map: pissetaLabelTex(), roughness: 0.38 });
  const g = new THREE.Group(); g.name = 'pisseta';
  const prof = [[0, 0], [26, 0], [31.5, 2], [33.5, 7], [34, 14], [34, 108], [32.5, 118], [26, 128], [17, 135], [14.5, 138], [14.5, 152], [0, 152]];
  const body = new THREE.Mesh(lathe(prof, 40), ldpe); body.castShadow = true; body.receiveShadow = true; body.renderOrder = 3; g.add(body);
  // coluna de água destilada (≈ 80 %: nível logo acima do rótulo) com menisco
  const WL = 104, wprof = [[0, 1.2], [25, 1.2], [30.6, 3], [32.6, 8], [32.9, 14], [32.9, WL - 1.2], [32.2, WL], [0, WL]];
  const water = new THREE.Mesh(lathe(wprof, 40), waterMat); water.renderOrder = 2; g.add(water); g.userData.water = water;
  const cap = new THREE.Mesh(merge([roundedCyl(16.5, 18, 1.5, 36, 148), lathe([[0, 166], [6, 166], [5, 174], [3.2, 178], [0, 178]], 20)]), capMat);
  cap.castShadow = true; g.add(cap);
  const curve = new THREE.CatmullRomCurve3([[0, 176, 0], [0, 190, 0], [4, 202, 0], [16, 208, 0], [30, 204, 0], [40, 194, 0], [45, 184, 0]].map((p) => new THREE.Vector3(...p)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 2.3, 10, false), ldpe); tube.castShadow = true; g.add(tube);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(34.3, 34.3, 48, 40, 1, true, -Math.PI * 0.6, Math.PI * 1.2).translate(0, 58, 0), labelMat); label.renderOrder = 4;
  label.rotation.y = Math.PI / 2; g.add(label);
  g.userData.tip = new THREE.Vector3(45.5, 182, 0); // ponta do bico (mm, local)
  return g;
}

const mmUV = (g, w, h) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h); return g; };
export function buildKitImpl(stage, app) {
  const group = new THREE.Group(); group.name = 'maleta';
  group.position.set(TABLE.pos[0], TABLE.h, TABLE.pos[2]); group.rotation.y = TABLE.rotY || 0;
  const K = new THREE.Group(); K.scale.setScalar(0.001); group.add(K);
  const add = (g, m, parent = K, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; };

  const cm = caseMaps(), fm = null;
  const caseMat = new THREE.MeshPhysicalMaterial({ color: 0x17191b, roughness: 0.58, normalMap: repeat(cm.normal, 1 / 26), normalScale: new THREE.Vector2(0.55, 0.55), clearcoat: 0.15, clearcoatRoughness: 0.5 });
  const fc = foamCellMaps(); void fm;
  const foamMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 1, map: fc.color, bumpMap: fc.bump, bumpScale: 1.6, sheen: 0.6, sheenRoughness: 0.9, sheenColor: new THREE.Color(0x6a6e74) });
  fc.color.repeat.set(1 / 55, 1 / 55); fc.bump.repeat.set(1 / 55, 1 / 55); // 512 px ≈ 55 mm (poros de 0,1–0,5 mm)
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.28, metalness: 1 });

  // ── base da maleta (460 × 360 × 150 mm), aberta, com frisos e borda ──
  const CW = 460, CD = 360, CH = 150, WALL = 4, R = 28;
  const C = new THREE.Group(); C.position.set(-330, 0, -10); K.add(C);
  const up = (g) => g.rotateX(-Math.PI / 2); // forma no plano XY (y = −z) → extrusão para cima
  const ring = (w, d, r, t, h, bevel = 2) => up(new THREE.ExtrudeGeometry((() => { const s = roundRect(w, d, r); s.holes.push(roundRect(w - 2 * t, d - 2 * t, Math.max(1, r - t), 0, 0, THREE.Path)); return s; })(),
    { depth: h - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 3, curveSegments: 10 })).translate(0, bevel, 0);
  const caseParts = [ring(CW, CD, R, WALL, CH, 3), up(new THREE.ExtrudeGeometry(roundRect(CW, CD, R), { depth: 4, bevelEnabled: false, curveSegments: 10 })),
    ring(CW + 4, CD + 4, R + 2, 5, 9, 1.5).translate(0, 38, 0), ring(CW + 4, CD + 4, R + 2, 5, 9, 1.5).translate(0, 98, 0), ring(CW + 3, CD + 3, R + 1.5, 6, 7, 1.5).translate(0, CH - 7, 0)];
  // fechos (parte de baixo) e alça frontal; dobradiças traseiras
  for (const x of [-130, 130]) caseParts.push(rbox(40, 30, 10, 3).translate(x, CH - 20, CD / 2 + 4));
  caseParts.push(new THREE.TorusGeometry(46, 6, 10, 24, Math.PI).rotateZ(Math.PI).translate(0, 118, CD / 2 + 12));
  caseParts.push(rbox(24, 20, 14, 3).translate(-46, 118, CD / 2 + 6), rbox(24, 20, 14, 3).translate(46, 118, CD / 2 + 6));
  for (const x of [-140, 0, 140]) caseParts.push(cyl(6, 50, -25, 16).rotateZ(Math.PI / 2).translate(x, CH, -CD / 2 - 3));
  add(merge(caseParts), caseMat, C);

  // ── espuma da base com recortes (bolsões vazios: o aparelho e o globo estão no tripé) ──
  const pockets = [
    roundRect(190, 86, 8, -95, -95, THREE.Path),    // corpo do aparelho (deitado, visor para cima)
    roundRect(30, 108, 10, -64, 6, THREE.Path),     // haste do bulbo seco + abrigo
    roundRect(50, 52, 12, -19, -22, THREE.Path),    // reservatório do bulbo úmido
    roundRect(24, 18, 6, -167, -38, THREE.Path),    // conector do globo
    circlePath(80, 112, 58),                         // globo Ø 152,4 mm
    roundRect(92, 30, 8, 112, -78, THREE.Path),     // pavios reserva
    circlePath(36, 178, -130),                       // cabo USB
    roundRect(76, 120, 14, -170, 100, THREE.Path),  // pisseta
  ];
  const FT = CH - 12; // topo da espuma
  const fshape = roundRect(CW - 2 * WALL - 1, CD - 2 * WALL - 1, R - WALL); fshape.holes.push(...pockets);
  add(up(new THREE.ExtrudeGeometry(fshape, { depth: 62, bevelEnabled: false, curveSegments: 18 })).translate(0, FT - 62, 0), foamMat, C, false);
  add(mmUV(new THREE.PlaneGeometry(CW - 10, CD - 10), CW - 10, CD - 10).rotateX(-Math.PI / 2).translate(0, FT - 61.5, 0), foamMat, C, false);
  // calços de espuma no fundo dos bolsões pequenos (pavios e cabo ficam à vista, 12–14 mm abaixo do topo)
  add(up(new THREE.ExtrudeGeometry([roundRect(92, 30, 8, 112, -78), (() => { const c = new THREE.Shape(); c.absarc(178, -130, 36, 0, Math.PI * 2, false); return c; })()], { depth: 48, bevelEnabled: false, curveSegments: 18 })).translate(0, FT - 62, 0), foamMat, C, false);
  // pavios reserva (3) e cabo USB enrolado nos bolsões
  const wm = wickMaps();
  const wickMat = new THREE.MeshPhysicalMaterial({ map: repeat(wm.color.seco, 3, 2), normalMap: repeat(wm.normal, 3, 2), roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) });
  add(merge([0, 1, 2].map((k) => cyl(4.4, 84, -42, 16).rotateZ(Math.PI / 2 + (k - 1) * 0.03).translate(112 + (k - 1) * 2, FT - 9.5, 78 + (k - 1) * 9.5))), wickMat, C);
  // saquinho zip transparente com os 3 pavios + rótulo impresso e trilho do zíper
  const bagMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f7f8, roughness: 0.22, transparent: true, opacity: 0.3, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
  const bag = add(rbox(90, 10.5, 29.4, 4.2).translate(112, FT - 9.3, 78), bagMat, C, false); bag.renderOrder = 3;
  add(rbox(88, 1.4, 2.4, 0.6).translate(112, FT - 4.4, 66.8), new THREE.MeshStandardMaterial({ color: 0x3a78d8, roughness: 0.45, transparent: true, opacity: 0.85 }), C, false);
  const wl = add(new THREE.PlaneGeometry(50, 22).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: wickLabelTex(), roughness: 0.7 }), C, false);
  wl.position.set(118, FT - 3.95, 80); wl.rotation.y = 0.02; wl.renderOrder = 4;

  // cabo USB: rolo frouxo com curvas naturais (3,5 voltas irregulares que sobem umas sobre as outras) e as duas pontas soltas
  const cableMat = new THREE.MeshPhysicalMaterial({ color: 0x18191b, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5 });
  const CX = 178, CZ = 130, pts = [];
  pts.push(new THREE.Vector3(136, FT + 4.2, 96), new THREE.Vector3(148, FT + 1.5, 104), new THREE.Vector3(156, FT - 5, 112), new THREE.Vector3(165, FT - 10.5, 120));
  const turns = 3.4, N = 120;
  for (let k = 0; k <= N; k++) {
    const th = 3.6 + (k / N) * turns * 2 * Math.PI;
    const r = 25 + 3.2 * Math.sin(1.7 * th + 0.5) + 1.4 * Math.sin(3.1 * th + 1.2);
    const cx = CX + 2.2 * Math.sin(0.43 * th), cz = CZ + 1.8 * Math.cos(0.31 * th);
    const y = FT - 11.8 + (k / N) * turns * 3.5 + 0.9 * Math.sin(2 * th);
    pts.push(new THREE.Vector3(cx + r * Math.cos(th), y, cz + r * Math.sin(th)));
  }
  const last = pts[pts.length - 1];
  pts.push(new THREE.Vector3(last.x * 0.6 + CX * 0.4 + 4, FT + 0.6, last.z * 0.6 + CZ * 0.4 - 3), new THREE.Vector3(CX + 9, FT + 0.2, CZ + 6));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  add(new THREE.TubeGeometry(curve, 420, 1.85, 8, false), cableMat, C);
  const plug = (t, len, w, h, bootLen, metalLen, mw, mh) => { // capa de borracha + conector metálico orientados pela tangente
    const p = curve.getPointAt(t), d = curve.getTangentAt(t).multiplyScalar(t < 0.5 ? -1 : 1);
    const gq = new THREE.Group(); gq.position.copy(p); gq.lookAt(p.clone().add(d)); C.add(gq);
    const boot = new THREE.Mesh(rbox(w, h, bootLen, Math.min(w, h) * 0.3), cableMat); boot.position.z = bootLen / 2; boot.castShadow = true; gq.add(boot);
    const m = new THREE.Mesh(rbox(mw, mh, metalLen, 0.3), metal); m.position.z = bootLen + metalLen / 2 - 0.5; m.castShadow = true; gq.add(m);
  };
  plug(0, 0, 16, 8, 26, 12.5, 12.2, 4.6);   // USB-A (para o computador)
  plug(1, 0, 11, 6.5, 18, 6.5, 7.6, 2.6);   // conector do aparelho

  // ── tampa aberta (~106°) com espuma ondulada ("caixa de ovo") ──
  const lid = new THREE.Group(); lid.position.set(0, CH, -CD / 2); lid.rotation.x = -1.85; C.add(lid);
  const LH = 56;
  const lidParts = [ring(CW, CD, R, WALL, LH, 3), up(new THREE.ExtrudeGeometry(roundRect(CW, CD, R), { depth: 4, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelOffset: -2, bevelSegments: 2, curveSegments: 10 })).translate(0, LH - 6, 0),
    ring(CW + 3, CD + 3, R + 1.5, 6, 7, 1.5)];
  for (const x of [-130, 130]) lidParts.push(rbox(34, 34, 9, 3).translate(x, 18, CD / 2 + 4));
  const lidMesh = add(merge(lidParts), caseMat, lid); lidMesh.position.z = CD / 2;
  const eg = new THREE.PlaneGeometry(CW - 2 * WALL - 2, CD - 2 * WALL - 2, 72, 56); const P = eg.attributes.position;
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i); const e = Math.min(1, (CW / 2 - WALL - Math.abs(x)) / 14, (CD / 2 - WALL - Math.abs(y)) / 14);
    P.setZ(i, (8 + 10 * (0.5 + 0.5 * Math.sin(x * 2 * Math.PI / 46) * Math.sin(y * 2 * Math.PI / 46))) * Math.max(0.35, e)); }
  mmUV(eg, CW - 2 * WALL - 2, CD - 2 * WALL - 2); eg.computeVertexNormals(); eg.rotateX(Math.PI / 2); // face voltada para −y (interior da tampa, que está "de cabeça para baixo")
  const egg = add(eg, foamMat, lid, false); egg.position.set(0, LH - 6, CD / 2);

  // ── pisseta em pé sobre a mesa e certificado impresso ──
  const pis = buildPisseta(); pis.position.set(285, 0, -185); pis.rotation.y = -2.4; K.add(pis);
  const pm = paperMaps();
  const certMat = new THREE.MeshStandardMaterial({ map: certTex(), roughness: 0.88, normalMap: repeat(pm.normal, 4), normalScale: new THREE.Vector2(0.15, 0.15), side: THREE.DoubleSide });
  const cg = new THREE.PlaneGeometry(210, 297, 12, 16); const Q = cg.attributes.position;
  for (let i = 0; i < Q.count; i++) { const x = Q.getX(i), y = Q.getY(i); Q.setZ(i, 0.0025 * (x * x) * 0.02 + Math.max(0, (y - 120) / 28) ** 2 * 2.2 + 0.25); }
  cg.computeVertexNormals(); cg.rotateX(-Math.PI / 2);
  // certificado guardado no bolso da tampa, apoiado sobre a espuma ondulada
  const cert = add(cg, certMat, lid, false); cert.position.set(30, LH - 25, CD / 2 + 8); cert.rotation.set(Math.PI, 0.05, 0, 'YXZ'); cert.receiveShadow = true;

  // âncora "home" do aparelho (no bolsão do corpo, visor para cima)
  const home = new THREE.Object3D(); home.name = 'kitHome'; home.position.set((-330 - 95) / 1000, (FT - 52) / 1000, (-10 + 95) / 1000); home.rotation.x = -Math.PI / 2; group.add(home);
  stage.scene.add(group);
  // segue o ambiente ativo (mesa TABLE da sala de fornos ou TABLE2 da casa de caldeiras)
  const place = () => { const T = app?.env?.()?.TABLE || TABLE; group.position.set(T.pos[0], T.h, T.pos[2]); group.rotation.y = T.rotY || 0;
    const a = app?.anchors?.presentDevice, PD = app?.env?.()?.PRESENT?.device; if (a && PD) a.rotation.y = PD.rotY || 0; };
  place(); app?.on?.('env', place); app?.on?.('ready', place);
  return { group, home, pisseta: pis, certificate: cert, update() {} };
}
