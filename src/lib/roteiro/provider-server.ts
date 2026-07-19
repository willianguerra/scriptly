// Fábrica de ScriptProvider (server-side).
//
// A resolução da chave (chave própria do usuário no banco, com fallback de env
// só para admin) vive em @/lib/credentials/store. Aqui ficam apenas a validação
// do provider, o modelo padrão e a instanciação da classe concreta.

import { FakeScriptProvider } from "./fake.ts";
import { GeminiScriptProvider, GEMINI_MODELO_PADRAO } from "./gemini.ts";
import { OpenAIScriptProvider, OPENAI_MODELO_PADRAO } from "./openai.ts";
import type { ProviderRoteiro, ScriptProvider } from "./types.ts";

/** Modelo padrão de cada provider quando nenhum é informado. */
const MODELO_PADRAO: Record<ProviderRoteiro, string> = {
  fake: "fake-1",
  gemini: GEMINI_MODELO_PADRAO,
  openai: OPENAI_MODELO_PADRAO,
};

/** Valida se a string é um provider conhecido. */
export function ehProviderValido(valor: unknown): valor is ProviderRoteiro {
  return valor === "fake" || valor === "gemini" || valor === "openai";
}

/**
 * Instancia o ScriptProvider concreto. Função pura (não lê env nem Request) —
 * a chave já vem resolvida. Lança se faltar chave para um provider real.
 */
export function criarProvider(
  provider: ProviderRoteiro,
  chave: string | null,
  modelo?: string
): ScriptProvider {
  const modeloFinal = modelo?.trim() || MODELO_PADRAO[provider];

  switch (provider) {
    case "fake":
      return new FakeScriptProvider();
    case "gemini":
      if (!chave) throw new Error("Chave da API do Gemini não informada.");
      return new GeminiScriptProvider(chave, modeloFinal);
    case "openai":
      if (!chave) throw new Error("Chave da API da OpenAI não informada.");
      return new OpenAIScriptProvider(chave, modeloFinal);
  }
}
