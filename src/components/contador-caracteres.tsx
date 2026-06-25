"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Type, Eraser, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/page-header";

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function ContadorCaracteres() {
  const [text, setText] = React.useState("");
  const [keywords, setKeywords] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const totalChars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const words = countWords(text);
  const lines = text.trim() ? text.split(/\r?\n/).length : 0;
  const phrases = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean).length;
  const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).filter(Boolean).length : 0;
  const uniqueWords = new Set((text.toLowerCase().match(/[a-zA-Z0-9]+/g) ?? []).filter(Boolean)).size;
  const numbers = (text.match(/[0-9]/g) ?? []).length;
  const letters = (text.match(/[a-zA-Z]/g) ?? []).length;
  const spaces = (text.match(/\s/g) ?? []).length;
  const readingMinutes = Math.max(1, Math.ceil(words / 200));
  const averageWordsPerPhrase = phrases > 0 ? (words / phrases).toFixed(1) : "0";

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function resetText() {
    setText("");
  }

  return (
    <section className="space-y-5">
      <PageHeader
        icon={Type}
        title="Contador de Caracteres e Palavras"
        description="Ferramenta completa para analise de texto, SEO e redes sociais."
      />

      <div className="grid gap-3 md:grid-cols-5">
        <MetricCard title="Caracteres" value={String(totalChars)} />
        <MetricCard title="Sem espacos" value={String(charsNoSpaces)} />
        <MetricCard title="Palavras" value={String(words)} />
        <MetricCard title="Frases" value={String(phrases)} />
        <MetricCard title="Paragrafos" value={String(paragraphs)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="space-y-4 p-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite ou cole seu texto aqui para comecar a contar..."
              className="min-h-[260px]"
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCopy} disabled={!text} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar Texto"}
              </Button>
              <Button
                onClick={() => setText((prev) => prev.toLowerCase())}
                disabled={!text}
                variant="outline"
              >
                minusculas
              </Button>
              <Button
                onClick={() => setText((prev) => prev.replace(/\b\w/g, (char) => char.toUpperCase()))}
                disabled={!text}
                variant="outline"
              >
                Capitalizar
              </Button>
              <Button
                onClick={() => setText((prev) => prev.toUpperCase())}
                disabled={!text}
                variant="outline"
              >
                MAIUSCULAS
              </Button>
              <Button onClick={resetText} disabled={!text} variant="destructive" className="gap-2">
                <Eraser className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Limites de Redes Sociais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SocialLimit label="Twitter/X" max={280} value={totalChars} />
              <SocialLimit label="Facebook" max={63206} value={totalChars} />
              <SocialLimit label="Instagram" max={2200} value={totalChars} />
              <SocialLimit label="LinkedIn" max={3000} value={totalChars} />
              <SocialLimit label="SMS" max={160} value={totalChars} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Densidade de Palavras-chave</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Digite palavras-chave separadas por virgula"
              />
              <KeywordDensity text={text} keywords={keywords} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatisticas Detalhadas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <StatLine label="Caracteres totais (com espacos)" value={String(totalChars)} />
          <StatLine label="Caracteres (sem espacos)" value={String(charsNoSpaces)} />
          <StatLine label="Palavras unicas" value={String(uniqueWords)} />
          <StatLine label="Media de palavras por frase" value={String(averageWordsPerPhrase)} />
          <StatLine label="Espacos" value={String(spaces)} />
          <StatLine label="Numeros" value={String(numbers)} />
          <StatLine label="Letras" value={String(letters)} />
          <StatLine label="Tempo de leitura estimado" value={`${readingMinutes} min`} />
          <StatLine label="Linhas" value={String(lines)} />
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

function SocialLimit({ label, max, value }: { label: string; max: number; value: number }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value}/{max.toLocaleString("pt-BR")}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function KeywordDensity({ text, keywords }: { text: string; keywords: string }) {
  const wordCount = countWords(text);
  const list = keywords
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!list.length || !text.trim()) {
    return <p className="text-sm text-muted-foreground">Adicione palavras-chave para ver a densidade.</p>;
  }

  const normalizedText = text.toLowerCase();

  return (
    <div className="space-y-2">
      {list.map((keyword) => {
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const count = (normalizedText.match(new RegExp(`\\b${escaped}\\b`, "g")) ?? []).length;
        const density = wordCount > 0 ? ((count / wordCount) * 100).toFixed(2) : "0.00";

        return (
          <div key={keyword} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{keyword}</span>
            <span className="text-primary">
              {count}x ({density}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
