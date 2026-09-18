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
