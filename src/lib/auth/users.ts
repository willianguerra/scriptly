import "server-only";

import type { Role, Status } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";

// Hash "dummy" com formato válido. Quando o usuário não existe, ainda rodamos
// verifyPassword contra ele para que o tempo de resposta seja parecido com o de
// um usuário real — dificultando enumeração de usuários por timing.
const DUMMY_HASH =
  "scrypt$BJG9ZUnE5ZTr-ihxshYg6Q$zx3IJ_cveghbwuxswDjz0uGwe9NOFNdMlZko99v6YEmh4KmjQ73fk9gRgJc8fAymaKgal5Lct_ymH3rZuAhdug";

export type AuthenticatedUser = {
  id: string;
  username: string;
  role: Role;
  status: Status;
};

/**
 * Verifica usuário + senha contra o banco. Retorna o usuário autenticado ou
 * null. Sempre executa a derivação da senha (mesmo sem usuário) para não vazar,
 * pelo tempo, se o usuário existe. A checagem de `status` (aprovado/pendente/
 * bloqueado) é responsabilidade de quem chama (rota de login).
 */
export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const senhaConfere = await verifyPassword(password, hash);

  if (!user || !senhaConfere) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
  };
}

export type RegisterResult =
  | { ok: true }
  // `taken` é genérico de propósito: não confirmamos ao visitante se foi o
  // usuário ou o e-mail que já existe (evita enumeração de contas).
  | { ok: false; reason: "taken" };

/**
 * Cria um novo cadastro com status PENDING (aguardando aprovação do admin).
 * Nunca cria admins nem aprova automaticamente.
 */
export async function registerUser(
  username: string,
  password: string,
  email?: string
): Promise<RegisterResult> {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "taken" };

  const passwordHash = await hashPassword(password);
  try {
    await prisma.user.create({
      data: {
        username,
        email: email || null,
        passwordHash,
        role: "USER",
        status: "PENDING",
      },
    });
    return { ok: true };
  } catch {
    // Corrida entre a checagem acima e o create (violação de unique).
    return { ok: false, reason: "taken" };
  }
}
