import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyPassword } from "@/lib/auth/password";
import { LoginRateLimiter } from "@/lib/auth/rate-limit";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

const loginLimiter = new LoginRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1_000,
});

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
}

export async function POST(request: Request) {
  const key = clientKey(request);
  if (!loginLimiter.canAttempt(key)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4_096) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 413 });
  }

  let input: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 4_096) throw new Error("body too large");
    input = JSON.parse(rawBody);
  } catch {
    loginLimiter.recordFailure(key);
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });
  }

  const parsed = credentialsSchema.safeParse(input);
  const configuredUsername = process.env.AUTH_USERNAME;
  const passwordHash = process.env.AUTH_PASSWORD_HASH;
  const sessionSecret = process.env.AUTH_SESSION_SECRET;

  if (!configuredUsername || !passwordHash || !sessionSecret) {
    return NextResponse.json(
      { error: "Autenticação não configurada no servidor." },
      { status: 503 }
    );
  }

  const passwordMatches = parsed.success
    ? await verifyPassword(parsed.data.password, passwordHash)
    : false;
  const usernameMatches =
    parsed.success && parsed.data.username === configuredUsername;

  if (!passwordMatches || !usernameMatches) {
    loginLimiter.recordFailure(key);
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  loginLimiter.reset(key);
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = await createSessionToken(
    { username: configuredUsername, expiresAt },
    sessionSecret
  );
  const response = NextResponse.json({ username: configuredUsername });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1_000),
  });

  return response;
}
