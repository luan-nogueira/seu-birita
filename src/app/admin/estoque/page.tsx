"use client";

import { useState } from "react";
import { Cabecalho, Modal } from "@/components/ui";
import { useDados } from "@/lib/store";
import { novoId } from "@/lib/db";
import { brl, dataHoraBR } from "@/lib/format";
import { Boxes, Plus, ArrowDown, ArrowUp, RefreshCcw } from "lucide-react";
import type { EstoqueMovimento, EstoqueTipo, EstoqueOrigem } from "@/lib/types";

export default function EstoquePage() {
  const {
    movimentos,
    produtos,
    fornecedores,
    salvarMovimento,
    salvarProduto,
    produtoPorId,
  } = useDados();

  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Form state
  const [tipoMovimento, setTipoMovimento] = useState<EstoqueOrigem>("COMPRA");
  const [produtoId, setProdutoId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [quantidadeUn, setQuantidadeUn] = useState("");
  const [custoTotal, setCustoTotal] = useState("");
  const [obs, setObs] = useState("");

  const [buscaProduto, setBuscaProduto] = useState("");
  const [focoBusca, setFocoBusca] = useState(false);

  const produtosOrdenados = [...produtos].filter(p => p.ativo);
  const produtosFiltrados = produtosOrdenados.filter(p =>
    p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  );
  const movimentosOrdenados = [...movimentos].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!produtoId || !quantidadeUn) return;
    
    const qtd = Number(quantidadeUn);
    if (qtd <= 0) return;

    setSalvando(true);
    try {
      const produto = produtoPorId(produtoId);
      if (!produto) throw new Error("Produto não encontrado");

      const tipoEntrada: EstoqueTipo = (tipoMovimento === "COMPRA" || tipoMovimento === "DEVOLUCAO") ? "ENTRADA" 
        : (tipoMovimento === "PERDA" ? "SAIDA" : "AJUSTE");
      
      const isEntrada = tipoEntrada === "ENTRADA" || (tipoEntrada === "AJUSTE" && tipoMovimento !== "PERDA");
      
      // Calculate unit cost if it's a purchase
      let custoUn: number | undefined = undefined;
      if (tipoMovimento === "COMPRA" && custoTotal) {
        custoUn = Number(custoTotal) / qtd;
      }

      const novoMov: EstoqueMovimento = {
        id: novoId(),
        produtoId,
        produtoNome: produto.nome,
        tipo: tipoEntrada,
        origem: tipoMovimento,
        quantidadeUn: qtd,
        custoUn,
        fornecedorId: fornecedorId || undefined,
        data: new Date().toISOString(),
        obs: obs || undefined,
        criadoEm: new Date().toISOString(),
      };

      await salvarMovimento(novoMov);

      // Calcular o novo custo médio se for compra
      let novoPrecoCusto = produto.precoCusto;
      if (tipoMovimento === "COMPRA" && custoUn !== undefined) {
        // Pegar compras anteriores desse produto
        const comprasAnteriores = movimentos
          .filter(m => m.produtoId === produtoId && m.origem === "COMPRA" && m.custoUn !== undefined)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
          .slice(0, 2); // Pegar as últimas 2 antes dessa nova (totalizando 3)

        let totalSoma = qtd * custoUn;
        let totalQtd = qtd;

        for (const c of comprasAnteriores) {
          totalSoma += (c.quantidadeUn * c.custoUn!);
          totalQtd += c.quantidadeUn;
        }

        novoPrecoCusto = totalSoma / totalQtd;
      }

      // Atualizar o produto
      const novoEstoqueUn = isEntrada 
        ? produto.estoqueUn + qtd 
        : Math.max(0, produto.estoqueUn - qtd);

      await salvarProduto({
        ...produto,
        estoqueUn: novoEstoqueUn,
        precoCusto: novoPrecoCusto,
        atualizadoEm: new Date().toISOString(),
      });

      // Fechar e limpar modal
      setModalAberto(false);
      setProdutoId("");
      setBuscaProduto("");
      setFornecedorId("");
      setQuantidadeUn("");
      setCustoTotal("");
      setObs("");
      setTipoMovimento("COMPRA");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Estoque"
        subtitulo="Histórico de movimentações e lançamentos"
        acao={
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="btn-primario text-sm"
          >
            <Plus className="h-4 w-4" />
            Lançar Movimento
          </button>
        }
      />

      <div className="px-4 md:px-6">
        {movimentosOrdenados.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center mt-6">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-superficie-2 text-texto-suave">
              <Boxes className="h-7 w-7" />
            </div>
            <p className="font-bold">Nenhum movimento registrado</p>
            <p className="text-sm text-texto-suave max-w-xs">
              Lembre-se de lançar suas compras para manter o Custo Médio e o saldo do galpão sempre corretos.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-superficie-2 text-texto-suave">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 font-semibold">Operação</th>
                    <th className="px-4 py-3 font-semibold text-right">Qtd</th>
                    <th className="px-4 py-3 font-semibold text-right">Custo Un</th>
                    <th className="px-4 py-3 font-semibold">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {movimentosOrdenados.map((mov) => {
                    const isEntrada = mov.tipo === "ENTRADA";
                    return (
                      <tr key={mov.id} className="transition hover:bg-superficie-2/50">
                        <td className="px-4 py-3 text-texto-suave">
                          {dataHoraBR(mov.criadoEm).split(" ")[0]}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {mov.produtoNome}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {isEntrada ? (
                              <ArrowDown className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <ArrowUp className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="text-xs font-bold uppercase tracking-wide text-texto-suave">
                              {mov.origem}
                            </span>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isEntrada ? "+" : "-"}{mov.quantidadeUn} un
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-texto-suave">
                          {mov.custoUn ? brl(mov.custoUn) : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-texto-suave max-w-[200px] truncate">
                          {mov.obs || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal
        aberto={modalAberto}
        aoFechar={() => !salvando && setModalAberto(false)}
        titulo="Novo Movimento de Estoque"
        rodape={
          <>
            <button
              type="button"
              disabled={salvando}
              onClick={() => setModalAberto(false)}
              className="btn-secundario px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-movimento"
              disabled={salvando || !produtoId || !quantidadeUn}
              className="btn-primario px-6 py-2"
            >
              {salvando ? "Salvando..." : "Confirmar Lançamento"}
            </button>
          </>
        }
      >
        <form id="form-movimento" onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-2 p-1 bg-superficie-2 rounded-xl overflow-x-auto">
            {(["COMPRA", "AJUSTE", "PERDA"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoMovimento(t)}
                className={`flex-1 min-w-[100px] rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition ${
                  tipoMovimento === t
                    ? "bg-superficie text-texto shadow-sm border border-borda"
                    : "text-texto-suave hover:text-texto"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-sm font-semibold">Produto</label>
            <input
              type="text"
              value={produtoId ? (produtos.find(p => p.id === produtoId)?.nome || "") : buscaProduto}
              onChange={(e) => {
                setBuscaProduto(e.target.value);
                setProdutoId(""); // Clear selection when typing
              }}
              onFocus={() => setFocoBusca(true)}
              onBlur={() => setTimeout(() => setFocoBusca(false), 200)}
              required
              placeholder="Digite o nome do produto..."
              className="campo block w-full"
            />
            {focoBusca && !produtoId && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-borda bg-superficie shadow-xl">
                {produtosFiltrados.length > 0 ? (
                  produtosFiltrados.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => {
                        setProdutoId(p.id);
                        setBuscaProduto(p.nome);
                        setFocoBusca(false);
                      }}
                      className="cursor-pointer px-4 py-3 hover:bg-superficie-2 text-sm border-b border-borda last:border-0 transition-colors"
                    >
                      <span className="font-semibold">{p.nome}</span> 
                      <span className="text-texto-suave text-xs ml-2">(Estoque atual: {p.estoqueUn} un)</span>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-texto-suave text-sm text-center">Nenhum produto encontrado</li>
                )}
              </ul>
            )}
          </div>

          {tipoMovimento === "COMPRA" && fornecedores.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Fornecedor (Opcional)</label>
              <select
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
                className="campo block w-full"
              >
                <option value="">Nenhum fornecedor vinculado</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Quantidade ({tipoMovimento === "PERDA" ? "Saída" : "Entrada"})
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantidadeUn}
                  onChange={(e) => setQuantidadeUn(e.target.value)}
                  required
                  placeholder="0"
                  className="campo block w-full pr-12"
                />
                <span className="absolute right-4 top-2.5 text-sm text-texto-suave pointer-events-none">
                  un
                </span>
              </div>
            </div>

            {tipoMovimento === "COMPRA" && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Custo Total (R$)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={custoTotal}
                  onChange={(e) => setCustoTotal(e.target.value)}
                  required
                  placeholder="0,00"
                  className="campo block w-full"
                />
              </div>
            )}
          </div>

          {tipoMovimento === "COMPRA" && quantidadeUn && custoTotal && (
             <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3">
               <div className="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg shrink-0">
                 <RefreshCcw className="w-5 h-5" />
               </div>
               <p className="text-xs text-emerald-800 dark:text-emerald-300">
                 Isso atualizará o <strong>Custo Médio Ponderado</strong> do produto. <br/>
                 O custo unitário dessa compra saiu a <strong>{brl(Number(custoTotal) / Number(quantidadeUn))}</strong>.
               </p>
             </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Observação (Opcional)</label>
            <input
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Nota fiscal 1234, garrafa quebrada..."
              className="campo block w-full"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
