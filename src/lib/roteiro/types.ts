// Contrato do gerador de roteiros. Seguindo a ideia de "Provider" do PLAN.md
// (Fase 1.1): a pipeline conversa apenas com esta interface, então trocar o
// fornecedor de IA (Gemini, OpenAI, fake...) não exige mudar o resto do fluxo.

/** Identificadores dos providers suportados. */
export type ProviderRoteiro = "fake" | "gemini" | "openai";

/** Entrada para gerar um roteiro. */
export interface EntradaRoteiro {
  /** Tema/assunto do vídeo. */
  tema: string;
  /**
   * Instruções de sistema do canal (tom, formato, duração-alvo...). Opcional:
   * quando ausente, o provider usa um prompt padrão.
   */
  promptSistema?: string;
  /**
   * Variáveis extras substituídas no prompt (ex.: {duracao}, {publico}).
   * Fica a cargo de quem monta o prompt referenciá-las.
   */
  variaveis?: Record<string, string>;
}

/** Resultado de uma geração de roteiro. */
export interface ResultadoRoteiro {
  /** Texto do roteiro (narração pronta para o TTS). */
  texto: string;
  /** Provider que gerou o texto. */
  provider: ProviderRoteiro;
  /** Modelo concreto usado (ex.: "gemini-3.5-flash", "gpt-4o-mini"). */
  modelo: string;
}

/**
 * Interface única que a pipeline enxerga. Implementações concretas
 * (FakeScriptProvider, GeminiScriptProvider, OpenAIScriptProvider) resolvem
 * como o texto é produzido.
 */
export interface ScriptProvider {
  readonly provider: ProviderRoteiro;
  gerar(entrada: EntradaRoteiro): Promise<ResultadoRoteiro>;
}

/** Prompt de sistema padrão quando o canal não define o seu. */
export const PROMPT_SISTEMA_PADRAO =
  "Você é um roteirista de vídeos para YouTube. Escreva um roteiro de narração " +
  "em português do Brasil, fluido e envolvente, apenas com o texto falado " +
  "(sem marcações de cena, sem cabeçalhos, sem indicações técnicas). " +
  "Comece com um gancho forte nas primeiras frases.";

/**
 * Monta o prompt final do usuário a partir do tema e das variáveis. As
 * variáveis são anexadas como contexto — o prompt de sistema decide o formato.
 */
export function montarPromptUsuario(entrada: EntradaRoteiro): string {
  const partes = [`Tema do vídeo: ${entrada.tema.trim()}`];
  const variaveis = entrada.variaveis ?? {};
  const chaves = Object.keys(variaveis);
  if (chaves.length > 0) {
    partes.push("");
    partes.push("Considere também:");
    for (const chave of chaves) {
      const valor = variaveis[chave]?.trim();
      if (valor) partes.push(`- ${chave}: ${valor}`);
    }
  }
  return partes.join("\n");
}
