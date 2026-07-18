// Fábrica de ScriptProvider (server-side) + resolução de chave.
//
// Segue o mesmo padrão da Darkvi (ver darkvi-server.ts): a chave enviada pelo
// cliente (guardada no localStorage e mandada por header) tem prioridade sobre
// a chave do servidor (variável de ambiente). Assim o provider vira o único
// ponto que sabe "de onde vem a chave" e "qual classe instanciar".

import { FakeScriptProvider } from "./fake.ts";
import { GeminiScriptProvider, GEMINI_MODELO_PADRAO } from "./gemini.ts";
import { OpenAIScriptProvider, OPENAI_MODELO_PADRAO } from "./openai.ts";
import type { ProviderRoteiro, ScriptProvider } from "./types.ts";

/** Header que o cliente usa para enviar a chave de cada provider. */
const HEADER_CHAVE: Record<Exclude<ProviderRoteiro, "fake">, string> = {
  gemini: "x-gemini-key",
  openai: "x-openai-key",
};

/** Variável de ambiente (fallback do servidor) de cada provider. */
const ENV_CHAVE: Record<Exclude<ProviderRoteiro, "fake">, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

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
 * Resolve a chave de um provider: header do cliente vence a env do servidor.
 * `fake` nunca precisa de chave. Retorna `null` quando não há chave disponível.
 */
export function resolverChave(
  provider: ProviderRoteiro,
  req: Request
): string | null {
  if (provider === "fake") return "";

  const doHeader = req.headers.get(HEADER_CHAVE[provider])?.trim();
  if (doHeader) return doHeader;

  const daEnv = process.env[ENV_CHAVE[provider]]?.trim();
  return daEnv || null;
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
