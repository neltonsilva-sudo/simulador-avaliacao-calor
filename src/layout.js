// Layout físico compartilhado — dono: ORQUESTRADOR (outros módulos LEEM daqui; não editar).
// Mundo: metros, y para cima. Setor de fornos de uma panificação industrial. Fornos encostados na parede do fundo (z = HALL.z0)
// com a frente voltada para +z. Parede direita em x = HALL.x1 (azulejo branco, tubulação de gás amarela — ver foto 2).
// Convenção de orientação: rotY = 0 → "frente" do objeto/pessoa aponta para +z; rotY = π → aponta para −z.
export const HALL = { x0: -8, x1: 8.6, z0: -6, z1: 6, h: 4.0 };

// door: retângulo da abertura da porta no plano frontal (cx = deslocamento x do centro em relação a oven.x; y0 = base; w,h).
// Forno de lastro: 3 câmaras empilhadas (doors[]). setpoint = temperatura interna (°C); glassT = vidro da porta fechada;
// frontT = chapa frontal; t* usados pelo modelo térmico (thermal.js).
export const OVENS = [
  // Linha de fornos da FOTO 3 (sala de fornos, descrita em refs/SALA_FORNOS.md), da esquerda para a direita, + forno turbo
  // da FOTO 2 (forno1, junto à parede direita de azulejo = ponto de medição S1).
  { id: 'rotativo', kind: 'rotativo', label: 'Forno rotativo a gás', x: -2.6, w: 1.8, d: 2.2, h: 2.55,
    doors: [{ cx: 0.1, y0: 0.06, w: 0.86, h: 1.95 }], panel: { cx: -0.62, w: 0.4 }, setpoint: 200, glassT: 58, frontT: 41 },
  { id: 'lastro', kind: 'lastro', label: 'Forno de lastro (3 câmaras, portas de vidro)', x: 0.3, w: 2.9, d: 2.2, h: 2.35,
    doors: [{ cx: -0.15, y0: 0.98, w: 2.35, h: 0.27 }, { cx: -0.15, y0: 1.33, w: 2.35, h: 0.27 }, { cx: -0.15, y0: 1.68, w: 2.35, h: 0.27 }],
    panel: { cx: 1.3, w: 0.22 }, setpoint: 240, glassT: 72, frontT: 46 },
  // FOTO 5 (refs/ref_turbo_vitrine.webp): forno de convecção com janela de vidro grande e torre de comando separada à direita.
  { id: 'forno2', kind: 'turbo_vitrine', label: 'Forno de convecção (janela panorâmica)', x: 2.75, w: 1.45, d: 1.1, h: 1.75,
    doors: [{ cx: -0.15, y0: 0.58, w: 0.9, h: 0.8 }], panel: { cx: 0.6, w: 0.24 }, setpoint: 190, glassT: 62, frontT: 42 },
  // FOTO 4 (refs/ref_lastro4.png): forno de lastro de 4 câmaras, coluna de puxadores à esquerda, 4 controladores vermelho/verde
  // à direita, coifa inox no topo e rampa de chapa xadrez diante dele.
  { id: 'vertical', kind: 'lastro4', label: 'Forno de lastro de 4 câmaras', x: 4.85, w: 1.75, d: 1.7, h: 2.45,
    doors: [{ cx: -0.02, y0: 0.5, w: 1.2, h: 0.24 }, { cx: -0.02, y0: 0.9, w: 1.2, h: 0.24 }, { cx: -0.02, y0: 1.3, w: 1.2, h: 0.24 }, { cx: -0.02, y0: 1.7, w: 1.2, h: 0.24 }],
    panel: { cx: 0.72, w: 0.24 }, setpoint: 230, glassT: 70, frontT: 45 },
  { id: 'forno1', kind: 'turbo', label: 'Forno turbo 1 (convecção) — ponto S1', x: 7.2, w: 1.25, d: 1.15, h: 2.1,
    doors: [{ cx: -0.11, y0: 0.58, w: 0.8, h: 1.1 }], panel: { cx: 0.47, w: 0.26 }, setpoint: 180, glassT: 66, frontT: 43 },
];
export const ovenFrontZ = (o) => HALL.z0 + o.d;

// Situações térmicas / pontos de medição (tripé). `worker` = onde a forneira fica; `workerRotY` = para onde olha;
// `tripod` = ponto de medição correto (ao lado dela, sem obstruir a fonte); `face` = rotY do tripé (rig) tal que o −z local
// do medidor aponta para a fonte (normal do plano vertical dos sensores na direção da fonte, NHO-06 7.2) e o visor (+z local)
// fica na face OPOSTA à fonte; `chest` = altura do tórax (m) = altura dos sensores.
export const STATIONS = {
  forno:    { id: 'S1', label: 'Frente ao forno turbo 1 — carga e descarga (porta aberta)', worker: [6.98, 0, -4.05], workerRotY: Math.PI,
              tripod: [7.5, 0, -4.08], face: 0, chest: 1.3, source: 'forno1' },
  bancada:  { id: 'S2', label: 'Bancada de modelagem (a 3 m dos fornos)', worker: [5.2, 0, -1.25], workerRotY: Math.PI,
              tripod: [5.85, 0, -1.15], face: 0, chest: 1.3, source: null },
  descanso: { id: 'S3', label: 'Área de descanso e hidratação (ventilada)', worker: [-6.4, 0, 4.4], workerRotY: Math.PI / 2,
              tripod: [-5.75, 0, 4.85], face: Math.PI / 2, chest: 0.95, source: null, seated: true },
};
// Mesa de inox da direita (foto 2) e bancada de modelagem (S2): superfícies úteis para props.
export const BENCH = { pos: [5.2, 0, -1.85], w: 2.4, d: 0.8, h: 0.9 };
// Mesa do avaliador com a maleta do medidor (início da demonstração) e pose de apresentação (vitrine diante da câmera).
export const TABLE = { pos: [3.2, 0, 2.6], rotY: 0.35, h: 0.9 };
export const PRESENT = {
  // aparelho em pé sobre o tampo da mesa (TABLE local x 0,10, z 0,08), à direita da maleta; câmera de frente, 8° acima
  cam: { pos: [3.5027, 1.107, 3.2134], target: [3.297, 1.022, 2.6498], fov: 30, focus: [3.3278, 0.9326, 2.6673], dof: 0.5 },
  device: { pos: [3.3214, 0.9, 2.6409], rotY: 0.35 }, // origem do medidor = centro da base do corpo (ver CONTRACT.md); tela para +z
};
// Ar-condicionado/ventilador da área de descanso e coifas dos fornos (usados pelo modelo térmico).
export const FAN = { pos: [-7.6, 2.2, 4.6], aimRotY: Math.PI / 2, va: 1.1 };
