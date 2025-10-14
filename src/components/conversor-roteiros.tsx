"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { baixarSRT, baixarZIP } from "@/lib/fileUtils";
import { converterParaSRT, INTERVALO_ENTRE_ROTEIROS } from "@/lib/srtConverter";
import type { Roteiro } from "@/types/roteiro";

const STORAGE_KEY = "roteiros-salvos";

export default function ConversorRoteiros() {
  const [roteiros, setRoteiros] = useState<Roteiro[]>([{ titulo: "", texto: "" }]);
  const [resultado, setResultado] = useState("");
  const [salvarSomenteTitulo, setSalvarSomenteTitulo] = useState(false); // 👈 novo estado
  const sliderRef = useRef<HTMLDivElement>(null);
  const textareasRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // 🧠 Carregar roteiros do localStorage
  useEffect(() => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const parsed: Roteiro[] = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRoteiros(parsed);
        }
      } catch (error) {
        console.error("Erro ao carregar roteiros salvos:", error);
      }
    }
  }, []);

  // 💾 Salvar roteiros no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roteiros));
  }, [roteiros]);

  // 📌 Scroll até o último card ao adicionar novo roteiro
  useEffect(() => {
    const last = textareasRefs.current[roteiros.length - 1];
    if (sliderRef.current) {
      sliderRef.current.scrollTo({ left: sliderRef.current.scrollWidth, behavior: "smooth" });
    }
    setTimeout(() => last?.focus(), 250);
  }, [roteiros.length]);

  const scrollLeft = () => {
    sliderRef.current?.scrollBy({ left: -400, behavior: "smooth" });
  };

  const scrollRight = () => {
    sliderRef.current?.scrollBy({ left: 400, behavior: "smooth" });
  };

  const handleRemove = (index: number) => {
    if (roteiros.length === 1) {
      setRoteiros([{ titulo: "", texto: "" }]);
      return;
    }
    setRoteiros((prev) => prev.filter((_, i) => i !== index));
  };

  const converterTodos = () => {
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

    setResultado(srtFinal.trim());
  };

  const handleClearSRT = () => setResultado("");

  const handleResetRoteiros = () => {
    setRoteiros([{ titulo: "", texto: "" }]);
    setResultado("");
    localStorage.removeItem(STORAGE_KEY);
  };

  const contarPalavras = (texto: string) =>
    texto.trim() ? texto.trim().split(/\s+/).length : 0;

  return (
    <div className="w-full p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold mb-2 text-center">Conversor de Roteiros</h1>

      {/* === Slider === */}
      <div className="w-full">
        <div
          ref={sliderRef}
          className="
            grid grid-flow-col
            auto-cols-[100%]
            sm:auto-cols-[100%]
            lg:auto-cols-[minmax(50%,1fr)]
            overflow-x-auto
            gap-4
            scroll-smooth
            snap-x snap-mandatory
            px-4 pb-4
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
                className="snap-center"
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

        {/* === Botões abaixo do slider === */}
        <div className="hidden md:flex justify-center gap-4 mt-2">
          <button
            onClick={scrollLeft}
            className="bg-background border rounded-full p-2 shadow hover:bg-accent transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollRight}
            className="bg-background border rounded-full p-2 shadow hover:bg-accent transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* === Checkbox salvar apenas título === */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="salvarTitulo"
          checked={salvarSomenteTitulo}
          onCheckedChange={(checked: any) => setSalvarSomenteTitulo(!!checked)}
        />
        <label htmlFor="salvarTitulo" className="text-sm select-none cursor-pointer">
          Salvar apenas título no TXT
        </label>
      </div>

      {/* === Botões de ações === */}
      <Button
        variant="outline"
        onClick={() => setRoteiros([...roteiros, { titulo: "", texto: "" }])}
      >
        + Adicionar Roteiro
      </Button>

      <div className="flex flex-col sm:flex-row justify-between gap-2 mt-2">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button
            variant="secondary"
            onClick={() => baixarZIP(roteiros, salvarSomenteTitulo)} // 👈 flag passada
          >
            📦 Converter todos em TXT (ZIP)
          </Button>
          <Button onClick={converterTodos}>
            🎬 Converter para SRT
          </Button>
        </div>
        <Button variant="destructive" onClick={handleResetRoteiros}>
          🔁 Resetar Roteiros
        </Button>
      </div>

      {resultado && (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-2 mt-2">
            <Button variant="default" onClick={() => baixarSRT(resultado)}>
              Download SRT
            </Button>
            <Button variant="outline" onClick={handleClearSRT}>
              🧼 Limpar SRT
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
