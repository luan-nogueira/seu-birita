"use client";

import { useState } from "react";
import { Cabecalho } from "@/components/ui";
import { useDados } from "@/lib/store";

/**
 * Utilitário temporário — aplica as fotos já migradas do ibb.co pro
 * Cloudinary (upload feito via script, ver conversa). Rodar uma vez
 * logado e depois apagar esta página.
 */
const MIGRACAO: { id: string; nome: string; novaUrl: string }[] = [
  { id: "seed-produto-17", nome: "Red bull Tradicional 250ml", novaUrl: "https://res.cloudinary.com/dtwyufv9/image/upload/v1789445442/qgryml63xlyi3pqdjail.jpg" },
  { id: "seed-produto-18", nome: "Red bull Tropical 250ml", novaUrl: "https://res.cloudinary.com/dtwyufv9/image/upload/v1789445443/imzso9sn2bgvodt41zve.jpg" },
  { id: "seed-produto-33", nome: "Red Label 1l", novaUrl: "https://res.cloudinary.com/dtwyufv9/image/upload/v1789445444/tnfzd7haax5a5m8dl6ir.jpg" },
];

export default function MigrarFotosPage() {
  const { produtos, salvarProduto, carregando } = useDados();
  const [status, setStatus] = useState<Record<string, "pendente" | "ok" | "erro">>({});
  const [rodando, setRodando] = useState(false);

  async function aplicar() {
    setRodando(true);
    const novoStatus: Record<string, "pendente" | "ok" | "erro"> = {};
    for (const item of MIGRACAO) {
      const produto = produtos.find((p) => p.id === item.id);
      if (!produto) {
        novoStatus[item.id] = "erro";
        continue;
      }
      try {
        await salvarProduto({
          ...produto,
          imagemUrl: item.novaUrl,
          atualizadoEm: new Date().toISOString(),
        });
        novoStatus[item.id] = "ok";
      } catch {
        novoStatus[item.id] = "erro";
      }
      setStatus({ ...novoStatus });
    }
    setRodando(false);
  }

  return (
    <>
      <Cabecalho
        titulo="Migrar fotos (utilitário)"
        subtitulo={
          carregando
            ? "Carregando…"
            : "Aplica as fotos já enviadas ao Cloudinary nos produtos correspondentes"
        }
        acao={
          <button className="btn-primario" onClick={aplicar} disabled={rodando || carregando}>
            {rodando ? "Aplicando…" : "Aplicar migração"}
          </button>
        }
      />

      <div className="px-4 md:px-6">
        <ul className="card divide-y divide-borda overflow-hidden">
          {MIGRACAO.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 truncate font-semibold">{item.nome}</span>
              <span className="text-xs text-texto-suave">
                {status[item.id] === "ok" && "✅ atualizado"}
                {status[item.id] === "erro" && "❌ erro"}
                {!status[item.id] && "aguardando"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
