import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { VideoSalvo } from "@/types/video";

export const runtime = "nodejs";

const createSchema = z.object({
  titulo: z.string().trim().min(1).max(300),
  tema: z.string().max(2_000).optional(),
});

type VideoRow = {
  id: string;
  channelId: string;
  titulo: string;
  tema: string | null;
  scheduledAt: Date | null;
  promptSistema: string | null;
  provider: string | null;
  roteiro: string | null;
  voz: string | null;
  segmentos: unknown;
  timings: unknown;
  srt: string | null;
  notas: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toVideoDTO(v: VideoRow): VideoSalvo {
  return {
    id: v.id,
    channelId: v.channelId,
    titulo: v.titulo,
    tema: v.tema,
    scheduledAt: v.scheduledAt ? v.scheduledAt.getTime() : null,
    promptSistema: v.promptSistema,
    provider: v.provider,
    roteiro: v.roteiro,
    voz: v.voz,
    segmentos: v.segmentos ?? null,
    timings: v.timings ?? null,
    srt: v.srt,
    notas: v.notas,
    criadoEm: v.createdAt.getTime(),
    atualizadoEm: v.updatedAt.getTime(),
  };
}

// Confirma que o canal é do usuário logado; retorna o id ou null.
async function canalDoUsuario(
  channelId: string,
  userId: string
): Promise<boolean> {
  const canal = await prisma.channel.findFirst({
    where: { id: channelId, userId },
    select: { id: true },
  });
  return Boolean(canal);
}

// GET /api/channels/:id/videos -> lista os vídeos de um canal do usuário.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canalDoUsuario(id, user.id))) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  }

  const videos = await prisma.video.findMany({
    where: { channelId: id },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(videos.map(toVideoDTO));
}

// POST /api/channels/:id/videos -> cria um vídeo no canal do usuário.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canalDoUsuario(id, user.id))) {
    return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "O vídeo precisa de um título." },
      { status: 400 }
    );
  }

  const tema = parsed.data.tema?.trim();
  const criado = await prisma.video.create({
    data: {
      channelId: id,
      titulo: parsed.data.titulo,
      tema: tema && tema.length > 0 ? tema : null,
    },
  });
  return NextResponse.json(toVideoDTO(criado), { status: 201 });
}
