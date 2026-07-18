import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toDTO } from "../route";

export const runtime = "nodejs";

const updateSchema = z.object({
  nome: z.string().trim().min(1).max(200).optional(),
  texto: z.string().max(20_000).optional(),
});

// PATCH /api/prompts/:id -> atualiza um prompt do próprio usuário.
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

  // Garante a posse: só atualiza se o prompt for do usuário.
  const resultado = await prisma.prompt.updateMany({
    where: { id, userId: user.id },
    data: parsed.data,
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Prompt não encontrado." }, { status: 404 });
  }

  const atualizado = await prisma.prompt.findUnique({ where: { id } });
  return NextResponse.json(atualizado ? toDTO(atualizado) : null);
}

// DELETE /api/prompts/:id -> remove um prompt do próprio usuário.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const resultado = await prisma.prompt.deleteMany({
    where: { id, userId: user.id },
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Prompt não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
