import { NextResponse } from "next/server";
import { z } from "zod";

import { registerUser } from "@/lib/auth/users";
import { LoginRateLimiter } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "O usuário precisa ter ao menos 3 caracteres.")
    .max(100)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Use apenas letras, números, ponto, hífen ou underline."
    ),
  email: z.string().trim().max(200).email().optional().or(z.literal("")),
  password: z
    .string()
    .min(8, "A senha precisa ter ao menos 8 caracteres.")
    .max(200),
});

// Mesmo limitador do login: barra criação em massa de cadastros por IP.
const registerLimiter = new LoginRateLimiter({
  maxAttempts: 5,
  windowMs: 60 * 60 * 1_000,
});
const rateLimitAtivo = process.env.NODE_ENV === "production";

function clientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return (
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const key = clientKey(request);
  if (rateLimitAtivo && !registerLimiter.canAttempt(key)) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": "3600" } }
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
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Dados inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (rateLimitAtivo) registerLimiter.recordFailure(key);

  const email = parsed.data.email ? parsed.data.email : undefined;
  const result = await registerUser(
    parsed.data.username,
    parsed.data.password,
    email
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro. Tente outro usuário." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message:
        "Cadastro enviado! Aguarde a aprovação do administrador para acessar.",
    },
    { status: 201 }
  );
}
