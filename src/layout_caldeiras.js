// AMBIENTE 2 — casa de caldeiras (fotos refs/caldeiras/ref_cald_1..5.webp). Dono: ORQUESTRADOR (somente leitura para os demais).
// Fica no mesmo mundo da sala de fornos, deslocado em x (x ∈ [30, 56]) — cada módulo mostra só o grupo do ambiente ativo
// (app.state.env === 'caldeiras'). Convenções iguais às de layout.js: metros, y para cima, rotY = 0 → frente para +z.
export const HALL2 = { x0: 30, x1: 56, z0: -10, z1: 10, h: 9.5, windowsSill: 2.2 };

// Vasos/caldeiras horizontais. axis: 'z' (comprimento ao longo de z) ou 'x'. c = centro [x,y,z]; L = comprimento; R = raio.
// shellT = temperatura da superfície do costado (°C). Isolado com chapa (como as fotos de inox brilhante) ≈ 55–70 °C;
// sem isolamento (trocador/coletor) ≈ 95–150 °C. front = tampo frontal (espelho/porta da fornalha) com temperatura própria.
export const BOILERS = [
  { id: 'cald1', kind: 'flamotubular', label: 'Caldeira flamotubular 1 (vapor saturado 10 bar)', axis: 'z', c: [36.5, 1.75, -4.6], L: 6.2, R: 1.25,
    shellT: 62, front: { side: +1, T: 118, label: 'tampo frontal / porta da caixa de fumaça' }, burner: true },
  { id: 'cald2', kind: 'flamotubular', label: 'Caldeira flamotubular 2', axis: 'z', c: [42.5, 1.75, -4.6], L: 6.2, R: 1.25,
    shellT: 60, front: { side: +1, T: 110, label: 'tampo frontal' }, burner: true },
  { id: 'trocador', kind: 'trocador', label: 'Trocador de calor casco-tubo (sem isolamento)', axis: 'x', c: [50.5, 1.15, 2.6], L: 4.4, R: 0.55,
    shellT: 118, front: null },
  { id: 'desaerador', kind: 'vaso', label: 'Desaerador / tanque de condensado (vertical)', axis: 'y', c: [53.6, 2.2, -6.6], L: 4.4, R: 1.0,
    shellT: 86, front: null },
];
// Linhas de vapor (cilindros finos). T = superfície; insulated → T baixa.
export const PIPES = [
  { id: 'coletor', label: 'Coletor/distribuidor de vapor', axis: 'x', c: [47.5, 1.55, -8.4], L: 8.0, R: 0.16, T: 168 },
  { id: 'saida1', axis: 'y', c: [36.5, 4.6, -6.2], L: 3.4, R: 0.11, T: 160 },
  { id: 'saida2', axis: 'y', c: [42.5, 4.6, -6.2], L: 3.4, R: 0.11, T: 160 },
  { id: 'aerea', axis: 'x', c: [43.0, 6.3, -6.2], L: 14.0, R: 0.13, T: 70 }, // isolada
];
// Vazamentos/purgas de vapor (pluma visível + umidade e calor local). rate 0..1.
export const LEAKS = [
  { id: 'purgador', label: 'Vazamento na gaxeta da válvula do distribuidor', pos: [48.7, 1.55, -8.1], rate: 0.8 },
  { id: 'respiro', label: 'Respiro do desaerador', pos: [53.6, 4.6, -6.6], rate: 0.6 },
];
// Situações térmicas do operador de caldeira (mesma semântica de STATIONS em layout.js).
export const STATIONS2 = {
  caldeira: { id: 'S1', label: 'Frente da caldeira 1 — visor de nível, queimador e painel', worker: [36.2, 0, -0.55], workerRotY: Math.PI,
              tripod: [36.95, 0, -0.45], face: 0, chest: 1.3, source: 'cald1' },
  valvulas: { id: 'S2', label: 'Distribuidor de vapor — manobra de válvulas e purgas', worker: [47.9, 0, -7.05], workerRotY: Math.PI,
              tripod: [48.65, 0, -6.95], face: 0, chest: 1.3, source: 'coletor' },
  controle: { id: 'S3', label: 'Sala de controle (cabine ventilada)', worker: [51.6, 0, 7.4], workerRotY: -Math.PI / 2,
              tripod: [51.0, 0, 6.8], face: Math.PI / 2, chest: 0.95, source: null, seated: true },
};
// Cabine da sala de controle (paredes de vidro, ar-condicionado) e painéis de comando das caldeiras.
export const CONTROL_ROOM = { x0: 49.4, x1: 55.6, z0: 5.2, z1: 9.6, h: 2.8, ta: 25.5, va: 0.35 };
export const TABLE2 = { pos: [41.8, 0, 5.6], rotY: -0.3, h: 0.9 };
export const PRESENT2 = {
  // mesma pose relativa à mesa TABLE2 que PRESENT tem em relação a TABLE (aparelho em pé sobre o tampo, à direita da maleta)
  cam: { pos: [41.6698, 1.107, 6.2715], target: [41.8471, 1.022, 5.6983], fov: 30, focus: [41.861, 0.9326, 5.7309], dof: 0.5 },
  device: { pos: [41.8719, 0.9, 5.706], rotY: -0.3 },
};
export const AMB2 = { ta0: 32.0, e: 2.55, wallT: 33.5, gradY: 0.9 }; // casa de caldeiras: mais quente e úmida, estratificação forte
export const isCaldeiras = (p) => p.x > 25;
