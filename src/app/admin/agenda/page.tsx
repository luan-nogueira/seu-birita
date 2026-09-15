"use client";

import { useMemo, useState } from "react";
import { Cabecalho } from "@/components/ui";
import { ModalAgendarEvento } from "@/components/ModalAgendarEvento";
import { useDados } from "@/lib/store";
import { Calendar, MapPin, Phone, Package, Info, Plus } from "lucide-react";

export default function AgendaPage() {
  const { pedidosClientes } = useDados();
  const [agendarAberto, setAgendarAberto] = useState(false);

  const eventos = useMemo(() => {
    return pedidosClientes
      .filter((p) => p.dataEvento && p.status !== "CANCELADO")
      .sort((a, b) => {
        // Ordena pela data mais próxima (crescente)
        const dataA = new Date(a.dataEvento!).getTime();
        const dataB = new Date(b.dataEvento!).getTime();
        return dataA - dataB;
      });
  }, [pedidosClientes]);

  // Função para formatar a data
  const formatarData = (dataStr: string) => {
    const d = new Date(dataStr + "T12:00:00"); // forçar timezone local
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }).format(d);
  };

  const telefoneBR = (t: string) => {
    const limpo = t.replace(/\D/g, "");
    if (limpo.length === 11)
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
    if (limpo.length === 10)
      return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
    return t;
  };

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return (
    <>
      <Cabecalho
        titulo="Agenda"
        subtitulo={
          eventos.length === 0
            ? "Nenhum evento agendado"
            : `${eventos.length} evento(s) agendado(s)`
        }
        acao={
          <button className="btn-primario" onClick={() => setAgendarAberto(true)}>
            <Plus className="h-4 w-4" />
            Agendar evento
          </button>
        }
      />

      <ModalAgendarEvento
        aberto={agendarAberto}
        aoFechar={() => setAgendarAberto(false)}
      />

      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
        {eventos.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-superficie-2 text-texto-suave">
              <Calendar className="h-7 w-7" />
            </div>
            <p className="font-bold">Sua agenda está vazia</p>
            <p className="text-sm text-texto-suave max-w-xs">
              Pedidos online que tiverem uma "Data do evento" aparecerão
              automaticamente aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {eventos.map((pedido) => {
              const dataPedido = new Date(pedido.dataEvento! + "T12:00:00");
              const isPassado = dataPedido < hoje;
              const isHoje = dataPedido.getTime() === hoje.getTime();

              return (
                <div
                  key={pedido.id}
                  className={`card relative overflow-hidden transition-all hover:shadow-lg ${
                    isPassado ? "opacity-60 grayscale-[0.5]" : ""
                  }`}
                >
                  {isHoje && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-green-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white z-10 shadow-sm">
                      Hoje
                    </div>
                  )}
                  {pedido.status === "CONFIRMADO" && !isHoje && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-blue-500 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white z-10 shadow-sm">
                      Confirmado
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row">
                    {/* Coluna da Data */}
                    <div className="flex items-center gap-4 border-b border-borda bg-superficie-2 p-4 md:w-48 md:flex-col md:items-start md:justify-center md:border-b-0 md:border-r relative overflow-hidden">
                      {/* Padrão de bolinhas sutis de fundo */}
                      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-acento to-ouro-500 text-acento-texto shadow-sm relative z-10">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div className="relative z-10">
                        <p className="text-sm font-semibold capitalize text-acento">
                          {formatarData(pedido.dataEvento!)}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-texto-suave mt-0.5">
                          Pedido #{String(pedido.numero).padStart(4, "0")}
                        </p>
                      </div>
                    </div>

                    {/* Conteúdo Principal */}
                    <div className="flex flex-1 flex-col p-4 md:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-black leading-tight text-texto">
                            {pedido.nomeCliente}
                          </h3>
                          <a
                            href={`https://wa.me/55${pedido.telefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-acento w-fit transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {telefoneBR(pedido.telefone)}
                          </a>
                        </div>
                      </div>

                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-borda/50 bg-superficie-2 p-3 text-sm text-texto-suave shadow-sm">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-acento" />
                        <span className="leading-snug">{pedido.localEvento}</span>
                      </div>

                      {pedido.obs && (
                        <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 border border-amber-200 dark:border-amber-900/50 shadow-sm">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                          <span className="leading-snug font-medium">{pedido.obs}</span>
                        </div>
                      )}

                      <div className="mt-4 border-t border-borda pt-4">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-texto-suave">
                          <Package className="h-3.5 w-3.5" /> Resumo dos itens
                        </p>
                        <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                          {pedido.itens.map((item) => {
                            const resumoStr = [];
                            if (item.cx > 0) resumoStr.push(`${item.cx}cx`);
                            if (item.un > 0 || item.cx === 0) resumoStr.push(`${item.un}un`);
                            
                            return (
                              <li
                                key={item.produtoId}
                                className="flex items-start gap-2 text-sm text-texto-suave"
                              >
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-acento/50" />
                                <span className="font-bold text-texto w-12 text-right shrink-0">
                                  {resumoStr.join("+")}
                                </span>
                                <span className="truncate">{item.nome}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
