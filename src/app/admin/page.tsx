"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Package,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Cabecalho, StatusChip } from "@/components/ui";
import { useDados } from "@/lib/store";
import { calcularTotais } from "@/lib/calc";
import { brl, dataBR } from "@/lib/format";

export default function InicioPage() {
  const { pedidos, produtos, clientes, carregando } = useDados();

  const ativos = pedidos.filter((p) => p.status !== "CANCELADO");

  const aReceber = ativos
    .filter((p) => p.status !== "RASCUNHO")
    .reduce((soma, p) => soma + Math.max(0, calcularTotais(p).saldoAberto), 0);

  const mesAtual = new Date().toISOString().slice(0, 7);
  const faturadoMes = ativos
    .filter((p) => p.dataEvento.startsWith(mesAtual))
    .reduce((soma, p) => soma + calcularTotais(p).valorFinal, 0);

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
          <Link href="/pedidos" className="btn-primario">
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
            Icone={TrendingUp}
            rotulo="Faturado no mês"
            valor={brl(faturadoMes)}
            detalhe={new Date().toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
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
                      href={`/pedidos/${p.id}`}
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

        {/* -------------------------- Últimos pedidos --------------------- */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Últimos pedidos</h2>
            <Link
              href="/pedidos"
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
                <Link href="/produtos" className="btn-secundario">
                  <Package className="h-4 w-4" />
                  Produtos
                </Link>
                <Link href="/clientes" className="btn-secundario">
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
                      href={`/pedidos/${p.id}`}
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
  Icone: React.ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  detalhe: string;
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
      <p className="mt-0.5 truncate text-xs text-texto-suave">{detalhe}</p>
    </div>
  );
}
