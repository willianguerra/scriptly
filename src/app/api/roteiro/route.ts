import { NextResponse } from "next/server";
import {
  criarProvider,
  ehProviderValido,
} from "@/lib/roteiro/provider-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolverChaveDoUsuario } from "@/lib/credentials/store";
import type { EntradaRoteiro } from "@/lib/roteiro/types";

export const runtime = "nodejs";

// POST /api/roteiro -> gera um roteiro com o provider escolhido.
// body: {
//   provider: "fake" | "gemini" | "openai",
//   modelo?: string,
//   tema: string,
//   promptSistema?: string,
//   variaveis?: Record<string, string>
// }
// A chave de cada provider é a chave própria do usuário (guardada criptografada
// no banco); admins podem cair no fallback da env do servidor.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: true, code: "UNAUTHENTICATED", message: "Não autenticado." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);

  const provider = body?.provider;
  if (!ehProviderValido(provider)) {
    return NextResponse.json(
      {
        ok: false,
        error: true,
        code: "INVALID_PROVIDER",
        message: "Campo 'provider' deve ser 'fake', 'gemini' ou 'openai'.",
      },
      { status: 400 }
    );
  }

  const tema = typeof body?.tema === "string" ? body.tema.trim() : "";
  if (!tema) {
    return NextResponse.json(
      {
        ok: false,
        error: true,
        code: "INVALID_BODY",
        message: "Campo 'tema' é obrigatório.",
      },
      { status: 400 }
    );
  }

  const chave =
    provider === "fake" ? "" : await resolverChaveDoUsuario(provider, user);

  const entrada: EntradaRoteiro = {
    tema,
    promptSistema:
      typeof body?.promptSistema === "string" ? body.promptSistema : undefined,
    idioma: typeof body?.idioma === "string" ? body.idioma : undefined,
    variaveis:
      body?.variaveis && typeof body.variaveis === "object"
        ? (body.variaveis as Record<string, string>)
        : undefined,
  };

  try {
    const scriptProvider = criarProvider(
      provider,
      chave,
      typeof body?.modelo === "string" ? body.modelo : undefined
    );
    const resultado = await scriptProvider.gerar(entrada);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Falha ao gerar o roteiro.";
    // Chave ausente é erro do cliente (401); demais falhas tratamos como 502.
    const status = /não informada/i.test(message) ? 401 : 502;
    return NextResponse.json(
      { ok: false, error: true, code: "PROVIDER_ERROR", message },
      { status }
    );
  }
}
