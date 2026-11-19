// Câmeras e geometria do prédio usadas pelo palco — dono: CENÁRIO.
// Pontos físicos compartilhados (fornos, estações, mesa, vitrine) ficam em layout.js (somente leitura).
// Cada vista: pos, target, fov (vertical, graus), `aspect` = proporção para a qual foi enquadrada (padrão 1,5; em telas
// mais estreitas o fov abre para manter a largura), `focus` [x,y,z] + `dof` (0 = nítido … 0,5 = vitrine de produto).
import { HALL as H, PRESENT, STATIONS, TABLE, OVENS } from './layout.js';
import { HALL2 as H2, STATIONS2, TABLE2, PRESENT2 } from './layout_caldeiras.js';
export { PRESENT, PRESENT2 };

// Sala de fornos fechada: sem claraboias. `eave` = altura útil (limite da câmera). Painéis LED herméticos em grade.
export const HALL = {
  ...H, eave: H.h,
  tileTop: 2.1,                       // azulejo 30×30 (medido na FOTO 2) até 2,10 m, pintura epóxi acima
  // luminárias LED herméticas (centros) — fileiras paralelas a x
  ledRows: [-3.75, -0.6, 2.4, 5.0],
  ledCols: [-6.6, -4.0, -1.4, 1.2, 3.8, 6.4],
  probe: [3.6, 1.55, -1.6],           // ponto de captura do IBL (reflexos do inox) — no meio da sala, diante dos fornos
};

const forno = STATIONS.forno, HALL_Z0 = H.z0, S2c = STATIONS2.caldeira; void OVENS;
export const CAMS = {
  // FOTO 2 (refs/ref_ambiente.webp, 1:1): câmera a ~0,45 m do medidor, quase na altura do aparelho, olhando −z para o
  // forno turbo 1; grande angular (como a foto: o globo de 152 mm ocupa ~¼ da largura). A parede de azulejo da direita
  // (x = 8,6) entra pela borda direita, a tubulação de gás no vão entre o forno e a parede.
  ref: { pos: [forno.tripod[0] - 0.1, 1.13, forno.tripod[2] + 0.52], target: [forno.tripod[0] + 0.06, 1.05, HALL_Z0], fov: 66, aspect: 1,
    focus: [forno.tripod[0] - 0.04, 1.26, forno.tripod[2]], dof: 0.12 },
  overview: { pos: [-7.1, 3.55, 5.45], target: [2.6, 0.7, -3.6], fov: 58, dof: 0 },
  forno: { pos: [5.55, 1.72, -1.15], target: [7.35, 1.05, -4.6], fov: 50, dof: 0 },
  bancada: { pos: [3.15, 1.95, 1.25], target: [5.4, 0.95, -1.55], fov: 50, dof: 0 },
  descanso: { pos: [-3.3, 1.85, 1.6], target: [-6.4, 0.85, 4.5], fov: 52, dof: 0 },
  mesa: { pos: [TABLE.pos[0] + 0.55, 1.72, TABLE.pos[2] + 1.6], target: [TABLE.pos[0], TABLE.h + 0.05, TABLE.pos[2]], fov: 46,
    focus: [TABLE.pos[0], TABLE.h + 0.08, TABLE.pos[2]], dof: 0.12 },
  // ── AMBIENTE 2 — casa de caldeiras (enquadramentos provisórios; o agente CALDEIRAS sugere os definitivos) ──
  c_ref: { pos: [34.38, 1.8, 1.89], target: [38.2, 1.9, -3.0], fov: 52, focus: [S2c.tripod[0], 1.3, S2c.tripod[2]], dof: 0.06 },
  c_overview: { pos: [31.6, 5.4, 9.0], target: [45, 1.2, -4.5], fov: 60, dof: 0 },
  caldeira: { pos: [37.9, 1.65, 1.2], target: [36.4, 1.4, -1.6], fov: 50, dof: 0 },
  valvulas: { pos: [46.0, 1.95, -3.4], target: [48.4, 1.25, -8.2], fov: 52, dof: 0 },
  controle: { pos: [48.4, 1.75, 4.6], target: [51.4, 1.0, 7.6], fov: 52, dof: 0 },
  c_mesa: { pos: [TABLE2.pos[0] + 0.55, 1.72, TABLE2.pos[2] + 1.6], target: [TABLE2.pos[0], TABLE2.h + 0.05, TABLE2.pos[2]], fov: 46,
    focus: [TABLE2.pos[0], TABLE2.h + 0.08, TABLE2.pos[2]], dof: 0.12 },
};
// limites/ajustes do palco por ambiente (scene.js → stage.setEnv)
export const HALL2 = { ...H2, eave: H2.h, probe: [43.0, 2.4, 1.2] };
