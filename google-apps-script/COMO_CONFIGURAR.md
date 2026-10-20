# Minicurso Docking: configurar a planilha (Google Sheets + Apps Script)

Este script é **próprio deste minicurso**, com planilha e URL separadas dos outros projetos.

## Passo a passo

1. Crie uma **nova planilha** no Google Sheets (ex.: "Minicurso Docking — Registros").
2. Na planilha: **Extensões → Apps Script**.
3. Apague o conteúdo padrão, cole todo o `Code.gs` desta pasta e salve.
4. **Implantar → Nova implantação** → tipo **App da Web**.
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Autorize o acesso quando o Google pedir.
5. Copie a URL do Web App (termina em `/exec`) e cole em
   `assets/js/config.js`, na constante **`WEBAPP_URL`**.
6. Faça commit/push do site.

Para testar, abra a URL do Web App no navegador. Deve aparecer "Minicurso Docking: Web App ativo."
Para ver os dados que o painel usa, acrescente `?acao=dados` no fim da URL.

Se alterar o `Code.gs` depois, publique uma **nova versão** (Implantar → Gerenciar implantações → ✏️ →
Nova versão → Implantar). Só salvar no editor não atualiza o Web App.

## Abas criadas automaticamente

| Aba | O que guarda |
|---|---|
| **Sorteio** | Data, nome, turma e número da molécula de cada aluno. É ela que garante que **nenhuma molécula se repete**. |
| **Missão** | Resultado completo de cada missão: SMILES, massa molar, Lipinski, ArboMol (veredito, confiança, classe), docking nos 3 alvos (`af_dengue`, `af_zika`, `af_chikungunya`, PDBs e controles), melhor alvo e perfil (seletiva/promíscua), conclusão escrita, erros por etapa, tempo e **posição de chegada**. |
| **Questionário** | Uma linha por resposta: perfil, conhecimento antes/depois, as 10 afirmações (1 a 5), nota (0 a 10) e comentário. |

## Como funciona o sorteio sem repetição

- O sorteio acontece **no servidor**, com uma trava (`LockService`): mesmo que dois alunos cliquem no mesmo
  segundo, cada um recebe uma molécula diferente.
- Se o mesmo **nome + turma** sortear de novo, recebe **a mesma molécula** (não "gasta" outra).
- Quando todas as moléculas da lista forem sorteadas, o site avisa que acabaram.
- Por padrão, nenhuma molécula se repete entre **ninguém**. Para sortear de novo em outra turma, mude no
  topo do `Code.gs` para `const SORTEIO_POR_TURMA = true;` e publique uma nova versão.
- Para **recomeçar do zero** (novo minicurso): no editor do Apps Script, escolha a função
  `arquivarSorteio` e clique em ▶ Executar. A aba atual é renomeada (nada é apagado) e o próximo sorteio
  cria uma aba nova.

## Trocar as moléculas

Edite `moleculas/moleculas.js` (nome + SMILES) e coloque as figuras `mol01.png` … `mol20.png` na pasta
`moleculas/`. **Não mude a ordem da lista depois que a turma começar a sortear**, porque a planilha guarda o
número da molécula.
