import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIScriptProvider } from "./openai.ts";

test("usa o GPT-5 mini como modelo econômico padrão do roteiro", async () => {
  const fetchOriginal = globalThis.fetch;
  let bodyRecebido: { model?: string } = {};

  globalThis.fetch = async (_input, init) => {
    bodyRecebido = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Roteiro gerado" }, finish_reason: "stop" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const resultado = await new OpenAIScriptProvider("chave-de-teste").gerar({
      tema: "energia solar",
    });

    assert.equal(bodyRecebido.model, "gpt-5-mini");
    assert.equal(resultado.modelo, "gpt-5-mini");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
