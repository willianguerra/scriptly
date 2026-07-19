import assert from "node:assert/strict";
import test from "node:test";

import { gerarRespostaDoAgente } from "./server.ts";

const entradaBase = {
  roteiro: "Uma exploradora atravessa ruínas antigas.",
  sincronizacao:
    "PROMPT 001 | 00:00 - 00:08\nUma exploradora atravessa ruínas antigas.",
  mensagens: [],
};

test("o provider fake permite percorrer a análise sem chave", async () => {
  const resultado = await gerarRespostaDoAgente({
    ...entradaBase,
    provider: "fake",
    etapa: "analise",
    chave: "",
  });

  assert.match(resultado.texto, /ROTEIRO RECEBIDO E ANALISADO/);
  assert.equal(resultado.provider, "fake");
});

test("a OpenAI recebe o agente, o contexto fixo e a instrução da etapa", async () => {
  const fetchOriginal = globalThis.fetch;
  let bodyRecebido: { messages?: Array<{ role: string; content: string }> } = {};

  globalThis.fetch = async (_input, init) => {
    bodyRecebido = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Análise pronta" }, finish_reason: "stop" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    await gerarRespostaDoAgente({
      ...entradaBase,
      provider: "openai",
      etapa: "analise",
      chave: "chave-teste",
    });

    const mensagens = bodyRecebido?.messages as Array<{ role: string; content: string }>;
    assert.match(mensagens[0].content, /DOTTI AGENT 2\.0/);
    assert.match(mensagens[0].content, /ROTEIRO FIXO DO PROJETO/);
    assert.match(mensagens.at(-1)?.content ?? "", /Execute somente a ETAPA 1/);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("continua automaticamente quando a OpenAI interrompe por limite", async () => {
  const fetchOriginal = globalThis.fetch;
  let chamadas = 0;

  globalThis.fetch = async () => {
    chamadas += 1;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: { content: chamadas === 1 ? "PROMPT 001" : "\nPROMPT 002" },
            finish_reason: chamadas === 1 ? "length" : "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const resultado = await gerarRespostaDoAgente({
      ...entradaBase,
      provider: "openai",
      etapa: "cenas",
      chave: "chave-teste",
    });

    assert.equal(chamadas, 2);
    assert.equal(resultado.texto, "PROMPT 001\nPROMPT 002");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
