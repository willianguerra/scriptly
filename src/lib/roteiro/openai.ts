// Provider de roteiro usando a API da OpenAI (chat/completions).
// Roda apenas no servidor: recebe a chave já resolvida (a resolução de chave
// fica centralizada em provider-server.ts).

import {
  montarPromptUsuario,
  montarPromptSistema,
  type EntradaRoteiro,
  type ResultadoRoteiro,
  type ScriptProvider,
} from "./types.ts";
import { OPENAI_MODELO_ECONOMICO } from "../ai-models.ts";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/** Modelo padrão quando o canal não especifica. */
export const OPENAI_MODELO_PADRAO = OPENAI_MODELO_ECONOMICO;

type OpenAIResposta = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  error?: { message?: string };
};

export class OpenAIScriptProvider implements ScriptProvider {
  readonly provider = "openai" as const;

  private readonly apiKey: string;
  private readonly modelo: string;

  constructor(apiKey: string, modelo: string = OPENAI_MODELO_PADRAO) {
    this.apiKey = apiKey;
    this.modelo = modelo;
  }

  async gerar(entrada: EntradaRoteiro): Promise<ResultadoRoteiro> {
    const sistema = montarPromptSistema(entrada);
    const usuario = montarPromptUsuario(entrada);

    let res: Response;
    try {
      res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelo,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: usuario },
          ],
        }),
        cache: "no-store",
      });
    } catch {
      throw new Error("Falha ao contatar a API da OpenAI.");
    }

    const data = (await res.json().catch(() => null)) as OpenAIResposta | null;

    if (!res.ok) {
      const msg = data?.error?.message || `Erro ${res.status} da API da OpenAI.`;
      throw new Error(msg);
    }

    const texto = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) {
      throw new Error("A OpenAI não retornou texto para o roteiro.");
    }

    return { texto, provider: this.provider, modelo: this.modelo };
  }
}
