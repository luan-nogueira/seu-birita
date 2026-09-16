"use client";

import { Suspense, useMemo, useState, useCallback } from "react";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { TemaBotao } from "@/components/TemaBotao";
import { ProdutoImagem } from "@/components/ProdutoImagem";
import { useDados, novoId } from "@/lib/store";
import { brl, normalizar } from "@/lib/format";
import { precoDaTabela, tabelaDaUrl } from "@/lib/calc";
import { EMPRESA } from "@/lib/empresa";
import type { PedidoCliente, PedidoClienteItem, Produto } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Tipos locais                                                                 */
/* -------------------------------------------------------------------------- */

interface ItemCarrinho {
  produtoId: string;
  nome: string;
  precoUn: number;
  unPorCaixa: number;
  cx: number;
  un: number;
}

type Etapa = "catalogo" | "carrinho" | "formulario" | "confirmacao";

/* -------------------------------------------------------------------------- */
/* Componente principal                                                         */
/* -------------------------------------------------------------------------- */

export default function PedidoPage() {
  return (
    <Suspense fallback={null}>
      <PedidoPageInterno />
    </Suspense>
  );
}

function PedidoPageInterno() {
  const { produtos, carregando, salvarPedidoCliente, proximoNumeroPedidoCliente } = useDados();
  const tabela = tabelaDaUrl(useSearchParams().get("tabela"));
  const precoDe = useCallback((p: Produto) => precoDaTabela(p, tabela), [tabela]);

  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [etapa, setEtapa] = useState<Etapa>("catalogo");
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null);
  const [produtoCaixa, setProdutoCaixa] = useState<Produto | null>(null);

  // Formulário do cliente
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [localEvento, setLocalEvento] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [obs, setObs] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});

  /* -------------------------------- Produtos ------------------------------- */

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return produtos
      .filter((p) => p.ativo && p.visivelCatalogo && p.precoUn > 0)
      .filter(
        (p) =>
          !termo ||
          normalizar(p.nome).includes(termo) ||
          normalizar(p.categoria).includes(termo),
      );
  }, [produtos, busca]);

  const categorias = useMemo(() => {
    const set = new Set(visiveis.map((p) => p.categoria || "Outros"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [visiveis]);

  const produtosFiltrados = useMemo(() => {
    if (!categoriaAtiva) return visiveis;
    return visiveis.filter(
      (p) => (p.categoria || "Outros") === categoriaAtiva,
    );
  }, [visiveis, categoriaAtiva]);

  /* -------------------------------- Carrinho ------------------------------- */

  const totalItens = carrinho.reduce((s, i) => s + (i.cx * i.unPorCaixa + i.un), 0);
  const totalValor = carrinho.reduce(
    (s, i) => s + i.precoUn * (i.cx * i.unPorCaixa + i.un),
    0,
  );

  const alterarQtd = useCallback(
    (produtoId: string, deltaCx: number, deltaUn: number, nome: string, precoUn: number, unPorCaixa: number) => {
      setCarrinho((prev) => {
        const idx = prev.findIndex((i) => i.produtoId === produtoId);
        if (idx === -1) {
          if (deltaCx <= 0 && deltaUn <= 0) return prev;
          return [...prev, { produtoId, nome, precoUn, unPorCaixa, cx: Math.max(0, deltaCx), un: Math.max(0, deltaUn) }];
        }
        const novaCx = prev[idx].cx + deltaCx;
        const novaUn = prev[idx].un + deltaUn;
        if (novaCx <= 0 && novaUn <= 0) {
          return prev.filter((_, i) => i !== idx);
        }
        return prev.map((i, index) =>
          index === idx ? { ...i, cx: Math.max(0, novaCx), un: Math.max(0, novaUn) } : i,
        );
      });
    },
    [],
  );

  const qtdNoProduto = (produtoId: string) => {
    const item = carrinho.find((i) => i.produtoId === produtoId);
    if (!item) return { cx: 0, un: 0, total: 0 };
    return { cx: item.cx, un: item.un, total: item.cx * item.unPorCaixa + item.un };
  };

  /* -------------------------------- Envio ---------------------------------- */

  function validarFormulario() {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "Digite seu nome completo.";
    if (!telefone.trim()) e.telefone = "Digite seu WhatsApp.";
    else if (telefone.replace(/\D/g, "").length < 10)
      e.telefone = "Número de telefone inválido.";
    if (!localEvento.trim()) e.localEvento = "Informe o local do evento.";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function finalizarPedido() {
    if (!validarFormulario()) return;
    setSalvando(true);
    try {
      const numero = proximoNumeroPedidoCliente();
      const agora = new Date().toISOString();
      const itens: PedidoClienteItem[] = carrinho.map((c) => ({
        produtoId: c.produtoId,
        nome: c.nome,
        precoUn: c.precoUn,
        unPorCaixa: c.unPorCaixa,
        cx: c.cx,
        un: c.un,
        subtotal: c.precoUn * (c.cx * c.unPorCaixa + c.un),
      }));

      const pedido: PedidoCliente = {
        id: novoId(),
        numero,
        nomeCliente: nome.trim(),
        telefone: telefone.trim(),
        localEvento: localEvento.trim(),
        dataEvento: dataEvento || undefined,
        obs: obs.trim() || undefined,
        itens,
        valorTotal: totalValor,
        status: "NOVO",
        criadoEm: agora,
        atualizadoEm: agora,
      };

      await salvarPedidoCliente(pedido);
      setNumeroPedido(numero);
      setEtapa("confirmacao");
    } finally {
      setSalvando(false);
    }
  }

  /* -------------------------------- Render --------------------------------- */

  if (etapa === "confirmacao" && numeroPedido !== null) {
    return <TelaConfirmacao numero={numeroPedido} />;
  }

  return (
    <div className="min-h-dvh" style={{ background: "var(--fundo)" }}>
      {/* ─── Header ─── */}
      <header
        className="relative px-4 py-8 text-center text-barra-texto"
        style={{ background: "var(--barra)" }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center">
          <Logo className="h-24 w-auto" variante="clara" />
          <p className="mt-2 text-sm font-semibold text-creme/80">
            Monte seu pedido
          </p>
        </div>

        {/* Botão de Tema fixo na esquerda do header */}
        <TemaBotao className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-creme rounded-2xl h-11 w-11 shadow-lg backdrop-blur-sm transition-all border border-white/5" />

        {/* Botão do carrinho fixo no header */}
        <button
          id="btn-abrir-carrinho"
          type="button"
          onClick={() => setCarrinhoAberto(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-ouro-500 to-ouro-400 px-4 py-2.5 text-sm font-bold text-marrom-900 shadow-lg shadow-ouro-500/20 transition hover:brightness-105 active:scale-95"
        >
          <ShoppingCart className="h-5 w-5" />
          {totalItens > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-marrom-900 px-1 text-xs font-black text-ouro-400">
              {totalItens}
            </span>
          )}
        </button>
      </header>

      {/* ─── Busca + Filtros ─── */}
      <div
        className="sticky top-0 z-20 border-b px-4 py-3"
        style={{
          background: "var(--superficie)",
          borderColor: "var(--borda)",
        }}
      >
        <div className="mx-auto max-w-5xl space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-suave" />
            <input
              id="busca-produto"
              className="campo pl-9"
              placeholder="Buscar produto…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Filtros de categoria */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setCategoriaAtiva(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                !categoriaAtiva
                  ? "bg-acento text-acento-texto"
                  : "border border-borda text-texto-suave hover:border-acento hover:text-acento"
              }`}
            >
              Todos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() =>
                  setCategoriaAtiva(cat === categoriaAtiva ? null : cat)
                }
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                  categoriaAtiva === cat
                    ? "bg-acento text-acento-texto"
                    : "border border-borda text-texto-suave hover:border-acento hover:text-acento"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Grade de produtos ─── */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {carregando && (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-acento border-t-transparent" />
            <p className="text-sm text-texto-suave">Carregando produtos…</p>
          </div>
        )}

        {!carregando && produtosFiltrados.length === 0 && (
          <p className="py-20 text-center text-sm text-texto-suave">
            {busca ? "Nenhum produto encontrado." : "Sem produtos disponíveis."}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {produtosFiltrados.map((p) => {
            const qtd = qtdNoProduto(p.id);
            return (
              <div
                key={p.id}
                className="group card flex flex-col overflow-hidden transition hover:shadow-xl hover:shadow-acento/5 animate-in fade-in slide-in-from-bottom-4 duration-500"
              >
                {/* Imagem */}
                <div
                  className="relative flex aspect-square w-full items-center justify-center overflow-hidden transition-transform duration-500 group-hover:scale-105"
                  style={{ background: "radial-gradient(circle at center, #ffffff 0%, #e2e8f0 100%)" }}
                >
                  {/* Padrão de fundo premium (grid sutil) */}
                  <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "12px 12px" }} />
                  
                  {/* Marca d'água */}
                  <div className="absolute flex flex-col items-center justify-center opacity-[0.04] rotate-[-10deg] scale-125 pointer-events-none">
                    <Logo className="h-32 w-auto grayscale" variante="escura" />
                  </div>
                  
                  {/* Sombra interna para dar profundidade ao estúdio */}
                  <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.03)] pointer-events-none" />
                  
                  <div className="absolute inset-0 border-b border-black/5 pointer-events-none" />
                  {p.imagemUrl ? (
                    <ProdutoImagem
                      src={p.imagemUrl}
                      alt={p.nome}
                      fill
                      sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className={`z-10 ${p.imagemCenario ? "object-cover" : "object-contain p-4 mix-blend-multiply"}`}
                      fallback={<span className="text-4xl select-none relative z-10">🍺</span>}
                    />
                  ) : (
                    <span className="text-4xl select-none relative z-10">🍺</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-texto-suave">
                    {p.categoria}
                  </p>
                  <p className="flex-1 text-sm font-bold leading-tight line-clamp-2">
                    {p.nome}
                  </p>
                  <p className="text-base font-black tabular-nums text-acento">
                    {brl(precoDe(p))}
                    <span className="text-xs font-normal text-texto-suave">
                      {" "}
                      /un
                    </span>
                  </p>
                  {p.unPorCaixa > 1 && (
                    <p className="text-[10px] text-texto-suave">
                      Cx c/ {p.unPorCaixa} → {brl(precoDe(p) * p.unPorCaixa)}
                    </p>
                  )}

                  {/* Controle de quantidade */}
                  {qtd.total === 0 ? (
                    <button
                      type="button"
                      id={`add-${p.id}`}
                      onClick={() => {
                        if (p.unPorCaixa > 1) {
                          setProdutoCaixa(p);
                        } else {
                          alterarQtd(p.id, 0, 1, p.nome, precoDe(p), p.unPorCaixa);
                        }
                      }}
                      className="mt-2 w-full rounded-xl bg-gradient-to-r from-acento to-ouro-500 py-1.5 text-xs font-bold text-acento-texto shadow-sm shadow-acento/20 transition hover:brightness-110 active:scale-95"
                    >
                      + Adicionar
                    </button>
                  ) : (
                    <div className="mt-2 flex flex-col gap-1">
                      {p.unPorCaixa > 1 && (
                        <div className="flex items-center justify-between rounded-xl border border-acento overflow-hidden bg-acento/5">
                          <span className="text-[10px] uppercase font-bold text-acento px-2">Cx</span>
                          <div className="flex items-center bg-superficie">
                            <button
                              type="button"
                              onClick={() => alterarQtd(p.id, -1, 0, p.nome, precoDe(p), p.unPorCaixa)}
                              className="flex h-7 w-7 items-center justify-center text-acento transition hover:bg-acento/10"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-black tabular-nums text-acento">{qtd.cx}</span>
                            <button
                              type="button"
                              onClick={() => alterarQtd(p.id, 1, 0, p.nome, precoDe(p), p.unPorCaixa)}
                              className="flex h-7 w-7 items-center justify-center text-acento transition hover:bg-acento/10"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      <div className={`flex items-center justify-between rounded-xl border ${p.unPorCaixa > 1 ? "border-borda text-texto-suave" : "border-acento text-acento bg-acento/5"} overflow-hidden`}>
                        {p.unPorCaixa > 1 && <span className="text-[10px] uppercase font-bold px-2">Un</span>}
                        <div className={`flex items-center flex-1 justify-between bg-superficie`}>
                          <button
                            type="button"
                            onClick={() => alterarQtd(p.id, 0, -1, p.nome, precoDe(p), p.unPorCaixa)}
                            className={`flex ${p.unPorCaixa > 1 ? "h-7 w-7" : "h-8 w-8"} items-center justify-center transition hover:bg-superficie-2`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className={`text-center ${p.unPorCaixa > 1 ? "text-xs w-6" : "text-sm flex-1"} font-black tabular-nums`}>{qtd.un}</span>
                          <button
                            type="button"
                            onClick={() => alterarQtd(p.id, 0, 1, p.nome, precoDe(p), p.unPorCaixa)}
                            className={`flex ${p.unPorCaixa > 1 ? "h-7 w-7" : "h-8 w-8"} items-center justify-center transition hover:bg-superficie-2`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Botão flutuante "Ver carrinho" */}
        {totalItens > 0 && (
          <div className="fixed inset-x-4 bottom-6 z-30 flex justify-center">
            <button
              id="btn-ver-carrinho"
              type="button"
              onClick={() => setCarrinhoAberto(true)}
              className="flex w-full max-w-sm items-center justify-between rounded-2xl bg-gradient-to-r from-acento to-ouro-500 px-5 py-3.5 font-bold text-acento-texto shadow-[0_0_30px_rgba(245,158,11,0.3)] transition hover:brightness-110 active:scale-[.98] animate-in slide-in-from-bottom-8 duration-500"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                {totalItens} {totalItens === 1 ? "item" : "itens"}
              </span>
              <span className="tabular-nums">{brl(totalValor)}</span>
            </button>
          </div>
        )}
      </main>

      {/* ─── Drawer do Carrinho ─── */}
      {carrinhoAberto && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setCarrinhoAberto(false)}
          />

          {/* Drawer */}
          <div
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col shadow-2xl"
            style={{ background: "var(--superficie)" }}
          >
            {/* Header drawer */}
            <div
              className="flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: "var(--borda)" }}
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-black">Seu Carrinho</h2>
                {carrinho.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCarrinho([])}
                    className="text-[11px] font-semibold text-red-500 hover:underline px-2 py-1 bg-red-500/10 rounded-lg transition-colors"
                  >
                    Esvaziar tudo
                  </button>
                )}
              </div>
              <button
                type="button"
                id="btn-fechar-carrinho"
                onClick={() => setCarrinhoAberto(false)}
                className="rounded-xl p-2 transition hover:bg-superficie-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Itens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrinho.length === 0 ? (
                <p className="py-10 text-center text-sm text-texto-suave">
                  Seu carrinho está vazio.
                </p>
              ) : (
                carrinho.map((item) => (
                  <div
                    key={item.produtoId}
                    className="flex items-center gap-3 rounded-xl border p-3 group"
                    style={{ borderColor: "var(--borda)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-sm">
                        {item.nome}
                      </p>
                      <p className="text-xs text-texto-suave tabular-nums">
                        {brl(item.precoUn)} × {item.cx * item.unPorCaixa + item.un} ={" "}
                        <strong>{brl(item.precoUn * (item.cx * item.unPorCaixa + item.un))}</strong>
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setCarrinho(prev => prev.filter(i => i.produtoId !== item.produtoId))}
                      className="text-red-500/50 hover:text-red-500 transition-colors p-1"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {item.unPorCaixa > 1 && (
                        <div className="flex items-center rounded border border-acento overflow-hidden h-7">
                          <span className="text-[9px] uppercase font-bold text-acento px-1.5 bg-acento/10 h-full flex items-center">Cx</span>
                          <button
                            type="button"
                            onClick={() => alterarQtd(item.produtoId, -1, 0, item.nome, item.precoUn, item.unPorCaixa)}
                            className="flex h-full w-6 items-center justify-center text-acento transition hover:bg-superficie-2"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-[10px] font-bold tabular-nums text-acento">{item.cx}</span>
                          <button
                            type="button"
                            onClick={() => alterarQtd(item.produtoId, 1, 0, item.nome, item.precoUn, item.unPorCaixa)}
                            className="flex h-full w-6 items-center justify-center text-acento transition hover:bg-superficie-2"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <div className={`flex items-center rounded border overflow-hidden h-7 ${item.unPorCaixa > 1 ? "border-borda" : "border-acento bg-acento/5"}`}>
                        {item.unPorCaixa > 1 && <span className="text-[9px] uppercase font-bold text-texto-suave px-1.5 bg-superficie-2 h-full flex items-center">Un</span>}
                        <button
                          type="button"
                          onClick={() => alterarQtd(item.produtoId, 0, -1, item.nome, item.precoUn, item.unPorCaixa)}
                          className={`flex h-full w-6 items-center justify-center transition hover:bg-superficie-2`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-[10px] font-bold tabular-nums">{item.un}</span>
                        <button
                          type="button"
                          onClick={() => alterarQtd(item.produtoId, 0, 1, item.nome, item.precoUn, item.unPorCaixa)}
                          className={`flex h-full w-6 items-center justify-center transition hover:bg-superficie-2`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rodapé drawer */}
            {carrinho.length > 0 && (
              <div
                className="border-t p-4 space-y-3"
                style={{ borderColor: "var(--borda)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-texto-suave">Total</span>
                  <span className="text-2xl font-black tabular-nums text-acento">
                    {brl(totalValor)}
                  </span>
                </div>

                {etapa !== "formulario" && (
                  <button
                    id="btn-finalizar-pedido"
                    type="button"
                    onClick={() => {
                      setCarrinhoAberto(false);
                      setEtapa("formulario");
                    }}
                    className="btn-primario w-full text-base py-3"
                  >
                    Finalizar Pedido
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Modal de Formulário ─── */}
      {etapa === "formulario" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90dvh] overflow-y-auto"
            style={{ background: "var(--superficie)" }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-6 py-4 sticky top-0"
              style={{
                background: "var(--superficie)",
                borderColor: "var(--borda)",
              }}
            >
              <div>
                <h2 className="text-lg font-black">Seus Dados</h2>
                <p className="text-xs text-texto-suave">
                  Precisamos dessas informações para confirmar seu pedido
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEtapa("catalogo")}
                className="rounded-xl p-2 transition hover:bg-superficie-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void finalizarPedido();
              }}
              className="p-6 space-y-4"
            >
              {/* Resumo do pedido */}
              <div
                className="rounded-2xl border p-4 space-y-2"
                style={{ borderColor: "var(--borda)", background: "var(--superficie-2)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">
                  Resumo do pedido
                </p>
                {carrinho.map((item) => {
                  const totalUnidades = item.cx * item.unPorCaixa + item.un;
                  const resumoStr = [];
                  if (item.cx > 0) resumoStr.push(`${item.cx}cx`);
                  if (item.un > 0 || item.cx === 0) resumoStr.push(`${item.un}un`);
                  return (
                    <div
                      key={item.produtoId}
                      className="flex justify-between text-sm"
                    >
                      <span>
                        {resumoStr.join(" + ")} {item.nome}
                      </span>
                      <span className="tabular-nums font-semibold">
                        {brl(item.precoUn * totalUnidades)}
                      </span>
                    </div>
                  );
                })}
                <div
                  className="flex justify-between border-t pt-2 font-black"
                  style={{ borderColor: "var(--borda)" }}
                >
                  <span>Total</span>
                  <span className="tabular-nums text-acento">
                    {brl(totalValor)}
                  </span>
                </div>
              </div>

              {/* Campos obrigatórios */}
              <div>
                <label htmlFor="form-nome" className="rotulo">
                  Nome completo *
                </label>
                <input
                  id="form-nome"
                  className={`campo ${erros.nome ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                  placeholder="Seu nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                />
                {erros.nome && (
                  <p className="mt-1 text-xs text-red-500">{erros.nome}</p>
                )}
              </div>

              <div>
                <label htmlFor="form-telefone" className="rotulo">
                  WhatsApp *
                </label>
                <input
                  id="form-telefone"
                  type="tel"
                  className={`campo ${erros.telefone ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                  placeholder="(22) 99999-9999"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  autoComplete="tel"
                />
                {erros.telefone && (
                  <p className="mt-1 text-xs text-red-500">{erros.telefone}</p>
                )}
              </div>

              <div>
                <label htmlFor="form-local" className="rotulo">
                  Local do evento *
                </label>
                <input
                  id="form-local"
                  className={`campo ${erros.localEvento ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}`}
                  placeholder="Ex: Salão Brilha Fest — Rua das Flores, 123"
                  value={localEvento}
                  onChange={(e) => setLocalEvento(e.target.value)}
                />
                {erros.localEvento && (
                  <p className="mt-1 text-xs text-red-500">
                    {erros.localEvento}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="form-data" className="rotulo">
                  Data do evento (opcional)
                </label>
                <input
                  id="form-data"
                  type="date"
                  className="campo"
                  value={dataEvento}
                  onChange={(e) => setDataEvento(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="form-obs" className="rotulo">
                  Observações (opcional)
                </label>
                <textarea
                  id="form-obs"
                  className="campo min-h-[80px] resize-none"
                  placeholder="Algum detalhe importante sobre seu pedido?"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />
              </div>

              <button
                id="btn-enviar-pedido"
                type="submit"
                disabled={salvando}
                className="btn-primario w-full text-base py-3.5"
              >
                {salvando ? "Enviando…" : "Confirmar Pedido"}
              </button>

              <p className="text-center text-xs text-texto-suave">
                Ao confirmar, nossa equipe entrará em contato pelo WhatsApp para
                finalizar os detalhes.
              </p>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal de Opção de Caixa ─── */}
      {produtoCaixa && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProdutoCaixa(null)} />
          <div
            className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 overflow-hidden"
            style={{ background: "var(--superficie)" }}
          >
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: "var(--borda)" }}
            >
              <h2 className="text-lg font-black">Ótima escolha! 🍻</h2>
              <button
                type="button"
                onClick={() => setProdutoCaixa(null)}
                className="rounded-xl p-2 transition hover:bg-superficie-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-xl flex items-center justify-center p-1 border border-borda shrink-0" style={{ background: "radial-gradient(circle at center, #ffffff 0%, #f1f5f9 100%)" }}>
                  {produtoCaixa.imagemUrl ? (
                    <ProdutoImagem
                      src={produtoCaixa.imagemUrl}
                      alt={produtoCaixa.nome}
                      width={56}
                      height={56}
                      className="h-full w-full object-contain mix-blend-multiply"
                      fallback={<span className="text-2xl">🍺</span>}
                    />
                  ) : <span className="text-2xl">🍺</span>}
                </div>
                <div>
                  <p className="font-bold leading-tight">{produtoCaixa.nome}</p>
                  <p className="text-sm text-texto-suave">Como você prefere levar esse produto?</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  alterarQtd(produtoCaixa.id, 0, 1, produtoCaixa.nome, precoDe(produtoCaixa), produtoCaixa.unPorCaixa);
                  setProdutoCaixa(null);
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl border transition hover:bg-superficie-2 hover:border-acento group"
                style={{ borderColor: "var(--borda)" }}
              >
                <div className="text-left">
                  <p className="font-bold group-hover:text-acento transition-colors">Unidade avulsa</p>
                  <p className="text-xs text-texto-suave">1 unidade</p>
                </div>
                <span className="font-black text-lg">{brl(precoDe(produtoCaixa))}</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  alterarQtd(produtoCaixa.id, 1, 0, produtoCaixa.nome, precoDe(produtoCaixa), produtoCaixa.unPorCaixa);
                  setProdutoCaixa(null);
                }}
                className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-acento bg-acento/5 transition hover:bg-acento/10"
              >
                <div className="text-left">
                  <p className="font-bold text-acento">Caixa fechada</p>
                  <p className="text-xs text-acento/70">{produtoCaixa.unPorCaixa} unidades</p>
                </div>
                <span className="font-black text-lg text-acento">{brl(precoDe(produtoCaixa) * produtoCaixa.unPorCaixa)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé */}
      <footer
        className="mt-10 border-t px-4 py-6 text-center text-xs text-texto-suave"
        style={{ borderColor: "var(--borda)" }}
      >
        {EMPRESA.nome} · preços sujeitos a alteração sem aviso prévio
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tela de confirmação                                                          */
/* -------------------------------------------------------------------------- */

function TelaConfirmacao({ numero }: { numero: number }) {
  const whatsapp = EMPRESA.telefone.replace(/\D/g, "");
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--fundo)" }}
    >
      <div className="flex flex-col items-center gap-5 max-w-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>

        <div>
          <h1 className="text-3xl font-black">Pedido Enviado!</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Pedido{" "}
            <strong className="text-acento font-black">
              #{String(numero).padStart(4, "0")}
            </strong>{" "}
            recebido com sucesso
          </p>
        </div>

        <div
          className="w-full rounded-2xl border p-5 text-left space-y-2"
          style={{ borderColor: "var(--borda)", background: "var(--superficie)" }}
        >
          <p className="text-sm font-semibold">O que acontece agora?</p>
          <ol className="space-y-1.5 text-sm text-texto-suave list-decimal list-inside">
            <li>Nossa equipe vai receber seu pedido</li>
            <li>Entraremos em contato pelo WhatsApp para confirmar</li>
            <li>Combinamos a entrega para seu evento!</li>
          </ol>
        </div>

        {whatsapp && (
          <a
            href={`https://wa.me/55${whatsapp}?text=${encodeURIComponent(
              `Olá! Acabei de fazer o pedido #${String(numero).padStart(4, "0")} pelo site. Pode me confirmar?`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primario w-full py-3 text-base"
          >
            Falar no WhatsApp
          </a>
        )}

        <a
          href="/pedido"
          className="text-sm font-semibold text-acento underline-offset-4 hover:underline"
        >
          Fazer outro pedido
        </a>
      </div>
    </div>
  );
}
