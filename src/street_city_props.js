// CIDADE — mobiliário urbano: lampiões coloniais (braço de ferro nas fachadas e poste no adro), placas de esmalte,
// vasos de plantas e pedestres estáticos ao longe. Tudo instanciado ou mesclado.
import * as THREE from 'three';
import { Merger } from './street_city_church.js';
import { RUA, ruaY } from './layout_rua.js';
import { plaqueTex, rnd } from './street_city_tex.js';

const BOX = new THREE.BoxGeometry(1, 1, 1), SPH = new THREE.SphereGeometry(1, 10, 7), CONE4 = new THREE.ConeGeometry(1, 1, 4, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const V2 = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));

/** lanterna colonial quadrada (topo em oy) — ferro em 'iron', vidro em 'glass' */
function lantern(M, ox, oy, oz) {
  const q = Math.PI / 4;
  M.add('iron', SPH, ox, oy - 0.01, oz, 0, 0, 0, 0.03, 0.03, 0.03);
  M.add('iron', CONE4, ox, oy - 0.1, oz, 0, q, 0, 0.21, 0.16, 0.21);
  M.add('iron', BOX, ox, oy - 0.195, oz, 0, 0, 0, 0.31, 0.03, 0.31);
  M.add('glass', new THREE.CylinderGeometry(0.165, 0.12, 0.34, 4, 1), ox, oy - 0.38, oz, 0, q, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) M.add('iron', BOX, ox + sx * 0.1, oy - 0.38, oz + sz * 0.1, 0, 0, 0, 0.016, 0.35, 0.016);
  M.add('iron', BOX, ox, oy - 0.565, oz, 0, 0, 0, 0.2, 0.035, 0.2);
  M.add('iron', CONE4, ox, oy - 0.63, oz, Math.PI, q, 0, 0.05, 0.1, 0.05);
}

export function buildProps(root, mats) {
  const out = { snap: [] };
  // ── lampião de braço (fixação na fachada em x = 0, braço para +x, altura do braço em y = 0) ──
  const W = new Merger();
  W.add('iron', BOX, 0.015, -0.12, 0, 0, 0, 0, 0.03, 0.42, 0.13);
  W.add('iron', CYL, 0.37, 0, 0, 0, 0, Math.PI / 2, 0.018, 0.74, 0.018);
  W.add('iron', CYL, 0.26, -0.16, 0, 0, 0, -Math.atan2(0.48, 0.32), 0.012, 0.577, 0.012);
  W.add('iron', new THREE.TorusGeometry(0.085, 0.011, 6, 18), 0.17, -0.075, 0);
  W.add('iron', new THREE.TorusGeometry(0.05, 0.009, 6, 14), 0.4, 0.055, 0);
  W.add('iron', SPH, 0.75, 0, 0, 0, 0, 0, 0.03, 0.03, 0.03);
  W.add('iron', CYL, 0.62, -0.045, 0, 0, 0, 0, 0.008, 0.09, 0.008);
  lantern(W, 0.62, -0.085, 0);
  // ── lampião de poste em ferro fundido (adro) ──
  const Pm = new Merger();
  Pm.add('iron', new THREE.LatheGeometry(V2([[0.001, 0], [0.18, 0], [0.18, 0.12], [0.13, 0.2], [0.115, 0.45], [0.08, 0.6], [0.06, 0.78], [0.05, 2.5], [0.075, 2.6], [0.05, 2.7], [0.05, 2.9], [0.12, 2.97], [0.001, 3.0]]), 12));
  Pm.add('iron', BOX, 0, 2.62, 0, 0, 0, 0, 0.5, 0.03, 0.03);
  lantern(Pm, 0, 3.68, 0);

  const wallPos = [];
  for (let z = -40; z <= 40; z += 8) wallPos.push([RUA.houseW[1], z, 0]);
  for (let z = -36; z <= 36; z += 8) wallPos.push([RUA.houseE[0], z, Math.PI]);
  const postPos = [[13.6, 49.2], [24.2, 49.2], [14.9, 58.7], [22.9, 58.7]];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const inst = (geo, mat, list) => { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; root.add(im); return im; };
  const wallM = wallPos.map(([x, z, ry]) => new THREE.Matrix4().compose(p.set(x, ruaY(z) + 3.2, z), q.setFromAxisAngle(up, ry), one));
  const postM = postPos.map(([x, z]) => new THREE.Matrix4().compose(p.set(x, ruaY(62) + 0.02, z), q.identity(), one));
  inst(W.take('iron'), mats.iron, wallM); inst(W.take('glass'), mats.lampGlass, wallM);
  inst(Pm.take('iron'), mats.iron, postM); inst(Pm.take('glass'), mats.lampGlass, postM);

  // ── placas de esmalte "RUA DIREITA" nas esquinas ──
  const plM = new THREE.MeshStandardMaterial({ map: plaqueTex('RUA DIREITA'), roughness: 0.3, metalness: 0.05 });
  for (const [x, z, ry] of [[RUA.houseW[1] + 0.015, -43.4, Math.PI / 2], [RUA.houseE[0] - 0.015, 43.2, -Math.PI / 2]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.25), plM); pl.position.set(x, ruaY(z) + 2.9, z); pl.rotation.y = ry; root.add(pl);
  }

  // ── vasos de plantas (terracota) e pedestres, mesclados ──
  const D = new Merger(), Ya = ruaY(62) + 0.02;
  const POT = new THREE.LatheGeometry(V2([[0.001, 0], [0.16, 0], [0.19, 0.06], [0.25, 0.4], [0.29, 0.44], [0.29, 0.5], [0.24, 0.5], [0.24, 0.46], [0.001, 0.46]]), 14);
  const LEAF = new THREE.IcosahedronGeometry(1, 1);
  const vaso = (x, y, z) => {
    D.add('terra', POT, x, y, z);
    for (let i = 0; i < 4; i++) D.add('leaf', LEAF, x + (rnd() - 0.5) * 0.22, y + 0.62 + rnd() * 0.25, z + (rnd() - 0.5) * 0.22, rnd(), rnd(), 0, 0.2 + rnd() * 0.1, 0.18 + rnd() * 0.12, 0.2 + rnd() * 0.1);
    for (let i = 0; i < 6; i++) D.add('flower', SPH, x + (rnd() - 0.5) * 0.42, y + 0.6 + rnd() * 0.4, z + (rnd() - 0.5) * 0.42, 0, 0, 0, 0.045, 0.045, 0.045);
  };
  for (const [x, z] of [[15.6, 59.25], [22.2, 59.25], [8.0, 49.0], [29.8, 49.0]]) vaso(x, Ya, z);
  for (const [x, z] of [[14.42, -13.6], [23.38, 21.4], [14.42, 31.5]]) vaso(x, ruaY(z) + 0.17, z);

  // pedestres simples (calça, camisa, pele) — discretos, no adro e na escadaria
  const C = (h) => new THREE.Color(h);
  const CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 3, 8);
  const pessoa = (x, y, z, ry, shirt, pants, skin, hair, saia = false, k = 1) => {
    const c = Math.cos(ry), s = Math.sin(ry), P = (g, lx, ly, lz, col, rz = 0, sx = 1, sy = 1, sz = 1) => D.add('people', g, x + (lx * c + lz * s) * k, y + ly * k, z + (-lx * s + lz * c) * k, 0, ry, rz, sx * k, sy * k, sz * k, col);
    for (const sx of [-1, 1]) { P(CAP(0.065, 0.72), sx * 0.09, 0.45, 0, C(pants)); P(BOX, sx * 0.09, 0.035, 0.04, C('#2a221c'), 0, 0.1, 0.07, 0.25); }
    if (saia) P(new THREE.ConeGeometry(0.27, 0.62, 12), 0, 0.64, 0, C(pants));
    P(CAP(0.16, 0.36), 0, 1.13, 0, C(shirt), 0, 1.12, 1, 0.72);
    for (const sx of [-1, 1]) { P(CAP(0.05, 0.48), sx * 0.235, 1.1, 0, C(shirt), sx * 0.07); P(SPH, sx * 0.25, 0.8, 0, C(skin), 0, 0.05, 0.06, 0.05); }
    P(CYL, 0, 1.5, 0, C(skin), 0, 0.05, 0.1, 0.05); P(SPH, 0, 1.62, 0, C(skin), 0, 0.105, 0.125, 0.11); P(SPH, 0, 1.665, 0.02, C(hair), 0, 0.112, 0.1, 0.118);
  };
  pessoa(17.4, Ya, 55.4, 0.9, '#7a2e2a', '#2b3140', '#a77a58', '#2a1d14');
  pessoa(18.25, Ya, 55.9, -2.3, '#d8d2c2', '#5a4a6a', '#8a5f42', '#1a120c', true, 0.96);
  pessoa(28.2, Ya, 50.6, -1.2, '#3d5a73', '#3a3530', '#b48662', '#3a2a1c'); // sentado? não: em pé junto ao parapeito leste
  D.build(root, mats, { cast: true });
  return out;
}
