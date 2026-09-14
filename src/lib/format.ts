const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR");

export function brl(valor: number): string {
  return moeda.format(valor || 0);
}

/** Igual ao brl, mas mostra "—" no lugar de R$ 0,00 (como na planilha). */
export function brlOuTraco(valor: number): string {
  if (!valor) return "—";
  return moeda.format(valor);
}

export function num(valor: number): string {
  return numero.format(valor || 0);
}

/** "2026-09-09" -> "09/09/2026" sem sofrer com fuso horário. */
export function dataBR(iso: string): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function dataHoraBR(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Data de hoje em ISO (YYYY-MM-DD) no fuso local, não em UTC. */
export function hojeISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/** Remove acentos e baixa a caixa, pra busca funcionar sem o usuário acentuar. */
export function normalizar(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Lê número digitado por gente: "6,90", "6.90", "1.250,00", "R$ 8".
 * Se tem vírgula, o ponto é separador de milhar; se não tem, o ponto é decimal.
 */
export function paraNumero(valor: string | number | null | undefined): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  let s = (valor ?? "").toString().trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Número para string editável em campo de texto ("6.9" -> "6,90"). */
export function paraCampo(valor: number, casas = 2): string {
  if (!valor) return "";
  return valor.toFixed(casas).replace(".", ",");
}

export function telefoneBR(valor: string): string {
  const d = (valor || "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}
