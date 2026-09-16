"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Cabecalho, Modal, Vazio } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados, novoId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { brl, normalizar, telefoneBR } from "@/lib/format";
import type { Cliente } from "@/lib/types";

type Formulario = Omit<Cliente, "id" | "criadoEm">;

const FORM_VAZIO: Formulario = {
  nome: "",
  tipo: "PJ",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
  cidade: "",
  obs: "",
  ativo: true,
};

export default function ClientesPage() {
  return (
    <Protegido chave="clientes">
      <ClientesPageInterno />
    </Protegido>
  );
}

function ClientesPageInterno() {
  const {
    clientes,
    pedidos,
    salvarCliente,
    removerCliente,
    pendenciaDoCliente,
    carregando,
  } = useDados();
  const { permissoes } = useAuth();

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindoCliente, setExcluindoCliente] = useState<Cliente | null>(null);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        normalizar(c.nome).includes(termo) ||
        normalizar(c.cidade || "").includes(termo) ||
        (c.telefone || "").includes(busca.replace(/\D/g, "")),
    );
  }, [clientes, busca]);

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setAberto(true);
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c);
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      documento: c.documento ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      endereco: c.endereco ?? "",
      cidade: c.cidade ?? "",
      obs: c.obs ?? "",
      ativo: c.ativo,
    });
    setAberto(true);
  }

  async function salvar() {
    if (salvando) return;
    const nome = form.nome.trim();
    if (!nome) return;
    setSalvando(true);
    try {
      await salvarCliente({
        ...form,
        nome,
        id: editando?.id ?? novoId(),
        criadoEm: editando?.criadoEm ?? new Date().toISOString(),
      });
      setAberto(false);
    } finally {
      setSalvando(false);
    }
  }

  function solicitarExclusao(c: Cliente) {
    setExcluindoCliente(c);
  }

  async function confirmarExclusao() {
    if (!excluindoCliente) return;
    await removerCliente(excluindoCliente.id);
    setExcluindoCliente(null);
  }

  return (
    <>
      <Cabecalho
        titulo="Clientes"
        subtitulo={
          carregando
            ? "Carregando…"
            : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"} cadastrados`
        }
        acao={
          <button className="btn-primario" onClick={abrirNovo}>
            <Plus className="h-4 w-4" />
            Novo
          </button>
        }
      />

      <div className="px-4 md:px-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
          <input
            className="campo pl-9"
            placeholder="Buscar por nome, cidade ou telefone…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {!carregando && filtrados.length === 0 && (
        <Vazio
          Icone={Users}
          titulo={busca ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          descricao={
            busca
              ? "Tente outro termo."
              : "Cadastre o primeiro cliente pra começar a lançar pedidos."
          }
          acao={
            !busca ? (
              <button className="btn-primario" onClick={abrirNovo}>
                <Plus className="h-4 w-4" />
                Cadastrar cliente
              </button>
            ) : undefined
          }
        />
      )}

      <ul className="space-y-2 px-4 md:px-6">
        {filtrados.map((c) => {
          const devendo = pendenciaDoCliente(c.id);
          const totalPedidos = pedidos.filter(
            (p) => p.clienteId === c.id && p.status !== "CANCELADO",
          ).length;

          return (
            <li key={c.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{c.nome}</p>
                    {!c.ativo && (
                      <span className="chip bg-superficie-2 text-texto-suave">
                        inativo
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
                    {c.cidade && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {c.cidade}
                      </span>
                    )}
                    {c.telefone && <span>{telefoneBR(c.telefone)}</span>}
                    <span>
                      {totalPedidos} pedido{totalPedidos === 1 ? "" : "s"}
                    </span>
                  </div>

                  {devendo > 0.005 && (
                    <p className="mt-2 inline-flex rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                      Em aberto: {brl(devendo)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  {c.telefone && (
                    <a
                      href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-9 w-9 place-items-center rounded-lg text-texto-suave transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40"
                      aria-label={`Conversar com ${c.nome} no WhatsApp`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    className="grid h-9 w-9 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
                    onClick={() => abrirEdicao(c)}
                    aria-label={`Editar ${c.nome}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {permissoes.excluir && (
                    <button
                        className="grid h-9 w-9 place-items-center rounded-lg text-texto-suave transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        onClick={() => solicitarExclusao(c)}
                        aria-label={`Excluir ${c.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {totalPedidos > 0 && (
                <Link
                  href={`/admin/pedidos?cliente=${c.id}`}
                  className="mt-3 inline-block text-xs font-semibold text-acento underline-offset-4 hover:underline"
                >
                  Ver pedidos deste cliente →
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? "Editar cliente" : "Novo cliente"}
        rodape={
          <>
            <button className="btn-secundario" onClick={() => setAberto(false)} disabled={salvando}>
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={salvar}
              disabled={salvando || !form.nome.trim()}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="c-nome">
              Nome
            </label>
            <input
              id="c-nome"
              className="campo"
              autoFocus
              placeholder="Ex: Estação Lounge"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="c-tipo">
                Tipo
              </label>
              <select
                id="c-tipo"
                className="campo"
                value={form.tipo}
                onChange={(e) =>
                  setForm({ ...form, tipo: e.target.value as "PF" | "PJ" })
                }
              >
                <option value="PJ">Empresa (PJ)</option>
                <option value="PF">Pessoa física (PF)</option>
              </select>
            </div>
            <div>
              <label className="rotulo" htmlFor="c-doc">
                {form.tipo === "PJ" ? "CNPJ" : "CPF"}
              </label>
              <input
                id="c-doc"
                className="campo"
                inputMode="numeric"
                value={form.documento}
                onChange={(e) =>
                  setForm({ ...form, documento: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="c-tel">
                Telefone / WhatsApp
              </label>
              <input
                id="c-tel"
                className="campo"
                inputMode="tel"
                placeholder="(22) 99826-2835"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="c-cidade">
                Cidade
              </label>
              <input
                id="c-cidade"
                className="campo"
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="c-end">
              Endereço
            </label>
            <input
              id="c-end"
              className="campo"
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="c-email">
              E-mail
            </label>
            <input
              id="c-email"
              className="campo"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="c-obs">
              Observações
            </label>
            <textarea
              id="c-obs"
              className="campo min-h-20"
              placeholder="Combinados, prazo de pagamento, contato no local…"
              value={form.obs}
              onChange={(e) => setForm({ ...form, obs: e.target.value })}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 border-t border-borda pt-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--acento)]"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            <span className="text-sm font-semibold">Cliente ativo</span>
          </label>
        </div>
      </Modal>

      <Modal
        aberto={!!excluindoCliente}
        aoFechar={() => setExcluindoCliente(null)}
        titulo="Excluir Cliente"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setExcluindoCliente(null)}
            >
              Cancelar
            </button>
            <button className="btn-perigo" onClick={confirmarExclusao}>
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          {excluindoCliente && (
            (() => {
              const quantos = pedidos.filter((p) => p.clienteId === excluindoCliente.id).length;
              return quantos
                ? `"${excluindoCliente.nome}" tem ${quantos} pedido(s) no histórico. Os pedidos continuam salvos. Excluir mesmo assim?`
                : `Tem certeza que deseja excluir o cliente "${excluindoCliente.nome}"?`;
            })()
          )}
        </p>
      </Modal>
    </>
  );
}
