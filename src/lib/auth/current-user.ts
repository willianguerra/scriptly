import "server-only";

import { prisma } from "@/lib/db";
import { getServerSession } from "./server";

/**
 * Retorna o usuário logado (a partir da sessão assinada no cookie) ou null.
 * As rotas já são protegidas pelo middleware, mas ainda precisamos do id do
 * usuário no banco para escopar os dados.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  username: string;
} | null> {
  const session = await getServerSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { username: session.username },
    select: { id: true, username: true },
  });
  return user;
}
