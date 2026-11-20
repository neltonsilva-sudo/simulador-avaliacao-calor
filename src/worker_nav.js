// TRABALHADORA — navegação: grade de ocupação (0,1 m) rasterizada a partir dos triângulos visíveis da cena na faixa de
// altura do corpo (0,12–1,6 m), inflada pelo raio do corpo, A* 8-vizinhos + "puxada de fio" (linha de visada).
import * as THREE from 'three';

export function buildNav(root, { x0, x1, z0, z1, cell = 0.1, y0 = 0.12, y1 = 1.6, R = 0.3, skip = () => false }) {
  const nx = Math.ceil((x1 - x0) / cell), nz = Math.ceil((z1 - z0) / cell), N = nx * nz, occ = new Uint8Array(N);
  const ci = (x) => Math.floor((x - x0) / cell), cj = (z) => Math.floor((z - z0) / cell);
  const mark = (ax, az, bx, bz) => { const i0 = Math.max(0, ci(ax)), i1 = Math.min(nx - 1, ci(bx)), j0 = Math.max(0, cj(az)), j1 = Math.min(nz - 1, cj(bz));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) occ[j * nx + i] = 1; };
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), M = new THREE.Matrix4(), IM = new THREE.Matrix4(), box = new THREE.Box3();
  function tris(o, mw) {
    const g = o.geometry, P = g.attributes.position, idx = g.index?.array, n = idx ? idx.length : P.count;
    if (!g.boundingBox) g.computeBoundingBox();
    box.copy(g.boundingBox).applyMatrix4(mw);
    if (box.max.y < y0 || box.min.y > y1 || box.max.x < x0 || box.min.x > x1 || box.max.z < z0 || box.min.z > z1) return;
    if ((box.max.x - box.min.x) * (box.max.z - box.min.z) < 0.6 && box.min.y < y1 && box.max.y > y0) { mark(box.min.x, box.min.z, box.max.x, box.max.z); return; }
    for (let k = 0; k + 2 < n; k += 3) {
      a.fromBufferAttribute(P, idx ? idx[k] : k).applyMatrix4(mw); b.fromBufferAttribute(P, idx ? idx[k + 1] : k + 1).applyMatrix4(mw); c.fromBufferAttribute(P, idx ? idx[k + 2] : k + 2).applyMatrix4(mw);
      if (Math.max(a.y, b.y, c.y) < y0 || Math.min(a.y, b.y, c.y) > y1) continue;
      mark(Math.min(a.x, b.x, c.x), Math.min(a.z, b.z, c.z), Math.max(a.x, b.x, c.x), Math.max(a.z, b.z, c.z));
    }
  }
  root.updateMatrixWorld(true);
  const visit = (o) => {
    if (!o.visible || skip(o)) return;
    if (o.isMesh && !o.isSkinnedMesh && o.geometry?.attributes?.position) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!(m && m.transparent && m.depthWrite === false)) {
        if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, IM); tris(o, M.multiplyMatrices(o.matrixWorld, IM)); }
        else tris(o, o.matrixWorld);
      }
    }
    for (const ch of o.children) visit(ch);
  };
  visit(root);
  // distância (em células) ao obstáculo mais próximo — chanfro 2 passadas
  const dist = new Float32Array(N); for (let k = 0; k < N; k++) dist[k] = occ[k] ? 0 : 1e9;
  const D2 = Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let d = dist[k];
    if (i > 0) d = Math.min(d, dist[k - 1] + 1); if (j > 0) { d = Math.min(d, dist[k - nx] + 1); if (i > 0) d = Math.min(d, dist[k - nx - 1] + D2); if (i < nx - 1) d = Math.min(d, dist[k - nx + 1] + D2); } dist[k] = d; }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let d = dist[k];
    if (i < nx - 1) d = Math.min(d, dist[k + 1] + 1); if (j < nz - 1) { d = Math.min(d, dist[k + nx] + 1); if (i < nx - 1) d = Math.min(d, dist[k + nx + 1] + D2); if (i > 0) d = Math.min(d, dist[k + nx - 1] + D2); } dist[k] = d; }
  const Rc = R / cell;

  function plan(from, to, dyn = []) {
    const cx = (i) => x0 + (i + 0.5) * cell, cz = (j) => z0 + (j + 0.5) * cell, near = 0.75;
    const dynD = (x, z) => { let m = 1e9; for (const o of dyn) m = Math.min(m, Math.hypot(x - o.x, z - o.z) - o.r); return m; };
    const ok = (i, j) => { if (i < 0 || j < 0 || i >= nx || j >= nz) return false; const k = j * nx + i; if (occ[k]) return false;
      const x = cx(i), z = cz(j), dd = Math.min(dist[k] * cell, dynD(x, z));
      if (dd >= R) return true; return Math.hypot(x - from.x, z - from.y) < near || Math.hypot(x - to.x, z - to.y) < near; };
    const si = Math.max(0, Math.min(nx - 1, ci(from.x))), sj = Math.max(0, Math.min(nz - 1, cj(from.y))), gi = Math.max(0, Math.min(nx - 1, ci(to.x))), gj = Math.max(0, Math.min(nz - 1, cj(to.y)));
    const g = new Float32Array(N).fill(Infinity), par = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [[0, sj * nx + si]]; g[sj * nx + si] = 0; const goal = gj * nx + gi; let found = false;
    const push = (f, k) => { open.push([f, k]); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
      if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
    while (open.length) {
      const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === goal) { found = true; break; }
      const i = k % nx, j = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (!ok(ii, jj)) continue;
        if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
        const kk = jj * nx + ii, pen = Math.max(0, Rc * 1.8 - dist[kk]) * 0.25, ng = g[k] + (di && dj ? D2 : 1) + pen;
        if (ng < g[kk]) { g[kk] = ng; par[kk] = k; push(ng + Math.hypot(ii - gi, jj - gj), kk); } }
    }
    if (!found) return null;
    const cells = []; for (let k = goal; k >= 0; k = par[k]) cells.push([cx(k % nx), cz((k / nx) | 0)]); cells.reverse();
    cells[0] = [from.x, from.y]; cells[cells.length - 1] = [to.x, to.y];
    const los = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L / (cell * 0.5));
      for (let s = 1; s < n; s++) { const x = p[0] + (q[0] - p[0]) * s / n, z = p[1] + (q[1] - p[1]) * s / n; if (!ok(ci(x), cj(z))) return false; } return true; };
    const out = [cells[0]]; let k = 0;
    while (k < cells.length - 1) { let m = cells.length - 1; while (m > k + 1 && !los(cells[k], cells[m])) m--; out.push(cells[m]); k = m; }
    return out;
  }
  return { plan, nx, nz, occ };
}
