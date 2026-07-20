// Tipo compartilhado (cliente/servidor) de um canal gerenciado.
export interface CanalSalvo {
  id: string;
  nome: string;
  handle: string | null;
  descricao: string | null;
  nicho: string | null;
  promptSistemaPadrao: string | null;
  criadoEm: number;
  atualizadoEm: number;
}
