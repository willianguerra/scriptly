import assert from "node:assert/strict";
import test from "node:test";

import { FakeScriptProvider } from "./fake.ts";
import { montarPromptUsuario } from "./types.ts";
import {
  criarProvider,
  ehProviderValido,
} from "./provider-server.ts";

test("FakeScriptProvider gera texto sem chave e cita o tema", async () => {
  const provider = new FakeScriptProvider();
  const { texto, provider: nome, modelo } = await provider.gerar({
    tema: "buracos negros",
  });

  assert.equal(nome, "fake");
  assert.equal(modelo, "fake-1");
  assert.ok(texto.includes("buracos negros"));
  assert.ok(texto.length > 0);
});

test("ehProviderValido aceita apenas providers conhecidos", () => {
  assert.equal(ehProviderValido("fake"), true);
  assert.equal(ehProviderValido("gemini"), true);
  assert.equal(ehProviderValido("openai"), true);
  assert.equal(ehProviderValido("outro"), false);
  assert.equal(ehProviderValido(undefined), false);
});

test("criarProvider instancia o fake sem chave", () => {
  const provider = criarProvider("fake", null);
  assert.equal(provider.provider, "fake");
});

test("criarProvider exige chave para providers reais", () => {
  assert.throws(() => criarProvider("gemini", null), /Gemini/);
  assert.throws(() => criarProvider("openai", null), /OpenAI/);
  assert.equal(criarProvider("gemini", "chave-x").provider, "gemini");
  assert.equal(criarProvider("openai", "chave-y").provider, "openai");
});

test("montarPromptUsuario inclui tema e variáveis", () => {
  const prompt = montarPromptUsuario({
    tema: "IA na medicina",
    variaveis: { duracao: "5 minutos", publico: "leigos" },
  });
  assert.ok(prompt.includes("IA na medicina"));
  assert.ok(prompt.includes("duracao: 5 minutos"));
  assert.ok(prompt.includes("publico: leigos"));
});
