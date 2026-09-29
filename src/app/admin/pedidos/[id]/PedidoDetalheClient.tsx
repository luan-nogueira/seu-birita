"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { rotaRelatorio, rotaRomaneio, useIdPedido } from "@/lib/rotas";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ClipboardList,
  CloudUpload,
  FileText,
  History,
  Layers,
  Plus,
  Search,
  Share2,
  Trash2,
  Wallet,
} from "lucide-react";
import { Modal, StatusChip, TipoChip } from "@/components/ui";
import { CampoQtd } from "@/components/CampoQtd";
import { Protegido } from "@/components/Protegido";
import { useAuth } from "@/lib/auth";
import { useDados, novoId } from "@/lib/store";
import { aplicarAjusteEstoque, efeitoLancado, reverterEstoquePedido } from "@/lib/estoque";
import {
  calcularTotais,
  compararCategorias,
  devolvidoUn,
  efeitoEstoque,
  entregueUn,
  sobraUn,
  novoItem,
  precoDaTabela,
  saldoUn,
  totalRemessas,
  valorFinalItem,
  valorPedidoItem,
} from "@/lib/calc";
import {
  brl,
  brlOuTraco,
  dataBR,
  hojeISO,
  normalizar,
  num,
  paraCampo,
  paraNumero,
} from "@/lib/format";
import type {
  FormaPagamento,
  Pedido,
  PedidoItem,
  PedidoStatus,
  PedidoTipo,
} from "@/lib/types";

// "Aguardando acerto" = a devolução do evento já foi conferida e lançada,
// falta só fechar a conta com o cliente. Também entra sozinho quando um
// rascunho recebe pagamento parcial.
const STATUS_DISPONIVEIS: PedidoStatus[] = [
  "RASCUNHO",
  "ENTREGUE",
  "ACERTO",
  "FINALIZADO",
  "CANCELADO",
];

const ROTULO_STATUS: Record<PedidoStatus, string> = {
  RASCUNHO: "Rascunho",
  ENTREGUE: "Entregue",
  ACERTO: "Aguardando acerto",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export default function PedidoPage() {
  // A tela é a mesma pra todo pedido (o id vem do ?id=): a key força
  // recomeçar do zero ao trocar de pedido, senão o estado local e a
  // baseline de estoque do anterior seriam reaproveitados.
  const id = useIdPedido();
  return (
    <Protegido chave="pedidos">
      <PedidoPageInterno key={id} />
    </Protegido>
  );
}

function PedidoPageInterno() {
  const id = useIdPedido();
  const router = useRouter();
  const { permissoes } = useAuth();
  const {
    pedidoPorId,
    salvarPedido,
    removerPedido,
    pagamentos,
    pedidos,
    removerPagamento,
    produtoPorId,
    salvarProduto,
    salvarMovimento,
    movimentos,
    removerMovimento,
    carregando,
  } = useDados();

  const remoto = pedidoPorId(id);

  // Enquanto se edita, o estado local manda. O remoto só semeia a primeira
  // carga — assim uma sincronização do Firestore não apaga o que está
  // sendo digitado no meio do acerto.
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [excluindoItem, setExcluindoItem] = useState<{ indice: number; nome: string } | null>(null);
  const semeado = useRef(false);

  // Última "foto" do que este pedido já tirou do estoque — a baseline pra
  // calcular o que mudou (delta) e lançar só a diferença a cada salvamento.
  const ultimoEstoqueAplicado = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    // Espera tudo carregar: a baseline de estoque vem dos movimentos.
    if (!semeado.current && remoto && !carregando) {
      setPedido(remoto);
      ultimoEstoqueAplicado.current =
        efeitoLancado(movimentos, remoto.id) ?? efeitoEstoque(remoto);
      semeado.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoto, carregando]);

  const deps = { produtoPorId, salvarProduto, salvarMovimento };

  // Salvamento automático com uma pausa, pra não gravar a cada tecla.
  // Só grava se o conteúdo mudou de verdade desde a última gravação — sem
  // isso, qualquer re-render que recriasse o objeto do pedido virava uma
  // gravação, e cada gravação volta pra todos os aparelhos pelo Firestore.
  const ultimoConteudoSalvo = useRef<string | null>(null);
  useEffect(() => {
    if (!pedido) return;
    const conteudo = JSON.stringify({
      ...pedido,
      atualizadoEm: undefined,
      valorPedido: undefined,
      valorFinal: undefined,
    });
    if (ultimoConteudoSalvo.current === null) {
      // Primeira carga: é o que já está salvo, nada a gravar.
      ultimoConteudoSalvo.current = conteudo;
      return;
    }
    if (conteudo === ultimoConteudoSalvo.current) {
      setSalvando(false);
      return;
    }
    setSalvando(true);
    const t = setTimeout(async () => {
      ultimoConteudoSalvo.current = conteudo;
      const totais = calcularTotais(pedido);
      await salvarPedido({
        ...pedido,
        valorPedido: totais.valorPedido,
        valorFinal: totais.valorFinal,
        atualizadoEm: new Date().toISOString(),
      });

      const efeitoNovo = efeitoEstoque(pedido);
      await aplicarAjusteEstoque(
        ultimoEstoqueAplicado.current ?? new Map(),
        efeitoNovo,
        pedido.id,
        deps,
      );
      ultimoEstoqueAplicado.current = efeitoNovo;

      setSalvando(false);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, salvarPedido]);

  if (carregando || (!pedido && !semeado.current)) {
    return <p className="p-6 text-sm text-texto-suave">Carregando pedido…</p>;
  }

  if (!pedido) {
    return (
      <div className="p-6">
        <p className="font-bold">Pedido não encontrado.</p>
        <Link href="/admin/pedidos" className="btn-secundario mt-4">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    );
  }

  const totais = calcularTotais(pedido);
  const consignacao = pedido.tipo === "CONSIGNACAO";
  const remessas = totalRemessas(pedido.itens);

  // Agrupa os itens por categoria (mesmo padrão do seletor de produtos e do
  // estoque), preservando o índice original — é por ele que atualizarItem/
  // removerItem acham o item certo dentro de pedido.itens.
  const gruposPorCategoria = new Map<
    string,
    { item: PedidoItem; indice: number }[]
  >();
  pedido.itens.forEach((item, indice) => {
    const categoria = produtoPorId(item.produtoId)?.categoria || "Sem categoria";
    if (!gruposPorCategoria.has(categoria)) gruposPorCategoria.set(categoria, []);
    gruposPorCategoria.get(categoria)!.push({ item, indice });
  });
  const categoriasItens = Array.from(gruposPorCategoria.entries()).sort(([a], [b]) =>
    compararCategorias(a, b),
  );

  function atualizar(mudanca: Partial<Pedido>) {
    setPedido((p) => (p ? { ...p, ...mudanca } : p));
  }

  function atualizarItem(indice: number, mudanca: Partial<PedidoItem>) {
    setPedido((p) => {
      if (!p) return p;
      const itens = [...p.itens];
      itens[indice] = { ...itens[indice], ...mudanca };
      return { ...p, itens };
    });
  }

  function removerItem(indice: number) {
    setPedido((p) =>
      p ? { ...p, itens: p.itens.filter((_, i) => i !== indice) } : p,
    );
  }

  function pedirRemocaoItem(indice: number) {
    if (!pedido) return;
    setExcluindoItem({ indice, nome: pedido.itens[indice].nome });
  }

  function confirmarRemocaoItem() {
    if (!excluindoItem) return;
    removerItem(excluindoItem.indice);
    setExcluindoItem(null);
  }

  function adicionarRemessa() {
    setPedido((p) => {
      if (!p) return p;
      const proxima = totalRemessas(p.itens) + 1;
      return {
        ...p,
        itens: p.itens.map((i) => ({
          ...i,
          entregas: [...i.entregas, { numero: proxima, cx: 0, un: 0 }],
        })),
      };
    });
  }

  function solicitarExclusaoPedido() {
    setModalExcluirAberto(true);
  }

  async function confirmarExclusaoPedido() {
    // Sem isso, os pagamentos ficam órfãos e continuam contando no
    // Financeiro mesmo depois do pedido excluído.
    const pagamentosDoPedido = pagamentos.filter((p) => p.pedidoId === pedido!.id);
    for (const p of pagamentosDoPedido) {
      await removerPagamento(p.id);
    }

    // Devolve pro estoque tudo que este pedido tinha tirado e apaga o
    // rastro dele no histórico — senão fica movimentação de um pedido
    // excluído aparecendo no Estoque.
    await reverterEstoquePedido(
      ultimoEstoqueAplicado.current ?? efeitoEstoque(pedido!),
      pedido!.id,
      { produtoPorId, salvarProduto, movimentos, removerMovimento },
    );

    await removerPedido(pedido!.id);
    router.push("/admin/pedidos");
  }

  return (
    <>
      {/* Cabeçalho fixo com as ações principais */}
      <div className="sticky top-0 z-20 border-b border-borda bg-fundo/95 backdrop-blur md:top-0">
        <div className="flex items-center gap-2 px-4 py-3 md:px-6">
          <Link
            href="/admin/pedidos"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
            aria-label="Voltar para a lista"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold leading-tight">
              {pedido.clienteNome}
            </p>
            <p className="truncate text-xs text-texto-suave">
              #{String(pedido.numero).padStart(3, "0")} ·{" "}
              {dataBR(pedido.dataEvento)}
              {pedido.titulo && ` · ${pedido.titulo}`}
            </p>
          </div>

          <IndicadorSalvamento salvando={salvando} />

          <Link
            href={rotaRomaneio(pedido.id)}
            className="btn-secundario shrink-0 px-3"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Romaneio</span>
          </Link>

          <Link
            href={rotaRelatorio(pedido.id)}
            className="btn-primario shrink-0 px-3"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Relatório</span>
          </Link>
        </div>
      </div>

      <div className="space-y-5 px-4 py-5 md:px-6">
        <BarraStatus
          pedido={pedido}
          aoMudarStatus={(status) => atualizar({ status })}
          aoMudarTipo={(tipo) => atualizar({ tipo })}
        />

        <Resumo pedido={pedido} totais={totais} />

        {/* ------------------------------- Itens ------------------------------- */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold">
              Itens{" "}
              <span className="text-sm font-normal text-texto-suave">
                ({pedido.itens.length})
              </span>
            </h2>
            <div className="ml-auto flex gap-2">
              {consignacao && pedido.itens.length > 0 && (
                <button className="btn-secundario" onClick={adicionarRemessa}>
                  <Layers className="h-4 w-4" />
                  <span className="hidden sm:inline">Nova remessa</span>
                </button>
              )}
              <ImportarDevolucao
                pedido={pedido}
                pedidos={pedidos}
                aoMudar={atualizar}
              />
              <SeletorProdutos
                pedido={pedido}
                aoAdicionar={(itens) =>
                  atualizar({ itens: [...pedido.itens, ...itens] })
                }
              />
            </div>
          </div>

          {pedido.itens.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="font-semibold">Nenhum item ainda</p>
              <p className="mt-1 text-sm text-texto-suave">
                Adicione os produtos que saíram do galpão pra este evento.
              </p>
            </div>
          ) : (
            <>
              {/* Celular: um cartão por produto, agrupado por categoria */}
              <div className="space-y-4 md:hidden">
                {categoriasItens.map(([categoria, grupo]) => (
                  <div key={categoria}>
                    <p className="mb-1.5 text-[11px] font-bold tracking-wide text-texto-suave uppercase">
                      {categoria}
                    </p>
                    <ul className="space-y-2">
                      {grupo.map(({ item, indice }) => (
                        <CartaoItem
                          key={`${item.produtoId}-${indice}`}
                          item={item}
                          consignacao={consignacao}
                          aoMudar={(m) => atualizarItem(indice, m)}
                          aoRemover={() => pedirRemocaoItem(indice)}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Desktop: a planilha, só que legível, agrupada por categoria */}
              <div className="hidden md:block">
                <TabelaItens
                  categorias={categoriasItens}
                  remessas={remessas}
                  consignacao={consignacao}
                  aoMudarItem={atualizarItem}
                  aoRemoverItem={pedirRemocaoItem}
                />
              </div>
            </>
          )}
        </section>

        <Fechamento
          pedido={pedido}
          totais={totais}
          aoMudar={atualizar}
        />

        <div className="flex flex-wrap gap-2 border-t border-borda pt-5">
          <button
            type="button"
            className="btn-secundario"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Voltar ao topo"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clipRule="evenodd" />
            </svg>
            Topo
          </button>
          <CompartilharWhatsApp pedido={pedido} />
          {permissoes.excluir && (
            <button className="btn-perigo ml-auto" onClick={solicitarExclusaoPedido}>
              <Trash2 className="h-4 w-4" />
              Excluir pedido
            </button>
          )}
        </div>
      </div>

      <Modal
        aberto={modalExcluirAberto}
        aoFechar={() => setModalExcluirAberto(false)}
        titulo="Excluir pedido"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setModalExcluirAberto(false)}
            >
              Cancelar
            </button>
            <button className="btn-perigo" onClick={confirmarExclusaoPedido}>
              Excluir pedido
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          Tem certeza que deseja excluir o pedido de{" "}
          <strong className="text-texto">{pedido.clienteNome}</strong>? Esta ação
          não pode ser desfeita.
        </p>
      </Modal>

      <Modal
        aberto={!!excluindoItem}
        aoFechar={() => setExcluindoItem(null)}
        titulo="Remover item"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setExcluindoItem(null)}
            >
              Cancelar
            </button>
            <button className="btn-perigo" onClick={confirmarRemocaoItem}>
              Remover item
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          Tem certeza que deseja remover o produto <strong>{excluindoItem?.nome}</strong> do pedido?
        </p>
      </Modal>
    </>
  );
}

function IndicadorSalvamento({ salvando }: { salvando: boolean }) {
  return (
    <span
      className="hidden shrink-0 items-center gap-1.5 text-xs text-texto-suave sm:flex"
      aria-live="polite"
    >
      {salvando ? (
        <>
          <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
          salvando…
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          salvo
        </>
      )}
    </span>
  );
}

function BarraStatus({
  pedido,
  aoMudarStatus,
  aoMudarTipo,
}: {
  pedido: Pedido;
  aoMudarStatus: (s: PedidoStatus) => void;
  aoMudarTipo: (t: PedidoTipo) => void;
}) {
  const [aviso, setAviso] = useState("");
  const [trocandoTipo, setTrocandoTipo] = useState(false);
  const novoTipo: PedidoTipo =
    pedido.tipo === "CONSIGNACAO" ? "VENDA_DIRETA" : "CONSIGNACAO";
  const temDevolucao = pedido.itens.some((i) => i.devolucaoCx > 0 || i.devolucaoUn > 0);
  const saldoAberto = calcularTotais(pedido).saldoAberto;

  function escolher(s: PedidoStatus) {
    // Finalizado é "conta fechada" — com valor em aberto o certo é
    // Aguardando acerto, senão o pedido parece quitado sem estar. Quando o
    // pagamento fecha o total, o pedido já vira Finalizado sozinho.
    if (s === "FINALIZADO" && pedido.status !== "FINALIZADO" && saldoAberto > 0.005) {
      setAviso(
        `Ainda falta receber ${brl(saldoAberto)}. Registre o pagamento — quando fechar o total, o pedido finaliza sozinho. Se for dar desconto, lance o desconto e depois toque em Finalizado.`,
      );
      return;
    }
    setAviso("");
    aoMudarStatus(s);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTrocandoTipo(true)}
          className="flex items-center gap-1 rounded-full transition hover:opacity-80"
          aria-label="Trocar tipo do pedido"
        >
          <TipoChip tipo={pedido.tipo} />
          <ArrowLeftRight className="h-3.5 w-3.5 text-texto-suave" />
        </button>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {STATUS_DISPONIVEIS.filter(
            // Voltar pra rascunho só antes de receber algum pagamento — senão o
            // pedido some do financeiro com dinheiro já recebido.
            (s) => s !== "RASCUNHO" || pedido.status === "RASCUNHO" || !(pedido.valorPago > 0),
          ).map((s) => {
            const bloqueado =
              s === "FINALIZADO" && pedido.status !== "FINALIZADO" && saldoAberto > 0.005;
            return (
              <button
                key={s}
                onClick={() => escolher(s)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  pedido.status === s
                    ? "bg-acento text-acento-texto"
                    : "border border-borda bg-superficie text-texto-suave hover:bg-superficie-2"
                } ${bloqueado ? "opacity-50" : ""}`}
              >
                {ROTULO_STATUS[s]}
              </button>
            );
          })}
        </div>
      </div>
      {aviso && (
        <p className="rounded-lg border border-ouro-300 bg-ouro-50 px-3 py-2 text-xs dark:bg-ouro-900/20">
          {aviso}
        </p>
      )}

      <Modal
        aberto={trocandoTipo}
        aoFechar={() => setTrocandoTipo(false)}
        titulo="Trocar tipo do pedido"
        rodape={
          <>
            <button className="btn-secundario" onClick={() => setTrocandoTipo(false)}>
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={() => {
                aoMudarTipo(novoTipo);
                setTrocandoTipo(false);
              }}
            >
              Trocar para {novoTipo === "CONSIGNACAO" ? "Consignação" : "Venda direta"}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-texto-suave">
          <p>
            Mudar este pedido de{" "}
            <strong>{pedido.tipo === "CONSIGNACAO" ? "Consignação" : "Venda direta"}</strong> para{" "}
            <strong>{novoTipo === "CONSIGNACAO" ? "Consignação" : "Venda direta"}</strong>?
          </p>
          {novoTipo === "CONSIGNACAO" ? (
            <p>Vai aparecer o campo de devolução em cada item, pra lançar o que voltou do evento.</p>
          ) : (
            <p>
              Em venda direta não existe devolução: o cliente paga tudo o que foi entregue.
              {temDevolucao &&
                " As devoluções já lançadas deixam de contar (valor e estoque), mas ficam guardadas — se voltar pra Consignação, elas voltam."}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function Resumo({
  pedido,
  totais,
}: {
  pedido: Pedido;
  totais: ReturnType<typeof calcularTotais>;
}) {
  const consignacao = pedido.tipo === "CONSIGNACAO";
  const { permissoes } = useAuth();

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      <div className="card px-4 py-3">
        <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
          Mercadoria entregue
        </p>
        <p className="mt-1 text-xl font-black tabular-nums">
          {brl(totais.valorPedido)}
        </p>
        <p className="mt-0.5 text-xs text-texto-suave">
          {num(totais.unidadesEntregues)} un
        </p>
      </div>

      {consignacao && (
        <div className="card px-4 py-3">
          <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
            Devolvido
          </p>
          <p className="mt-1 text-xl font-black tabular-nums">
            {brl(totais.valorPedido - totais.valorFinal)}
          </p>
          <p className="mt-0.5 text-xs text-texto-suave">
            {num(totais.unidadesDevolvidas)} un
          </p>
        </div>
      )}

      <div className="card px-4 py-3">
        <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
          {consignacao ? "Consumo" : "Total vendido"}
        </p>
        <p className="mt-1 text-xl font-black tabular-nums">
          {brl(totais.valorFinal)}
        </p>
        <p className="mt-0.5 text-xs text-texto-suave">
          {num(totais.unidadesConsumidas)} un
        </p>
      </div>

      <div
        className={`card px-4 py-3 ${
          totais.saldoAberto > 0.005
            ? "border-acento/50 bg-acento/5"
            : "border-emerald-500/40 bg-emerald-500/5"
        }`}
      >
        <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
          {totais.saldoAberto > 0.005 ? "A receber" : "Quitado"}
        </p>
        <p
          className={`mt-1 text-xl font-black tabular-nums ${
            totais.saldoAberto > 0.005 ? "text-acento" : "text-emerald-600"
          }`}
        >
          {brl(Math.max(0, totais.saldoAberto))}
        </p>
        <p className="mt-0.5 text-xs text-texto-suave">
          total {brl(totais.totalReceber)}
        </p>
      </div>

      {permissoes.verCusto && (
        <div className="card px-4 py-3 border-emerald-500/40 bg-emerald-500/10 col-span-2 lg:col-span-1">
          <p className="text-[11px] font-semibold tracking-wide text-emerald-800 dark:text-emerald-400 uppercase">
            {pedido.status === "FINALIZADO" || pedido.status === "ACERTO" ? "Lucro do Evento" : "Lucro Previsto"}
          </p>
          <p className="mt-1 text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-500">
            {brl(totais.lucro)}
          </p>
          <p className="mt-0.5 text-xs text-emerald-600/80 dark:text-emerald-500/80">
            Custo total: {brl(totais.custoTotal)}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Item no celular ---------------------------- */

function CartaoItem({
  item,
  consignacao,
  aoMudar,
  aoRemover,
}: {
  item: PedidoItem;
  consignacao: boolean;
  aoMudar: (m: Partial<PedidoItem>) => void;
  aoRemover: () => void;
}) {
  const tipo = consignacao ? "CONSIGNACAO" : "VENDA_DIRETA";
  const entregue = entregueUn(item);
  const devolvido = devolvidoUn(item, tipo);
  const saldo = saldoUn(item, tipo);
  const excedeu = devolvido > entregue;

  function mudarEntrega(indice: number, campo: "cx" | "un", valor: number): void;
  function mudarEntrega(indice: number, campo: "data", valor: string): void;
  function mudarEntrega(
    indice: number,
    campo: "cx" | "un" | "data",
    valor: number | string,
  ) {
    const entregas = item.entregas.map((e, i) =>
      i === indice ? { ...e, [campo]: valor } : e,
    );
    aoMudar({ entregas });
  }

  return (
    <li className="card p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{item.nome}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <CampoPrecoInline valor={item.precoUn} aoMudar={(v) => aoMudar({ precoUn: v })} />
            <span className="text-xs text-texto-suave">/un {item.unPorCaixa > 1 && ` · ${item.unPorCaixa} un/cx`}</span>
          </div>
        </div>
        <button
          onClick={aoRemover}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-texto-suave transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          aria-label={`Remover ${item.nome}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {(item.sobraCx !== undefined || item.sobraUn !== undefined) && (
          <LinhaQtd
            rotulo="Sobra ant."
            nomeItem={item.nome}
            cx={item.sobraCx ?? 0}
            un={item.sobraUn ?? 0}
            unPorCaixa={item.unPorCaixa}
            aoMudarCx={(v) => aoMudar({ sobraCx: v })}
            aoMudarUn={(v) => aoMudar({ sobraUn: v })}
          />
        )}
        {item.entregas.map((e, i) => (
          <div key={i} className="space-y-1">
            <LinhaQtd
              rotulo={
                item.entregas.length > 1 ? `Entrega ${e.numero}` : "Entrega"
              }
              nomeItem={item.nome}
              cx={e.cx}
              un={e.un}
              unPorCaixa={item.unPorCaixa}
              aoMudarCx={(v) => mudarEntrega(i, "cx", v)}
              aoMudarUn={(v) => mudarEntrega(i, "un", v)}
            />
            {item.entregas.length > 1 && (
              <div className="flex items-center gap-2 pl-[84px]">
                <span className="text-[10px] text-texto-suave uppercase font-semibold">
                  Data
                </span>
                <input
                  type="date"
                  className="rounded border border-borda bg-superficie-2 px-2 py-0.5 text-[11px] text-texto outline-none focus:border-acento transition"
                  value={e.data ?? ""}
                  onChange={(ev) =>
                    mudarEntrega(i, "data", ev.target.value)
                  }
                  aria-label={`Data da entrega ${e.numero} de ${item.nome}`}
                />
              </div>
            )}
          </div>
        ))}

        {consignacao && (
          <LinhaQtd
            rotulo="Devolução"
            nomeItem={item.nome}
            cx={item.devolucaoCx}
            un={item.devolucaoUn}
            unPorCaixa={item.unPorCaixa}
            aoMudarCx={(v) => aoMudar({ devolucaoCx: v })}
            aoMudarUn={(v) => aoMudar({ devolucaoUn: v })}
            alerta={excedeu}
            variante="devolucao"
          />
        )}
      </div>

      {excedeu && (
        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
          Devolução maior que a entrega — confira as quantidades.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-borda pt-2.5">
        <span className="text-xs font-semibold text-texto-suave uppercase">
          {consignacao ? "Consumo" : "Total"}
        </span>
        <span className="text-right">
          <span className="text-sm text-texto-suave tabular-nums">
            {num(saldo)} un ·{" "}
          </span>
          <span className="font-black tabular-nums">
            {brl(valorFinalItem(item, tipo))}
          </span>
        </span>
      </div>
    </li>
  );
}

function LinhaQtd({
  rotulo,
  nomeItem,
  cx,
  un,
  unPorCaixa,
  aoMudarCx,
  aoMudarUn,
  alerta = false,
  variante,
}: {
  rotulo: string;
  nomeItem: string;
  cx: number;
  un: number;
  unPorCaixa: number;
  aoMudarCx: (v: number) => void;
  aoMudarUn: (v: number) => void;
  alerta?: boolean;
  variante?: "devolucao";
}) {
  const total = cx * unPorCaixa + un;
  const isDevolucao = variante === "devolucao";
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-1.5 py-0.5 -mx-1.5 ${
        isDevolucao
          ? "bg-red-50 dark:bg-red-950/30"
          : ""
      }`}
    >
      <span
        className={`w-20 shrink-0 text-[11px] font-bold uppercase ${
          alerta || isDevolucao ? "text-red-600 dark:text-red-400" : "text-texto-suave"
        }`}
      >
        {rotulo}
      </span>
      {unPorCaixa > 1 && (
        <label className="flex flex-1 items-center gap-1">
          <span className="text-[11px] text-texto-suave">cx</span>
          <CampoQtd
            valor={cx}
            aoMudar={aoMudarCx}
            rotulo={`${rotulo} de ${nomeItem} em caixas`}
          />
        </label>
      )}
      <label className="flex flex-1 items-center gap-1">
        <span className="text-[11px] text-texto-suave">un</span>
        <CampoQtd
          valor={un}
          aoMudar={aoMudarUn}
          rotulo={`${rotulo} de ${nomeItem} em unidades avulsas`}
        />
      </label>
      <span
        className={`w-14 shrink-0 text-right text-sm font-bold tabular-nums ${
          isDevolucao ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {num(total)}
      </span>
    </div>
  );
}

function CampoPrecoInline({
  valor,
  aoMudar,
}: {
  valor: number;
  aoMudar: (v: number) => void;
}) {
  const [texto, setTexto] = useState(paraCampo(valor));

  useEffect(() => {
    setTexto(paraCampo(valor));
  }, [valor]);

  return (
    <div className="flex w-24 items-center gap-1 rounded border border-borda bg-superficie-2 px-1.5 py-0.5 transition focus-within:border-acento">
      <span className="text-[10px] text-texto-suave">R$</span>
      <input
        className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold tabular-nums outline-none"
        inputMode="decimal"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => {
          const v = paraNumero(texto);
          setTexto(paraCampo(v));
          if (v !== valor) aoMudar(v);
        }}
      />
    </div>
  );
}

/* ---------------------------- Tabela no desktop --------------------------- */

function TabelaItens({
  categorias,
  remessas,
  consignacao,
  aoMudarItem,
  aoRemoverItem,
}: {
  categorias: [string, { item: PedidoItem; indice: number }[]][];
  remessas: number;
  consignacao: boolean;
  aoMudarItem: (i: number, m: Partial<PedidoItem>) => void;
  aoRemoverItem: (i: number) => void;
}) {
  const tipo = consignacao ? "CONSIGNACAO" : "VENDA_DIRETA";
  const colunasRemessa = Array.from({ length: remessas }, (_, i) => i);
  // Coluna da sobra importada só aparece quando algum item tem sobra.
  const temSobra = categorias.some(([, grupo]) =>
    grupo.some(({ item }) => item.sobraCx !== undefined || item.sobraUn !== undefined),
  );
  const totalColunas = 6 + 3 * remessas + (consignacao ? 3 : 0) + (temSobra ? 3 : 0);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-borda bg-superficie-2 text-[11px] uppercase">
            <th className="px-3 py-2 text-left font-bold">Produto</th>
            {temSobra && (
              <th
                colSpan={3}
                className="border-l border-borda px-3 py-2 text-center font-bold"
                title="Sobra de um evento anterior que já estava no cliente — não entra no romaneio"
              >
                Sobra anterior
              </th>
            )}
            {colunasRemessa.map((i) => (
              <th
                key={i}
                colSpan={3}
                className="border-l border-borda px-3 py-2 text-center font-bold"
              >
                {remessas > 1 ? `Entrega ${i + 1}` : "Entrega"}
              </th>
            ))}
            {consignacao && (
              <th
                colSpan={3}
                className="border-l border-borda px-3 py-2 text-center font-bold"
              >
                Devolução
              </th>
            )}
            <th className="border-l border-borda px-3 py-2 text-right font-bold">
              Saldo
            </th>
            <th className="px-3 py-2 text-right font-bold">Preço</th>
            <th className="px-3 py-2 text-right font-bold">Entregue</th>
            <th className="px-3 py-2 text-right font-bold">Total</th>
            <th className="px-2 py-2" />
          </tr>
          <tr className="border-b border-borda bg-superficie-2 text-[10px] text-texto-suave uppercase">
            <th />
            {temSobra && (
              <>
                <th className="border-l border-borda px-2 py-1">cx</th>
                <th className="px-2 py-1">un</th>
                <th className="px-2 py-1">total</th>
              </>
            )}
            {colunasRemessa.map((i) => (
              <Fragment key={i}>
                <th className="border-l border-borda px-2 py-1">cx</th>
                <th className="px-2 py-1">un</th>
                <th className="px-2 py-1">total</th>
              </Fragment>
            ))}
            {consignacao && (
              <>
                <th className="border-l border-borda px-2 py-1">cx</th>
                <th className="px-2 py-1">un</th>
                <th className="px-2 py-1">total</th>
              </>
            )}
            <th className="border-l border-borda" />
            <th />
            <th />
            <th />
            <th />
          </tr>
        </thead>

        {categorias.map(([categoria, grupo]) => (
        <tbody key={categoria} className="divide-y divide-borda">
          <tr className="bg-superficie-2/60">
            <td
              colSpan={totalColunas}
              className="px-3 py-1.5 text-[10px] font-bold tracking-wide text-texto-suave uppercase"
            >
              {categoria}
            </td>
          </tr>
          {grupo.map(({ item, indice }) => {
            const entregue = entregueUn(item);
            const devolvido = devolvidoUn(item, tipo);
            const saldo = saldoUn(item, tipo);
            const excedeu = devolvido > entregue;

            return (
              <tr
                key={`${item.produtoId}-${indice}`}
                className={excedeu ? "bg-red-50 dark:bg-red-950/20" : ""}
              >
                <td className="px-3 py-2">
                  <p className="font-semibold">{item.nome}</p>
                  {item.unPorCaixa > 1 && (
                    <p className="text-[11px] text-texto-suave">
                      {item.unPorCaixa} un/cx
                    </p>
                  )}
                </td>

                {temSobra &&
                  (item.sobraCx !== undefined || item.sobraUn !== undefined ? (
                    <>
                      <td className="w-20 border-l border-borda px-1.5 py-1.5">
                        <CampoQtd
                          valor={item.sobraCx ?? 0}
                          desabilitado={item.unPorCaixa <= 1}
                          rotulo={`Sobra anterior de ${item.nome} em caixas`}
                          aoMudar={(v) => aoMudarItem(indice, { sobraCx: v })}
                        />
                      </td>
                      <td className="w-20 px-1.5 py-1.5">
                        <CampoQtd
                          valor={item.sobraUn ?? 0}
                          rotulo={`Sobra anterior de ${item.nome} em unidades`}
                          aoMudar={(v) => aoMudarItem(indice, { sobraUn: v })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-texto-suave tabular-nums">
                        {sobraUn(item) || "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border-l border-borda" />
                      <td />
                      <td />
                    </>
                  ))}

                {colunasRemessa.map((r) => {
                  const entrega = item.entregas[r] ?? {
                    numero: r + 1,
                    cx: 0,
                    un: 0,
                  };
                  const totalEntrega =
                    entrega.cx * item.unPorCaixa + entrega.un;
                  return (
                    <Fragment key={r}>
                      <td className="w-20 border-l border-borda px-1.5 py-1.5">
                        <CampoQtd
                          valor={entrega.cx}
                          desabilitado={item.unPorCaixa <= 1}
                          rotulo={`Entrega ${r + 1} de ${item.nome} em caixas`}
                          aoMudar={(v) => {
                            const entregas = [...item.entregas];
                            while (entregas.length <= r) {
                              entregas.push({
                                numero: entregas.length + 1,
                                cx: 0,
                                un: 0,
                              });
                            }
                            entregas[r] = { ...entregas[r], cx: v };
                            aoMudarItem(indice, { entregas });
                          }}
                        />
                      </td>
                      <td className="w-20 px-1.5 py-1.5">
                        <CampoQtd
                          valor={entrega.un}
                          rotulo={`Entrega ${r + 1} de ${item.nome} em unidades`}
                          aoMudar={(v) => {
                            const entregas = [...item.entregas];
                            while (entregas.length <= r) {
                              entregas.push({
                                numero: entregas.length + 1,
                                cx: 0,
                                un: 0,
                              });
                            }
                            entregas[r] = { ...entregas[r], un: v };
                            aoMudarItem(indice, { entregas });
                          }}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right text-texto-suave tabular-nums">
                        {totalEntrega || "—"}
                      </td>
                    </Fragment>
                  );
                })}

                {consignacao && (
                  <>
                    <td className="w-20 border-l border-borda px-1.5 py-1.5">
                      <CampoQtd
                        valor={item.devolucaoCx}
                        desabilitado={item.unPorCaixa <= 1}
                        rotulo={`Devolução de ${item.nome} em caixas`}
                        aoMudar={(v) => aoMudarItem(indice, { devolucaoCx: v })}
                      />
                    </td>
                    <td className="w-20 px-1.5 py-1.5">
                      <CampoQtd
                        valor={item.devolucaoUn}
                        rotulo={`Devolução de ${item.nome} em unidades`}
                        aoMudar={(v) => aoMudarItem(indice, { devolucaoUn: v })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right text-texto-suave tabular-nums">
                      {devolvido || "—"}
                    </td>
                  </>
                )}

                <td className="border-l border-borda px-3 py-2 text-right font-bold tabular-nums">
                  {num(saldo)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end">
                    <CampoPrecoInline valor={item.precoUn} aoMudar={(v) => aoMudarItem(indice, { precoUn: v })} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-texto-suave tabular-nums">
                  {brlOuTraco(valorPedidoItem(item))}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">
                  {brlOuTraco(valorFinalItem(item, tipo))}
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => aoRemoverItem(indice)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-texto-suave transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    aria-label={`Remover ${item.nome}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        ))}
      </table>
    </div>
  );
}

/* ----------------------- Importar devolução anterior ---------------------- */

function temDevolucao(p: Pedido) {
  return p.itens.some((i) => (i.devolucaoCx || 0) > 0 || (i.devolucaoUn || 0) > 0);
}

function qtdTexto(cx: number, un: number, unPorCaixa: number) {
  if (unPorCaixa <= 1) return `${cx + un} un`;
  return [cx > 0 && `${cx} cx`, un > 0 && `${un} un`].filter(Boolean).join(" + ") || "0";
}

/**
 * Traz a devolução de um evento anterior do mesmo cliente como "sobra" dos
 * itens deste pedido. A sobra já está no cliente, então não entra nas
 * entregas nem no romaneio de carga — conta só pro consumo e pro valor.
 */
function ImportarDevolucao({
  pedido,
  pedidos,
  aoMudar,
}: {
  pedido: Pedido;
  pedidos: Pedido[];
  aoMudar: (m: Partial<Pedido>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [escolhidoId, setEscolhidoId] = useState("");
  const [desfazendo, setDesfazendo] = useState(false);

  const candidatos = useMemo(
    () =>
      pedidos
        .filter(
          (p) =>
            p.id !== pedido.id &&
            p.clienteId === pedido.clienteId &&
            p.tipo === "CONSIGNACAO" &&
            p.status !== "CANCELADO" &&
            p.status !== "RASCUNHO" &&
            temDevolucao(p),
        )
        .sort(
          (a, b) =>
            b.dataEvento.localeCompare(a.dataEvento) || b.criadoEm.localeCompare(a.criadoEm),
        ),
    [pedidos, pedido.id, pedido.clienteId],
  );

  const importadoDe = pedido.sobrasDePedidoId
    ? pedidos.find((p) => p.id === pedido.sobrasDePedidoId)
    : undefined;
  const escolhido = candidatos.find((p) => p.id === escolhidoId);
  const numero = (p: Pedido) => `#${String(p.numero).padStart(3, "0")}`;

  if (!pedido.sobrasDePedidoId && candidatos.length === 0) return null;

  function importar() {
    if (!escolhido) return;
    const itens = [...pedido.itens];
    for (const antigo of escolhido.itens) {
      const cx = antigo.devolucaoCx || 0;
      const un = antigo.devolucaoUn || 0;
      if (cx <= 0 && un <= 0) continue;
      const i = itens.findIndex((x) => x.produtoId === antigo.produtoId);
      if (i >= 0) {
        itens[i] = {
          ...itens[i],
          sobraCx: (itens[i].sobraCx ?? 0) + cx,
          sobraUn: (itens[i].sobraUn ?? 0) + un,
        };
      } else {
        itens.push({
          produtoId: antigo.produtoId,
          nome: antigo.nome,
          unPorCaixa: antigo.unPorCaixa,
          precoUn: antigo.precoUn,
          custoUn: antigo.custoUn,
          entregas: [{ numero: 1, cx: 0, un: 0 }],
          devolucaoCx: 0,
          devolucaoUn: 0,
          sobraCx: cx,
          sobraUn: un,
        });
      }
    }
    aoMudar({ itens, sobrasDePedidoId: escolhido.id });
    setAberto(false);
    setEscolhidoId("");
  }

  function desfazer() {
    // Tira a sobra de todos os itens; os que só existiam por causa dela
    // (sem entrega e sem devolução lançadas) saem do pedido.
    const itens = pedido.itens
      .map((i) => ({ ...i, sobraCx: undefined, sobraUn: undefined }))
      .filter(
        (i, idx) =>
          (pedido.itens[idx].sobraCx === undefined && pedido.itens[idx].sobraUn === undefined) ||
          entregueUn(i) > 0 ||
          (i.devolucaoCx || 0) > 0 ||
          (i.devolucaoUn || 0) > 0,
      );
    aoMudar({ itens, sobrasDePedidoId: undefined });
    setDesfazendo(false);
    setAberto(false);
  }

  return (
    <>
      <button className="btn-secundario" onClick={() => setAberto(true)}>
        <History className="h-4 w-4" />
        <span className="hidden sm:inline">
          {pedido.sobrasDePedidoId ? "Devolução importada" : "Importar devolução"}
        </span>
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Importar devolução de um evento"
        rodape={
          pedido.sobrasDePedidoId ? (
            <>
              <button className="btn-secundario" onClick={() => setAberto(false)}>
                Fechar
              </button>
              {desfazendo ? (
                <button className="btn-perigo" onClick={desfazer}>
                  Confirmar: desfazer
                </button>
              ) : (
                <button className="btn-secundario" onClick={() => setDesfazendo(true)}>
                  Desfazer importação
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn-secundario" onClick={() => setAberto(false)}>
                Cancelar
              </button>
              <button className="btn-primario" onClick={importar} disabled={!escolhido}>
                Importar
              </button>
            </>
          )
        }
      >
        {pedido.sobrasDePedidoId ? (
          <div className="space-y-2 text-sm text-texto-suave">
            <p>
              Este pedido já tem a devolução do{" "}
              <strong className="text-texto">
                {importadoDe
                  ? `pedido ${numero(importadoDe)} (${dataBR(importadoDe.dataEvento)})`
                  : "evento anterior"}
              </strong>
              . Ela aparece nos itens como <strong className="text-texto">Sobra anterior</strong>.
            </p>
            <p>
              Desfazer tira a sobra de todos os itens (os que só estavam aqui por causa dela
              saem do pedido).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-texto-suave">
              O que sobrou de um evento anterior e ficou no cliente entra como{" "}
              <strong className="text-texto">Sobra anterior</strong>: conta no consumo e no
              valor, mas não aparece no romaneio de carga.
            </p>
            <ul className="space-y-2">
              {candidatos.map((c) => {
                const usadoPor = pedidos.find(
                  (p) => p.id !== pedido.id && p.sobrasDePedidoId === c.id,
                );
                const itensDev = c.itens.filter(
                  (i) => (i.devolucaoCx || 0) > 0 || (i.devolucaoUn || 0) > 0,
                ).length;
                const selecionado = escolhidoId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={!!usadoPor}
                      onClick={() => setEscolhidoId(c.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50 ${
                        selecionado
                          ? "border-acento bg-acento/10"
                          : "border-borda hover:bg-superficie-2"
                      }`}
                    >
                      <p className="text-sm font-semibold">
                        Pedido {numero(c)} · {dataBR(c.dataEvento)}
                        {c.titulo && ` · ${c.titulo}`}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {usadoPor
                          ? `Já importada no pedido ${numero(usadoPor)}`
                          : `${itensDev} ${itensDev === 1 ? "produto devolvido" : "produtos devolvidos"}`}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
            {escolhido && (
              <ul className="divide-y divide-borda rounded-xl border border-borda text-sm">
                {escolhido.itens
                  .filter((i) => (i.devolucaoCx || 0) > 0 || (i.devolucaoUn || 0) > 0)
                  .map((i) => (
                    <li key={i.produtoId} className="flex justify-between gap-3 px-3 py-1.5">
                      <span className="min-w-0 truncate">{i.nome}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {qtdTexto(i.devolucaoCx || 0, i.devolucaoUn || 0, i.unPorCaixa)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------- Adicionar produtos ---------------------------- */

function SeletorProdutos({
  pedido,
  aoAdicionar,
}: {
  pedido: Pedido;
  aoAdicionar: (itens: PedidoItem[]) => void;
}) {
  const { produtos } = useDados();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [tabelas, setTabelas] = useState<Map<string, 1 | 2 | 3>>(new Map());

  const jaNoPedido = useMemo(
    () => new Set(pedido.itens.map((i) => i.produtoId)),
    [pedido.itens],
  );

  const disponiveis = useMemo(() => {
    const termo = normalizar(busca);
    return produtos
      .filter((p) => p.ativo && !jaNoPedido.has(p.id))
      .filter(
        (p) =>
          !termo ||
          normalizar(p.nome).includes(termo) ||
          normalizar(p.categoria).includes(termo),
      );
  }, [produtos, jaNoPedido, busca]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<string, typeof disponiveis>();
    for (const p of disponiveis) {
      const chave = p.categoria || "Sem categoria";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) =>
      compararCategorias(a, b),
    );
  }, [disponiveis]);

  function alternar(id: string) {
    setMarcados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function confirmar() {
    const itens = produtos
      .filter((p) => marcados.has(p.id))
      .map((p) => {
        const tabela = tabelas.get(p.id) ?? 1;
        return novoItem({ ...p, precoUn: precoDaTabela(p, tabela) });
      });
    aoAdicionar(itens);
    setMarcados(new Set());
    setTabelas(new Map());
    setBusca("");
    setAberto(false);
  }

  return (
    <>
      <button className="btn-primario" onClick={() => setAberto(true)}>
        <Plus className="h-4 w-4" />
        Produtos
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Adicionar produtos"
        largura="max-w-xl"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setAberto(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={confirmar}
              disabled={marcados.size === 0}
            >
              Adicionar {marcados.size > 0 && `(${marcados.size})`}
            </button>
          </>
        }
      >
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
          <input
            className="campo pl-9"
            autoFocus
            placeholder="Buscar produto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {disponiveis.length === 0 ? (
          <p className="py-8 text-center text-sm text-texto-suave">
            {produtos.length === 0
              ? "Nenhum produto cadastrado ainda."
              : "Todos os produtos já estão neste pedido."}
          </p>
        ) : (
          <div className="space-y-4">
            {porCategoria.map(([categoria, itens]) => (
              <div key={categoria}>
                <p className="sticky top-0 -mx-1 bg-superficie px-1 py-1 text-[11px] font-black tracking-wide text-texto-suave uppercase">
                  {categoria}
                </p>
                <ul className="divide-y divide-borda">
                  {itens.map((p) => {
                    const temTabelas = !!(p.precoTabela2 || p.precoTabela3);
                    const tabelaAtual = tabelas.get(p.id) ?? 1;
                    const marcado = marcados.has(p.id);
                    const opcoesTabela = ([1, 2, 3] as const).filter(
                      (t) => t === 1 || (t === 2 && p.precoTabela2) || (t === 3 && p.precoTabela3),
                    );
                    return (
                      <li key={p.id} className="py-2.5">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-5 w-5 shrink-0 accent-[var(--acento)]"
                            checked={marcado}
                            onChange={() => alternar(p.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {p.nome}
                            </span>
                            {p.unPorCaixa > 1 && (
                              <span className="block text-xs text-texto-suave">
                                {p.unPorCaixa} un/cx
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums">
                            {brl(precoDaTabela(p, tabelaAtual))}
                          </span>
                        </label>
                        {marcado && temTabelas && (
                          <div className="mt-1.5 ml-8 flex gap-1">
                            {opcoesTabela.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() =>
                                  setTabelas((m) => new Map(m).set(p.id, t))
                                }
                                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                                  tabelaAtual === t
                                    ? "bg-acento text-acento-texto"
                                    : "bg-superficie-2 text-texto-suave hover:text-texto"
                                }`}
                              >
                                Tabela {t}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}

/* ------------------------------ Fechamento ------------------------------- */

function Fechamento({
  pedido,
  totais,
  aoMudar,
}: {
  pedido: Pedido;
  totais: ReturnType<typeof calcularTotais>;
  aoMudar: (m: Partial<Pedido>) => void;
}) {
  const [desconto, setDesconto] = useState(paraCampo(pedido.desconto));
  const [pendencia, setPendencia] = useState(paraCampo(pedido.pendenciaAnterior));

  return (
    <section className="card p-4">
      <h2 className="mb-4 text-lg font-bold">Fechamento</h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="rotulo" htmlFor="f-desconto">
              Desconto
            </label>
            <input
              id="f-desconto"
              className="campo"
              inputMode="decimal"
              placeholder="0,00"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              onBlur={() => aoMudar({ desconto: paraNumero(desconto) })}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="f-pendencia">
              Pendência anterior (correção manual)
            </label>
            <input
              id="f-pendencia"
              className="campo"
              inputMode="decimal"
              placeholder="0,00"
              value={pendencia}
              onChange={(e) => setPendencia(e.target.value)}
              onBlur={() => aoMudar({ pendenciaAnterior: paraNumero(pendencia) })}
            />
            <p className="mt-1 text-xs text-texto-suave">
              Normalmente fica em 0,00 — a dívida de outros pedidos já soma
              sozinha no Financeiro. Só preenche aqui se for uma dívida antiga
              sem pedido correspondente no sistema, ou pra corrigir um valor
              errado.
            </p>
          </div>

          <div>
            <label className="rotulo" htmlFor="f-obs">
              Observações
            </label>
            <textarea
              id="f-obs"
              className="campo min-h-20"
              placeholder="Combinados, avarias, quem recebeu…"
              value={pedido.obs ?? ""}
              onChange={(e) => aoMudar({ obs: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5 self-start rounded-xl bg-superficie-2 p-4">
          <LinhaTotal
            rotulo={
              pedido.tipo === "CONSIGNACAO"
                ? "Consumo do evento"
                : "Total vendido"
            }
            valor={brl(totais.valorFinal)}
          />
          {totais.desconto > 0 && (
            <LinhaTotal
              rotulo="Desconto"
              valor={`− ${brl(totais.desconto)}`}
              cor="text-emerald-600"
            />
          )}
          {totais.pendenciaAnterior !== 0 && (
            <LinhaTotal
              rotulo="Pendência anterior"
              valor={`+ ${brl(totais.pendenciaAnterior)}`}
              cor="text-red-600"
            />
          )}

          <div className="my-2 border-t border-borda-forte" />

          <LinhaTotal
            rotulo="Total a receber"
            valor={brl(totais.totalReceber)}
            forte
          />

          {totais.valorPago > 0 && (
            <LinhaTotal
              rotulo="Já pago"
              valor={`− ${brl(totais.valorPago)}`}
              cor="text-emerald-600"
            />
          )}

          <div className="my-2 border-t border-borda-forte" />

          <LinhaTotal
            rotulo={totais.saldoAberto > 0.005 ? "Falta receber" : "Situação"}
            valor={
              totais.saldoAberto > 0.005
                ? brl(totais.saldoAberto)
                : totais.saldoAberto < -0.005
                  ? `crédito ${brl(-totais.saldoAberto)}`
                  : "quitado"
            }
            forte
            cor={
              totais.saldoAberto > 0.005 ? "text-acento" : "text-emerald-600"
            }
          />

          <RegistrarPagamento pedido={pedido} totais={totais} aoMudar={aoMudar} />
        </div>
      </div>
    </section>
  );
}

function LinhaTotal({
  rotulo,
  valor,
  forte = false,
  cor = "",
}: {
  rotulo: string;
  valor: string;
  forte?: boolean;
  cor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={`text-sm ${forte ? "font-bold" : "text-texto-suave"}`}
      >
        {rotulo}
      </span>
      <span
        className={`tabular-nums ${forte ? "text-lg font-black" : "text-sm font-semibold"} ${cor}`}
      >
        {valor}
      </span>
    </div>
  );
}

const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "PIX", rotulo: "Pix" },
  { valor: "DINHEIRO", rotulo: "Dinheiro" },
  { valor: "CARTAO", rotulo: "Cartão" },
  { valor: "TRANSFERENCIA", rotulo: "Transferência" },
  { valor: "BOLETO", rotulo: "Boleto" },
];

function RegistrarPagamento({
  pedido,
  totais,
  aoMudar,
}: {
  pedido: Pedido;
  totais: ReturnType<typeof calcularTotais>;
  aoMudar: (m: Partial<Pedido>) => void;
}) {
  const { salvarPagamento } = useDados();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("PIX");
  const [data, setData] = useState(hojeISO());
  const [salvando, setSalvando] = useState(false);

  function abrir() {
    setValor(paraCampo(Math.max(0, totais.saldoAberto)));
    setAberto(true);
  }

  async function registrar() {
    // Sem essa trava, ficar clicando enquanto salva (ex: com internet lenta)
    // registrava um pagamento novo a cada clique.
    if (salvando) return;
    const v = paraNumero(valor);
    if (v <= 0) return;

    setSalvando(true);
    try {
      await salvarPagamento({
        id: novoId(),
        pedidoId: pedido.id,
        clienteId: pedido.clienteId,
        valor: v,
        forma,
        data,
        criadoEm: new Date().toISOString(),
      });

      const novoTotalPago = (pedido.valorPago || 0) + v;
      aoMudar({
        valorPago: novoTotalPago,
        // Quitou tudo? O pedido fecha sozinho.
        status:
          novoTotalPago >= totais.totalReceber - 0.005
            ? "FINALIZADO"
            : pedido.status === "RASCUNHO"
              ? "ACERTO"
              : pedido.status,
      });
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <button className="btn-primario mt-3 w-full" onClick={abrir}>
        <Wallet className="h-4 w-4" />
        Registrar pagamento
      </button>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Registrar pagamento"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={registrar}
              disabled={salvando || paraNumero(valor) <= 0}
            >
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="p-valor">
              Valor recebido
            </label>
            <input
              id="p-valor"
              className="campo text-lg font-bold"
              inputMode="decimal"
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <p className="mt-1 text-xs text-texto-suave">
              Em aberto: {brl(Math.max(0, totais.saldoAberto))}
            </p>
          </div>

          <div>
            <label className="rotulo">Forma</label>
            <div className="flex flex-wrap gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  onClick={() => setForma(f.valor)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    forma === f.valor
                      ? "bg-acento text-acento-texto"
                      : "border border-borda text-texto-suave hover:bg-superficie-2"
                  }`}
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="p-data">
              Data
            </label>
            <input
              id="p-data"
              type="date"
              className="campo"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
        </div>
      </Modal>


    </>
  );
}

/* ----------------------------- Compartilhar ------------------------------ */

function CompartilharWhatsApp({ pedido }: { pedido: Pedido }) {
  const { clientePorId } = useDados();
  const totais = calcularTotais(pedido);
  const cliente = clientePorId(pedido.clienteId);

  function montarTexto() {
    const linhas = [
      `*Seu Birita Distribuidora*`,
      `Acerto #${String(pedido.numero).padStart(3, "0")} — ${pedido.clienteNome}`,
      `${dataBR(pedido.dataEvento)}${pedido.titulo ? ` · ${pedido.titulo}` : ""}`,
      "",
    ];

    for (const item of pedido.itens) {
      const saldo = saldoUn(item, pedido.tipo);
      if (saldo <= 0) continue;
      linhas.push(
        `• ${item.nome}: ${num(saldo)} un × ${brl(item.precoUn)} = ${brl(
          valorFinalItem(item, pedido.tipo),
        )}`,
      );
    }

    linhas.push("");
    linhas.push(
      `${pedido.tipo === "CONSIGNACAO" ? "Consumo" : "Total"}: ${brl(totais.valorFinal)}`,
    );
    if (totais.desconto > 0) linhas.push(`Desconto: -${brl(totais.desconto)}`);
    if (totais.pendenciaAnterior > 0) {
      linhas.push(`Pendência anterior: +${brl(totais.pendenciaAnterior)}`);
    }
    if (totais.valorPago > 0) linhas.push(`Pago: -${brl(totais.valorPago)}`);
    linhas.push(`*Total: ${brl(Math.max(0, totais.saldoAberto))}*`);

    return linhas.join("\n");
  }

  const telefone = (cliente?.telefone || "").replace(/\D/g, "");
  const url = `https://wa.me/${telefone ? `55${telefone}` : ""}?text=${encodeURIComponent(montarTexto())}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-secundario"
    >
      <Share2 className="h-4 w-4" />
      Enviar no WhatsApp
    </a>
  );
}
