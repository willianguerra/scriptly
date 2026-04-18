export type DistribuicaoPrompts = {
  promptsOriginais: string[];
  lista1: string[];
  lista2: string[];
};

export function extrairPrompts(texto: string): string[] {
  const normalizado = texto.replace(/\r\n/g, "\n").trim();

  if (!normalizado) return [];

  const partes = normalizado
    .split(/(?=(?:\*\*)?PROMPT\s+\d+)/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => /^(?:\*\*)?PROMPT\s+\d+/.test(item));

  return partes.map((item) =>
    item
      .replace(/\n---\s*$/g, "")
      .replace(/^\s+|\s+$/g, ""),
  );
}

export function distribuirPrompts(
  prompts: string[],
  quantidadeLista1: number,
  quantidadeLista2: number,
): DistribuicaoPrompts {
  const lista1: string[] = [];
  const lista2: string[] = [];

  const tamanhoBloco = quantidadeLista1 + quantidadeLista2;

  if (tamanhoBloco <= 0) {
    return {
      promptsOriginais: prompts,
      lista1: [],
      lista2: [],
    };
  }

  for (let i = 0; i < prompts.length; i += tamanhoBloco) {
    const grupo = prompts.slice(i, i + tamanhoBloco);

    lista1.push(...grupo.slice(0, quantidadeLista1));
    lista2.push(...grupo.slice(quantidadeLista1, quantidadeLista1 + quantidadeLista2));
  }

  return {
    promptsOriginais: prompts,
    lista1,
    lista2,
  };
}

export function formatarSaida(lista: string[]) {
  return lista.join("\n\n");
}
