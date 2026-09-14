"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TemaBotao } from "@/components/TemaBotao";
import { useDados } from "@/lib/store";
import { brl, normalizar } from "@/lib/format";
import { EMPRESA } from "@/lib/empresa";

/**
 * Tabela de preços pública — link que o Luifer manda pro cliente.
 * Agora com botão de pedido online apontando para /pedido.
 */
export default function CatalogoPage() {
  const { produtos, carregando } = useDados();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return produtos
      .filter((p) => p.ativo && p.visivelCatalogo && p.precoUn > 0)
      .filter(
        (p) =>
          !termo ||
          normalizar(p.nome).includes(termo) ||
          normalizar(p.categoria).includes(termo),
      );
  }, [produtos, busca]);

  const categorias = useMemo(() => {
    const set = new Set(visiveis.map((p) => p.categoria || "Outros"));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [visiveis]);

  const porCategoria = useMemo(() => {
    const filtrados = categoriaAtiva
      ? visiveis.filter((p) => (p.categoria || "Outros") === categoriaAtiva)
      : visiveis;
    const mapa = new Map<string, typeof filtrados>();
    for (const p of filtrados) {
      const chave = p.categoria || "Outros";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [visiveis, categoriaAtiva]);

  const whatsapp = EMPRESA.telefone.replace(/\D/g, "");

  return (
    <div className="min-h-dvh bg-fundo">
      {/* ─── Header ─── */}
      <header className="bg-barra px-5 py-10 text-center text-barra-texto">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <Logo className="h-28 w-auto" variante="clara" />
          <p className="mt-3 text-sm font-semibold text-creme/80">
            Tabela de preços
          </p>
          <p className="mt-1 text-xs text-creme/60">
            Atualizada em{" "}
            {new Date().toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>

          {/* CTA — Pedido online */}
          <Link
            href="/pedido"
            id="btn-fazer-pedido-online"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-ouro-500 px-6 py-3 font-bold text-marrom-900 shadow-lg transition hover:bg-ouro-400 active:scale-95"
          >
            <ShoppingBag className="h-5 w-5" />
            Fazer pedido online
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* Busca */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
          <input
            id="busca-catalogo"
            className="campo pl-9"
            placeholder="Buscar bebida…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Filtros de categoria */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategoriaAtiva(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              !categoriaAtiva
                ? "bg-acento text-acento-texto"
                : "border border-borda text-texto-suave hover:border-acento hover:text-acento"
            }`}
          >
            Todos
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setCategoriaAtiva(cat === categoriaAtiva ? null : cat)
              }
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                categoriaAtiva === cat
                  ? "bg-acento text-acento-texto"
                  : "border border-borda text-texto-suave hover:border-acento hover:text-acento"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {carregando && (
          <p className="py-10 text-center text-sm text-texto-suave">
            Carregando tabela…
          </p>
        )}

        {!carregando && visiveis.length === 0 && (
          <p className="py-10 text-center text-sm text-texto-suave">
            {busca
              ? "Nenhum produto encontrado."
              : "A tabela ainda não tem produtos publicados."}
          </p>
        )}

        <div className="space-y-8">
          {porCategoria.map(([categoria, itens]) => (
            <section key={categoria}>
              <h2 className="mb-3 flex items-center gap-2 border-b-2 border-ouro-500 pb-1.5 text-sm font-black tracking-wide uppercase">
                <span className="flex-1">{categoria}</span>
                <span className="text-xs font-semibold text-texto-suave normal-case tracking-normal">
                  {itens.length} produto(s)
                </span>
              </h2>
              <ul className="card divide-y divide-borda overflow-hidden">
                {itens.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                  >
                    {/* Emoji / Imagem */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-superficie-2">
                      {p.imagemUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imagemUrl}
                          alt={p.nome}
                          className="h-full w-full rounded-xl object-contain p-1"
                        />
                      ) : (
                        <span className="text-xl select-none">🍺</span>
                      )}
                    </div>

                    <span className="min-w-0 flex-1 font-semibold">
                      {p.nome}
                    </span>

                    {p.unPorCaixa > 1 && (
                      <span className="shrink-0 text-right text-xs text-texto-suave">
                        cx c/ {p.unPorCaixa}
                        <br />
                        {brl(p.precoUn * p.unPorCaixa)}
                      </span>
                    )}

                    <div className="w-20 shrink-0 text-right">
                      <span className="font-black tabular-nums text-acento">
                        {brl(p.precoUn)}
                      </span>
                      <span className="block text-[10px] font-normal text-texto-suave">
                        unidade
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* CTAs finais */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/pedido"
            className="btn-primario w-full justify-center py-3.5 text-base sm:w-auto sm:min-w-72"
          >
            <ShoppingBag className="h-5 w-5" />
            Fazer pedido online agora
          </Link>

          {whatsapp && (
            <a
              href={`https://wa.me/55${whatsapp}?text=${encodeURIComponent(
                "Olá! Vim pela tabela de preços e queria fazer um pedido.",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secundario"
            >
              <MessageCircle className="h-4 w-4" />
              Pedir pelo WhatsApp
            </a>
          )}
        </div>

        <footer className="mt-10 flex items-center justify-center gap-3 border-t border-borda pt-5 text-center text-xs text-texto-suave">
          <span>
            {EMPRESA.nome} · preços sujeitos a alteração sem aviso prévio
          </span>
          <TemaBotao />
        </footer>
      </div>
    </div>
  );
}
