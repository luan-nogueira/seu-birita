"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Search, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { TemaBotao } from "@/components/TemaBotao";
import { ProdutoImagem } from "@/components/ProdutoImagem";
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
        <div className="mx-auto flex max-w-4xl flex-col items-center">
          <Logo className="h-32 w-auto md:h-40" variante="clara" />
          <p className="mt-4 text-base font-semibold text-creme/80 md:text-lg">
            Tabela de preços
          </p>
          <p className="mt-1 text-sm text-creme/60">
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
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ouro-500 px-8 py-4 text-lg font-bold text-marrom-900 shadow-lg transition hover:bg-ouro-400 active:scale-95"
          >
            <ShoppingBag className="h-6 w-6" />
            Fazer pedido online
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 md:py-10">
        {/* Busca */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-texto-suave" />
          <input
            id="busca-catalogo"
            className="campo pl-11 text-base md:text-lg py-3"
            placeholder="Buscar bebida…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Filtros de categoria */}
        <div className="mb-8 flex gap-3 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setCategoriaAtiva(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm md:text-base font-semibold transition ${
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
              className={`shrink-0 rounded-full px-4 py-2 text-sm md:text-base font-semibold transition ${
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

        <div className="space-y-10">
          {porCategoria.map(([categoria, itens]) => (
            <section key={categoria}>
              <h2 className="mb-4 flex items-center gap-2 border-b-2 border-ouro-500 pb-2 text-base md:text-lg font-black tracking-wide uppercase">
                <span className="flex-1">{categoria}</span>
                <span className="text-sm font-semibold text-texto-suave normal-case tracking-normal">
                  {itens.length} produto(s)
                </span>
              </h2>
              <ul className="card divide-y divide-borda overflow-hidden">
                {itens.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-4 px-4 py-4 md:px-6 md:py-5 transition hover:bg-superficie-2"
                  >
                    {/* Emoji / Imagem */}
                    <div className="relative flex h-20 w-20 md:h-24 md:w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-superficie-2">
                      {p.imagemUrl ? (
                        <ProdutoImagem
                          src={p.imagemUrl}
                          alt={p.nome}
                          fill
                          sizes="96px"
                          className="object-cover"
                          fallback={
                            <span className="text-4xl md:text-5xl select-none">🍺</span>
                          }
                        />
                      ) : (
                        <span className="text-4xl md:text-5xl select-none">🍺</span>
                      )}
                    </div>

                    <span className="min-w-0 flex-1 text-lg md:text-xl font-bold">
                      {p.nome}
                    </span>

                    {p.unPorCaixa > 1 && (
                      <span className="shrink-0 text-right text-sm md:text-base text-texto-suave">
                        cx c/ {p.unPorCaixa}
                        <br />
                        {brl(p.precoUn * p.unPorCaixa)}
                      </span>
                    )}

                    <div className="w-24 md:w-28 shrink-0 text-right">
                      <span className="text-lg md:text-xl font-black tabular-nums text-acento">
                        {brl(p.precoUn)}
                      </span>
                      <span className="block text-xs md:text-sm font-normal text-texto-suave">
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
