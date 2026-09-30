import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const job = await prisma.productionJob.findFirst({ where: { id, userId: user.id, status: { in: ["waiting", "processing"] } }, select: { id: true, projectId: true } });
  if (!job) return NextResponse.json({ error: "Job ativo não encontrado." }, { status: 404 });
  const cancelled = await prisma.$transaction(async (tx) => {
    const result = await tx.productionJob.updateMany({ where: { id, userId: user.id, status: { in: ["waiting", "processing"] } }, data: { status: "cancelled", progress: 0, error: "Cancelado pelo usuário.", finishedAt: new Date() } });
    if (result.count) await tx.productionProject.updateMany({ where: { id: job.projectId, userId: user.id }, data: { status: "cancelled", stage: "render", lastError: "Exportação cancelada." } });
    return result.count > 0;
  });
  return cancelled ? NextResponse.json({ ok: true, status: "cancelled" }) : NextResponse.json({ error: "O job já mudou de estado." }, { status: 409 });
}
