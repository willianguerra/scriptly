"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function TranslatorFile() {
  const [fileText, setFileText] = useState("");
  const [translated, setTranslated] = useState("");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileText(event.target?.result as string);
    };
    reader.readAsText(file);
  }

  async function handleTranslate() {
    if (!fileText.trim()) return;
    setLoading(true);
    setProgress(0);
    setTranslated("");

    // Divisão feita no servidor, mas podemos simular progresso aqui
    const res = await fetch("/api/translate-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: fileText, targetLang: lang }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let result = "";
    let done = false;

    // Como não estamos usando streaming real da API LibreTranslate,
    // o progresso visual será controlado ao final com base no totalChunks retornado
    if (!reader) {
      const data = await res.json();
      setTranslated(data.translatedText);
      setTotalChunks(data.totalChunks);
      setProgress(100);
      setLoading(false);
      return;
    }

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      result += decoder.decode(value);
    }

    const parsed = JSON.parse(result);
    setTranslated(parsed.translatedText);
    setTotalChunks(parsed.totalChunks);
    setProgress(100);
    setLoading(false);
  }

  function handleDownload() {
    const blob = new Blob([translated], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roteiro_traduzido.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="max-w-3xl mx-auto mt-10 p-4 shadow-lg">
      <CardContent className="space-y-4">
        <h2 className="text-2xl font-bold text-center">📜 Tradutor de Roteiros Inteligente</h2>

        <input
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          className="border p-2 w-full"
        />

        <Textarea
          placeholder="Ou cole o texto aqui..."
          value={fileText}
          onChange={(e) => setFileText(e.target.value)}
          className="min-h-[200px]"
        />

        <div className="flex items-center justify-between gap-2">
          <Select onValueChange={setLang} defaultValue="en">
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Idioma de destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">Inglês</SelectItem>
              <SelectItem value="es">Espanhol</SelectItem>
              <SelectItem value="fr">Francês</SelectItem>
              <SelectItem value="de">Alemão</SelectItem>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="hr">Croata</SelectItem>
              <SelectItem value="pt">Português</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleTranslate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Traduzir
          </Button>
        </div>

        {loading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-center text-muted-foreground">
              Traduzindo... isso pode levar alguns segundos ⏳
            </p>
          </div>
        )}

        {translated && (
          <div className="space-y-2">
            <Button onClick={handleDownload} variant="secondary">
              📥 Baixar roteiro traduzido
            </Button>
            <Textarea
              readOnly
              value={translated}
              className="min-h-[200px] bg-gray-100"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
