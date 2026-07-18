import "server-only";

import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";

// Hash "dummy" com formato válido. Quando o usuário não existe, ainda rodamos
// verifyPassword contra ele para que o tempo de resposta seja parecido com o de
// um usuário real — dificultando enumeração de usuários por timing.
const DUMMY_HASH =
  "scrypt$BJG9ZUnE5ZTr-ihxshYg6Q$zx3IJ_cveghbwuxswDjz0uGwe9NOFNdMlZko99v6YEmh4KmjQ73fk9gRgJc8fAymaKgal5Lct_ymH3rZuAhdug";

/**
 * Verifica usuário + senha contra o banco. Retorna o usuário autenticado ou
 * null. Sempre executa a derivação da senha (mesmo sem usuário) para não vazar,
 * pelo tempo, se o usuário existe.
 */
export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<{ id: string; username: string } | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const senhaConfere = await verifyPassword(password, hash);

  if (!user || !senhaConfere) return null;
  return { id: user.id, username: user.username };
}
