// Maleta rígida aberta do medidor de IBUTG sobre a mesa do avaliador (TABLE): espuma recortada, pisseta de água destilada,
// pavios reserva, cabo USB e certificado de calibração impresso. Dono: MEDIDOR 3D. Unidades internas em mm.
import * as THREE from 'three';
import { TABLE } from './layout.js';
import { roundRect, circlePath, lathe, cyl, roundedCyl, rbox, place, merge } from './meter_geo.js';
import { caseMaps, foamMaps, wickMaps, paperMaps, ribMaps, certTex, pissetaLabelTex, repeat } from './meter_tex.js';

let ldpe = null, capMat = null, labelMat = null;
/** pisseta de LDPE leitoso 500 mL (origem no centro do fundo, mm; bico curvo apontando para +x) */
export function buildPisseta() {
  ldpe ||= new THREE.MeshPhysicalMaterial({ color: 0xe9eeee, roughness: 0.42, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.25, clearcoatRoughness: 0.4, transparent: true, opacity: 0.93 });
  capMat ||= new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5, normalMap: repeat(ribMaps().normal, 6, 1), normalScale: new THREE.Vector2(0.6, 0.6) });
  labelMat ||= new THREE.MeshStandardMaterial({ map: pissetaLabelTex(), roughness: 0.38 });
  const g = new THREE.Group(); g.name = 'pisseta';
  const prof = [[0, 0], [26, 0], [31.5, 2], [33.5, 7], [34, 14], [34, 108], [32.5, 118], [26, 128], [17, 135], [14.5, 138], [14.5, 152], [0, 152]];
  const body = new THREE.Mesh(lathe(prof, 40), ldpe); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const cap = new THREE.Mesh(merge([roundedCyl(16.5, 18, 1.5, 36, 148), lathe([[0, 166], [6, 166], [5, 174], [3.2, 178], [0, 178]], 20)]), capMat);
  cap.castShadow = true; g.add(cap);
  const curve = new THREE.CatmullRomCurve3([[0, 176, 0], [0, 190, 0], [4, 202, 0], [16, 208, 0], [30, 204, 0], [40, 194, 0], [45, 184, 0]].map((p) => new THREE.Vector3(...p)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 2.3, 10, false), ldpe); tube.castShadow = true; g.add(tube);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(34.25, 34.25, 56, 40, 1, true, -Math.PI * 0.62, Math.PI * 1.24).translate(0, 64, 0), labelMat);
  label.rotation.y = Math.PI / 2; g.add(label);
  g.userData.tip = new THREE.Vector3(45.5, 182, 0); // ponta do bico (mm, local)
  return g;
}

export function buildKitImpl(stage, app) {
  const group = new THREE.Group(); group.name = 'maleta';
  group.position.set(TABLE.pos[0], TABLE.h, TABLE.pos[2]); group.rotation.y = TABLE.rotY || 0;
  const K = new THREE.Group(); K.scale.setScalar(0.001); group.add(K);
  const add = (g, m, parent = K, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; parent.add(o); return o; };

  const cm = caseMaps(), fm = foamMaps();
  const caseMat = new THREE.MeshPhysicalMaterial({ color: 0x17191b, roughness: 0.58, normalMap: repeat(cm.normal, 1 / 26), normalScale: new THREE.Vector2(0.55, 0.55), clearcoat: 0.15, clearcoatRoughness: 0.5 });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0x3a3c3f, roughness: 0.96, map: repeat(fm.color, 1 / 30), normalMap: repeat(fm.normal, 1 / 30), normalScale: new THREE.Vector2(1.2, 1.2) });
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
  add(new THREE.PlaneGeometry(CW - 10, CD - 10).rotateX(-Math.PI / 2).translate(0, FT - 61.5, 0), foamMat, C, false);
  // calços de espuma no fundo dos bolsões pequenos (pavios e cabo ficam à vista, 12–14 mm abaixo do topo)
  add(up(new THREE.ExtrudeGeometry([roundRect(92, 30, 8, 112, -78), (() => { const c = new THREE.Shape(); c.absarc(178, -130, 36, 0, Math.PI * 2, false); return c; })()], { depth: 48, bevelEnabled: false, curveSegments: 18 })).translate(0, FT - 62, 0), foamMat, C, false);
  // pavios reserva (3) e cabo USB enrolado nos bolsões
  const wm = wickMaps();
  const wickMat = new THREE.MeshPhysicalMaterial({ map: repeat(wm.color.seco, 3, 2), normalMap: repeat(wm.normal, 3, 2), roughness: 0.95, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffffff) });
  add(merge([0, 1, 2].map((k) => cyl(4.4, 84, -42, 16).rotateZ(Math.PI / 2 + (k - 1) * 0.03).translate(112 + (k - 1) * 2, FT - 9.5, 78 + (k - 1) * 9.5))), wickMat, C);
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.55 });
  const coil = [];
  for (let k = 0; k < 5; k++) coil.push(new THREE.TorusGeometry(26 + k * 1.6, 1.9, 8, 48).rotateX(Math.PI / 2 + (k % 2 ? 0.06 : -0.05)).translate(178 + (k - 2) * 1.0, FT - 11.9 + k * 2.2, 130 + (k % 2) * 1.2));
  coil.push(rbox(12, 6, 30, 1.2).translate(158, FT - 5, 112), rbox(8, 4, 16, 1).translate(196, FT - 6, 150));
  add(merge(coil), cableMat, C);
  add(rbox(12.5, 4.6, 13, 0.4).translate(158, FT - 2.6, 93.5), metal, C); // USB-A

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
  eg.computeVertexNormals(); eg.rotateX(Math.PI / 2); // face voltada para −y (interior da tampa, que está "de cabeça para baixo")
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
