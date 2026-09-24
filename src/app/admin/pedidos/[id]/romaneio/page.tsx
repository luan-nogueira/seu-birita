// Endereço antigo (/admin/pedidos/[id]...) — mantido pra links e
// históricos que já existem. Os links do sistema usam o endereço novo com
// ?id= (ver src/lib/rotas.ts), que é mais rápido.
export const dynamic = "force-static";

import { Suspense } from "react";
import RomaneioClient from "./RomaneioClient";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-texto-suave">Carregando…</p>}>
      <RomaneioClient />
    </Suspense>
  );
}
