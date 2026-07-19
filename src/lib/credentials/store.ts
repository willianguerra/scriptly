import "server-only";

import type { Role } from "@prisma/client";

import { prisma } from "@/lib/db";
import { cifrar, decifrar, mascarar } from "@/lib/crypto/secret-box";
import {
  CREDENTIAL_PROVIDERS,
  type CredentialProvider,
} from "./providers";

// Variável de ambiente (chave compartilhada do servidor) de cada provider.
// Por decisão do dono, esse fallback só vale para admins — amigos usam a
// própria chave.
const ENV_FALLBACK: Record<CredentialProvider, string> = {
  darkvi: "DARKVI_API_TOKEN",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

type UserRef = { id: string; role: Role };

function chaveDoServidor(provider: CredentialProvider): string | null {
  return process.env[ENV_FALLBACK[provider]]?.trim() || null;
}

/** Salva (ou substitui) a chave de um provider para o usuário, criptografada. */
export async function salvarCredencial(
  userId: string,
  provider: CredentialProvider,
  valor: string
): Promise<void> {
  const limpo = valor.trim();
  if (!limpo) throw new Error("A chave não pode ser vazia.");

  const { ciphertext, iv, tag } = cifrar(limpo);
  await prisma.apiCredential.upsert({
    where: { userId_provider: { userId, provider } },
    update: { ciphertext, iv, tag },
    create: { userId, provider, ciphertext, iv, tag },
  });
}

/** Remove a chave de um provider do usuário (se existir). */
export async function removerCredencial(
  userId: string,
  provider: CredentialProvider
): Promise<void> {
  await prisma.apiCredential.deleteMany({ where: { userId, provider } });
}

/** Retorna a chave em texto puro do usuário para o provider, ou null. */
export async function obterCredencialDoUsuario(
  userId: string,
  provider: CredentialProvider
): Promise<string | null> {
  const row = await prisma.apiCredential.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!row) return null;
  try {
    return decifrar(row);
  } catch {
    // Chave corrompida ou APP_ENCRYPTION_KEY trocada: trata como ausente.
    return null;
  }
}

/**
 * Resolve a chave que o servidor deve usar para este usuário e provider:
 * 1) a chave própria do usuário (banco); senão
 * 2) a chave compartilhada do servidor — só se o usuário for ADMIN.
 * Retorna null quando não há chave disponível.
 */
export async function resolverChaveDoUsuario(
  provider: CredentialProvider,
  user: UserRef
): Promise<string | null> {
  const doUsuario = await obterCredencialDoUsuario(user.id, provider);
  if (doUsuario) return doUsuario;
  if (user.role === "ADMIN") return chaveDoServidor(provider);
  return null;
}

export type StatusCredencial = {
  provider: CredentialProvider;
  hasUserKey: boolean;
  masked: string | null;
  // Há uma chave de servidor disponível como fallback para este usuário?
  serverFallback: boolean;
};

/** Situação de cada provider para exibir nas Configurações do usuário. */
export async function statusCredenciais(
  user: UserRef
): Promise<StatusCredencial[]> {
  const rows = await prisma.apiCredential.findMany({
    where: { userId: user.id },
  });
  const porProvider = new Map(rows.map((r) => [r.provider, r]));

  return CREDENTIAL_PROVIDERS.map((provider) => {
    const row = porProvider.get(provider);
    let masked: string | null = null;
    if (row) {
      try {
        masked = mascarar(decifrar(row));
      } catch {
        masked = "••••";
      }
    }
    return {
      provider,
      hasUserKey: Boolean(row),
      masked,
      serverFallback: user.role === "ADMIN" && chaveDoServidor(provider) !== null,
    };
  });
}
