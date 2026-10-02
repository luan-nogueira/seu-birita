"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/** Botão que compartilha (ou copia) o link da tabela de preços com o preço daquela tabela. */
export function BotaoCompartilharTabela({ tabela }: { tabela: 1 | 2 | 3 }) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const sufixo = tabela === 1 ? "" : `?tabela=${tabela}`;
    const url = `${window.location.origin}/${sufixo}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Seu Birita — Tabela de preços", url });
        return;
      } catch {
        // Cancelou o compartilhamento — não faz nada.
        return;
      }
    }

    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      className="btn-secundario text-sm"
    >
      {copiado ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      Tabela {tabela}
      {copiado && <span className="text-xs">· copiado!</span>}
    </button>
  );
}

/** As três tabelas lado a lado, com o rótulo — usado em Produtos e em Pedidos online. */
export function CompartilharTabelas() {
  return (
    <>
      <p className="mb-2 text-xs font-semibold tracking-wide text-texto-suave uppercase">
        Compartilhar tabela de preços
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <BotaoCompartilharTabela tabela={1} />
        <BotaoCompartilharTabela tabela={2} />
        <BotaoCompartilharTabela tabela={3} />
      </div>
    </>
  );
}
