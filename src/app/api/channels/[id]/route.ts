import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toDTO, channelInclude, resolverDefaultPromptId } from "../route";

export const runtime = "nodejs";

const updateSchema = z.object({
  nome: z.string().trim().min(1).max(200).optional(),
  handle: z.string().trim().max(100).nullable().optional(),
  descricao: z.string().max(2_000).nullable().optional(),
  nicho: z.string().trim().max(200).nullable().optional(),
  promptSistemaPadrao: z.string().max(20_000).nullable().optional(),
  defaultPromptId: z.string().nullable().optional(),
});

// Converte "" -> null para os campos de texto; mantém undefined fora do update.
// defaultPromptId é tratado à parte (verificação de posse).
function normalizar(data: z.infer<typeof updateSchema>) {
  const out: Record<string, string | null> = {};
  for (const [chave, valor] of Object.entries(data)) {
    if (chave === "defaultPromptId" || valor === undefined) continue;
    if (valor === null) {
      out[chave] = null;
      continue;
    }
    const t = valor.trim();
    out[chave] = chave === "nome" ? t : t.length > 0 ? t : null;
  }
  return out;
}

// GET /api/channels/:id -> retorna um canal do próprio usuário.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const canal = await prisma.channel.findFirst({
    where: { id, userId: user.id },
    include: channelInclude,
  });
  if (!canal) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  }
  return NextResponse.json(toDTO(canal));
}

// PATCH /api/channels/:id -> atualiza um canal do próprio usuário.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const data = normalizar(parsed.data);
  if (parsed.data.defaultPromptId !== undefined) {
    data.defaultPromptId = await resolverDefaultPromptId(
      user.id,
      parsed.data.defaultPromptId
    );
  }

  const resultado = await prisma.channel.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  }

  const atualizado = await prisma.channel.findUnique({
    where: { id },
    include: channelInclude,
  });
  return NextResponse.json(atualizado ? toDTO(atualizado) : null);
}

// DELETE /api/channels/:id -> remove um canal (e seus vídeos, via cascade).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const resultado = await prisma.channel.deleteMany({
    where: { id, userId: user.id },
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
