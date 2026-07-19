import assert from "node:assert/strict";
import test from "node:test";

import {
  GEMINI_MODELO_ECONOMICO,
  GEMINI_MODELO_POTENTE,
  OPENAI_MODELO_ECONOMICO,
  OPENAI_MODELO_POTENTE,
  resolverModeloVideo,
} from "./models.ts";

test("usa modelos econômicos nas etapas de alto volume", () => {
  assert.equal(resolverModeloVideo("openai", "referencias"), OPENAI_MODELO_ECONOMICO);
  assert.equal(resolverModeloVideo("openai", "cenas"), OPENAI_MODELO_ECONOMICO);
  assert.equal(resolverModeloVideo("gemini", "referencias"), GEMINI_MODELO_ECONOMICO);
  assert.equal(resolverModeloVideo("gemini", "cenas"), GEMINI_MODELO_ECONOMICO);
});

test("reserva os modelos potentes para análise e gestão de falhas", () => {
  assert.equal(resolverModeloVideo("openai", "analise"), OPENAI_MODELO_POTENTE);
  assert.equal(resolverModeloVideo("openai", "gestao"), OPENAI_MODELO_POTENTE);
  assert.equal(resolverModeloVideo("gemini", "analise"), GEMINI_MODELO_POTENTE);
  assert.equal(resolverModeloVideo("gemini", "gestao"), GEMINI_MODELO_POTENTE);
});

test("mantém um modelo explicitamente configurado", () => {
  assert.equal(resolverModeloVideo("openai", "cenas", "modelo-personalizado"), "modelo-personalizado");
  assert.equal(resolverModeloVideo("gemini", "analise", "  modelo-personalizado  "), "modelo-personalizado");
});
