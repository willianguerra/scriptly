import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { productionProjectWhere, sceneListSchema } from "@/lib/production/models";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.productionProject.findFirst({ where: productionProjectWhere(id, user.id) });
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
  const parsedScenes = sceneListSchema.safeParse(project.scenes);
  if (!parsedScenes.success || !parsedScenes.data.length) return NextResponse.json({ error: "O plano de cenas está inválido." }, { status: 409 });
  const missing = parsedScenes.data.filter((scene) => !scene.selectedCandidateId || !scene.candidates.some((candidate) => candidate.id === scene.selectedCandidateId));
  if (missing.length) return NextResponse.json({ error: `Escolha um clipe para as cenas ${missing.map((scene) => scene.order).join(", ")} antes de exportar.` }, { status: 400 });
  const queued = await prisma.$transaction(async (tx) => {
    const job = await tx.productionJob.create({ data: { projectId: id, userId: user.id, kind: "render", status: "waiting", input: { sceneCount: parsedScenes.data.length } } });
    await tx.productionProject.updateMany({ where: productionProjectWhere(id, user.id), data: { status: "waiting", stage: "render", lastError: null, scenes: parsedScenes.data as unknown as Prisma.InputJsonValue } });
    return job;
  });
  return NextResponse.json({ jobId: queued.id, status: queued.status, message: "Exportação na fila. O worker de mídia precisa estar ativo para processá-la." }, { status: 202 });
}
