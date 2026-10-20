/* ============================================================
   analise.js — botão "Análise de Dados"
   Busca na planilha (doGet ?acao=dados) as respostas do
   questionário e os resultados da Missão Molecular, e gera
   gráficos + interpretações automáticas.
   ============================================================ */
const Analise = (() => {
  // paleta validada (contraste e daltonismo) sobre o fundo escuro do site
  const C = { blue: "#4f8cff", teal: "#0ea597", purple: "#9b7bf7", amber: "#c97a08",
              surface: "#10141f", grid: "rgba(255,255,255,0.06)", ink: "#eef1f7", muted: "#9aa4b8" };
  // escala divergente da Likert: 2 vermelhos · cinza neutro · 2 azuis
  const LIK = ["#e5484d", "#f0a0a0", "#5c6475", "#8ab4ff", "#3b6fe0"];
  const LIK_T = ["Discordo totalmente", "Discordo", "Neutro", "Concordo", "Concordo totalmente"];
  const CONHEC = QUESTIONARIO.conhecimento.opcoes;
  const VER = { provavel: "provável", possivel: "possível", improvavel: "improvável" };
  let charts = [], DATA = null, aba = "q", exemplo = false;

  const $ = id => document.getElementById(id);
  const body = () => $("analysis-body");
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;
  const sd = a => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
  const f = (x, d = 1) => isFinite(x) ? x.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";
  const pct = (x, d = 0) => isFinite(x) ? f(x * 100, d) + "%" : "—";
  const num = v => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) ? x : null; };

  /* ---------- estatística ---------- */
  function cronbach(rows, ids){
    const k = ids.length;
    const full = rows.filter(r => ids.every(id => num(r[id]) !== null));
    if (full.length < 3 || k < 2) return NaN;
    const varOf = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
    const itemVar = ids.reduce((s, id) => s + varOf(full.map(r => num(r[id]))), 0);
    const totVar = varOf(full.map(r => ids.reduce((s, id) => s + num(r[id]), 0)));
    return totVar > 0 ? (k / (k - 1)) * (1 - itemVar / totVar) : NaN;
  }
  // Wilcoxon pareado (aproximação normal com correção de empates e de continuidade)
  function wilcoxon(pares){
    const d = pares.map(([a, b]) => b - a).filter(x => x !== 0);
    const n = d.length;
    if (n < 6) return { n, p: NaN };
    const abs = d.map((x, i) => ({ a: Math.abs(x), s: Math.sign(x), i })).sort((x, y) => x.a - y.a);
    let i = 0, tie = 0;
    while (i < n){
      let j = i; while (j + 1 < n && abs[j + 1].a === abs[i].a) j++;
      const r = (i + j + 2) / 2; for (let k = i; k <= j; k++) abs[k].r = r;
      const t = j - i + 1; tie += t ** 3 - t; i = j + 1;
    }
    const Wp = abs.filter(x => x.s > 0).reduce((s, x) => s + x.r, 0);
    const mu = n * (n + 1) / 4;
    const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tie / 48);
    const z = sigma > 0 ? (Math.abs(Wp - mu) - 0.5) / sigma : 0;
    return { n, z, p: 2 * (1 - normCdf(z)), W: Wp };
  }
  function normCdf(z){ // Abramowitz-Stegun
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  function pearson(xs, ys){
    const n = xs.length; if (n < 4) return NaN;
    const mx = mean(xs), my = mean(ys);
    let a = 0, b = 0, c = 0;
    for (let i = 0; i < n; i++){ a += (xs[i] - mx) * (ys[i] - my); b += (xs[i] - mx) ** 2; c += (ys[i] - my) ** 2; }
    return b && c ? a / Math.sqrt(b * c) : NaN;
  }
  const fmtP = p => !isFinite(p) ? "—" : p < 0.001 ? "p < 0,001" : "p = " + f(p, 3);
  const forca = r => { const a = Math.abs(r); return a >= .7 ? "forte" : a >= .4 ? "moderada" : a >= .2 ? "fraca" : "desprezível"; };

  /* ---------- Chart.js ---------- */
  function setupChart(){
    const ch = window.Chart;
    ch.defaults.color = C.muted;
    ch.defaults.font.family = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";
    ch.defaults.font.size = 12;
    ch.defaults.borderColor = C.grid;
    ch.defaults.plugins.legend.labels.boxWidth = 12;
    ch.defaults.plugins.legend.labels.boxHeight = 12;
    ch.defaults.plugins.legend.labels.useBorderRadius = true;
    ch.defaults.plugins.legend.labels.borderRadius = 3;
    ch.defaults.plugins.tooltip.backgroundColor = "rgba(11,15,26,0.96)";
    ch.defaults.plugins.tooltip.borderColor = "rgba(255,255,255,0.12)";
    ch.defaults.plugins.tooltip.borderWidth = 1;
    ch.defaults.plugins.tooltip.padding = 10;
    ch.defaults.plugins.tooltip.titleColor = C.ink;
    ch.defaults.plugins.tooltip.bodyColor = C.ink;
    ch.defaults.elements.bar.borderRadius = 4;
    ch.defaults.animation.duration = 600;
  }
  function mk(id, cfg){
    const el = $(id); if (!el) return;
    charts.push(new Chart(el, cfg));
  }
  const axisCommon = { grid: { color: C.grid }, border: { display: false }, ticks: { color: C.muted } };
  const noGrid = { grid: { display: false }, border: { display: false }, ticks: { color: C.muted } };

  /* ---------- carregar ---------- */
  async function analisar(){
    const btn = $("btn-analisar");
    charts.forEach(c => c.destroy()); charts = [];
    body().innerHTML = `<div class="loader"><span class="autoplay-ring"></span><br>Buscando respostas na planilha…</div>`;
    btn.disabled = true;
    try {
      await getChart(); setupChart();
      if (!API.ativo()){
        body().innerHTML = `<div class="notice" style="text-align:center">⚠️ A URL do Apps Script ainda não foi configurada em <span class="mono">assets/js/config.js</span>, então não há dados reais para analisar.<br><br>
          <button class="btn btn-ghost btn-sm" id="btn-exemplo">Ver como fica com dados FICTÍCIOS de exemplo</button></div>`;
        $("btn-exemplo").onclick = () => { exemplo = true; DATA = dadosExemplo(); renderAll(); };
        return;
      }
      const r = await API.get({ acao: "dados" });
      if (r.status !== "ok") throw new Error(r.message || "Resposta inválida");
      exemplo = false;
      DATA = { questionario: r.questionario || [], missao: r.missao || [], sorteio: r.sorteio || [] };
      renderAll();
    } catch(e){
      body().innerHTML = `<div class="notice">Não foi possível carregar os dados: ${esc(e.message)}. Verifique a internet e se o Apps Script foi publicado com acesso para "Qualquer pessoa".</div>`;
    } finally { btn.disabled = false; btn.textContent = "🔄 Atualizar análise"; }
  }

  function renderAll(){
    charts.forEach(c => c.destroy()); charts = [];
    const nq = DATA.questionario.length, nm = DATA.missao.length;
    body().innerHTML = `
      ${exemplo ? `<div class="notice" style="text-align:center">🧪 <b>Dados fictícios de exemplo</b>: só para visualizar o painel. Não correspondem a respostas reais.</div>` : ""}
      <div class="tabs">
        <button data-a="q" class="${aba === "q" ? "on" : ""}">📝 Questionário (${nq})</button>
        <button data-a="m" class="${aba === "m" ? "on" : ""}">🧬 Missão Molecular (${nm})</button>
      </div>
      <div id="an-content"></div>
      <div style="text-align:center; margin-top:10px"><button class="btn btn-ghost btn-sm" id="btn-csv">⬇️ Baixar dados desta aba (CSV)</button></div>`;
    body().querySelectorAll(".tabs button").forEach(b => b.onclick = () => { aba = b.dataset.a; renderAll(); });
    $("btn-csv").onclick = () => baixarCSV(aba === "q" ? DATA.questionario : DATA.missao, aba === "q" ? "questionario.csv" : "missao_molecular.csv");
    aba === "q" ? renderQuest() : renderMissao();
  }

  /* ============================================================
     QUESTIONÁRIO
     ============================================================ */
  function renderQuest(){
    const rows = DATA.questionario;
    const el = $("an-content");
    if (!rows.length){ el.innerHTML = `<div class="card" style="text-align:center"><p class="muted">Ainda não há respostas no questionário.</p></div>`; return; }
    const items = QUESTIONARIO.likert;
    const ids = items.map(q => q.id);
    const n = rows.length;

    // por item
    const stats = items.map(q => {
      const v = rows.map(r => num(r[q.id])).filter(x => x !== null);
      const cnt = [1, 2, 3, 4, 5].map(k => v.filter(x => x === k).length);
      return { ...q, n: v.length, m: mean(v), s: sd(v), cnt, conc: v.length ? (cnt[3] + cnt[4]) / v.length : NaN, disc: v.length ? (cnt[0] + cnt[1]) / v.length : NaN };
    });
    const allV = rows.flatMap(r => ids.map(id => num(r[id])).filter(x => x !== null));
    const concGeral = allV.filter(x => x >= 4).length / allV.length;
    const notas = rows.map(r => num(r[QUESTIONARIO.nota.id])).filter(x => x !== null);
    const alpha = cronbach(rows, ids);
    const lvl = v => { const i = CONHEC.indexOf(v); return i >= 0 ? i + 1 : null; };
    const pares = rows.map(r => [lvl(r[QUESTIONARIO.conhecimento.antes.id]), lvl(r[QUESTIONARIO.conhecimento.depois.id])]).filter(([a, b]) => a && b);
    const subiu = pares.filter(([a, b]) => b > a).length;
    const wil = wilcoxon(pares);
    const ord = [...stats].sort((a, b) => b.m - a.m);
    const melhor = ord[0], pior = ord[ord.length - 1];

    el.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="k">Respostas</div><div class="v">${n}</div><div class="s">participantes</div></div>
        <div class="kpi"><div class="k">Nota média</div><div class="v">${f(mean(notas))}</div><div class="s">de 0 a 10 · DP ${f(sd(notas))}</div></div>
        <div class="kpi"><div class="k">Concordância geral</div><div class="v">${pct(concGeral)}</div><div class="s">respostas 4 ou 5</div></div>
        <div class="kpi"><div class="k">Melhoraram o conhecimento</div><div class="v">${pct(pares.length ? subiu / pares.length : NaN)}</div><div class="s">${subiu} de ${pares.length}</div></div>
        <div class="kpi"><div class="k">Confiabilidade (α)</div><div class="v">${f(alpha, 2)}</div><div class="s">alfa de Cronbach</div></div>
      </div>

      <div class="chart-card">
        <h3>Percepção por afirmação</h3>
        <p class="sub">Distribuição das respostas: discordância à esquerda, concordância à direita. Passe o mouse para ver os valores.</p>
        <div class="chart-box tall"><canvas id="ch-likert"></canvas></div>
        <div class="interp">${interpLikert(stats, melhor, pior, concGeral)}</div>
      </div>

      <div class="grid-2">
        <div class="chart-card">
          <h3>Conhecimento antes × depois</h3>
          <p class="sub">Autoavaliação do conhecimento em química computacional</p>
          <div class="chart-box"><canvas id="ch-prepos"></canvas></div>
          <div class="interp">${interpPrePos(pares, subiu, wil)}</div>
        </div>
        <div class="chart-card">
          <h3>Média por dimensão</h3>
          <p class="sub">Escala de 1 (discordo totalmente) a 5 (concordo totalmente)</p>
          <div class="chart-box"><canvas id="ch-dim"></canvas></div>
          <div class="interp" id="interp-dim"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="chart-card">
          <h3>Distribuição das notas</h3>
          <p class="sub">Nota de 0 a 10 dada ao minicurso</p>
          <div class="chart-box"><canvas id="ch-nota"></canvas></div>
          <div class="interp">${interpNota(notas)}</div>
        </div>
        <div class="chart-card">
          <h3>Perfil dos participantes</h3>
          <p class="sub">${esc(QUESTIONARIO.perfil.texto)}</p>
          <div class="chart-box"><canvas id="ch-perfil"></canvas></div>
          <div class="interp" id="interp-perfil"></div>
        </div>
      </div>

      <div class="chart-card">
        <h3>Tabela das afirmações</h3>
        <p class="sub">Estatística descritiva por item</p>
        <div class="table-wrap"><table class="data"><thead><tr><th>Item</th><th>Dimensão</th><th>n</th><th>Média</th><th>DP</th><th>% concorda</th><th>% discorda</th></tr></thead><tbody>
          ${stats.map(s => `<tr><td style="white-space:normal; min-width:260px">${esc(s.texto)}</td><td>${esc(s.dim)}</td><td class="num">${s.n}</td><td class="num">${f(s.m, 2)}</td><td class="num">${f(s.s, 2)}</td><td class="num">${pct(s.conc)}</td><td class="num">${pct(s.disc)}</td></tr>`).join("")}
        </tbody></table></div>
        <div class="interp">${interpAlpha(alpha, rows.length)}</div>
      </div>

      ${comentarios(rows)}`;

    // --- Likert divergente ---
    const labels = stats.map(s => s.texto.length > 58 ? s.texto.slice(0, 56) + "…" : s.texto);
    const P = stats.map(s => s.cnt.map(c => s.n ? c / s.n * 100 : 0));
    // ordem de empilhamento: neutro colado no zero, depois para fora
    const ds = [
      { label: LIK_T[2] + " (½)", data: P.map(p => -p[2] / 2), backgroundColor: LIK[2], _k: 2 },
      { label: LIK_T[2], data: P.map(p => p[2] / 2), backgroundColor: LIK[2], _k: 2 },
      { label: LIK_T[1], data: P.map(p => -p[1]), backgroundColor: LIK[1], _k: 1 },
      { label: LIK_T[0], data: P.map(p => -p[0]), backgroundColor: LIK[0], _k: 0 },
      { label: LIK_T[3], data: P.map(p => p[3]), backgroundColor: LIK[3], _k: 3 },
      { label: LIK_T[4], data: P.map(p => p[4]), backgroundColor: LIK[4], _k: 4 }
    ].map(d => ({ ...d, borderColor: C.surface, borderWidth: 1.5, borderRadius: 3, borderSkipped: false, barPercentage: .78 }));
    mk("ch-likert", {
      type: "bar", data: { labels, datasets: ds },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ...axisCommon, stacked: true, min: -100, max: 100, ticks: { color: C.muted, callback: v => Math.abs(v) + "%" } },
          y: { ...noGrid, stacked: true, ticks: { color: C.ink, font: { size: 11.5 } } }
        },
        plugins: {
          legend: { position: "bottom", labels: { filter: it => !it.text.includes("(½)"),
            sort: (a, b) => LIK_T.indexOf(a.text) - LIK_T.indexOf(b.text) } },
          tooltip: { filter: it => !it.dataset.label.includes("(½)"), callbacks: {
            title: it => stats[it[0].dataIndex].texto,
            label: it => {
              const i = it.dataIndex, s = stats[i];
              const k = it.dataset._k;
              return ` ${LIK_T[k]}: ${f(P[i][k], 0)}% (${s.cnt[k]})`;
            },
            footer: it => { const s = stats[it[0].dataIndex]; return `Média ${f(s.m, 2)} · concordância ${pct(s.conc)}`; }
          } }
        }
      }
    });

    // --- antes x depois ---
    const ca = CONHEC.map(o => rows.filter(r => r[QUESTIONARIO.conhecimento.antes.id] === o).length);
    const cd = CONHEC.map(o => rows.filter(r => r[QUESTIONARIO.conhecimento.depois.id] === o).length);
    mk("ch-prepos", {
      type: "bar",
      data: { labels: CONHEC, datasets: [
        { label: "Antes", data: ca, backgroundColor: C.purple, borderColor: C.surface, borderWidth: 2, borderSkipped: "start" },
        { label: "Depois", data: cd, backgroundColor: C.teal, borderColor: C.surface, borderWidth: 2, borderSkipped: "start" }
      ] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: noGrid, y: { ...axisCommon, beginAtZero: true, ticks: { color: C.muted, precision: 0 }, title: { display: true, text: "participantes", color: C.muted } } },
        plugins: { legend: { position: "top", align: "end" }, tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${it.raw} (${pct(it.raw / n)})` } } } }
    });

    // --- dimensões ---
    const dims = [...new Set(items.map(q => q.dim))];
    const dm = dims.map(d => mean(rows.flatMap(r => items.filter(q => q.dim === d).map(q => num(r[q.id])).filter(x => x !== null))));
    mk("ch-dim", {
      type: "bar",
      data: { labels: dims, datasets: [{ label: "Média", data: dm, backgroundColor: C.blue, borderSkipped: "start", barPercentage: .6 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: noGrid, y: { ...axisCommon, min: 1, max: 5, ticks: { color: C.muted, stepSize: 1 } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => ` Média: ${f(it.raw, 2)}` } } } }
    });
    const di = dims.map((d, i) => [d, dm[i]]).sort((a, b) => b[1] - a[1]);
    $("interp-dim").innerHTML = `A dimensão mais bem avaliada foi <b>${esc(di[0][0])}</b> (média ${f(di[0][1], 2)})` +
      (di.length > 1 ? ` e a menos, <b>${esc(di[di.length - 1][0])}</b> (${f(di[di.length - 1][1], 2)}).` : ".") +
      ` Médias acima de 4 indicam avaliação positiva; entre 3 e 4, moderada; abaixo de 3, pede atenção.`;

    // --- notas ---
    const hist = Array.from({ length: 11 }, (_, i) => notas.filter(x => x === i).length);
    mk("ch-nota", {
      type: "bar",
      data: { labels: hist.map((_, i) => String(i)), datasets: [{ label: "Participantes", data: hist, backgroundColor: C.blue, borderSkipped: "start", barPercentage: .82, categoryPercentage: .9 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: { ...noGrid, title: { display: true, text: "nota", color: C.muted } }, y: { ...axisCommon, beginAtZero: true, ticks: { color: C.muted, precision: 0 } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: it => "Nota " + it[0].label, label: it => ` ${it.raw} participante(s)` } } } }
    });

    // --- perfil ---
    const po = QUESTIONARIO.perfil.opcoes;
    const pc = po.map(o => rows.filter(r => r[QUESTIONARIO.perfil.id] === o).length);
    mk("ch-perfil", {
      type: "bar",
      data: { labels: po, datasets: [{ label: "Participantes", data: pc, backgroundColor: C.purple, borderSkipped: "start", barPercentage: .6 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: { x: { ...axisCommon, beginAtZero: true, ticks: { color: C.muted, precision: 0 } }, y: { ...noGrid, ticks: { color: C.ink } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => ` ${it.raw} (${pct(it.raw / n)})` } } } }
    });
    const pmax = po.map((o, i) => [o, pc[i]]).sort((a, b) => b[1] - a[1])[0];
    $("interp-perfil").innerHTML = pmax[1] ? `O público foi majoritariamente de <b>${esc(pmax[0])}</b> (${pct(pmax[1] / n)} dos participantes).` : "Sem dados de perfil.";
  }

  function interpLikert(stats, melhor, pior, conc){
    const altos = stats.filter(s => s.conc >= .8).length;
    const atencao = stats.filter(s => s.m < 3.5);
    const nivel = conc >= .8 ? "muito positiva" : conc >= .6 ? "positiva" : conc >= .4 ? "dividida" : "pouco favorável";
    let t = `A percepção geral foi <b>${nivel}</b>: ${pct(conc)} de todas as respostas foram "concordo" ou "concordo totalmente". `;
    t += `${altos} de ${stats.length} afirmações tiveram concordância de 80% ou mais. `;
    t += `<br><b>Ponto mais forte:</b> "${esc(melhor.texto)}" (média ${f(melhor.m, 2)}). `;
    t += `<br><b>Ponto a melhorar:</b> "${esc(pior.texto)}" (média ${f(pior.m, 2)}).`;
    if (atencao.length) t += `<br>⚠️ ${atencao.length} item(ns) com média abaixo de 3,5 merece(m) atenção na próxima edição.`;
    return t;
  }
  function interpPrePos(pares, subiu, w){
    if (!pares.length) return "Sem dados pareados de antes e depois.";
    const ma = mean(pares.map(p => p[0])), md = mean(pares.map(p => p[1]));
    const toLbl = m => CONHEC[Math.max(0, Math.min(CONHEC.length - 1, Math.round(m) - 1))];
    let t = `O nível médio passou de <b>${f(ma, 2)}</b> (≈ ${toLbl(ma)}) para <b>${f(md, 2)}</b> (≈ ${toLbl(md)}), numa escala de 1 (${CONHEC[0]}) a ${CONHEC.length} (${CONHEC[CONHEC.length - 1]}). `;
    t += `${subiu} participante(s) (${pct(subiu / pares.length)}) relataram ter subido pelo menos um nível. `;
    if (isFinite(w.p)) t += `<br>Teste de Wilcoxon pareado: <b>${fmtP(w.p)}</b>, ${w.p < 0.05 ? "o ganho percebido é <b>estatisticamente significativo</b> (α = 0,05)." : "a diferença <b>não</b> é estatisticamente significativa (α = 0,05)."}`;
    else t += `<br>(O teste de Wilcoxon é calculado a partir de 6 participantes com mudança de nível.)`;
    t += `<br><span class="small">Lembre: é uma <i>autoavaliação</i>, que mede a percepção de aprendizagem, não o desempenho.</span>`;
    return t;
  }
  function interpNota(notas){
    if (!notas.length) return "Sem notas.";
    const s = [...notas].sort((a, b) => a - b), med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
    const prom = notas.filter(x => x >= 9).length / notas.length, det = notas.filter(x => x <= 6).length / notas.length;
    return `Nota média <b>${f(mean(notas))}</b> e mediana <b>${f(med, 1)}</b>. ${pct(prom)} deram nota 9 ou 10 e ${pct(det)} deram 6 ou menos. ` +
      `Pela lógica do NPS, o saldo (notas 9–10 menos notas 0–6) é de <b>${f((prom - det) * 100, 0)} pontos</b>.`;
  }
  function interpAlpha(a, n){
    if (!isFinite(a)) return "O alfa de Cronbach é calculado a partir de 3 respostas completas.";
    const q = a >= .9 ? "excelente" : a >= .8 ? "boa" : a >= .7 ? "aceitável" : a >= .6 ? "questionável" : "baixa";
    return `Alfa de Cronbach = <b>${f(a, 2)}</b>: consistência interna <b>${q}</b> entre as ${QUESTIONARIO.likert.length} afirmações (n = ${n}). ` +
      (a >= .7 ? "As afirmações medem de forma coerente a percepção sobre o minicurso, e as médias podem ser reportadas em conjunto." : "Interprete os itens individualmente, sem somar as afirmações num escore único.");
  }
  function comentarios(rows){
    const cs = rows.map(r => String(r[QUESTIONARIO.comentario.id] || "").trim()).filter(Boolean);
    if (!cs.length) return "";
    return `<div class="chart-card"><h3>💬 Comentários (${cs.length})</h3><p class="sub">Respostas abertas, sem identificação</p>
      <div class="comments">${cs.slice().reverse().map(c => `<div class="comment">“${esc(c)}”</div>`).join("")}</div></div>`;
  }

  /* ============================================================
     MISSÃO MOLECULAR
     ============================================================ */
  function renderMissao(){
    const el = $("an-content");
    // usa só a 1ª conclusão de cada aluno (ignora "Repetição")
    const rows = DATA.missao.filter(r => String(r.status || r.Status || "") !== "Repetição");
    if (!rows.length){ el.innerHTML = `<div class="card" style="text-align:center"><p class="muted">Nenhuma missão concluída ainda.${DATA.sorteio.length ? ` ${DATA.sorteio.length} aluno(s) já sortearam a molécula.` : ""}</p></div>`; return; }
    const af = rows.map(r => num(r.afinidade)).filter(x => x !== null);
    const best = rows.slice().sort((a, b) => num(a.afinidade) - num(b.afinidade))[0];
    const tempos = rows.map(r => num(r.tempo_min)).filter(x => x !== null);
    const sorteadas = DATA.sorteio.length || rows.length;

    el.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="k">Missões concluídas</div><div class="v">${rows.length}</div><div class="s">${sorteadas} molécula(s) sorteada(s) de ${MOLECULAS.length}</div></div>
        <div class="kpi"><div class="k">Afinidade média</div><div class="v">${f(mean(af))}</div><div class="s">kcal/mol · DP ${f(sd(af))}</div></div>
        <div class="kpi"><div class="k">Melhor afinidade</div><div class="v">${f(num(best.afinidade))}</div><div class="s">${esc(best.molecula)}</div></div>
        <div class="kpi"><div class="k">Tempo médio</div><div class="v">${f(mean(tempos), 0)}</div><div class="s">minutos por missão</div></div>
      </div>

      ${resultadoFinal(rows)}

      <div class="chart-card">
        <h3>Ranking de afinidade (docking)</h3>
        <p class="sub">Melhor score de cada molécula entre os três alvos. Quanto mais negativo, maior a afinidade prevista.</p>
        <div class="chart-box" style="height:${Math.max(260, rows.length * 28 + 60)}px"><canvas id="ch-rank"></canvas></div>
        <div class="interp" id="interp-rank"></div>
      </div>

      <div class="grid-2">
        <div class="chart-card">
          <h3>Classificação no ArboMol</h3>
          <p class="sub">Classe atribuída a cada molécula</p>
          <div class="chart-box"><canvas id="ch-classe"></canvas></div>
          <div class="interp" id="interp-classe"></div>
        </div>
        <div class="chart-card">
          <h3>ArboMol × docking</h3>
          <p class="sub">Confiança do ArboMol (x) contra a afinidade do docking (y)</p>
          <div class="chart-box"><canvas id="ch-scatter"></canvas></div>
          <div class="interp" id="interp-scatter"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="chart-card">
          <h3>Onde os alunos mais erraram</h3>
          <p class="sub">Média de tentativas erradas por etapa</p>
          <div class="chart-box"><canvas id="ch-erros"></canvas></div>
          <div class="interp" id="interp-erros"></div>
        </div>
        <div class="chart-card">
          <h3>Regra de Lipinski</h3>
          <p class="sub">Número de violações por molécula</p>
          <div class="chart-box"><canvas id="ch-lip"></canvas></div>
          <div class="interp" id="interp-lip"></div>
        </div>
      </div>

      <div class="chart-card">
        <h3>Resultados por aluno</h3>
        <p class="sub">Ordem de chegada</p>
        <div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>Aluno</th><th>Molécula</th><th>Massa</th><th>ArboMol</th><th>Conf.</th><th>Dengue</th><th>Zika</th><th>Chik.</th><th>Melhor alvo</th><th>Tempo</th></tr></thead><tbody>
        ${rows.slice().sort((a, b) => (num(a.posicao) ?? 999) - (num(b.posicao) ?? 999)).map(r => `<tr>
          <td class="num">${esc(r.posicao ?? "")}</td><td>${esc(r.nome)}</td><td>${esc(r.molecula)}</td><td class="num">${esc(r.massa_molar)}</td>
          <td>${esc(r.arbomol_classe)} <span class="muted small">${esc(VER[r.arbomol_veredito] || r.arbomol_veredito)}</span></td><td class="num">${esc(r.arbomol_confianca)}</td>
          ${DOEN.map(d => { const v = afs(r)[d]; return `<td class="num"${v !== undefined && doencaDock(r) === d ? ` style="color:${COR_D[d]}; font-weight:700"` : ""}>${v !== undefined ? f(v) : "—"}</td>`; }).join("")}<td>${esc(doencaDock(r))} <span class="muted small">${esc((perfil(r) || {}).tipo || "")}</span></td><td class="num">${esc(r.tempo_min)}</td></tr>`).join("")}
        </tbody></table></div>
      </div>

      <div class="chart-card"><h3>🧠 Conclusões dos alunos</h3><p class="sub">Texto da etapa 5</p>
        <div class="comments">${rows.map(r => `<div class="comment"><b>${esc(r.nome)}</b> · <span class="muted">${esc(r.molecula)}</span><br>${esc(r.conclusao)}</div>`).join("")}</div></div>`;

    chartPerfil3(rows);
    // ranking
    const rk = rows.filter(r => num(r.afinidade) !== null).sort((a, b) => num(a.afinidade) - num(b.afinidade));
    const faixaCor = v => v <= -8 ? C.teal : v <= -6 ? C.blue : C.purple;
    mk("ch-rank", {
      type: "bar",
      data: { labels: rk.map(r => `${r.molecula} · ${String(r.nome).split(" ")[0]}`),
        datasets: [{ label: "Afinidade (kcal/mol)", data: rk.map(r => num(r.afinidade)), backgroundColor: rk.map(r => faixaCor(num(r.afinidade))), borderSkipped: "start", barPercentage: .7 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: { x: { ...axisCommon, reverse: true, max: 0, title: { display: true, text: "afinidade (kcal/mol), mais negativo = melhor", color: C.muted } }, y: { ...noGrid, ticks: { color: C.ink } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          title: it => rk[it[0].dataIndex].molecula,
          label: it => { const r = rk[it.dataIndex]; return [` ${f(it.raw)} kcal/mol (melhor alvo: ${doencaDock(r) || "?"}, ${r.pdb})`, ` Aluno: ${r.nome}`, ` ArboMol: ${r.arbomol_classe} (${VER[r.arbomol_veredito] || r.arbomol_veredito})`]; } } } } }
    });
    const nf = af.filter(v => v <= -8).length, nmod = af.filter(v => v > -8 && v <= -6).length, nfr = af.filter(v => v > -6).length;
    $("interp-rank").innerHTML = `<b>${esc(rk[0].molecula)}</b> obteve a melhor afinidade prevista (${f(num(rk[0].afinidade))} kcal/mol, alvo ${esc(rk[0].pdb)}). ` +
      `Faixas: <span style="color:${C.teal}">■</span> forte (≤ −8): <b>${nf}</b> · <span style="color:${C.blue}">■</span> moderada (−6 a −8): <b>${nmod}</b> · <span style="color:${C.purple}">■</span> fraca (&gt; −6): <b>${nfr}</b>. ` +
      `<br><span class="small">Atenção: compare apenas moléculas dockadas <b>no mesmo alvo</b>. Scores de proteínas diferentes não são diretamente comparáveis.</span>`;

    // classes
    const cls = ["Dengue", "Zika", "Chikungunya", "Nenhuma"];
    const cc = cls.map(c => rows.filter(r => r.arbomol_classe === c).length);
    mk("ch-classe", {
      type: "bar",
      data: { labels: cls.map(c => c === "Nenhuma" ? "Nenhuma (improvável)" : c), datasets: [{ label: "Moléculas", data: cc, backgroundColor: [C.blue, C.teal, C.purple, "#5c6475"], borderSkipped: "start", barPercentage: .6 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: noGrid, y: { ...axisCommon, beginAtZero: true, ticks: { color: C.muted, precision: 0 } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => ` ${it.raw} molécula(s) (${pct(it.raw / rows.length)})` } } } }
    });
    const vc = { provavel: 0, possivel: 0, improvavel: 0 };
    rows.forEach(r => { if (vc[r.arbomol_veredito] !== undefined) vc[r.arbomol_veredito]++; });
    const top = cls.slice(0, 3).map((c, i) => [c, cc[i]]).sort((a, b) => b[1] - a[1])[0];
    $("interp-classe").innerHTML = `${vc.provavel} molécula(s) com veredito <b>provável</b>, ${vc.possivel} <b>possível</b> e ${vc.improvavel} <b>improvável</b>. ` +
      (top[1] ? `Entre as classificadas, a classe mais frequente foi <b>${top[0]}</b> (${top[1]}).` : "") +
      ` <span class="small">O ArboMol indica semelhança com compostos de programas anti-arbovírus, não atividade medida.</span>`;

    // scatter
    const pts = rows.map(r => ({ x: num(r.arbomol_confianca), y: num(r.afinidade), r })).filter(p => p.x !== null && p.y !== null);
    mk("ch-scatter", {
      type: "scatter",
      data: { datasets: [{ label: "Moléculas", data: pts, backgroundColor: C.blue, borderColor: C.surface, borderWidth: 2, pointRadius: 6, pointHoverRadius: 9 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: { ...axisCommon, min: 0, max: 1, title: { display: true, text: "confiança do ArboMol", color: C.muted } },
                  y: { ...axisCommon, reverse: true, title: { display: true, text: "afinidade (kcal/mol)", color: C.muted } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => { const p = pts[it.dataIndex]; return ` ${p.r.molecula}: confiança ${f(p.x, 2)} · ${f(p.y)} kcal/mol`; } } } } }
    });
    const r = pearson(pts.map(p => p.x), pts.map(p => p.y));
    $("interp-scatter").innerHTML = isFinite(r)
      ? `Correlação de Pearson r = <b>${f(r, 2)}</b> (${forca(r)}). ${r <= -0.2 ? "Moléculas com maior confiança no ArboMol tenderam a ter afinidades <b>mais negativas</b>: as duas abordagens apontam na mesma direção." : r >= 0.2 ? "Maior confiança no ArboMol veio acompanhada de afinidades <b>menos negativas</b>: as abordagens divergem, o que é um bom tema de discussão." : "Não há relação clara entre os dois resultados: classificação por semelhança e docking respondem a perguntas diferentes."}`
      : "A correlação é calculada a partir de 4 moléculas.";

    // erros
    const etapas = [["SMILES", "erros_smiles"], ["Propriedades", "erros_propriedades"], ["ArboMol", "erros_arbomol"], ["Docking", "erros_docking"], ["Conclusão", "erros_conclusao"]];
    const em = etapas.map(([, k]) => mean(rows.map(r => num(r[k]) ?? 0)));
    mk("ch-erros", {
      type: "bar",
      data: { labels: etapas.map(e => e[0]), datasets: [{ label: "Erros médios", data: em, backgroundColor: C.amber, borderSkipped: "start", barPercentage: .6 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: noGrid, y: { ...axisCommon, beginAtZero: true } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: it => ` ${f(it.raw, 2)} erro(s) por aluno` } } } }
    });
    const ie = em.indexOf(Math.max(...em));
    $("interp-erros").innerHTML = Math.max(...em) > 0
      ? `A etapa com mais dificuldade foi <b>${etapas[ie][0]}</b> (${f(em[ie], 2)} erro por aluno, em média). ${ie === 0 ? "Vale reforçar a sintaxe de SMILES (anéis, ramificações e aromaticidade)." : ie === 1 ? "Vale revisar a contagem de hidrogênios implícitos e o cálculo de massa molar." : ie === 2 ? "Vale revisar como ler os limites de confiança do ArboMol." : ie === 3 ? "Vale revisar o sinal e as unidades do score de docking." : "Vale discutir mais o papel dos resultados in silico como hipóteses."}`
      : "Nenhum erro registrado: a turma foi impecável!";

    // lipinski
    const lv = [0, 1, 2, 3, 4].map(k => rows.filter(r => num(r.lipinski_violacoes) === k).length);
    mk("ch-lip", {
      type: "bar",
      data: { labels: ["0", "1", "2", "3", "4"], datasets: [{ label: "Moléculas", data: lv, backgroundColor: C.teal, borderSkipped: "start", barPercentage: .6 }] },
      options: { responsive: true, maintainAspectRatio: false,
        scales: { x: { ...noGrid, title: { display: true, text: "violações", color: C.muted } }, y: { ...axisCommon, beginAtZero: true, ticks: { color: C.muted, precision: 0 } } },
        plugins: { legend: { display: false } } }
    });
    const ok = lv[0] + lv[1], tot = lv.reduce((a, b) => a + b, 0);
    $("interp-lip").innerHTML = tot ? `<b>${ok}</b> de ${tot} moléculas (${pct(ok / tot)}) são <i>drug-like</i> segundo Lipinski (≤ 1 violação), ou seja, têm perfil compatível com administração oral.` : "Sem dados de Lipinski.";
  }


  /* ---------- 🏁 resultado final: cada molécula docada nos 3 alvos ---------- */
  const DOEN = ["Dengue", "Zika", "Chikungunya"];
  const COR_D = { Dengue: C.blue, Zika: C.teal, Chikungunya: C.purple };
  const ICO_D = { Dengue: "🦟", Zika: "🧬", Chikungunya: "🦠" };
  // energias por doença (registros antigos, com um só docking, usam o campo "afinidade")
  function afs(r){
    const o = {};
    DOEN.forEach(d => { const v = num(r["af_" + d.toLowerCase()]); if (v !== null) o[d] = v; });
    if (!Object.keys(o).length && num(r.afinidade) !== null && r.docking_doenca) o[r.docking_doenca] = num(r.afinidade);
    return o;
  }
  function perfil(r){
    const a = afs(r), ord = Object.entries(a).sort((x, y) => x[1] - y[1]);
    if (!ord.length) return null;
    const delta = ord.length > 1 ? ord[1][1] - ord[0][1] : NaN;
    const fortes = ord.filter(o => o[1] <= -7).length;
    const tipo = ord.length < 3 ? "" : (fortes >= 2 && ord[2][1] - ord[0][1] <= 1.5) ? "promíscua" : delta >= 1 ? "seletiva" : "sem preferência clara";
    return { ord, melhor: ord[0][0], af: ord[0][1], delta, tipo };
  }
  const indicada = r => r.arbomol_classe && r.arbomol_classe !== "Nenhuma";
  const doencaDock = r => (perfil(r) || {}).melhor || "";
  const arboTxt = r => indicada(r)
    ? `foi indicada para <b>${esc(r.arbomol_classe)}</b> no ArboMol (${esc(VER[r.arbomol_veredito] || r.arbomol_veredito)}, confiança ${f(num(r.arbomol_confianca), 2)})`
    : `<b>não foi indicada no ArboMol</b> (confiança ${f(num(r.arbomol_confianca), 2)})`;

  function resultadoFinal(rows){
    const ok = rows.filter(r => perfil(r));
    const primeiro = n => String(n || "").split(/\s+/)[0];
    const kcal = v => f(v) + " kcal/mol";
    const faixa = v => v <= -8 ? "forte" : v <= -6 ? "moderada" : "fraca";

    // cartão por doença: a melhor molécula da turma naquele alvo (todos docaram nos 3)
    const cards = DOEN.map(d => {
      const lista = ok.filter(r => afs(r)[d] !== undefined).sort((x, y) => afs(x)[d] - afs(y)[d]);
      const cor = COR_D[d];
      if (!lista.length) return `<div class="tile" style="border-color:${cor}55"><div style="font-size:1.6rem">${ICO_D[d]}</div><h3>${d}</h3><p class="muted small">Sem dockings neste alvo.</p></div>`;
      const c = lista[0], v = afs(c)[d];
      const nota = indicada(c) ? (c.arbomol_classe === d ? `✔ O ArboMol também indicou ${d}` : `ArboMol indicou ${esc(c.arbomol_classe)}: uma surpresa!`) : "Não indicada no ArboMol: uma surpresa!";
      return `<div class="tile" style="border-color:${cor}88; background: linear-gradient(180deg, ${cor}1a, transparent)">
          <div style="font-size:1.6rem">${ICO_D[d]}</div>
          <p class="small muted" style="text-transform:uppercase; letter-spacing:.6px">Melhor candidata contra ${d}</p>
          <h3 style="font-size:1.35rem; margin:.2em 0">${esc(c.molecula)}</h3>
          <p>de <b>${esc(c.nome)}</b></p>
          <p class="mono" style="font-size:1.5rem; font-weight:800; color:${cor}; margin:.3em 0">${kcal(v)}</p>
          <p class="small muted">${esc(c["alvo_" + d.toLowerCase()] || "")} · ${esc(c["pdb_" + d.toLowerCase()] || "")}</p>
          <p class="small" style="margin-top:.4em">${nota}</p>
          ${lista.length > 1 ? `<p class="small muted" style="margin-top:.5em">Depois: ${lista.slice(1, 3).map((r, i) => `${i + 2}º ${esc(r.molecula)} (${esc(primeiro(r.nome))}, ${kcal(afs(r)[d])})`).join(" · ")}</p>` : ""}
        </div>`;
    }).join("");

    // frase por aluno
    const frases = ok.slice().sort((x, y) => perfil(x).af - perfil(y).af).map(r => {
      const p = perfil(r);
      const lista = p.ord.map(([d, v], i) => i === 0 ? `<b>maior afinidade por ${d}</b> (${kcal(v)}, ${faixa(v)})` : `${d} (${kcal(v)})`);
      const docTxt = lista.length > 1 ? `${lista[0]}, seguida de ${lista.slice(1).join(" e ")}` : lista[0];
      const tipo = p.tipo === "promíscua" ? ` Perfil <b>promíscuo (multialvo)</b>.` : p.tipo === "seletiva" ? ` Perfil <b>seletivo</b> (${f(p.delta)} kcal/mol à frente do 2º alvo).` : p.tipo ? " Sem preferência clara entre os alvos." : "";
      let conc = "";
      if (indicada(r)) conc = r.arbomol_classe === p.melhor
        ? ` <span style="color:${C.teal}">✔ ArboMol e docking apontam para a mesma doença.</span>`
        : ` <span style="color:#ffcf8a">⚡ O docking favoreceu outra doença que não a indicada pelo ArboMol.</span>`;
      return `<div class="comment">A molécula de <b>${esc(r.nome)}</b>, <b>${esc(r.molecula)}</b>, ${arboTxt(r)}. No docking teve ${docTxt}.${tipo}${conc}</div>`;
    }).join("");

    const comInd = ok.filter(indicada);
    const concordam = comInd.filter(r => r.arbomol_classe === perfil(r).melhor).length;
    const prom = ok.filter(r => perfil(r).tipo === "promíscua");
    const surpresa = ok.filter(r => !indicada(r) && perfil(r).af <= -8);
    return `<div class="chart-card" style="border-color: rgba(34,211,199,0.35)">
        <h3>🏁 Resultado final da turma</h3>
        <p class="sub">Cada molécula foi docada contra um alvo de <b>cada</b> doença. Para cada vírus, a molécula da turma com a <b>menor energia de ligação</b>.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:14px">${cards}</div>
        <div class="interp" style="margin-top:14px">
          ${comInd.length ? `🎯 Entre as ${comInd.length} moléculas indicadas pelo ArboMol, <b>${concordam}</b> (${pct(concordam / comInd.length)}) tiveram a melhor energia justamente no alvo da doença indicada; nas outras ${comInd.length - concordam}, o docking favoreceu outro vírus.<br>` : ""}
          ${prom.length ? `🔀 <b>${prom.length}</b> molécula(s) com perfil <b>promíscuo</b> (boas em vários alvos): ${prom.map(r => esc(r.molecula)).join(", ")}.<br>` : ""}
          ${surpresa.length ? `💡 Não indicadas no ArboMol, mas com afinidade forte (≤ −8): ${surpresa.map(r => esc(r.molecula)).join(", ")}. Lembre que as ferramentas respondem a perguntas diferentes (semelhança × encaixe).` : ""}
        </div>
        <h3 style="margin-top:22px">Perfil de afinidade nos 3 alvos</h3>
        <p class="sub">Energia de ligação de cada molécula em cada alvo. Barras maiores indicam ligação mais forte.</p>
        <div class="chart-box" style="height:${Math.max(280, ok.length * 46 + 70)}px"><canvas id="ch-perfil3"></canvas></div>
        <h3 style="margin-top:22px">Molécula por molécula</h3>
        <p class="sub">Da maior para a menor afinidade prevista</p>
        <div class="comments">${frases || "<p class='muted'>Sem resultados de docking.</p>"}</div>
        <div class="interp" style="margin-top:14px">⚠️ Estes resultados são <b>hipóteses computacionais</b>. Energias só são comparáveis <b>no mesmo alvo</b>; entre alvos diferentes, use-as como tendência. O próximo passo seria dinâmica molecular e ensaios <i>in vitro</i>.</div>
      </div>`;
  }
  function chartPerfil3(rows){
    const ok = rows.filter(r => perfil(r)).sort((x, y) => perfil(x).af - perfil(y).af);
    if (!ok.length) return;
    mk("ch-perfil3", {
      type: "bar",
      data: { labels: ok.map(r => `${r.molecula} · ${String(r.nome).split(" ")[0]}`),
        datasets: DOEN.map(d => ({ label: d, data: ok.map(r => afs(r)[d] ?? null), backgroundColor: COR_D[d],
          borderColor: C.surface, borderWidth: 2, borderSkipped: "start", barPercentage: .85, categoryPercentage: .8 })) },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
        scales: { x: { ...axisCommon, reverse: true, max: 0, title: { display: true, text: "energia de ligação (kcal/mol), mais negativo = melhor", color: C.muted } },
                  y: { ...noGrid, ticks: { color: C.ink } } },
        plugins: { legend: { position: "top", align: "end" },
          tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${f(it.raw)} kcal/mol` + (perfil(ok[it.dataIndex]).melhor === it.dataset.label ? "  🥇" : "") } } } }
    });
  }

  /* ---------- CSV ---------- */
  function baixarCSV(rows, nome){
    if (!rows.length) return;
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "﻿" + [cols.map(q).join(";"), ...rows.map(r => cols.map(c => q(r[c])).join(";"))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = nome; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- dados fictícios para pré-visualização ---------- */
  function dadosExemplo(){
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const questionario = Array.from({ length: 24 }, () => {
      const r = { perfil: pick(["Licenciatura", "Licenciatura", "Ensino Técnico", "Bacharelado", "Pós-graduação"]) };
      const a = Math.floor(rnd() * 2); r.conhecimento_antes = CONHEC[a];
      r.conhecimento_depois = CONHEC[Math.min(3, a + (rnd() < .8 ? 1 : 0) + (rnd() < .25 ? 1 : 0))];
      const base = 3.6 + rnd() * 1.2;
      QUESTIONARIO.likert.forEach((q, i) => { r[q.id] = Math.max(1, Math.min(5, Math.round(base + (rnd() - .5) * 1.6 - (i === 7 ? .8 : 0) - (i === 4 ? .4 : 0)))); });
      r.nota = Math.max(5, Math.min(10, Math.round(base * 2 + rnd())));
      r.comentario = rnd() < .3 ? pick(["Adorei a missão com a molécula!", "Poderia ter mais tempo para o docking.", "A apresentação foi muito dinâmica.", "Quero aprender mais sobre IA na química."]) : "";
      return r;
    });
    const nomes = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Alves", "Elisa Rocha", "Felipe Melo", "Gabi Nunes", "Heitor Reis", "Iara Costa", "João Pires", "Kátia Luz", "Lucas Faria", "Marina Teles", "Nícolas Brito"];
    const missao = nomes.map((nome, i) => {
      const conf = +(rnd()).toFixed(2);
      const ver = conf >= .5 ? "provavel" : conf >= .35 ? "possivel" : "improvavel";
      return { posicao: i + 1, nome, turma: "Minicurso", molecula: MOLECULAS[i % MOLECULAS.length].nome, massa_molar: "",
        lipinski_violacoes: rnd() < .85 ? 0 : 1, arbomol_veredito: ver, arbomol_confianca: conf,
        arbomol_classe: ver === "improvavel" ? "Nenhuma" : pick(["Dengue", "Dengue", "Zika", "Chikungunya"]),
        ...(() => {
          const base = -5 - rnd() * 3.5, o = {};
          [["dengue", "0DEN", "Alvo exemplo (dengue)"], ["zika", "0ZIK", "Alvo exemplo (zika)"], ["chikungunya", "0CHK", "Alvo exemplo (chikungunya)"]]
            .forEach(([k, pdb, alvo]) => { o["af_" + k] = +(base - rnd() * 2.2).toFixed(1); o["pdb_" + k] = pdb; o["alvo_" + k] = alvo; });
          const best = Object.entries({ Dengue: o.af_dengue, Zika: o.af_zika, Chikungunya: o.af_chikungunya }).sort((a, b) => a[1] - b[1])[0];
          return { ...o, docking_doenca: best[0], afinidade: best[1], pdb: o["pdb_" + best[0].toLowerCase()], alvo: o["alvo_" + best[0].toLowerCase()] };
        })(),
        erros_smiles: Math.floor(rnd() * 3), erros_propriedades: Math.floor(rnd() * 2.5), erros_arbomol: Math.floor(rnd() * 1.3), erros_docking: Math.floor(rnd() * 1.2), erros_conclusao: Math.floor(rnd() * 1.5),
        tempo_min: +(18 + rnd() * 20).toFixed(1), conclusao: "A molécula apresentou afinidade moderada pelo alvo e deve ser avaliada por dinâmica molecular.", status: "Concluiu" };
    });
    return { questionario, missao, sorteio: missao };
  }

  document.addEventListener("DOMContentLoaded", () => { $("btn-analisar").onclick = analisar; });
  return { analisar };
})();
window.Analise = Analise;
