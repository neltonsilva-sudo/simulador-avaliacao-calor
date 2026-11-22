// Rua colonial (estilo Ouro Preto) entre a padaria e a casa de caldeiras — contrato compartilhado (somente leitura).
// Eixo da rua ao longo de z. Padaria (x ≤ 8,6) a oeste, casa de caldeiras (x ≥ 30) a leste.
// Dono: ORQUESTRADOR. Usado por street.js (CENÁRIO: piso, perfil de luz externo, voo), street_houses.js (CASARIO)
// e street_city.js (CIDADE: igreja, morro, mobiliário urbano).
export const RUA = {
  x0: 8.75, x1: 29.85, z0: -45, z1: 45,
  houseW: [8.75, 14.1],   // fileira oeste de sobrados (fachada em x = 14,1 voltada para +x)
  houseE: [23.7, 29.85],  // fileira leste de sobrados (fachada em x = 23,7 voltada para −x)
  walkW: [14.1, 15.2], walkE: [22.6, 23.7], // passeios de lajes de pedra
  road: [15.2, 22.6],     // pé-de-moleque
  churchZ: 62,            // igreja barroca no alto da ladeira, fora da rua, eixo x ≈ 18,9
};
/** cota do terreno: plano no trecho entre os prédios (|z| ≤ 10) e ladeira subindo para +z (rumo à igreja) e leve descida para −z */
export function ruaY(z) { return z > 10 ? 0.075 * (z - 10) : z < -10 ? -0.03 * (-z - 10) : 0; }
