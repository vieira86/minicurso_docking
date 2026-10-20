/* ============================================================
   slides.js — apresentação "estilo vídeo"
   Cada clique revela o próximo elemento .frag do slide; quando
   não há mais nada para revelar, passa para o próximo slide.
   Teclas: → / espaço / PageDown avançam · ← / PageUp voltam
           F = tela cheia · P = reproduzir/pausar
   ============================================================ */
const Deck = (() => {
  let slides = [], idx = 0, step = 0, timer = null;
  const AUTO_FRAG_MS = 2600, AUTO_SLIDE_MS = 4200;

  const frags = s => Array.from(s.querySelectorAll(".frag"));

  function render(){
    slides.forEach((s, i) => {
      s.classList.toggle("active", i === idx);
      frags(s).forEach((f, j) => f.classList.toggle("in", i < idx || (i === idx && j < step)));
    });
    const total = slides.length;
    const fr = frags(slides[idx]).length;
    const within = fr ? step / fr : 1;
    document.getElementById("deck-progress").style.width = (((idx + within) / total) * 100) + "%";
    document.getElementById("deck-count").textContent = `${idx + 1} / ${total}`;
    document.getElementById("btn-prev").disabled = idx === 0 && step === 0;
    document.getElementById("btn-next").disabled = idx === total - 1 && step >= fr;
    try { localStorage.setItem("deck-pos", JSON.stringify([idx, step])); } catch(e){}
  }

  function next(){
    const fr = frags(slides[idx]).length;
    if (step < fr){ step++; }
    else if (idx < slides.length - 1){ idx++; step = 0; }
    else { stopAutoplay(); return false; }
    render(); return true;
  }
  function prev(){
    if (step > 0){ step--; }
    else if (idx > 0){ idx--; step = frags(slides[idx]).length; }
    render();
  }
  function go(i, s = 0){ idx = Math.max(0, Math.min(slides.length - 1, i)); step = s; render(); }

  function scheduleAuto(){
    clearTimeout(timer);
    const fr = frags(slides[idx]).length;
    const delay = step < fr ? AUTO_FRAG_MS : AUTO_SLIDE_MS;
    timer = setTimeout(() => { if (next()) scheduleAuto(); }, delay);
  }
  function startAutoplay(){
    document.getElementById("btn-play").innerHTML = '<span class="autoplay-ring"></span> Pausar';
    document.getElementById("btn-play").dataset.on = "1";
    scheduleAuto();
  }
  function stopAutoplay(){
    clearTimeout(timer); timer = null;
    const b = document.getElementById("btn-play");
    if (b){ b.textContent = "▶ Reproduzir"; b.dataset.on = ""; }
  }
  function toggleAutoplay(){ document.getElementById("btn-play").dataset.on ? stopAutoplay() : startAutoplay(); }

  function fullscreen(){
    const d = document.getElementById("deck");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (d.requestFullscreen) d.requestFullscreen();
  }

  function init(){
    const deck = document.getElementById("deck");
    slides = Array.from(deck.querySelectorAll(".slide"));
    try {
      const saved = JSON.parse(localStorage.getItem("deck-pos") || "null");
      if (Array.isArray(saved)){ idx = Math.min(saved[0], slides.length - 1); step = saved[1] || 0; }
    } catch(e){}

    deck.addEventListener("click", e => {
      if (e.target.closest("[data-noadvance], a, button")) return;
      const r = deck.getBoundingClientRect();
      // clique no quarto esquerdo volta; no resto avança
      (e.clientX - r.left < r.width * 0.22) ? prev() : next();
      if (timer) scheduleAuto();
      document.getElementById("deck-hint").style.opacity = 0;
    });
    document.getElementById("btn-next").onclick = () => { next(); if (timer) scheduleAuto(); };
    document.getElementById("btn-prev").onclick = () => { prev(); if (timer) scheduleAuto(); };
    document.getElementById("btn-play").onclick = toggleAutoplay;
    document.getElementById("btn-restart").onclick = () => { go(0); };
    document.getElementById("btn-full").onclick = fullscreen;

    document.addEventListener("keydown", e => {
      if (!document.getElementById("view-apresentacao").classList.contains("active")) return;
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)){ e.preventDefault(); next(); if (timer) scheduleAuto(); }
      else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)){ e.preventDefault(); prev(); if (timer) scheduleAuto(); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
      else if (e.key.toLowerCase() === "f") fullscreen();
      else if (e.key.toLowerCase() === "p") toggleAutoplay();
    });
    // swipe no celular
    let x0 = null;
    deck.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    deck.addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50){ dx < 0 ? next() : prev(); }
    });
    // links dentro dos slides saem da tela cheia antes de navegar
    deck.querySelectorAll("a[href^='#']").forEach(a => a.addEventListener("click", () => {
      if (document.fullscreenElement) document.exitFullscreen();
    }));
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
  return { next, prev, go, stopAutoplay };
})();
window.Deck = Deck;
