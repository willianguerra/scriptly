import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyUserCredentials } from "@/lib/auth/users";
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

// Em produção há sempre um IP real (x-forwarded-for na Vercel). Em
// desenvolvimento não há, então todas as tentativas cairiam na mesma chave
// "unknown" e um punhado de erros travaria o login por 15 min. Por isso o
// limitador só age em produção.
const rateLimitAtivo = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  const key = clientKey(request);
  if (rateLimitAtivo && !loginLimiter.canAttempt(key)) {
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
    if (rateLimitAtivo) loginLimiter.recordFailure(key);
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 400 });
  }

  const parsed = credentialsSchema.safeParse(input);
  const sessionSecret = process.env.AUTH_SESSION_SECRET;

  if (!sessionSecret) {
    return NextResponse.json(
      { error: "Autenticação não configurada no servidor." },
      { status: 503 }
    );
  }

  // Credenciais agora vêm do banco (tabela User), não mais do .env.
  const usuario = parsed.success
    ? await verifyUserCredentials(parsed.data.username, parsed.data.password)
    : null;

  if (!usuario) {
    if (rateLimitAtivo) loginLimiter.recordFailure(key);
    return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
  }

  loginLimiter.reset(key);
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const token = await createSessionToken(
    { username: usuario.username, expiresAt },
    sessionSecret
  );
  const response = NextResponse.json({ username: usuario.username });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1_000),
  });

  return response;
}
