export const CARACTERES_POR_BLOCO = 500;
export const PALAVRAS_MAX_BLOCO = 100;
export const DURACAO_BLOCO = 30;
export const INTERVALO_ENTRE_BLOCOS = 10;
export const INTERVALO_ENTRE_ROTEIROS = 600;

export interface ResultadoConversao {
  srt: string;
  contador: number;
  tempoAcumulado: number;
}

export const pad = (n: number, size = 2) => n.toString().padStart(size, "0");

export const formatarTempo = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},000`;
};

export const formatarBlocoSRT = (i: number, inicio: number, texto: string) => {
  const fim = inicio + DURACAO_BLOCO;
  return `${i}\n${formatarTempo(inicio)} --> ${formatarTempo(fim)}\n${texto.trim()}\n\n`;
};

export const sentenceSplit = (texto: string): string[] => {
  const partes: string[] = [];
  const regex = /[^.!?]+[.!?]+|\n+/g;
  let match: RegExpExecArray | null;
  let ultimoFim = 0;

  while ((match = regex.exec(texto)) !== null) {
    const trecho = match[0].trim();
    if (trecho) partes.push(trecho);
    ultimoFim = regex.lastIndex;
  }
  if (ultimoFim < texto.length) {
    const resto = texto.slice(ultimoFim).trim();
    if (resto) partes.push(resto);
  }
  return partes;
};

export const splitEmChunksPorPalavras = (
  texto: string,
  limiteChars: number,
  limitePalavras: number
) => {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let atual: string[] = [];
  let charsAtual = 0;

  palavras.forEach((p) => {
    const add = atual.length === 0 ? p : " " + p;
    if (charsAtual + add.length > limiteChars || atual.length + 1 > limitePalavras) {
      if (atual.length > 0) chunks.push(atual.join(" "));
      atual = [p];
      charsAtual = p.length;
    } else {
      atual.push(p);
      charsAtual += add.length;
    }
  });

  if (atual.length > 0) chunks.push(atual.join(" "));
  return chunks;
};

export const converterParaSRT = (
  texto: string,
  contadorInicial: number,
  tempoInicial: number
): ResultadoConversao => {
  let srt = "";
  let contador = contadorInicial;
  let tempoAcumulado = tempoInicial;

  const frases = sentenceSplit(texto);
  let bloco = "";
  let blocoPalavras = 0;
  let blocoCaracteres = 0;

  for (let i = 0; i < frases.length; i++) {
    const frase = frases[i].trim().replace(/\s+/g, " ");
    const palavrasNaFrase = frase.split(/\s+/).length;
    const caracteresNaFrase = frase.length + 1;

    if (caracteresNaFrase > CARACTERES_POR_BLOCO) {
      if (bloco) {
        srt += formatarBlocoSRT(contador++, tempoAcumulado, bloco);
        tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
        bloco = "";
        blocoPalavras = 0;
        blocoCaracteres = 0;
      }

      const partes = splitEmChunksPorPalavras(
        frase,
        CARACTERES_POR_BLOCO,
        PALAVRAS_MAX_BLOCO
      );
      partes.forEach((parte) => {
        srt += formatarBlocoSRT(contador++, tempoAcumulado, parte);
        tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
      });

      continue;
    }

    const cabeNoBloco =
      blocoPalavras + palavrasNaFrase <= PALAVRAS_MAX_BLOCO &&
      blocoCaracteres + caracteresNaFrase <= CARACTERES_POR_BLOCO;

    if (cabeNoBloco) {
      bloco += (bloco ? " " : "") + frase;
      blocoPalavras += palavrasNaFrase;
      blocoCaracteres += caracteresNaFrase;
    } else {
      if (bloco) {
        srt += formatarBlocoSRT(contador++, tempoAcumulado, bloco);
        tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
      }
      bloco = frase;
      blocoPalavras = palavrasNaFrase;
      blocoCaracteres = frase.length;
    }
  }

  if (bloco) {
    srt += formatarBlocoSRT(contador++, tempoAcumulado, bloco);
    tempoAcumulado += DURACAO_BLOCO + INTERVALO_ENTRE_BLOCOS;
  }

  return { srt, contador, tempoAcumulado };
};
