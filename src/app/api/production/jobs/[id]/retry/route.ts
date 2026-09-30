import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const job = await prisma.productionJob.findFirst({ where: { id, userId: user.id, status: "error" }, select: { id: true, projectId: true } });
  if (!job) return NextResponse.json({ error: "Job com falha não encontrado." }, { status: 404 });
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.productionJob.updateMany({ where: { id, userId: user.id, status: "error" }, data: { status: "waiting", progress: 0, error: null, finishedAt: null } });
    if (!result.count) return false;
    await tx.productionProject.updateMany({ where: { id: job.projectId, userId: user.id }, data: { status: "waiting", stage: "render", lastError: null } });
    return true;
  });
  return updated ? NextResponse.json({ ok: true, status: "waiting" }, { status: 202 }) : NextResponse.json({ error: "O job já mudou de estado." }, { status: 409 });
}
