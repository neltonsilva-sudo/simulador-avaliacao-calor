// Narração (voz pt-BR-FranciscaNeural gravada em assets/voz/<fnv1a(texto)>.mp3 por tools/gen_tts.py) — dono: UI/DEMO.
// Sem o arquivo (texto novo/alterado ou rede indisponível na geração) cai na síntese de voz do navegador (pt-BR).
// Pronúncia só na fala: NHO → "ene agá ó", IBUTG → "i bê u tê gê", NR-15 → "ene erre quinze" (a legenda não muda).
export const spoken = (t) => t
  .replace(/\bNHO[- ]?0?6\b/g, 'ene agá ó zero seis').replace(/\bNHO\b/g, 'ene agá ó')
  .replace(/\bIBUTG\b/g, 'i bê u tê gê').replace(/\bNR-15\b/g, 'ene erre quinze').replace(/\bUSB\b/g, 'u esse bê');

export function createVoice(app) {
  let voiceOn = true, voice = null, vozMap = null, curAudio = null, synthPaused = false;
  const pickVoice = () => { try { const vs = speechSynthesis.getVoices() || [];
    voice = vs.find((v) => /francisca/i.test(v.name) && /natural|online/i.test(v.name)) || vs.find((v) => /francisca/i.test(v.name)) || vs.find((v) => /luciana/i.test(v.name))
      || vs.find((v) => /^pt(-|_)BR/i.test(v.lang)) || vs.find((v) => /^pt/i.test(v.lang)) || null; } catch {} };
  try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch {}
  fetch('assets/voz/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((m) => (vozMap = m)).catch(() => {});
  const fnv = (str) => { let x = 0x811c9dc5; for (const b of new TextEncoder().encode(str)) x = Math.imul(x ^ b, 0x01000193) >>> 0; return x.toString(16).padStart(8, '0'); };
  const vol = () => (app.audio?.muted ? 0 : app.audio?.volume ?? 0.8);
  const duck = (b) => app.audio?.duck?.(b);
  function stop() { duck(false); synthPaused = false; try { speechSynthesis.cancel(); } catch {} if (curAudio) { try { curAudio.pause(); } catch {} curAudio = null; } }
  function pause() {
    if (curAudio && !curAudio.paused && !curAudio.ended) { try { curAudio.pause(); } catch {} return true; }
    try { if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); synthPaused = true; duck(false); return true; } } catch {}
    return false;
  }
  function resume() {
    return new Promise((res) => {
      const a = curAudio;
      if (a && a.paused && !a.ended) {
        let done = false; const fin = () => { if (!done) { done = true; res(true); } };
        a.addEventListener('ended', fin, { once: true }); a.addEventListener('error', fin, { once: true });
        setTimeout(fin, ((isFinite(a.duration) ? a.duration - a.currentTime : 20) + 2) * 1000); a.play().catch(fin); return;
      }
      if (synthPaused) {
        synthPaused = false; duck(true); try { speechSynthesis.resume(); } catch {}
        const t0 = performance.now();
        const poll = () => { let sp = false; try { sp = speechSynthesis.speaking; } catch {} if (!sp || performance.now() - t0 > 30000) { duck(false); res(true); } else setTimeout(poll, 250); };
        return void setTimeout(poll, 300);
      }
      res(false);
    });
  }
  /** Fala o texto (legenda); resolve ao terminar (ou por tempo estimado se não houver voz). */
  function say(text) {
    return new Promise((res) => {
      stop();
      const clean = String(text).replace(/<[^>]+>/g, '');
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      if (window.__uiFast) return void setTimeout(fin, 150); // teste headless: legendas sem esperar a fala
      const est = 1500 + clean.length * 62; // ~ ritmo da voz Francisca
      const synth = () => {
        if (!voiceOn || !window.speechSynthesis || vol() === 0) return void setTimeout(fin, voiceOn ? est : Math.min(9000, 1200 + clean.length * 40));
        try {
          const u = new SpeechSynthesisUtterance(spoken(clean)); u.lang = 'pt-BR'; if (voice) u.voice = voice; u.rate = 1.04; u.volume = Math.min(1, vol() * 1.2);
          // se a síntese falhar ou terminar cedo demais (sem voz instalada), a legenda fica o tempo de leitura
          const t0 = performance.now(), later = () => { duck(false); const left = est * 0.8 - (performance.now() - t0); if (left > 0) setTimeout(fin, left); else fin(); };
          u.onstart = () => duck(true); u.onend = later; u.onerror = later;
          setTimeout(fin, 3000 + clean.length * 95); speechSynthesis.speak(u);
        } catch { setTimeout(fin, est); }
      };
      const file = vozMap?.[fnv(clean)];
      if (voiceOn && file && vol() > 0) {
        const a = new Audio('assets/voz/' + file); curAudio = a; a.preload = 'auto'; a.volume = Math.min(1, vol() * 1.2);
        a.onended = fin; a.onerror = () => { if (curAudio === a) { curAudio = null; synth(); } };
        a.addEventListener('playing', () => { if (curAudio === a) duck(true); }); a.addEventListener('pause', () => { if (curAudio === a) duck(false); });
        a.addEventListener('ended', () => duck(false));
        setTimeout(fin, 5000 + clean.length * 110);
        a.play().catch(() => { if (curAudio === a) { curAudio = null; synth(); } });
        return;
      }
      synth();
    });
  }
  return {
    say, stop, pause, resume,
    get on() { return voiceOn; }, set on(b) { voiceOn = !!b; if (!voiceOn) stop(); },
    get recorded() { return !!vozMap; },
    name: () => (vozMap ? 'Francisca (gravada)' : voice ? voice.name.replace(/^Microsoft\s+/i, '').replace(/\s*-.*$/, '') : 'voz do sistema'),
    applyVolume() { if (curAudio) curAudio.volume = Math.min(1, vol() * 1.2); },
  };
}
