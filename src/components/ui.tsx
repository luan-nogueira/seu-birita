"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PedidoStatus, PedidoTipo } from "@/lib/types";

export function Cabecalho({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-5 pb-4 md:px-6 md:pt-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">
          {titulo}
        </h1>
        {subtitulo && (
          <p className="mt-1 text-sm text-texto-suave">{subtitulo}</p>
        )}
      </div>
      {acao}
    </div>
  );
}

export function Vazio({
  Icone,
  titulo,
  descricao,
  acao,
}: {
  Icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="card mx-4 flex flex-col items-center gap-3 px-6 py-14 text-center md:mx-6">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-superficie-2 text-texto-suave">
        <Icone className="h-7 w-7" />
      </div>
      <div>
        <p className="font-bold">{titulo}</p>
        {descricao && (
          <p className="mx-auto mt-1 max-w-sm text-sm text-texto-suave">
            {descricao}
          </p>
        )}
      </div>
      {acao}
    </div>
  );
}

/** Folhas (Modal) abertas agora — ver a trava do fundo no Modal. */
let modaisAbertos = 0;

/**
 * No celular sobe de baixo como uma folha; no desktop centraliza.
 * É o mesmo componente pros dois — só muda o posicionamento.
 * Renderiza em um React Portal para fugir de contextos de empilhamento (z-index)
 * de barras de navegação com position: sticky.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  largura?: string;
}) {
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  // Trava o fundo pra não rolar atrás da folha. Conta as folhas abertas em
  // vez de guardar o overflow anterior: com uma folha dentro da outra
  // (histórico + editar compra), salvar refazia o efeito das duas juntas,
  // cada uma guardava o "hidden" da outra e o fundo ficava travado depois
  // de fechar tudo — só voltava reabrindo o app.
  useEffect(() => {
    if (!aberto) return;
    modaisAbertos++;
    document.body.style.overflow = "hidden";
    return () => {
      modaisAbertos--;
      if (modaisAbertos === 0) document.body.style.overflow = "";
    };
  }, [aberto]);

  if (!aberto || !montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={aoFechar}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative flex max-h-[92dvh] w-full ${largura} flex-col
                    rounded-t-3xl border border-borda bg-superficie shadow-2xl
                    md:rounded-2xl`}
      >
        <div className="flex items-center gap-3 border-b border-borda px-5 py-4">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {rodape && (
          <div className="flex items-center justify-end gap-2 border-t border-borda px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {rodape}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const CORES_STATUS: Record<PedidoStatus, string> = {
  RASCUNHO: "bg-superficie-2 text-texto-suave",
  ESTOCADO: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  ENTREGUE: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ACERTO: "bg-ouro-100 text-ouro-900 dark:bg-ouro-900/40 dark:text-ouro-200",
  FINALIZADO:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  CANCELADO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const ROTULOS_STATUS: Record<PedidoStatus, string> = {
  RASCUNHO: "Rascunho",
  ESTOCADO: "Estocado",
  ENTREGUE: "Entregue",
  ACERTO: "Aguardando acerto",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};

export function StatusChip({ status }: { status: PedidoStatus }) {
  return (
    <span className={`chip ${CORES_STATUS[status]}`}>
      {ROTULOS_STATUS[status]}
    </span>
  );
}

export const ROTULO_STATUS = ROTULOS_STATUS;

export function TipoChip({ tipo }: { tipo: PedidoTipo }) {
  const consignacao = tipo === "CONSIGNACAO";
  return (
    <span
      className={`chip ${
        consignacao
          ? "bg-marrom-100 text-marrom-800 dark:bg-marrom-800 dark:text-marrom-100"
          : "bg-laranja/15 text-laranja"
      }`}
    >
      {consignacao ? "Consignação" : "Venda direta"}
    </span>
  );
}

/** Bloco de número grande usado nos resumos. */
export function Metrica({
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`card px-4 py-3 ${destaque ? "border-acento/40 bg-acento/5" : ""}`}
    >
      <p className="text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
        {rotulo}
      </p>
      <p
        className={`mt-1 text-xl font-black tabular-nums md:text-2xl ${
          destaque ? "text-acento" : ""
        }`}
      >
        {valor}
      </p>
      {detalhe && (
        <p className="mt-0.5 text-xs text-texto-suave">{detalhe}</p>
      )}
    </div>
  );
}
