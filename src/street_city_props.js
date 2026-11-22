// CIDADE — mobiliário urbano: lampiões coloniais (braço de ferro nas fachadas e poste no adro), placas de esmalte,
// vasos de plantas e pedestres estáticos ao longe. Tudo instanciado ou mesclado.
import * as THREE from 'three';
import { Merger } from './street_city_church.js';
import { RUA, ruaY, ruaX } from './layout_rua.js';
import { plaqueTex, signTex, clothTex, rnd } from './street_city_tex.js';

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
  const wallM = wallPos.map(([x, z, ry]) => new THREE.Matrix4().compose(p.set(x + ruaX(z), ruaY(z) + 3.2, z), q.setFromAxisAngle(up, ry), one));
  const postM = postPos.map(([x, z]) => new THREE.Matrix4().compose(p.set(x, ruaY(62) + 0.02, z), q.identity(), one));
  inst(W.take('iron'), mats.iron, wallM); inst(W.take('glass'), mats.lampGlass, wallM);
  inst(Pm.take('iron'), mats.iron, postM); inst(Pm.take('glass'), mats.lampGlass, postM);

  // ── placas de esmalte "RUA DIREITA" nas esquinas ──
  const plM = new THREE.MeshStandardMaterial({ map: plaqueTex('RUA DIREITA'), roughness: 0.3, metalness: 0.05 });
  for (const [x, z, ry] of [[RUA.houseW[1] + 0.015, -43.4, Math.PI / 2], [RUA.houseE[0] - 0.015, 43.2, -Math.PI / 2]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.25), plM); pl.position.set(x + ruaX(z), ruaY(z) + 2.9, z); pl.rotation.y = ry; root.add(pl);
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
  for (const [x, z] of [[14.42, -8.2], [23.38, 21.4], [14.42, 31.5]]) vaso(x + ruaX(z), ruaY(z) + 0.17, z);

  D.build(root, mats, { cast: true });

  // ── placas de comércio penduradas em braço de ferro, perpendiculares à fachada (genéricas) ──
  const SG = new Merger();
  const signs = [[RUA.houseW[1], -20, 1, 'ARTESANATO', '#2f4a3a', '#e8d9a8'], [RUA.houseE[0], -24, -1, 'CAFÉ', '#7a2a22', '#f0e2c0'], [RUA.houseW[1], 20, 1, 'ANTIQUÁRIO', '#e0b04a', '#2a2018'], [RUA.houseE[0], 28, -1, 'POUSADA', '#24406a', '#efe8d8']];
  for (const [xw, z, s, txt, bg, fg] of signs) {
    const x = xw + ruaX(z), y = ruaY(z) + 3.55;
    SG.add('iron', BOX, x + s * 0.45, y, z, 0, 0, 0, 0.9, 0.035, 0.035); SG.add('iron', BOX, x + s * 0.02, y - 0.12, z, 0, 0, 0, 0.03, 0.3, 0.1);
    SG.add('iron', CYL, x + s * 0.25, y - 0.12, z, 0, 0, s * 0.9, 0.01, 0.32, 0.01);
    for (const dx of [0.3, 0.72]) SG.add('iron', CYL, x + s * dx, y - 0.07, z, 0, 0, 0, 0.007, 0.1, 0.007);
    const bd = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.035), new THREE.MeshStandardMaterial({ map: signTex(txt, bg, fg), roughness: 0.7 }));
    bd.position.set(x + s * 0.51, y - 0.28, z); bd.rotation.y = s > 0 ? 0 : Math.PI; bd.castShadow = true; root.add(bd);
  }
  SG.build(root, mats);

  // ── fiação aérea: ao longo das fachadas e cruzando a rua (fora de z ∈ [−8; 8]), com catenária ──
  const pts = [];
  const span = (a, b, sag, n = 12) => { for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; for (const t of [t0, t1]) pts.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t); } };
  for (const [xw, dy] of [[RUA.houseW[1] + 0.06, 6.1], [RUA.houseE[0] - 0.06, 5.9]]) for (let z = -44; z < 44; z += 8) { if (z > -12 && z < 8) continue; span([xw + ruaX(z), ruaY(z) + dy, z], [xw + ruaX(z + 8), ruaY(z + 8) + dy, z + 8], 0.18, 8); }
  for (const z of [-34, -19, 15, 31]) for (const dy of [0, 0.28]) span([RUA.houseW[1] + ruaX(z), ruaY(z) + 6.3 + dy, z], [RUA.houseE[0] + ruaX(z + 1.5), ruaY(z + 1.5) + 6.1 + dy, z + 1.5], 0.45 + dy * 0.5, 16);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#141414' })); wires.name = 'city_fios'; root.add(wires);

  // ── roupas num varal sob uma janela do sobrado leste ──
  const zc = -15.2, xc = RUA.houseE[0] + ruaX(zc) - 0.32, yc = ruaY(zc) + 5.45;
  const VR = new Merger(); VR.add('iron', CYL, xc, yc, zc, Math.PI / 2, 0, 0, 0.006, 1.9, 0.006);
  for (const dz of [-0.95, 0.95]) VR.add('iron', BOX, xc + 0.16, yc, zc + dz, 0, 0, 0, 0.32, 0.025, 0.025);
  VR.build(root, mats);
  const cm = new THREE.MeshStandardMaterial({ map: clothTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 });
  const clothes = [];
  [[0, 0.55, 0.6], [1, 0.62, 0.75], [2, 0.5, 0.78]].forEach(([k, w, h], i) => {
    const g2 = new THREE.PlaneGeometry(w, h); g2.translate(0, -h / 2, 0); const uv = g2.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, (k + uv.getX(j)) / 3);
    const c = new THREE.Mesh(g2, cm); c.position.set(xc, yc, zc - 0.62 + i * 0.62); c.rotation.y = Math.PI / 2; c.castShadow = true; root.add(c); clothes.push(c);
  });
  out.update = (dt, t) => clothes.forEach((c, i) => { c.rotation.z = 0.06 * Math.sin(t * 1.3 + i * 1.7) + 0.03 * Math.sin(t * 3.1 + i); });
  return out;
}
