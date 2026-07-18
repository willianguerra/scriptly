// Biblioteca de prompts de roteiro. Cada prompt é nomeado (ex.: por canal ou
// estilo) e guardado apenas neste navegador (localStorage), no mesmo espírito
// da chave da Darkvi. O núcleo (operações sobre arrays) é puro e testável; as
// funções que tocam o localStorage são invólucros finos em volta dele.

export interface PromptSalvo {
  id: string;
  nome: string;
  texto: string;
  atualizadoEm: number;
}

const STORAGE_KEY = "roteiro-prompts";

/** Gera um id único (usa crypto.randomUUID quando disponível). */
export function gerarId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- Núcleo puro (não toca em localStorage) ---------------------------------

/** Adiciona um prompt à lista. Lança se o nome estiver vazio. */
export function adicionarPrompt(
  lista: PromptSalvo[],
  dados: { nome: string; texto: string },
  agora: number = Date.now()
): PromptSalvo[] {
  const nome = dados.nome.trim();
  if (!nome) throw new Error("O prompt precisa de um nome.");
  const novo: PromptSalvo = {
    id: gerarId(),
    nome,
    texto: dados.texto.trim(),
    atualizadoEm: agora,
  };
  return [...lista, novo];
}

/** Atualiza nome/texto de um prompt existente pelo id. */
export function atualizarPrompt(
  lista: PromptSalvo[],
  id: string,
  campos: { nome?: string; texto?: string },
  agora: number = Date.now()
): PromptSalvo[] {
  return lista.map((p) => {
    if (p.id !== id) return p;
    const nome = campos.nome !== undefined ? campos.nome.trim() : p.nome;
    if (!nome) throw new Error("O prompt precisa de um nome.");
    return {
      ...p,
      nome,
      texto: campos.texto !== undefined ? campos.texto.trim() : p.texto,
      atualizadoEm: agora,
    };
  });
}

/** Remove um prompt pelo id. */
export function removerPrompt(lista: PromptSalvo[], id: string): PromptSalvo[] {
  return lista.filter((p) => p.id !== id);
}

/** Valida e normaliza dados vindos do JSON do localStorage. */
export function normalizarLista(dado: unknown): PromptSalvo[] {
  if (!Array.isArray(dado)) return [];
  return dado
    .filter(
      (item): item is PromptSalvo =>
        !!item &&
        typeof item.id === "string" &&
        typeof item.nome === "string" &&
        typeof item.texto === "string"
    )
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      texto: item.texto,
      atualizadoEm:
        typeof item.atualizadoEm === "number" ? item.atualizadoEm : 0,
    }));
}

// --- Invólucros de localStorage ---------------------------------------------

export function carregarPrompts(): PromptSalvo[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = localStorage.getItem(STORAGE_KEY);
    if (!bruto) return [];
    return normalizarLista(JSON.parse(bruto));
  } catch {
    return [];
  }
}

export function salvarPrompts(lista: PromptSalvo[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}
