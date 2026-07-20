// Idiomas suportados na transcrição (Whisper). O `value` é o nome do idioma em
// inglês que o Whisper espera (ou "auto" para detecção automática). Guardado no
// canal e enviado na sincronização para não "perder" o idioma da narração.

export const IDIOMA_AUTO = "auto";

export const IDIOMAS: { value: string; label: string }[] = [
  { value: "auto", label: "Detectar automaticamente" },
  { value: "portuguese", label: "Português" },
  { value: "english", label: "Inglês" },
  { value: "spanish", label: "Espanhol" },
  { value: "french", label: "Francês" },
  { value: "german", label: "Alemão" },
  { value: "italian", label: "Italiano" },
  { value: "japanese", label: "Japonês" },
  { value: "korean", label: "Coreano" },
  { value: "chinese", label: "Chinês" },
  { value: "russian", label: "Russo" },
  { value: "arabic", label: "Árabe" },
  { value: "hindi", label: "Hindi" },
];

const VALORES = new Set(IDIOMAS.map((i) => i.value));

/** Normaliza o idioma salvo (ou null) para um valor de idioma válido do Whisper. */
export function normalizarIdioma(valor: string | null | undefined): string {
  return valor && VALORES.has(valor) ? valor : IDIOMA_AUTO;
}

export function rotuloIdioma(valor: string | null | undefined): string {
  const alvo = normalizarIdioma(valor);
  return IDIOMAS.find((i) => i.value === alvo)?.label ?? "Detectar automaticamente";
}
