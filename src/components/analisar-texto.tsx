"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Scissors } from "lucide-react";

export function AnalisarTexto() {
  const [texto, setTexto] = useState("");

  const contarCaracteres = texto.length;
  const contarPalavras = texto.trim() === "" ? 0 : texto.trim().split(/\s+/).length;
  const contarLinhas = texto.split(/\r\n|\r|\n/).length;

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        icon={Scissors}
        title="Analisador de Texto"
        description="Visualize rapidamente caracteres, palavras e linhas do seu texto."
      />

      <Card>
        <CardContent className="space-y-4 p-4">
          <Textarea
            placeholder="Digite ou cole seu texto aqui..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-[200px]"
          />

          <div className="grid grid-cols-3 gap-3 text-center">
            <Metric value={contarCaracteres} label="Caracteres" />
            <Metric value={contarPalavras} label="Palavras" />
            <Metric value={contarLinhas} label="Linhas" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
