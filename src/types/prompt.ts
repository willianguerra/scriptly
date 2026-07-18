// Tipo compartilhado (cliente/servidor) de um prompt salvo da biblioteca.
export interface PromptSalvo {
  id: string;
  nome: string;
  texto: string;
  atualizadoEm: number;
}
