import type { Pedido, PedidoItem, PedidoTipo } from "./types";

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
