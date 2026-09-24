"use client";

import { useParams, useSearchParams } from "next/navigation";

/*
 * Endereços do pedido. Usam ?id= em vez de /pedidos/[id] de propósito:
 * com o id no caminho, cada pedido era uma página diferente pro servidor,
 * que tinha que montar na hora a cada abertura (~0,5s, mais no 4G) — a
 * setinha e os botões ficavam "com preguiça". Com ?id= a página é um
 * arquivo fixo, servido do cache e pré-carregado pelos links.
 * Os endereços antigos (/admin/pedidos/[id]...) continuam funcionando.
 */
export const rotaPedido = (id: string) => `/admin/pedidos/ver?id=${encodeURIComponent(id)}`;
export const rotaRelatorio = (id: string) =>
  `/admin/pedidos/relatorio?id=${encodeURIComponent(id)}`;
export const rotaRomaneio = (id: string) =>
  `/admin/pedidos/romaneio?id=${encodeURIComponent(id)}`;

/** Id do pedido da tela atual: do ?id= (endereço novo) ou do /[id] (antigo). */
export function useIdPedido(): string {
  const params = useParams<{ id?: string }>();
  const busca = useSearchParams();
  return busca.get("id") ?? params?.id ?? "";
}
