/**
 * Modelo de domínio do Seu Birita Distribuidora.
 *
 * O negócio funciona em dois modos:
 *  - CONSIGNACAO: entrega mercadoria no evento, o cliente devolve o que não
 *    vendeu e paga só o saldo (o que foi consumido). É o fluxo da planilha.
 *  - VENDA_DIRETA: cliente compra e leva, não existe devolução.
 */

export type PedidoTipo = "CONSIGNACAO" | "VENDA_DIRETA";

export type PedidoStatus =
  | "RASCUNHO"
  | "ENTREGUE"
  | "ACERTO"
  | "FINALIZADO"
  | "CANCELADO";

export type FormaPagamento =
  | "DINHEIRO"
  | "PIX"
  | "CARTAO"
  | "BOLETO"
  | "TRANSFERENCIA";

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
}

export interface Produto {
  id: string;
  nome: string;
  categoria: string;
  /** Quantas unidades vêm em uma caixa. Corona = 24, Coca lata = 12, Suco = 6. */
  unPorCaixa: number;
  /** Preço de venda por unidade, em reais. */
  precoUn: number;
  /** Preço de custo por unidade, em reais. Usado pra margem. */
  precoCusto: number;
  estoqueUn: number;
  estoqueMinimo: number;
  ativo: boolean;
  /** Aparece na tabela de preços pública enviada aos clientes. */
  visivelCatalogo: boolean;
  imagemUrl?: string;
  imagemCenario?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo: "PF" | "PJ";
  documento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  obs?: string;
  ativo: boolean;
  criadoEm: string;
}

export interface Fornecedor {
  id: string;
  nome: string;
  documento?: string;
  telefone?: string;
  email?: string;
  obs?: string;
  ativo: boolean;
  criadoEm: string;
}

/** Uma remessa de entrega. A planilha tem "PEDIDO 01" e "PEDIDO 02". */
export interface Remessa {
  numero: number;
  cx: number;
  un: number;
}

export interface PedidoItem {
  produtoId: string;
  /** Snapshot: se o produto for renomeado, o pedido antigo não muda. */
  nome: string;
  unPorCaixa: number;
  /** Preço travado no momento do pedido. */
  precoUn: number;
  /** Preço de custo no momento do pedido (usado para calcular o lucro). */
  custoUn: number;
  entregas: Remessa[];
  devolucaoCx: number;
  devolucaoUn: number;
}

export interface Pedido {
  id: string;
  numero: number;
  clienteId: string;
  /** Snapshot do nome do cliente, pra listagem não precisar de join. */
  clienteNome: string;
  tipo: PedidoTipo;
  /** Nome do evento, ex: "Réveillon Estação Lounge". */
  titulo?: string;
  dataEvento: string;
  status: PedidoStatus;
  /** Dívida que o cliente já trazia de acertos anteriores. */
  pendenciaAnterior: number;
  desconto: number;
  obs?: string;
  itens: PedidoItem[];
  /** Totais desnormalizados pra listagem não ter que recalcular tudo. */
  valorPedido: number;
  valorFinal: number;
  valorPago: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Pagamento {
  id: string;
  pedidoId: string;
  clienteId: string;
  valor: number;
  forma: FormaPagamento;
  data: string;
  obs?: string;
  criadoEm: string;
}

export type EstoqueTipo = "ENTRADA" | "SAIDA" | "AJUSTE";
export type EstoqueOrigem = "COMPRA" | "PEDIDO" | "DEVOLUCAO" | "AJUSTE" | "PERDA";

export interface EstoqueMovimento {
  id: string;
  produtoId: string;
  produtoNome: string;
  tipo: EstoqueTipo;
  origem: EstoqueOrigem;
  /** Sempre em unidades, mesmo quando a entrada foi digitada em caixas. */
  quantidadeUn: number;
  custoUn?: number;
  fornecedorId?: string;
  /** Id do pedido ou da compra que gerou o movimento. */
  referenciaId?: string;
  data: string;
  obs?: string;
  criadoEm: string;
}

/* ---------------------------------------------------------------------------
   Pedidos feitos pelo cliente na página pública (/pedido).
   Ficam na coleção pedidosClientes — separados dos pedidos internos.
   --------------------------------------------------------------------------- */

export type PedidoClienteStatus =
  | "NOVO"
  | "EM_ANALISE"
  | "CONFIRMADO"
  | "CANCELADO";

export interface PedidoClienteItem {
  produtoId: string;
  nome: string;
  precoUn: number;
  cx: number;
  un: number;
  unPorCaixa: number;
  subtotal: number;
}

export interface PedidoCliente {
  id: string;
  numero: number;
  /** Dados obrigatórios preenchidos pelo cliente */
  nomeCliente: string;
  telefone: string;
  localEvento: string;
  /** Data do evento (ISO date string, opcional) */
  dataEvento?: string;
  obs?: string;
  itens: PedidoClienteItem[];
  valorTotal: number;
  status: PedidoClienteStatus;
  criadoEm: string;
  atualizadoEm: string;
}
