export const VOICE_COOKIE_NAME = "darkvi_voice";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function lerVozDoCookie(cookieHeader: string): string {
  const prefix = `${VOICE_COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!cookie) return "";

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return "";
  }
}

export function criarCookieVoz(vozId: string, secure = false): string {
  const cookie = [
    `${VOICE_COOKIE_NAME}=${encodeURIComponent(vozId)}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_IN_SECONDS}`,
    "SameSite=Lax",
  ];

  if (secure) cookie.push("Secure");
  return cookie.join("; ");
}

export function escolherVozPreferida(
  vozesDisponiveis: string[],
  vozDoCookie: string,
  vozLegada = ""
): string {
  if (vozesDisponiveis.includes(vozDoCookie)) return vozDoCookie;
  if (vozesDisponiveis.includes(vozLegada)) return vozLegada;
  return vozesDisponiveis[0] ?? "";
}

export function lerPreferenciaVoz(): string {
  if (typeof document === "undefined") return "";
  return lerVozDoCookie(document.cookie);
}

export function salvarPreferenciaVoz(vozId: string): void {
  if (typeof document === "undefined" || !vozId) return;
  const secure = window.location.protocol === "https:";
  document.cookie = criarCookieVoz(vozId, secure);
}
