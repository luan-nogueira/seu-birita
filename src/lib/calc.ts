import type { Pedido, PedidoItem, PedidoTipo, Produto } from "./types";

/** Preço do produto na tabela escolhida — cai pra Tabela 1 se a 2/3 não existir. */
export function precoDaTabela(produto: Produto, tabela: 1 | 2 | 3): number {
  if (tabela === 2 && produto.precoTabela2) return produto.precoTabela2;
  if (tabela === 3 && produto.precoTabela3) return produto.precoTabela3;
  return produto.precoUn;
}

/** Lê "?tabela=2" da URL — só aceita 2 ou 3, qualquer outra coisa é Tabela 1. */
export function tabelaDaUrl(valor: string | null): 1 | 2 | 3 {
  if (valor === "2") return 2;
  if (valor === "3") return 3;
  return 1;
}

/** Converte caixas + unidades avulsas em unidades totais. */
export function paraUnidades(cx: number, un: number, unPorCaixa: number): number {
  return cx * unPorCaixa + un;
}

/** Quebra um total de unidades de volta em caixas + resto, pra exibição. */
export function paraCaixas(totalUn: number, unPorCaixa: number) {
  if (unPorCaixa <= 1) return { cx: 0, un: totalUn };
  return {
    cx: Math.floor(totalUn / unPorCaixa),
    un: totalUn % unPorCaixa,
  };
}

export function entregueUn(item: PedidoItem): number {
  return item.entregas.reduce(
    (soma, r) => soma + paraUnidades(r.cx, r.un, item.unPorCaixa),
    0,
  );
}

export function devolvidoUn(item: PedidoItem, tipo: PedidoTipo): number {
  // Venda direta não tem devolução: o cliente levou e pronto.
  if (tipo === "VENDA_DIRETA") return 0;
  return paraUnidades(item.devolucaoCx, item.devolucaoUn, item.unPorCaixa);
}

/** O que o cliente realmente consumiu — é isso que ele paga. */
export function saldoUn(item: PedidoItem, tipo: PedidoTipo): number {
  return entregueUn(item) - devolvidoUn(item, tipo);
}

/** Valor da mercadoria que saiu do galpão (referência, não é o que se cobra). */
export function valorPedidoItem(item: PedidoItem): number {
  return entregueUn(item) * item.precoUn;
}

/** Valor que o cliente deve por este item. */
export function valorFinalItem(item: PedidoItem, tipo: PedidoTipo): number {
  return saldoUn(item, tipo) * item.precoUn;
}

export interface TotaisPedido {
  /** Total da mercadoria entregue. */
  valorPedido: number;
  /** Total consumido pelo cliente. */
  valorFinal: number;
  desconto: number;
  pendenciaAnterior: number;
  /** valorFinal - desconto + pendenciaAnterior */
  totalReceber: number;
  valorPago: number;
  /** O que ainda falta receber. Negativo = cliente pagou a mais. */
  saldoAberto: number;
  totalItens: number;
  unidadesEntregues: number;
  unidadesDevolvidas: number;
  unidadesConsumidas: number;
  /** Custo total da mercadoria consumida (lucro = valorFinal - desconto - custoTotal). */
  custoTotal: number;
  lucro: number;
}

export function calcularTotais(pedido: Pedido): TotaisPedido {
  const { tipo, itens } = pedido;

  let valorPedido = 0;
  let valorFinal = 0;
  let unidadesEntregues = 0;
  let unidadesDevolvidas = 0;
  let custoTotal = 0;

  for (const item of itens) {
    valorPedido += valorPedidoItem(item);
    valorFinal += valorFinalItem(item, tipo);
    unidadesEntregues += entregueUn(item);
    unidadesDevolvidas += devolvidoUn(item, tipo);
    custoTotal += saldoUn(item, tipo) * (item.custoUn || 0);
  }

  const desconto = pedido.desconto || 0;
  const pendenciaAnterior = pedido.pendenciaAnterior || 0;
  const valorPago = pedido.valorPago || 0;
  const totalReceber = valorFinal - desconto + pendenciaAnterior;

  return {
    valorPedido,
    valorFinal,
    desconto,
    pendenciaAnterior,
    totalReceber,
    valorPago,
    saldoAberto: totalReceber - valorPago,
    totalItens: itens.length,
    unidadesEntregues,
    unidadesDevolvidas,
    unidadesConsumidas: unidadesEntregues - unidadesDevolvidas,
    custoTotal,
    lucro: valorFinal - desconto - custoTotal,
  };
}

/** Soma o lucro (calcularTotais) de uma lista de pedidos — lucro cheio, mesmo sem ter recebido ainda. */
export function lucroTotal(pedidos: Pedido[]): number {
  return pedidos.reduce((soma, p) => soma + calcularTotais(p).lucro, 0);
}

/**
 * Lucro proporcional ao que já foi pago — se o cliente pagou metade do
 * pedido, conta só metade do lucro. Sem isso, um pedido de R$1.900 com
 * apenas R$900 recebidos já aparecia com o lucro do evento inteiro.
 */
export function lucroRecebido(pedido: Pedido): number {
  const t = calcularTotais(pedido);
  if (t.totalReceber <= 0) return 0;
  const fracaoPaga = Math.min(1, Math.max(0, t.valorPago / t.totalReceber));
  return t.lucro * fracaoPaga;
}

export function lucroRecebidoTotal(pedidos: Pedido[]): number {
  return pedidos.reduce((soma, p) => soma + lucroRecebido(p), 0);
}

/**
 * Quanto de cada produto está fora do galpão por causa deste pedido —
 * usado pra saber quanto debitar/creditar do estoque automaticamente.
 * Pedido cancelado não tira nada do galpão (é como se nunca tivesse saído).
 */
export function efeitoEstoque(pedido: Pedido): Map<string, number> {
  const mapa = new Map<string, number>();
  if (pedido.status === "CANCELADO") return mapa;
  for (const item of pedido.itens) {
    mapa.set(item.produtoId, saldoUn(item, pedido.tipo));
  }
  return mapa;
}

/** Cria um item zerado a partir de um produto. */
export function novoItem(produto: {
  id: string;
  nome: string;
  unPorCaixa: number;
  precoUn: number;
  precoCusto: number;
}): PedidoItem {
  return {
    produtoId: produto.id,
    nome: produto.nome,
    unPorCaixa: produto.unPorCaixa,
    precoUn: produto.precoUn,
    custoUn: produto.precoCusto,
    entregas: [{ numero: 1, cx: 0, un: 0 }],
    devolucaoCx: 0,
    devolucaoUn: 0,
  };
}

/** Quantas remessas o pedido tem (a maior contagem entre os itens). */
export function totalRemessas(itens: PedidoItem[]): number {
  return itens.reduce((max, i) => Math.max(max, i.entregas.length), 1);
}
