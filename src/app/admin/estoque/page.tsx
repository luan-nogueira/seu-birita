"use client";

import { useMemo, useState } from "react";
import { Cabecalho, Modal } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados } from "@/lib/store";
import { novoId } from "@/lib/db";
import { brl, dataBR, hojeISO, normalizar } from "@/lib/format";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronRight,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import type { EstoqueMovimento, EstoqueOrigem, EstoqueTipo, Produto } from "@/lib/types";

const ROTULO_ORIGEM: Record<EstoqueOrigem, string> = {
  COMPRA: "Compra",
  PEDIDO: "Venda/Entrega",
  DEVOLUCAO: "Devolução",
  AJUSTE: "Ajuste",
  PERDA: "Perda",
};

/** Primeiro dia do mês atual, formato YYYY-MM-DD. */
function inicioDoMes(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

export default function EstoquePage() {
  return (
    <Protegido chave="estoque">
      <EstoquePageInterno />
    </Protegido>
  );
}

function EstoquePageInterno() {
  const {
    movimentos,
    produtos,
    fornecedores,
    salvarMovimento,
    salvarProduto,
    produtoPorId,
  } = useDados();

  const [busca, setBusca] = useState("");
  const [produtoHistorico, setProdutoHistorico] = useState<Produto | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Form do lançamento manual
  const [tipoMovimento, setTipoMovimento] = useState<EstoqueOrigem>("COMPRA");
  const [produtoId, setProdutoId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [quantidadeUn, setQuantidadeUn] = useState("");
  const [custoTotal, setCustoTotal] = useState("");
  const [obs, setObs] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [focoBusca, setFocoBusca] = useState(false);

  const produtosOrdenados = [...produtos].filter((p) => p.ativo);
  const produtosFiltrados = produtosOrdenados.filter((p) =>
    p.nome.toLowerCase().includes(buscaProduto.toLowerCase()),
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return produtosOrdenados.filter(
      (p) => !termo || normalizar(p.nome).includes(termo) || normalizar(p.categoria).includes(termo),
    );
  }, [produtosOrdenados, busca]);

  const agrupados = useMemo(() => {
    const mapa = new Map<string, Produto[]>();
    for (const p of visiveis) {
      const chave = p.categoria || "Sem categoria";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [visiveis]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!produtoId || !quantidadeUn) return;

    const qtd = Number(quantidadeUn);
    if (qtd <= 0) return;

    setSalvando(true);
    try {
      const produto = produtoPorId(produtoId);
      if (!produto) throw new Error("Produto não encontrado");

      const tipoEntrada: EstoqueTipo =
        tipoMovimento === "COMPRA" || tipoMovimento === "DEVOLUCAO"
          ? "ENTRADA"
          : tipoMovimento === "PERDA"
            ? "SAIDA"
            : "AJUSTE";

      const isEntrada = tipoEntrada === "ENTRADA" || (tipoEntrada === "AJUSTE" && tipoMovimento !== "PERDA");

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

      let novoPrecoCusto = produto.precoCusto;
      if (tipoMovimento === "COMPRA" && custoUn !== undefined) {
        const comprasAnteriores = movimentos
          .filter((m) => m.produtoId === produtoId && m.origem === "COMPRA" && m.custoUn !== undefined)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
          .slice(0, 2);

        let totalSoma = qtd * custoUn;
        let totalQtd = qtd;

        for (const c of comprasAnteriores) {
          totalSoma += c.quantidadeUn * c.custoUn!;
          totalQtd += c.quantidadeUn;
        }

        novoPrecoCusto = totalSoma / totalQtd;
      }

      // Sem clamp em 0: negativo avisa que o lançado não bate com a
      // realidade, em vez de esconder o problema.
      const novoEstoqueUn = isEntrada ? produto.estoqueUn + qtd : produto.estoqueUn - qtd;

      await salvarProduto({
        ...produto,
        estoqueUn: novoEstoqueUn,
        precoCusto: novoPrecoCusto,
        atualizadoEm: new Date().toISOString(),
      });

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
        subtitulo="Quantidade atual e histórico por produto"
        acao={
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primario text-sm">
            <Plus className="h-4 w-4" />
            Lançar Movimento
          </button>
        }
      />

      <div className="px-4 md:px-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
          <input
            className="campo pl-9"
            placeholder="Buscar produto ou categoria…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {visiveis.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-superficie-2 text-texto-suave">
              <Boxes className="h-7 w-7" />
            </div>
            <p className="font-bold">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {agrupados.map(([categoria, itens]) => (
              <section key={categoria}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
                  <Boxes className="h-3.5 w-3.5" />
                  {categoria}
                  <span className="font-normal normal-case">({itens.length})</span>
                </h2>
                <ul className="card divide-y divide-borda overflow-hidden">
                  {itens.map((p) => {
                    const negativo = p.estoqueUn < 0;
                    const baixo = !negativo && p.estoqueMinimo > 0 && p.estoqueUn <= p.estoqueMinimo;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setProdutoHistorico(p)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-superficie-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{p.nome}</p>
                            {p.unPorCaixa > 1 && (
                              <p className="text-xs text-texto-suave">{p.unPorCaixa} un/cx</p>
                            )}
                          </div>
                          {(baixo || negativo) && (
                            <AlertTriangle
                              className={`h-4 w-4 shrink-0 ${negativo ? "text-red-600 dark:text-red-400" : "text-acento"}`}
                              aria-label={negativo ? "Estoque negativo" : "Estoque baixo"}
                            />
                          )}
                          <span
                            className={`shrink-0 text-right font-black tabular-nums ${
                              negativo
                                ? "text-red-600 dark:text-red-400"
                                : baixo
                                  ? "text-acento"
                                  : ""
                            }`}
                          >
                            {p.estoqueUn} un
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-texto-suave" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {produtoHistorico && (
        <ModalHistorico
          produto={produtoHistorico}
          movimentos={movimentos.filter((m) => m.produtoId === produtoHistorico.id)}
          aoFechar={() => setProdutoHistorico(null)}
        />
      )}

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
              value={produtoId ? produtos.find((p) => p.id === produtoId)?.nome || "" : buscaProduto}
              onChange={(e) => {
                setBuscaProduto(e.target.value);
                setProdutoId("");
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
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
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
                <span className="absolute right-4 top-2.5 text-sm text-texto-suave pointer-events-none">un</span>
              </div>
            </div>

            {tipoMovimento === "COMPRA" && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold">Custo Total (R$)</label>
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
                Isso atualizará o <strong>Custo Médio Ponderado</strong> do produto. <br />
                O custo unitário dessa compra saiu a{" "}
                <strong>{brl(Number(custoTotal) / Number(quantidadeUn))}</strong>.
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

/** Histórico de um produto — com filtro de data, pra saber "quanto vendi em X". */
function ModalHistorico({
  produto,
  movimentos,
  aoFechar,
}: {
  produto: Produto;
  movimentos: EstoqueMovimento[];
  aoFechar: () => void;
}) {
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hojeISO());

  const noPeriodo = useMemo(
    () =>
      movimentos
        .filter((m) => {
          const data = m.data.slice(0, 10);
          return data >= de && data <= ate;
        })
        .sort((a, b) => b.data.localeCompare(a.data)),
    [movimentos, de, ate],
  );

  const totalSaida = noPeriodo.filter((m) => m.tipo === "SAIDA").reduce((s, m) => s + m.quantidadeUn, 0);
  const totalEntrada = noPeriodo.filter((m) => m.tipo === "ENTRADA").reduce((s, m) => s + m.quantidadeUn, 0);

  return (
    <Modal aberto aoFechar={aoFechar} titulo={produto.nome} largura="max-w-xl">
      <div className="space-y-4">
        <div className="card flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-texto-suave">Estoque atual</span>
          <span
            className={`text-xl font-black tabular-nums ${
              produto.estoqueUn < 0 ? "text-red-600 dark:text-red-400" : ""
            }`}
          >
            {produto.estoqueUn} un
          </span>
        </div>
        {produto.estoqueUn < 0 && (
          <p className="-mt-2 text-xs text-red-600 dark:text-red-400">
            Negativo — venderam mais do que estava lançado. Faz um "Ajuste" pra
            corrigir com a contagem real do galpão.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="hist-de">
              De
            </label>
            <input
              id="hist-de"
              type="date"
              className="campo"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="hist-ate">
              Até
            </label>
            <input
              id="hist-ate"
              type="date"
              className="campo"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="card px-3 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
              <ArrowUp className="h-3 w-3 text-red-500" />
              Saiu no período
            </p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-red-600 dark:text-red-400">
              {totalSaida} un
            </p>
          </div>
          <div className="card px-3 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
              <ArrowDown className="h-3 w-3 text-emerald-500" />
              Entrou no período
            </p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalEntrada} un
            </p>
          </div>
        </div>

        {noPeriodo.length === 0 ? (
          <p className="py-8 text-center text-sm text-texto-suave">
            Nenhuma movimentação nesse período.
          </p>
        ) : (
          <ul className="card divide-y divide-borda overflow-hidden">
            {noPeriodo.map((m) => {
              const isEntrada = m.tipo === "ENTRADA";
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  {isEntrada ? (
                    <ArrowDown className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowUp className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{ROTULO_ORIGEM[m.origem]}</p>
                    <p className="text-xs text-texto-suave">
                      {dataBR(m.data)}
                      {m.obs && ` · ${m.obs}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-black tabular-nums ${
                      isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isEntrada ? "+" : "-"}
                    {m.quantidadeUn} un
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
