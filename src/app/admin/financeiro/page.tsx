"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Cabecalho, Modal } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados, novoId } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { calcularTotais, lucroTotal, lucroRecebidoTotal } from "@/lib/calc";
import { brl, dataBR, hojeISO, paraCampo, paraNumero } from "@/lib/format";
import type { ContaPagar, Pagamento } from "@/lib/types";

const ROTULO_FORMA: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
  BOLETO: "Boleto",
  TRANSFERENCIA: "Transferência",
};

type Formulario = {
  descricao: string;
  fornecedorId: string;
  valor: string;
  vencimento: string;
  obs: string;
};

const FORM_VAZIO: Formulario = {
  descricao: "",
  fornecedorId: "",
  valor: "",
  vencimento: hojeISO(),
  obs: "",
};

export default function FinanceiroPage() {
  return (
    <Protegido chave="financeiro">
      <FinanceiroPageInterno />
    </Protegido>
  );
}

function FinanceiroPageInterno() {
  const {
    pedidos,
    pagamentos,
    clientes,
    fornecedores,
    contasPagar,
    salvarContaPagar,
    removerContaPagar,
    salvarPedido,
    removerPagamento,
    carregando,
  } = useDados();
  const { permissoes } = useAuth();
  const [excluindoPagamento, setExcluindoPagamento] = useState<Pagamento | null>(null);

  const ativos = useMemo(
    () => pedidos.filter((p) => p.status !== "CANCELADO" && p.status !== "RASCUNHO"),
    [pedidos],
  );

  const [dataInicial, setDataInicial] = useState(() => hojeISO().slice(0, 8) + "01");
  const [dataFinal, setDataFinal] = useState(hojeISO());

  const recebidoMes = pagamentos
    .filter((p) => {
      const d = p.data.slice(0, 10);
      return d >= dataInicial && d <= dataFinal;
    })
    .reduce((s, p) => s + p.valor, 0);

  const pedidosDoMes = useMemo(
    () => ativos.filter((p) => {
      const d = p.dataEvento.slice(0, 10);
      return d >= dataInicial && d <= dataFinal;
    }),
    [ativos, dataInicial, dataFinal],
  );
  const lucroRecebidoMes = lucroRecebidoTotal(pedidosDoMes);
  const lucroPrevistoMes = lucroTotal(pedidosDoMes);

  const aReceber = ativos.reduce(
    (s, p) => s + Math.max(0, calcularTotais(p).saldoAberto),
    0,
  );

  const hoje = hojeISO();
  const contasPendentes = useMemo(
    () => contasPagar.filter((c) => !c.pago),
    [contasPagar],
  );
  const aPagar = contasPendentes.reduce((s, c) => s + c.valor, 0);
  const contasVencidas = contasPendentes.filter((c) => c.vencimento < hoje);

  /** Quanto cada cliente deve, somando os pedidos em aberto. */
  const porCliente = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; total: number; pedidos: number }
    >();

    for (const p of ativos) {
      const saldo = calcularTotais(p).saldoAberto;
      if (saldo <= 0.005) continue;
      const atual = mapa.get(p.clienteId) ?? {
        nome: p.clienteNome,
        total: 0,
        pedidos: 0,
      };
      atual.total += saldo;
      atual.pedidos += 1;
      mapa.set(p.clienteId, atual);
    }

    return Array.from(mapa.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [ativos]);

  const ultimosPagamentos = useMemo(
    () => [...pagamentos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 12),
    [pagamentos],
  );

  async function confirmarExclusaoPagamento() {
    if (!excluindoPagamento) return;
    const pedido = pedidos.find((p) => p.id === excluindoPagamento.pedidoId);
    if (pedido) {
      // Sem isso, o pedido continua achando que recebeu esse valor mesmo
      // depois de apagar o pagamento (mesmo bug que já corrigimos ao
      // excluir o pedido inteiro — o pagamento não pode ficar "fantasma").
      const novoValorPago = Math.max(0, (pedido.valorPago || 0) - excluindoPagamento.valor);
      const totais = calcularTotais(pedido);
      const aindaQuitado = novoValorPago >= totais.totalReceber - 0.005;
      await salvarPedido({
        ...pedido,
        valorPago: novoValorPago,
        status:
          pedido.status === "FINALIZADO" && !aindaQuitado ? "ACERTO" : pedido.status,
        atualizadoEm: new Date().toISOString(),
      });
    }
    await removerPagamento(excluindoPagamento.id);
    setExcluindoPagamento(null);
  }

  const contasOrdenadas = useMemo(
    () =>
      [...contasPagar].sort((a, b) => {
        if (a.pago !== b.pago) return a.pago ? 1 : -1;
        return a.vencimento.localeCompare(b.vencimento);
      }),
    [contasPagar],
  );

  // ------------------------- Modal de contas a pagar -------------------------
  const [editando, setEditando] = useState<ContaPagar | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [aberto, setAberto] = useState(false);
  const [salvandoConta, setSalvandoConta] = useState(false);
  const [excluindo, setExcluindo] = useState<ContaPagar | null>(null);

  function abrirNova() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setAberto(true);
  }

  function abrirEdicao(c: ContaPagar) {
    setEditando(c);
    setForm({
      descricao: c.descricao,
      fornecedorId: c.fornecedorId ?? "",
      valor: paraCampo(c.valor),
      vencimento: c.vencimento,
      obs: c.obs ?? "",
    });
    setAberto(true);
  }

  async function salvar() {
    if (salvandoConta) return;
    const descricao = form.descricao.trim();
    const valor = paraNumero(form.valor);
    if (!descricao || valor <= 0) return;
    setSalvandoConta(true);
    try {
      const fornecedor = fornecedores.find((f) => f.id === form.fornecedorId);
      await salvarContaPagar({
        id: editando?.id ?? novoId(),
        descricao,
        fornecedorId: fornecedor?.id,
        fornecedorNome: fornecedor?.nome,
        valor,
        vencimento: form.vencimento || hojeISO(),
        obs: form.obs.trim() || undefined,
        pago: editando?.pago ?? false,
        pagoEm: editando?.pagoEm,
        criadoEm: editando?.criadoEm ?? new Date().toISOString(),
      });
      setAberto(false);
    } finally {
      setSalvandoConta(false);
    }
  }

  async function alternarPago(c: ContaPagar) {
    await salvarContaPagar({
      ...c,
      pago: !c.pago,
      pagoEm: !c.pago ? new Date().toISOString() : undefined,
    });
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    await removerContaPagar(excluindo.id);
    setExcluindo(null);
  }

  return (
    <>
      <Cabecalho
        titulo="Financeiro"
        subtitulo={carregando ? "Carregando…" : "Recebimentos e contas a pagar"}
      />

      <div className="space-y-6 px-4 md:px-6">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="card border-acento/40 bg-acento/5 px-4 py-3">
            <div className="flex items-center gap-1.5 text-texto-suave">
              <Wallet className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                A receber
              </p>
            </div>
            <p className="mt-1.5 text-2xl font-black text-acento tabular-nums">
              {brl(aReceber)}
            </p>
            <p className="mt-0.5 text-xs text-texto-suave">
              {porCliente.length} cliente(s)
            </p>
          </div>

          <div className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-texto-suave">
              <TrendingDown className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                A pagar
              </p>
            </div>
            <p className="mt-1.5 text-2xl font-black tabular-nums">
              {brl(aPagar)}
            </p>
            <p className="mt-0.5 text-xs text-texto-suave">
              {contasVencidas.length > 0
                ? `${contasVencidas.length} vencida(s)`
                : `${contasPendentes.length} pendente(s)`}
            </p>
          </div>

          <div className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-texto-suave">
              <TrendingUp className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                Recebido no período
              </p>
            </div>
            <p className="mt-1.5 text-2xl font-black tabular-nums">
              {brl(recebidoMes)}
            </p>
            <div className="mt-1.5 flex gap-2">
              <input
                type="date"
                value={dataInicial}
                onChange={(e) => setDataInicial(e.target.value)}
                className="campo flex-1 text-[11px] px-1.5 py-1 h-auto min-h-0"
              />
              <input
                type="date"
                value={dataFinal}
                onChange={(e) => setDataFinal(e.target.value)}
                className="campo flex-1 text-[11px] px-1.5 py-1 h-auto min-h-0"
              />
            </div>
          </div>

          <div className="card px-4 py-3">
            <div className="flex items-center gap-1.5 text-texto-suave">
              <PiggyBank className="h-3.5 w-3.5" />
              <p className="text-[11px] font-semibold tracking-wide uppercase">
                Lucro recebido
              </p>
            </div>
            <p className="mt-1.5 text-2xl font-black tabular-nums">
              {brl(lucroRecebidoMes)}
            </p>
            <p className="mt-0.5 text-xs text-texto-suave">
              {lucroPrevistoMes > lucroRecebidoMes
                ? `de ${brl(lucroPrevistoMes)} previsto`
                : `${pedidosDoMes.length} evento(s) no período`}
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-bold">Em aberto por cliente</h2>
          {porCliente.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="font-semibold">Tudo em dia 🎉</p>
              <p className="mt-1 text-sm text-texto-suave">
                Nenhum cliente com valor pendente.
              </p>
            </div>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {porCliente.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/pedidos?cliente=${c.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.nome}</p>
                      <p className="text-xs text-texto-suave">
                        {c.pedidos} pedido{c.pedidos === 1 ? "" : "s"} em aberto
                      </p>
                    </div>
                    <span className="shrink-0 font-black text-acento tabular-nums">
                      {brl(c.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold">Contas a pagar</h2>
            <button className="btn-secundario" onClick={abrirNova}>
              <Plus className="h-4 w-4" />
              Nova conta
            </button>
          </div>
          {contasOrdenadas.length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-texto-suave">
              Nenhuma conta lançada. Cadastre compras, aluguel, combustível e
              outras despesas pra acompanhar o que precisa ser pago.
            </div>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {contasOrdenadas.map((c) => {
                const vencida = !c.pago && c.vencimento < hoje;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => alternarPago(c)}
                      className="shrink-0 text-texto-suave transition hover:text-acento"
                      aria-label={c.pago ? "Marcar como pendente" : "Marcar como paga"}
                    >
                      {c.pago ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-semibold ${c.pago ? "text-texto-suave line-through" : ""}`}
                      >
                        {c.descricao}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {c.fornecedorNome ? `${c.fornecedorNome} · ` : ""}
                        {c.pago
                          ? `paga em ${dataBR(c.pagoEm ?? c.vencimento)}`
                          : `vence ${dataBR(c.vencimento)}`}
                        {vencida && " · vencida"}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 font-black tabular-nums ${
                        c.pago
                          ? "text-texto-suave"
                          : vencida
                            ? "text-red-600 dark:text-red-400"
                            : "text-acento"
                      }`}
                    >
                      {brl(c.valor)}
                    </span>

                    <div className="flex shrink-0 gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
                        onClick={() => abrirEdicao(c)}
                        aria-label={`Editar ${c.descricao}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-texto-suave transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        onClick={() => setExcluindo(c)}
                        aria-label={`Excluir ${c.descricao}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Últimos recebimentos</h2>
          {ultimosPagamentos.length === 0 ? (
            <div className="card px-6 py-10 text-center text-sm text-texto-suave">
              Nenhum pagamento registrado ainda. Eles aparecem aqui conforme
              você registra o acerto de cada pedido.
            </div>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {ultimosPagamentos.map((pg) => {
                const cliente = clientes.find((c) => c.id === pg.clienteId);
                const pedido = pedidos.find((p) => p.id === pg.pedidoId);
                return (
                  <li
                    key={pg.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {cliente?.nome ?? "Cliente removido"}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {dataBR(pg.data)} ·{" "}
                        {ROTULO_FORMA[pg.forma] ?? pg.forma}
                        {pedido &&
                          ` · #${String(pedido.numero).padStart(3, "0")}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold text-emerald-600 tabular-nums">
                      {brl(pg.valor)}
                    </span>
                    {permissoes.excluir && (
                      <button
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-texto-suave transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                        onClick={() => setExcluindoPagamento(pg)}
                        aria-label={`Excluir recebimento de ${cliente?.nome ?? "cliente"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Modal
        aberto={!!excluindoPagamento}
        aoFechar={() => setExcluindoPagamento(null)}
        titulo="Excluir recebimento"
        rodape={
          <>
            <button className="btn-secundario" onClick={() => setExcluindoPagamento(null)}>
              Cancelar
            </button>
            <button className="btn-perigo" onClick={confirmarExclusaoPagamento}>
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          {excluindoPagamento &&
            `Excluir o recebimento de ${brl(excluindoPagamento.valor)}? O valor volta a aparecer como pendente no pedido.`}
        </p>
      </Modal>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? "Editar conta a pagar" : "Nova conta a pagar"}
        rodape={
          <>
            <button className="btn-secundario" onClick={() => setAberto(false)} disabled={salvandoConta}>
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={salvar}
              disabled={salvandoConta || !form.descricao.trim() || paraNumero(form.valor) <= 0}
            >
              {salvandoConta ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="cp-desc">
              Descrição
            </label>
            <input
              id="cp-desc"
              className="campo"
              autoFocus
              placeholder="Ex: Compra de bebidas, aluguel do galpão…"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="cp-fornecedor">
              Fornecedor (opcional)
            </label>
            <select
              id="cp-fornecedor"
              className="campo"
              value={form.fornecedorId}
              onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })}
            >
              <option value="">Sem fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="cp-valor">
                Valor
              </label>
              <input
                id="cp-valor"
                className="campo"
                inputMode="decimal"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="cp-venc">
                Vencimento
              </label>
              <input
                id="cp-venc"
                type="date"
                className="campo"
                value={form.vencimento}
                onChange={(e) => setForm({ ...form, vencimento: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="rotulo" htmlFor="cp-obs">
              Observações
            </label>
            <textarea
              id="cp-obs"
              className="campo min-h-20"
              value={form.obs}
              onChange={(e) => setForm({ ...form, obs: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir conta a pagar"
        rodape={
          <>
            <button className="btn-secundario" onClick={() => setExcluindo(null)}>
              Cancelar
            </button>
            <button className="btn-perigo" onClick={confirmarExclusao}>
              Excluir
            </button>
          </>
        }
      >
        <p className="text-sm text-texto-suave">
          {excluindo &&
            `Tem certeza que deseja excluir a conta "${excluindo.descricao}"?`}
        </p>
      </Modal>
    </>
  );
}
