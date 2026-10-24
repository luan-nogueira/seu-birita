"use client";

import { useState, type ReactNode, type ComponentType } from "react";

import Link from "next/link";
import {
  AlertTriangle,
  Armchair,
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
import { ModalAgendarEvento } from "@/components/ModalAgendarEvento";
import { useDados } from "@/lib/store";
import { rotaPedido } from "@/lib/rotas";
import { useAuth } from "@/lib/auth";
import {
  calcularTotais,
  lucroTotal,
  lucroRecebidoTotal,
  pedidoContabilizado,
  valorFinalItem,
} from "@/lib/calc";
import { brl, dataBR, hojeISO, normalizar } from "@/lib/format";

export default function InicioPage() {
  const {
    pedidos,
    produtos,
    clientes,
    fornecedores,
    contasPagar,
    ehComodato,
    produtoPorId,
    carregando,
  } = useDados();
  const { permissoes } = useAuth();
  const [agendarAberto, setAgendarAberto] = useState(false);

  const ativos = pedidos.filter((p) => p.status !== "CANCELADO");
  // Rascunho e Entregue ainda não são venda fechada — só entram nos números
  // a partir de Aguardando acerto (ver pedidoContabilizado).
  const contabilizados = ativos.filter(pedidoContabilizado);

  const aReceber = contabilizados.reduce(
    (soma, p) => soma + Math.max(0, calcularTotais(p, ehComodato).saldoAberto),
    0,
  );

  // Data local (hojeISO), não toISOString — senão depois das 21h o filtro
  // já pulava pro dia/mês seguinte.
  const [dataInicial, setDataInicial] = useState(() => hojeISO().slice(0, 8) + "01");
  const [dataFinal, setDataFinal] = useState(hojeISO);

  const noPeriodo = (p: { dataEvento: string }) => {
    const d = p.dataEvento.slice(0, 10);
    return d >= dataInicial && d <= dataFinal;
  };
  const pedidosDoMes = contabilizados.filter(noPeriodo);
  // A contagem de eventos segue incluindo os Entregues — o evento aconteceu,
  // só o dinheiro é que ainda não entra na conta.
  const eventosDoMes = ativos.filter(
    (p) => p.status !== "RASCUNHO" && p.status !== "ESTOCADO" && noPeriodo(p),
  );
  // Faturado = o que foi cobrado do cliente, já com o desconto (a pendência
  // anterior não entra: é dívida de outro pedido, já faturada lá). O
  // comodato entra no faturado, mas aparece separado porque fica
  // fora do lucro.
  const faturadoMes = pedidosDoMes.reduce((soma, p) => {
    const t = calcularTotais(p, ehComodato);
    return soma + t.valorFinal - t.desconto;
  }, 0);
  // Quanto faturou cada grupo, pela categoria do produto. Os grupos somam o
  // consumo antes do desconto — o desconto aparece numa linha à parte pra
  // conta fechar com o total.
  const faturadoPorGrupo = new Map<GrupoFaturado, number>(GRUPOS_FATURADO.map((g) => [g, 0]));
  let descontoMes = 0;
  for (const p of pedidosDoMes) {
    descontoMes += p.desconto || 0;
    for (const item of p.itens) {
      const grupo = grupoFaturado(produtoPorId(item.produtoId)?.categoria ?? "");
      faturadoPorGrupo.set(grupo, faturadoPorGrupo.get(grupo)! + valorFinalItem(item, p.tipo));
    }
  }

  // Comodato tem quadro próprio — mesmos pedidos e período do faturado.
  let comodatoPeriodo = 0;
  let comodatoUn = 0;
  for (const p of pedidosDoMes) {
    const t = calcularTotais(p, ehComodato);
    comodatoPeriodo += t.valorComodato;
    comodatoUn += t.unidadesComodatoEntregues - t.unidadesComodatoDevolvidas;
  }
  // Lucro proporcional ao que já foi pago — um pedido com pagamento parcial
  // não deve mostrar o lucro do evento inteiro, só o que já entrou.
  const lucroRecebidoMes = lucroRecebidoTotal(pedidosDoMes, ehComodato);
  const lucroPrevistoMes = lucroTotal(pedidosDoMes, ehComodato);

  const hoje = hojeISO();
  const contasPendentes = contasPagar.filter((c) => !c.pago);
  const aPagar = contasPendentes.reduce((soma, c) => soma + c.valor, 0);
  const contasVencidas = contasPendentes.filter((c) => c.vencimento < hoje);

  const emAberto = contabilizados.filter(
    (p) => calcularTotais(p, ehComodato).saldoAberto > 0.005,
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
          <div className="flex flex-wrap gap-2">
            {permissoes.agenda && (
              <button className="btn-primario" onClick={() => setAgendarAberto(true)}>
                <Plus className="h-4 w-4" />
                Agendar evento
              </button>
            )}
            {permissoes.pedidos && (
              <Link href="/admin/pedidos" className="btn-primario">
                <Plus className="h-4 w-4" />
                Novo pedido
              </Link>
            )}
          </div>
        }
      />

      <ModalAgendarEvento
        aberto={agendarAberto}
        aoFechar={() => setAgendarAberto(false)}
      />

      <div className="space-y-6 px-4 md:px-6">
        {/* --------------------------- Período --------------------------- */}
        {(permissoes.financeiro || permissoes.pedidos) && (
          <FiltroPeriodo
            de={dataInicial}
            ate={dataFinal}
            aoMudar={(de, ate) => {
              setDataInicial(de);
              setDataFinal(ate);
            }}
          />
        )}

        {/* --------------------------- Números --------------------------- */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {permissoes.financeiro && (
            <>
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
                rotulo="Faturado no período"
                valor={brl(faturadoMes)}
                // Largo pra caber o valor de cada grupo sem cortar.
                classe="col-span-2"
                detalhe={
                  <div className="mt-1">
                    <div className="space-y-0.5">
                      {GRUPOS_FATURADO.filter((g) => faturadoPorGrupo.get(g)! > 0.005).map((g) => (
                        <div key={g} className="flex justify-between gap-2">
                          <span className="truncate">{g}</span>
                          <span className="tabular-nums">{brl(faturadoPorGrupo.get(g)!)}</span>
                        </div>
                      ))}
                      {descontoMes > 0.005 && (
                        <div className="flex justify-between gap-2">
                          <span>Desconto</span>
                          <span className="tabular-nums">− {brl(descontoMes)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                }
              />
              <Cartao
                Icone={PiggyBank}
                rotulo="Lucro recebido"
                valor={brl(lucroRecebidoMes)}
                detalhe={
                  lucroPrevistoMes > lucroRecebidoMes
                    ? `de ${brl(lucroPrevistoMes)} previsto`
                    : faturadoMes > 0
                      ? "tudo recebido"
                      : "sem faturamento"
                }
              />
              <Cartao
                Icone={Armchair}
                rotulo="Comodato no período"
                valor={brl(comodatoPeriodo)}
                detalhe={`${comodatoUn} un cobradas`}
              />
            </>
          )}
          {permissoes.pedidos && (
            <>
              <Cartao
                Icone={CalendarDays}
                rotulo="Eventos no período"
                valor={String(eventosDoMes.length)}
                detalhe="pedidos no período"
              />
              <Cartao
                Icone={ClipboardList}
                rotulo="Pedidos"
                valor={String(ativos.length)}
                detalhe="no histórico"
              />
            </>
          )}
          {permissoes.clientes && (
            <Cartao
              Icone={Users}
              rotulo="Clientes"
              valor={String(clientes.filter((c) => c.ativo).length)}
              detalhe="ativos"
            />
          )}
          {permissoes.fornecedores && (
            <Cartao
              Icone={Truck}
              rotulo="Fornecedores"
              valor={String(fornecedores.filter((f) => f.ativo).length)}
              detalhe="cadastrados"
            />
          )}
        </div>

        {/* ------------------------ Contas em aberto ---------------------- */}
        {permissoes.financeiro && emAberto.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="h-4 w-4 text-acento" />
              Contas em aberto
            </h2>
            <ul className="card divide-y divide-borda overflow-hidden">
              {emAberto.slice(0, 6).map((p) => {
                const t = calcularTotais(p, ehComodato);
                return (
                  <li key={p.id}>
                    <Link
                      href={rotaPedido(p.id)}
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
        {permissoes.financeiro && contasPendentes.length > 0 && (
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
        {permissoes.pedidos && (
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
                const t = calcularTotais(p, ehComodato);
                return (
                  <li key={p.id}>
                    <Link
                      href={rotaPedido(p.id)}
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
        )}
      </div>
    </>
  );
}

/** Primeiro e último dia do mês (1–12), em YYYY-MM-DD. */
function mesInteiro(ano: number, mes: number): [string, string] {
  const mm = String(mes).padStart(2, "0");
  const ultimo = new Date(ano, mes, 0).getDate();
  return [`${ano}-${mm}-01`, `${ano}-${mm}-${String(ultimo).padStart(2, "0")}`];
}

/**
 * Um período só pra todos os quadros do Início (faturado, lucro, comodato,
 * eventos) — antes cada quadro tinha o seu De/Até, que esticava os cartões
 * e deixava olhar números de períodos diferentes sem perceber.
 */
function FiltroPeriodo({
  de,
  ate,
  aoMudar,
}: {
  de: string;
  ate: string;
  aoMudar: (de: string, ate: string) => void;
}) {
  const hoje = hojeISO();
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  const atalhos: { rotulo: string; de: string; ate: string }[] = [
    { rotulo: "Este mês", de: hoje.slice(0, 8) + "01", ate: hoje },
    {
      rotulo: "Mês passado",
      ...(() => {
        const [d, a] = mes === 1 ? mesInteiro(ano - 1, 12) : mesInteiro(ano, mes - 1);
        return { de: d, ate: a };
      })(),
    },
    { rotulo: "Este ano", de: `${ano}-01-01`, ate: hoje },
  ];

  return (
    <div className="card space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap gap-1.5">
        {atalhos.map((a) => (
          <button
            key={a.rotulo}
            type="button"
            onClick={() => aoMudar(a.de, a.ate)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              de === a.de && ate === a.ate
                ? "bg-acento text-acento-texto"
                : "border border-borda bg-superficie text-texto-suave hover:bg-superficie-2"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          aria-label="Data inicial"
          value={de}
          onChange={(e) => aoMudar(e.target.value, ate)}
          className="campo w-full min-w-0 px-2 py-1.5 text-xs"
        />
        <input
          type="date"
          aria-label="Data final"
          value={ate}
          onChange={(e) => aoMudar(de, e.target.value)}
          className="campo w-full min-w-0 px-2 py-1.5 text-xs"
        />
      </div>
    </div>
  );
}

const GRUPOS_FATURADO = [
  "Bebidas",
  "Descartáveis",
  "Gelo",
  "Aluguel estrutura",
  "Comodato",
] as const;
type GrupoFaturado = (typeof GRUPOS_FATURADO)[number];

/** Grupo do quadro de faturado pela categoria — o que não é dos outros é bebida. */
function grupoFaturado(categoria: string): GrupoFaturado {
  const c = normalizar(categoria);
  if (c.includes("comodato")) return "Comodato";
  if (c.includes("estrutura")) return "Aluguel estrutura";
  if (c.includes("gelo")) return "Gelo";
  if (c.includes("descartave")) return "Descartáveis";
  return "Bebidas";
}

function Cartao({
  Icone,
  rotulo,
  valor,
  detalhe,
  destaque = false,
  classe = "",
}: {
  Icone: ComponentType<{ className?: string }>;
  rotulo: string;
  valor: string;
  detalhe: ReactNode;
  destaque?: boolean;
  classe?: string;
}) {
  return (
    <div
      className={`card px-4 py-3 ${destaque ? "border-acento/40 bg-acento/5" : ""} ${classe}`}
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
