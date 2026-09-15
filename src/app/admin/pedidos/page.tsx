"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Cabecalho, Modal, StatusChip, TipoChip, Vazio } from "@/components/ui";
import { useDados, novoId } from "@/lib/store";
import { calcularTotais } from "@/lib/calc";
import { brl, dataBR, hojeISO, normalizar } from "@/lib/format";
import type { Pedido, PedidoStatus, PedidoTipo } from "@/lib/types";

const FILTROS: { valor: PedidoStatus | "TODOS"; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "RASCUNHO", rotulo: "Rascunhos" },
  { valor: "ENTREGUE", rotulo: "Entregues" },
  { valor: "ACERTO", rotulo: "Em acerto" },
  { valor: "FINALIZADO", rotulo: "Finalizados" },
];

export default function PedidosPage() {
  return (
    <Suspense fallback={<Cabecalho titulo="Pedidos" subtitulo="Carregando…" />}>
      <ConteudoPedidos />
    </Suspense>
  );
}

function ConteudoPedidos() {
  const { pedidos, clientes, carregando, clientePorId } = useDados();
  const params = useSearchParams();
  const clienteFiltro = params.get("cliente");

  const [filtro, setFiltro] = useState<PedidoStatus | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [novoAberto, setNovoAberto] = useState(false);

  const lista = useMemo(() => {
    const termo = normalizar(busca);
    return pedidos.filter((p) => {
      if (clienteFiltro && p.clienteId !== clienteFiltro) return false;
      if (filtro !== "TODOS" && p.status !== filtro) return false;
      if (!termo) return true;
      return (
        normalizar(p.clienteNome).includes(termo) ||
        normalizar(p.titulo || "").includes(termo) ||
        String(p.numero).includes(termo)
      );
    });
  }, [pedidos, filtro, busca, clienteFiltro]);

  const cliente = clienteFiltro ? clientePorId(clienteFiltro) : null;

  return (
    <>
      <Cabecalho
        titulo="Pedidos"
        subtitulo={
          carregando
            ? "Carregando…"
            : cliente
              ? `Filtrando por ${cliente.nome}`
              : `${pedidos.length} no histórico`
        }
        acao={
          <button
            className="btn-primario"
            onClick={() => setNovoAberto(true)}
            disabled={clientes.length === 0}
            title={
              clientes.length === 0
                ? "Cadastre um cliente primeiro"
                : undefined
            }
          >
            <Plus className="h-4 w-4" />
            Novo pedido
          </button>
        }
      />

      <div className="px-4 md:px-6">
        {cliente && (
          <Link
            href="/admin/pedidos"
            className="mb-3 inline-block text-xs font-semibold text-acento underline-offset-4 hover:underline"
          >
            ← Ver todos os pedidos
          </Link>
        )}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
          <input
            className="campo pl-9"
            placeholder="Buscar por cliente, evento ou número…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                filtro === f.valor
                  ? "bg-acento text-acento-texto"
                  : "border border-borda bg-superficie text-texto-suave hover:bg-superficie-2"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {!carregando && lista.length === 0 && (
        <Vazio
          Icone={ClipboardList}
          titulo="Nenhum pedido por aqui"
          descricao={
            clientes.length === 0
              ? "Cadastre um cliente antes de lançar o primeiro pedido."
              : "Crie um pedido pra registrar a entrega e o acerto do evento."
          }
          acao={
            clientes.length === 0 ? (
              <Link href="/admin/clientes" className="btn-primario">
                Cadastrar cliente
              </Link>
            ) : (
              <button
                className="btn-primario"
                onClick={() => setNovoAberto(true)}
              >
                <Plus className="h-4 w-4" />
                Novo pedido
              </button>
            )
          }
        />
      )}

      <ul className="space-y-2 px-4 md:px-6">
        {lista.map((p) => (
          <CartaoPedido key={p.id} pedido={p} />
        ))}
      </ul>

      <ModalNovoPedido
        aberto={novoAberto}
        aoFechar={() => setNovoAberto(false)}
        clienteInicial={clienteFiltro ?? ""}
      />
    </>
  );
}

function CartaoPedido({ pedido }: { pedido: Pedido }) {
  const t = calcularTotais(pedido);
  const emAberto = t.saldoAberto > 0.005 && pedido.status !== "CANCELADO";

  return (
    <li>
      <Link
        href={`/admin/pedidos/${pedido.id}`}
        className="card block p-4 transition hover:border-borda-forte hover:bg-superficie-2"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{pedido.clienteNome}</p>
            <p className="mt-0.5 truncate text-xs text-texto-suave">
              #{String(pedido.numero).padStart(3, "0")} ·{" "}
              {dataBR(pedido.dataEvento)}
              {pedido.titulo && ` · ${pedido.titulo}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-black tabular-nums">{brl(t.totalReceber)}</p>
            <p className="text-[11px] text-texto-suave">
              {t.totalItens} {t.totalItens === 1 ? "item" : "itens"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusChip status={pedido.status} />
          <TipoChip tipo={pedido.tipo} />
          {emAberto && (
            <span className="chip bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
              falta {brl(t.saldoAberto)}
            </span>
          )}
          {!emAberto && pedido.status === "FINALIZADO" && (
            <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              pago
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function ModalNovoPedido({
  aberto,
  aoFechar,
  clienteInicial,
}: {
  aberto: boolean;
  aoFechar: () => void;
  clienteInicial: string;
}) {
  const {
    clientes,
    pedidos,
    salvarPedido,
    proximoNumeroPedido,
    pendenciaDoCliente,
  } = useDados();
  const router = useRouter();

  const [clienteId, setClienteId] = useState(clienteInicial);
  const [tipo, setTipo] = useState<PedidoTipo>("CONSIGNACAO");
  const [titulo, setTitulo] = useState("");
  const [dataEvento, setDataEvento] = useState(hojeISO());
  const [puxarPendencia, setPuxarPendencia] = useState(true);
  const [criando, setCriando] = useState(false);

  const pendencia = clienteId ? pendenciaDoCliente(clienteId) : 0;

  async function criar() {
    if (!clienteId) return;
    setCriando(true);

    const cliente = clientes.find((c) => c.id === clienteId)!;
    const agora = new Date().toISOString();
    const id = novoId();
    const numero = proximoNumeroPedido();
    const carregarPendencia = puxarPendencia && pendencia > 0;

    // A pendência muda de dono: sai dos pedidos antigos e entra neste.
    // Sem isso o mesmo valor apareceria em aberto nos dois lugares e o
    // "a receber" do painel viria dobrado.
    if (carregarPendencia) {
      const origens = pedidos.filter(
        (p) =>
          p.clienteId === clienteId &&
          p.status !== "CANCELADO" &&
          p.status !== "RASCUNHO" &&
          calcularTotais(p).saldoAberto > 0.005,
      );

      for (const origem of origens) {
        const saldo = calcularTotais(origem).saldoAberto;
        await salvarPedido({
          ...origem,
          valorPago: (origem.valorPago || 0) + saldo,
          status: "FINALIZADO",
          obs: [
            origem.obs,
            `Saldo de ${brl(saldo)} transferido para o pedido #${String(numero).padStart(3, "0")}.`,
          ]
            .filter(Boolean)
            .join("\n"),
          atualizadoEm: agora,
        });
      }
    }

    await salvarPedido({
      id,
      numero,
      clienteId,
      clienteNome: cliente.nome,
      tipo,
      titulo: titulo.trim() || undefined,
      dataEvento,
      status: "RASCUNHO",
      pendenciaAnterior: carregarPendencia ? pendencia : 0,
      desconto: 0,
      itens: [],
      valorPedido: 0,
      valorFinal: 0,
      valorPago: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    });

    setCriando(false);
    aoFechar();
    router.push(`/admin/pedidos/${id}`);
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo pedido"
      rodape={
        <>
          <button className="btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="btn-primario"
            onClick={criar}
            disabled={!clienteId || criando}
          >
            {criando ? "Criando…" : "Criar e montar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="np-cliente">
            Cliente
          </label>
          <select
            id="np-cliente"
            className="campo"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {clientes
              .filter((c) => c.ativo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="rotulo">Tipo de pedido</label>
          <div className="grid grid-cols-2 gap-2">
            <BotaoTipo
              ativo={tipo === "CONSIGNACAO"}
              aoClicar={() => setTipo("CONSIGNACAO")}
              titulo="Consignação"
              descricao="Entrega, o cliente devolve o que sobrou e paga o consumo."
            />
            <BotaoTipo
              ativo={tipo === "VENDA_DIRETA"}
              aoClicar={() => setTipo("VENDA_DIRETA")}
              titulo="Venda direta"
              descricao="Cliente compra e leva. Sem devolução."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="np-data">
              Data do evento
            </label>
            <input
              id="np-data"
              type="date"
              className="campo"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="np-titulo">
              Evento (opcional)
            </label>
            <input
              id="np-titulo"
              className="campo"
              placeholder="Réveillon"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
        </div>

        {pendencia > 0.005 && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ouro-300 bg-ouro-50 p-3 dark:bg-ouro-900/20">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 accent-[var(--acento)]"
              checked={puxarPendencia}
              onChange={(e) => setPuxarPendencia(e.target.checked)}
            />
            <span className="min-w-0 text-sm">
              <span className="block font-semibold">
                Trazer pendência de {brl(pendencia)}
              </span>
              <span className="block text-xs text-texto-suave">
                Este cliente tem valores em aberto de pedidos anteriores. Some
                no total deste acerto.
              </span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}

function BotaoTipo({
  ativo,
  aoClicar,
  titulo,
  descricao,
}: {
  ativo: boolean;
  aoClicar: () => void;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className={`rounded-xl border p-3 text-left transition ${
        ativo
          ? "border-acento bg-acento/10 ring-2 ring-acento/25"
          : "border-borda hover:bg-superficie-2"
      }`}
    >
      <span className="block text-sm font-bold">{titulo}</span>
      <span className="mt-0.5 block text-xs text-texto-suave">{descricao}</span>
    </button>
  );
}
