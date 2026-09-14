"use client";

import { useMemo } from "react";
import Link from "next/link";
import { TrendingUp, Wallet } from "lucide-react";
import { Cabecalho } from "@/components/ui";
import { useDados } from "@/lib/store";
import { calcularTotais } from "@/lib/calc";
import { brl, dataBR } from "@/lib/format";

const ROTULO_FORMA: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
};

export default function FinanceiroPage() {
  const { pedidos, pagamentos, clientes, carregando } = useDados();

  const ativos = useMemo(
    () => pedidos.filter((p) => p.status !== "CANCELADO" && p.status !== "RASCUNHO"),
    [pedidos],
  );

  const mesAtual = new Date().toISOString().slice(0, 7);

  const recebidoMes = pagamentos
    .filter((p) => p.data.startsWith(mesAtual))
    .reduce((s, p) => s + p.valor, 0);

  const aReceber = ativos.reduce(
    (s, p) => s + Math.max(0, calcularTotais(p).saldoAberto),
    0,
  );

  /** Quanto cada cliente deve, somando os pedidos em aberto. */
  const porCliente = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; total: number; pedidos: number }
    >();

    for (const p of ativos) {
      const saldo = calcularTotais(p).saldoAberto;
      if (saldo <= 0.005) continue;
      const atual = mapa.get(p.clienteId) ?? {
        nome: p.clienteNome,
        total: 0,
        pedidos: 0,
      };
      atual.total += saldo;
      atual.pedidos += 1;
      mapa.set(p.clienteId, atual);
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [ativos]);

  const ultimosPagamentos = useMemo(
    () => [...pagamentos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12),
    [pagamentos],
  );

  return (
    <>
      <Cabecalho
        titulo="Financeiro"
        subtitulo={carregando ? "Carregando…" : "Recebimentos e contas em aberto"}
      />

      <div className="space-y-6 px-4 md:px-6">
        <div className="grid grid-cols-2 gap-2">
          <div className="card border-acento/40 bg-acento/5 px-4 py-3">
            <div className="flex items-center gap-1.5 text-texto-suave">
              <Wallet className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                A receber
              </p>
            </div>
            <p className="mt-1.5 text-2xl font-black text-acento tabular-nums">
              {brl(aReceber)}
            </p>
            <p className="mt-0.5 text-xs text-texto-suave">
              {porCliente.length} cliente(s)
            </p>
          </div>

          <div className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-texto-suave">
              <TrendingUp className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                Recebido no mês
              </p>
            </div>
            <p className="mt-1.5 text-2xl font-black tabular-nums">
              {brl(recebidoMes)}
            </p>
            <p className="mt-0.5 text-xs text-texto-suave">
              {new Date().toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-bold">Em aberto por cliente</h2>
          {porCliente.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="font-semibold">Tudo em dia 🎉</p>
              <p className="mt-1 text-sm text-texto-suave">
                Nenhum cliente com valor pendente.
              </p>
            </div>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {porCliente.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/pedidos?cliente=${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.nome}</p>
                      <p className="text-xs text-texto-suave">
                        {c.pedidos} pedido{c.pedidos === 1 ? "" : "s"} em aberto
                      </p>
                    </div>
                    <span className="shrink-0 font-black text-acento tabular-nums">
                      {brl(c.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Últimos recebimentos</h2>
          {ultimosPagamentos.length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-texto-suave">
              Nenhum pagamento registrado ainda. Eles aparecem aqui conforme
              você registra o acerto de cada pedido.
            </div>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {ultimosPagamentos.map((pg) => {
                const cliente = clientes.find((c) => c.id === pg.clienteId);
                const pedido = pedidos.find((p) => p.id === pg.pedidoId);
                return (
                  <li
                    key={pg.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {cliente?.nome ?? "Cliente removido"}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {dataBR(pg.data)} ·{" "}
                        {ROTULO_FORMA[pg.forma] ?? pg.forma}
                        {pedido &&
                          ` · #${String(pedido.numero).padStart(3, "0")}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-emerald-600 tabular-nums">
                      {brl(pg.valor)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
