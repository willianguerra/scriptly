"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { baixarSRT, baixarZIP } from "@/lib/fileUtils";
import { converterParaSRT, INTERVALO_ENTRE_ROTEIROS } from "@/lib/srtConverter";
import type { Roteiro } from "@/types/roteiro";

const STORAGE_KEY = "roteiros-salvos";

export default function ConversorRoteiros() {
  const [roteiros, setRoteiros] = useState<Roteiro[]>([{ titulo: "", texto: "" }]);
  const [resultado, setResultado] = useState("");
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

  // ⬅️➡️ Funções de scroll no desktop
  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
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

      <div className="relative w-full">
        {/* ⬅️ Botão esquerdo - só aparece no desktop */}
        <button
          onClick={scrollLeft}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 bg-background border rounded-full p-2 shadow hover:bg-accent transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Slider */}
        <div
  ref={sliderRef}
  className="
    grid grid-flow-col
    auto-cols-[100%]           /* mobile: 1 card */
    sm:auto-cols-[100%]       
    lg:auto-cols-[minmax(50%,1fr)]  /* desktop: 2 cards */
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
        {/* ... card ... */}
      </motion.div>
    ))}
  </AnimatePresence>
</div>


        {/* ➡️ Botão direito - só aparece no desktop */}
        <button
          onClick={scrollRight}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 bg-background border rounded-full p-2 shadow hover:bg-accent transition"
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

      <div className="flex flex-col sm:flex-row justify-between gap-2 mt-2">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button variant="secondary" onClick={() => baixarZIP(roteiros)}>
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
