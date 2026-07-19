"use client";

import * as React from "react";
import { ShieldCheck, LoaderCircle, Check, X, Ban } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
type Role = "ADMIN" | "USER";
type Action = "approve" | "reject" | "suspend";

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  role: Role;
  status: Status;
  approvedAt: number | null;
  createdAt: number;
};

const STATUS_META: Record<
  Status,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Pendente", variant: "outline" },
  APPROVED: { label: "Aprovado", variant: "default" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
  SUSPENDED: { label: "Suspenso", variant: "destructive" },
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AdminUsers() {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) throw new Error("falha");
      setUsers((await res.json()) as AdminUser[]);
    } catch {
      setError("Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function act(userId: string, action: Action) {
    setBusyId(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const body = (await res.json().catch(() => null)) as
        | { status?: Status; error?: string }
        | null;
      if (!res.ok) {
        setError(body?.error ?? "Não foi possível concluir a ação.");
        return;
      }
      setUsers((current) =>
        current.map((u) =>
          u.id === userId && body?.status ? { ...u, status: body.status } : u
        )
      );
    } catch {
      setError("Não foi possível concluir a ação.");
    } finally {
      setBusyId(null);
    }
  }

  const pendentes = users.filter((u) => u.status === "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Administração"
        description="Aprove ou bloqueie o acesso à plataforma. Cada usuário vê apenas os próprios dados."
      />

      {pendentes.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {pendentes.length} cadastro(s) aguardando aprovação.
        </p>
      ) : null}

      {error ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const meta = STATUS_META[user.status];
            const isBusy = busyId === user.id;
            const isAdmin = user.role === "ADMIN";
            return (
              <Card key={user.id}>
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{user.username}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user.email ? `${user.email} · ` : ""}
                      cadastro em {formatDate(user.createdAt)}
                    </p>
                  </div>

                  {isAdmin ? (
                    <span className="text-xs text-muted-foreground">
                      Administrador — sem ações
                    </span>
                  ) : (
                    <div className="flex shrink-0 gap-2">
                      {user.status !== "APPROVED" ? (
                        <Button
                          size="sm"
                          onClick={() => act(user.id, "approve")}
                          disabled={isBusy}
                        >
                          <Check className="h-4 w-4" /> Aprovar
                        </Button>
                      ) : null}
                      {user.status === "PENDING" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => act(user.id, "reject")}
                          disabled={isBusy}
                        >
                          <X className="h-4 w-4" /> Rejeitar
                        </Button>
                      ) : null}
                      {user.status === "APPROVED" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => act(user.id, "suspend")}
                          disabled={isBusy}
                        >
                          <Ban className="h-4 w-4" /> Suspender
                        </Button>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
