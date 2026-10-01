"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

const INTERVALO_MS = 5 * 60 * 1000;

/**
 * App instalado na tela inicial (iPhone principalmente) fica aberto em
 * segundo plano por dias e nunca recarrega — o Luifer continuava vendo a
 * versão antiga depois de um deploy. Ao voltar pro app (e a cada 5 min com
 * ele aberto), compara a versão carregada (data-dpl-id, que o Next põe no
 * <html> a partir do deploymentId) com a que está no ar e oferece atualizar.
 * Não recarrega sozinho pra não perder algo sendo digitado num pedido.
 */
export function AvisoNovaVersao() {
  const [desatualizado, setDesatualizado] = useState(false);

  useEffect(() => {
    const carregada = document.documentElement.dataset.dplId;
    // Sem deploymentId (rodando local) não há o que comparar.
    if (!carregada) return;

    async function verificar() {
      if (document.visibilityState !== "visible") return;
      try {
        const resp = await fetch("/api/versao", { cache: "no-store" });
        if (!resp.ok) return;
        const { versao } = (await resp.json()) as { versao: string };
        if (versao && versao !== carregada) setDesatualizado(true);
      } catch {
        // Sem internet: tenta de novo na próxima.
      }
    }

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_MS);
    document.addEventListener("visibilitychange", verificar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificar);
    };
  }, []);

  if (!desatualizado) return null;

  return (
    <div className="nao-imprimir fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-barra px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 text-sm text-barra-texto shadow-lg">
      <span>Tem uma versão nova do sistema.</span>
      <button
        className="btn-primario shrink-0 px-3 py-1.5"
        onClick={() => window.location.reload()}
      >
        <RefreshCw className="h-4 w-4" />
        Atualizar
      </button>
    </div>
  );
}
