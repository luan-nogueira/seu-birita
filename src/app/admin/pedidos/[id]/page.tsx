"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CloudUpload,
  FileText,
  Layers,
  Plus,
  Search,
  Share2,
  Trash2,
  Wallet,
} from "lucide-react";
import { Modal, StatusChip, TipoChip } from "@/components/ui";
import { CampoQtd } from "@/components/CampoQtd";
import { useDados, novoId } from "@/lib/store";
import {
  calcularTotais,
  devolvidoUn,
  entregueUn,
  novoItem,
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
} from "@/lib/types";

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
  ACERTO: "Em acerto",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { pedidoPorId, salvarPedido, removerPedido, carregando } = useDados();

  const remoto = pedidoPorId(id);

  // Enquanto se edita, o estado local manda. O remoto só semeia a primeira
  // carga — assim uma sincronização do Firestore não apaga o que está
  // sendo digitado no meio do acerto.
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const semeado = useRef(false);

  useEffect(() => {
    if (!semeado.current && remoto) {
      setPedido(remoto);
      semeado.current = true;
    }
  }, [remoto]);

  // Salvamento automático com uma pausa, pra não gravar a cada tecla.
  const primeiraGravacao = useRef(true);
  useEffect(() => {
    if (!pedido) return;
    if (primeiraGravacao.current) {
      primeiraGravacao.current = false;
      return;
    }
    setSalvando(true);
    const t = setTimeout(async () => {
      const totais = calcularTotais(pedido);
      await salvarPedido({
        ...pedido,
        valorPedido: totais.valorPedido,
        valorFinal: totais.valorFinal,
        atualizadoEm: new Date().toISOString(),
      });
      setSalvando(false);
    }, 700);
    return () => clearTimeout(t);
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
            href={`/admin/pedidos/${pedido.id}/relatorio`}
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
              {/* Celular: um cartão por produto */}
              <ul className="space-y-2 md:hidden">
                {pedido.itens.map((item, i) => (
                  <CartaoItem
                    key={`${item.produtoId}-${i}`}
                    item={item}
                    consignacao={consignacao}
                    aoMudar={(m) => atualizarItem(i, m)}
                    aoRemover={() => removerItem(i)}
                  />
                ))}
              </ul>

              {/* Desktop: a planilha, só que legível */}
              <div className="hidden md:block">
                <TabelaItens
                  itens={pedido.itens}
                  remessas={remessas}
                  consignacao={consignacao}
                  aoMudarItem={atualizarItem}
                  aoRemoverItem={removerItem}
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
          <CompartilharWhatsApp pedido={pedido} />
          <button className="btn-perigo ml-auto" onClick={solicitarExclusaoPedido}>
            <Trash2 className="h-4 w-4" />
            Excluir pedido
          </button>
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
}: {
  pedido: Pedido;
  aoMudarStatus: (s: PedidoStatus) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TipoChip tipo={pedido.tipo} />
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        {STATUS_DISPONIVEIS.map((s) => (
          <button
            key={s}
            onClick={() => aoMudarStatus(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              pedido.status === s
                ? "bg-acento text-acento-texto"
                : "border border-borda bg-superficie text-texto-suave hover:bg-superficie-2"
            }`}
          >
            {ROTULO_STATUS[s]}
          </button>
        ))}
      </div>
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

  function mudarEntrega(indice: number, campo: "cx" | "un", valor: number) {
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
          <p className="mt-0.5 text-xs text-texto-suave">
            {brl(item.precoUn)}/un
            {item.unPorCaixa > 1 && ` · ${item.unPorCaixa} un/cx`}
          </p>
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
        {item.entregas.map((e, i) => (
          <LinhaQtd
            key={i}
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
}: {
  rotulo: string;
  nomeItem: string;
  cx: number;
  un: number;
  unPorCaixa: number;
  aoMudarCx: (v: number) => void;
  aoMudarUn: (v: number) => void;
  alerta?: boolean;
}) {
  const total = cx * unPorCaixa + un;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-20 shrink-0 text-[11px] font-bold uppercase ${
          alerta ? "text-red-600" : "text-texto-suave"
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
      <span className="w-14 shrink-0 text-right text-sm font-bold tabular-nums">
        {num(total)}
      </span>
    </div>
  );
}

/* ---------------------------- Tabela no desktop --------------------------- */

function TabelaItens({
  itens,
  remessas,
  consignacao,
  aoMudarItem,
  aoRemoverItem,
}: {
  itens: PedidoItem[];
  remessas: number;
  consignacao: boolean;
  aoMudarItem: (i: number, m: Partial<PedidoItem>) => void;
  aoRemoverItem: (i: number) => void;
}) {
  const tipo = consignacao ? "CONSIGNACAO" : "VENDA_DIRETA";
  const colunasRemessa = Array.from({ length: remessas }, (_, i) => i);

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-borda bg-superficie-2 text-[11px] uppercase">
            <th className="px-3 py-2 text-left font-bold">Produto</th>
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

        <tbody className="divide-y divide-borda">
          {itens.map((item, indice) => {
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
                <td className="px-3 py-2 text-right tabular-nums">
                  {brl(item.precoUn)}
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
      </table>
    </div>
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
      .map((p) => novoItem(p));
    aoAdicionar(itens);
    setMarcados(new Set());
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
          <ul className="divide-y divide-borda">
            {disponiveis.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[var(--acento)]"
                    checked={marcados.has(p.id)}
                    onChange={() => alternar(p.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {p.nome}
                    </span>
                    <span className="block text-xs text-texto-suave">
                      {p.categoria}
                      {p.unPorCaixa > 1 && ` · ${p.unPorCaixa} un/cx`}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {brl(p.precoUn)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
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
  const [pendencia, setPendencia] = useState(
    paraCampo(pedido.pendenciaAnterior),
  );

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
              Pendência anterior
            </label>
            <input
              id="f-pendencia"
              className="campo"
              inputMode="decimal"
              placeholder="0,00"
              value={pendencia}
              onChange={(e) => setPendencia(e.target.value)}
              onBlur={() =>
                aoMudar({ pendenciaAnterior: paraNumero(pendencia) })
              }
            />
            <p className="mt-1 text-xs text-texto-suave">
              Valor que o cliente já devia de acertos anteriores.
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

  function abrir() {
    setValor(paraCampo(Math.max(0, totais.saldoAberto)));
    setAberto(true);
  }

  async function registrar() {
    const v = paraNumero(valor);
    if (v <= 0) return;

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
            >
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={registrar}
              disabled={paraNumero(valor) <= 0}
            >
              Confirmar
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
