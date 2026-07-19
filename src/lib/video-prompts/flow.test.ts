import assert from "node:assert/strict";
import test from "node:test";

import {
  avancarEtapaChat,
  montarContextoDoProjeto,
  montarInstrucaoDaEtapa,
} from "./flow.ts";

test("o fluxo avança sem pular análise, referências e cenas", () => {
  assert.equal(avancarEtapaChat("analise"), "referencias");
  assert.equal(avancarEtapaChat("referencias"), "cenas");
  assert.equal(avancarEtapaChat("cenas"), "gestao");
  assert.equal(avancarEtapaChat("gestao"), "gestao");
});

test("o contexto fixo sempre inclui roteiro e sincronização", () => {
  const contexto = montarContextoDoProjeto({
    roteiro: "Uma viajante encontra uma cidade perdida.",
    sincronizacao: "PROMPT 001 | 00:00 - 00:08\nUma viajante encontra...",
  });

  assert.match(contexto, /ROTEIRO FIXO DO PROJETO/);
  assert.match(contexto, /Uma viajante encontra uma cidade perdida/);
  assert.match(contexto, /SINCRONIZAÇÃO FIXA DO PROJETO/);
  assert.match(contexto, /PROMPT 001 \| 00:00 - 00:08/);
  assert.match(contexto, /não peça.*novamente/i);
});

test("o contexto rejeita projeto incompleto", () => {
  assert.throws(
    () => montarContextoDoProjeto({ roteiro: "Roteiro", sincronizacao: "" }),
    /sincronização/i
  );
});

test("cada etapa tem uma instrução fechada e preserva o fluxo", () => {
  assert.match(montarInstrucaoDaEtapa("analise"), /ROTEIRO RECEBIDO E ANALISADO/);
  assert.match(montarInstrucaoDaEtapa("referencias"), /PROMPTS DE REFERÊNCIA/);
  assert.match(montarInstrucaoDaEtapa("cenas"), /um prompt para cada bloco/i);
  assert.match(montarInstrucaoDaEtapa("gestao", "falharam 2 e 4"), /falharam 2 e 4/);
});

test("ajustes antes da confirmação ficam presos à etapa atual", () => {
  assert.match(
    montarInstrucaoDaEtapa("analise", "Troque a roupa do Character 1"),
    /Troque a roupa do Character 1/
  );
  assert.match(
    montarInstrucaoDaEtapa("referencias", "Use fundo cinza"),
    /Use fundo cinza/
  );
});
