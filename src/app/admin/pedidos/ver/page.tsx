import { Suspense } from "react";
import PedidoDetalheClient from "../[id]/PedidoDetalheClient";

// Página estática: o id vem do ?id= (ver src/lib/rotas.ts), então o
// servidor entrega sempre o mesmo arquivo, do cache. O Suspense é exigido
// pelo useSearchParams numa página estática.
export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-texto-suave">Carregando pedido…</p>}>
      <PedidoDetalheClient />
    </Suspense>
  );
}
