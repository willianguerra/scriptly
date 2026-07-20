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

test("a análise usa o modelo OpenAI potente e recebe o contexto completo", async () => {
  const fetchOriginal = globalThis.fetch;
  let bodyRecebido: {
    model?: string;
    max_completion_tokens?: number;
    max_tokens?: number;
    messages?: Array<{ role: string; content: string }>;
  } = {};

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
    assert.equal(bodyRecebido.model, "gpt-5.4");
    assert.equal(bodyRecebido.max_completion_tokens, 65536);
    assert.equal(bodyRecebido.max_tokens, undefined);
    assert.match(mensagens[0].content, /Scriptly Agent 2\.0/);
    assert.match(mensagens[0].content, /ROTEIRO FIXO DO PROJETO/);
    assert.match(mensagens.at(-1)?.content ?? "", /Execute somente a ETAPA 1/);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("a geração de cenas usa o modelo OpenAI econômico", async () => {
  const fetchOriginal = globalThis.fetch;
  let modeloRecebido = "";

  globalThis.fetch = async (_input, init) => {
    modeloRecebido = JSON.parse(String(init?.body)).model;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "PROMPT 001" }, finish_reason: "stop" }],
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

    assert.equal(modeloRecebido, "gpt-5-mini");
    assert.equal(resultado.modelo, "gpt-5-mini");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("o Gemini alterna entre potente na análise e lite nas cenas", async () => {
  const fetchOriginal = globalThis.fetch;
  const urls: string[] = [];
  const limites: number[] = [];

  globalThis.fetch = async (input, init) => {
    urls.push(String(input));
    limites.push(JSON.parse(String(init?.body)).generationConfig.maxOutputTokens);
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Resposta pronta" }] }, finishReason: "STOP" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    await gerarRespostaDoAgente({
      ...entradaBase,
      provider: "gemini",
      etapa: "analise",
      chave: "chave-teste",
    });
    await gerarRespostaDoAgente({
      ...entradaBase,
      provider: "gemini",
      etapa: "cenas",
      chave: "chave-teste",
    });

    assert.match(urls[0], /gemini-3\.5-flash:generateContent$/);
    assert.match(urls[1], /gemini-3\.1-flash-lite:generateContent$/);
    assert.deepEqual(limites, [65536, 65536]);
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

test("não entrega resposta parcial bloqueada pelo provider", async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          { message: { content: "PROMPT 001 incompleto" }, finish_reason: "content_filter" },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    await assert.rejects(
      () =>
        gerarRespostaDoAgente({
          ...entradaBase,
          provider: "openai",
          etapa: "cenas",
          chave: "chave-teste",
        }),
      /interrompida.*content_filter/i
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
