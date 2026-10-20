# Minicurso: Docking Molecular & Química Computacional

Página única com quatro seções (menu no topo):

| Seção | O que é |
|---|---|
| 🎬 **Apresentação** | 19 slides "estilo vídeo": cada clique revela a próxima informação. Teclas → / ←, **F** = tela cheia, **P** = reproduzir automaticamente. No celular, deslize. |
| 🧬 **Missão Molecular** | O aluno digita nome e turma, **sorteia uma molécula exclusiva** (sem repetição) e passa por 5 etapas: copiar o SMILES (já vem pronto) → propriedades/Lipinski → ArboMol → Dynamic Dock **nos 3 alvos** (dengue, zika e chikungunya) → conclusão. Tudo vai para a planilha. |
| 📝 **Questionário** | Percepção do minicurso, só com cliques (Likert de 1 a 5, antes/depois, nota de 0 a 10). |
| 📊 **Análise de Dados** | Botão que lê a planilha e gera gráficos e interpretações automáticas (concordância, Wilcoxon antes × depois, alfa de Cronbach, ranking de docking, correlação ArboMol × docking, etapas com mais erros). Exporta CSV. |

## Estrutura

```
index.html                 página única
assets/css/style.css       visual (mesmo padrão do site pessoal)
assets/js/config.js        ← URL do Apps Script, alvos do docking (PDB de cada vírus), links e perguntas
assets/js/slides.js        motor da apresentação
assets/js/missao.js        Missão Molecular
assets/js/questionario.js  questionário
assets/js/analise.js       análise de dados
moleculas/moleculas.js     ← lista das 16 moléculas (SMILES; o "nome" é opcional)
moleculas/mol1.png …       ← figuras das moléculas
google-apps-script/        Code.gs + COMO_CONFIGURAR.md
```

## Para colocar no ar

1. Siga `google-apps-script/COMO_CONFIGURAR.md` e cole a URL em `assets/js/config.js`.
2. Troque as moléculas de exemplo em `moleculas/moleculas.js` pelas suas e coloque as figuras.
3. Publique no GitHub Pages, como nos outros sites.

Bibliotecas carregadas da internet: **RDKit.js** (confere SMILES, desenha estruturas e calcula
propriedades) e **Chart.js** (gráficos).
