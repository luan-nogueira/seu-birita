"use client";

import { useMemo, useState } from "react";
import { Cabecalho, Modal } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { brl, caixasEUnidades, dataBR, dataHoraBR, hojeISO, normalizar } from "@/lib/format";
import { compararCategorias, estoqueNegativo, semCustoNoEstoque } from "@/lib/calc";
import {
  acertarPedidosDesatualizados,
  movimentosOrfaos,
  somaDoHistorico,
  pedidosDesatualizados,
} from "@/lib/estoque";
import {
  inicioDoMes,
  ModalEditarCompra,
  ModalNovoMovimento,
  resumoPrazo,
} from "@/components/Compras";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronRight,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import type {
  EstoqueMovimento,
  EstoqueOrigem,
  Produto,
} from "@/lib/types";

const ROTULO_ORIGEM: Record<EstoqueOrigem, string> = {
  COMPRA: "Compra",
  PEDIDO: "Venda/Entrega",
  DEVOLUCAO: "Devolução",
  AJUSTE: "Ajuste",
  PERDA: "Perda",
};

export default function EstoquePage() {
  return (
    <Protegido chave="estoque">
      <EstoquePageInterno />
    </Protegido>
  );
}

function EstoquePageInterno() {
  const { permissoes } = useAuth();
  const {
    movimentos,
    produtos,
    salvarMovimento,
    somarEstoque,
    atualizarProduto,
    produtoPorId,
    pedidoPorId,
    pedidos,
    removerMovimento,
  } = useDados();

  const [busca, setBusca] = useState("");
  const [soSemCusto, setSoSemCusto] = useState(false);
  const [soDivergentes, setSoDivergentes] = useState(false);
  const [produtoHistorico, setProdutoHistorico] = useState<Produto | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [limpandoOrfaos, setLimpandoOrfaos] = useState(false);

  const orfaos = useMemo(
    () => movimentosOrfaos(movimentos, pedidoPorId),
    [movimentos, pedidoPorId],
  );

  async function limparOrfaos() {
    if (limpandoOrfaos) return;
    if (!window.confirm(`Apagar ${orfaos.length} lançamento(s) de pedidos que já foram excluídos? A quantidade em estoque não muda, só o histórico.`)) {
      return;
    }
    setLimpandoOrfaos(true);
    try {
      for (const m of orfaos) {
        await removerMovimento(m.id);
      }
    } finally {
      setLimpandoOrfaos(false);
    }
  }

  // Pedidos que ainda seguem a regra antiga de baixa (ver pedidosDesatualizados).
  const desatualizados = useMemo(
    () => pedidosDesatualizados(pedidos, movimentos),
    [pedidos, movimentos],
  );
  const [acertandoPedidos, setAcertandoPedidos] = useState(false);

  async function acertarPedidos() {
    if (acertandoPedidos) return;
    const linhas = desatualizados.map(({ pedido, deltas }) => {
      const total = [...deltas.values()].reduce((s, d) => s + d, 0);
      const acao = total < 0 ? `volta ${-total} un` : `sai ${total} un`;
      return `#${String(pedido.numero).padStart(3, "0")} ${pedido.clienteNome}: ${acao}`;
    });
    if (!window.confirm(`Acertar o estoque destes pedidos?\n\n${linhas.join("\n")}`)) return;
    setAcertandoPedidos(true);
    try {
      await acertarPedidosDesatualizados(desatualizados, {
        produtoPorId,
        somarEstoque,
        salvarMovimento,
      });
    } finally {
      setAcertandoPedidos(false);
    }
  }

  const produtosOrdenados = [...produtos].filter((p) => p.ativo);

  // Produtos cujo estoque não bate com a soma do histórico (ver somaDoHistorico).
  const historico = useMemo(() => somaDoHistorico(movimentos, orfaos), [movimentos, orfaos]);
  const divergente = (p: Produto) => (historico.get(p.id) ?? 0) !== p.estoqueUn;
  const qtdDivergentes = produtosOrdenados.filter(divergente).length;
  const [acertandoHistorico, setAcertandoHistorico] = useState(false);

  /**
   * Pista de onde veio a diferença: lançamentos do produto com exatamente a
   * quantidade que falta — a gravação perdida foi a do estoque de um deles.
   * Ex.: Heineken com 564 un de diferença → "Pedido #045 Multishow".
   */
  function suspeitos(p: Produto): string[] {
    const diferenca = Math.abs((historico.get(p.id) ?? 0) - p.estoqueUn);
    if (diferenca === 0) return [];
    const nomes = new Set<string>();
    for (const m of movimentos) {
      if (m.produtoId !== p.id || m.quantidadeUn !== diferenca) continue;
      const pedido = m.referenciaId ? pedidoPorId(m.referenciaId) : undefined;
      nomes.add(
        pedido
          ? `Pedido #${String(pedido.numero).padStart(3, "0")} ${pedido.clienteNome}`
          : `${ROTULO_ORIGEM[m.origem]} de ${dataBR(m.data)}`,
      );
    }
    return [...nomes];
  }

  // Nos furos que apareceram (gravação do estoque perdida, compra editada
  // na versão antiga) o histórico é que estava certo: o lançamento gravou,
  // o número do estoque não. Então dá pra acertar o estoque pelo histórico
  // sem contar o galpão — a lista mostra cada mudança antes de confirmar.
  async function acertarPeloHistorico() {
    if (acertandoHistorico) return;
    const lista = produtosOrdenados.filter(divergente);
    const linhas = lista.map(
      (p) => {
        const pista = suspeitos(p);
        return `${p.nome}: ${p.estoqueUn} → ${historico.get(p.id) ?? 0} un${
          pista.length ? ` (${pista.join(", ")})` : ""
        }`;
      },
    );
    if (!window.confirm(`Usar o número do histórico nestes produtos?\n\n${linhas.join("\n")}`)) return;
    setAcertandoHistorico(true);
    try {
      for (const p of lista) {
        await atualizarProduto(p.id, { estoqueUn: historico.get(p.id) ?? 0 });
      }
      setSoDivergentes(false);
    } finally {
      setAcertandoHistorico(false);
    }
  }

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return produtosOrdenados.filter(
      (p) =>
        (!soSemCusto || semCustoNoEstoque(p)) &&
        (!soDivergentes || divergente(p)) &&
        (!termo || normalizar(p.nome).includes(termo) || normalizar(p.categoria).includes(termo)),
    );
    // divergente depende de historico, que já está nas dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtosOrdenados, busca, soSemCusto, soDivergentes, historico]);

  // Valor do que está parado no galpão. Estoque negativo não conta (é erro
  // de lançamento, não mercadoria) e produto sem custo cadastrado entra como
  // zero no custo — por isso o aviso com a contagem deles.
  const valorEstoque = useMemo(() => {
    let custo = 0;
    let venda = 0;
    let semCusto = 0;
    for (const p of produtosOrdenados) {
      if (p.estoqueUn <= 0) continue;
      custo += p.estoqueUn * (p.precoCusto || 0);
      venda += p.estoqueUn * (p.precoUn || 0);
      if (semCustoNoEstoque(p)) semCusto++;
    }
    return { custo, venda, semCusto };
  }, [produtosOrdenados]);

  const agrupados = useMemo(() => {
    const mapa = new Map<string, Produto[]>();
    for (const p of visiveis) {
      const chave = p.categoria || "Sem categoria";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => compararCategorias(a, b));
  }, [visiveis]);


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

      {orfaos.length > 0 && (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm dark:bg-ouro-900/20 md:mx-6">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {orfaos.length} lançamento(s) de pedidos já excluídos no histórico
            </span>
            <span className="block text-xs text-texto-suave">
              Não afeta a quantidade em estoque — só sujeira visual, de antes
              da correção que passou a limpar isso junto.
            </span>
          </span>
          <button
            type="button"
            className="btn-secundario shrink-0 text-xs"
            onClick={limparOrfaos}
            disabled={limpandoOrfaos}
          >
            {limpandoOrfaos ? "Limpando…" : "Limpar agora"}
          </button>
        </div>
      )}

      {qtdDivergentes > 0 && (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm dark:bg-ouro-900/20 md:mx-6">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {qtdDivergentes} produto(s) com o estoque diferente do histórico
            </span>
            <span className="block text-xs text-texto-suave">
              Foi gravação perdida do sistema: o histórico é que está certo.
            </span>
          </span>
          <button
            type="button"
            className="btn-secundario shrink-0 text-xs"
            onClick={() => setSoDivergentes((v) => !v)}
          >
            {soDivergentes ? "Mostrar todos" : "Ver quais"}
          </button>
          <button
            type="button"
            className="btn-primario shrink-0 text-xs"
            onClick={acertarPeloHistorico}
            disabled={acertandoHistorico}
          >
            {acertandoHistorico ? "Acertando…" : "Acertar pelo histórico"}
          </button>
        </div>
      )}

      {desatualizados.length > 0 && (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm dark:bg-ouro-900/20 md:mx-6">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {desatualizados.length} pedido(s) com o estoque desatualizado
            </span>
            <span className="block text-xs text-texto-suave">
              A regra de baixa mudou (Entregue e Estocado agora tiram do
              estoque; Rascunho não tira), mas os pedidos que já estavam
              assim continuaram com o lançamento antigo.
            </span>
          </span>
          <button
            type="button"
            className="btn-primario shrink-0 text-xs"
            onClick={acertarPedidos}
            disabled={acertandoPedidos}
          >
            {acertandoPedidos ? "Acertando…" : "Acertar agora"}
          </button>
        </div>
      )}

      <div className="px-4 md:px-6">
        <div className={`mb-4 grid gap-2 ${permissoes.verCusto ? "grid-cols-2" : "grid-cols-1"}`}>
          {permissoes.verCusto && (
            <div className="card px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
                Estoque a preço de custo
              </p>
              <p className="mt-1 text-xl font-black tabular-nums">
                {brl(valorEstoque.custo)}
              </p>
              {valorEstoque.semCusto > 0 && (
                <button
                  type="button"
                  onClick={() => setSoSemCusto(true)}
                  className="mt-0.5 text-left text-xs font-semibold text-acento underline underline-offset-2"
                >
                  {valorEstoque.semCusto} produto(s) sem custo cadastrado — ver quais
                </button>
              )}
            </div>
          )}
          <div className="card px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
              Estoque a preço de venda
            </p>
            <p className="mt-1 text-xl font-black tabular-nums">
              {brl(valorEstoque.venda)}
            </p>
          </div>
        </div>

        {soSemCusto && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm dark:bg-ouro-900/20">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Só os produtos sem custo</span>
              <span className="block text-xs text-texto-suave">
                O custo se cadastra em Produtos, no lápis de cada um.
              </span>
            </span>
            {permissoes.produtos && (
              <Link href="/admin/produtos?semCusto=1" className="btn-primario shrink-0 text-xs">
                Cadastrar custos
              </Link>
            )}
            <button
              type="button"
              className="btn-secundario shrink-0 text-xs"
              onClick={() => setSoSemCusto(false)}
            >
              Mostrar todos
            </button>
          </div>
        )}

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
            <p className="font-bold">
              {soSemCusto
                ? "Todos os produtos em estoque já têm custo"
                : "Nenhum produto encontrado"}
            </p>
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
                    const negativo = estoqueNegativo(p);
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
                            {divergente(p) && (
                              <span className="mt-0.5 mr-1 inline-block rounded-full bg-ouro-100 px-2 py-0.5 text-[10px] font-bold text-ouro-800 uppercase dark:bg-ouro-900/40 dark:text-ouro-300">
                                conferir
                              </span>
                            )}
                            {permissoes.verCusto && semCustoNoEstoque(p) && (
                              <span className="mt-0.5 inline-block rounded-full bg-acento/15 px-2 py-0.5 text-[10px] font-bold text-acento uppercase">
                                sem custo
                              </span>
                            )}
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
                          <div className={`shrink-0 text-right font-black tabular-nums ${
                              negativo
                                ? "text-red-600 dark:text-red-400"
                                : baixo
                                  ? "text-acento"
                                  : ""
                            }`}>
                            <span className="block">{p.estoqueUn} un</span>
                            {p.unPorCaixa > 1 && (
                              <span className="block text-[10px] text-texto-suave/80 font-bold uppercase mt-0.5">
                                {caixasEUnidades(p.estoqueUn, p.unPorCaixa)}
                              </span>
                            )}
                          </div>
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
          // Pega o produto atual do banco: o guardado no clique ficava com o
          // estoque antigo depois de editar uma compra aqui dentro.
          produto={produtoPorId(produtoHistorico.id) ?? produtoHistorico}
          movimentos={movimentos.filter((m) => m.produtoId === produtoHistorico.id)}
          somaHistorico={historico.get(produtoHistorico.id) ?? 0}
          suspeitos={suspeitos(produtoPorId(produtoHistorico.id) ?? produtoHistorico)}
          aoFechar={() => setProdutoHistorico(null)}
        />
      )}

      <ModalNovoMovimento aberto={modalAberto} aoFechar={() => setModalAberto(false)} />
    </>
  );
}

/** Histórico de um produto — com filtro de data, pra saber "quanto vendi em X". */
interface LinhaHistorico {
  chave: string;
  rotulo: string;
  detalhe: string;
  data: string;
  obs?: string;
  /** Positivo = entrou no galpão, negativo = saiu. */
  quantidade: number;
  dePedido?: boolean;
  /** Lançamento de compra — a linha abre a edição de fornecedor/pagamento. */
  compra?: EstoqueMovimento;
}


function ModalHistorico({
  produto,
  movimentos,
  somaHistorico,
  suspeitos,
  aoFechar,
}: {
  produto: Produto;
  movimentos: EstoqueMovimento[];
  /** Soma de todo o histórico do produto (sem pedido excluído), pra conferir com o estoque. */
  somaHistorico: number;
  /** Lançamentos com a quantidade exata da diferença (ver suspeitos). */
  suspeitos: string[];
  aoFechar: () => void;
}) {
  const { pedidoPorId, fornecedores, contasPagar } = useDados();
  const [editandoCompra, setEditandoCompra] = useState<EstoqueMovimento | null>(null);
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hojeISO());

  // Lançamentos de pedido (saída/devolução) são agrupados numa linha só por
  // pedido, com o saldo líquido. O salvamento automático do pedido lança um
  // movimento a cada ajuste de quantidade (digitou 100, corrigiu pra 81,
  // lançou devolução…), o que enchia o histórico de linhas que se anulam.
  // Compra, ajuste e perda continuam aparecendo um por um.
  const linhas = useMemo(() => {
    const doPeriodo = movimentos.filter((m) => {
      const data = m.data.slice(0, 10);
      return data >= de && data <= ate;
    });

    const resultado: LinhaHistorico[] = [];
    const porPedido = new Map<string, LinhaHistorico>();

    for (const m of doPeriodo) {
      const dePedido =
        (m.origem === "PEDIDO" || m.origem === "DEVOLUCAO") && m.referenciaId;
      if (!dePedido) {
        let detalhe = "";
        if (m.origem === "COMPRA") {
          const f = m.fornecedorId
            ? fornecedores.find((x) => x.id === m.fornecedorId)
            : undefined;
          detalhe = f ? f.nome : "sem fornecedor";
          if (m.custoUn) detalhe += (detalhe ? " · " : "") + brl(m.custoUn) + "/un";
          if (m.pagamento === "AVISTA") detalhe += " · à vista";
          if (m.pagamento === "PRAZO") detalhe += " · " + resumoPrazo(m, contasPagar);
        }
        resultado.push({
          chave: m.id,
          rotulo: ROTULO_ORIGEM[m.origem],
          detalhe,
          data: m.data,
          obs: m.obs,
          // Ajustes antigos têm tipo "AJUSTE" e sempre somavam; os novos
          // (por contagem) já vêm como ENTRADA ou SAIDA.
          quantidade: m.tipo === "SAIDA" ? -m.quantidadeUn : m.quantidadeUn,
          compra: m.origem === "COMPRA" ? m : undefined,
        });
        continue;
      }

      const sinal = m.tipo === "SAIDA" ? -1 : 1;
      const existente = porPedido.get(m.referenciaId!);
      if (existente) {
        existente.quantidade += sinal * m.quantidadeUn;
        if (m.data > existente.data) existente.data = m.data;
      } else {
        const pedido = pedidoPorId(m.referenciaId!);
        const linha: LinhaHistorico = {
          chave: m.referenciaId!,
          rotulo: pedido ? `Pedido #${String(pedido.numero).padStart(3, "0")}` : "Pedido excluído",
          detalhe: pedido
            ? pedido.clienteNome + (pedido.titulo ? ` · ${pedido.titulo}` : "")
            : "",
          data: m.data,
          quantidade: sinal * m.quantidadeUn,
          dePedido: true,
        };
        porPedido.set(m.referenciaId!, linha);
        resultado.push(linha);
      }
    }

    return resultado.sort((x, y) => y.data.localeCompare(x.data));
  }, [movimentos, de, ate, pedidoPorId, fornecedores, contasPagar]);

  const totalSaida = linhas.filter((l) => l.quantidade < 0).reduce((s, l) => s - l.quantidade, 0);
  const totalEntrada = linhas.filter((l) => l.quantidade > 0).reduce((s, l) => s + l.quantidade, 0);

  return (
    <Modal aberto aoFechar={aoFechar} titulo={produto.nome} largura="max-w-xl">
      <div className="space-y-4">
        {produto.unPorCaixa > 1 && (
          <p className="-mt-2 text-sm text-texto-suave">
            Quantidade por caixa: <strong className="text-texto">{produto.unPorCaixa} un</strong>
          </p>
        )}
        <div className="card flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-texto-suave">Estoque atual</span>
          <div className="text-right">
            <span
              className={`block text-xl font-black tabular-nums ${
                estoqueNegativo(produto) ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {produto.estoqueUn} un
            </span>
            {produto.unPorCaixa > 1 && (
              <span className="block text-[11px] font-semibold text-texto-suave uppercase">
                {caixasEUnidades(produto.estoqueUn, produto.unPorCaixa)}
              </span>
            )}
          </div>
        </div>
        {estoqueNegativo(produto) && (
          <p className="-mt-2 text-xs text-red-600 dark:text-red-400">
            Negativo — venderam mais do que estava lançado. Faz um "Ajuste" pra
            corrigir com a contagem real do galpão.
          </p>
        )}
        {somaHistorico !== produto.estoqueUn && (
          <p className="-mt-2 rounded-lg border border-ouro-300 bg-ouro-50 px-3 py-2 text-xs dark:bg-ouro-900/20">
            O histórico soma <strong>{somaHistorico} un</strong>, mas o estoque está em{" "}
            <strong>{produto.estoqueUn} un</strong>. Use "Acertar pelo histórico" na tela do
            Estoque, ou conte no galpão e faça um Ajuste.
            {suspeitos.length > 0 && (
              <>
                {" "}A diferença ({Math.abs(somaHistorico - produto.estoqueUn)} un) bate com:{" "}
                <strong>{suspeitos.join(", ")}</strong>.
              </>
            )}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="rotulo" htmlFor="hist-de">
              De
            </label>
            <input
              id="hist-de"
              type="date"
              className="campo w-full min-w-0"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="rotulo" htmlFor="hist-ate">
              Até
            </label>
            <input
              id="hist-ate"
              type="date"
              className="campo w-full min-w-0"
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

        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-texto-suave">
            Nenhuma movimentação nesse período.
          </p>
        ) : (
          <ul className="card divide-y divide-borda overflow-hidden">
            {linhas.map((l) => {
              const entrada = l.quantidade > 0;
              const zerado = l.quantidade === 0;
              return (
                <li
                  key={l.chave}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    l.compra ? "cursor-pointer transition hover:bg-superficie-2" : ""
                  }`}
                  onClick={l.compra ? () => setEditandoCompra(l.compra!) : undefined}
                >
                  {zerado ? (
                    <span className="h-4 w-4 shrink-0" />
                  ) : entrada ? (
                    <ArrowDown className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowUp className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-semibold">
                      {l.rotulo}
                      {l.detalhe && (
                        <span className="ml-1 text-xs font-normal text-texto-suave">
                          {l.detalhe}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {dataBR(l.data)}
                      {l.dePedido &&
                        (zerado
                          ? " · tudo voltou"
                          : entrada
                            ? " · devolução líquida"
                            : " · saída líquida")}
                      {l.obs && ` · ${l.obs}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-black tabular-nums ${
                      zerado
                        ? "text-texto-suave"
                        : entrada
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {entrada ? "+" : ""}
                    {l.quantidade} un
                  </span>
                  {l.compra && <Pencil className="h-3.5 w-3.5 shrink-0 text-texto-suave" />}
                </li>
              );
            })}
          </ul>
        )}
        {linhas.some((l) => l.compra) && (
          <p className="-mt-2 text-center text-xs text-texto-suave">
            Toque numa compra pra corrigir quantidade, custo, fornecedor ou pagamento.
          </p>
        )}
      </div>

      {editandoCompra && (
        <ModalEditarCompra
          movimento={editandoCompra}
          aoFechar={() => setEditandoCompra(null)}
        />
      )}
    </Modal>
  );
}
