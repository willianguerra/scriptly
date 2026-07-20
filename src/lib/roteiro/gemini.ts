// Provider de roteiro usando a API do Google Gemini (generateContent).
// Roda apenas no servidor: recebe a chave já resolvida (nunca lê env aqui, para
// manter a resolução de chave num único lugar — provider-server.ts).

import {
  montarPromptUsuario,
  montarPromptSistema,
  type EntradaRoteiro,
  type ResultadoRoteiro,
  type ScriptProvider,
} from "./types.ts";
import { GEMINI_MODELO_ECONOMICO } from "../ai-models.ts";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** Modelo padrão quando o canal não especifica. */
export const GEMINI_MODELO_PADRAO = GEMINI_MODELO_ECONOMICO;

type GeminiResposta = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
};

export class GeminiScriptProvider implements ScriptProvider {
  readonly provider = "gemini" as const;

  private readonly apiKey: string;
  private readonly modelo: string;

  constructor(apiKey: string, modelo: string = GEMINI_MODELO_PADRAO) {
    this.apiKey = apiKey;
    this.modelo = modelo;
  }

  async gerar(entrada: EntradaRoteiro): Promise<ResultadoRoteiro> {
    const sistema = montarPromptSistema(entrada);
    const usuario = montarPromptUsuario(entrada);

    const url = `${GEMINI_BASE_URL}/${encodeURIComponent(this.modelo)}:generateContent`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
        }),
        cache: "no-store",
      });
    } catch {
      throw new Error("Falha ao contatar a API do Gemini.");
    }

    const data = (await res.json().catch(() => null)) as GeminiResposta | null;

    if (!res.ok) {
      const msg = data?.error?.message || `Erro ${res.status} da API do Gemini.`;
      throw new Error(msg);
    }

    const bloqueio = data?.promptFeedback?.blockReason;
    if (bloqueio) {
      throw new Error(`O Gemini bloqueou a resposta (${bloqueio}).`);
    }

    const texto = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((parte) => parte.text ?? "")
      .join("")
      .trim();

    if (!texto) {
      throw new Error("O Gemini não retornou texto para o roteiro.");
    }

    return { texto, provider: this.provider, modelo: this.modelo };
  }
}
