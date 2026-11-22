// Rua colonial entre a padaria e a casa de caldeiras (CENÁRIO): pé-de-moleque abaulado na faixa RUA.road seguindo a ladeira
// ruaY(z), passeios de lajes de quartzito (RUA.walkW / RUA.walkE) com meio-fio de pedra, sarjetas, tampas de ferro fundido,
// poças, chão em volta e céu com cirros. Materiais PBR iluminados pelo perfil externo do palco (stage.setEnv('rua'): sol +
// céu). Os sobrados (street_houses.js) e a igreja/mobiliário (street_city.js) são de outros donos.
// O grupo só fica visível durante o voo entre os ambientes (o palco liga/desliga) — custo zero dentro dos prédios.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as LR from './layout_rua.js';
const { RUA, ruaY } = LR;
// curva leve em S (proposta para layout_rua.js como ruaX): nula diante dos prédios (|z| ≤ 8), até ±1,2 m nas pontas
export const ruaX = LR.ruaX ?? ((z) => (Math.abs(z) <= 8 ? 0 : 1.2 * Math.sign(z) * Math.sin((Math.abs(z) - 8) / 14)));
import { HALL } from './layout.js';
import { HALL2 } from './layout_caldeiras.js';
import * as TX from './street_tex.js';

const ZA = RUA.z0 - 6, ZB = RUA.z1 + 14; // a rua continua um pouco além dos limites (sobe até o adro da igreja)

// faixa retangular deformada: x ∈ [x0,x1], z ∈ [ZA,ZB], altura y(x,z); uv em metros / escala
function ribbon(x0, x1, nx, nz, yfn, su, sv) {
  const g = new THREE.PlaneGeometry(1, 1, nx, nz); const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, x = x0 + (x1 - x0) * u, z = ZB - (ZB - ZA) * v;
    p.setXYZ(i, x + ruaX(z), yfn(x, z), z); uv.setXY(i, x / su, z / sv);
  }
  g.computeVertexNormals(); return g;
}

export function buildStreet(stage) {
  const root = new THREE.Group(); root.name = 'rua'; root.visible = false; stage.scene.add(root);
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const [r0, r1] = RUA.road, rc = (r0 + r1) / 2, hw = (r1 - r0) / 2, CURB = 0.2;

  // ── pé-de-moleque: abaulado (centro 9 cm mais alto), sarjetas rasas junto ao meio-fio, ondulação de assentamento ──
  const cob = TX.cobbleTextures();
  for (const k of ['map', 'rough', 'normal']) { cob[k].repeat.set(1, 1); cob[k].anisotropy = aniso; }
  const yRoad = (x, z) => { const u = (x - rc) / hw; return ruaY(z) + 0.09 * (1 - u * u) - 0.03 * Math.exp(-((1 - Math.abs(u)) * hw) / 0.25) + 0.012 * Math.sin(x * 1.7 + z * 0.9) * Math.sin(z * 0.6); };
  const roadM = new THREE.MeshStandardMaterial({ map: cob.map, roughnessMap: cob.rough, normalMap: cob.normal, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 1, envMapIntensity: 1.0 });
  const road = new THREE.Mesh(ribbon(r0, r1, 24, 260, yRoad, cob.size, cob.size), roadM); road.receiveShadow = true; road.name = 'pe-de-moleque'; root.add(road);

  // ── passeios de lajes de quartzito (um degrau acima da rua, acompanhando a ladeira) ──
  const sl = TX.slabTextures(); for (const k of ['map', 'normal']) { sl[k].anisotropy = aniso; }
  const walkM = new THREE.MeshStandardMaterial({ map: sl.map, normalMap: sl.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.82, envMapIntensity: 0.8 });
  const yWalk = (x, z) => ruaY(z) + CURB + 0.004 * Math.sin(x * 9 + z * 3);
  for (const [a, b] of [RUA.walkW, RUA.walkE]) { const m = new THREE.Mesh(ribbon(a, b, 2, 160, yWalk, sl.size[0], sl.size[1]), walkM); m.receiveShadow = true; root.add(m); }

  // ── meio-fio de pedra (blocos de ~0,9 m, levemente desalinhados) ──
  const curbM = new THREE.MeshStandardMaterial({ color: 0x8d877c, roughness: 0.85, map: sl.map });
  const blocks = [], R = TX.rng(3);
  for (const [x, s] of [[r0, -1], [r1, 1]]) for (let z = ZA; z < ZB; z += 0.9) {
    const zc = z + 0.45, y = ruaY(zc), L = 0.88 + R() * 0.03, tilt = Math.atan2(ruaY(zc + 0.45) - ruaY(zc - 0.45), 0.9);
    const g = new THREE.BoxGeometry(0.15 + R() * 0.04, CURB + 0.14, L); g.rotateX(-tilt); g.rotateY(-Math.atan2(ruaX(zc + 0.45) - ruaX(zc - 0.45), 0.9)); g.translate(x + ruaX(zc) + s * 0.06 + (R() - 0.5) * 0.012, y + (CURB - 0.12) / 2 - 0.005 + (R() - 0.5) * 0.008, zc);
    blocks.push(g);
  }
  const curb = new THREE.Mesh(mergeGeometries(blocks.map((g) => g.toNonIndexed())), curbM); curb.castShadow = true; curb.receiveShadow = true; root.add(curb);

  // ── tampas de ferro fundido (redondas na rua, retangulares no passeio) e poças d'água ──
  const iron = TX.ironCoverTextures();
  const ironM = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.5, map: iron.map, normalMap: iron.normal, normalScale: new THREE.Vector2(1.5, 1.5) });
  const covers = [];
  for (const z of [-30, -8, 14, 33]) { const g = new THREE.CylinderGeometry(0.32, 0.32, 0.03, 24); g.translate(rc + (z % 2 ? 1.6 : -1.4) + ruaX(z), yRoad(rc, z) + 0.008, z); covers.push(g); }
  for (const [x, z] of [[(RUA.walkW[0] + RUA.walkW[1]) / 2, -18], [(RUA.walkE[0] + RUA.walkE[1]) / 2, 6], [(RUA.walkE[0] + RUA.walkE[1]) / 2, 27]]) { const g = new THREE.BoxGeometry(0.5, 0.02, 0.7); g.translate(x + ruaX(z), yWalk(x, z) + 0.006, z); covers.push(g); }
  const cv = new THREE.Mesh(mergeGeometries(covers.map((g) => g.toNonIndexed())), ironM); cv.receiveShadow = true; root.add(cv);
  const puddleA = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 10, 64, 64, 62); gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#bbb'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.beginPath(); g.ellipse(64, 64, 62, 40, 0.3, 0, 7); g.fill(); return new THREE.CanvasTexture(c); })();
  const puddleM = new THREE.MeshStandardMaterial({ color: 0x222628, roughness: 0.04, metalness: 0.0, transparent: true, alphaMap: puddleA, opacity: 0.85, depthWrite: false, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z, s] of [[r0 + 0.6, -22, 1.2], [rc + 0.8, 4, 0.9], [r1 - 0.5, 19, 1.4], [r0 + 0.5, 38, 1.0]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * s, 0.9 * s), puddleM); p.rotation.x = -Math.PI / 2; p.position.set(x + ruaX(z), yRoad(x, z) + 0.012, z); p.rotation.z = (R() - 0.5) * 0.8; root.add(p);
  }

  // ── capim e musgo nas juntas junto ao meio-fio (faixa de 0,35 m em cada sarjeta) ──
  const grassT = TX.grassStripTexture(); grassT.repeat.set(1, 1);
  const grassM = new THREE.MeshStandardMaterial({ map: grassT, transparent: true, alphaTest: 0.25, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const [a, b] of [[r0, r0 + 0.35], [r1, r1 - 0.35]]) { const gg = ribbon(Math.min(a, b), Math.max(a, b), 1, 200, (x, z) => yRoad(x, z) + 0.01, 0.35, 3.0); if (a > b) { const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, -uv.getX(i)); } const m = new THREE.Mesh(gg, grassM); m.receiveShadow = true; root.add(m); }

  // ── chão em volta (terra batida/pedra) e céu com cirros ──
  const groundM = new THREE.MeshStandardMaterial({ color: 0x4d5536, roughness: 0.95 }); // terreno com mato baixo (fora da rua)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundM); ground.rotation.x = -Math.PI / 2; ground.position.set(19, -1.7, 0); ground.receiveShadow = true; root.add(ground);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(330, 48, 24), new THREE.MeshBasicMaterial({ map: TX.skyTexture(), side: THREE.BackSide, depthWrite: false, fog: false, color: new THREE.Color(1.15, 1.15, 1.15) }));
  sky.position.set(19, -20, 0); sky.renderOrder = -10; sky.userData.noAO = true; sky.userData.noBloom = true; root.add(sky);

  // ── casca externa dos dois prédios (vistos do alto no voo): paredes caiadas com barrado + telhado cerâmico de 4 águas;
  // faces só para fora, 15 cm além das paredes internas — de dentro não aparecem ──
  const roofT = TX.tileRoofTexture(); roofT.anisotropy = aniso;
  const roofM = new THREE.MeshStandardMaterial({ map: roofT, roughness: 0.8 });
  const limeM = new THREE.MeshStandardMaterial({ map: TX.facadeTexture(3, { bays: 0, barrado: '#7a5a3a' }), roughness: 0.9 });
  const shell = (x0, x1, z0, z1, h, pitch) => {
    const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, gs = [];
    for (const [w, x, z, ry] of [[W, cx, z1, 0], [W, cx, z0, Math.PI], [D, x1, cz, Math.PI / 2], [D, x0, cz, -Math.PI / 2]]) {
      const g = new THREE.PlaneGeometry(w, h + 1.6); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w / 6.4);
      g.rotateY(ry); g.translate(x, (h - 1.6) / 2, z); gs.push(g);
    }
    const wall = new THREE.Mesh(mergeGeometries(gs.map((g) => g.toNonIndexed())), limeM); wall.receiveShadow = true; root.add(wall);
    limeM.map.wrapS = THREE.RepeatWrapping;
    // telhado de 4 águas com beiral de 0,6 m
    const o = 0.6, rh = Math.min(W, D) / 2 * pitch, a = [x0 - o, h, z0 - o], b = [x1 + o, h, z0 - o], c = [x1 + o, h, z1 + o], d = [x0 - o, h, z1 + o];
    const long = W >= D, r1 = long ? [x0 + D / 2, h + rh, cz] : [cx, h + rh, z0 + W / 2], r2 = long ? [x1 - D / 2, h + rh, cz] : [cx, h + rh, z1 - W / 2];
    const tri = (p, q, r) => [...p, ...q, ...r];
    const pos = long ? [...tri(a, r1, b), ...tri(b, r1, r2), ...tri(d, c, r2), ...tri(d, r2, r1), ...tri(a, d, r1), ...tri(b, r2, c)]
      : [...tri(a, b, r1), ...tri(b, c, r2), ...tri(b, r2, r1), ...tri(d, r1, r2), ...tri(d, r2, c), ...tri(a, r1, d)];
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const uvs = []; for (let i = 0; i < pos.length; i += 3) uvs.push((pos[i] + pos[i + 2]) / 2.4, pos[i + 1] * 1.6 + (pos[i + 2] - pos[i]) * 0.1); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    rg.computeVertexNormals(); const roof = new THREE.Mesh(rg, roofM); roof.material.side = THREE.DoubleSide; roof.castShadow = true; roof.receiveShadow = true; root.add(roof);
  };
  shell(HALL.x0 - 0.15, HALL.x1 + 0.15, HALL.z0 - 0.15, HALL.z1 + 0.15, HALL.h + 0.35, 0.55);
  shell(HALL2.x0 - 0.15, HALL2.x1 + 0.15, HALL2.z0 - 0.15, HALL2.z1 + 0.15, HALL2.h + 0.4, 0.45);

  root.traverse((o) => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  return { group: root, roadX: rc, update() {} };
}
