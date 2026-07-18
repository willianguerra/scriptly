export const SESSION_COOKIE_NAME = "scriptly_session";
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1_000;

export type Session = {
  username: string;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET deve ter pelo menos 32 caracteres.");
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<Session>;
  return (
    typeof session.username === "string" &&
    session.username.length > 0 &&
    session.username.length <= 100 &&
    Number.isSafeInteger(session.expiresAt)
  );
}

export async function createSessionToken(
  session: Session,
  secret: string
): Promise<string> {
  if (!isSession(session)) throw new Error("Sessão inválida.");

  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(session)));
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
  now = Date.now()
): Promise<Session | null> {
  if (!token || !secret || secret.length < 32) return null;

  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length > 0) return null;

  try {
    const key = await importSigningKey(secret);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      encoder.encode(payload)
    );
    if (!validSignature) return null;

    const parsed: unknown = JSON.parse(decoder.decode(base64UrlToBytes(payload)));
    if (!isSession(parsed) || parsed.expiresAt <= now) return null;

    return parsed;
  } catch {
    return null;
  }
}
