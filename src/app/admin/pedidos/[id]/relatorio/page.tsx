// Server Component só pra segurar a config de rota — a página em si é
// inteira client-side (dados vêm do Firestore, não do servidor). Sem esse
// wrapper, o "force-static" é ignorado dentro de um arquivo "use client" e
// o Next trata a rota como dinâmica (function serverless a cada abertura,
// com cold start).
export const dynamic = "force-static";

import RelatorioClient from "./RelatorioClient";

export default function Page() {
  return <RelatorioClient />;
}
