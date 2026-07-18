// Criptografia simétrica para guardar segredos (chaves de API) no banco.
// AES-256-GCM: confidencialidade + integridade (tag). A chave vem de
// APP_ENCRYPTION_KEY (base64, 32 bytes). Guardamos ciphertext, iv e tag
// separados — nunca o valor em texto puro.
//
// Sem "server-only" de propósito: o módulo não toca em rede/DB e assim pode ser
// testado em Node. Ainda assim ele só é importado por código de servidor.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const TAMANHO_CHAVE = 32;
const TAMANHO_IV = 12;
const TAMANHO_TAG = 16;

export interface SegredoCifrado {
  ciphertext: string;
  iv: string;
  tag: string;
}

function decodificarBase64(valor: string, campo: string): Buffer {
  const bytes = Buffer.from(valor, "base64");
  if (bytes.toString("base64") !== valor) {
    throw new Error(`${campo} deve estar em base64 canônico.`);
  }
  return bytes;
}

function obterChave(): Buffer {
  const b64 = process.env.APP_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("APP_ENCRYPTION_KEY não configurada.");
  }
  const chave = decodificarBase64(b64, "APP_ENCRYPTION_KEY");
  if (chave.length !== TAMANHO_CHAVE) {
    throw new Error(
      "APP_ENCRYPTION_KEY deve ter 32 bytes (base64). Gere com crypto.randomBytes(32)."
    );
  }
  return chave;
}

export function cifrar(textoPuro: string): SegredoCifrado {
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, obterChave(), iv);
  const enc = Buffer.concat([cipher.update(textoPuro, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decifrar(dados: SegredoCifrado): string {
  const iv = decodificarBase64(dados.iv, "IV");
  if (iv.length !== TAMANHO_IV) {
    throw new Error(`IV deve ter ${TAMANHO_IV} bytes.`);
  }

  const tag = decodificarBase64(dados.tag, "tag");
  if (tag.length !== TAMANHO_TAG) {
    throw new Error(`tag deve ter ${TAMANHO_TAG} bytes.`);
  }

  const ciphertext = decodificarBase64(dados.ciphertext, "ciphertext");
  const decipher = createDecipheriv(
    ALGORITMO,
    obterChave(),
    iv
  );
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([
    decipher.update(ciphertext),
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
