/* ============================================================
   config.js — configuração geral do minicurso
   ============================================================

   1) Publique o Apps Script (google-apps-script/Code.gs) e cole
      aqui a URL do Web App (termina em /exec).
      Passo a passo: google-apps-script/COMO_CONFIGURAR.md

   Enquanto WEBAPP_URL estiver vazia a página funciona em
   "modo demonstração": o sorteio é feito no próprio navegador
   (sem garantia de não repetir entre alunos) e nada é gravado.
   ============================================================ */

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxnXgv7t4Qn_PjGAuutPdBz4xnhrW5tIXc3Dd3123NSI_l9zoRfwSAsEIi74DWHbEtmnw/exec";

const MINICURSO = {
  titulo: "Docking Molecular & Química Computacional",
  autor: "Prof. Dr. Rafael Vieira",
  instituicao: "IFRO — Instituto Federal de Rondônia",
  // Links das plataformas usadas na Missão Molecular
  arbomolUrl: "https://arbomol.rafaelvieira.org",
  dynamicDockUrl: "https://dynamicdock.rafaelvieira.org"
};

/* ------------------------------------------------------------
   Missão Molecular
   ------------------------------------------------------------ */
const MISSAO = {
  // false = no sorteio o aluno vê só a estrutura e o número;
  // o NOME da molécula aparece depois que ele acerta o SMILES
  // (assim ninguém copia o SMILES da internet).
  revelarNomeNoSorteio: false,
  // Alvos do docking (o aluno doca nos TRÊS). Se você preencher o PDB aqui,
  // o campo já vem preenchido e travado para todos os alunos, e então
  // as energias de alunos diferentes ficam comparáveis (mesmo alvo).
  // Deixe pdb: "" para o aluno escolher o alvo de cada vírus.
  alvos: {
    Dengue:      { pdb: "6MO0", nome: "Dengue" },
    Zika:        { pdb: "7VXY", nome: "Zika" },
    Chikungunya: { pdb: "6W7H", nome: "Chikungunya" }
  }
};

/* ------------------------------------------------------------
   Perguntas do questionário de percepção.
   tipo "likert" = escala de 1 (discordo totalmente) a 5 (concordo totalmente)
   Pode editar os textos à vontade. Se mudar o "id", a planilha
   ganha uma coluna nova automaticamente.
   ------------------------------------------------------------ */
const QUESTIONARIO = {
  perfil: {
    id: "perfil",
    texto: "Qual é a sua formação atual?",
    opcoes: ["Ensino Técnico", "Licenciatura", "Bacharelado", "Pós-graduação", "Outro"]
  },
  conhecimento: {
    opcoes: ["Nenhum", "Básico", "Intermediário", "Avançado"],
    antes: { id: "conhecimento_antes", texto: "ANTES do minicurso, meu conhecimento sobre química computacional/docking era:" },
    depois: { id: "conhecimento_depois", texto: "DEPOIS do minicurso, meu conhecimento sobre química computacional/docking é:" }
  },
  likert: [
    { id: "q1", dim: "Conteúdo",     texto: "Os conceitos de docking molecular foram apresentados de forma clara." },
    { id: "q2", dim: "Conteúdo",     texto: "Entendi como a química computacional ajuda na busca por novos fármacos." },
    { id: "q3", dim: "Conteúdo",     texto: "Os avanços recentes (inteligência artificial, AlphaFold etc.) ficaram compreensíveis." },
    { id: "q4", dim: "Ferramentas",  texto: "Consegui usar o ArboMol sem grandes dificuldades." },
    { id: "q5", dim: "Ferramentas",  texto: "Consegui realizar e interpretar um docking no Dynamic Dock." },
    { id: "q6", dim: "Metodologia",  texto: "O desafio com a minha própria molécula tornou o aprendizado mais interessante." },
    { id: "q7", dim: "Metodologia",  texto: "A apresentação interativa ajudou a manter minha atenção." },
    { id: "q8", dim: "Metodologia",  texto: "A carga horária do minicurso foi adequada." },
    { id: "q9", dim: "Impacto",      texto: "A química computacional é relevante para a minha formação." },
    { id: "q10", dim: "Impacto",     texto: "Tenho interesse em continuar estudando ou pesquisando na área." }
  ],
  nota: { id: "nota", texto: "De 0 a 10, que nota você dá para o minicurso?" },
  comentario: { id: "comentario", texto: "Quer deixar um comentário, sugestão ou elogio? (opcional)" }
};
