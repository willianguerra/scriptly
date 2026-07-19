import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toVideoDTO } from "@/app/api/channels/[id]/videos/route";

export const runtime = "nodejs";

const updateSchema = z.object({
  titulo: z.string().trim().min(1).max(300).optional(),
  tema: z.string().max(2_000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  promptSistema: z.string().max(20_000).nullable().optional(),
  provider: z.string().max(50).nullable().optional(),
  roteiro: z.string().max(200_000).nullable().optional(),
  voz: z.string().max(200).nullable().optional(),
  segmentos: z.any().optional(),
  timings: z.any().optional(),
  srt: z.string().max(500_000).nullable().optional(),
  notas: z.string().max(20_000).nullable().optional(),
});

// Monta o objeto de update do Prisma a partir dos campos presentes.
function montarData(data: z.infer<typeof updateSchema>) {
  const out: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(data)) {
    if (valor === undefined) continue;
    if (chave === "scheduledAt") {
      out[chave] = valor === null ? null : new Date(valor as string);
      continue;
    }
    out[chave] = valor;
  }
  return out;
}

// GET /api/videos/:id -> retorna um vídeo de um canal do próprio usuário.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const video = await prisma.video.findFirst({
    where: { id, channel: { userId: user.id } },
  });
  if (!video) {
    return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  }
  return NextResponse.json(toVideoDTO(video));
}

// PATCH /api/videos/:id -> atualiza um vídeo de um canal do próprio usuário.
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

  const resultado = await prisma.video.updateMany({
    where: { id, channel: { userId: user.id } },
    data: montarData(parsed.data),
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  }

  const atualizado = await prisma.video.findUnique({ where: { id } });
  return NextResponse.json(atualizado ? toVideoDTO(atualizado) : null);
}

// DELETE /api/videos/:id -> remove um vídeo de um canal do próprio usuário.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const resultado = await prisma.video.deleteMany({
    where: { id, channel: { userId: user.id } },
  });
  if (resultado.count === 0) {
    return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
