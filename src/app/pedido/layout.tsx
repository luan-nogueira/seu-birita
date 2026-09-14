import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fazer Pedido — Seu Birita Distribuidora",
  description:
    "Monte seu pedido de bebidas para o evento. Cervejas, refrigerantes, destilados e mais com entrega garantida.",
};

/** Layout isolado para a página pública de pedido — sem a casca do admin. */
export default function PedidoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
