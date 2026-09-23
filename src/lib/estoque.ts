import { novoId } from "./db";
import { hojeISO } from "./format";
import type { EstoqueMovimento, Produto } from "./types";

interface DepsEstoque {
  produtoPorId: (id: string) => Produto | undefined;
  salvarProduto: (p: Produto) => Promise<void>;
  salvarMovimento: (m: EstoqueMovimento) => Promise<void>;
}

/**
 * Lança em Estoque só a diferença entre o que um pedido tirava antes e o
 * que tira agora — usado tanto ao editar um pedido quanto ao criar um novo
 * já com itens preenchidos (nesse caso, `efeitoAntes` é um Map vazio).
 */
export async function aplicarAjusteEstoque(
  efeitoAntes: Map<string, number>,
  efeitoDepois: Map<string, number>,
  pedidoId: string,
  { produtoPorId, salvarProduto, salvarMovimento }: DepsEstoque,
) {
  const produtoIds = new Set([...efeitoAntes.keys(), ...efeitoDepois.keys()]);
  for (const produtoId of produtoIds) {
    const antes = efeitoAntes.get(produtoId) ?? 0;
    const depois = efeitoDepois.get(produtoId) ?? 0;
    const delta = depois - antes; // positivo = mais unidades saíram do galpão
    if (delta === 0) continue;

    const produto = produtoPorId(produtoId);
    if (!produto) continue;

    const movimento: EstoqueMovimento = {
      id: novoId(),
      produtoId,
      produtoNome: produto.nome,
      tipo: delta > 0 ? "SAIDA" : "ENTRADA",
      origem: delta > 0 ? "PEDIDO" : "DEVOLUCAO",
      quantidadeUn: Math.abs(delta),
      referenciaId: pedidoId,
      // Data local (não toISOString) — depois das 21h no fuso do Brasil, o
      // timestamp UTC já vira o dia seguinte e a movimentação aparecia com
      // a data errada no histórico do estoque.
      data: hojeISO(),
      criadoEm: new Date().toISOString(),
    };
    await salvarMovimento(movimento);
    await salvarProduto({
      ...produto,
      // Sem clamp em 0: se vender mais do que tinha lançado, o negativo
      // avisa que o estoque real está errado (faltou lançar uma compra,
      // por exemplo) em vez de esconder o problema.
      estoqueUn: produto.estoqueUn - delta,
      atualizadoEm: new Date().toISOString(),
    });
  }
}

interface DepsReverter {
  produtoPorId: (id: string) => Produto | undefined;
  salvarProduto: (p: Produto) => Promise<void>;
  movimentos: EstoqueMovimento[];
  removerMovimento: (id: string) => Promise<void>;
}

/**
 * Usado ao excluir um pedido: devolve pro estoque o que ele tinha tirado
 * e APAGA os lançamentos daquele pedido, em vez de criar um novo
 * lançamento de "devolução" por cima. Se não apagasse, o histórico do
 * produto ficava cheio de movimentação de um pedido que não existe mais.
 */
export async function reverterEstoquePedido(
  efeito: Map<string, number>,
  pedidoId: string,
  { produtoPorId, salvarProduto, movimentos, removerMovimento }: DepsReverter,
) {
  for (const [produtoId, antes] of efeito) {
    if (antes === 0) continue;
    const produto = produtoPorId(produtoId);
    if (!produto) continue;

    await salvarProduto({
      ...produto,
      estoqueUn: produto.estoqueUn + antes,
      atualizadoEm: new Date().toISOString(),
    });
  }

  const doPedido = movimentos.filter((m) => m.referenciaId === pedidoId);
  for (const m of doPedido) {
    await removerMovimento(m.id);
  }
}

/**
 * Quanto um pedido já tirou de verdade do estoque, somando os lançamentos
 * dele no histórico. Serve de baseline no lugar de efeitoEstoque(pedido)
 * porque a regra muda com o tempo (ex.: rascunho passou a não tirar do
 * estoque) — um pedido antigo que já descontou pela regra velha não pode
 * descontar de novo nem "esquecer" de devolver ao ser excluído.
 * Retorna null se o pedido não tem nenhum lançamento (pedido anterior ao
 * controle de estoque), pra quem chama cair no cálculo pela regra.
 */
export function efeitoLancado(
  movimentos: EstoqueMovimento[],
  pedidoId: string,
): Map<string, number> | null {
  const doPedido = movimentos.filter(
    (m) =>
      m.referenciaId === pedidoId &&
      (m.origem === "PEDIDO" || m.origem === "DEVOLUCAO"),
  );
  if (doPedido.length === 0) return null;
  const mapa = new Map<string, number>();
  for (const m of doPedido) {
    const sinal = m.tipo === "SAIDA" ? 1 : -1;
    mapa.set(m.produtoId, (mapa.get(m.produtoId) ?? 0) + sinal * m.quantidadeUn);
  }
  return mapa;
}
