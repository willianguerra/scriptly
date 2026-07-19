import {
  GEMINI_MODELO_ECONOMICO,
  GEMINI_MODELO_POTENTE,
  OPENAI_MODELO_ECONOMICO,
  OPENAI_MODELO_POTENTE,
} from "../ai-models.ts";
import type { ProviderRoteiro } from "../roteiro/types.ts";
import type { EtapaChatPrompts } from "./flow.ts";

export {
  GEMINI_MODELO_ECONOMICO,
  GEMINI_MODELO_POTENTE,
  OPENAI_MODELO_ECONOMICO,
  OPENAI_MODELO_POTENTE,
};

type ProviderReal = Exclude<ProviderRoteiro, "fake">;
type PerfilModelo = "economico" | "potente";

const PERFIL_POR_ETAPA: Record<EtapaChatPrompts, PerfilModelo> = {
  analise: "potente",
  referencias: "economico",
  cenas: "economico",
  gestao: "potente",
};

const MODELOS: Record<ProviderReal, Record<PerfilModelo, string>> = {
  openai: {
    economico: OPENAI_MODELO_ECONOMICO,
    potente: OPENAI_MODELO_POTENTE,
  },
  gemini: {
    economico: GEMINI_MODELO_ECONOMICO,
    potente: GEMINI_MODELO_POTENTE,
  },
};

export function resolverModeloVideo(
  provider: ProviderReal,
  etapa: EtapaChatPrompts,
  modeloConfigurado?: string
): string {
  const sobrescrita = modeloConfigurado?.trim();
  if (sobrescrita) return sobrescrita;

  return MODELOS[provider][PERFIL_POR_ETAPA[etapa]];
}
