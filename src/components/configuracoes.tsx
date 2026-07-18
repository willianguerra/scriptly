"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings,
  KeyRound,
  Save,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PlugZap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { getToken, setToken, listarVozes } from "@/lib/darkvi";

type TesteEstado =
  | { status: "idle" }
  | { status: "testando" }
  | { status: "ok"; vozes: number }
  | { status: "erro"; mensagem: string };

export default function Configuracoes() {
  const [chave, setChave] = useState("");
  const [chaveSalva, setChaveSalva] = useState(false);
  const [salvoAgora, setSalvoAgora] = useState(false);
  const [teste, setTeste] = useState<TesteEstado>({ status: "idle" });

  // Carrega a chave já salva no navegador
  useEffect(() => {
    const saved = getToken();
    if (saved) {
      setChave(saved);
      setChaveSalva(true);
    }
  }, []);

  const handleSalvar = () => {
    setToken(chave);
    setChaveSalva(chave.trim().length > 0);
    setSalvoAgora(true);
    setTeste({ status: "idle" });
    setTimeout(() => setSalvoAgora(false), 2500);
  };

  const handleRemover = () => {
    setToken("");
    setChave("");
    setChaveSalva(false);
    setSalvoAgora(false);
    setTeste({ status: "idle" });
  };

  const handleTestar = async () => {
    // Garante que o teste use exatamente a chave exibida no campo.
    setToken(chave);
    setChaveSalva(chave.trim().length > 0);
    setTeste({ status: "testando" });
    try {
      const vozes = await listarVozes();
      setTeste({ status: "ok", vozes: vozes.length });
    } catch (e) {
      setTeste({
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Falha ao conectar.",
      });
    }
  };

  const usandoServidor = !chaveSalva;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Gerencie sua integração com a Darkvi para gerar áudios a partir dos seus roteiros."
      />

      <Card className="gap-0 overflow-hidden py-0">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-br from-primary/8 via-primary/4 to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <h2 className="text-base font-semibold">Chave da API Darkvi</h2>
              <p className="text-xs text-muted-foreground">
                Gere sua chave em darkvi.com/settings
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium"
            role="status"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                chaveSalva
                  ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20"
                  : "bg-amber-500 shadow-[0_0_0_3px] shadow-amber-500/20"
              )}
            />
            {chaveSalva ? "Chave salva neste navegador" : "Usando chave do servidor"}
          </div>
        </div>

        <CardContent className="space-y-5 p-5">
          <div className="grid gap-1.5">
            <Label htmlFor="chave-darkvi">Sua chave de API</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="chave-darkvi"
                type="password"
                value={chave}
                onChange={(e) => {
                  setChave(e.target.value);
                  setSalvoAgora(false);
                }}
                placeholder="Cole seu token da Darkvi..."
                autoComplete="off"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A chave fica salva apenas neste navegador e{" "}
              <span className="font-medium text-foreground">tem prioridade</span> sobre a
              chave configurada no servidor. Deixe em branco para usar a chave do servidor
              (variável <code className="rounded bg-muted px-1 py-0.5 text-[11px]">DARKVI_API_TOKEN</code>).
            </p>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2" onClick={handleSalvar} disabled={!chave.trim() || salvoAgora}>
              {salvoAgora ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {salvoAgora ? "Salvo!" : "Salvar chave"}
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={handleTestar}
              disabled={teste.status === "testando"}
            >
              {teste.status === "testando" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
              Testar conexão
            </Button>

            {chaveSalva && (
              <Button
                variant="ghost"
                className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleRemover}
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            )}
          </div>

          {/* Resultado do teste */}
          {teste.status === "ok" && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in-0 slide-in-from-top-1"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Conexão bem-sucedida! {teste.vozes} vozes disponíveis
                {usandoServidor ? " (usando a chave do servidor)." : "."}
              </span>
            </div>
          )}

          {teste.status === "erro" && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{teste.mensagem}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
