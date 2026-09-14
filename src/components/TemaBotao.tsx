"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Tema = "claro" | "escuro";
const CHAVE = "seubirita:tema";

/** Lê a preferência salva; sem nada salvo, segue o sistema. */
function temaInicial(): Tema {
  if (typeof window === "undefined") return "claro";
  const salvo = window.localStorage.getItem(CHAVE) as Tema | null;
  if (salvo === "claro" || salvo === "escuro") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "escuro"
    : "claro";
}

export function TemaBotao({ className = "" }: { className?: string }) {
  const [tema, setTema] = useState<Tema>("claro");
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setTema(temaInicial());
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    document.documentElement.dataset.tema = tema;
    window.localStorage.setItem(CHAVE, tema);
  }, [tema, montado]);

  // Sem isso o ícone renderizado no servidor briga com o do cliente.
  if (!montado) return <span className={className} aria-hidden />;

  const proximo = tema === "claro" ? "escuro" : "claro";

  return (
    <button
      type="button"
      onClick={() => setTema(proximo)}
      className={`grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10 ${className}`}
      title={`Mudar para o tema ${proximo}`}
      aria-label={`Mudar para o tema ${proximo}`}
    >
      {tema === "claro" ? (
        <Moon className="h-[18px] w-[18px]" />
      ) : (
        <Sun className="h-[18px] w-[18px]" />
      )}
    </button>
  );
}

/**
 * Aplica o tema salvo antes da primeira pintura, evitando o "flash branco"
 * de quem usa o tema escuro. Roda como script inline no <head>.
 */
export const SCRIPT_TEMA = `
(function () {
  try {
    var t = localStorage.getItem("${CHAVE}");
    if (t !== "claro" && t !== "escuro") {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "escuro"
        : "claro";
    }
    document.documentElement.dataset.tema = t;
  } catch (e) {}
})();
`;
