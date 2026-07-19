import "server-only";

import type { Role, Status } from "@prisma/client";

import { prisma } from "@/lib/db";
import { getServerSession } from "./server";

export type CurrentUser = {
  id: string;
  username: string;
  role: Role;
  status: Status;
};

/**
 * Retorna o usuário logado (a partir da sessão assinada no cookie) ou null.
 * As rotas já são protegidas pelo middleware, mas ainda precisamos do id do
 * usuário no banco para escopar os dados. Relê `status`/`role` do banco a cada
 * chamada, então uma suspensão feita pelo admin passa a valer no próximo acesso
 * (o cookie sozinho não basta).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { username: session.username },
    select: { id: true, username: true, role: true, status: true },
  });
  if (!user || user.status !== "APPROVED") return null;
  return user;
}

/**
 * Igual a getCurrentUser, mas só resolve para admins aprovados. Use nas rotas
 * e páginas do painel /admin. Retorna null para qualquer outro caso.
 */
export async function getCurrentAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
