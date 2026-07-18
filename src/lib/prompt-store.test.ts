import assert from "node:assert/strict";
import test from "node:test";

import {
  adicionarPrompt,
  atualizarPrompt,
  removerPrompt,
  normalizarLista,
  type PromptSalvo,
} from "./prompt-store.ts";

test("adicionarPrompt cria item com nome e texto normalizados", () => {
  const lista = adicionarPrompt([], { nome: "  Canal A ", texto: " oi " }, 100);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].nome, "Canal A");
  assert.equal(lista[0].texto, "oi");
  assert.equal(lista[0].atualizadoEm, 100);
  assert.ok(lista[0].id.length > 0);
});

test("adicionarPrompt exige nome", () => {
  assert.throws(() => adicionarPrompt([], { nome: "   ", texto: "x" }), /nome/);
});

test("atualizarPrompt altera apenas o item alvo", () => {
  const base = adicionarPrompt([], { nome: "A", texto: "1" }, 1);
  const id = base[0].id;
  const outro = adicionarPrompt(base, { nome: "B", texto: "2" }, 2);
  const atualizado = atualizarPrompt(outro, id, { texto: "novo" }, 3);
  const alvo = atualizado.find((p) => p.id === id)!;
  assert.equal(alvo.texto, "novo");
  assert.equal(alvo.nome, "A");
  assert.equal(alvo.atualizadoEm, 3);
  // o outro permanece intacto
  assert.equal(atualizado.find((p) => p.nome === "B")!.texto, "2");
});

test("atualizarPrompt rejeita nome vazio", () => {
  const base = adicionarPrompt([], { nome: "A", texto: "1" });
  assert.throws(
    () => atualizarPrompt(base, base[0].id, { nome: "  " }),
    /nome/
  );
});

test("removerPrompt tira o item pelo id", () => {
  const base = adicionarPrompt([], { nome: "A", texto: "1" });
  const semItem = removerPrompt(base, base[0].id);
  assert.equal(semItem.length, 0);
});

test("normalizarLista descarta entradas inválidas", () => {
  const entrada = [
    { id: "1", nome: "ok", texto: "t", atualizadoEm: 5 },
    { id: 2, nome: "sem id string" },
    null,
    "lixo",
  ];
  const lista: PromptSalvo[] = normalizarLista(entrada);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].id, "1");
});

test("normalizarLista de valor não-array retorna vazio", () => {
  assert.deepEqual(normalizarLista(null), []);
  assert.deepEqual(normalizarLista({}), []);
});
