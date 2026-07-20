import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

// GET /api/settings -> preferências do usuário logado.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultProvider: true },
  });
  return NextResponse.json({ defaultProvider: row?.defaultProvider ?? null });
}

const putSchema = z.object({
  // null limpa o modelo padrão.
  defaultProvider: z.enum(["fake", "gemini", "openai"]).nullable(),
});

// PUT /api/settings -> atualiza o modelo de IA padrão.
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { defaultProvider: parsed.data.defaultProvider },
  });
  return NextResponse.json({ defaultProvider: parsed.data.defaultProvider });
}
