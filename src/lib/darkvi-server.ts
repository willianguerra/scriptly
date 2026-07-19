// Helpers server-side para conversar com a API Darkvi.
//
// O token agora é resolvido por usuário: a chave própria do usuário (guardada
// criptografada no banco) e, só para admins, o fallback da env DARKVI_API_TOKEN.
// Ver @/lib/credentials/store (resolverChaveDoUsuario).

import { getCurrentUser } from "@/lib/auth/current-user";
import { resolverChaveDoUsuario } from "@/lib/credentials/store";

export const DARKVI_BASE_URL = "https://darkvi.com/api";

/**
 * Resolve o token da Darkvi para o usuário logado (chave própria no banco;
 * fallback de env só para admin). Retorna null se não houver sessão ou chave.
 */
export async function resolverTokenDarkvi(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return resolverChaveDoUsuario("darkvi", user);
}

export function missingTokenResponse() {
  return Response.json(
    {
      ok: false,
      error: true,
      code: "AUTH_MISSING_TOKEN",
      message:
        "Chave da Darkvi não configurada. Adicione sua chave em Configurações.",
    },
    { status: 401 }
  );
}
