export const VOICE_COOKIE_NAME = "darkvi_voice";

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Nome de cookie por usuário, para a voz preferida não vazar entre contas num
 * navegador compartilhado. Sem usuário, usa o nome global (compatibilidade). */
export function nomeCookieVoz(username?: string): string {
  return username ? `${VOICE_COOKIE_NAME}__${username}` : VOICE_COOKIE_NAME;
}

export function lerVozDoCookie(
  cookieHeader: string,
  cookieName: string = VOICE_COOKIE_NAME
): string {
  const prefix = `${cookieName}=`;
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

export function criarCookieVoz(
  vozId: string,
  secure = false,
  cookieName: string = VOICE_COOKIE_NAME
): string {
  const cookie = [
    `${cookieName}=${encodeURIComponent(vozId)}`,
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

export function lerPreferenciaVoz(username?: string): string {
  if (typeof document === "undefined") return "";
  return lerVozDoCookie(document.cookie, nomeCookieVoz(username));
}

export function salvarPreferenciaVoz(vozId: string, username?: string): void {
  if (typeof document === "undefined" || !vozId) return;
  const secure = window.location.protocol === "https:";
  document.cookie = criarCookieVoz(vozId, secure, nomeCookieVoz(username));
}
