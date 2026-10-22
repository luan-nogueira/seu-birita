"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, ChevronDown, Search } from "lucide-react";
import { Cabecalho, Vazio } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { compararCategorias, pedidoContabilizado, saldoUn } from "@/lib/calc";
import { brl, caixasEUnidades, dataBR, hojeISO, normalizar } from "@/lib/format";
import { rotaPedido } from "@/lib/rotas";
import type { Pedido } from "@/lib/types";

/*
 * Quanto saiu de cada produto num período — "quanto de gelo eu vendi nesse
 * fim de semana". Conta o que o cliente consumiu (entregue − devolvido),
 * pela data do evento do pedido.
 */

/** Data local YYYY-MM-DD (toISOString passaria pro UTC). */
function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Atalhos de período. "Fim de semana" é sexta a domingo: o atual se hoje já
 * é sexta, sábado ou domingo; senão, o último que passou.
 */
function periodos() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const dia = hoje.getDate();
  const semana = hoje.getDay(); // 0 = domingo
  const voltaAteSexta = semana === 5 ? 0 : semana === 6 ? 1 : semana === 0 ? 2 : semana + 2;
  const sexta = new Date(ano, mes, dia - voltaAteSexta);
  const domingo = new Date(sexta.getFullYear(), sexta.getMonth(), sexta.getDate() + 2);
  const segunda = new Date(ano, mes, dia - ((semana + 6) % 7));
  return [
    { rotulo: "Fim de semana", de: isoLocal(sexta), ate: isoLocal(domingo) },
    { rotulo: "Esta semana", de: isoLocal(segunda), ate: hojeISO() },
    { rotulo: "Este mês", de: isoLocal(new Date(ano, mes, 1)), ate: hojeISO() },
    { rotulo: "Mês passado", de: isoLocal(new Date(ano, mes - 1, 1)), ate: isoLocal(new Date(ano, mes, 0)) },
    { rotulo: "Este ano", de: `${ano}-01-01`, ate: hojeISO() },
  ];
}

/** Pedido entregue que ainda não passou pro acerto — devolução pode faltar. */
function semAcerto(p: Pick<Pedido, "status">) {
  return p.status === "ENTREGUE";
}

type Ordem = "QTD" | "VALOR" | "NOME";

interface LinhaPedido {
  pedido: Pedido;
  un: number;
  valor: number;
}

interface LinhaProduto {
  produtoId: string;
  nome: string;
  categoria: string;
  unPorCaixa: number;
  un: number;
  valor: number;
  custo: number;
  pedidos: LinhaPedido[];
}

export default function VendasPage() {
  return (
    <Protegido chave="pedidos">
      <VendasPageInterno />
    </Protegido>
  );
}

function VendasPageInterno() {
  const { pedidos, produtoPorId, carregando } = useDados();
  const { permissoes } = useAuth();

  const [de, setDe] = useState(() => periodos()[0].de);
  const [ate, setAte] = useState(() => periodos()[0].ate);
  const [incluirEntregues, setIncluirEntregues] = useState(false);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("QTD");
  const [aberto, setAberto] = useState<string | null>(null);

  const noPeriodo = useMemo(
    () =>
      pedidos.filter((p) => {
        const d = p.dataEvento.slice(0, 10);
        return !(de && d < de) && !(ate && d > ate);
      }),
    [pedidos, de, ate],
  );

  const pendentes = noPeriodo.filter(semAcerto).length;

  const linhas = useMemo(() => {
    const mapa = new Map<string, LinhaProduto>();
    for (const pedido of noPeriodo) {
      if (!pedidoContabilizado(pedido) && !(incluirEntregues && semAcerto(pedido))) continue;
      for (const item of pedido.itens) {
        const un = saldoUn(item, pedido.tipo);
        if (un === 0) continue;
        const produto = produtoPorId(item.produtoId);
        let linha = mapa.get(item.produtoId);
        if (!linha) {
          linha = {
            produtoId: item.produtoId,
            nome: produto?.nome ?? item.nome,
            categoria: produto?.categoria ?? "",
            unPorCaixa: produto?.unPorCaixa ?? item.unPorCaixa,
            un: 0,
            valor: 0,
            custo: 0,
            pedidos: [],
          };
          mapa.set(item.produtoId, linha);
        }
        const valor = un * item.precoUn;
        linha.un += un;
        linha.valor += valor;
        linha.custo += un * (item.custoUn || 0);
        linha.pedidos.push({ pedido, un, valor });
      }
    }
    for (const l of mapa.values()) {
      l.pedidos.sort((a, b) => b.pedido.dataEvento.localeCompare(a.pedido.dataEvento));
    }
    return Array.from(mapa.values());
  }, [noPeriodo, incluirEntregues, produtoPorId]);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca);
    const lista = termo
      ? linhas.filter(
          (l) => normalizar(l.nome).includes(termo) || normalizar(l.categoria).includes(termo),
        )
      : linhas;
    return [...lista].sort((a, b) => {
      if (ordem === "VALOR") return b.valor - a.valor;
      if (ordem === "NOME") return a.nome.localeCompare(b.nome, "pt-BR");
      // Caixas primeiro: 10 cx de cerveja é mais que 30 un de gelo.
      return b.un / b.unPorCaixa - a.un / a.unPorCaixa || b.un - a.un;
    });
  }, [linhas, busca, ordem]);

  // Agrupa por categoria na ordem de sempre (gelo, descartáveis, comodato no fim).
  const grupos = useMemo(() => {
    const mapa = new Map<string, LinhaProduto[]>();
    for (const l of filtradas) {
      const cat = l.categoria || "Sem categoria";
      if (!mapa.has(cat)) mapa.set(cat, []);
      mapa.get(cat)!.push(l);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => compararCategorias(a, b));
  }, [filtradas]);

  const totais = useMemo(() => {
    const pedidosContados = new Set<string>();
    let valor = 0;
    let custo = 0;
    for (const l of filtradas) {
      valor += l.valor;
      custo += l.custo;
      for (const p of l.pedidos) pedidosContados.add(p.pedido.id);
    }
    return { valor, custo, pedidos: pedidosContados.size };
  }, [filtradas]);

  const verCusto = permissoes.verCusto;

  return (
    <>
      <Cabecalho
        titulo="Vendas por produto"
        subtitulo={
          carregando
            ? "Carregando…"
            : de && ate && de === ate
              ? `Em ${dataBR(de)}`
              : `De ${dataBR(de) || "o início"} até ${dataBR(ate) || "hoje"}`
        }
      />

      <div className="px-4 md:px-6">
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {periodos().map((p) => {
            const ativo = p.de === de && p.ate === ate;
            return (
              <button
                key={p.rotulo}
                onClick={() => {
                  setDe(p.de);
                  setAte(p.ate);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  ativo
                    ? "bg-acento text-acento-texto"
                    : "border border-borda bg-superficie text-texto-suave hover:bg-superficie-2"
                }`}
              >
                {p.rotulo}
              </button>
            );
          })}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="rotulo" htmlFor="vendas-de">
              De
            </label>
            <input
              id="vendas-de"
              type="date"
              className="campo w-full min-w-0"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="rotulo" htmlFor="vendas-ate">
              Até
            </label>
            <input
              id="vendas-ate"
              type="date"
              className="campo w-full min-w-0"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
            <input
              className="campo pl-9"
              placeholder="Buscar produto (ex.: gelo)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <select
            className="campo"
            aria-label="Ordenar"
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordem)}
          >
            <option value="QTD">Mais vendidos (quantidade)</option>
            <option value="VALOR">Mais vendidos (R$)</option>
            <option value="NOME">Nome A–Z</option>
          </select>
        </div>

        {pendentes > 0 && (
          <label className="card mb-3 flex cursor-pointer items-start gap-3 px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--acento)]"
              checked={incluirEntregues}
              onChange={(e) => setIncluirEntregues(e.target.checked)}
            />
            <span>
              <span className="font-semibold">
                Incluir {pendentes} {pendentes === 1 ? "pedido entregue" : "pedidos entregues"} sem
                acerto
              </span>
              <span className="mt-0.5 block text-xs text-texto-suave">
                Ainda não passaram pro acerto, então a devolução pode não estar lançada — conta
                tudo o que saiu.
              </span>
            </span>
          </label>
        )}

        {!carregando && filtradas.length > 0 && (
          <div className="card mb-4 border-acento/40 bg-acento/5 px-4 py-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
                  Vendido no período
                </p>
                <p className="mt-1 text-2xl font-black text-acento tabular-nums">
                  {brl(totais.valor)}
                </p>
                <p className="mt-0.5 text-xs text-texto-suave">
                  {filtradas.length} {filtradas.length === 1 ? "produto" : "produtos"} ·{" "}
                  {totais.pedidos} {totais.pedidos === 1 ? "pedido" : "pedidos"}
                </p>
              </div>
              {verCusto && (
                <div className="shrink-0 space-y-0.5 text-right text-xs text-texto-suave">
                  <p>
                    Custo{" "}
                    <span className="font-bold text-texto tabular-nums">{brl(totais.custo)}</span>
                  </p>
                  <p>
                    Lucro bruto{" "}
                    <span className="font-bold text-texto tabular-nums">
                      {brl(totais.valor - totais.custo)}
                    </span>
                  </p>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-texto-suave">
              Valores pelo preço de cada pedido, sem os descontos dados no fechamento. Toque num
              produto pra ver os pedidos.
            </p>
          </div>
        )}
      </div>

      {!carregando && filtradas.length === 0 && (
        <Vazio
          Icone={BarChart3}
          titulo={busca ? "Nenhum produto encontrado" : "Nenhuma venda nesse período"}
          descricao={
            pendentes > 0 && !incluirEntregues
              ? "Os pedidos desse período ainda estão como Entregue — marque a opção acima pra contar eles também."
              : "Só contam pedidos em Aguardando acerto ou Finalizado, pela data do evento."
          }
        />
      )}

      <div className="space-y-5 px-4 pb-6 md:px-6">
        {grupos.map(([categoria, itens]) => (
          <section key={categoria}>
            <h2 className="mb-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
              {categoria}
            </h2>
            <ul className="card divide-y divide-borda overflow-hidden">
              {itens.map((l) => (
                <LinhaVenda
                  key={l.produtoId}
                  linha={l}
                  aberto={aberto === l.produtoId}
                  alternar={() => setAberto(aberto === l.produtoId ? null : l.produtoId)}
                  verCusto={verCusto}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function LinhaVenda({
  linha: l,
  aberto,
  alternar,
  verCusto,
}: {
  linha: LinhaProduto;
  aberto: boolean;
  alternar: () => void;
  verCusto: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-superficie-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{l.nome}</p>
          <p className="mt-0.5 truncate text-xs text-texto-suave">
            {l.pedidos.length} {l.pedidos.length === 1 ? "pedido" : "pedidos"}
            {verCusto && l.valor > 0 && ` · lucro ${brl(l.valor - l.custo)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-black tabular-nums">{caixasEUnidades(l.un, l.unPorCaixa)}</p>
          <p className="text-[11px] text-texto-suave tabular-nums">
            {l.unPorCaixa > 1 && `${l.un} un · `}
            {brl(l.valor)}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-texto-suave transition ${aberto ? "rotate-180" : ""}`}
        />
      </button>
      {aberto && (
        <ul className="divide-y divide-borda border-t border-borda bg-superficie-2/50 text-sm">
          {l.pedidos.map(({ pedido, un, valor }) => (
            <li key={pedido.id}>
              <Link
                href={rotaPedido(pedido.id)}
                className="flex items-center gap-3 px-4 py-2 pl-6 transition hover:bg-superficie-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pedido.clienteNome}</p>
                  <p className="truncate text-xs text-texto-suave">
                    #{pedido.numero} · {dataBR(pedido.dataEvento)}
                    {pedido.titulo && ` · ${pedido.titulo}`}
                    {semAcerto(pedido) && " · sem acerto"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums">{caixasEUnidades(un, l.unPorCaixa)}</p>
                  <p className="text-[11px] text-texto-suave tabular-nums">{brl(valor)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
