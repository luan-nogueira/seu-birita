"use client";

const CONTORNO = "#0D0D1F";
const CREME = "#FDE68A";
const OURO = "#F59E0B";

/**
 * Logo da Seu Birita em SVG puro.
 * Quando existir um /public/logo.png, basta trocar o retorno do componente
 * por um <img src="/logo.png" … />.
 */
export function Logo({
  className = "",
  variante = "auto",
}: {
  className?: string;
  /** "clara" = fundo escuro atrás; "escura" = fundo claro atrás. */
  variante?: "clara" | "escura" | "auto";
}) {
  return <LetreiroSVG className={className} variante={variante} />;
}

/**
 * Reconstrução do letreiro: "SEU" em creme, "BIRITA" em ouro com um copo de
 * chope no lugar do "I", tudo contornado de marrom, e a legenda embaixo.
 *
 * O "B" e o "RITA" são âncorados nas bordas opostas do copo (um com
 * text-anchor="end", outro com "start"), então o encaixe não depende da
 * largura exata dos glifos — funciona com a fonte que o aparelho tiver.
 */
function LetreiroSVG({
  className,
  variante,
}: {
  className: string;
  variante: "clara" | "escura" | "auto";
}) {
  const corLegenda =
    variante === "clara" ? CREME : variante === "escura" ? CONTORNO : "currentColor";

  const copoX = 106;
  const base = {
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    fontWeight: 900,
    stroke: CONTORNO,
    strokeWidth: 11,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke" as const,
  };

  return (
    <svg
      viewBox="0 0 300 168"
      className={className}
      role="img"
      aria-label="Seu Birita Distribuidora"
    >
      <text
        x="150"
        y="56"
        textAnchor="middle"
        fontSize="52"
        fill={CREME}
        {...base}
      >
        SEU
      </text>

      {/* BIRITA — o "I" virou o copo */}
      <text
        x={copoX - 17}
        y="122"
        textAnchor="end"
        fontSize="58"
        fill={OURO}
        {...base}
      >
        B
      </text>
      <text
        x={copoX + 17}
        y="122"
        textAnchor="start"
        fontSize="58"
        fill={OURO}
        {...base}
      >
        RITA
      </text>

      <CopoDeChope x={copoX} />

      <text
        x="150"
        y="158"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        letterSpacing="6.5"
        fontFamily="Inter, Segoe UI, Arial, sans-serif"
        fill={corLegenda}
      >
        DISTRIBUIDORA
      </text>
    </svg>
  );
}

/** Copo tipo weizen: corpo afunilado com colarinho por cima. */
function CopoDeChope({ x }: { x: number }) {
  const corpo = `M ${x - 15},72
                 L ${x - 9},118
                 Q ${x - 8},122 ${x - 4},122
                 L ${x + 4},122
                 Q ${x + 8},122 ${x + 9},118
                 L ${x + 15},72 Z`;

  const colarinho = `M ${x - 15},72
                     Q ${x - 17},62 ${x - 11},59
                     Q ${x - 9},51 ${x - 1},53
                     Q ${x + 8},50 ${x + 11},58
                     Q ${x + 17},61 ${x + 15},72 Z`;

  return (
    <g stroke={CONTORNO} strokeWidth="5.5" strokeLinejoin="round">
      <path d={corpo} fill={OURO} />
      {/* brilho: dá volume sem precisar de gradiente */}
      <path
        d={`M ${x - 9},78 L ${x - 5},114`}
        stroke="#FBDF95"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d={colarinho} fill="#FBF6EE" />
    </g>
  );
}

/** Versão compacta pra barra de navegação, sem a legenda. */
export function LogoMarca({ className = "" }: { className?: string }) {
  return (
    <span className={`font-black leading-none tracking-tight ${className}`}>
      <span className="text-creme">Seu </span>
      <span className="text-ouro-500">Birita</span>
    </span>
  );
}
