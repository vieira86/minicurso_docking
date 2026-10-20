/* ============================================================
   moleculas.js — banco de moléculas da Missão Molecular
   ============================================================

   16 moléculas. Os SMILES vieram do arquivo moleculas.xlsx
   (coluna "smiles") e foram conferidos um a um: todos são
   estruturas válidas.

   O aluno NÃO precisa desenhar a molécula: a página mostra o
   SMILES abaixo da figura, com um botão para copiar.

   Se quiser que o nome da molécula apareça para o aluno, basta
   preencher o campo "nome" (ex.: nome: "Molnupiravir").
   Em branco, a página mostra apenas "Molécula nº 01".

   ATENÇÃO: depois que a turma começar a sortear, NÃO mude a ordem
   da lista — a planilha guarda o NÚMERO da molécula de cada aluno.
   Para acrescentar moléculas, adicione sempre no FINAL.
   ============================================================ */

const MOLECULAS = [
  { nome: "", smiles: "CC[C@@H](C(O[C@H]1C[C@@H](C)C=C2[C@H]1[C@@H](CC[C@@H]3C[C@@H](O)CC(O3)=O)[C@@H](C)C=C2)=O)C", imagem: "moleculas/mol1.png" },
  { nome: "", smiles: "CCOC(C1=C(c2ccc(N3C(C)=NC4=C3C=CN=C4)cc2)NC(C)=C(C(Nc5ncccc5)=O)[C@H]1c6cc(Cl)ccc6)=O", imagem: "moleculas/mol2.png" },
  { nome: "", smiles: "Nc1ncnc2c1[nH]cc2[C@H]3[C@H](O)[C@H](O)[C@@H](CO)N3", imagem: "moleculas/mol3.png" },
  { nome: "", smiles: "O=C(/C=C/c1cc(OCO2)c2cc1)c3ccc(NS(=O)(c4ccc(Cl)cc4)=O)cc3", imagem: "moleculas/mol4.png" },
  { nome: "", smiles: "OC1=C(C[C@H](O)[C@@H](C2=CC(O)=C(O)C=C2)O3)C3=CC(O)=C1", imagem: "moleculas/mol5.png" },
  { nome: "", smiles: "C[C@@H]1CC(C=C(OC)[C@]12C(C3=C(C(Cl)=C(OC)C=C3OC)O2)=O)=O", imagem: "moleculas/mol6.png" },
  { nome: "", smiles: "c1(c2onc(c3ccc(NCc4cnccc4)cc3)n2)ccccc1", imagem: "moleculas/mol7.png" },
  { nome: "", smiles: "CCCNC(C1CCN(C(C2=CC3=C(C=C(c4ccccc4)S3)N2Cc5ccc(OC)cc5)=O)CC1)=O", imagem: "moleculas/mol8.png" },
  { nome: "", smiles: "OC(COc1cc2c(C=CC(O2)=O)cc1)CNC3CCN(CC3)Cc4ccccc4", imagem: "moleculas/mol9.png" },
  { nome: "", smiles: "CC(C(OC[C@@H]1[C@@H](O)[C@@H](O)[C@H](n(ccc(NO)n2)c2=O)O1)=O)C", imagem: "moleculas/mol10.png" },
  { nome: "", smiles: "CCC(C(C(N(C(C(C)C)C(Cc1scc(/C(O)=N/C(CC(C(O)=O)C)Cc2ccccc2)n1)=O)CO)=O)/N=C(C3CCCCN3C)\\O)C", imagem: "moleculas/mol11.png" },
  { nome: "", smiles: "COc1cc(OC)cc(NC(c2nnc(c(ccn3)c4c3cccc4)o2)c5ccc(F)cc5)c1", imagem: "moleculas/mol12.png" },
  { nome: "", smiles: "CN1O[C@]2([C@@H](c3ccccc3)[C@@H]1c4cc(Br)ccc4)Oc5c(C2NS(=O)(c6ccc(C)cc6)=O)cccc5", imagem: "moleculas/mol13.png" },
  { nome: "", smiles: "CCCC(O[C@H]1CN2CC[C@H](O)[C@@H]2[C@@H](O)[C@@H]1O)=O", imagem: "moleculas/mol14.png" },
  { nome: "", smiles: "COc1c(OC)cc(CN/C(N)=N/C(N)=N)cc1", imagem: "moleculas/mol15.png" },
  { nome: "", smiles: "CC(OCC(Cc1c(Cl)cccc1)(c2ncccc2)CO)=O", imagem: "moleculas/mol16.png" }
];
