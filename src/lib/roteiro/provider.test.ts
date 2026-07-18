import assert from "node:assert/strict";
import test from "node:test";

import { FakeScriptProvider } from "./fake.ts";
import { montarPromptUsuario } from "./types.ts";
import {
  criarProvider,
  ehProviderValido,
  resolverChave,
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

test("resolverChave prioriza header sobre a env do servidor", () => {
  const req = new Request("http://localhost/api/roteiro", {
    headers: { "x-gemini-key": "chave-do-cliente" },
  });
  assert.equal(resolverChave("gemini", req), "chave-do-cliente");
  assert.equal(resolverChave("fake", req), "");
});

test("resolverChave cai na env quando não há header", () => {
  const anterior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "chave-do-servidor";
  try {
    const req = new Request("http://localhost/api/roteiro");
    assert.equal(resolverChave("openai", req), "chave-do-servidor");
  } finally {
    if (anterior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = anterior;
  }
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
