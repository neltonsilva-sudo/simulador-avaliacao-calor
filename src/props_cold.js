// AMBIENTAÇÃO — câmara fria modular (painéis isotérmicos) com porta aberta e cortina de tiras de PVC.
// Frame local: origem no piso, no centro da face da porta; +z local = para fora (sala); a câmara ocupa z ∈ [−D, 0].
import * as THREE from 'three';
import * as T from './props_tex.js';
import { M, mul, box, rbox, addRack, crateGeos, bucketGeos } from './props_geo.js';

export function buildColdRoom(B, mats, base, root, { W = 2.6, D = 1.85, H = 2.5, doorX = -0.5, doorW = 0.9, doorH = 2.0 } = {}) {
  const t = 0.1;
  const panel = new THREE.MeshStandardMaterial({ map: T.panelTex(), roughness: 0.55, metalness: 0.05 }); panel.name = 'coldPanel';
  const pbox = (w, h, d, x, y, z) => {
    const g = box(w, h, d); const uv = g.attributes.uv;
    // UV em metros (friso a cada ~0,1 m): textura 512 px ↔ 0,6 m de largura, 1024 px ↔ 2,5 m de altura
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i); uv.setXY(i, (ax + x + z) / 0.6, (p.getY(i) + y) / 2.5); }
    B.add(g, panel, mul(base, M(x, y, z)));
  };
  const xl = -W / 2, xr = W / 2, d0 = doorX - doorW / 2, d1 = doorX + doorW / 2;
  // face da porta (3 peças), laterais, fundo e teto
  pbox(d0 - xl, H, t, (xl + d0) / 2, H / 2, -t / 2);
  pbox(xr - d1, H, t, (d1 + xr) / 2, H / 2, -t / 2);
  pbox(doorW, H - doorH, t, doorX, doorH + (H - doorH) / 2, -t / 2);
  pbox(t, H, D, xl + t / 2, H / 2, -D / 2); pbox(t, H, D, xr - t / 2, H / 2, -D / 2);
  pbox(W, H, t, 0, H / 2, -D + t / 2);
  pbox(W, t, D, 0, H + t / 2, -D / 2);
  // perfis de alumínio nas arestas + rodapé sanitário
  for (const x of [xl, xr]) { B.add(box(0.04, H + t, 0.04), mats.alu, mul(base, M(x + (x < 0 ? 0.012 : -0.012), (H + t) / 2, 0.012))); B.add(box(0.04, 0.04, D), mats.alu, mul(base, M(x + (x < 0 ? 0.012 : -0.012), H + t, -D / 2))); }
  B.add(box(W + 0.02, 0.04, 0.04), mats.alu, mul(base, M(0, H + t, 0.012)));
  B.add(box(d0 - xl, 0.08, 0.03), mats.alu, mul(base, M((xl + d0) / 2, 0.04, 0.012)), { cast: false }); B.add(box(xr - d1, 0.08, 0.03), mats.alu, mul(base, M((d1 + xr) / 2, 0.04, 0.012)), { cast: false });
  // batente inox da porta, soleira e rampa
  B.add(box(0.07, doorH + 0.07, t + 0.03), mats.steel, mul(base, M(d0 - 0.035, (doorH + 0.07) / 2, -t / 2))); B.add(box(0.07, doorH + 0.07, t + 0.03), mats.steel, mul(base, M(d1 + 0.035, (doorH + 0.07) / 2, -t / 2)));
  B.add(box(doorW + 0.14, 0.07, t + 0.03), mats.steel, mul(base, M(doorX, doorH + 0.035, -t / 2)));
  B.add(box(doorW, 0.012, t + 0.18), mats.steel, mul(base, M(doorX, 0.006, 0.0)), { cast: false });
  // interior: piso, rack com caixas/baldes, luminária fria
  B.add(box(W - 2 * t, 0.01, D - 2 * t), mats.coldFloor, mul(base, M(0, 0.005, -D / 2)), { cast: false });
  const rk = mul(base, M(0.35, 0, -D + t + 0.3, 0)); addRack(B, mats, rk, { w: 1.5, d: 0.5, h: 1.82, levels: [0.16, 0.6, 1.04, 1.48] });
  const cg = crateGeos(), bg = bucketGeos();
  for (const [x, y, k] of [[-0.36, 0.166, 0], [0.36, 0.166, 1], [-0.36, 0.606, 0], [0.36, 0.606, 0], [-0.36, 1.046, 1], [0.36, 1.046, 0], [0.36, 1.326, 0]]) {
    const m = mul(rk, M(x, y, 0)), c = mats.crate[k]; B.add(cg.sides, c.side, m, { cast: false }); B.add(cg.bottom, c.bottom, m, { cast: false }); B.add(cg.rim, c.rim, m);
    const dough = rbox(0.5, 0.06, 0.3, 0.025); B.add(dough, mats.dough, mul(m, M(0, 0.05, 0)), { cast: false });
  }
  for (let i = 0; i < 3; i++) { const m = mul(rk, M(-0.5 + i * 0.32, 1.486, 0, i)); B.add(bg.body, mats.bucket[i % 3], m); B.add(bg.lid, [mats.lidRed, mats.lidBlue, mats.lidYel][i], m); }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfeeff, emissiveIntensity: 2.2, roughness: 0.4 });
  const lamp = new THREE.Mesh(rbox(0.6, 0.05, 0.1, 0.02), lampMat); lamp.applyMatrix4(mul(base, M(0, H - 0.04, -D / 2))); lamp.userData.noAO = true; root.add(lamp);
  // controlador digital acima da porta + caixa elétrica + evaporadora (vista pela porta)
  B.add(rbox(0.2, 0.13, 0.06, 0.008), mats.plasticW, mul(base, M(d1 + 0.35, 1.6, 0.03)));
  const led = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: T.coldLedTex(), emissiveIntensity: 1.6, roughness: 0.3 }));
  led.applyMatrix4(mul(base, M(d1 + 0.35, 1.62, 0.0605))); root.add(led);
  B.add(rbox(0.3, 0.42, 0.14, 0.01), mats.socketBody, mul(base, M(xl + 0.4, 1.8, 0.07)));
  B.add(box(0.9, 0.32, 0.36), mats.plasticW, mul(base, M(0.55, H - 0.2, -D + t + 0.2)));
  // folha da porta (aberta ~100°, articulada no lado esquerdo)
  const hinge = mul(base, M(d0 - 0.02, 0, 0.06, -Math.PI * 0.56));
  B.add(box(doorW + 0.06, doorH + 0.04, 0.1), panel, mul(hinge, M((doorW + 0.06) / 2, (doorH + 0.04) / 2, 0)));
  B.add(box(doorW, 0.3, 0.004), mats.steel, mul(hinge, M((doorW + 0.06) / 2, 0.17, 0.052)), { cast: false });
  B.add(box(doorW, 0.3, 0.004), mats.steel, mul(hinge, M((doorW + 0.06) / 2, 0.17, -0.052)), { cast: false });
  for (const y of [0.3, doorH - 0.3]) B.add(box(0.12, 0.08, 0.05), mats.alu, mul(hinge, M(-0.02, y, 0.03)));
  B.add(box(0.05, 0.3, 0.05), mats.black, mul(hinge, M(doorW - 0.05, 1.05, 0.075))); B.add(box(0.05, 0.12, 0.05), mats.alu, mul(hinge, M(doorW - 0.05, 1.05, -0.075)));
  B.add(box(doorW + 0.06, 0.02, 0.012), mats.rubber, mul(hinge, M((doorW + 0.06) / 2, doorH + 0.03, -0.05)), { cast: false });
  // trilho + cortina de tiras de PVC (instanciada, balança com o ar)
  const yTop = doorH - 0.02;
  B.add(box(doorW + 0.04, 0.04, 0.03), mats.steel, mul(base, M(doorX, yTop + 0.02, -t - 0.02)));
  const n = 8, sw = 0.2, sh = yTop - 0.015;
  const sg = new THREE.PlaneGeometry(sw, sh, 1, 6); sg.translate(0, -sh / 2, 0);
  const pvc = new THREE.MeshStandardMaterial({ color: 0xc6dde6, transparent: true, opacity: 0.38, roughness: 0.12, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.4 });
  const strips = new THREE.InstancedMesh(sg, pvc, n); strips.renderOrder = 4; strips.userData.noAO = true;
  const st = []; const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { const x = doorX - doorW / 2 + sw / 2 - 0.02 + i * (doorW + 0.04 - sw) / (n - 1); st.push({ x, z: -t - 0.02 + (i % 2) * 0.006, ph: i * 1.7 }); }
  const tmp = new THREE.Object3D();
  function sway(time) {
    st.forEach((s, i) => {
      tmp.position.set(s.x, yTop, s.z); tmp.rotation.set(Math.sin(time * 0.9 + s.ph) * 0.025 + 0.012, Math.sin(time * 0.6 + s.ph * 2) * 0.05, 0);
      tmp.updateMatrix(); m4.multiplyMatrices(base, tmp.matrix); strips.setMatrixAt(i, m4);
    });
    strips.instanceMatrix.needsUpdate = true;
  }
  sway(0); root.add(strips);
  return { update: (dt, time) => sway(time) };
}
