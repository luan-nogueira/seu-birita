"use client";

import { useEffect } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useDados } from "@/lib/store";
import {
  calcularTotais,
  compararCategorias,
  devolvidoUn,
  entregueUn,
  saldoUn,
  valorFinalItem,
  valorPedidoItem,
} from "@/lib/calc";
import { brl, brlOuTraco, dataBR, num, telefoneBR } from "@/lib/format";
import { EMPRESA } from "@/lib/empresa";

export default function RelatorioPage() {
  const { id } = useParams<{ id: string }>();
  const { pedidoPorId, clientePorId, produtoPorId, carregando } = useDados();

  const pedido = pedidoPorId(id);

  // Antes dos returns abaixo: hook não pode ficar depois de um return
  // condicional, senão o React quebra quando o carregamento termina.
  useEffect(() => {
    if (!pedido) return;
    document.title = `Pedido #${String(pedido.numero).padStart(3, "0")} - ${pedido.clienteNome}${pedido.titulo ? ` - ${pedido.titulo}` : ""}`;
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
  const totais = calcularTotais(pedido);
  const consignacao = pedido.tipo === "CONSIGNACAO";

  // Itens sem nenhuma movimentação só poluem o documento.
  const itens = pedido.itens.filter((i) => entregueUn(i) > 0);

  const gruposPorCategoria = new Map<string, typeof itens>();
  itens.forEach((item) => {
    const categoria = produtoPorId(item.produtoId)?.categoria || "Sem categoria";
    if (!gruposPorCategoria.has(categoria)) gruposPorCategoria.set(categoria, []);
    gruposPorCategoria.get(categoria)!.push(item);
  });
  const categoriasItens = Array.from(gruposPorCategoria.entries()).sort(([a], [b]) =>
    compararCategorias(a, b),
  );
  const totalColunas = 7 + (consignacao ? 3 : 0);

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
          Relatório #{String(pedido.numero).padStart(3, "0")} —{" "}
          {pedido.clienteNome}
        </p>
        <button className="btn-primario" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir / PDF
        </button>
      </div>

      <p className="nao-imprimir bg-ouro-100 px-4 py-2 text-center text-xs text-marrom-800">
        No celular, use <strong>Imprimir → Salvar como PDF</strong> pra mandar
        o arquivo no WhatsApp.
      </p>

      {/* Folha A4 */}
      <div className="mx-auto my-6 max-w-[210mm] bg-white p-8 text-[13px] leading-normal text-neutral-900 shadow-xl print:my-0 print:max-w-none print:p-0 print:shadow-none">
        {/* ------------------------------ Timbre ------------------------------ */}
        <header className="evitar-quebra flex items-start gap-5 border-b-4 border-[#f5a31a] pb-5">
          <Logo className="h-24 w-auto shrink-0" variante="escura" />

          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] leading-tight font-black text-[#3b1b0e]">
              {EMPRESA.nome}
            </h1>
            <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
              {EMPRESA.documento && <>CNPJ {EMPRESA.documento} · </>}
              {EMPRESA.telefone && <>{telefoneBR(EMPRESA.telefone)}</>}
              {EMPRESA.endereco && (
                <>
                  <br />
                  {EMPRESA.endereco}
                </>
              )}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="rounded-md bg-[#3b1b0e] px-3 py-1 text-[10px] font-black tracking-wider text-[#f3dca6] uppercase">
              {consignacao ? "Acerto de consignação" : "Comprovante de venda"}
            </p>
            <p className="mt-2 text-[26px] leading-none font-black text-[#3b1b0e]">
              #{String(pedido.numero).padStart(3, "0")}
            </p>
            <p className="mt-1 text-[11px] text-neutral-600">
              {dataBR(pedido.dataEvento)}
            </p>
          </div>
        </header>

        {/* ------------------------------ Cliente ----------------------------- */}
        <section className="evitar-quebra mt-5 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-neutral-300 p-3">
            <p className="text-[9px] font-black tracking-wider text-neutral-500 uppercase">
              Cliente
            </p>
            <p className="mt-1 text-[15px] font-bold">{pedido.clienteNome}</p>
            <div className="mt-1 space-y-0.5 text-[11px] text-neutral-600">
              {cliente?.documento && (
                <p>
                  {cliente.tipo === "PJ" ? "CNPJ" : "CPF"} {cliente.documento}
                </p>
              )}
              {cliente?.telefone && <p>{telefoneBR(cliente.telefone)}</p>}
              {cliente?.endereco && <p>{cliente.endereco}</p>}
              {cliente?.cidade && <p>{cliente.cidade}</p>}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-300 p-3">
            <p className="text-[9px] font-black tracking-wider text-neutral-500 uppercase">
              Evento
            </p>
            <p className="mt-1 text-[15px] font-bold">
              {pedido.titulo || "—"}
            </p>
            <div className="mt-1 space-y-0.5 text-[11px] text-neutral-600">
              <p>Data: {dataBR(pedido.dataEvento)}</p>
              <p>
                Modalidade: {consignacao ? "Consignação" : "Venda direta"}
              </p>
              <p>Itens: {itens.length}</p>
            </div>
          </div>
        </section>

        {/* ------------------------------- Itens ------------------------------ */}
        <table className="mt-5 w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#3b1b0e] text-[#f3dca6]">
              <th className="px-2 py-2 text-left font-bold" rowSpan={2}>Produto</th>
              <th className="px-1 py-1 text-center font-bold border-b border-[#f3dca6]/20" colSpan={3}>Entregue</th>
              {consignacao && (
                <th className="px-1 py-1 text-center font-bold border-b border-[#f3dca6]/20" colSpan={3}>Devolvido</th>
              )}
              <th className="px-2 py-2 text-right font-bold" rowSpan={2}>
                {consignacao ? "Consumo" : "Qtd"}
              </th>
              <th className="px-2 py-2 text-right font-bold" rowSpan={2}>Valor un</th>
              <th className="px-2 py-2 text-right font-bold" rowSpan={2}>Total</th>
            </tr>
            <tr className="bg-[#3b1b0e] text-[#f3dca6]">
              <th className="px-1 py-1 text-right font-bold text-[9px] uppercase">Cx</th>
              <th className="px-1 py-1 text-right font-bold text-[9px] uppercase">Un</th>
              <th className="px-1 py-1 text-right font-bold text-[9px] uppercase">Total</th>
              {consignacao && (
                <>
                  <th className="px-1 py-1 text-right font-bold text-[9px] uppercase">Cx</th>
                  <th className="px-1 py-1 text-right font-bold text-[9px] uppercase">Un</th>
                  <th className="px-1 py-1 text-right font-bold text-[9px] uppercase">Total</th>
                </>
              )}
            </tr>
          </thead>

          {categoriasItens.map(([categoria, itensCategoria]) => (
            <tbody key={categoria}>
              <tr className="evitar-quebra bg-[#f3dca6]">
                <td
                  colSpan={totalColunas}
                  className="px-2 py-1 text-[10px] font-black tracking-wider text-[#3b1b0e] uppercase"
                >
                  {categoria}
                </td>
              </tr>
              {itensCategoria.map((item, i) => {
                const entregue = entregueUn(item);
                const devolvido = devolvidoUn(item, pedido.tipo);
                const saldo = saldoUn(item, pedido.tipo);

                // Cx e un exatamente como foram digitados no pedido, sem
                // reconverter (6 cx + 34 un não vira 7 cx + 10 un) — igual
                // ao romaneio.
                const entrCx = item.entregas.reduce((s, r) => s + (r.cx || 0), 0);
                const entrUn = item.entregas.reduce((s, r) => s + (r.un || 0), 0);

                const devCx = consignacao ? item.devolucaoCx || 0 : 0;
                const devUn = consignacao ? item.devolucaoUn || 0 : 0;

                return (
                  <tr
                    key={`${item.produtoId}-${i}`}
                    className={i % 2 ? "bg-[#fbf6ee]" : "bg-white"}
                  >
                    <td className="border-b border-neutral-200 px-2 py-1.5">
                      <span className="font-semibold">{item.nome}</span>
                      {item.unPorCaixa > 1 && (
                        <span className="ml-1.5 text-[10px] text-neutral-500">
                          ({item.unPorCaixa} un/cx)
                        </span>
                      )}
                    </td>
                    <td className="border-b border-neutral-200 px-1 py-1.5 text-right tabular-nums text-neutral-500">
                      {item.unPorCaixa > 1 && entrCx > 0 ? num(entrCx) : "—"}
                    </td>
                    <td className="border-b border-neutral-200 px-1 py-1.5 text-right tabular-nums text-neutral-500">
                      {item.unPorCaixa > 1 && entrUn > 0 ? num(entrUn) : "—"}
                    </td>
                    <td className="border-b border-neutral-200 px-1 py-1.5 text-right font-semibold tabular-nums">
                      {num(entregue)}
                    </td>

                    {consignacao && (
                      <>
                        <td className="border-b border-neutral-200 px-1 py-1.5 text-right tabular-nums text-neutral-400">
                          {item.unPorCaixa > 1 && devCx > 0 ? num(devCx) : "—"}
                        </td>
                        <td className="border-b border-neutral-200 px-1 py-1.5 text-right tabular-nums text-neutral-400">
                          {item.unPorCaixa > 1 && devUn > 0 ? num(devUn) : "—"}
                        </td>
                        <td className="border-b border-neutral-200 px-1 py-1.5 text-right tabular-nums text-neutral-600">
                          {devolvido > 0 ? num(devolvido) : "—"}
                        </td>
                      </>
                    )}
                    <td className="border-b border-neutral-200 px-2 py-1.5 text-right font-bold tabular-nums">
                      {num(saldo)}
                    </td>
                    <td className="border-b border-neutral-200 px-2 py-1.5 text-right tabular-nums">
                      {brl(item.precoUn)}
                    </td>
                    <td className="border-b border-neutral-200 px-2 py-1.5 text-right font-bold tabular-nums">
                      {brlOuTraco(valorFinalItem(item, pedido.tipo))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}

          <tfoot>
            <tr className="border-t-2 border-[#3b1b0e] font-bold">
              <td className="px-2 py-2">Totais</td>
              <td colSpan={2} />
              <td className="px-1 py-2 text-right tabular-nums">
                {num(totais.unidadesEntregues)}
              </td>
              {consignacao && (
                <>
                  <td colSpan={2} />
                  <td className="px-1 py-2 text-right tabular-nums">
                    {num(totais.unidadesDevolvidas)}
                  </td>
                </>
              )}
              <td className="px-2 py-2 text-right tabular-nums">
                {num(totais.unidadesConsumidas)}
              </td>
              <td />
              <td className="px-2 py-2 text-right tabular-nums">
                {brl(totais.valorFinal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ------------------------------ Fechamento -------------------------- */}
        <section className="evitar-quebra mt-6 flex justify-end">
          <div className="w-full max-w-[300px] space-y-1 text-[12px]">
            {consignacao && (
              <Linha
                rotulo="Mercadoria entregue"
                valor={brl(totais.valorPedido)}
                suave
              />
            )}
            {consignacao && (
              <Linha
                rotulo="Devolução"
                valor={`− ${brl(totais.valorPedido - totais.valorFinal)}`}
                suave
              />
            )}
            <Linha
              rotulo={consignacao ? "Consumo do evento" : "Total vendido"}
              valor={brl(totais.valorFinal)}
            />
            {totais.desconto > 0 && (
              <Linha rotulo="Desconto" valor={`− ${brl(totais.desconto)}`} />
            )}
            {totais.pendenciaAnterior !== 0 && (
              <Linha
                rotulo="Pendência anterior"
                valor={`+ ${brl(totais.pendenciaAnterior)}`}
              />
            )}
            {totais.valorPago > 0 && (
              <Linha rotulo="Pago" valor={`− ${brl(totais.valorPago)}`} />
            )}

            <div className="!mt-3 flex items-baseline justify-between rounded-lg bg-[#3b1b0e] px-3 py-2.5 text-[#f3dca6]">
              <span className="text-[11px] font-black tracking-wider uppercase">
                {totais.saldoAberto > 0.005 ? "Total a pagar" : "Quitado"}
              </span>
              <span className="text-[19px] font-black tabular-nums">
                {brl(Math.max(0, totais.saldoAberto))}
              </span>
            </div>
          </div>
        </section>

        {pedido.obs && (
          <section className="evitar-quebra mt-5 rounded-lg border border-neutral-300 bg-[#fbf6ee] p-3">
            <p className="text-[9px] font-black tracking-wider text-neutral-500 uppercase">
              Observações
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11px]">{pedido.obs}</p>
          </section>
        )}

        {/* ----------------------------- Assinaturas -------------------------- */}
        <section className="evitar-quebra mt-12 grid grid-cols-2 gap-10">
          <div className="border-t border-neutral-400 pt-1.5 text-center text-[10px] text-neutral-600">
            {EMPRESA.nome}
          </div>
          <div className="border-t border-neutral-400 pt-1.5 text-center text-[10px] text-neutral-600">
            {pedido.clienteNome}
          </div>
        </section>

        <footer className="mt-8 border-t border-neutral-200 pt-3 text-center text-[9px] text-neutral-400">
          Documento gerado pelo sistema {EMPRESA.nome} em{" "}
          {new Date().toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </footer>
      </div>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  suave = false,
}: {
  rotulo: string;
  valor: string;
  suave?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-neutral-200 pb-1 ${
        suave ? "text-neutral-500" : ""
      }`}
    >
      <span>{rotulo}</span>
      <span className="font-semibold tabular-nums">{valor}</span>
    </div>
  );
}
