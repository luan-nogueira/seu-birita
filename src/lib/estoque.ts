import { novoId } from "./db";
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
      data: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
    };
    await salvarMovimento(movimento);
    await salvarProduto({
      ...produto,
      estoqueUn: Math.max(0, produto.estoqueUn - delta),
      atualizadoEm: new Date().toISOString(),
    });
  }
}
