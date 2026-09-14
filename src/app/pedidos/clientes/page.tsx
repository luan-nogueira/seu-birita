"use client";

import { useState } from "react";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  MessageCircle,
  Package,
  Phone,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { Cabecalho, Modal } from "@/components/ui";
import { useDados } from "@/lib/store";
import { brl, dataBR, dataHoraBR, telefoneBR } from "@/lib/format";
import { EMPRESA } from "@/lib/empresa";
import type { PedidoCliente, PedidoClienteStatus } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Chips de status                                                              */
/* -------------------------------------------------------------------------- */

const CORES_STATUS: Record<PedidoClienteStatus, string> = {
  NOVO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  EM_ANALISE:
    "bg-ouro-100 text-ouro-900 dark:bg-ouro-900/40 dark:text-ouro-200",
  CONFIRMADO:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const ROTULOS_STATUS: Record<PedidoClienteStatus, string> = {
  NOVO: "🆕 Novo",
  EM_ANALISE: "🔍 Em análise",
  CONFIRMADO: "✅ Confirmado",
  CANCELADO: "❌ Cancelado",
};

const TODOS_STATUS: PedidoClienteStatus[] = [
  "NOVO",
  "EM_ANALISE",
  "CONFIRMADO",
  "CANCELADO",
];

function StatusChip({ status }: { status: PedidoClienteStatus }) {
  return (
    <span
      className={`chip text-xs font-semibold ${CORES_STATUS[status]}`}
    >
      {ROTULOS_STATUS[status]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Página                                                                       */
/* -------------------------------------------------------------------------- */

export default function PedidosClientesPage() {
  const {
    pedidosClientes,
    pedidosClientesNovos,
    salvarPedidoCliente,
    removerPedidoCliente,
    carregando,
  } = useDados();

  const [filtroStatus, setFiltroStatus] = useState<
    PedidoClienteStatus | "TODOS"
  >("TODOS");
  const [pedidoAberto, setPedidoAberto] = useState<PedidoCliente | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindoPedido, setExcluindoPedido] = useState<PedidoCliente | null>(null);

  /* ----------------------------- Filtro --------------------------------- */

  const filtrados =
    filtroStatus === "TODOS"
      ? pedidosClientes
      : pedidosClientes.filter((p) => p.status === filtroStatus);

  /* ----------------------------- Ações ---------------------------------- */

  async function mudarStatus(
    pedido: PedidoCliente,
    novoStatus: PedidoClienteStatus,
  ) {
    setSalvando(true);
    try {
      await salvarPedidoCliente({
        ...pedido,
        status: novoStatus,
        atualizadoEm: new Date().toISOString(),
      });
      if (pedidoAberto?.id === pedido.id) {
        setPedidoAberto({ ...pedido, status: novoStatus });
      }
    } finally {
      setSalvando(false);
    }
  }

  function solicitarExclusao(pedido: PedidoCliente) {
    setExcluindoPedido(pedido);
  }

  async function confirmarExclusao() {
    if (!excluindoPedido) return;
    await removerPedidoCliente(excluindoPedido.id);
    setExcluindoPedido(null);
    if (pedidoAberto?.id === excluindoPedido.id) {
      setPedidoAberto(null);
    }
  }

  const whatsappLink = (pedido: PedidoCliente) => {
    const tel = pedido.telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${pedido.nomeCliente.split(" ")[0]}! 🍺\n\nRecebi seu pedido #${String(pedido.numero).padStart(4, "0")} pela Seu Birita.\nVou confirmar os detalhes para o evento em *${pedido.localEvento}*.\n\nPodemos conversar?`,
    );
    return `https://wa.me/55${tel}?text=${msg}`;
  };

  /* ----------------------------- Render --------------------------------- */

  return (
    <>
      <Cabecalho
        titulo="Pedidos Online"
        subtitulo={
          carregando
            ? "Carregando…"
            : `${pedidosClientes.length} pedido(s) recebido(s)${pedidosClientesNovos > 0 ? ` · ${pedidosClientesNovos} novo(s)` : ""}`
        }
        acao={
          <a
            href="/pedido"
            target="_blank"
            rel="noopener noreferrer"
            id="btn-ver-pagina-pedido"
            className="btn-secundario text-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Ver página do cliente
          </a>
        }
      />

      <div className="space-y-4 px-4 md:px-6">
        {/* ── Cards de métricas ── */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TODOS_STATUS.map((s) => {
            const qtd = pedidosClientes.filter((p) => p.status === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setFiltroStatus(filtroStatus === s ? "TODOS" : s)
                }
                className={`card px-4 py-3 text-left transition hover:shadow-md ${
                  filtroStatus === s ? "ring-2 ring-acento" : ""
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">
                  {ROTULOS_STATUS[s].replace(/^[^\s]+ /, "")}
                </p>
                <p className="mt-1 text-2xl font-black tabular-nums">{qtd}</p>
              </button>
            );
          })}
        </div>

        {/* ── Filtros ── */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroStatus("TODOS")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              filtroStatus === "TODOS"
                ? "bg-acento text-acento-texto"
                : "border border-borda text-texto-suave hover:border-acento"
            }`}
          >
            Todos ({pedidosClientes.length})
          </button>
          {TODOS_STATUS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFiltroStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filtroStatus === s
                  ? "bg-acento text-acento-texto"
                  : "border border-borda text-texto-suave hover:border-acento"
              }`}
            >
              {ROTULOS_STATUS[s]} ({pedidosClientes.filter((p) => p.status === s).length})
            </button>
          ))}
        </div>

        {/* ── Listagem ── */}
        {carregando && (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-acento border-t-transparent" />
            <p className="text-sm text-texto-suave">Carregando pedidos…</p>
          </div>
        )}

        {!carregando && filtrados.length === 0 && (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-superficie-2 text-texto-suave">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="font-bold">Nenhum pedido aqui</p>
            <p className="text-sm text-texto-suave max-w-xs">
              Compartilhe o link{" "}
              <strong className="text-acento">/pedido</strong> com seus clientes
              para receber pedidos aqui.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {filtrados.map((pedido) => (
            <li key={pedido.id}>
              <button
                type="button"
                id={`pedido-cliente-${pedido.id}`}
                onClick={() => setPedidoAberto(pedido)}
                className="card w-full p-4 text-left transition hover:shadow-md hover:border-acento/30 active:scale-[.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-texto-suave">
                        #{String(pedido.numero).padStart(4, "0")}
                      </span>
                      <StatusChip status={pedido.status} />
                      {pedido.status === "NOVO" && (
                        <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      )}
                    </div>
                    <p className="mt-1 font-bold text-lg leading-tight">
                      {pedido.nomeCliente}
                    </p>
                    <p className="text-sm text-texto-suave flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {telefoneBR(pedido.telefone)}
                    </p>
                    <p className="text-sm text-texto-suave flex items-center gap-1 mt-0.5">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{pedido.localEvento}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-black tabular-nums text-acento">
                      {brl(pedido.valorTotal)}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {pedido.itens.length} item(s)
                    </p>
                    <p className="text-xs text-texto-suave mt-1 flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" />
                      {dataHoraBR(pedido.criadoEm)}
                    </p>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ─── Modal de detalhes ─── */}
      <Modal
        aberto={!!pedidoAberto}
        aoFechar={() => setPedidoAberto(null)}
        titulo={`Pedido #${pedidoAberto ? String(pedidoAberto.numero).padStart(4, "0") : ""}`}
        largura="max-w-xl"
      >
        {pedidoAberto && (
          <div className="space-y-5">
            {/* Status atual */}
            <div className="flex items-center gap-2">
              <StatusChip status={pedidoAberto.status} />
              <span className="text-xs text-texto-suave">
                Recebido em {dataHoraBR(pedidoAberto.criadoEm)}
              </span>
            </div>

            {/* Dados do cliente */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">
                Dados do Cliente
              </h3>
              <div className="card divide-y divide-borda overflow-hidden">
                <Linha rotulo="Nome" valor={pedidoAberto.nomeCliente} />
                <Linha
                  rotulo="WhatsApp"
                  valor={telefoneBR(pedidoAberto.telefone)}
                />
                <Linha rotulo="Local do evento" valor={pedidoAberto.localEvento} />
                {pedidoAberto.dataEvento && (
                  <Linha
                    rotulo="Data do evento"
                    valor={dataBR(pedidoAberto.dataEvento)}
                  />
                )}
                {pedidoAberto.obs && (
                  <Linha rotulo="Observações" valor={pedidoAberto.obs} />
                )}
              </div>
            </section>

            {/* Itens do pedido */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">
                Itens Pedidos
              </h3>
              <div className="card overflow-hidden">
                <ul className="divide-y divide-borda">
                  {pedidoAberto.itens.map((item) => {
                    const resumoStr = [];
                    if (item.cx > 0) resumoStr.push(`${item.cx}cx`);
                    if (item.un > 0 || item.cx === 0) resumoStr.push(`${item.un}un`);
                    return (
                      <li
                        key={item.produtoId}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <div>
                          <p className="font-semibold text-sm">
                            <span className="font-bold mr-2 text-acento">{resumoStr.join(" + ")}</span>
                            {item.nome}
                          </p>
                          <p className="text-xs text-texto-suave mt-0.5">
                            {brl(item.precoUn)} × {item.cx * (item.unPorCaixa || 1) + item.un}
                          </p>
                        </div>
                        <span className="font-bold tabular-nums text-sm">
                          {brl(item.subtotal)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between border-t border-borda px-4 py-3">
                  <span className="font-bold">Total</span>
                  <span className="text-lg font-black tabular-nums text-acento">
                    {brl(pedidoAberto.valorTotal)}
                  </span>
                </div>
              </div>
            </section>

            {/* Ações de status */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">
                Alterar Status
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {TODOS_STATUS.filter((s) => s !== pedidoAberto.status).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={salvando}
                      onClick={() => void mudarStatus(pedidoAberto, s)}
                      className={`rounded-xl border py-2.5 text-sm font-semibold transition active:scale-[.98] disabled:opacity-50 ${
                        s === "CANCELADO"
                          ? "border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                          : "btn-secundario"
                      }`}
                    >
                      {s === "NOVO" && "Marcar como Novo"}
                      {s === "EM_ANALISE" && "Em Análise"}
                      {s === "CONFIRMADO" && "✅ Confirmar"}
                      {s === "CANCELADO" && "❌ Cancelar"}
                    </button>
                  ),
                )}
              </div>
            </section>

            {/* Botões de ação */}
            <div className="flex flex-col gap-2">
              <a
                href={whatsappLink(pedidoAberto)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primario w-full py-3"
              >
                <MessageCircle className="h-5 w-5" />
                Responder no WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  setPedidoAberto(null);
                  solicitarExclusao(pedidoAberto);
                }}
                className="btn-perigo w-full py-2.5"
              >
                <Trash2 className="h-4 w-4" />
                Excluir pedido
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Modal de exclusão ─── */}
      <Modal
        aberto={!!excluindoPedido}
        aoFechar={() => setExcluindoPedido(null)}
        titulo="Excluir Pedido Online"
        rodape={
          <>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => setExcluindoPedido(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-perigo"
              onClick={() => void confirmarExclusao()}
            >
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          {excluindoPedido &&
            `Tem certeza que deseja excluir o pedido #${String(excluindoPedido.numero).padStart(4, "0")} de ${excluindoPedido.nomeCliente}? Esta ação não pode ser desfeita.`}
        </p>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Helper                                                                       */
/* -------------------------------------------------------------------------- */

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <span className="w-28 shrink-0 text-xs font-semibold text-texto-suave">
        {rotulo}
      </span>
      <span className="min-w-0 flex-1 text-sm break-words">{valor}</span>
    </div>
  );
}
