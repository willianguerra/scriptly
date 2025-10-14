"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AnalisarTexto() {
  const [texto, setTexto] = useState("");

  const contarCaracteres = texto.length;
  const contarPalavras = texto.trim() === "" ? 0 : texto.trim().split(/\s+/).length;
  const contarLinhas = texto.split(/\r\n|\r|\n/).length;

  return (
    <div className="w-full p-6 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Analisador de Texto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Digite ou cole seu texto aqui..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-[200px]"
          />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded bg-muted">
              <p className="text-lg font-bold">{contarCaracteres}</p>
              <p className="text-sm text-muted-foreground">Caracteres</p>
            </div>
            <div className="p-4 rounded bg-muted">
              <p className="text-lg font-bold">{contarPalavras}</p>
              <p className="text-sm text-muted-foreground">Palavras</p>
            </div>
            <div className="p-4 rounded bg-muted">
              <p className="text-lg font-bold">{contarLinhas}</p>
              <p className="text-sm text-muted-foreground">Linhas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
