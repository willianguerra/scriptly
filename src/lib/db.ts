// Cliente Prisma como singleton. Em desenvolvimento o Next recarrega os módulos
// a cada mudança; sem o singleton isso abriria uma conexão nova a cada reload e
// estouraria o limite do Postgres. Guardamos a instância no globalThis.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
