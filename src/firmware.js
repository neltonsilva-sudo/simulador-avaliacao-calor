// Firmware do medidor de IBUTG "iTemp" — dono: FIRMWARE. API (docs/CONTRACT.md): createFirmware({app, getInput}) →
// {canvas (640×480), dirty, state, press(key, holdMs), update(dtReal), feed(read, dtSim, clock), setClock(sec), quickStart(),
//  results(), on(ev, fn)}. Lógica pura em fw_core.js (teste: node tools/fw_test.mjs); visor vetorial em lcd.js.
// Navegação das teclas/menu: docs/FIRMWARE.md. Extras: drawHi(ctx, scale) (visor em alta resolução para a UI),
// backlight() (0..1, para o emissivo do visor 3D), core, device.
import { createCore, DEVICE, LONG_MS, MENUS, PAGES } from './fw_core.js';
import { createLCD } from './lcd.js';

export function createFirmware({ app, getInput } = {}) {
  // o aparelho também sabe se o globo está rosqueado (autoteste / "---.-"); o pavio seco NÃO é detectado
  const input = () => { const i = getInput?.() || {}; return { ...i, globeOn: app?.state?.globeOn !== false }; };
  const core = createCore({ getInput: input });
  const lcd = createLCD();
  let drawnRev = -1, sinceDraw = 1;
  const fw = {
    canvas: lcd.canvas, dirty: true, state: core.state, core, device: DEVICE, LONG_MS, MENUS, PAGES,
    press(key, holdMs = 0) { core.press(key, holdMs); redraw(); },
    update(dt) {
      core.update(dt); sinceDraw += dt || 0;
      const p = core.state.power;
      const fps = p === 'boot' || p === 'shutdown' ? 30 : 12;
      if (core.state.rev !== drawnRev && sinceDraw >= 1 / fps) redraw();
    },
    feed: (read, dt, clock) => core.feed(read, dt, clock),
    setClock: (sec) => core.setClock(sec),
    quickStart() { core.quickStart(); redraw(); },
    results: () => core.results(),
    on: (ev, fn) => core.on(ev, fn),
    drawHi: (ctx, scale) => lcd.drawTo(ctx, scale, core.state, core),
    backlight: () => lcd.backlight,
  };
  function redraw() { lcd.draw(core.state, core); drawnRev = core.state.rev; sinceDraw = 0; fw.dirty = true; }
  lcd.onFonts = () => redraw();
  core.on('change', () => app?.emit?.('change'));
  if (app?.state?.clock != null) core.setClock(app.state.clock);
  redraw();
  return fw;
}
