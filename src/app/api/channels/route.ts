import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { CanalSalvo } from "@/types/channel";

export const runtime = "nodejs";

const channelSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  handle: z.string().trim().max(100).optional(),
  descricao: z.string().max(2_000).optional(),
  nicho: z.string().trim().max(200).optional(),
  idioma: z.string().trim().max(40).optional(),
  promptSistemaPadrao: z.string().max(20_000).optional(),
  defaultPromptId: z.string().nullable().optional(),
});

// Inclui o prompt padrão (da biblioteca) resolvido em todas as leituras.
export const channelInclude = {
  defaultPrompt: { select: { id: true, nome: true, texto: true } },
} as const;

type ChannelRow = {
  id: string;
  nome: string;
  handle: string | null;
  descricao: string | null;
  nicho: string | null;
  idioma: string | null;
  promptSistemaPadrao: string | null;
  defaultPromptId: string | null;
  defaultPrompt: { id: string; nome: string; texto: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toDTO(c: ChannelRow): CanalSalvo {
  return {
    id: c.id,
    nome: c.nome,
    handle: c.handle,
    descricao: c.descricao,
    nicho: c.nicho,
    idioma: c.idioma,
    promptSistemaPadrao: c.promptSistemaPadrao,
    defaultPromptId: c.defaultPromptId,
    defaultPromptNome: c.defaultPrompt?.nome ?? null,
    defaultPromptTexto: c.defaultPrompt?.texto ?? null,
    criadoEm: c.createdAt.getTime(),
    atualizadoEm: c.updatedAt.getTime(),
  };
}

// Normaliza strings vazias -> null para os campos opcionais.
function limpar(valor: string | undefined): string | null {
  if (valor === undefined) return null;
  const t = valor.trim();
  return t.length > 0 ? t : null;
}

// Só aceita o defaultPromptId se o prompt existir e for do próprio usuário.
export async function resolverDefaultPromptId(
  userId: string,
  defaultPromptId: string | null | undefined
): Promise<string | null> {
  if (!defaultPromptId) return null;
  const prompt = await prisma.prompt.findFirst({
    where: { id: defaultPromptId, userId },
    select: { id: true },
  });
  return prompt ? prompt.id : null;
}

// GET /api/channels -> lista os canais do usuário logado.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canais = await prisma.channel.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: channelInclude,
  });
  return NextResponse.json(canais.map(toDTO));
}

// POST /api/channels -> cria um canal para o usuário logado.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = channelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "O canal precisa de um nome." },
      { status: 400 }
    );
  }

  const defaultPromptId = await resolverDefaultPromptId(
    user.id,
    parsed.data.defaultPromptId
  );

  const criado = await prisma.channel.create({
    data: {
      userId: user.id,
      nome: parsed.data.nome,
      handle: limpar(parsed.data.handle),
      descricao: limpar(parsed.data.descricao),
      nicho: limpar(parsed.data.nicho),
      idioma: limpar(parsed.data.idioma),
      promptSistemaPadrao: limpar(parsed.data.promptSistemaPadrao),
      defaultPromptId,
    },
    include: channelInclude,
  });
  return NextResponse.json(toDTO(criado), { status: 201 });
}
