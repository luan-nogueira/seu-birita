"use client";

import { useEffect } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useDados } from "@/lib/store";
import { dataBR, telefoneBR } from "@/lib/format";
import { compararCategorias } from "@/lib/calc";
import { EMPRESA } from "@/lib/empresa";
import type { PedidoItem } from "@/lib/types";

interface LinhaRomaneio {
  item: PedidoItem;
  categoria: string;
  cx: number;
  un: number;
}

export default function RomaneioPage() {
  const { id } = useParams<{ id: string }>();
  const { pedidoPorId, clientePorId, produtoPorId, carregando } = useDados();

  const pedido = pedidoPorId(id);

  // Antes dos returns abaixo: hook não pode ficar depois de um return
  // condicional, senão o React quebra quando o carregamento termina.
  useEffect(() => {
    if (!pedido) return;
    document.title = `Romaneio #${String(pedido.numero).padStart(3, "0")} - ${pedido.clienteNome}${pedido.titulo ? ` - ${pedido.titulo}` : ""}`;
  }, [pedido]);

  if (carregando) {
    return <p className="p-8 text-sm">Carregando…</p>;
  }

  if (!pedido) {
    return (
      <div className="p-8">
        <p className="font-bold">Pedido não encontrado.</p>
        <Link href="/admin/pedidos" className="btn-secundario mt-4">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    );
  }

  const cliente = clientePorId(pedido.clienteId);


  // Só o que tem alguma quantidade a carregar — sem preço, sem totais financeiros.
  // Soma cx e un exatamente como foram lançados na entrega, sem reconverter
  // pra caixa fechada — se a pessoa lançou 15 em "un", o romaneio mostra
  // 15 un, não 1 cx + 3 un.
  const linhas: LinhaRomaneio[] = pedido.itens
    .map((item) => {
      const cx = item.entregas.reduce((s, r) => s + r.cx, 0);
      const un = item.entregas.reduce((s, r) => s + r.un, 0);
      const categoria = produtoPorId(item.produtoId)?.categoria || "Outros";
      return { item, categoria, cx, un };
    })
    .filter((l) => l.cx > 0 || l.un > 0);

  const porCategoria = new Map<string, LinhaRomaneio[]>();
  for (const l of linhas) {
    if (!porCategoria.has(l.categoria)) porCategoria.set(l.categoria, []);
    porCategoria.get(l.categoria)!.push(l);
  }
  const categorias = Array.from(porCategoria.entries()).sort(([a], [b]) =>
    compararCategorias(a, b),
  );
  for (const [, lista] of categorias) {
    lista.sort((a, b) => a.item.nome.localeCompare(b.item.nome, "pt-BR"));
  }

  const totalCaixas = linhas.reduce((s, l) => s + l.cx, 0);
  const totalAvulsas = linhas.reduce((s, l) => s + l.un, 0);

  return (
    <div className="min-h-dvh bg-neutral-200 print:bg-white">
      {/* Barra de ações — não sai no papel */}
      <div className="nao-imprimir sticky top-0 z-10 flex items-center gap-2 border-b border-black/10 bg-barra px-4 py-3 text-barra-texto">
        <Link
          href={`/admin/pedidos/${pedido.id}`}
          className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10"
          aria-label="Voltar ao pedido"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          Romaneio #{String(pedido.numero).padStart(3, "0")} — {pedido.clienteNome}
        </p>
        <button className="btn-primario" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      <p className="nao-imprimir bg-ouro-100 px-4 py-2 text-center text-xs text-marrom-800">
        No celular, use <strong>Imprimir → Salvar como PDF</strong> pra mandar
        pro WhatsApp de quem vai carregar.
      </p>

      {/* Folha A4 */}
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-8 text-neutral-900 shadow-xl print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {/* ------------------------------ Timbre ------------------------------ */}
        <header className="evitar-quebra flex items-center gap-4 border-b-4 border-[#f5a31a] pb-4">
          <Logo className="h-16 w-auto shrink-0" variante="escura" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-wider text-neutral-500 uppercase">
              Romaneio de carga
            </p>
            <h1 className="text-[24px] leading-tight font-black text-[#3b1b0e]">
              {pedido.titulo || pedido.clienteNome}
            </h1>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[26px] leading-none font-black text-[#3b1b0e]">
              #{String(pedido.numero).padStart(3, "0")}
            </p>
            <p className="mt-1 text-[12px] text-neutral-600">
              {dataBR(pedido.dataEvento)}
            </p>
          </div>
        </header>

        {/* ------------------------- Cliente / entrega ------------------------- */}
        <section className="evitar-quebra mt-4 grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <p className="text-[10px] font-black tracking-wider text-neutral-500 uppercase">
              Cliente
            </p>
            <p className="font-bold">{pedido.clienteNome}</p>
            {cliente?.telefone && (
              <p className="text-neutral-600">{telefoneBR(cliente.telefone)}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black tracking-wider text-neutral-500 uppercase">
              Endereço de entrega
            </p>
            <p className="font-bold">{cliente?.endereco || "—"}</p>
            {cliente?.cidade && (
              <p className="text-neutral-600">{cliente.cidade}</p>
            )}
          </div>
        </section>

        {/* -------------------------------- Itens ------------------------------ */}
        {linhas.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-500">
            Nenhum item com quantidade lançada pra carregar ainda.
          </p>
        ) : (
          categorias.map(([categoria, lista]) => (
            <section key={categoria} className="evitar-quebra mt-6">
              <h2 className="mb-1 border-b-2 border-[#3b1b0e] pb-1 text-[13px] font-black tracking-wide text-[#3b1b0e] uppercase">
                {categoria}
              </h2>
              <table className="w-full border-collapse text-[14px]">
                <tbody>
                  {lista.map(({ item, cx, un }, i) => (
                    <tr
                      key={item.produtoId}
                      className={i % 2 ? "bg-[#fbf6ee]" : "bg-white"}
                    >
                      <td className="w-9 border-b border-neutral-200 px-2 py-2">
                        <span className="block h-5 w-5 rounded border-2 border-neutral-400" />
                      </td>
                      <td className="border-b border-neutral-200 px-2 py-2 font-semibold">
                        {item.nome}
                        {item.unPorCaixa > 1 && (
                          <span className="ml-1.5 text-[11px] text-neutral-500">
                            ({item.unPorCaixa} un/cx)
                          </span>
                        )}
                      </td>
                      <td className="border-b border-neutral-200 px-2 py-2 text-right font-black tabular-nums">
                        {cx > 0 && `${cx} cx`}
                        {cx > 0 && un > 0 && " + "}
                        {un > 0 && `${un} un`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        )}

        {/* ------------------------------- Total ------------------------------- */}
        {linhas.length > 0 && (
          <section className="evitar-quebra mt-6 flex justify-end">
            <div className="rounded-lg bg-[#3b1b0e] px-4 py-2.5 text-right text-[#f3dca6]">
              <p className="text-[10px] font-black tracking-wider uppercase">
                Total a carregar
              </p>
              <p className="text-[18px] font-black tabular-nums">
                {totalCaixas > 0 && `${totalCaixas} caixa${totalCaixas === 1 ? "" : "s"}`}
                {totalCaixas > 0 && totalAvulsas > 0 && " + "}
                {totalAvulsas > 0 &&
                  `${totalAvulsas} unidade${totalAvulsas === 1 ? "" : "s"} avulsa${totalAvulsas === 1 ? "" : "s"}`}
              </p>
            </div>
          </section>
        )}

        {pedido.obs && (
          <section className="evitar-quebra mt-5 rounded-lg border border-neutral-300 bg-[#fbf6ee] p-3">
            <p className="text-[9px] font-black tracking-wider text-neutral-500 uppercase">
              Observações
            </p>
            <p className="mt-1 text-[12px] whitespace-pre-wrap">{pedido.obs}</p>
          </section>
        )}

        <footer className="mt-8 border-t border-neutral-200 pt-3 text-center text-[9px] text-neutral-400">
          Romaneio gerado pelo sistema {EMPRESA.nome} em{" "}
          {new Date().toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </footer>
      </div>
    </div>
  );
}
