import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { PromptSalvo } from "@/types/prompt";

export const runtime = "nodejs";

const promptSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  texto: z.string().max(20_000).default(""),
});

type PromptRow = {
  id: string;
  nome: string;
  texto: string;
  updatedAt: Date;
};

export function toDTO(p: PromptRow): PromptSalvo {
  return {
    id: p.id,
    nome: p.nome,
    texto: p.texto,
    atualizadoEm: p.updatedAt.getTime(),
  };
}

// GET /api/prompts -> lista os prompts do usuário logado.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const prompts = await prisma.prompt.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(prompts.map(toDTO));
}

// POST /api/prompts -> cria um prompt para o usuário logado.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = promptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "O prompt precisa de um nome." },
      { status: 400 }
    );
  }

  const criado = await prisma.prompt.create({
    data: {
      userId: user.id,
      nome: parsed.data.nome,
      texto: parsed.data.texto,
    },
  });
  return NextResponse.json(toDTO(criado), { status: 201 });
}
