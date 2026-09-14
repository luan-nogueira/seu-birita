"use client";

/**
 * Campo de quantidade otimizado pra digitação rápida no celular:
 * teclado numérico, zero aparece vazio (menos ruído visual ao preencher
 * dezenas de linhas) e seleciona tudo ao focar.
 */
export function CampoQtd({
  valor,
  aoMudar,
  rotulo,
  className = "",
  desabilitado = false,
}: {
  valor: number;
  aoMudar: (v: number) => void;
  rotulo: string;
  className?: string;
  desabilitado?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={rotulo}
      disabled={desabilitado}
      value={valor || ""}
      placeholder="0"
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const limpo = e.target.value.replace(/\D/g, "");
        aoMudar(limpo === "" ? 0 : Math.min(999999, parseInt(limpo, 10)));
      }}
      className={`w-full rounded-lg border border-borda bg-superficie px-2 py-2
                  text-center font-semibold tabular-nums outline-none transition
                  placeholder:font-normal placeholder:text-texto-suave/40
                  focus:border-acento focus:ring-2 focus:ring-acento/25
                  disabled:opacity-40 ${className}`}
    />
  );
}
