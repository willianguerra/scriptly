// Cria ou atualiza um usuário no banco (tabela User).
//
// Uso (o --env-file carrega DATABASE_URL do .env):
//   node --env-file=.env scripts/create-user.mjs --username=admin --password=segredo
//   node --env-file=.env scripts/create-user.mjs --username=joao          (gera senha)
//   node --env-file=.env scripts/create-user.mjs --from-env               (semeia a partir de AUTH_USERNAME/AUTH_PASSWORD_HASH)
//
// Também exposto como: npm run db:create-user -- --username=... --password=...

import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

function arg(name) {
  const found = process.argv.find((x) => x.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3).trim() : undefined;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return [
    "scrypt",
    salt.toString("base64url"),
    Buffer.from(key).toString("base64url"),
  ].join("$");
}

async function main() {
  let username = arg("username");
  let passwordHash;
  let senhaGerada;

  if (hasFlag("from-env")) {
    username = username || process.env.AUTH_USERNAME;
    passwordHash = process.env.AUTH_PASSWORD_HASH;
    if (!username || !passwordHash) {
      throw new Error(
        "--from-env exige AUTH_USERNAME e AUTH_PASSWORD_HASH no ambiente."
      );
    }
  } else {
    username = username || "admin";
    let password = arg("password");
    if (!password) {
      password = randomBytes(18).toString("base64url");
      senhaGerada = password;
    }
    passwordHash = await hashPassword(password);
  }

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`Usuário salvo no banco: ${user.username}`);
  if (senhaGerada) {
    console.log(`Senha gerada (guarde em local seguro): ${senhaGerada}`);
  }
}

main()
  .catch((error) => {
    console.error("Erro:", error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
