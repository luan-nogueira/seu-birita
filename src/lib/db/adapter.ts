export interface ComId {
  id: string;
}

/**
 * Contrato mínimo que as duas fontes de dados (navegador e Firestore)
 * precisam cumprir. As telas não sabem qual das duas está ativa.
 */
export interface ColecaoAdapter<T extends ComId> {
  /** Escuta a coleção em tempo real. Devolve a função que cancela a escuta. */
  observar(callback: (itens: T[]) => void): () => void;
  salvar(item: T): Promise<void>;
  remover(id: string): Promise<void>;
}

export const COLECOES = [
  "produtos",
  "clientes",
  "fornecedores",
  "pedidos",
  "pagamentos",
  "movimentos",
  "pedidosClientes",
  "contasPagar",
] as const;

export type NomeColecao = (typeof COLECOES)[number];

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
