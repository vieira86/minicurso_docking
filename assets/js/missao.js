/* ============================================================
   missao.js — "Missão Molecular"
   Fluxo (cada etapa só abre depois que a anterior é resolvida):
     0) Nome + turma → SORTEIO (feito no Apps Script, sem repetição)
     1) SMILES da molécula sorteada (conferido com RDKit.js)
     2) Propriedades: massa molar, doadores de H, Lipinski
     3) Resultado do ArboMol (com checagem de coerência)
     4) Resultado do Dynamic Dock
     5) Interpretação + conclusão → registro na planilha
   O progresso fica salvo no navegador (se a página recarregar,
   o aluno continua de onde parou).
   ============================================================ */
const Missao = (() => {
  const KEY = "missao-molecular-v1";
  const ETAPAS = [
    { n: 1, ico: "✍️", nome: "SMILES" },
    { n: 2, ico: "⚖️", nome: "Propriedades" },
    { n: 3, ico: "🦟", nome: "ArboMol" },
    { n: 4, ico: "🎯", nome: "Dynamic Dock" },
    { n: 5, ico: "🧠", nome: "Conclusão" }
  ];
  let S = null;          // estado da missão
  let started = false;
  let RD = null;         // módulo RDKit
  let alvoProps = null;  // descritores da molécula sorteada

  const body = () => document.getElementById("mission-body");
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch(e){ return null; } };
  const mol = () => MOLECULAS[S.indice];
  // nome da molécula; se o professor ainda não preencheu, usa "Molécula nº NN"
  const nomeMol = () => (mol().nome || "").trim() || ("Molécula nº " + num2(S.indice));
  const num2 = i => String(i + 1).padStart(2, "0");
  const br = (x, d) => Number(x).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const VER = { provavel: "Provável", possivel: "Possível", improvavel: "Improvável" };
  const parseNum = v => { const x = parseFloat(String(v).replace(",", ".").trim()); return isNaN(x) ? null : x; };

  function novoEstado(nome, turma){
    return { nome, turma, indice: null, etapa: 1, inicio: Date.now(),
      erros: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, dados: {}, concluida: false, posicao: null };
  }

  /* ---------- RDKit ---------- */
  async function rdkit(){
    if (RD) return RD;
    try { RD = await getRDKit(); } catch(e){ RD = null; }
    return RD;
  }
  const semEstereo = smi => String(smi).replace(/[\/\\]/g, "").replace(/@+/g, "");
  function canon(smi){
    if (!RD || !smi) return null;
    let m = null;
    try {
      m = RD.get_mol(semEstereo(smi));
      if (!m || !m.is_valid()) return null;
      return m.get_smiles();
    } catch(e){ return null; } finally { if (m) m.delete(); }
  }
  function descritores(smi){
    if (!RD || !smi) return null;
    let m = null;
    try {
      m = RD.get_mol(smi);
      if (!m || !m.is_valid()) return null;
      const d = JSON.parse(m.get_descriptors());
      return {
        mw: d.amw, logp: d.CrippenClogP,
        hbd: d.lipinskiHBD ?? d.NumHBD, hba: d.lipinskiHBA ?? d.NumHBA,
        pesados: d.NumHeavyAtoms, aneis: d.NumRings, rotaveis: d.NumRotatableBonds
      };
    } catch(e){ return null; } finally { if (m) m.delete(); }
  }
  function svg(smi, w = 360, h = 260){
    if (!RD || !smi) return "";
    let m = null;
    try {
      m = RD.get_mol(smi);
      if (!m || !m.is_valid()) return "";
      return m.get_svg_with_highlights(JSON.stringify({ width: w, height: h, bondLineWidth: 1.6, addStereoAnnotation: false, clearBackground: true }));
    } catch(e){ return ""; } finally { if (m) m.delete(); }
  }
  const violacoes = p => [p.mw > 500, p.logp > 5, p.hbd > 5, p.hba > 10].filter(Boolean).length;

  /* ---------- entrada ---------- */
  function init(){
    if (started) return;
    started = true;
    rdkit(); // já começa a baixar o RDKit em segundo plano
    const saved = load();
    if (saved && saved.indice !== null && saved.indice !== undefined && MOLECULAS[saved.indice]){
      renderRetomar(saved);
    } else {
      renderGate();
    }
  }

  function aviso(){
    return API.ativo() ? "" : `<div class="notice">⚠️ <b>Modo demonstração:</b> a URL do Apps Script ainda não foi configurada em
      <span class="mono">assets/js/config.js</span>. O sorteio acontece só neste navegador (pode repetir entre alunos) e nada é gravado na planilha.</div>`;
  }

  function renderRetomar(saved){
    body().innerHTML = aviso() + `
      <div class="card" style="text-align:center">
        <h3>Bem-vindo(a) de volta, ${esc(saved.nome)}!</h3>
        <p class="muted">Você já tem uma missão ${saved.concluida ? "concluída" : "em andamento"} neste navegador (molécula nº ${num2(saved.indice)}).</p>
        <div class="row" style="justify-content:center; margin-top:18px">
          <button class="btn btn-primary" id="m-continuar">${saved.concluida ? "Ver meu resultado" : "Continuar missão →"}</button>
          <button class="btn btn-ghost" id="m-outra">Sou outra pessoa</button>
        </div>
      </div>`;
    document.getElementById("m-continuar").onclick = () => { S = saved; saved.concluida ? renderFinal() : renderMissao(); };
    document.getElementById("m-outra").onclick = () => {
      try { localStorage.removeItem(KEY); } catch(e){}
      renderGate();
    };
  }

  function renderGate(){
    body().innerHTML = aviso() + `
      <div class="card">
        <h3>🎲 Antes de começar</h3>
        <p class="muted">Digite seu nome e sua turma. Em seguida, sorteie a sua molécula: <b>cada aluno recebe uma diferente</b>.</p>
        <div class="field" style="margin-top:16px"><label for="m-nome">Nome completo</label>
          <input class="input" id="m-nome" placeholder="Seu nome" autocomplete="name"></div>
        <div class="field"><label for="m-turma">Turma / curso</label>
          <input class="input" id="m-turma" placeholder="Ex.: Licenciatura em Química, 5º período" autocomplete="off"></div>
        <div class="msg err" id="m-gate-msg"></div>
        <button class="btn btn-primary" id="m-sortear" style="width:100%; margin-top:6px">🎲 Sortear minha molécula</button>
      </div>`;
    document.getElementById("m-sortear").onclick = sortear;
    document.getElementById("m-turma").addEventListener("keydown", e => { if (e.key === "Enter") sortear(); });
  }

  /* ---------- sorteio ---------- */
  async function sortear(){
    const nome = document.getElementById("m-nome").value.trim();
    const turma = document.getElementById("m-turma").value.trim();
    const msg = document.getElementById("m-gate-msg");
    if (nome.split(/\s+/).length < 2 || !turma){
      msg.textContent = "Preencha nome completo (nome e sobrenome) e turma para continuar.";
      return;
    }
    const btn = document.getElementById("m-sortear");
    btn.disabled = true; btn.textContent = "Sorteando…";

    // animação de "roleta" enquanto o servidor responde
    body().insertAdjacentHTML("beforeend", `<div class="card draw-box" id="m-draw"><p class="muted small">Sorteando entre ${MOLECULAS.length} moléculas…</p><div class="slot spinning" id="m-slot">?</div></div>`);
    const slot = document.getElementById("m-slot");
    let k = 0;
    const spin = setInterval(() => { slot.textContent = "Molécula nº " + num2(k++ % MOLECULAS.length); }, 70);
    const minDelay = new Promise(r => setTimeout(r, 2200));

    let resp;
    try {
      if (API.ativo()){
        resp = await API.post({ tipo: "sorteio", nome, turma, total: MOLECULAS.length });
      } else {
        resp = { status: "ok", indice: Math.floor(Math.random() * MOLECULAS.length), repetido: false, demo: true };
      }
    } catch(e){
      resp = { status: "error", message: "Não foi possível falar com a planilha. Verifique a internet e tente de novo." };
    }
    await minDelay;
    clearInterval(spin);

    if (resp.status === "esgotado"){
      document.getElementById("m-draw").innerHTML = `<h3>😮 Todas as ${MOLECULAS.length} moléculas já foram sorteadas!</h3><p class="muted">Avise o professor para que ele acrescente mais moléculas ao banco.</p>`;
      btn.disabled = false; btn.textContent = "🎲 Sortear minha molécula";
      return;
    }
    if (resp.status !== "ok" || typeof resp.indice !== "number" || !MOLECULAS[resp.indice]){
      document.getElementById("m-draw").remove();
      msg.textContent = resp.message || "Erro no sorteio. Tente novamente.";
      btn.disabled = false; btn.textContent = "🎲 Sortear minha molécula";
      return;
    }

    S = novoEstado(nome, turma);
    S.indice = resp.indice;
    S.repetido = !!resp.repetido;
    save();
    renderRevelacao();
  }

  async function renderRevelacao(){
    await rdkit();
    const m = mol();
    const primeiro = S.nome.split(/\s+/)[0];
    body().innerHTML = `
      <div class="card draw-box">
        <p class="eyebrow" style="margin-bottom:14px">${S.repetido ? "Você já tinha sorteado" : "Sorteio realizado"}</p>
        <p class="reveal-title">🎉 Parabéns, ${esc(primeiro)}!<br><span class="grad">Sua molécula é a nº ${num2(S.indice)}${MISSAO.revelarNomeNoSorteio && m.nome ? " · " + esc(m.nome) : ""}</span></p>
        ${molFrame()}
        <p class="muted small">${S.repetido ? "Como você já tinha participado, recebeu a mesma molécula de antes." : "Ninguém mais da turma tem esta molécula. Ela é só sua!"}</p>
        <button class="btn btn-primary" id="m-go" style="margin-top:14px">Aceitar a missão →</button>
      </div>`;
    if (!S.repetido) confetti();
    document.getElementById("m-go").onclick = renderMissao;
  }

  function molFrame(cls = ""){
    const m = mol();
    const fallback = svg(m.smiles);
    if (m.imagem){
      // se a figura não existir, cai no desenho automático do RDKit
      return `<div class="mol-frame ${cls}"><img src="${esc(m.imagem)}" alt="Estrutura da molécula nº ${num2(S.indice)}"
        onerror="this.parentNode.innerHTML = Missao._fallbackSvg();"></div>`;
    }
    return `<div class="mol-frame ${cls}">${fallback || "<span style='color:#333'>Estrutura indisponível</span>"}</div>`;
  }

  // caixa com o SMILES da molécula (fica logo abaixo da figura, no dossiê)
  function smilesBox(){
    const smi = mol().smiles;
    if (!smi) return "";
    return `
      <p class="small muted" style="margin:14px 0 6px">SMILES da sua molécula (não precisa desenhar — é só copiar):</p>
      <div class="row" style="margin:0">
        <input class="input mono" id="m-smiles-ref" readonly spellcheck="false" value="${esc(smi)}">
        <button class="btn btn-ghost btn-sm" id="m-copy-ref">📋 Copiar</button>
      </div>`;
  }
  // copia um texto e dá retorno visual no botão
  function copiarTexto(texto, btn, rotulo){
    const fim = ok => {
      btn.textContent = ok ? "✅ Copiado" : "⚠️ Copie manualmente";
      setTimeout(() => { btn.textContent = rotulo; }, 2500);
    };
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(texto).then(() => fim(true)).catch(() => fim(false));
    } else { // file:// e http: o navegador bloqueia a área de transferência
      const i = document.getElementById("m-smiles-ref");
      if (i){ i.focus(); i.select(); }
      try { fim(document.execCommand("copy")); } catch(e){ fim(false); }
    }
  }

  /* ---------- tela principal ---------- */
  async function renderMissao(){
    await rdkit();
    const m = mol();
    alvoProps = descritores(m.smiles || S.dados.smiles);
    const nomeVisivel = !!m.nome && (MISSAO.revelarNomeNoSorteio || S.etapa > 1);
    body().innerHTML = aviso() + `
      <div class="card">
        <h3>🧪 Dossiê da molécula nº ${num2(S.indice)} <span id="m-nome-mol" class="grad">${nomeVisivel ? "· " + esc(m.nome) : ""}</span></h3>
        <div class="story">Agente <b>${esc(S.nome)}</b>, esta é a sua molécula. Ela pode ser um futuro candidato contra as arboviroses,
          ou não. Sua missão é investigá-la como um químico computacional: medir suas propriedades,
          consultar o <b>ArboMol</b>, fazer o <b>docking nos três alvos</b> e tirar uma conclusão científica.</div>
        ${molFrame()}
        ${smilesBox()}
      </div>
      <div class="progress-pills" id="m-pills">
        ${ETAPAS.map(e => `<span class="pill" data-p="${e.n}">${e.ico} ${e.n} · ${e.nome}</span>`).join("")}
      </div>
      ${stage1()}${stage2()}${stage3()}${stage4()}${stage5()}`;
    const cr = document.getElementById("m-copy-ref");
    if (cr) cr.onclick = () => copiarTexto(mol().smiles, cr, "📋 Copiar");
    bind1(); bind2(); bind3(); bind4(); bind5();
    atualizar();
    if (!RD) document.getElementById("m-msg-1").innerHTML = `<span class="warn">Não consegui carregar o RDKit (verifique a internet). A conferência automática do SMILES fica desativada.</span>`;
  }

  function atualizar(){
    ETAPAS.forEach(e => {
      const st = document.getElementById("m-stage-" + e.n);
      if (!st) return;
      st.classList.toggle("locked", e.n > S.etapa);
      st.classList.toggle("solved", e.n < S.etapa);
      const tag = st.querySelector(".stage-tag");
      tag.textContent = (e.n < S.etapa ? "✅ " : e.n > S.etapa ? "🔒 " : "") + tag.dataset.t;
      const pill = document.querySelector(`#m-pills [data-p="${e.n}"]`);
      pill.classList.toggle("on", e.n === S.etapa);
      pill.classList.toggle("done", e.n < S.etapa);
      st.querySelectorAll("input, button, textarea").forEach(el => { if (e.n < S.etapa) el.disabled = true; });
    });
    if (S.etapa > 1 && mol().nome) document.getElementById("m-nome-mol").textContent = "· " + mol().nome;
    const cp = document.getElementById("m-smiles-copy");
    if (cp && S.dados.smiles) cp.value = S.dados.smiles;
    save();
  }
  function avancar(n){
    S.etapa = n + 1;
    atualizar();
    const prox = document.getElementById("m-stage-" + (n + 1));
    if (prox) setTimeout(() => prox.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }
  const card = (n, titulo, html) => `
    <div class="card stage" id="m-stage-${n}">
      <span class="stage-tag" data-t="Etapa ${n} · ${titulo}">Etapa ${n} · ${titulo}</span>
      <div class="stage-body">${html}</div>
    </div>`;

  /* ---------- ETAPA 1 · SMILES ----------
     Se a molécula já tem SMILES no arquivo (moleculas/moleculas.js),
     o aluno só COPIA: não precisa desenhar nem digitar.
     Se o campo "smiles" estiver vazio, volta a pedir que ele escreva.      */
  const temSmiles = () => !!String(mol().smiles || "").trim();
  function stage1(){ return temSmiles() ? stage1Copiar() : stage1Digitar(); }
  function bind1(){ temSmiles() ? bind1Copiar() : bind1Digitar(); }

  function stage1Copiar(){
    return card(1, "O SMILES da sua molécula", `
      <h3>📋 Copie o SMILES da sua molécula</h3>
      <p class="muted">Você não precisa desenhar nada: o SMILES já está no dossiê, logo abaixo da estrutura.
        Ele é o código que você vai colar no <b>ArboMol</b> e no <b>Dynamic Dock</b>. Copie e guarde — se perder, ele continua ali em cima.</p>
      <div class="row">
        <input class="input mono" id="m-smiles" readonly spellcheck="false" value="${esc(mol().smiles)}">
        <button class="btn btn-primary" id="m-btn-1">📋 Copiar e continuar →</button>
      </div>
      <div class="msg" id="m-msg-1"></div>`);
  }
  function bind1Copiar(){
    const btn = document.getElementById("m-btn-1");
    btn.onclick = () => {
      const smi = mol().smiles;
      S.dados.smiles = smi;
      const i = document.getElementById("m-smiles");
      if (navigator.clipboard && window.isSecureContext){
        navigator.clipboard.writeText(smi).catch(() => {});
      } else {
        i.focus(); i.select();
        try { document.execCommand("copy"); } catch(e){}
      }
      const msg = document.getElementById("m-msg-1");
      msg.className = "msg ok";
      msg.innerHTML = "✅ SMILES copiado. Se o navegador não deixar copiar, selecione o texto acima e use Ctrl+C (ou Cmd+C).";
      avancar(1);
    };
  }

  function stage1Digitar(){
    return card(1, "Traduza a estrutura", `
      <h3>✍️ Escreva o SMILES da sua molécula</h3>
      <p class="muted">Observe a estrutura do dossiê e escreva o SMILES correspondente. Você pode usar um editor
        (PubChem Sketcher, ChemDraw, MarvinJS) para conferir. Estereoquímica (@, /, \\) não é obrigatória.</p>
      <div class="row">
        <input class="input mono" id="m-smiles" placeholder="Ex.: CC(=O)Oc1ccccc1C(=O)O" value="${esc(S.dados.smiles || "")}" spellcheck="false" autocomplete="off">
        <button class="btn btn-primary" id="m-btn-1">Verificar</button>
      </div>
      <div id="m-preview-1"></div>
      <div class="msg" id="m-msg-1"></div>`);
  }
  function bind1Digitar(){
    const inp = document.getElementById("m-smiles");
    const prev = document.getElementById("m-preview-1");
    let t;
    inp.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = inp.value.trim();
        const d = s ? svg(s, 320, 200) : "";
        prev.innerHTML = d ? `<p class="muted small" style="margin-top:6px">O que você escreveu:</p><div class="mol-frame small">${d}</div>` : "";
      }, 350);
    });
    inp.addEventListener("keydown", e => { if (e.key === "Enter") verificar1(); });
    document.getElementById("m-btn-1").onclick = verificar1;
  }
  function verificar1(){
    const inp = document.getElementById("m-smiles");
    const msg = document.getElementById("m-msg-1");
    const s = inp.value.trim();
    if (!s){ msg.className = "msg err"; msg.textContent = "Digite um SMILES."; return; }
    const alvo = mol().smiles;

    if (!RD){ // sem RDKit: aceita e segue
      S.dados.smiles = s; msg.className = "msg warn"; msg.textContent = "SMILES registrado (sem conferência automática).";
      return avancar(1);
    }
    const c = canon(s);
    if (!c){
      S.erros[1]++; shake(inp);
      msg.className = "msg err"; msg.textContent = "Esse SMILES não é válido: confira parênteses, números de anel e valências.";
      return;
    }
    if (!alvo){ // sem gabarito no arquivo: aceita o SMILES válido e calcula tudo a partir dele
      S.dados.smiles = s;
      alvoProps = descritores(s);
      msg.className = "msg ok";
      msg.innerHTML = "✅ SMILES válido e registrado. Confira se a estrutura desenhada acima é igual à do dossiê.";
      return avancar(1);
    }
    if (c === canon(alvo)){
      S.dados.smiles = s;
      msg.className = "msg ok";
      msg.innerHTML = `✅ Correto! Sua molécula é <b>${esc(nomeMol())}</b>.`;
      return avancar(1);
    }
    S.erros[1]++; shake(inp); save();
    msg.className = "msg err";
    let dica = "A estrutura que você escreveu (desenhada acima) não é a sua molécula. Compare com o dossiê.";
    const mine = descritores(s);
    if (S.erros[1] >= 2 && alvoProps && mine){
      dica += ` <br>💡 Dica: sua molécula tem <b>${alvoProps.pesados}</b> átomos pesados (sem H) e <b>${alvoProps.aneis}</b> anel(éis).
        A que você escreveu tem ${mine.pesados} e ${mine.aneis}.`;
    }
    msg.innerHTML = dica;
  }

  /* ---------- ETAPA 2 · PROPRIEDADES ---------- */
  function stage2(){
    return card(2, "Propriedades", `
      <h3>⚖️ Calcule as propriedades da sua molécula</h3>
      <p class="muted">Monte a fórmula molecular e calcule a massa molar. Use C = 12,01 · H = 1,008 · N = 14,01 · O = 16,00 · S = 32,07 · Cl = 35,45.</p>
      <div class="row">
        <label class="muted" style="min-width:150px">Massa molar (g/mol)</label>
        <input class="input mono" id="m-mm" inputmode="decimal" placeholder="000,00" style="max-width:180px" value="${esc(S.dados.massaMolar || "")}">
      </div>
      <div class="row">
        <label class="muted" style="min-width:150px">Doadores de H (OH + NH)</label>
        <input class="input mono" id="m-hbd" inputmode="numeric" placeholder="0" style="max-width:180px" value="${esc(S.dados.hbd ?? "")}">
      </div>
      <button class="btn btn-primary" id="m-btn-2a">Verificar</button>
      <div class="msg" id="m-msg-2a"></div>
      <div id="m-lipinski" style="display:none">
        <h3 style="margin-top:18px">💊 Regra dos 5 de Lipinski</h3>
        <p class="muted small">Um composto tende a ser bem absorvido por via oral quando viola no máximo uma destas regras:
          massa ≤ 500 · logP ≤ 5 · doadores de H ≤ 5 · aceptores de H ≤ 10.</p>
        <div class="props" id="m-props"></div>
        <p style="margin-top:6px">Sua molécula é <b>"drug-like"</b> segundo Lipinski?</p>
        <div class="chips" id="m-lip-chips">
          <button class="chip" data-v="sim">Sim (≤ 1 violação)</button>
          <button class="chip" data-v="nao">Não (≥ 2 violações)</button>
        </div>
        <div class="msg" id="m-msg-2b"></div>
      </div>`);
  }
  function bind2(){
    document.getElementById("m-btn-2a").onclick = verificar2a;
    document.querySelectorAll("#m-lip-chips .chip").forEach(b => b.onclick = () => verificar2b(b));
    if (S.etapa > 2 || S.dados.massaMolar) mostrarLipinski();
  }
  function verificar2a(){
    const msg = document.getElementById("m-msg-2a");
    const mm = parseNum(document.getElementById("m-mm").value);
    const hbd = parseNum(document.getElementById("m-hbd").value);
    if (mm === null || hbd === null){ msg.className = "msg err"; msg.textContent = "Preencha os dois campos com números."; return; }
    if (!alvoProps){ // sem RDKit
      S.dados.massaMolar = mm; S.dados.hbd = hbd; msg.className = "msg warn"; msg.textContent = "Valores registrados (sem conferência automática).";
      return avancar(2);
    }
    const okMM = Math.abs(mm - alvoProps.mw) <= 1.0;
    const okH = Math.round(hbd) === alvoProps.hbd;
    if (okMM && okH){
      S.dados.massaMolar = mm; S.dados.hbd = hbd;
      msg.className = "msg ok"; msg.innerHTML = `✅ Isso mesmo! Massa molar = <b>${br(alvoProps.mw, 2)} g/mol</b> e <b>${alvoProps.hbd}</b> doador(es) de H.`;
      mostrarLipinski(); save();
      return;
    }
    S.erros[2]++; save();
    msg.className = "msg err";
    const partes = [];
    if (!okMM) partes.push(mm > alvoProps.mw ? "A massa molar está <b>alta</b> demais: confira a contagem de hidrogênios." : "A massa molar está <b>baixa</b> demais: confira se contou todos os átomos (inclusive os H implícitos).");
    if (!okH) partes.push("O número de doadores de H não confere: conte cada grupo O–H e N–H (cada H ligado a N conta).");
    msg.innerHTML = partes.join("<br>");
  }
  function mostrarLipinski(){
    const box = document.getElementById("m-lipinski");
    box.style.display = "block";
    const p = alvoProps;
    if (!p){ document.getElementById("m-props").innerHTML = "<p class='muted'>Propriedades indisponíveis sem o RDKit.</p>"; return; }
    const it = (k, v, ok, lim) => `<div class="prop ${ok ? "ok" : "bad"}"><div class="k">${k}</div><div class="v">${v}</div><div class="small muted">${ok ? "✔" : "✘"} limite ${lim}</div></div>`;
    document.getElementById("m-props").innerHTML =
      it("Massa molar", p.mw.toFixed(1), p.mw <= 500, "≤ 500") +
      it("logP (Crippen)", p.logp.toFixed(2), p.logp <= 5, "≤ 5") +
      it("Doadores de H", p.hbd, p.hbd <= 5, "≤ 5") +
      it("Aceptores de H", p.hba, p.hba <= 10, "≤ 10");
  }
  function verificar2b(btn){
    const msg = document.getElementById("m-msg-2b");
    if (!alvoProps){ S.dados.lipinski = btn.dataset.v; return avancar(2); }
    const v = violacoes(alvoProps);
    const certo = v <= 1 ? "sim" : "nao";
    document.querySelectorAll("#m-lip-chips .chip").forEach(b => b.classList.toggle("sel", b === btn));
    if (btn.dataset.v === certo){
      S.dados.lipinski = certo; S.dados.violacoesLipinski = v;
      msg.className = "msg ok";
      msg.innerHTML = `✅ Correto: ${v} violação(ões). ${certo === "sim" ? "Perfil compatível com um fármaco oral." : "Perfil pouco favorável para uso oral, o que não impede outras vias de administração."}`;
      return avancar(2);
    }
    S.erros[2]++; save(); shake(btn);
    msg.className = "msg err"; msg.textContent = "Conte novamente quantos cartões estão em vermelho (✘).";
  }

  /* ---------- ETAPA 3 · ARBOMOL ---------- */
  function stage3(){
    return card(3, "ArboMol", `
      <h3>🦟 Classifique sua molécula no ArboMol</h3>
      <p class="muted">Abra o ArboMol, cole o seu SMILES e anote o resultado.</p>
      <div class="row">
        <input class="input mono" id="m-smiles-copy" readonly value="${esc(S.dados.smiles || "")}">
        <button class="btn btn-ghost btn-sm" id="m-copy">📋 Copiar SMILES</button>
        <a class="btn btn-ghost btn-sm" href="${esc(MINICURSO.arbomolUrl)}" target="_blank" rel="noopener">Abrir ArboMol ↗</a>
      </div>
      <p style="margin-top:14px"><b>Veredito</b> do ArboMol</p>
      <div class="chips" id="m-ver">
        <button class="chip" data-v="provavel">Provável <span class="muted small">(Likely)</span></button>
        <button class="chip" data-v="possivel">Possível <span class="muted small">(Possibly)</span></button>
        <button class="chip" data-v="improvavel">Improvável <span class="muted small">(Unlikely)</span></button>
      </div>
      <div class="row">
        <label class="muted" style="min-width:150px">Confiança (0 a 1)</label>
        <input class="input mono" id="m-conf" inputmode="decimal" placeholder="0,00" style="max-width:160px">
      </div>
      <p><b>Classe</b> atribuída</p>
      <div class="chips" id="m-classe">
        <button class="chip" data-v="Dengue">Dengue</button>
        <button class="chip" data-v="Zika">Zika</button>
        <button class="chip" data-v="Chikungunya">Chikungunya</button>
        <button class="chip" data-v="Nenhuma">Nenhuma classe</button>
      </div>
      <button class="btn btn-primary" id="m-btn-3" style="margin-top:10px">Registrar resultado</button>
      <div class="msg" id="m-msg-3"></div>`);
  }
  function chipGroup(id){
    document.querySelectorAll(`#${id} .chip`).forEach(b => b.onclick = () => {
      document.querySelectorAll(`#${id} .chip`).forEach(x => x.classList.toggle("sel", x === b));
    });
  }
  const chipVal = id => { const s = document.querySelector(`#${id} .chip.sel`); return s ? s.dataset.v : null; };
  function bind3(){
    chipGroup("m-ver"); chipGroup("m-classe");
    document.getElementById("m-copy").onclick = () => {
      const i = document.getElementById("m-smiles-copy");
      i.value = S.dados.smiles || "";
      navigator.clipboard?.writeText(i.value).catch(() => {});
      i.select();
      document.getElementById("m-copy").textContent = "✅ Copiado";
    };
    document.getElementById("m-btn-3").onclick = verificar3;
    const a = S.dados.arbomol;
    if (a){
      document.querySelector(`#m-ver [data-v="${a.veredito}"]`)?.classList.add("sel");
      document.querySelector(`#m-classe [data-v="${a.classe}"]`)?.classList.add("sel");
      document.getElementById("m-conf").value = a.confianca;
    }
  }
  function verificar3(){
    const msg = document.getElementById("m-msg-3");
    const ver = chipVal("m-ver"), classe = chipVal("m-classe");
    const conf = parseNum(document.getElementById("m-conf").value);
    if (!ver || !classe || conf === null){ msg.className = "msg err"; msg.textContent = "Selecione o veredito, a classe e informe a confiança."; return; }
    if (conf < 0 || conf > 1){ msg.className = "msg err"; msg.textContent = "A confiança do ArboMol vai de 0 a 1 (ex.: 0,62)."; return; }
    // coerência com as regras do ArboMol (config_modelo.json)
    const esperado = conf >= 0.5 ? "provavel" : conf >= 0.35 ? "possivel" : "improvavel";
    const problemas = [];
    if (ver !== esperado) problemas.push(`Com confiança ${br(conf, 2)}, o ArboMol dá o veredito <b>${VER[esperado]}</b> (≥ 0,50 provável · 0,35–0,50 possível · &lt; 0,35 improvável).`);
    if (ver === "improvavel" && classe !== "Nenhuma") problemas.push("Quando o veredito é <b>Improvável</b>, o ArboMol <b>não atribui classe</b>.");
    if (ver !== "improvavel" && classe === "Nenhuma") problemas.push("Com veredito Provável ou Possível, o ArboMol sempre indica uma classe (dengue, zika ou chikungunya).");
    if (problemas.length){
      S.erros[3]++; save();
      msg.className = "msg err"; msg.innerHTML = "Esses dados não combinam. Confira a tela do ArboMol:<br>" + problemas.join("<br>");
      return;
    }
    S.dados.arbomol = { veredito: ver, confianca: conf, classe };
    msg.className = "msg ok";
    msg.innerHTML = ver === "improvavel"
      ? "✅ Registrado. Lembre: <i>improvável</i> quer dizer que ela não se parece com os compostos dos programas anti-arbovírus, e não que seja inativa."
      : `✅ Registrado: sua molécula se parece com compostos estudados contra <b>${esc(classe)}</b>${ver === "possivel" ? " (baixa confiança)" : ""}.`;
    avancar(3);
  }

  /* ---------- ETAPA 4 · DYNAMIC DOCK (os 3 alvos) ---------- */
  const DOENCAS = [
    { nome: "Dengue", ico: "🦟", id: "den" },
    { nome: "Zika", ico: "🧬", id: "zik" },
    { nome: "Chikungunya", ico: "🦠", id: "chi" }
  ];
  const alvoCfg = d => (MISSAO.alvos && MISSAO.alvos[d]) || {};
  function stage4(){
    const blocos = DOENCAS.map(d => {
      const cfg = alvoCfg(d.nome), fixo = !!cfg.pdb;
      return `<div class="prop" style="padding:16px">
        <h3 style="font-size:1.05rem; margin-bottom:10px">${d.ico} Alvo de ${d.nome}</h3>
        <div class="field"><label>Código PDB</label><input class="input mono" id="m-pdb-${d.id}" placeholder="Ex.: 2FOM" maxlength="4"
          style="text-transform:uppercase" value="${esc(cfg.pdb || "")}" ${fixo ? "readonly" : ""}></div>
        <div class="field"><label>Proteína-alvo</label><input class="input" id="m-alvo-${d.id}" placeholder="Ex.: protease NS2B-NS3"
          value="${esc(cfg.nome || "")}" ${fixo ? "readonly" : ""}></div>
        <div class="field"><label>Melhor afinidade (kcal/mol)</label><input class="input mono" id="m-afin-${d.id}" inputmode="decimal" placeholder="-7,5"></div>
        <div class="field" style="margin-bottom:0"><label>Controle / ligante de referência <span class="small">(opcional)</span></label><input class="input mono" id="m-ref-${d.id}" inputmode="decimal" placeholder="-8,1"></div>
      </div>`;
    }).join("");
    return card(4, "Dynamic Dock", `
      <h3>🎯 Faça o docking nos TRÊS alvos</h3>
      <p class="muted">Mesmo que o ArboMol tenha indicado um vírus, dock a sua molécula contra um alvo de <b>cada</b> doença.
        Uma molécula pode ser <b>seletiva</b> (boa em um alvo só) ou <b>promíscua</b> (boa em vários), e ela pode surpreender
        e se sair melhor num alvo que o ArboMol não apontou.</p>
      <div class="row"><a class="btn btn-ghost btn-sm" href="${esc(MINICURSO.dynamicDockUrl)}" target="_blank" rel="noopener">Abrir Dynamic Dock ↗</a></div>
      <div class="props" style="grid-template-columns: repeat(auto-fit, minmax(210px, 1fr))">${blocos}</div>
      <div class="field"><label>Principais resíduos de interação no seu melhor alvo <span class="small">(opcional)</span></label>
        <input class="input" id="m-res" placeholder="Ex.: His51, Asp75, Ser135"></div>
      <button class="btn btn-primary" id="m-btn-4">Registrar os 3 dockings</button>
      <div class="msg" id="m-msg-4"></div>
      <div id="m-dock-res"></div>`);
  }
  function bind4(){
    document.getElementById("m-btn-4").onclick = verificar4;
    const k = S.dados.docking;
    if (k && k.alvos){
      DOENCAS.forEach(d => {
        const a = k.alvos[d.nome]; if (!a) return;
        document.getElementById("m-pdb-" + d.id).value = a.pdb; document.getElementById("m-alvo-" + d.id).value = a.alvo;
        document.getElementById("m-afin-" + d.id).value = a.afinidade; document.getElementById("m-ref-" + d.id).value = a.referencia ?? "";
      });
      document.getElementById("m-res").value = k.residuos || "";
      mostrarDock();
    }
  }
  // seletividade: diferença entre o melhor e o segundo melhor alvo
  function perfilDock(alvos){
    const ord = DOENCAS.map(d => ({ d: d.nome, af: alvos[d.nome].afinidade })).sort((a, b) => a.af - b.af);
    const delta = ord[1].af - ord[0].af;           // > 0 : quanto o melhor ganha do 2º
    const fortes = ord.filter(o => o.af <= -7).length;
    const perfil = fortes >= 2 && (ord[2].af - ord[0].af) <= 1.5 ? "promíscua"
                 : delta >= 1.0 ? "seletiva" : "sem preferência clara";
    return { ord, delta, perfil, melhor: ord[0] };
  }
  function verificar4(){
    const msg = document.getElementById("m-msg-4");
    const alvos = {};
    for (const d of DOENCAS){
      const pdb = document.getElementById("m-pdb-" + d.id).value.trim().toUpperCase();
      const alvo = document.getElementById("m-alvo-" + d.id).value.trim();
      const af = parseNum(document.getElementById("m-afin-" + d.id).value);
      const refTxt = document.getElementById("m-ref-" + d.id).value.trim();
      const ref = refTxt ? parseNum(refTxt) : null;
      const err = t => { msg.className = "msg err"; msg.textContent = `${d.nome}: ${t}`; };
      if (!/^[0-9][A-Z0-9]{3}$/.test(pdb)) return err("o código PDB tem 4 caracteres e começa com um número (ex.: 2FOM).");
      if (!alvo) return err("informe o nome da proteína-alvo.");
      if (af === null) return err("informe a afinidade (número em kcal/mol).");
      if (af > 0){ S.erros[4]++; save(); return err("afinidade positiva indica ligação desfavorável. No Vina, os bons resultados são negativos. Confira o sinal."); }
      if (af < -20){ S.erros[4]++; save(); return err("valor fora do esperado para o Vina (normalmente entre −3 e −14 kcal/mol). Confira."); }
      if (refTxt && (ref === null || ref > 0)) return err("a afinidade do controle deve ser um número negativo (ou deixe em branco).");
      alvos[d.nome] = { pdb, alvo, afinidade: af, referencia: ref };
    }
    const pdbs = DOENCAS.map(d => alvos[d.nome].pdb);
    if (new Set(pdbs).size < 3){ msg.className = "msg err"; msg.textContent = "Os três alvos precisam ser proteínas diferentes (um de cada vírus)."; return; }
    const p = perfilDock(alvos);
    S.dados.docking = {
      alvos, residuos: document.getElementById("m-res").value.trim(),
      melhor: p.melhor.d, delta: +p.delta.toFixed(2), perfil: p.perfil,
      // campos do melhor alvo (usados no ranking e na análise)
      doenca: p.melhor.d, afinidade: p.melhor.af, pdb: alvos[p.melhor.d].pdb, alvo: alvos[p.melhor.d].alvo, referencia: alvos[p.melhor.d].referencia
    };
    msg.className = "msg ok"; msg.textContent = "✅ Três dockings registrados!";
    mostrarDock();
    avancar(4);
  }
  function mostrarDock(){
    const k = S.dados.docking, box = document.getElementById("m-dock-res");
    if (!k || !box) return;
    const p = perfilDock(k.alvos), arbo = S.dados.arbomol?.classe;
    const cores = { Dengue: "#4f8cff", Zika: "#0ea597", Chikungunya: "#9b7bf7" };
    const max = Math.max(...p.ord.map(o => -o.af), 1);
    const barras = p.ord.map((o, i) => `<div class="scale-row" style="grid-template-columns: 8.5em 1fr 6.5em; font-size:.92rem">
        <span>${i === 0 ? "🥇 " : ""}${o.d}</span>
        <div style="height:14px; border-radius:4px; background:${cores[o.d]}; width:${(-o.af / max * 100).toFixed(0)}%"></div>
        <span class="v">${br(o.af, 1)}</span></div>`).join("");
    let txt = `Sua molécula teve <b>maior afinidade prevista por ${p.melhor.d}</b> (${br(p.melhor.af, 1)} kcal/mol). `;
    txt += p.perfil === "promíscua" ? `Ela se liga bem a vários alvos: perfil <b>promíscuo (multialvo)</b>. `
         : p.perfil === "seletiva" ? `Ela é <b>seletiva</b>: ganha do 2º alvo por ${br(p.delta, 1)} kcal/mol. `
         : `A diferença para o 2º alvo é pequena (${br(p.delta, 1)} kcal/mol), então <b>não há preferência clara</b>. `;
    if (arbo && arbo !== "Nenhuma") txt += arbo === p.melhor.d ? `✔ Isso <b>concorda</b> com o ArboMol, que indicou ${arbo}.`
         : `O ArboMol indicou <b>${arbo}</b>, mas o docking favoreceu <b>${p.melhor.d}</b>. Leve isso para a sua conclusão!`;
    else txt += `O ArboMol não indicou a molécula para nenhum vírus, mas o docking mostra como ela se comporta em cada alvo.`;
    box.innerHTML = `<div class="tile" style="margin-top:14px; padding:16px">${barras}<p class="small" style="margin-top:10px">${txt}</p></div>`;
  }

  /* ---------- ETAPA 5 · CONCLUSÃO ---------- */
  function stage5(){
    return card(5, "Conclusão", `
      <h3>🧠 Interprete como um(a) cientista</h3>
      <p class="muted" id="m-resumo5">Com base nos SEUS resultados, qual é a conclusão mais adequada?</p>
      <div class="opts" id="m-opts">
        <button class="opt" data-v="a"><b>a)</b> <span>A molécula é um fármaco eficaz e já pode ser testada em pacientes.</span></button>
        <button class="opt" data-v="b"><b>b)</b> <span>Os resultados formam uma hipótese: a molécula é (ou não) candidata a estudos posteriores, como dinâmica molecular e ensaios <i>in vitro</i>, que confirmem a atividade.</span></button>
        <button class="opt" data-v="c"><b>c)</b> <span>Como os resultados vieram do computador, não têm nenhum valor científico.</span></button>
        <button class="opt" data-v="d"><b>d)</b> <span>Uma afinidade muito negativa prova que a molécula não é tóxica.</span></button>
      </div>
      <div class="msg" id="m-msg-5a"></div>
      <div id="m-conc-box" style="display:none">
        <div class="field"><label>Escreva sua conclusão em 2 ou 3 frases (o que você descobriu e qual seria o próximo passo)</label>
          <textarea class="input" id="m-conc" placeholder="A molécula ... apresentou ..."></textarea></div>
        <button class="btn btn-primary" id="m-btn-5" style="width:100%">🏁 Concluir missão</button>
        <div class="msg" id="m-msg-5b"></div>
      </div>`);
  }
  const FEED5 = {
    a: "Ainda não! Nenhum resultado computacional dispensa testes in vitro, in vivo e ensaios clínicos.",
    c: "Exagero: resultados in silico orientam e economizam experimentos. São hipóteses valiosas, mas precisam de confirmação.",
    d: "Afinidade e toxicidade são coisas diferentes. Toxicidade se avalia com ADMET e experimentos."
  };
  function bind5(){
    document.querySelectorAll("#m-opts .opt").forEach(b => b.onclick = () => {
      const msg = document.getElementById("m-msg-5a");
      if (b.dataset.v === "b"){
        b.classList.add("right");
        document.querySelectorAll("#m-opts .opt").forEach(x => x.disabled = true);
        msg.className = "msg ok"; msg.textContent = "✅ Exatamente: todo resultado computacional é uma hipótese a ser testada.";
        document.getElementById("m-conc-box").style.display = "block";
      } else {
        S.erros[5]++; save();
        b.classList.add("wrong"); b.disabled = true;
        msg.className = "msg err"; msg.textContent = FEED5[b.dataset.v];
      }
    });
    document.getElementById("m-btn-5").onclick = concluir;
    const st = document.getElementById("m-stage-5");
    if (st && S.dados.arbomol && S.dados.docking){
      document.getElementById("m-resumo5").innerHTML =
        `Seus resultados: ArboMol <b>${VER[S.dados.arbomol.veredito]}</b> (${esc(S.dados.arbomol.classe)}, confiança ${br(S.dados.arbomol.confianca, 2)}) · docking: melhor alvo <b>${esc(S.dados.docking.melhor || S.dados.docking.doenca)}</b> (${br(S.dados.docking.afinidade, 1)} kcal/mol), perfil ${esc(S.dados.docking.perfil || "")}. Qual é a conclusão mais adequada?`;
    }
  }

  async function concluir(){
    const txt = document.getElementById("m-conc").value.trim();
    const msg = document.getElementById("m-msg-5b");
    if (txt.length < 40){ msg.className = "msg err"; msg.textContent = "Escreva um pouco mais (pelo menos 2 frases)."; return; }
    S.dados.conclusao = txt;
    const btn = document.getElementById("m-btn-5");
    btn.disabled = true; btn.textContent = "Registrando…";
    const tempoMin = ((Date.now() - S.inicio) / 60000).toFixed(1);
    const m = mol();
    const payload = {
      tipo: "missao",
      nome: S.nome, turma: S.turma, dataHora: new Date().toLocaleString("pt-BR"),
      molecula_n: S.indice + 1, molecula: nomeMol(), smiles_aluno: S.dados.smiles,
      massa_molar: S.dados.massaMolar, lipinski_violacoes: S.dados.violacoesLipinski ?? "",
      logp: alvoProps ? +alvoProps.logp.toFixed(2) : "",
      arbomol_veredito: S.dados.arbomol.veredito, arbomol_confianca: S.dados.arbomol.confianca, arbomol_classe: S.dados.arbomol.classe,
      docking_doenca: S.dados.docking.melhor, pdb: S.dados.docking.pdb, alvo: S.dados.docking.alvo, afinidade: S.dados.docking.afinidade,
      afinidade_controle: S.dados.docking.referencia ?? "", residuos: S.dados.docking.residuos,
      perfil_docking: S.dados.docking.perfil, delta_seletividade: S.dados.docking.delta,
      ...Object.fromEntries(DOENCAS.flatMap(d => {
        const a = S.dados.docking.alvos[d.nome], k = d.nome.toLowerCase();
        return [["af_" + k, a.afinidade], ["pdb_" + k, a.pdb], ["alvo_" + k, a.alvo], ["controle_" + k, a.referencia ?? ""]];
      })),
      conclusao: txt,
      erros_smiles: S.erros[1], erros_propriedades: S.erros[2], erros_arbomol: S.erros[3], erros_docking: S.erros[4], erros_conclusao: S.erros[5],
      tempo_min: tempoMin
    };
    let r = null;
    if (API.ativo()){
      try { r = await API.post(payload); } catch(e){ r = null; }
    }
    S.concluida = true;
    S.tempoMin = tempoMin;
    S.registro = API.ativo() ? (r && r.status === "ok" ? "ok" : "falhou") : "demo";
    S.posicao = r && r.posicao ? r.posicao : null;
    if (S.registro === "falhou") S.pendente = payload;
    save();
    renderFinal(true);
  }

  async function renderFinal(festa){
    await rdkit();
    const m = mol(), d = S.dados;
    const reg = S.registro === "ok"
      ? `<span class="msg ok">✅ Resultado gravado na planilha${S.posicao ? ` · você foi o(a) <b>${S.posicao}º</b> a concluir!` : "."}</span>`
      : S.registro === "falhou"
        ? `<span class="msg err">⚠️ Não foi possível gravar na planilha agora.</span> <button class="btn btn-ghost btn-sm" id="m-reenviar">Tentar enviar de novo</button>`
        : `<span class="msg warn">Modo demonstração: mostre esta tela ao professor.</span>`;
    body().innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:3rem">🏆</div>
        <p class="reveal-title">Missão cumprida, ${esc(S.nome.split(/\s+/)[0])}!</p>
        <p class="muted">${m.nome ? "Molécula nº " + num2(S.indice) + " · " : ""}<b>${esc(nomeMol())}</b> · ${S.tempoMin ? br(S.tempoMin, 0) : "?"} min</p>
        ${molFrame("small")}
        <div class="props" style="text-align:left">
          <div class="prop"><div class="k">Massa molar</div><div class="v">${d.massaMolar != null ? br(d.massaMolar, 1) : "—"}</div></div>
          <div class="prop"><div class="k">Lipinski</div><div class="v">${d.violacoesLipinski ?? "—"} violação(ões)</div></div>
          <div class="prop"><div class="k">ArboMol</div><div class="v">${esc(d.arbomol?.classe || "—")}</div><div class="small muted">${VER[d.arbomol?.veredito] || ""} · ${d.arbomol ? br(d.arbomol.confianca, 2) : ""}</div></div>
          <div class="prop"><div class="k">Docking</div><div class="v">${d.docking ? br(d.docking.afinidade, 1) : "—"}</div><div class="small muted">kcal/mol · melhor: ${esc(d.docking?.melhor || d.docking?.doenca || "")} · ${esc(d.docking?.perfil || "")}</div></div>
        </div>
        <div style="margin:10px 0 16px">${reg}</div>
        <a class="btn btn-primary" href="#questionario">📝 Agora responda ao questionário →</a>
      </div>`;
    if (festa) confetti(140);
    const re = document.getElementById("m-reenviar");
    if (re) re.onclick = async () => {
      re.disabled = true; re.textContent = "Enviando…";
      try {
        const r = await API.post(S.pendente);
        if (r && r.status === "ok"){ S.registro = "ok"; S.posicao = r.posicao; delete S.pendente; save(); }
      } catch(e){}
      renderFinal(false);
    };
  }

  return { init, _fallbackSvg: () => svg(mol().smiles) || "<span style='color:#333'>Estrutura indisponível</span>" };
})();
window.Missao = Missao;
