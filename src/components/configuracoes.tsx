"use client";

import { useCallback, useEffect, useState } from "react";
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
import { listarVozes } from "@/lib/darkvi";
import {
  CREDENTIAL_PROVIDERS,
  type CredentialProvider,
} from "@/lib/credentials/providers";

type StatusCredencial = {
  provider: CredentialProvider;
  hasUserKey: boolean;
  masked: string | null;
  serverFallback: boolean;
};

type ProviderConfig = {
  provider: CredentialProvider;
  titulo: string;
  descricao: string;
  placeholder: string;
  testavel?: boolean;
};

const PROVIDERS_CONFIG: ProviderConfig[] = [
  {
    provider: "darkvi",
    titulo: "Chave da API Darkvi",
    descricao: "Gere sua chave em darkvi.com/settings",
    placeholder: "Cole seu token da Darkvi...",
    testavel: true,
  },
  {
    provider: "gemini",
    titulo: "Google Gemini",
    descricao: "Usada nos vídeos para gerar roteiros e prompts.",
    placeholder: "Cole sua chave do Gemini...",
  },
  {
    provider: "openai",
    titulo: "OpenAI (GPT)",
    descricao: "Usada nos vídeos para gerar roteiros e prompts.",
    placeholder: "Cole sua chave da OpenAI...",
  },
];

export default function Configuracoes() {
  const [status, setStatus] = useState<Record<CredentialProvider, StatusCredencial> | null>(
    null
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/credentials", { cache: "no-store" });
      if (!res.ok) throw new Error("falha");
      const lista = (await res.json()) as StatusCredencial[];
      const mapa = {} as Record<CredentialProvider, StatusCredencial>;
      for (const item of lista) mapa[item.provider] = item;
      // Garante uma entrada para cada provider conhecido.
      for (const p of CREDENTIAL_PROVIDERS) {
        if (!mapa[p]) {
          mapa[p] = { provider: p, hasUserKey: false, masked: null, serverFallback: false };
        }
      }
      setStatus(mapa);
    } catch {
      setErro("Não foi possível carregar suas chaves.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Suas chaves de API ficam guardadas com segurança na sua conta — cada usuário usa as próprias."
      />

      {erro ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {erro}
        </p>
      ) : null}

      {carregando || !status ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        PROVIDERS_CONFIG.map((cfg) => (
          <CredentialCard
            key={cfg.provider}
            config={cfg}
            status={status[cfg.provider]}
            onChanged={carregar}
          />
        ))
      )}
    </div>
  );
}

type TesteEstado =
  | { status: "idle" }
  | { status: "testando" }
  | { status: "ok"; vozes: number }
  | { status: "erro"; mensagem: string };

function CredentialCard({
  config,
  status,
  onChanged,
}: {
  config: ProviderConfig;
  status: StatusCredencial;
  onChanged: () => Promise<void> | void;
}) {
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvoAgora, setSalvoAgora] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [teste, setTeste] = useState<TesteEstado>({ status: "idle" });

  const { hasUserKey, masked, serverFallback } = status;

  async function salvar(chave: string): Promise<boolean> {
    setErro(null);
    const res = await fetch("/api/credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: config.provider, key: chave }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setErro(body?.error ?? "Não foi possível salvar a chave.");
      return false;
    }
    return true;
  }

  async function handleSalvar() {
    const chave = valor.trim();
    if (!chave) return;
    setSalvando(true);
    setTeste({ status: "idle" });
    try {
      if (await salvar(chave)) {
        setValor("");
        setSalvoAgora(true);
        setTimeout(() => setSalvoAgora(false), 2500);
        await onChanged();
      }
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover() {
    setSalvando(true);
    setErro(null);
    setTeste({ status: "idle" });
    try {
      const res = await fetch("/api/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: config.provider }),
      });
      if (!res.ok) {
        setErro("Não foi possível remover a chave.");
        return;
      }
      setValor("");
      await onChanged();
    } finally {
      setSalvando(false);
    }
  }

  async function handleTestar() {
    setTeste({ status: "testando" });
    setErro(null);
    try {
      // Se o usuário digitou uma chave nova, salva antes de testar.
      const chave = valor.trim();
      if (chave && !(await salvar(chave))) {
        setTeste({ status: "idle" });
        return;
      }
      if (chave) {
        setValor("");
        await onChanged();
      }
      const vozes = await listarVozes();
      setTeste({ status: "ok", vozes: vozes.length });
    } catch (e) {
      setTeste({
        status: "erro",
        mensagem: e instanceof Error ? e.message : "Falha ao conectar.",
      });
    }
  }

  const temChave = hasUserKey || serverFallback;
  const rotuloStatus = hasUserKey
    ? "Sua chave está salva"
    : serverFallback
    ? "Usando chave do servidor"
    : "Nenhuma chave configurada";

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-br from-primary/8 via-primary/4 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <h2 className="text-base font-semibold">{config.titulo}</h2>
            <p className="text-xs text-muted-foreground">{config.descricao}</p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium"
          role="status"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              temChave
                ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20"
                : "bg-amber-500 shadow-[0_0_0_3px] shadow-amber-500/20"
            )}
          />
          {rotuloStatus}
        </div>
      </div>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-1.5">
          <Label htmlFor={`chave-${config.provider}`}>Sua chave de API</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`chave-${config.provider}`}
              type="password"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setSalvoAgora(false);
              }}
              placeholder={hasUserKey ? `Salva: ${masked ?? "••••"} — digite para trocar` : config.placeholder}
              autoComplete="off"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A chave fica guardada criptografada na sua conta. Só você a utiliza.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="gap-2" onClick={handleSalvar} disabled={!valor.trim() || salvando || salvoAgora}>
            {salvoAgora ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {salvoAgora ? "Salvo!" : "Salvar chave"}
          </Button>

          {config.testavel ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleTestar}
              disabled={teste.status === "testando" || salvando}
            >
              {teste.status === "testando" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="h-4 w-4" />
              )}
              Testar conexão
            </Button>
          ) : null}

          {hasUserKey ? (
            <Button
              variant="ghost"
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleRemover}
              disabled={salvando}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          ) : null}
        </div>

        {erro ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{erro}</span>
          </div>
        ) : null}

        {teste.status === "ok" ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Conexão bem-sucedida! {teste.vozes} vozes disponíveis.</span>
          </div>
        ) : null}

        {teste.status === "erro" ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{teste.mensagem}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
