/* ============================================================
   questionario.js — questionário de percepção (só cliques)
   As perguntas ficam em assets/js/config.js (QUESTIONARIO).
   ============================================================ */
const Quiz = (() => {
  const KEY = "questionario-enviado-v1";
  const LIKERT = [
    { v: 1, e: "😣", t: "Discordo totalmente" },
    { v: 2, e: "🙁", t: "Discordo" },
    { v: 3, e: "😐", t: "Neutro" },
    { v: 4, e: "🙂", t: "Concordo" },
    { v: 5, e: "🤩", t: "Concordo totalmente" }
  ];
  let R = {}, started = false;
  const Q = QUESTIONARIO;
  const body = () => document.getElementById("quiz-body");
  const obrigatorias = () => [Q.perfil.id, Q.conhecimento.antes.id, Q.conhecimento.depois.id, ...Q.likert.map(q => q.id), Q.nota.id];

  function init(){
    if (started) return;
    started = true;
    let enviado = null;
    try { enviado = localStorage.getItem(KEY); } catch(e){}
    enviado ? renderObrigado(true) : render();
  }

  function chips(id, opcoes){
    return `<div class="chips" data-q="${id}">${opcoes.map(o => `<button class="chip" data-v="${esc(o)}">${esc(o)}</button>`).join("")}</div>`;
  }

  function render(){
    R = {};
    let n = 0;
    const bloco = (titulo, inner, id) => `<div class="q" id="q-${id}"><div class="q-title"><span class="n">${String(++n).padStart(2, "0")}</span><span>${titulo}</span></div>${inner}</div>`;
    let html = API.ativo() ? "" : `<div class="notice">⚠️ <b>Modo demonstração:</b> configure a URL do Apps Script em <span class="mono">assets/js/config.js</span> para gravar as respostas.</div>`;
    html += `<div class="quiz-progress"><span id="quiz-bar"></span></div><div class="card">`;
    html += `<p class="eyebrow" style="margin-bottom:6px">Sobre você</p>`;
    html += bloco(Q.perfil.texto, chips(Q.perfil.id, Q.perfil.opcoes), Q.perfil.id);
    html += bloco(Q.conhecimento.antes.texto, chips(Q.conhecimento.antes.id, Q.conhecimento.opcoes), Q.conhecimento.antes.id);
    html += bloco(Q.conhecimento.depois.texto, chips(Q.conhecimento.depois.id, Q.conhecimento.opcoes), Q.conhecimento.depois.id);
    html += `</div>`;

    // agrupa as perguntas Likert por dimensão
    const dims = [...new Set(Q.likert.map(q => q.dim))];
    dims.forEach(d => {
      html += `<div class="card"><p class="eyebrow" style="margin-bottom:6px">${esc(d)}</p>`;
      Q.likert.filter(q => q.dim === d).forEach(q => {
        html += bloco(esc(q.texto), `<div class="likert" data-q="${q.id}">${LIKERT.map(l =>
          `<button data-v="${l.v}" aria-label="${l.t}"><span class="e">${l.e}</span>${l.t}</button>`).join("")}</div>`, q.id);
      });
      html += `</div>`;
    });

    html += `<div class="card">`;
    html += bloco(esc(Q.nota.texto), `<div class="scale10" data-q="${Q.nota.id}">${Array.from({ length: 11 }, (_, i) => `<button data-v="${i}">${i}</button>`).join("")}</div>`, Q.nota.id);
    html += bloco(esc(Q.comentario.texto), `<textarea class="input" id="quiz-coment" maxlength="1000" placeholder="Escreva aqui…"></textarea>`, Q.comentario.id);
    html += `<div class="msg" id="quiz-msg"></div>
      <button class="btn btn-primary" id="quiz-enviar" style="width:100%; margin-top:8px">Enviar respostas ✓</button></div>`;
    body().innerHTML = html;

    body().querySelectorAll("[data-q]").forEach(g => {
      g.querySelectorAll("button").forEach(b => b.onclick = () => {
        g.querySelectorAll("button").forEach(x => x.classList.toggle("sel", x === b));
        const v = b.dataset.v;
        R[g.dataset.q] = /^\d+$/.test(v) ? Number(v) : v;
        document.getElementById("q-" + g.dataset.q)?.classList.remove("missing");
        progresso();
      });
    });
    document.getElementById("quiz-enviar").onclick = enviar;
    progresso();
  }

  function progresso(){
    const ob = obrigatorias();
    const feitas = ob.filter(id => R[id] !== undefined).length;
    document.getElementById("quiz-bar").style.width = (feitas / ob.length * 100) + "%";
  }

  async function enviar(){
    const msg = document.getElementById("quiz-msg");
    const faltando = obrigatorias().filter(id => R[id] === undefined);
    if (faltando.length){
      faltando.forEach(id => document.getElementById("q-" + id)?.classList.add("missing"));
      msg.className = "msg warn";
      msg.textContent = `Falta${faltando.length > 1 ? "m" : ""} ${faltando.length} pergunta${faltando.length > 1 ? "s" : ""} (destacada${faltando.length > 1 ? "s" : ""} em amarelo).`;
      document.getElementById("q-" + faltando[0])?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const respostas = { ...R, [Q.comentario.id]: document.getElementById("quiz-coment").value.trim() };
    const btn = document.getElementById("quiz-enviar");
    btn.disabled = true; btn.textContent = "Enviando…";
    if (!API.ativo()){
      try { localStorage.setItem(KEY, new Date().toISOString()); } catch(e){}
      return renderObrigado(false, true);
    }
    try {
      const r = await API.post({ tipo: "questionario", dataHora: new Date().toLocaleString("pt-BR"), respostas });
      if (r.status !== "ok") throw new Error(r.message || "erro");
      try { localStorage.setItem(KEY, new Date().toISOString()); } catch(e){}
      renderObrigado(false);
    } catch(e){
      btn.disabled = false; btn.textContent = "Enviar respostas ✓";
      msg.className = "msg err"; msg.textContent = "Não foi possível enviar agora. Verifique a internet e tente de novo.";
    }
  }

  function renderObrigado(jaEnviado, demo){
    body().innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:3rem">💙</div>
        <p class="reveal-title">${jaEnviado ? "Você já respondeu ao questionário." : "Respostas enviadas. Muito obrigado!"}</p>
        <p class="muted" style="margin-top:8px">${demo ? "(Modo demonstração: nada foi gravado.)" : "Sua opinião ajuda a melhorar os próximos minicursos."}</p>
        <div class="row" style="justify-content:center; margin-top:18px">
          <a class="btn btn-primary" href="#analise">📊 Ver análise dos dados</a>
          <button class="btn btn-ghost" id="quiz-outro">Outra pessoa vai responder neste aparelho</button>
        </div>
      </div>`;
    if (!jaEnviado) confetti(60);
    document.getElementById("quiz-outro").onclick = () => { try { localStorage.removeItem(KEY); } catch(e){} render(); window.scrollTo(0, 0); };
  }

  return { init };
})();
window.Quiz = Quiz;
