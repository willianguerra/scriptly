import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/auth/current-user";

export const runtime = "nodejs";

// GET /api/admin/users -> lista todos os cadastros (para o painel do admin).
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      approvedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      approvedAt: u.approvedAt?.getTime() ?? null,
      createdAt: u.createdAt.getTime(),
    }))
  );
}

const ACTION_TO_STATUS = {
  approve: "APPROVED",
  reject: "REJECTED",
  suspend: "SUSPENDED",
} as const;

const patchSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["approve", "reject", "suspend"]),
});

// PATCH /api/admin/users -> aprova, rejeita ou suspende um cadastro.
export async function PATCH(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { userId, action } = parsed.data;

  // Um admin não pode se rebaixar/suspender sozinho e trancar a plataforma.
  if (userId === admin.id) {
    return NextResponse.json(
      { error: "Você não pode alterar o seu próprio acesso." },
      { status: 400 }
    );
  }

  const alvo = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!alvo) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }
  if (alvo.role === "ADMIN") {
    return NextResponse.json(
      { error: "Não é possível alterar o acesso de outro administrador." },
      { status: 400 }
    );
  }

  const status = ACTION_TO_STATUS[action];
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      status,
      approvedAt: status === "APPROVED" ? new Date() : null,
      approvedBy: status === "APPROVED" ? admin.username : null,
    },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
