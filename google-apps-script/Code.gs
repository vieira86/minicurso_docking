/**
 * Code.gs — Minicurso "Docking Molecular & Química Computacional"
 * Prof. Dr. Rafael Vieira · IFRO
 *
 * Script PRÓPRIO deste minicurso (planilha separada dos outros projetos).
 * Passo a passo em COMO_CONFIGURAR.md, nesta pasta.
 *
 * O que ele faz:
 *   POST tipo "sorteio"      → sorteia uma molécula SEM REPETIÇÃO (aba "Sorteio")
 *   POST tipo "missao"       → grava o resultado da Missão Molecular (aba "Missão")
 *   POST tipo "questionario" → grava as respostas do questionário (aba "Questionário")
 *   GET  ?acao=dados         → devolve tudo em JSON para o botão "Análise de Dados"
 *
 * As abas são criadas sozinhas. Nas abas "Missão" e "Questionário" as colunas
 * também são criadas sozinhas a partir dos campos enviados pelo site. Se você
 * acrescentar uma pergunta no config.js, aparece uma coluna nova no final.
 */

// true  = cada TURMA tem seu próprio sorteio (a mesma molécula pode sair em turmas diferentes)
// false = nenhuma molécula se repete entre ninguém, em nenhuma turma
const SORTEIO_POR_TURMA = false;

const ABA_SORTEIO = "Sorteio";
const ABA_MISSAO = "Missão";
const ABA_QUEST = "Questionário";
const SORTEIO_HEADERS = ["Data/Hora", "Nome", "Turma", "Molécula nº", "indice"];

function doGet(e) {
  const acao = e && e.parameter && e.parameter.acao;
  if (acao === "dados") {
    return json_({
      status: "ok",
      questionario: lerAba_(ABA_QUEST),
      missao: lerAba_(ABA_MISSAO),
      sorteio: lerAba_(ABA_SORTEIO)
    });
  }
  return ContentService.createTextOutput("Minicurso Docking: Web App ativo.").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json_({ status: "error", message: "Sistema ocupado, tente novamente em alguns segundos." });
  }
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.tipo === "sorteio") return sorteio_(data);
    if (data.tipo === "missao") return missao_(data);
    if (data.tipo === "questionario") return questionario_(data);
    return json_({ status: "error", message: "Tipo de registro desconhecido." });
  } catch (err) {
    return json_({ status: "error", message: err.message });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- utilitários ---------------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
const norm_ = v => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

function aba_(nome, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (headers && sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

// garante que todas as chaves existam como colunas; devolve a lista de cabeçalhos
function garantirColunas_(sh, chaves) {
  let headers = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  const novas = chaves.filter(k => headers.indexOf(k) === -1);
  if (novas.length) {
    sh.getRange(1, headers.length + 1, 1, novas.length).setValues([novas]).setFontWeight("bold");
    headers = headers.concat(novas);
    sh.setFrozenRows(1);
  }
  return headers;
}

// grava uma linha; textos digitados ficam como TEXTO PURO (evita "=", "+" virarem fórmula)
function gravarLinha_(sh, headers, obj) {
  const row = sh.getLastRow() + 1;
  const vals = headers.map(h => (obj[h] === undefined || obj[h] === null) ? "" : obj[h]);
  headers.forEach((h, i) => { if (typeof vals[i] === "string") sh.getRange(row, i + 1).setNumberFormat("@"); });
  sh.getRange(row, 1, 1, vals.length).setValues([vals]);
}

function lerAba_(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh || sh.getLastRow() < 2) return [];
  const vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const h = vals[0].map(String);
  return vals.slice(1).map(r => {
    const o = {};
    h.forEach((k, i) => { o[k] = r[i] instanceof Date ? r[i].toISOString() : r[i]; });
    return o;
  });
}

/* ---------------- SORTEIO SEM REPETIÇÃO ---------------- */
function sorteio_(data) {
  const total = Math.floor(Number(data.total) || 0);
  if (total < 1) return json_({ status: "error", message: "Lista de moléculas vazia." });
  const nome = String(data.nome || "").trim(), turma = String(data.turma || "").trim();
  if (!nome || !turma) return json_({ status: "error", message: "Nome e turma são obrigatórios." });

  const sh = aba_(ABA_SORTEIO, SORTEIO_HEADERS);
  const usados = {};
  if (sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, SORTEIO_HEADERS.length).getValues();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      // mesmo aluno voltando → mesma molécula
      if (norm_(r[1]) === norm_(nome) && norm_(r[2]) === norm_(turma)) {
        return json_({ status: "ok", indice: Number(r[4]), repetido: true });
      }
      if (!SORTEIO_POR_TURMA || norm_(r[2]) === norm_(turma)) usados[Number(r[4])] = true;
    }
  }
  const livres = [];
  for (let i = 0; i < total; i++) if (!usados[i]) livres.push(i);
  if (!livres.length) return json_({ status: "esgotado" });

  const indice = livres[Math.floor(Math.random() * livres.length)];
  gravarLinha_(sh, SORTEIO_HEADERS, { "Data/Hora": new Date(), "Nome": nome, "Turma": turma, "Molécula nº": indice + 1, "indice": indice });
  return json_({ status: "ok", indice: indice, repetido: false, restantes: livres.length - 1 });
}

/* ---------------- MISSÃO MOLECULAR ---------------- */
function missao_(data) {
  const sh = aba_(ABA_MISSAO);
  const campos = Object.assign({}, data);
  delete campos.tipo;
  const chaves = ["data_servidor", "posicao", "status"].concat(Object.keys(campos));
  const headers = garantirColunas_(sh, chaves);

  // posição de chegada: conta quem já concluiu; repetição mantém a posição original
  let posicao = null, concluiram = 0;
  if (sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
    const iN = headers.indexOf("nome"), iT = headers.indexOf("turma"), iP = headers.indexOf("posicao"), iS = headers.indexOf("status");
    rows.forEach(r => {
      if (r[iS] === "Concluiu") {
        concluiram++;
        if (posicao === null && norm_(r[iN]) === norm_(data.nome) && norm_(r[iT]) === norm_(data.turma)) posicao = r[iP];
      }
    });
  }
  const repetido = posicao !== null;
  if (!repetido) posicao = concluiram + 1;
  campos.data_servidor = new Date();
  campos.posicao = posicao;
  campos.status = repetido ? "Repetição" : "Concluiu";
  gravarLinha_(sh, headers, campos);
  return json_({ status: "ok", posicao: posicao, repetido: repetido });
}

/* ---------------- QUESTIONÁRIO ---------------- */
function questionario_(data) {
  const sh = aba_(ABA_QUEST);
  const resp = Object.assign({ data_servidor: new Date(), data_aluno: data.dataHora || "" }, data.respostas || {});
  const headers = garantirColunas_(sh, Object.keys(resp));
  gravarLinha_(sh, headers, resp);
  return json_({ status: "ok" });
}

/* ---------------- ferramenta do professor ----------------
   Para recomeçar o sorteio (nova turma, novo minicurso), selecione esta função
   no editor e clique em ▶ Executar. Ela RENOMEIA a aba atual para
   "Sorteio (arquivo dd/mm hh:mm)", sem apagar nada.                          */
function arquivarSorteio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA_SORTEIO);
  if (sh) sh.setName(ABA_SORTEIO + " (arquivo " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM HH:mm") + ")");
}
