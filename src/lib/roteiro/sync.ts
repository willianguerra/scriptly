// Tipos e utilidades puras da etapa de sincronização (PLAN.md Fase 3).
// A ideia: dado o áudio da narração, o Whisper devolve os tempos por palavra;
// aqui agrupamos essas palavras em segmentos legíveis e geramos timings.json
// e SRT. Sem dependência de browser — pode ser testado em Node.

/** Um trecho alinhado do roteiro ao áudio (tempos em segundos). */
export interface Segmento {
  texto: string;
  inicio: number;
  fim: number;
}

/** Estrutura serializável salva como timings.json. */
export interface Timings {
  duracao: number;
  segmentos: Segmento[];
}

/** Limite padrão de caracteres por segmento/legenda. */
const MAX_CHARS_SEGMENTO = 90;

/**
 * Agrupa palavras (cada uma com seu tempo) em segmentos de até `maxChars`
 * caracteres, quebrando também em pontuação de fim de frase. Ignora palavras
 * sem tempo válido.
 */
export function agruparPalavras(
  palavras: Segmento[],
  maxChars: number = MAX_CHARS_SEGMENTO
): Segmento[] {
  const segmentos: Segmento[] = [];
  let atual: Segmento | null = null;

  for (const palavra of palavras) {
    const texto = palavra.texto.trim();
    if (!texto) continue;
    if (!Number.isFinite(palavra.inicio) || !Number.isFinite(palavra.fim)) {
      continue;
    }

    if (!atual) {
      atual = { texto, inicio: palavra.inicio, fim: palavra.fim };
      continue;
    }

    const combinado = `${atual.texto} ${texto}`;
    atual.fim = palavra.fim;

    if (combinado.length > maxChars) {
      segmentos.push(atual);
      atual = { texto, inicio: palavra.inicio, fim: palavra.fim };
    } else {
      atual.texto = combinado;
      // Quebra ao terminar uma frase, para as legendas não colarem sentenças.
      if (/[.!?…]$/.test(texto)) {
        segmentos.push(atual);
        atual = null;
      }
    }
  }

  if (atual) segmentos.push(atual);
  return segmentos;
}

/** Monta o objeto Timings a partir dos segmentos e da duração do áudio. */
export function montarTimings(
  segmentos: Segmento[],
  duracao: number
): Timings {
  const arredondar = (n: number) => Number(n.toFixed(3));
  return {
    duracao: arredondar(duracao),
    segmentos: segmentos.map((s) => ({
      texto: s.texto,
      inicio: arredondar(s.inicio),
      fim: arredondar(s.fim),
    })),
  };
}

/** Formata segundos no padrão SRT: HH:MM:SS,mmm. */
export function formatarTempoSRT(segundos: number): string {
  const seguro = Number.isFinite(segundos) ? Math.max(0, segundos) : 0;
  const ms = Math.round(seguro * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milis = ms % 1000;
  const pad = (n: number, tam = 2) => String(n).padStart(tam, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milis, 3)}`;
}

/** Converte segmentos alinhados em legenda SRT. */
export function segmentosParaSRT(segmentos: Segmento[]): string {
  return (
    segmentos
      .map((seg, i) => {
        const inicio = formatarTempoSRT(seg.inicio);
        const fim = formatarTempoSRT(Math.max(seg.fim, seg.inicio));
        return `${i + 1}\n${inicio} --> ${fim}\n${seg.texto.trim()}`;
      })
      .join("\n\n") + "\n"
  );
}
