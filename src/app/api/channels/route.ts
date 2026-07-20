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
  promptSistemaPadrao: z.string().max(20_000).optional(),
});

type ChannelRow = {
  id: string;
  nome: string;
  handle: string | null;
  descricao: string | null;
  nicho: string | null;
  promptSistemaPadrao: string | null;
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
    promptSistemaPadrao: c.promptSistemaPadrao,
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

// GET /api/channels -> lista os canais do usuário logado.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const canais = await prisma.channel.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
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

  const criado = await prisma.channel.create({
    data: {
      userId: user.id,
      nome: parsed.data.nome,
      handle: limpar(parsed.data.handle),
      descricao: limpar(parsed.data.descricao),
      nicho: limpar(parsed.data.nicho),
      promptSistemaPadrao: limpar(parsed.data.promptSistemaPadrao),
    },
  });
  return NextResponse.json(toDTO(criado), { status: 201 });
}
