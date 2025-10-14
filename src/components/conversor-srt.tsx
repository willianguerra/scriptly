"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

// --- Constantes
const CARACTERES_POR_BLOCO = 500;
const PALAVRAS_MAX_BLOCO = 100;
const DURACAO_BLOCO = 30;
const INTERVALO_ENTRE_BLOCOS = 10;
const INTERVALO_ENTRE_ROTEIROS = 600;

interface ResultadoConversao {
  srt: string;
  contador: number;
  tempoAcumulado: number;
}

export function ConversorSRT() {
  const [roteiros, setRoteiros] = useState<string[]>([""]);
  const [resultado, setResultado] = useState("");

  // --- Utilitários ---
  const pad = (n: number, size = 2) => n.toString().padStart(size, "0");

  const formatarTempo = (segundos: number) => {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = Math.floor(segundos % 60);
    return `${pad(h)}:${pad(m)}:${pad(s)},000`;
  };

  const formatarBlocoSRT = (i: number, inicio: number, texto: string) => {
    const fim = inicio + DURACAO_BLOCO;
    return `${i}\n${formatarTempo(inicio)} --> ${formatarTempo(
      fim
    )}\n${texto.trim()}\n\n`;
  };

  const sentenceSplit = (texto: string): string[] => {
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

  const splitEmChunksPorPalavras = (
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

  const converterParaSRT = (
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

  const converterTodosRoteiros = (): string => {
    let srtFinal = "";
    let contador = 1;
    let tempoAcumulado = 0;

    roteiros.forEach((texto, idx) => {
      if (!texto.trim()) return;

      const r = converterParaSRT(texto.trim(), contador, tempoAcumulado);
      srtFinal += r.srt;
      contador = r.contador;
      tempoAcumulado = r.tempoAcumulado;

      if (idx < roteiros.length - 1) tempoAcumulado += INTERVALO_ENTRE_ROTEIROS;
    });

    return srtFinal.trim();
  };

  const handleDownload = () => {
    const blob = new Blob([resultado], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legendas.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLimpar = () => {
    setRoteiros([""]);
    setResultado("");
  };

  return (
    <div className="w-full p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Conversor de Texto para SRT</h1>

      <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto">
        {roteiros.map((roteiro, i) => (
          <Card key={i} className="pt-0">
            <CardContent className="p-4 space-y-2">
              <label className="font-medium">Roteiro {i + 1}:</label>
              <Textarea
                value={roteiro}
                onChange={(e) => {
                  const novos = [...roteiros];
                  novos[i] = e.target.value;
                  setRoteiros(novos);
                }}
                className="w-full h-62 resize-none mt-2"
                placeholder="Digite seu texto aqui..."
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={() => setRoteiros([...roteiros, ""])}
      >
        + Adicionar Roteiro
      </Button>

      <Button onClick={() => setResultado(converterTodosRoteiros())}>
        Converter para SRT
      </Button>

      {resultado && (
        <>
          <div className="flex justify-between gap-2">
            <Button variant="default" onClick={handleDownload}>
              Download SRT
            </Button>
            <Button variant="destructive" onClick={handleLimpar}>
              Limpar
            </Button>
          </div>

          <Card>
            <CardContent className="p-4 whitespace-pre-wrap bg-muted">
              {resultado}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
