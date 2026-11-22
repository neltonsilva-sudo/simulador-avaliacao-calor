// Jato da purga de fundo: gotas de água caindo do bocal do dreno no ralo, com respingos no piso (pontos leves, sem sombra).
import * as THREE from 'three';

export function createPurgeJet(parent, origin) {
  const N = 220;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), age = new Float32Array(N).fill(99), life = new Float32Array(N);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(225,235,245,.7)'); gr.addColorStop(1, 'rgba(225,235,245,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const mat = new THREE.PointsMaterial({ size: 0.022, map: tex, color: 0xdfe8ee, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = 'cald_valves_jet'; pts.visible = false; pts.renderOrder = 9; pts.userData.noAO = true;
  parent.add(pts);
  const o = origin.clone(); let acc = 0, alive = 0; let rnd = 777; const R = () => ((rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296);
  function emit() {
    for (let i = 0; i < N; i++) if (age[i] >= life[i]) {
      age[i] = 0; life[i] = 0.5 + R() * 0.5;
      pos[i * 3] = o.x + (R() - 0.5) * 0.02; pos[i * 3 + 1] = o.y; pos[i * 3 + 2] = o.z + (R() - 0.5) * 0.02;
      vel[i * 3] = (R() - 0.5) * 0.25; vel[i * 3 + 1] = -1.2 - R() * 1.0; vel[i * 3 + 2] = (R() - 0.5) * 0.25; return;
    }
  }
  /** flow 0..1 (vazão de água) */
  function update(dt, flow) {
    dt = Math.min(dt, 0.05);
    acc += flow * 420 * dt; while (acc >= 1) { acc -= 1; emit(); }
    alive = 0;
    for (let i = 0; i < N; i++) {
      if (age[i] >= life[i]) { pos[i * 3 + 1] = -50; continue; }
      age[i] += dt; alive++;
      vel[i * 3 + 1] -= 9.8 * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.012) { // respingo no ralo/piso
        pos[i * 3 + 1] = 0.012; const sp = 0.6 + R() * 0.9, a = R() * 6.283;
        vel[i * 3] = Math.cos(a) * sp; vel[i * 3 + 2] = Math.sin(a) * sp; vel[i * 3 + 1] = 0.6 + R() * 0.9; life[i] = Math.min(life[i], age[i] + 0.25);
      }
    }
    pts.visible = alive > 0; geo.attributes.position.needsUpdate = true;
  }
  return { update, points: pts };
}
