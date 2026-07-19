import { NextResponse } from "next/server";

import { ehProviderValido } from "@/lib/roteiro/provider-server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolverChaveDoUsuario } from "@/lib/credentials/store";
import {
  gerarRespostaDoAgente,
} from "@/lib/video-prompts/server";
import type {
  EtapaChatPrompts,
  MensagemChatPrompts,
} from "@/lib/video-prompts/flow";

export const maxDuration = 300;

const ETAPAS = new Set<EtapaChatPrompts>([
  "analise",
  "referencias",
  "cenas",
  "gestao",
]);

function textoValido(valor: unknown, limite: number): valor is string {
  return typeof valor === "string" && valor.trim().length > 0 && valor.length <= limite;
}

function mensagensValidas(valor: unknown): valor is MensagemChatPrompts[] {
  return (
    Array.isArray(valor) &&
    valor.length <= 40 &&
    valor.reduce(
      (total, item) =>
        total +
        (item && typeof item === "object" && typeof item.content === "string"
          ? item.content.length
          : 0),
      0
    ) <= 1_500_000 &&
    valor.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        (item.role === "user" || item.role === "assistant") &&
        textoValido(item.content, 500_000)
    )
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Não autenticado." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const provider = body?.provider;
  const etapa = body?.etapa;

  if (!ehProviderValido(provider)) {
    return NextResponse.json(
      { ok: false, message: "Provider inválido para o chat de prompts." },
      { status: 400 }
    );
  }
  if (typeof etapa !== "string" || !ETAPAS.has(etapa as EtapaChatPrompts)) {
    return NextResponse.json(
      { ok: false, message: "Etapa inválida para o chat de prompts." },
      { status: 400 }
    );
  }
  if (!textoValido(body?.roteiro, 250_000)) {
    return NextResponse.json(
      { ok: false, message: "O roteiro é obrigatório ou excede o limite." },
      { status: 400 }
    );
  }
  if (!textoValido(body?.sincronizacao, 500_000)) {
    return NextResponse.json(
      { ok: false, message: "A sincronização é obrigatória ou excede o limite." },
      { status: 400 }
    );
  }
  if (!mensagensValidas(body?.mensagens)) {
    return NextResponse.json(
      { ok: false, message: "Histórico do chat inválido ou muito extenso." },
      { status: 400 }
    );
  }
  if (
    body?.mensagemUsuario !== undefined &&
    (typeof body.mensagemUsuario !== "string" || body.mensagemUsuario.length > 10_000)
  ) {
    return NextResponse.json(
      { ok: false, message: "Mensagem do usuário inválida ou muito extensa." },
      { status: 400 }
    );
  }

  try {
    const resultado = await gerarRespostaDoAgente({
      provider,
      etapa: etapa as EtapaChatPrompts,
      roteiro: body.roteiro,
      sincronizacao: body.sincronizacao,
      mensagens: body.mensagens,
      mensagemUsuario: body.mensagemUsuario,
      modelo: typeof body.modelo === "string" ? body.modelo : undefined,
      chave:
        provider === "fake"
          ? ""
          : await resolverChaveDoUsuario(provider, user),
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao gerar os prompts de vídeo.";
    const status = /chave.*não informada/i.test(message) ? 401 : 502;
    return NextResponse.json({ ok: false, message }, { status });
  }
}
