// Criptografia simétrica para guardar segredos (chaves de API) no banco.
// AES-256-GCM: confidencialidade + integridade (tag). A chave vem de
// APP_ENCRYPTION_KEY (base64, 32 bytes). Guardamos ciphertext, iv e tag
// separados — nunca o valor em texto puro.
//
// Sem "server-only" de propósito: o módulo não toca em rede/DB e assim pode ser
// testado em Node. Ainda assim ele só é importado por código de servidor.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface SegredoCifrado {
  ciphertext: string;
  iv: string;
  tag: string;
}

function obterChave(): Buffer {
  const b64 = process.env.APP_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("APP_ENCRYPTION_KEY não configurada.");
  }
  const chave = Buffer.from(b64, "base64");
  if (chave.length !== 32) {
    throw new Error(
      "APP_ENCRYPTION_KEY deve ter 32 bytes (base64). Gere com crypto.randomBytes(32)."
    );
  }
  return chave;
}

export function cifrar(textoPuro: string): SegredoCifrado {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", obterChave(), iv);
  const enc = Buffer.concat([cipher.update(textoPuro, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decifrar(dados: SegredoCifrado): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    obterChave(),
    Buffer.from(dados.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(dados.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dados.ciphertext, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Mostra só os últimos caracteres da chave, para conferência na UI. */
export function mascarar(valor: string): string {
  const limpo = valor.trim();
  if (limpo.length <= 4) return "••••";
  return `••••${limpo.slice(-4)}`;
}
