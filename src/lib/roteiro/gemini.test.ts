import assert from "node:assert/strict";
import test from "node:test";

import { GeminiScriptProvider } from "./gemini.ts";

test("usa o Gemini 3.1 Flash-Lite como modelo econômico padrão", async () => {
  const fetchOriginal = globalThis.fetch;
  let urlRecebida = "";

  globalThis.fetch = async (input) => {
    urlRecebida = String(input);
    return new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Roteiro gerado" }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const resultado = await new GeminiScriptProvider("chave-de-teste").gerar({
      tema: "energia solar",
    });

    assert.equal(
      new URL(urlRecebida).pathname,
      "/v1beta/models/gemini-3.1-flash-lite:generateContent"
    );
    assert.equal(resultado.modelo, "gemini-3.1-flash-lite");
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
