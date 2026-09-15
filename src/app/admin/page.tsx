"use client";

import { useState, type ReactNode, type ComponentType } from "react";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Package,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Cabecalho, StatusChip } from "@/components/ui";
import { useDados } from "@/lib/store";
import { calcularTotais, lucroTotal } from "@/lib/calc";
import { brl, dataBR, hojeISO } from "@/lib/format";

export default function InicioPage() {
  const { pedidos, produtos, clientes, fornecedores, contasPagar, carregando } =
    useDados();

  const ativos = pedidos.filter((p) => p.status !== "CANCELADO");

  const aReceber = ativos
    .filter((p) => p.status !== "RASCUNHO")
    .reduce((soma, p) => soma + Math.max(0, calcularTotais(p).saldoAberto), 0);

  const [mesFiltro, setMesFiltro] = useState(() => new Date().toISOString().slice(0, 7));

  const pedidosDoMes = ativos.filter((p) => p.dataEvento.startsWith(mesFiltro));
  const faturadoMes = pedidosDoMes.reduce(
    (soma, p) => soma + calcularTotais(p).valorFinal,
    0,
  );
  const lucroMes = lucroTotal(pedidosDoMes);
  const margemMes = faturadoMes > 0 ? (lucroMes / faturadoMes) * 100 : 0;

  const hoje = hojeISO();
  const contasPendentes = contasPagar.filter((c) => !c.pago);
  const aPagar = contasPendentes.reduce((soma, c) => soma + c.valor, 0);
  const contasVencidas = contasPendentes.filter((c) => c.vencimento < hoje);

  const emAberto = ativos.filter(
    (p) =>
      p.status !== "RASCUNHO" && calcularTotais(p).saldoAberto > 0.005,
  );

  const recentes = ativos.slice(0, 5);

  return (
    <>
      <Cabecalho
        titulo="Início"
        subtitulo={
          carregando
            ? "Carregando…"
            : `${clientes.length} clientes · ${produtos.length} produtos`
        }
        acao={
          <Link href="/admin/pedidos" className="btn-primario">
            <Plus className="h-4 w-4" />
            Novo pedido
          </Link>
        }
      />

      <div className="space-y-6 px-4 md:px-6">
        {/* --------------------------- Números --------------------------- */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Cartao
            Icone={Wallet}
            rotulo="A receber"
            valor={brl(aReceber)}
            detalhe={`${emAberto.length} pedido(s) em aberto`}
            destaque={aReceber > 0}
          />
          <Cartao
            Icone={TrendingDown}
            rotulo="A pagar"
            valor={brl(aPagar)}
            detalhe={
              contasVencidas.length > 0
                ? `${contasVencidas.length} conta(s) vencida(s)`
                : `${contasPendentes.length} conta(s) pendente(s)`
            }
            destaque={contasVencidas.length > 0}
          />
          <Cartao
            Icone={TrendingUp}
            rotulo="Faturado no mês"
            valor={brl(faturadoMes)}
            detalhe={
              <input
                type="month"
                value={mesFiltro}
                onChange={(e) => setMesFiltro(e.target.value)}
                className="bg-transparent outline-none cursor-pointer w-full text-texto-suave"
              />
            }
          />
          <Cartao
            Icone={PiggyBank}
            rotulo="Lucro no mês"
            valor={brl(lucroMes)}
            detalhe={faturadoMes > 0 ? `${margemMes.toFixed(0)}% de margem` : "sem faturamento"}
          />
          <Cartao
            Icone={CalendarDays}
            rotulo="Eventos no mês"
            valor={String(pedidosDoMes.length)}
            detalhe="pedidos no período"
          />
          <Cartao
            Icone={ClipboardList}
            rotulo="Pedidos"
            valor={String(ativos.length)}
            detalhe="no histórico"
          />
          <Cartao
            Icone={Users}
            rotulo="Clientes"
            valor={String(clientes.filter((c) => c.ativo).length)}
            detalhe="ativos"
          />
          <Cartao
            Icone={Truck}
            rotulo="Fornecedores"
            valor={String(fornecedores.filter((f) => f.ativo).length)}
            detalhe="cadastrados"
          />
        </div>

        {/* ------------------------ Contas em aberto ---------------------- */}
        {emAberto.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="h-4 w-4 text-acento" />
              Contas em aberto
            </h2>
            <ul className="card divide-y divide-borda overflow-hidden">
              {emAberto.slice(0, 6).map((p) => {
                const t = calcularTotais(p);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/pedidos/${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {p.clienteNome}
                        </p>
                        <p className="text-xs text-texto-suave">
                          #{String(p.numero).padStart(3, "0")} ·{" "}
                          {dataBR(p.dataEvento)}
                        </p>
                      </div>
                      <span className="shrink-0 font-black text-acento tabular-nums">
                        {brl(t.saldoAberto)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* ------------------------ Contas a pagar ------------------------ */}
        {contasPendentes.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <TrendingDown className="h-4 w-4 text-acento" />
                Contas a pagar
              </h2>
              <Link
                href="/admin/financeiro"
                className="inline-flex items-center gap-1 text-xs font-semibold text-acento underline-offset-4 hover:underline"
              >
                ver todas <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ul className="card divide-y divide-borda overflow-hidden">
              {contasPendentes.slice(0, 6).map((c) => {
                const vencida = c.vencimento < hoje;
                return (
                  <li key={c.id}>
                    <Link
                      href="/admin/financeiro"
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{c.descricao}</p>
                        <p className="text-xs text-texto-suave">
                          {c.fornecedorNome ? `${c.fornecedorNome} · ` : ""}
                          vence {dataBR(c.vencimento)}
                          {vencida && " · vencida"}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-black tabular-nums ${
                          vencida ? "text-red-600 dark:text-red-400" : "text-acento"
                        }`}
                      >
                        {brl(c.valor)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* -------------------------- Últimos pedidos --------------------- */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Últimos pedidos</h2>
            <Link
              href="/admin/pedidos"
              className="inline-flex items-center gap-1 text-xs font-semibold text-acento underline-offset-4 hover:underline"
            >
              ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentes.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="font-semibold">Nada por aqui ainda</p>
              <p className="mt-1 text-sm text-texto-suave">
                Cadastre produtos e clientes, depois lance o primeiro pedido.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/admin/produtos" className="btn-secundario">
                  <Package className="h-4 w-4" />
                  Produtos
                </Link>
                <Link href="/admin/clientes" className="btn-secundario">
                  <Users className="h-4 w-4" />
                  Clientes
                </Link>
              </div>
            </div>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {recentes.map((p) => {
                const t = calcularTotais(p);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/pedidos/${p.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">
                          {p.clienteNome}
                        </p>
                        <p className="mt-0.5 text-xs text-texto-suave">
                          {dataBR(p.dataEvento)}
                          {p.titulo && ` · ${p.titulo}`}
                        </p>
                      </div>
                      <StatusChip status={p.status} />
                      <span className="shrink-0 font-bold tabular-nums">
                        {brl(t.totalReceber)}
                      </span>
                    </Link>
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

function Cartao({
  Icone,
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  Icone: ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  detalhe: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div
      className={`card px-4 py-3 ${destaque ? "border-acento/40 bg-acento/5" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-texto-suave">
        <Icone className="h-3.5 w-3.5" />
        <p className="text-[11px] font-semibold tracking-wide uppercase">
          {rotulo}
        </p>
      </div>
      <p
        className={`mt-1.5 text-xl font-black tabular-nums md:text-2xl ${
          destaque ? "text-acento" : ""
        }`}
      >
        {valor}
      </p>
      <div className="mt-0.5 truncate text-xs text-texto-suave">{detalhe}</div>
    </div>
  );
}
