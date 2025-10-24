"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "react-toastify";

interface PromptItem {
  id: string;
  label: string;
  text: string;
}

type Platform = {
  key: string;
  name: string;
  // A URL base; o userscript vai ler o hash #autofill=...
  baseUrl: string; // sem {PROMPT}; usaremos hash
  // dica visual para o usuário (opcional)
  hint?: string;
};

const PLATFORMS: Platform[] = [
  { key: "whisk",     name: "🪄 Whisk (Google)",        baseUrl: "https://labs.google/whisk" },
  { key: "imagefx",   name: "📸 ImageFX (Google)",      baseUrl: "https://labs.google/fx/tools/image-fx" },
  { key: "bing",      name: "🌐 Bing Image Creator",    baseUrl: "https://www.bing.com/images/create" },
  { key: "leonardo",  name: "✨ Leonardo AI",            baseUrl: "https://app.leonardo.ai/" },
  { key: "mage",      name: "🧠 Mage.space",             baseUrl: "https://mage.space/" },
];

function encodeHashPayload(prompt: string) {
  // encodeURIComponent, mas preserva quebras de linha de forma amigável
  return encodeURIComponent(prompt).replace(/%0A/g, "\\n");
}

export function PromptLinkGenerator() {
  const [rawText, setRawText] = useState("");
  const [items, setItems] = useState<PromptItem[]>([]);

  const parse = () => {
    // Formato: [1.1] texto...
    const regex = /^\[(.*?)\]\s*(.+)$/gm;
    const acc: PromptItem[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(rawText)) !== null) {
      acc.push({
        id: crypto.randomUUID(),
        label: m[1].trim(),
        text: m[2].trim(),
      });
    }
    if (acc.length === 0 && rawText.trim()) {
      // se não veio com [1.1], vira um único prompt
      acc.push({ id: crypto.randomUUID(), label: "1", text: rawText.trim() });
    }
    setItems(acc);
    if (acc.length === 0) toast("Nenhum prompt detectado. Verifique o formato.");
  };

  const clearAll = () => {
    setRawText("");
    setItems([]);
  };

  const openWithPlatform = async (platform: Platform, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Prompt copiado para a área de transferência.");
    } catch {
      // Sem permissão de clipboard? seguimos sem travar.
    }
    const url = `${platform.baseUrl}#autofill=${encodeHashPayload(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleEdit = (id: string, next: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, text: next } : p)));
  };

  return (
    <div className="w-full p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎨 Painel de Prompts → Autofill nas IAs</h1>
        <div className="hidden md:flex gap-2">
          <Button variant="secondary" onClick={() => {
            navigator.clipboard.writeText(
`// Instale o userscript (Tampermonkey) para autofill funcionar:
// Abra o link do repositório/arquivo .user.js que você criar e clique em "Install".
// O script lê #autofill=... e preenche o campo no site alvo.
`
            );
            toast("Instruções copiadas (lembrete de instalar o userscript).");
          }}>
            Copiar instruções de instalação
          </Button>
        </div>
      </div>

      <Textarea
        placeholder="Cole aqui os prompts no formato:
[1.1] black and white cinematic scene...
[1.2] monochrome image of a cluttered barn...
..."
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        className="min-h-[220px]"
      />

      <div className="flex gap-2 flex-wrap">
        <Button onClick={parse}>📑 Processar Prompts</Button>
        <Button variant="destructive" onClick={clearAll}>🧹 Limpar</Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto">
          {items.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Prompt {p.label}</span>
                  <div className="text-xs text-muted-foreground">
                    Dica: o prompt também é copiado para o clipboard ao abrir.
                  </div>
                </div>

                <Textarea
                  value={p.text}
                  onChange={(e) => handleEdit(p.id, e.target.value)}
                  className="w-full h-40 resize-none"
                />

                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((plat) => (
                    <Button
                      key={plat.key}
                      variant="outline"
                      size="sm"
                      onClick={() => openWithPlatform(plat, p.text)}
                    >
                      {plat.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
