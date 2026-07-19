// Providers cujas chaves de API são guardadas por usuário. Módulo "plano"
// (sem node/prisma) para poder ser importado também no cliente.

export const CREDENTIAL_PROVIDERS = ["darkvi", "gemini", "openai"] as const;

export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];

export function ehCredentialProvider(valor: unknown): valor is CredentialProvider {
  return (
    typeof valor === "string" &&
    (CREDENTIAL_PROVIDERS as readonly string[]).includes(valor)
  );
}

export const PROVIDER_LABELS: Record<CredentialProvider, string> = {
  darkvi: "Darkvi (voz)",
  gemini: "Google Gemini",
  openai: "OpenAI (GPT)",
};
