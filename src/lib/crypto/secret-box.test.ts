import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { cifrar, decifrar, mascarar } from "./secret-box.ts";

const chaveOriginal = process.env.APP_ENCRYPTION_KEY;
const chaveDeTeste = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  if (chaveOriginal === undefined) {
    delete process.env.APP_ENCRYPTION_KEY;
  } else {
    process.env.APP_ENCRYPTION_KEY = chaveOriginal;
  }
});

test("cifra e decifra texto UTF-8 com AES-256-GCM", () => {
  process.env.APP_ENCRYPTION_KEY = chaveDeTeste;

  const segredo = "sk-teste-🔐-áção";
  const cifrado = cifrar(segredo);

  assert.equal(decifrar(cifrado), segredo);
  assert.equal(Buffer.from(cifrado.iv, "base64").length, 12);
  assert.equal(Buffer.from(cifrado.tag, "base64").length, 16);
  assert.equal(cifrado.ciphertext.includes(segredo), false);
});

test("usa um IV aleatório novo em cada cifra", () => {
  process.env.APP_ENCRYPTION_KEY = chaveDeTeste;

  const primeiro = cifrar("mesmo-segredo");
  const segundo = cifrar("mesmo-segredo");

  assert.notEqual(primeiro.iv, segundo.iv);
  assert.notEqual(primeiro.ciphertext, segundo.ciphertext);
});

test("rejeita ciphertext, IV ou tag adulterados", () => {
  process.env.APP_ENCRYPTION_KEY = chaveDeTeste;
  const original = cifrar("segredo");

  for (const campo of ["ciphertext", "iv", "tag"] as const) {
    const bytes = Buffer.from(original[campo], "base64");
    bytes[0] ^= 1;

    assert.throws(() =>
      decifrar({
        ...original,
        [campo]: bytes.toString("base64"),
      })
    );
  }
});

test("rejeita chave ausente, de tamanho errado ou base64 não canônico", () => {
  delete process.env.APP_ENCRYPTION_KEY;
  assert.throws(() => cifrar("segredo"), /APP_ENCRYPTION_KEY/);

  process.env.APP_ENCRYPTION_KEY = Buffer.alloc(31).toString("base64");
  assert.throws(() => cifrar("segredo"), /32 bytes/);

  process.env.APP_ENCRYPTION_KEY = `${chaveDeTeste}!`;
  assert.throws(() => cifrar("segredo"), /base64/);
});

test("rejeita payload com codificação ou tamanhos inválidos", () => {
  process.env.APP_ENCRYPTION_KEY = chaveDeTeste;
  const original = cifrar("segredo");

  assert.throws(() => decifrar({ ...original, ciphertext: "@@@" }), /ciphertext/);
  assert.throws(() => decifrar({ ...original, iv: "AA==" }), /IV/);
  assert.throws(() => decifrar({ ...original, tag: "AA==" }), /tag/);
});

test("mascara a chave exibindo somente os quatro últimos caracteres", () => {
  assert.equal(mascarar("  sk-123456  "), "••••3456");
  assert.equal(mascarar("abc"), "••••");
});
