import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const usernameArgument = process.argv.find((argument) =>
  argument.startsWith("--username=")
);
const username = usernameArgument?.slice("--username=".length).trim() || "admin";
const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const derivedKey = await scryptAsync(password, salt, 64);
const passwordHash = [
  "scrypt",
  salt.toString("base64url"),
  Buffer.from(derivedKey).toString("base64url"),
].join("$");
const sessionSecret = randomBytes(48).toString("base64url");

console.log("Credenciais geradas. Guarde a senha em um gerenciador seguro:\n");
console.log(`Usuário: ${username}`);
console.log(`Senha: ${password}\n`);
console.log("Adicione estas variáveis ao ambiente local e ao provedor de hospedagem:\n");
console.log(`AUTH_USERNAME=${username}`);
console.log(`AUTH_PASSWORD_HASH=${passwordHash}`);
console.log(`AUTH_SESSION_SECRET=${sessionSecret}`);
