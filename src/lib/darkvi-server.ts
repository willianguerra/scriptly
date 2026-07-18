// Helpers server-side para conversar com a API Darkvi.
// O token vem do header Authorization enviado pelo cliente
// (guardado no localStorage do navegador) ou, em fallback,
// da variável de ambiente DARKVI_API_TOKEN.

export const DARKVI_BASE_URL = "https://darkvi.com/api";

export function resolveToken(req: Request): string | null {
  // Prioridade: chave enviada pelo cliente (salva nas Configurações do navegador)
  // vence a chave do servidor (variável de ambiente DARKVI_API_TOKEN).
  const auth = req.headers.get("authorization");
  const fromHeader = auth?.replace(/^Bearer\s+/i, "").trim();
  if (fromHeader) return fromHeader;

  const envToken = process.env.DARKVI_API_TOKEN;
  return envToken?.trim() || null;
}

export function missingTokenResponse() {
  return Response.json(
    {
      ok: false,
      error: true,
      code: "AUTH_MISSING_TOKEN",
      message: "Token da Darkvi não informado. Cole sua API key em darkvi.com/settings.",
    },
    { status: 401 }
  );
}
