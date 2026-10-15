"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  Calendar,
  ClipboardList,
  Home,
  LayoutGrid,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LogoMarca } from "./Logo";
import { TemaBotao } from "./TemaBotao";
import { Modal } from "./ui";
import { useDados } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import type { Permissoes } from "@/lib/types";

/** Lateral do desktop (todos) e barra do celular (os fixos + "Mais"). */
const ITENS = [
  { href: "/admin", rotulo: "Início", Icone: Home, chave: null },
  { href: "/admin/pedidos", rotulo: "Pedidos", Icone: ClipboardList, chave: "pedidos" },
  { href: "/admin/pedidos/clientes", rotulo: "Online", Icone: ShoppingCart, chave: "online" },
  { href: "/admin/agenda", rotulo: "Agenda", Icone: Calendar, chave: "agenda" },
  { href: "/admin/produtos", rotulo: "Produtos", Icone: Package, chave: "produtos" },
  { href: "/admin/clientes", rotulo: "Clientes", Icone: Users, chave: "clientes" },
  { href: "/admin/financeiro", rotulo: "Financeiro", Icone: Wallet, chave: "financeiro" },
  { href: "/admin/compras", rotulo: "Compras", Icone: ShoppingBag, chave: "estoque" },
  { href: "/admin/estoque", rotulo: "Estoque", Icone: Boxes, chave: "estoque" },
  { href: "/admin/fornecedores", rotulo: "Fornecedores", Icone: Truck, chave: "fornecedores" },
] satisfies { href: string; rotulo: string; Icone: unknown; chave: keyof Permissoes | null }[];

const ITEM_EQUIPE = { href: "/admin/equipe", rotulo: "Equipe", Icone: ShieldCheck };

/**
 * Barra do celular: cabem 5 botões sem rolar. Estes ficam sempre à mostra
 * e o resto vai pra folha do "Mais" — antes a barra rolava de lado e as
 * telas do fim (Financeiro, Estoque…) ficavam escondidas.
 */
const FIXOS_CELULAR = ["/admin", "/admin/pedidos", "/admin/agenda", "/admin/financeiro"];

const ROTA_ONLINE = "/admin/pedidos/clientes";

/** Telas que qualquer um alcança sem estar logado. */
const ROTAS_PUBLICAS = ["/login", "/admin/pedido"];

function estaAtivo(href: string, caminho: string) {
  if (href === "/admin") return caminho === "/admin";
  // O menu "Pedidos" não deve ficar ativo se estivermos em "Pedidos Online" (/admin/pedidos/clientes)
  if (href === "/admin/pedidos") {
    return caminho === "/admin/pedidos" || (caminho.startsWith("/admin/pedidos/") && !caminho.startsWith("/admin/pedidos/clientes"));
  }
  return caminho === href || caminho.startsWith(`${href}/`);
}

function ehPublica(caminho: string) {
  return ROTAS_PUBLICAS.some(
    (r) => caminho === r || caminho.startsWith(`${r}/`),
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const { modoDemonstracao, pedidosClientesNovos } = useDados();
  const { usuario, carregando, exigeLogin, sair, permissoes, ehAdmin } = useAuth();

  const precisaEntrar = exigeLogin && !carregando && !usuario;
  const publica = ehPublica(caminho);

  const itensPermitidos = ITENS.filter((i) => !i.chave || permissoes[i.chave]);
  const itensDesktop = ehAdmin ? [...itensPermitidos, ITEM_EQUIPE] : itensPermitidos;

  // Sem permissão pra algum fixo, o próximo item da lista entra no lugar.
  const fixosCelular =
    itensDesktop.length <= 5
      ? itensDesktop
      : [
          ...itensDesktop.filter((i) => FIXOS_CELULAR.includes(i.href)),
          ...itensDesktop.filter((i) => !FIXOS_CELULAR.includes(i.href)),
        ].slice(0, 4);
  const noMais = itensDesktop.filter((i) => !fixosCelular.includes(i));
  const [maisAberto, setMaisAberto] = useState(false);

  const badgeDe = (href: string) => (href === ROTA_ONLINE ? pedidosClientesNovos : 0);

  useEffect(() => {
    if (precisaEntrar && !publica) router.replace("/login");
  }, [precisaEntrar, publica, router]);

  // Sem a casca do app: login, catálogo público e as folhas imprimíveis.
  if (publica || caminho.includes("/relatorio") || caminho.includes("/romaneio")) {
    return <>{children}</>;
  }

  if (exigeLogin && carregando) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-sm text-texto-suave">Carregando…</p>
      </div>
    );
  }

  // Enquanto o redirecionamento acontece, não pisca o conteúdo protegido.
  if (precisaEntrar) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="text-sm text-texto-suave">Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      {/* Barra superior — some no desktop, onde a lateral assume */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-black/20 bg-barra px-4 text-barra-texto md:hidden">
        <Link href="/admin" className="text-lg">
          <LogoMarca />
        </Link>
        <div className="ml-auto flex items-center">
          <TemaBotao />
          {exigeLogin && <BotaoSair aoSair={sair} />}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        {/* Lateral — só no desktop */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-borda bg-barra px-3 py-5 text-barra-texto md:flex">
          <Link href="/admin" className="mb-6 px-2 text-2xl">
            <LogoMarca />
          </Link>

          <nav className="flex flex-col gap-1">
            {itensDesktop.map(({ href, rotulo, Icone }) => {
              const ativo = estaAtivo(href, caminho);
              const badge = badgeDe(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    ativo
                      ? "bg-ouro-500 text-marrom-900"
                      : "text-creme/75 hover:bg-white/10 hover:text-creme"
                  }`}
                >
                  <Icone className="h-[18px] w-[18px]" />
                  <span className="flex-1">{rotulo}</span>
                  {badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ouro-400 px-1 text-[11px] font-black text-marrom-900">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4">
            <Link
              href="/"
              target="_blank"
              className="block px-2 text-xs font-semibold text-creme/60 underline-offset-4 hover:text-creme hover:underline"
            >
              Ver tabela pública
            </Link>

            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              {usuario && (
                <span
                  className="min-w-0 flex-1 truncate px-2 text-[11px] text-creme/50"
                  title={usuario.email ?? ""}
                >
                  {usuario.email}
                </span>
              )}
              <TemaBotao />
              {exigeLogin && <BotaoSair aoSair={sair} />}
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 md:pb-10">
          {modoDemonstracao && <AvisoDemonstracao />}
          {children}
        </main>
      </div>

      {/* Navegação inferior — só no celular: os fixos + "Mais" com o resto. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        {fixosCelular.map(({ href, rotulo, Icone }) => (
          <BotaoBarra
            key={href}
            href={href}
            rotulo={rotulo}
            Icone={Icone}
            ativo={estaAtivo(href, caminho)}
            badge={badgeDe(href)}
          />
        ))}
        {noMais.length > 0 && (
          <BotaoBarra
            rotulo="Mais"
            Icone={LayoutGrid}
            // Acende quando a tela aberta é uma das que estão no "Mais".
            ativo={noMais.some((i) => estaAtivo(i.href, caminho))}
            badge={noMais.reduce((s, i) => s + badgeDe(i.href), 0)}
            aoClicar={() => setMaisAberto(true)}
          />
        )}
      </nav>

      <Modal aberto={maisAberto} aoFechar={() => setMaisAberto(false)} titulo="Mais">
        <div className="grid grid-cols-3 gap-2">
          {noMais.map(({ href, rotulo, Icone }) => {
            const ativo = estaAtivo(href, caminho);
            const badge = badgeDe(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMaisAberto(false)}
                className={`relative flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-center text-xs font-semibold transition ${
                  ativo
                    ? "border-acento bg-acento/10 text-acento"
                    : "border-borda text-texto hover:bg-superficie-2"
                }`}
              >
                <Icone className="h-6 w-6" strokeWidth={ativo ? 2.5 : 2} />
                {rotulo}
                {badge > 0 && (
                  <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-acento px-1 text-[11px] font-black text-acento-texto">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

/** Botão da barra do celular — link pra uma tela ou o "Mais". */
function BotaoBarra({
  href,
  aoClicar,
  rotulo,
  Icone,
  ativo,
  badge,
}: {
  href?: string;
  aoClicar?: () => void;
  rotulo: string;
  Icone: LucideIcon;
  ativo: boolean;
  badge: number;
}) {
  const classe = `relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
    ativo ? "text-acento" : "text-texto-suave"
  }`;
  const conteudo = (
    <>
      <div className="relative">
        <Icone className="h-5 w-5" strokeWidth={ativo ? 2.5 : 2} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-acento px-0.5 text-[9px] font-black text-acento-texto">
            {badge}
          </span>
        )}
      </div>
      {rotulo}
    </>
  );
  return href ? (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <button type="button" onClick={aoClicar} className={classe}>
      {conteudo}
    </button>
  );
}

function BotaoSair({ aoSair }: { aoSair: () => Promise<void> }) {
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10"
        title="Sair"
        aria-label="Sair do sistema"
      >
        <LogOut className="h-[18px] w-[18px]" />
      </button>

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo="Sair do sistema"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setModalAberto(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-perigo"
              onClick={() => {
                setModalAberto(false);
                void aoSair();
              }}
            >
              Sair
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          Tem certeza que deseja sair da sua conta?
        </p>
      </Modal>
    </>
  );
}

function AvisoDemonstracao() {
  return (
    <div className="border-b border-ouro-300 bg-ouro-100 px-4 py-2 text-center text-xs font-medium text-marrom-800">
      <strong className="font-bold">Modo demonstração.</strong> Os dados estão
      salvos só neste navegador — configure o Firebase pra sincronizar entre
      celular e computador.
    </div>
  );
}
