// Helpers de data para o agendamento (scheduledAt) dos vídeos. As datas são
// tratadas como data de calendário em UTC para evitar deslocamento de fuso.

export function msParaInputDate(ms: number | null): string {
  if (ms == null) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

export function inputDateParaISO(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatarDataCurta(ms: number | null): string {
  if (ms == null) return "";
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
