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
  /** Preço de venda por unidade, em reais — a "Tabela 1", usada por padrão. */
  precoUn: number;
  /** Preço alternativo (Tabela 2) — opcional, pra escolher ao montar o pedido. */
  precoTabela2?: number;
  /** Preço alternativo (Tabela 3) — opcional, pra escolher ao montar o pedido. */
  precoTabela3?: number;
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
  /**
   * Sobra de um evento anterior que já estava no cliente (importada pelo
   * "Importar devolução"). Conta como entregue pro consumo e pro valor, mas
   * não sai do galpão na carga — por isso fica fora das entregas e do romaneio.
   */
  sobraCx?: number;
  sobraUn?: number;
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
  /**
   * Pedido de onde este puxou as devoluções ao ser criado. Fica no pedido
   * novo (e não uma marca no antigo) pra que excluir o novo libere as
   * sobras de novo, sem precisar regravar o pedido antigo.
   */
  sobrasDePedidoId?: string;
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
  /** Só em compra: pago na hora ou a prazo (gera conta a pagar). */
  pagamento?: "AVISTA" | "PRAZO";
  /** Conta a pagar criada por uma compra a prazo (lançamentos antigos). */
  contaPagarId?: string;
  /** Contas a pagar (uma por parcela) criadas por uma compra a prazo. */
  contaPagarIds?: string[];
  /** Id do pedido ou da compra que gerou o movimento. */
  referenciaId?: string;
  data: string;
  obs?: string;
  criadoEm: string;
}

export type PapelUsuario = "admin" | "funcionario";

/** O que um funcionário pode ver/mexer — cada chave liga/desliga uma parte do sistema. */
export interface Permissoes {
  pedidos: boolean;
  online: boolean;
  agenda: boolean;
  produtos: boolean;
  clientes: boolean;
  financeiro: boolean;
  estoque: boolean;
  fornecedores: boolean;
  /** Ver preço de custo, margem e lucro — mesmo em telas que ele já acessa. */
  verCusto: boolean;
  /** Excluir cadastros (produto, cliente, fornecedor, pedido). */
  excluir: boolean;
}

export const PERMISSOES_PADRAO_FUNCIONARIO: Permissoes = {
  pedidos: true,
  online: true,
  agenda: true,
  produtos: true,
  clientes: true,
  financeiro: false,
  estoque: true,
  fornecedores: false,
  verCusto: false,
  excluir: false,
};

/** Perfil de acesso — um documento por uid do Firebase Auth. */
export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: PapelUsuario;
  permissoes: Permissoes;
  /** false = acesso revogado (login continua existindo, mas não vê nada). */
  ativo: boolean;
  criadoEm: string;
}

/** Uma despesa/conta a pagar — fornecedor, aluguel, combustível, etc. */
export interface ContaPagar {
  id: string;
  descricao: string;
  fornecedorId?: string;
  /** Snapshot: se o fornecedor for renomeado, a conta antiga não muda. */
  fornecedorNome?: string;
  valor: number;
  vencimento: string;
  pago: boolean;
  pagoEm?: string;
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
