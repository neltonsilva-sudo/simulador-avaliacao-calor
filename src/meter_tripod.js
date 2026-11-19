// Tripé telescópico PRETO FOSCO (NHO-06 7.1.4 a) com cabeça esférica e sapata de engate rápido (FOTO 2). Dono: MEDIDOR 3D.
// Unidades: grupos internos em mm (escala 0,001); rig/mountPoint em metros. Origem do rig no piso, no centro do tripé.
// Uma perna aponta para +z local (lado do visor/avaliador); as outras duas a ±120°.
import * as THREE from 'three';
import { lathe, cyl, roundedCyl, rbox, place, merge } from './meter_geo.js';
import { ribMaps, knurlMaps, rubberMaps, repeat } from './meter_tex.js';

export const HEAD_H = 0.0915;          // topo da coluna → topo da borracha da sapata (m)
const S1_END = 478, CL = 38, FOOT = 24; // comprimentos (mm) ao longo da perna
const X_MIN = 20, X_MAX = 400;          // trechos expostos das seções 2 e 3
const L_MIN = S1_END + CL + FOOT + 2 * X_MIN, L_MAX = S1_END + CL + FOOT + 2 * X_MAX;
const PIVOT_R = 40, PIVOT_Y = -18, SPREAD = THREE.MathUtils.degToRad(21);

export function buildTripod() {
  const rig = new THREE.Group(); rig.name = 'tripe';
  // materiais: alumínio anodizado preto fosco (leve brilho acetinado) e borracha/plástico preto
  const rm = rubberMaps();
  const metal = new THREE.MeshPhysicalMaterial({ color: 0x0c0d0e, roughness: 0.5, metalness: 0.35, normalMap: repeat(rm.normal, 1 / 6), normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.12, clearcoatRoughness: 0.55 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x0e0f10, roughness: 0.62, metalness: 0.0, normalMap: repeat(rm.normal, 1 / 5), normalScale: new THREE.Vector2(0.4, 0.4) });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x101011, roughness: 0.78, metalness: 0, normalMap: repeat(ribMaps().normal, 1, 1), normalScale: new THREE.Vector2(0.9, 0.9) });
  const knurlRub = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.7, normalMap: repeat(knurlMaps().normal, 4, 1), normalScale: new THREE.Vector2(0.8, 0.8) });
  const meshes = [];
  const mk = (g, m, parent) => { const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; parent.add(o); meshes.push(o); return o; };

  // ── coluna central + cabeça esférica (sobe/desce junto) ──
  const colG = new THREE.Group(); rig.add(colG);
  const colMM = new THREE.Group(); colMM.scale.setScalar(0.001); colG.add(colMM);
  // coluna: tubo Ø25 (pendurada para baixo a partir do topo), gancho de lastro embaixo
  mk(merge([cyl(12.5, 520, -520, 28), lathe([[0, -536], [9, -536], [11, -530], [11, -520], [0, -520]], 20),
    place(new THREE.TorusGeometry(9, 2.4, 8, 20, Math.PI * 1.3), 0, -548, 0, 0, 0, Math.PI * 0.85)]), metal, colMM);
  // cabeça: base giratória, corpo do soquete, esfera, pescoço, garra de engate rápido, sapata
  const head = [];
  head.push(roundedCyl(24, 12, 2, 40, 0));                                      // base panorâmica
  head.push(lathe([[0, 12], [22.5, 12], [22.5, 14], [21.5, 30], [19.5, 42], [17.5, 45], [0, 45]], 40)); // soquete
  head.push(new THREE.SphereGeometry(17, 32, 20).translate(0, 50, 0));           // esfera
  head.push(cyl(8.5, 14, 60, 24));                                              // pescoço
  head.push(rbox(52, 12, 46, 2.5).translate(0, 78, 0));                         // garra
  head.push(cyl(3.2, 8, -4, 12).rotateZ(Math.PI / 2).translate(22, 32, 0));    // eixo da manopla grande
  head.push(cyl(2.6, 8, -4, 12).rotateZ(Math.PI / 2).translate(-22, 32, 0));   // eixo da manopla de fricção
  mk(merge(head), metal, colMM);
  // borracha: manoplas recartilhadas + borracha da sapata (com estrias) + trava panorâmica
  const knobs = [];
  knobs.push(roundedCyl(12.5, 15, 3, 36, 0).rotateZ(-Math.PI / 2).translate(25, 32, 0));   // manopla grande (direita)
  knobs.push(roundedCyl(9, 10, 2.5, 30, 0).rotateZ(Math.PI / 2).translate(-27, 32, 0));    // fricção (esquerda)
  knobs.push(roundedCyl(8, 12, 2, 28, 0).rotateX(Math.PI / 2).translate(0, 78, 23));       // manopla da garra (+z)
  knobs.push(roundedCyl(5, 9, 1.5, 20, 0).rotateZ(-Math.PI / 2).translate(24, 6, 0));      // trava panorâmica
  const knobMesh = mk(merge(knobs), knurlRub, colMM);
  // sapata de engate rápido (tipo Arca, 50 × 38 mm, alumínio anodizado grafite) presa nas garras, com anel em D cromado
  const qrMat = new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.42, metalness: 0.6 });
  const qr = mk(merge([rbox(50, 7.0, 38, 1.4).translate(0, 87.6, 0), rbox(46, 1.2, 34, 0.5).translate(0, 91.0, 0)]), qrMat, colMM);
  const dring = mk(merge([new THREE.TorusGeometry(5.2, 0.9, 8, 24, Math.PI).rotateZ(Math.PI).rotateX(-0.25).translate(0, 87.6, 21.4), cyl(3.2, 1.2, 0, 20).rotateX(Math.PI / 2).translate(0, 87.6, 19.0)]),
    new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.2, metalness: 1 }), colMM);
  // fenda de sombra entre a sapata e a garra (oclusão de contato)
  const gap = new THREE.Mesh(rbox(51, 0.8, 39, 0.3).translate(0, 84.05, 0), new THREE.MeshBasicMaterial({ color: 0x050506 })); colMM.add(gap);
  const pad = qr;
  // nível de bolha (vidro verde) na lateral da garra
  const bubble = new THREE.Mesh(cyl(3.2, 1.2, 0, 20).rotateX(Math.PI / 2).translate(-14, 78, 23.2), new THREE.MeshPhysicalMaterial({ color: 0x9fe07a, roughness: 0.08, emissive: 0x1c3a10, clearcoat: 1 }));
  colMM.add(bubble);

  // ── aranha (cubo das pernas) + colar de trava da coluna ──
  const hubG = new THREE.Group(); rig.add(hubG);
  const hubMM = new THREE.Group(); hubMM.scale.setScalar(0.001); hubG.add(hubMM);
  const hub = [];
  hub.push(lathe([[13, -40], [24, -40], [30, -34], [33, -12], [31, -2], [26, 0], [13, 0]], 36));     // fundição
  hub.push(lathe([[13, 0], [19.5, 0], [20.5, 2], [20.5, 22], [18.5, 24], [13, 24]], 32));           // colar
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3; // mesmos ângulos das pernas
    hub.push(place(rbox(16, 26, 30, 3), Math.cos(a) * 34, -18, -Math.sin(a) * 34, 0, a, 0));
    hub.push(place(cyl(3.6, 34, -17, 14).rotateX(Math.PI / 2), Math.cos(a) * 40, -18, -Math.sin(a) * 40, 0, a, 0)); // pino
  }
  mk(merge(hub), plastic, hubMM);
  const collarKnob = mk(roundedCyl(7.5, 12, 2, 24, 0).rotateZ(-Math.PI / 2).translate(20, 12, 0), knurlRub, hubMM);

  // ── pernas: 3 seções telescópicas (Ø26/22/18) com travas de alavanca e sapatas ──
  const s1g = merge([
    rbox(22, 34, 26, 4).translate(0, -6, 0),                               // garfo da articulação
    cyl(13, S1_END - 20, -S1_END + 2, 28).translate(0, 0, 0),             // tubo
    rbox(9, 16, 12, 2).translate(-15, -28, 0),                             // trava de ângulo
  ]);
  const clamp = (r) => merge([
    lathe([[r + 0.5, 0], [r + 4.5, 0], [r + 5.5, 2], [r + 5.5, CL - 2], [r + 4.5, CL], [r + 0.5, CL]], 28).translate(0, -CL, 0),
    rbox(10, CL - 4, 20, 3).translate(r + 8, -CL / 2, 0),                  // alavanca
    rbox(4, 8, 16, 1.5).translate(r + 12.5, -CL + 6, 0),                   // ponta da alavanca
  ]);
  const s1Clamp = clamp(13).translate(0, -S1_END + CL, 0);
  const sec1Geo = merge([s1g, s1Clamp]);
  const sec2Geo = merge([cyl(11, 440, -2, 26), clamp(11)]);
  const sec3Geo = merge([cyl(9, 430, 0, 24)]);
  const footGeo = merge([lathe([[0, -FOOT], [10, -FOOT], [12.5, -FOOT + 3], [12.5, -6], [10, 0], [0, 0]], 24)]);
  const legs = [];
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3;
    const yaw = new THREE.Group(); yaw.rotation.y = a; yaw.position.y = PIVOT_Y; hubMM.add(yaw);
    const tilt = new THREE.Group(); tilt.position.x = PIVOT_R; yaw.add(tilt);
    const s1 = mk(sec1Geo, metal, tilt), s2 = mk(sec2Geo, metal, tilt), s3 = mk(sec3Geo, metal, tilt);
    const foot = mk(footGeo, rubber, s3);
    legs.push({ yaw, tilt, s1, s2, s3, foot });
  }

  // ── altura ──
  const mountPoint = new THREE.Object3D(); mountPoint.name = 'mountPoint'; rig.add(mountPoint);
  const state = { colTop: 1, hubY: 0.9, L: 0.9, theta: SPREAD };
  /** posiciona a coluna para que o topo da sapata fique em `plateY` (m acima do piso) */
  function setPlate(plateY) {
    const colTop = plateY - HEAD_H;
    const hubY = THREE.MathUtils.clamp(colTop - 0.1, 0.5, 1.26);
    const hinge = (hubY * 1000 + PIVOT_Y);
    let L = hinge / Math.cos(SPREAD), theta = SPREAD;
    if (L < L_MIN) { L = L_MIN; theta = Math.acos(Math.min(1, hinge / L)); }
    if (L > L_MAX) { L = L_MAX; theta = Math.acos(Math.min(1, hinge / L)); }
    const ext = L - (S1_END + CL + FOOT); const x2 = Math.min(X_MAX, Math.max(X_MIN, ext / 2)), x3 = Math.max(X_MIN, ext - x2);
    colG.position.y = colTop; hubG.position.y = hubY; mountPoint.position.y = colTop + HEAD_H;
    for (const l of legs) {
      l.tilt.rotation.z = theta;
      l.s1.position.y = 0; l.s2.position.y = -(S1_END + x2); l.s3.position.y = -(S1_END + x2 + CL + x3);
    }
    Object.assign(state, { colTop, hubY, L, theta });
  }
  setPlate(1.1);
  return { rig, mountPoint, setPlate, meshes, knob: knobMesh, state, materials: [metal, plastic, rubber, knurlRub] };
}
