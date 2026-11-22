// Rua colonial (estilo Ouro Preto) entre a padaria e a casa de caldeiras — contrato compartilhado (somente leitura).
// Eixo da rua ao longo de z. Padaria (x ≤ 8,6) a oeste, casa de caldeiras (x ≥ 30) a leste.
// Dono: ORQUESTRADOR. Usado por street.js (CENÁRIO: piso, perfil de luz externo, voo), street_houses.js (CASARIO)
// e street_city.js (CIDADE: igreja, morro, mobiliário urbano).
export const RUA = {
  x0: 8.75, x1: 29.85, z0: -45, z1: 45,
  houseW: [8.75, 14.1],   // fileira oeste de sobrados (fachada em x = 14,1 voltada para +x)
  houseE: [23.7, 29.85],  // fileira leste de sobrados (fachada em x = 23,7 voltada para −x)
  walkW: [14.1, 15.9], walkE: [21.9, 23.7], // passeios de lajes de pedra
  road: [15.9, 21.9],     // pé-de-moleque (estreitado; passeios ganham a diferença)
  churchZ: 62,            // igreja barroca no alto da ladeira, fora da rua, eixo x ≈ 18,9
};
/** cota do terreno: plano no trecho entre os prédios (|z| ≤ 10) e ladeira subindo para +z (rumo à igreja) e leve descida para −z */
export function ruaY(z) { return z > 10 ? 0.075 * (z - 10) : z < -10 ? -0.03 * (-z - 10) : 0; }
/** desvio lateral do eixo da rua (curva leve em S fora do trecho entre os prédios). Somar a TODAS as coordenadas x da rua,
 *  dos passeios e das fachadas na cota z (as portas da padaria e da casa de caldeiras, em |z| ≤ 8, ficam sem desvio). */
export function ruaX(z) { const a = Math.abs(z); return a <= 8 ? 0 : 1.2 * Math.sign(z) * Math.sin((a - 8) / 14); }
