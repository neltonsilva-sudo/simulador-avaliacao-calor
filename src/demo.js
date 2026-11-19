// Roteiro da apresentação narrada do medidor de IBUTG — dono: UI/DEMO.
// Cada passo: capítulo, título, texto (legenda e voz; MP3 gerado por tools/gen_tts.py a partir dos campos text (aspas simples) —
// não altere um texto sem regenerar o áudio; sem o MP3 a voz do navegador assume), câmera, destaque e ação.
// Ações operam o aparelho pelas teclas do firmware (fw.press) e o modelo 3D (meter.animate/highlight), sempre com ?.
// Conteúdo técnico: NHO-06 (Fundacentro) itens 7.1 (equipamentos), 7.2 (montagem), 8.1 (aspectos gerais), 8.2 (medições).

/** Pausa da demonstração (botão ❙❙ Pausar): as esperas só contam o tempo fora da pausa. */
export const demoClock = { paused: false };
export const wait = (ms) => new Promise((r) => { let left = ms, last = performance.now();
  const tick = () => { const now = performance.now(); if (!demoClock.paused) left -= now - last; last = now; if (left <= 0) r(); else setTimeout(tick, Math.min(50, Math.max(4, left))); };
  setTimeout(tick, Math.min(50, ms)); });

const fst = (app) => app.fw?.state || {};
export const isOn = (app) => { const s = fst(app), p = s.power; return p === 'on' || p === true || (p == null && !!s.on); };
export const isRec = (app) => { const m = fst(app).mode; return m === 'rec' || m === 'pause'; };
const LONG = 2100; // pressão longa do firmware: ≥ 2000 ms (docs/FIRMWARE.md)
async function press(app, key, hold = 0, after = 600) {
  app.meter?.pressAnim?.(key);
  try { app.fw?.press?.(key, hold); } catch (e) { console.error('[demo] fw.press', e); }
  await wait(after);
}

// ── Navegação real do menu (docs/FIRMWARE.md): ≡ abre/entra/confirma · ▶‖ desce (cíclico) · ■ volta · ⏻ curto sai ──
const NAV = 650;
const topMenu = (app) => { const p = fst(app).menuPath || []; return p[p.length - 1]; };
async function menuOpen(app, ctx) { if (!(fst(app).menuPath || []).length) await press(app, 'menu', 0, 1000); }
/** Na lista atual, leva o cursor até o item cujo destino é `target` (null = Voltar) e confirma com ≡. */
async function menuGo(app, ctx, target) {
  const t = topMenu(app), M = app.fw?.MENUS?.[t]; if (!M || fst(app).page) return;
  const idx = M.items.findIndex((it) => it[1] === target); if (idx < 0) return;
  for (let g = 0; g < 12 && (fst(app).menuSel?.[t] || 0) !== idx; g++) { if (ctx && !ctx.alive()) return; await press(app, 'play', 0, NAV); }
  if (ctx && !ctx.alive()) return;
  await press(app, 'menu', 0, NAV + 350);
}
/** Página de opções: percorre (opcional) e para em `idx`; ≡ salva. */
async function optSet(app, ctx, idx, { showAll = false } = {}) {
  const pg = fst(app).page; if (!pg) return; const P = app.fw?.PAGES?.[pg.key]; const n = P?.options?.length || 0;
  if (showAll) for (let i = 0; i < n; i++) { if (ctx && !ctx.alive()) return; await press(app, 'play', 0, NAV + 200); }
  for (let g = 0; g < 10 && fst(app).page && fst(app).page.sel !== idx; g++) { if (ctx && !ctx.alive()) return; await press(app, 'play', 0, NAV); }
  if (!ctx || ctx.alive()) await press(app, 'menu', 0, NAV + 700);
}
async function fieldsWalk(app, ctx, n, dwell = 850) { for (let i = 0; i < n && fst(app).page; i++) { if (ctx && !ctx.alive()) return; await press(app, 'menu', 0, dwell); } }
async function menuExit(app) { if ((fst(app).menuPath || []).length || fst(app).page) await press(app, 'power', 0, 700); }

/** Passos do menu usados na apresentação (cada um opera as teclas reais com verificação de estado). */
export const MENU_DO = {
  async abrir(app, ctx) { await menuOpen(app, ctx); for (let i = 0; i < 9 && ctx.alive(); i++) await press(app, 'play', 0, 480); }, // percorre a lista e volta a Gravação
  async dataHora(app, ctx) { await menuOpen(app, ctx); await menuGo(app, ctx, 'datahora'); await fieldsWalk(app, ctx, 5, 900); },
  async gravacao(app, ctx) { await menuOpen(app, ctx); await menuGo(app, ctx, 'gravacao'); await menuGo(app, ctx, 'intervalo'); await optSet(app, ctx, 2, { showAll: true }); await menuGo(app, ctx, null); },
  async unidade(app, ctx) { await menuOpen(app, ctx); await menuGo(app, ctx, 'unidade'); await optSet(app, ctx, 0); },
  async memoria(app, ctx, w) { await menuOpen(app, ctx); await menuGo(app, ctx, 'memoria'); await w(2200); if (ctx.alive() && fst(app).page) await press(app, 'stop', 0, NAV); },
  async info(app, ctx, w) { await menuOpen(app, ctx); await menuGo(app, ctx, 'info'); await w(3200); if (!ctx.alive()) return; await press(app, 'play', 0, 3600); if (ctx.alive() && fst(app).page) await press(app, 'stop', 0, NAV); },
};

export const fwDo = {
  async powerOn(app) {
    if (!app.fw || isOn(app)) return;
    if (fst(app).power === 'boot') { for (let i = 0; i < 40 && fst(app).power === 'boot'; i++) await wait(150); return; }
    await press(app, 'power', LONG, 300);
    for (let i = 0; i < 50 && fst(app).power === 'boot'; i++) await wait(150); // logo → autoteste (~4,6 s)
    if (!isOn(app)) app.fw.quickStart?.();
    await wait(500);
  },
  async menu(app, ctx, name, w = wait) { if (app.fw) await MENU_DO[name]?.(app, ctx, w); },
  exitMenu: menuExit,
  async startRec(app) {
    if (!app.fw) return;
    await fwDo.powerOn(app); await menuExit(app);
    if (fst(app).mode === 'pause' || !isRec(app)) await press(app, 'play', 0, 900); // ▶‖ inicia (ou retoma)
  },
  async stopRec(app) { if (!app.fw) return; if (isRec(app)) await press(app, 'stop', LONG, 1200); app.meter?.highlight?.(null); }, // ■ 2 s para e salva
  async cycleScreens(app, ctx, n = 2) { await menuExit(app); for (let i = 0; i < n; i++) { if (ctx && !ctx.alive()) return; await press(app, 'power', 0, 2600); } }, // ⏻ curto: Principal ↔ Mostradores
};

// ── câmera: aproximação de uma parte do aparelho (usa meter.parts quando existir; senão, offsets locais do aparelho) ──
// Coordenadas locais do aparelho (origem = centro da base do corpo, visor para +z): globo à esquerda, bulbo seco ao centro,
// bulbo úmido à direita, visor e teclas no corpo.
const LOCAL = { globe: [-0.075, 0.2, 0], dry: [0.0, 0.17, 0], wet: [0.07, 0.16, 0], reservoir: [0.07, 0.11, 0], screen: [-0.02, 0.045, 0.03],
  keys: [0.085, 0.045, 0.03], power: [0.085, 0.06, 0.03], all: [0, 0.13, 0], battery: [-0.02, 0.06, 0.03] };
const CAMOFF = { globe: [0.12, 0.1, 0.72], dry: [0.02, 0.08, 0.6], wet: [-0.06, 0.07, 0.58], reservoir: [-0.3, 0.26, 0.5], screen: [0.02, 0.06, 0.5],
  keys: [-0.06, 0.05, 0.5], power: [-0.06, 0.05, 0.5], battery: [0.02, 0.06, 0.48], all: [0.03, 0.16, 1.05] };
export function camPart(app, part, dur = 1.5) {
  const T = app.THREE, s = app.stage, m = app.meter;
  if (!T || !s?.flyTo || !m?.device) { app.setView?.('present', { animate: true, duration: dur }); return; }
  const d = m.device; d.updateWorldMatrix(true, true);
  const o = m.parts?.[part] ?? (part === 'globe' ? m.globeCenter : null);
  const p = new T.Vector3();
  // centro da caixa envolvente (as malhas podem ter a origem fora da peça); globeCenter já é o centro do globo
  if (o?.isObject3D) { const b = o === m.globeCenter ? null : new T.Box3().setFromObject(o); if (b && !b.isEmpty()) b.getCenter(p); else o.getWorldPosition(p); }
  else d.localToWorld(p.set(...(LOCAL[part] || LOCAL.all)));
  const q = d.getWorldQuaternion(new T.Quaternion());
  const off = new T.Vector3(...(CAMOFF[part] || CAMOFF.all)).applyQuaternion(q);
  const pos = p.clone().add(off);
  // o alvo fica um pouco abaixo da peça: ela aparece acima do centro da tela, livre da legenda e da barra inferior
  const tgt = p.clone(); tgt.y -= off.length() * 0.09;
  try { s.flyTo({ pos: pos.toArray(), target: tgt.toArray(), fov: 32, focus: p.toArray() }, dur); s.setFocus?.(p); } catch (e) { console.error('[demo] flyTo', e); }
}
/** chave da vista "Mesa" do ambiente ativo (app.env().views) */
export const mesaView = (app) => app.env?.()?.views?.find(([k]) => /mesa/.test(k))?.[0] || 'mesa';
export const overviewView = (app) => app.env?.()?.views?.[0]?.[0] || 'overview';
const ensurePresent = async (app) => { if (app.state.onTripod !== false) { app.setView?.('present', { animate: true, duration: 1.8 }); await app.present?.(1.5); } };

export const CHAPTERS = [
  { id: 'tudo', label: 'Apresentação completa', sub: 'Partes, requisitos, visor, menu, preparação e montagem' },
  { id: 'aparelho', label: '1. O aparelho e a NHO-06', sub: 'Globo, bulbo úmido natural, bulbo seco, faixas, calibração, tripé' },
  { id: 'visor', label: '2. Visor e teclas', sub: 'Ligar, telas, iniciar, pausar e parar a gravação' },
  { id: 'menu', label: '3. Menu e configuração', sub: 'Data e hora, intervalo de 1 minuto, unidade, memória, calibração' },
  { id: 'prep', label: '4. Preparação e montagem', sub: 'Integridade, bateria, certificado, pavio, água destilada, globo, tripé' },
];

export const STEPS = [
  // ───────── 1. O APARELHO (NHO-06 7.1) ─────────
  { chapter: 'aparelho', title: 'O medidor de IBUTG', highlight: null, cam: 'present',
    text: 'Este é o medidor de IBUTG, o índice de bulbo úmido termômetro de globo, usado pela NHO-06 para avaliar a exposição ao calor. Ele mede três temperaturas ao mesmo tempo: a de globo, a de bulbo úmido natural e a de bulbo seco. Em ambiente interno, como este setor, o IBUTG é 0,7 vezes o bulbo úmido natural mais 0,3 vezes o globo.',
    run: async (app) => { await ensurePresent(app); } },
  { chapter: 'aparelho', title: 'Termômetro de globo (NHO-06 7.1.1)', highlight: 'globe', cam: 'globe',
    text: 'À esquerda, o termômetro de globo: uma esfera oca de cobre, com cerca de 1 milímetro de espessura e 152,4 milímetros de diâmetro, pintada de preto fosco, com emissividade mínima de 0,95. O sensor fica no centro da esfera, vedado, sem troca de ar com o ambiente. O globo responde ao calor radiante das fontes e é o sensor mais lento: costuma levar mais de 20 minutos para estabilizar.' },
  { chapter: 'aparelho', title: 'Bulbo úmido natural (NHO-06 7.1.2)', highlight: 'wet', cam: 'wet',
    text: 'À direita, o bulbo úmido natural. O sensor, de 6 milímetros de diâmetro, é revestido por um pavio tubular branco de algodão, mantido úmido por capilaridade com água destilada do reservatório. O pavio cobre o sensor e mais duas vezes o seu comprimento, bem ajustado, nem folgado nem apertado. A ponta do sensor fica a 25 milímetros da borda do reservatório, num espaço livre para o ar circular. Natural quer dizer sem ventilação forçada.' },
  { chapter: 'aparelho', title: 'Bulbo seco (NHO-06 7.1.3)', highlight: 'dry', cam: 'dry',
    text: 'No centro, o bulbo seco mede a temperatura do ar. Ele fica dentro de um abrigo de pratos brancos, que barra a radiação das fontes de calor e deixa o ar circular. Pela NHO-06, o bulbo seco só entra no cálculo em ambiente externo com carga solar direta, mas o valor ajuda a escolher as medidas de controle.' },
  { chapter: 'aparelho', title: 'Faixas de medição e erro', highlight: 'all', cam: 'all',
    text: 'A norma exige, para cada sensor, erro de medição de no máximo mais ou menos 0,5 grau Celsius e leituras com resolução de 0,1 grau. As faixas mínimas são: globo, de 10 a 120 graus; bulbo úmido natural, de 10 a 50 graus; e bulbo seco, de 10 a 100 graus. O medidor só pode ser usado dentro das condições especificadas pelo fabricante.',
    run: async (app, { wait: w }) => { for (const k of ['globe', 'wet', 'dry']) { app.meter?.highlight?.(k); await w(2600); } app.meter?.highlight?.('all'); } },
  { chapter: 'aparelho', title: 'Calibração (NHO-06 7.1)', highlight: 'screen', cam: 'present',
    text: 'Os sensores devem ser calibrados periodicamente pelo Inmetro ou por laboratório acreditado por ele, com certificado de calibração. A periodicidade segue a recomendação do fabricante e o histórico de uso do aparelho, e a calibração deve ser refeita sempre que houver suspeita de dano. O número do certificado e a validade vão para o laudo.' },
  { chapter: 'aparelho', title: 'Acessórios (NHO-06 7.1.4)', highlight: 'tripod', cam: 'mesa',
    text: 'Os acessórios: um tripé telescópico, com regulagem de altura e pintado de preto fosco, como pede a norma; um cronômetro, para medir o tempo em cada situação térmica e em cada atividade; e, quando necessário, um cabo de extensão, para ler o aparelho à distância sem interferir na medição.' },
  // ───────── 2. VISOR E TECLAS ─────────
  { chapter: 'visor', title: 'Ligar o medidor', highlight: 'power', cam: 'screen',
    text: 'Para ligar, segure a tecla liga e desliga por 2 segundos. O aparelho faz um autoteste dos sensores, da memória, da bateria e da validade da calibração. A tela principal mostra a data, a hora e a carga da bateria; as três temperaturas, globo, seco e úmido; e o IBUTG interno e o externo, já calculados.',
    run: async (app) => { await ensurePresent(app); camPart(app, 'screen', 1.2); await fwDo.powerOn(app); } },
  { chapter: 'visor', title: 'Teclas: iniciar, pausar e parar', highlight: 'play', cam: 'keys',
    text: 'As teclas azuis ficam à direita do visor. A tecla play e pausa inicia a gravação, pausa e retoma. Para encerrar e salvar a sessão na memória, segure a tecla parar por 2 segundos. A tecla menu abre as configurações. Durante a gravação, o visor mostra o estado e o cronômetro da sessão.',
    run: async (app, { wait: w }) => { for (const k of ['power', 'play', 'stop', 'menu']) { app.meter?.highlight?.(k); await w(1700); } app.meter?.highlight?.(null); } },
  { chapter: 'visor', title: 'Telas de leitura', highlight: 'screen', cam: 'screen',
    text: 'Um toque curto na tecla liga e desliga alterna entre a tela principal, numérica, e a tela de mostradores circulares. Os mostradores facilitam acompanhar a subida do globo até a estabilização, que é a etapa mais demorada da medição.',
    run: async (app, ctx) => { await fwDo.powerOn(app); await fwDo.cycleScreens(app, ctx, 2); } },
  // ───────── 3. MENU E CONFIGURAÇÃO ─────────
  { chapter: 'menu', title: 'O menu de configurações', highlight: 'menu', cam: 'screen',
    text: 'A tecla menu abre as configurações: gravação, memória, data e hora, unidade, tela, brilho, desligamento automático e informações. A tecla play desce para o próximo item, a tecla menu entra e confirma, a tecla parar volta, e um toque na tecla liga e desliga sai do menu.',
    run: async (app, ctx) => { await fwDo.powerOn(app); await fwDo.exitMenu(app); await fwDo.menu(app, ctx, 'abrir', ctx.wait); } },
  { chapter: 'menu', title: 'Data e hora', highlight: 'menu', cam: 'screen',
    text: 'Confira a data e a hora. Elas ficam gravadas em cada sessão e vão para o laudo, que deve informar as datas e os horários de início e de fim de cada medição.',
    run: async (app, ctx) => { await fwDo.menu(app, ctx, 'dataHora', ctx.wait); } },
  { chapter: 'menu', title: 'Intervalo de gravação: 1 minuto', highlight: 'menu', cam: 'screen',
    text: 'Em gravação, intervalo de registro, as opções são 10 segundos, 30 segundos, 1 minuto e 5 minutos. Escolhemos 1 minuto: a NHO-06 manda repetir as leituras a cada minuto até a estabilização, atingida quando pelo menos cinco leituras seguidas ficam dentro de um intervalo de 0,4 grau.',
    run: async (app, ctx) => { await fwDo.menu(app, ctx, 'gravacao', ctx.wait); } },
  { chapter: 'menu', title: 'Unidade e memória', highlight: 'menu', cam: 'screen',
    text: 'A unidade fica em graus Celsius. Em memória ficam as sessões gravadas, com as leituras de cada minuto, que depois são transferidas pelo cabo USB para a planilha e para o laudo.',
    run: async (app, ctx) => { await fwDo.menu(app, ctx, 'unidade', ctx.wait); await fwDo.menu(app, ctx, 'memoria', ctx.wait); } },
  { chapter: 'menu', title: 'Informações e calibração', highlight: 'menu', cam: 'screen',
    text: 'Em informações, a primeira página traz o modelo, o número de série, o firmware e as faixas dos sensores. A segunda traz o certificado de calibração, a data, a validade e o laboratório acreditado. Confira antes de sair a campo: esses dados vão para o laudo. Depois, saímos do menu.',
    run: async (app, ctx) => { await fwDo.menu(app, ctx, 'info', ctx.wait); await fwDo.exitMenu(app); } },
  // ───────── 4. PREPARAÇÃO E MONTAGEM (NHO-06 8.1 a) ─────────
  { chapter: 'prep', phase: 'montagem', title: 'Conferir o equipamento (NHO-06 8.1)', highlight: 'battery', cam: 'present',
    text: 'Antes de medir, confira: a integridade física do aparelho e a coerência das leituras; a carga da bateria, suficiente para todo o tempo de medição; e se a calibração está válida, pelo certificado. Dados obtidos com aparelho danificado, fora de calibração ou com bateria insuficiente devem ser invalidados.',
    run: async (app) => { await ensurePresent(app); await fwDo.powerOn(app); } },
  { chapter: 'prep', phase: 'montagem', title: 'Trocar o pavio', highlight: 'wet', cam: 'wet',
    text: 'O pavio acumula poeira e resíduos do ambiente, que atrapalham a evaporação. Por isso, no início de cada medição, ele é trocado por um pavio novo e limpo. Confira a capilaridade: ele deve umedecer rapidamente ao tocar a água.',
    run: async (app, { wait: w }) => { app.setWick?.('sujo'); await w(1400); await Promise.race([Promise.resolve(app.meter?.animate?.('wick')), w(6000)]); app.setWick?.('limpo'); } },
  { chapter: 'prep', phase: 'montagem', title: 'Encher o reservatório com água destilada', highlight: 'reservoir', cam: 'reservoir',
    text: 'Com a pisseta, encha o reservatório com água destilada, em volume suficiente para manter o pavio úmido durante toda a medição. Sem água, o pavio seca e o bulbo úmido passa a indicar uma temperatura errada.',
    run: async (app, { wait: w }) => { app.setWater?.(0.15); await w(900); await Promise.race([Promise.resolve(app.meter?.animate?.('fill')), w(6000)]); app.setWater?.(1); } },
  { chapter: 'prep', phase: 'montagem', title: 'Rosquear o globo', highlight: 'globe', cam: 'globe',
    text: 'O globo é rosqueado na haste até encostar, sem forçar, para que o sensor fique exatamente no centro da esfera e o conjunto permaneça vedado.',
    run: async (app, { wait: w }) => { await Promise.race([Promise.resolve(app.meter?.animate?.('globe')), w(6000)]); } },
  { chapter: 'prep', phase: 'montagem', title: 'Montar no tripé (NHO-06 7.2)', highlight: 'tripod', cam: 'mesa',
    text: 'O aparelho é preso na cabeça do tripé preto fosco. A norma pede que os sensores fiquem todos alinhados num mesmo plano horizontal, próximos uns dos outros, sem se tocarem.',
    run: async (app, { wait: w }) => { app.setView?.(mesaView(app), { animate: true, duration: 1.6 }); await app.mountOnTripod?.(1.6); await Promise.race([Promise.resolve(app.meter?.animate?.('mount')), w(5000)]); } },
  { chapter: 'prep', phase: 'montagem', title: 'Pronto para o posto de trabalho', highlight: null, cam: 'mesa',
    text: 'O medidor está ligado, com pavio novo, reservatório cheio e calibração conferida. Agora ele vai para o primeiro ponto de medição.',
    run: async (app) => { if (app.state.onTripod === false) await app.mountOnTripod?.(1.2); await fwDo.powerOn(app); } },
];

/** Legendas narradas fora da apresentação (posicionar, medir, cronometrar, resultado). */
export const CAPTIONS = {
  inicio: { title: 'Avaliação de calor na sala de fornos', text: 'Bem-vindo à sala de fornos de uma panificação industrial. A forneira alterna entre a carga dos fornos, a bancada de modelagem e a pausa para hidratação. Explore o setor e, quando quiser, abra o medidor de IBUTG para começar a avaliação pela NHO-06 e pelo Anexo 3 da NR-15.' },
  posicionar: { title: 'Posicionar o medidor (NHO-06 7.2)', text: 'Agora escolha a situação térmica. O medidor deve ficar onde a trabalhadora fica, na altura da região mais atingida do corpo, ou na altura do tórax quando ela não estiver definida.' },
  informar: { title: 'Informar a trabalhadora (NHO-06 8.1)', text: 'Antes de medir, o avaliador informa a trabalhadora: ela deve manter a rotina normal de trabalho; o medidor não pode ser tocado nem obstruído; e só o avaliador pode retirá-lo.' },
  S1: { title: 'Situação 1: frente ao forno turbo', text: 'Situação 1: frente ao forno turbo, na carga e descarga com a porta aberta. O tripé fica ao lado da forneira, com os sensores a 1,30 metro, na altura do tórax. Como há uma fonte principal de calor, a normal ao plano vertical dos sensores aponta para a porta do forno, e o visor fica na face oposta. Nada, nem a própria trabalhadora, pode ficar entre o forno e os sensores.' },
  S2: { title: 'Situação 2: bancada de modelagem', text: 'Situação 2: bancada de modelagem, a cerca de 3 metros dos fornos. O tripé fica ao lado da forneira, sem atrapalhar o trabalho, com os sensores a 1,30 metro, na altura do tórax de quem trabalha em pé, e o visor no lado oposto ao dos fornos.' },
  S3: { title: 'Situação 3: área de descanso', text: 'Situação 3: área de descanso e hidratação, ventilada e afastada dos fornos. Aqui a forneira fica sentada, então a altura do tórax é menor: os sensores ficam a 0,95 metro do piso.' },
  simulacao: { title: 'Simulação da porta aberta (NHO-06 8.2)', text: 'A porta do forno fica aberta só cerca de 4 minutos em cada carga, menos do que o globo precisa para estabilizar. A NHO-06 prevê a simulação: estender a condição de curta duração, mantendo a porta aberta, até a estabilização e as leituras. Vamos manter a porta do forno 1 aberta.' },
  iniciar: { title: 'Iniciar a gravação', text: 'Iniciamos a gravação com a tecla play. A cada minuto registramos na planilha de campo o globo, o bulbo úmido natural e o bulbo seco. O tempo está acelerado: acompanhe a subida das temperaturas.' },
  estabilizou: { title: 'Estabilização atingida (NHO-06 8.2)', text: 'Estabilizou: cinco leituras seguidas ficaram dentro de um intervalo de 0,4 grau nos três sensores. Os valores atribuídos à situação são as médias dessas cinco leituras.' },
  fimSim: { title: 'Fim da simulação', text: 'Paramos a gravação e fechamos a porta do forno: a simulação da porta aberta terminou. A forneira volta ao ciclo normal de trabalho.' },
  continuo: { title: 'Fonte contínua: sem simulação', text: 'Aqui as fontes de calor são contínuas: o tampo da caldeira, o coletor de vapor sem isolamento e o vapor que escapa ficam assim durante toda a operação. Não há condição de curta duração, então não é preciso simulação: basta aguardar a estabilização no próprio ponto.' },
  'caldeiras:inicio': { title: 'Avaliação de calor na casa de caldeiras', text: 'Bem-vindo à casa de caldeiras. A operadora faz rondas de 30 minutos: fica na frente da caldeira lendo o nível e os manômetros, vai ao distribuidor de vapor para manobrar válvulas e purgas, e registra os dados na sala de controle. Explore o setor e, quando quiser, abra o medidor de IBUTG para começar a avaliação.' },
  'caldeiras:S1': { title: 'Situação 1: frente da caldeira', text: 'Situação 1: frente da caldeira 1, onde a operadora lê o visor de nível e os manômetros e ajusta o queimador. O tripé fica ao lado dela, com os sensores a 1,30 metro, na altura do tórax. A normal ao plano vertical dos sensores aponta para o tampo frontal quente da caldeira, e o visor fica na face oposta.' },
  'caldeiras:S2': { title: 'Situação 2: distribuidor de vapor', text: 'Situação 2: distribuidor de vapor, onde a operadora abre e fecha válvulas e faz as purgas. O coletor não tem isolamento e há vapor escapando na gaxeta: calor radiante e umidade alta. Os sensores ficam a 1,30 metro, voltados para o coletor, sem obstruir a manobra.' },
  'caldeiras:S3': { title: 'Situação 3: sala de controle', text: 'Situação 3: sala de controle, envidraçada e climatizada, onde a operadora registra os dados sentada. A altura do tórax de quem está sentado é menor: os sensores ficam a 0,95 metro do piso.' },
  'caldeiras:crono': { title: 'Cronometragem (NHO-06 8.2)', text: 'O tempo em cada situação e em cada atividade é a média de pelo menos três cronometragens. Na hora de pico, das 7 às 8 horas, a operadora faz duas rondas: em cada uma, 15 minutos na frente da caldeira, cerca de 10 no distribuidor de vapor e 5 na sala de controle.' },
  todas: { title: 'Situações medidas', text: 'As três situações térmicas foram medidas. Agora vamos cronometrar o ciclo de trabalho e atribuir a taxa metabólica de cada atividade.' },
  crono: { title: 'Cronometragem (NHO-06 8.2)', text: 'O tempo em cada situação térmica e em cada atividade é a média de pelo menos três cronometragens, observando a trabalhadora no seu trabalho. Na hora de pico, das 6 às 7 horas, são 6 cargas de 4 minutos em frente ao forno, uma pausa de 6 minutos e o restante na bancada.' },
  taxaM: { title: 'Taxa metabólica (Quadro 2 da NR-15)', text: 'Agora atribua a taxa metabólica de cada atividade, comparando com o Quadro 2 do Anexo 3 da NR-15, que é igual ao Quadro 1 da NHO-06. Se a atividade não estiver no quadro, use a atividade mais parecida.' },
  vest: { title: 'Vestimenta e aclimatização', text: 'O uniforme tradicional, de calça e camisa de manga longa, não tem ajuste. Vestimentas que dificultam a troca de calor, como o avental impermeável, somam graus ao IBUTG médio, e o capuz soma mais 1 grau. Trabalhadores não aclimatizados usam o limite da Tabela 1.' },
};
