"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ChevronLeft, ChevronRight, Trash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CARACTERES_POR_BLOCO = 500;
const PALAVRAS_MAX_BLOCO = 100;
const DURACAO_BLOCO = 30;
const INTERVALO_ENTRE_BLOCOS = 10;
const INTERVALO_ENTRE_ROTEIROS = 600;

interface Roteiro {
  titulo: string;
  texto: string;
}

interface ResultadoConversao {
  srt: string;
  contador: number;
  tempoAcumulado: number;
}

export default function ConversorRoteiros() {
  const [roteiros, setRoteiros] = useState<Roteiro[]>([{ titulo: "", texto: "" }]);
  const [resultado, setResultado] = useState("");
  const sliderRef = useRef<HTMLDivElement>(null);
  const textareasRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const scrollLeft = () => {
    if (sliderRef.current) sliderRef.current.scrollBy({ left: -500, behavior: "smooth" });
  };

  const scrollRight = () => {
    if (sliderRef.current) sliderRef.current.scrollBy({ left: 500, behavior: "smooth" });
  };

  // Foca no último campo + scroll suave
  useEffect(() => {
    if (roteiros.length > 0) {
      const lastIndex = roteiros.length - 1;
      const lastTextarea = textareasRefs.current[lastIndex];

      if (sliderRef.current) {
        sliderRef.current.scrollTo({
          left: sliderRef.current.scrollWidth,
          behavior: "smooth",
        });
      }

      // pequeno timeout para focar após a animação
      setTimeout(() => {
        if (lastTextarea) lastTextarea.focus();
      }, 250);
    }
  }, [roteiros.length]);

  const handleRemove = (index: number) => {
    setRoteiros((prev) => prev.filter((_, i) => i !== index));
  };

  const pad = (n: number, size = 2) => n.toString().padStart(size, "0");

  const formatarTempo = (segundos: number) => {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = Math.floor(segundos % 60);
    return `${pad(h)}:${pad(m)}:${pad(s)},000`;
  };

  const formatarBlocoSRT = (i: number, inicio: number, texto: string) => {
    const fim = inicio + DURACAO_BLOCO;
    return `${i}\n${formatarTempo(inicio)} --> ${formatarTempo(fim)}\n${texto.trim()}\n\n`;
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

        const partes = splitEmChunksPorPalavras(frase, CARACTERES_POR_BLOCO, PALAVRAS_MAX_BLOCO);
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

    roteiros.forEach((r, idx) => {
      if (!r.texto.trim()) return;

      const res = converterParaSRT(r.texto.trim(), contador, tempoAcumulado);
      srtFinal += res.srt;
      contador = res.contador;
      tempoAcumulado = res.tempoAcumulado;

      if (idx < roteiros.length - 1) tempoAcumulado += INTERVALO_ENTRE_ROTEIROS;
    });

    return srtFinal.trim();
  };

  const handleDownloadZIP = async () => {
    const zip = new JSZip();
    roteiros.forEach((r, index) => {
      const numero = index + 1;
      const titulo = r.titulo.trim() || `Roteiro ${numero}`;
      const conteudo = `${titulo}\n\n${r.texto.trim()}`;
      zip.file(`${numero}.txt`, conteudo);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "roteiros.zip");
  };

  const handleDownloadSRT = () => {
    const blob = new Blob([resultado], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legendas.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLimpar = () => {
    setRoteiros([{ titulo: "", texto: "" }]);
    setResultado("");
  };

  const contarPalavras = (texto: string) =>
    texto.trim().length === 0 ? 0 : texto.trim().split(/\s+/).length;

  return (
    <div className="w-full p-6 flex flex-col gap-4">
      <h1 className="text-2xl font-bold mb-2">Conversor de Roteiros</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={scrollLeft}
          className="bg-background border p-2 rounded-full shadow hover:bg-accent transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          ref={sliderRef}
          className="
            grid grid-flow-col
            auto-cols-[minmax(300px,1fr)]
            lg:auto-cols-[minmax(450px,1fr)]
            overflow-x-auto
            gap-4
            scroll-smooth
            pb-4
            flex-1
          "
        >
          <AnimatePresence>
            {roteiros.map((r, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10, transition: { duration: 0.25 } }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border shadow-sm hover:shadow-md relative">
                  <button
                    onClick={() => handleRemove(i)}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-red-100 text-red-500"
                    title="Excluir roteiro"
                  >
                    <Trash className="w-4 h-4" />
                  </button>

                  <CardContent className="p-4 space-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="font-medium text-sm">Título {i + 1}:</label>
                      <Input
                        value={r.titulo}
                        onChange={(e) => {
                          const novos = [...roteiros];
                          novos[i].titulo = e.target.value;
                          setRoteiros(novos);
                        }}
                        placeholder="Digite o título..."
                        className="text-sm"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-medium text-sm">Roteiro {i + 1}:</label>
                      <Textarea
                        ref={(el) => {
                          textareasRefs.current[i] = el;
                        }}
                        value={r.texto}
                        onChange={(e) => {
                          const novos = [...roteiros];
                          novos[i].texto = e.target.value;
                          setRoteiros(novos);
                        }}
                        className="w-full h-28 resize-none text-sm"
                        placeholder="Digite seu roteiro..."
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        {contarPalavras(r.texto)} palavras — {r.texto.length} caracteres
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <button
          onClick={scrollRight}
          className="bg-background border p-2 rounded-full shadow hover:bg-accent transition"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <Button
        variant="outline"
        onClick={() => setRoteiros([...roteiros, { titulo: "", texto: "" }])}
      >
        + Adicionar Roteiro
      </Button>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="secondary" onClick={handleDownloadZIP}>
          📦 Converter todos em TXT (ZIP)
        </Button>
        <Button onClick={() => setResultado(converterTodosRoteiros())}>
          🎬 Converter para SRT
        </Button>
      </div>

      {resultado && (
        <>
          <div className="flex justify-between gap-2 mt-2">
            <Button variant="default" onClick={handleDownloadSRT}>
              Download SRT
            </Button>
            <Button variant="destructive" onClick={handleLimpar}>
              Limpar
            </Button>
          </div>

          <Card>
            <CardContent className="p-4 whitespace-pre-wrap bg-muted max-h-60 overflow-auto">
              {resultado}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
