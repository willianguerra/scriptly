// Contrato do gerador de roteiros. Seguindo a ideia de "Provider" do PLAN.md
// (Fase 1.1): a pipeline conversa apenas com esta interface, então trocar o
// fornecedor de IA (Gemini, OpenAI, fake...) não exige mudar o resto do fluxo.

import { PROMPT_BASE_ROTEIRO } from "./base-prompt.ts";
import { rotuloIdioma } from "../idiomas.ts";

/** Identificadores dos providers suportados. */
export type ProviderRoteiro = "fake" | "gemini" | "openai";

/** Lista dos providers com rótulo/nota, para popular seletores. */
export const PROVIDERS_ROTEIRO: {
  value: ProviderRoteiro;
  label: string;
  nota: string;
}[] = [
  { value: "fake", label: "Teste (sem IA)", nota: "Não usa chave — valida o fluxo." },
  { value: "gemini", label: "Google Gemini", nota: "Requer chave nas Configurações." },
  { value: "openai", label: "OpenAI (GPT)", nota: "Requer chave nas Configurações." },
];

/** Garante um provider válido a partir de um valor arbitrário. */
export function normalizarProvider(
  valor: string | null | undefined
): ProviderRoteiro {
  return valor === "gemini" || valor === "openai" || valor === "fake"
    ? valor
    : "fake";
}

/** Entrada para gerar um roteiro. */
export interface EntradaRoteiro {
  /** Tema/assunto do vídeo. */
  tema: string;
  /**
   * "Tom & estilo" do canal (tom, atmosfera, formato...). Opcional: é somado
   * SOBRE o prompt base — não o substitui.
   */
  promptSistema?: string;
  /**
   * Idioma de saída do roteiro (nome em inglês do Whisper, ex.: "spanish", ou
   * "auto"). Quando definido, o roteiro é escrito nesse idioma.
   */
  idioma?: string;
  /** Geração em partes: índice (1-based) e total de partes. */
  parteAtual?: number;
  totalPartes?: number;
  /** Trecho final do que já foi escrito, para continuar sem repetir. */
  trechoAnterior?: string;
  /** Alvo de caracteres desta parte. */
  alvoCaracteres?: number;
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
  /** Modelo concreto usado (ex.: "gemini-3.1-flash-lite", "gpt-5-mini"). */
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

/** Prompt de sistema base (regras de ofício), sempre aplicado. */
export const PROMPT_SISTEMA_PADRAO = PROMPT_BASE_ROTEIRO;

/**
 * Monta o system prompt final: PROMPT BASE (fixo) + idioma de saída (se houver)
 * + "tom & estilo" do canal por cima. O tom&estilo NUNCA substitui a base.
 */
export function montarPromptSistema(entrada: EntradaRoteiro): string {
  const partes: string[] = [PROMPT_BASE_ROTEIRO];

  const idioma = entrada.idioma?.trim();
  if (idioma && idioma !== "auto") {
    partes.push(
      "\n════════════════════════════════════════\n" +
        "IDIOMA DE SAÍDA (OBRIGATÓRIO)\n" +
        "════════════════════════════════════════\n" +
        `Escreva TODO o roteiro em ${rotuloIdioma(idioma)}. Não misture idiomas.`
    );
  }

  const tom = entrada.promptSistema?.trim();
  if (tom) {
    partes.push(
      "\n════════════════════════════════════════\n" +
        "TOM & ESTILO DESTE CANAL (aplicar sobre as regras acima)\n" +
        "════════════════════════════════════════\n" +
        tom
    );
  }

  return partes.join("\n");
}

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

  // Geração em partes: instrui a continuidade e o alvo desta parte.
  const total = entrada.totalPartes ?? 1;
  if (total > 1 && entrada.parteAtual) {
    partes.push("");
    partes.push(
      `Esta é a PARTE ${entrada.parteAtual} de ${total} do roteiro. ` +
        `Alvo desta parte: ~${entrada.alvoCaracteres ?? 5000} caracteres. ` +
        (entrada.parteAtual === 1
          ? "Comece o roteiro (com o hook)."
          : entrada.parteAtual === total
            ? "Esta é a ÚLTIMA parte: conduza ao fechamento."
            : "Continue o arco, sem recomeçar nem reintroduzir.")
    );
  }
  const tail = entrada.trechoAnterior?.trim();
  if (tail) {
    partes.push("");
    partes.push(
      "TRECHO FINAL DO QUE JÁ FOI ESCRITO (continue exatamente daqui, sem repetir, sem meta-introdução):"
    );
    partes.push(tail);
  }

  return partes.join("\n");
}
