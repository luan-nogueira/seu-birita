"use client";

import { useMemo, useState } from "react";
import { Cabecalho, Modal } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { novoId } from "@/lib/db";
import { brl, caixasEUnidades, dataBR, dataHoraBR, hojeISO, normalizar } from "@/lib/format";
import { compararCategorias } from "@/lib/calc";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import type {
  ContaPagar,
  EstoqueMovimento,
  EstoqueOrigem,
  Fornecedor,
  Produto,
} from "@/lib/types";

const ROTULO_ORIGEM: Record<EstoqueOrigem, string> = {
  COMPRA: "Compra",
  PEDIDO: "Venda/Entrega",
  DEVOLUCAO: "Devolução",
  AJUSTE: "Ajuste",
  PERDA: "Perda",
};

/** Soma dias a uma data YYYY-MM-DD, sem passar por UTC. */
function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(a, m - 1, d + dias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

type FormaCompra = "AVISTA" | "PRAZO";

/** Divide em parcelas de centavos inteiros; a última leva a sobra do arredondamento. */
function dividirParcelas(valor: number, n: number): number[] {
  const centavos = Math.round(valor * 100);
  const base = Math.floor(centavos / n);
  return Array.from({ length: n }, (_, i) =>
    (i === n - 1 ? centavos - base * (n - 1) : base) / 100,
  );
}

/** Contas a pagar de uma compra — aceita o formato antigo (uma conta só). */
function idsDasContas(m: EstoqueMovimento): string[] {
  return m.contaPagarIds ?? (m.contaPagarId ? [m.contaPagarId] : []);
}

/**
 * Devolve o fornecedor escolhido; se foi digitado um nome novo, cadastra
 * (ou reaproveita um já existente com o mesmo nome).
 */
async function resolverFornecedor(
  fornecedores: Fornecedor[],
  salvarFornecedor: (f: Fornecedor) => Promise<void>,
  fornecedorId: string,
  novoNome: string | null,
): Promise<{ id?: string; nome?: string }> {
  const nome = novoNome?.trim();
  if (nome) {
    const existente = fornecedores.find((f) => normalizar(f.nome) === normalizar(nome));
    if (existente) return { id: existente.id, nome: existente.nome };
    const id = novoId();
    await salvarFornecedor({ id, nome, ativo: true, criadoEm: new Date().toISOString() });
    return { id, nome };
  }
  const f = fornecedores.find((x) => x.id === fornecedorId);
  return f ? { id: f.id, nome: f.nome } : {};
}

/** Cria uma conta a pagar por parcela, uma para cada data de vencimento. */
async function criarContasPrazo(
  salvarContaPagar: (c: ContaPagar) => Promise<void>,
  dados: {
    valorTotal: number;
    vencimentos: string[];
    descricao: string;
    fornecedor: { id?: string; nome?: string };
    obs?: string;
  },
): Promise<string[]> {
  const n = dados.vencimentos.length;
  const valores = dividirParcelas(dados.valorTotal, n);
  const ids: string[] = [];
  for (let i = 0; i < valores.length; i++) {
    const id = novoId();
    await salvarContaPagar({
      id,
      descricao:
        n > 1
          ? `${dados.descricao} (${i + 1}/${n})`
          : dados.descricao,
      fornecedorId: dados.fornecedor.id,
      fornecedorNome: dados.fornecedor.nome,
      valor: valores[i],
      vencimento: dados.vencimentos[i] || hojeISO(),
      obs: dados.obs || undefined,
      pago: false,
      criadoEm: new Date().toISOString(),
    });
    ids.push(id);
  }
  return ids;
}

function CampoFornecedor({
  fornecedores,
  fornecedorId,
  novoNome,
  aoMudar,
  podeCadastrar,
}: {
  fornecedores: Fornecedor[];
  fornecedorId: string;
  /** Sem a permissão "fornecedores" o Firestore recusa o cadastro. */
  podeCadastrar: boolean;
  /** null = escolhendo da lista; string = digitando um fornecedor novo. */
  novoNome: string | null;
  aoMudar: (fornecedorId: string, novoNome: string | null) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">Fornecedor (Opcional)</label>
      {novoNome === null ? (
        <select
          value={fornecedorId}
          onChange={(e) =>
            e.target.value === "__novo__" ? aoMudar("", "") : aoMudar(e.target.value, null)
          }
          className="campo block w-full"
        >
          <option value="">Nenhum fornecedor vinculado</option>
          {fornecedores
            .filter((f) => f.ativo !== false)
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          {podeCadastrar && <option value="__novo__">+ Cadastrar novo fornecedor</option>}
        </select>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              autoFocus
              className="campo min-w-0 flex-1"
              placeholder="Nome do fornecedor"
              value={novoNome}
              onChange={(e) => aoMudar("", e.target.value)}
            />
            <button type="button" className="btn-secundario shrink-0" onClick={() => aoMudar("", null)}>
              Cancelar
            </button>
          </div>
          <p className="mt-1 text-xs text-texto-suave">
            Será cadastrado ao confirmar. Telefone e outros dados dá pra completar
            depois em Fornecedores.
          </p>
        </>
      )}
    </div>
  );
}

/** "MES" = todo mês no mesmo dia; número = a cada N dias. */
type Intervalo = "MES" | number;

const INTERVALOS: { valor: Intervalo; rotulo: string }[] = [
  { valor: "MES", rotulo: "Todo mês" },
  { valor: 7, rotulo: "A cada 7 dias" },
  { valor: 10, rotulo: "A cada 10 dias" },
  { valor: 14, rotulo: "A cada 14 dias" },
  { valor: 15, rotulo: "A cada 15 dias" },
  { valor: 21, rotulo: "A cada 21 dias" },
  { valor: 28, rotulo: "A cada 28 dias" },
  { valor: 30, rotulo: "A cada 30 dias" },
];

function gerarVencimentos(primeiro: string, n: number, intervalo: Intervalo): string[] {
  const base = primeiro || hojeISO();
  return Array.from({ length: n }, (_, i) =>
    intervalo === "MES" ? somarMeses(base, i) : somarDias(base, intervalo * i),
  );
}

function CamposPagamento({
  pagamento,
  setPagamento,
  vencimentos,
  setVencimentos,
  valorTotal,
  bloqueado,
  podePrazo,
}: {
  /** A prazo cria contas a pagar — exige a permissão "financeiro". */
  podePrazo: boolean;
  pagamento: FormaCompra;
  setPagamento: (p: FormaCompra) => void;
  /** Uma data por parcela — a quantidade de parcelas é o tamanho da lista. */
  vencimentos: string[];
  setVencimentos: (v: string[]) => void;
  valorTotal: number;
  /** Mensagem quando não dá pra mudar (ex.: já tem parcela paga). */
  bloqueado?: string;
}) {
  const [intervalo, setIntervalo] = useState<Intervalo>("MES");
  const parcelas = vencimentos.length;
  const primeiro = vencimentos[0] ?? "";
  const valores = valorTotal > 0 ? dividirParcelas(valorTotal, parcelas) : [];

  // Mudar parcelas, intervalo ou 1º vencimento recalcula as datas; editar a
  // data de uma parcela específica mexe só nela.
  function mudarDataParcela(i: number, data: string) {
    if (i === 0) {
      setVencimentos(gerarVencimentos(data, parcelas, intervalo));
      return;
    }
    const novas = [...vencimentos];
    novas[i] = data;
    setVencimentos(novas);
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">Pagamento</label>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-superficie-2 p-1">
        {(["AVISTA", "PRAZO"] as const).map((op) => (
          <button
            key={op}
            type="button"
            disabled={!!bloqueado || (op === "PRAZO" && !podePrazo)}
            onClick={() => setPagamento(op)}
            className={`rounded-lg py-2 text-sm font-bold transition disabled:opacity-60 ${
              pagamento === op ? "bg-superficie shadow-sm" : "text-texto-suave"
            }`}
          >
            {op === "AVISTA" ? "À vista" : "A prazo"}
          </button>
        ))}
      </div>
      {bloqueado && <p className="mt-1 text-xs text-texto-suave">{bloqueado}</p>}
      {!podePrazo && !bloqueado && (
        <p className="mt-1 text-xs text-texto-suave">
          Compra a prazo só pra quem tem acesso ao Financeiro (ela cria contas a pagar).
        </p>
      )}
      {pagamento === "PRAZO" && !bloqueado && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="parcelas-compra">
                Parcelas
              </label>
              <select
                id="parcelas-compra"
                value={parcelas}
                onChange={(e) =>
                  setVencimentos(gerarVencimentos(primeiro, Number(e.target.value), intervalo))
                }
                className="campo block w-full"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1x (única)" : `${n}x`}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-semibold" htmlFor="vencimento-compra">
                {parcelas > 1 ? "1º vencimento" : "Vencimento"}
              </label>
              <input
                id="vencimento-compra"
                type="date"
                required
                value={primeiro}
                onChange={(e) => mudarDataParcela(0, e.target.value)}
                className="campo block w-full"
              />
            </div>
          </div>

          {parcelas > 1 && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold" htmlFor="intervalo-compra">
                  Intervalo entre parcelas
                </label>
                <select
                  id="intervalo-compra"
                  value={String(intervalo)}
                  onChange={(e) => {
                    const novo: Intervalo =
                      e.target.value === "MES" ? "MES" : Number(e.target.value);
                    setIntervalo(novo);
                    setVencimentos(gerarVencimentos(primeiro, parcelas, novo));
                  }}
                  className="campo block w-full"
                >
                  {INTERVALOS.map((op) => (
                    <option key={String(op.valor)} value={String(op.valor)}>
                      {op.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="divide-y divide-borda rounded-xl border border-borda text-sm">
                {vencimentos.map((data, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-9 shrink-0 text-xs text-texto-suave tabular-nums">
                      {i + 1}/{parcelas}
                    </span>
                    <input
                      type="date"
                      aria-label={`Vencimento da parcela ${i + 1}`}
                      value={data}
                      onChange={(e) => mudarDataParcela(i, e.target.value)}
                      className="campo h-auto min-h-0 min-w-0 flex-1 px-2 py-1 text-sm"
                    />
                    <span className="w-24 shrink-0 text-right font-semibold tabular-nums">
                      {valores[i] !== undefined ? brl(valores[i]) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-xs text-texto-suave">
            {parcelas > 1
              ? "Toque numa data pra mudar só aquela parcela. Cada parcela entra em Financeiro → Contas a pagar."
              : "Vai entrar em Financeiro → Contas a pagar com o valor total da compra."}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Mesmo dia N meses depois (parcela mensal). Se o mês não tem esse dia
 * (ex.: 31), cai no último dia do mês.
 */
function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const ultimoDia = new Date(a, m - 1 + meses + 1, 0).getDate();
  const dt = new Date(a, m - 1 + meses, Math.min(d, ultimoDia));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Primeiro dia do mês atual, formato YYYY-MM-DD. */
function inicioDoMes(): string {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

export default function EstoquePage() {
  return (
    <Protegido chave="estoque">
      <EstoquePageInterno />
    </Protegido>
  );
}

function EstoquePageInterno() {
  const { permissoes } = useAuth();
  const {
    movimentos,
    produtos,
    fornecedores,
    salvarMovimento,
    salvarProduto,
    salvarFornecedor,
    salvarContaPagar,
    produtoPorId,
    pedidoPorId,
    removerMovimento,
  } = useDados();

  const [busca, setBusca] = useState("");
  const [produtoHistorico, setProdutoHistorico] = useState<Produto | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [limpandoOrfaos, setLimpandoOrfaos] = useState(false);

  // Lançamentos de pedidos que já foram excluídos antes da correção que
  // passou a limpar o histórico junto — só sujeira visual, não afeta a
  // quantidade em estoque (já foi corrigida na hora da exclusão).
  const orfaos = useMemo(
    () =>
      movimentos.filter(
        (m) =>
          m.referenciaId &&
          (m.origem === "PEDIDO" || m.origem === "DEVOLUCAO") &&
          !pedidoPorId(m.referenciaId),
      ),
    [movimentos, pedidoPorId],
  );

  async function limparOrfaos() {
    if (limpandoOrfaos) return;
    if (!window.confirm(`Apagar ${orfaos.length} lançamento(s) de pedidos que já foram excluídos? A quantidade em estoque não muda, só o histórico.`)) {
      return;
    }
    setLimpandoOrfaos(true);
    try {
      for (const m of orfaos) {
        await removerMovimento(m.id);
      }
    } finally {
      setLimpandoOrfaos(false);
    }
  }

  // Form do lançamento manual
  const [tipoMovimento, setTipoMovimento] = useState<EstoqueOrigem>("COMPRA");
  const [produtoId, setProdutoId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  // Cadastro rápido de fornecedor direto na compra, só com o nome.
  const [novoFornecedor, setNovoFornecedor] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<FormaCompra>("AVISTA");
  const [vencimentos, setVencimentos] = useState<string[]>(() => [somarDias(hojeISO(), 30)]);
  const [quantidadeUn, setQuantidadeUn] = useState("");
  // Só no Ajuste: contagem do galpão em caixas (as unidades soltas vão em quantidadeUn).
  const [contagemCx, setContagemCx] = useState("");
  const [custoTotal, setCustoTotal] = useState("");
  const [obs, setObs] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [focoBusca, setFocoBusca] = useState(false);

  const produtoSelecionado = produtoId ? produtoPorId(produtoId) : undefined;

  // Ajuste = "contei X no galpão". O sistema lança só a diferença pro
  // estoque bater com a contagem, em vez de a pessoa ter que fazer a conta.
  const contagem = useMemo(() => {
    if (quantidadeUn === "" && contagemCx === "") return null;
    const porCaixa = produtoSelecionado?.unPorCaixa ?? 1;
    return Number(contagemCx || 0) * porCaixa + Number(quantidadeUn || 0);
  }, [quantidadeUn, contagemCx, produtoSelecionado]);

  const produtosOrdenados = [...produtos].filter((p) => p.ativo);
  const produtosFiltrados = produtosOrdenados.filter((p) =>
    p.nome.toLowerCase().includes(buscaProduto.toLowerCase()),
  );

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return produtosOrdenados.filter(
      (p) => !termo || normalizar(p.nome).includes(termo) || normalizar(p.categoria).includes(termo),
    );
  }, [produtosOrdenados, busca]);

  const agrupados = useMemo(() => {
    const mapa = new Map<string, Produto[]>();
    for (const p of visiveis) {
      const chave = p.categoria || "Sem categoria";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => compararCategorias(a, b));
  }, [visiveis]);

  function limparFormulario() {
    setModalAberto(false);
    setProdutoId("");
    setBuscaProduto("");
    setFornecedorId("");
    setNovoFornecedor(null);
    setPagamento("AVISTA");
    setVencimentos([somarDias(hojeISO(), 30)]);
    setQuantidadeUn("");
    setContagemCx("");
    setCustoTotal("");
    setObs("");
    setTipoMovimento("COMPRA");
  }

  async function lancarAjuste(produto: Produto) {
    if (contagem === null || contagem < 0) return;
    const diferenca = contagem - produto.estoqueUn;
    if (diferenca === 0) {
      window.alert("A contagem bate com o estoque do sistema — nada a ajustar.");
      return;
    }
    await salvarMovimento({
      id: novoId(),
      produtoId: produto.id,
      produtoNome: produto.nome,
      tipo: diferenca > 0 ? "ENTRADA" : "SAIDA",
      origem: "AJUSTE",
      quantidadeUn: Math.abs(diferenca),
      data: hojeISO(),
      obs: [`Contagem: ${contagem} un (sistema tinha ${produto.estoqueUn})`, obs]
        .filter(Boolean)
        .join(" · "),
      criadoEm: new Date().toISOString(),
    });
    await salvarProduto({
      ...produto,
      estoqueUn: contagem,
      atualizadoEm: new Date().toISOString(),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const produto = produtoSelecionado;
    if (!produto) return;

    if (tipoMovimento === "AJUSTE") {
      setSalvando(true);
      try {
        await lancarAjuste(produto);
        limparFormulario();
      } finally {
        setSalvando(false);
      }
      return;
    }

    const qtd = Number(quantidadeUn);
    if (!quantidadeUn || qtd <= 0) return;
    const compra = tipoMovimento === "COMPRA";

    setSalvando(true);
    try {
      const fornecedor = compra
        ? await resolverFornecedor(fornecedores, salvarFornecedor, fornecedorId, novoFornecedor)
        : {};

      // Compra a prazo vira conta(s) a pagar no Financeiro, uma por parcela.
      let contaPagarIds: string[] | undefined;
      if (compra && pagamento === "PRAZO" && permissoes.financeiro && Number(custoTotal) > 0) {
        contaPagarIds = await criarContasPrazo(salvarContaPagar, {
          valorTotal: Number(custoTotal),
          vencimentos,
          descricao: `Compra: ${qtd} un de ${produto.nome}`,
          fornecedor,
          obs,
        });
      }

      let custoUn: number | undefined = undefined;
      if (compra && custoTotal) {
        custoUn = Number(custoTotal) / qtd;
      }

      await salvarMovimento({
        id: novoId(),
        produtoId: produto.id,
        produtoNome: produto.nome,
        tipo: compra ? "ENTRADA" : "SAIDA",
        origem: tipoMovimento,
        quantidadeUn: qtd,
        custoUn,
        fornecedorId: fornecedor.id,
        pagamento: compra ? pagamento : undefined,
        contaPagarIds,
        // Data local (não toISOString) — depois das 21h no fuso do Brasil,
        // o timestamp UTC já vira o dia seguinte e a movimentação aparecia
        // com a data errada no histórico.
        data: hojeISO(),
        obs: obs || undefined,
        criadoEm: new Date().toISOString(),
      });

      let novoPrecoCusto = produto.precoCusto;
      if (compra && custoUn !== undefined) {
        const comprasAnteriores = movimentos
          .filter((m) => m.produtoId === produto.id && m.origem === "COMPRA" && m.custoUn !== undefined)
          .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
          .slice(0, 2);

        let totalSoma = qtd * custoUn;
        let totalQtd = qtd;

        for (const c of comprasAnteriores) {
          totalSoma += c.quantidadeUn * c.custoUn!;
          totalQtd += c.quantidadeUn;
        }

        novoPrecoCusto = totalSoma / totalQtd;
      }

      // Sem clamp em 0: negativo avisa que o lançado não bate com a
      // realidade, em vez de esconder o problema.
      await salvarProduto({
        ...produto,
        estoqueUn: compra ? produto.estoqueUn + qtd : produto.estoqueUn - qtd,
        precoCusto: novoPrecoCusto,
        atualizadoEm: new Date().toISOString(),
      });

      limparFormulario();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Estoque"
        subtitulo="Quantidade atual e histórico por produto"
        acao={
          <button type="button" onClick={() => setModalAberto(true)} className="btn-primario text-sm">
            <Plus className="h-4 w-4" />
            Lançar Movimento
          </button>
        }
      />

      {orfaos.length > 0 && (
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-ouro-300 bg-ouro-50 px-4 py-3 text-sm dark:bg-ouro-900/20 md:mx-6">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {orfaos.length} lançamento(s) de pedidos já excluídos no histórico
            </span>
            <span className="block text-xs text-texto-suave">
              Não afeta a quantidade em estoque — só sujeira visual, de antes
              da correção que passou a limpar isso junto.
            </span>
          </span>
          <button
            type="button"
            className="btn-secundario shrink-0 text-xs"
            onClick={limparOrfaos}
            disabled={limpandoOrfaos}
          >
            {limpandoOrfaos ? "Limpando…" : "Limpar agora"}
          </button>
        </div>
      )}

      <div className="px-4 md:px-6">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-texto-suave" />
          <input
            className="campo pl-9"
            placeholder="Buscar produto ou categoria…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {visiveis.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-superficie-2 text-texto-suave">
              <Boxes className="h-7 w-7" />
            </div>
            <p className="font-bold">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {agrupados.map(([categoria, itens]) => (
              <section key={categoria}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
                  <Boxes className="h-3.5 w-3.5" />
                  {categoria}
                  <span className="font-normal normal-case">({itens.length})</span>
                </h2>
                <ul className="card divide-y divide-borda overflow-hidden">
                  {itens.map((p) => {
                    const negativo = p.estoqueUn < 0;
                    const baixo = !negativo && p.estoqueMinimo > 0 && p.estoqueUn <= p.estoqueMinimo;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setProdutoHistorico(p)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-superficie-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{p.nome}</p>
                            {p.unPorCaixa > 1 && (
                              <p className="text-xs text-texto-suave">{p.unPorCaixa} un/cx</p>
                            )}
                          </div>
                          {(baixo || negativo) && (
                            <AlertTriangle
                              className={`h-4 w-4 shrink-0 ${negativo ? "text-red-600 dark:text-red-400" : "text-acento"}`}
                              aria-label={negativo ? "Estoque negativo" : "Estoque baixo"}
                            />
                          )}
                          <div className={`shrink-0 text-right font-black tabular-nums ${
                              negativo
                                ? "text-red-600 dark:text-red-400"
                                : baixo
                                  ? "text-acento"
                                  : ""
                            }`}>
                            <span className="block">{p.estoqueUn} un</span>
                            {p.unPorCaixa > 1 && (
                              <span className="block text-[10px] text-texto-suave/80 font-bold uppercase mt-0.5">
                                {caixasEUnidades(p.estoqueUn, p.unPorCaixa)}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-texto-suave" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {produtoHistorico && (
        <ModalHistorico
          produto={produtoHistorico}
          movimentos={movimentos.filter((m) => m.produtoId === produtoHistorico.id)}
          aoFechar={() => setProdutoHistorico(null)}
        />
      )}

      <Modal
        aberto={modalAberto}
        aoFechar={() => !salvando && setModalAberto(false)}
        titulo="Novo Movimento de Estoque"
        rodape={
          <>
            <button
              type="button"
              disabled={salvando}
              onClick={() => setModalAberto(false)}
              className="btn-secundario px-4 py-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-movimento"
              disabled={
                salvando ||
                !produtoId ||
                (tipoMovimento === "AJUSTE" ? contagem === null : !quantidadeUn)
              }
              className="btn-primario px-6 py-2"
            >
              {salvando ? "Salvando..." : "Confirmar Lançamento"}
            </button>
          </>
        }
      >
        <form id="form-movimento" onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-2 p-1 bg-superficie-2 rounded-xl overflow-x-auto">
            {(["COMPRA", "AJUSTE", "PERDA"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipoMovimento(t)}
                className={`flex-1 min-w-[100px] rounded-lg py-2 text-xs font-bold uppercase tracking-wider transition ${
                  tipoMovimento === t
                    ? "bg-superficie text-texto shadow-sm border border-borda"
                    : "text-texto-suave hover:text-texto"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-sm font-semibold">Produto</label>
            <input
              type="text"
              value={produtoId ? produtos.find((p) => p.id === produtoId)?.nome || "" : buscaProduto}
              onChange={(e) => {
                setBuscaProduto(e.target.value);
                setProdutoId("");
              }}
              onFocus={() => setFocoBusca(true)}
              onBlur={() => setTimeout(() => setFocoBusca(false), 200)}
              required
              placeholder="Digite o nome do produto..."
              className="campo block w-full"
            />
            {focoBusca && !produtoId && (
              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-borda bg-superficie shadow-xl">
                {produtosFiltrados.length > 0 ? (
                  produtosFiltrados.map((p) => (
                    <li
                      key={p.id}
                      onClick={() => {
                        setProdutoId(p.id);
                        setBuscaProduto(p.nome);
                        setFocoBusca(false);
                      }}
                      className="cursor-pointer px-4 py-3 hover:bg-superficie-2 text-sm border-b border-borda last:border-0 transition-colors"
                    >
                      <span className="font-semibold">{p.nome}</span>
                      <span className="text-texto-suave text-xs ml-2">(Estoque atual: {p.estoqueUn} un)</span>
                    </li>
                  ))
                ) : (
                  <li className="px-4 py-3 text-texto-suave text-sm text-center">Nenhum produto encontrado</li>
                )}
              </ul>
            )}
          </div>

          {tipoMovimento === "COMPRA" && (
            <CampoFornecedor
              fornecedores={fornecedores}
              fornecedorId={fornecedorId}
              novoNome={novoFornecedor}
              podeCadastrar={permissoes.fornecedores}
              aoMudar={(id, nome) => {
                setFornecedorId(id);
                setNovoFornecedor(nome);
              }}
            />
          )}

          {tipoMovimento === "AJUSTE" ? (
            <div>
              <label className="mb-1.5 block text-sm font-semibold">
                Quanto tem no galpão agora
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(produtoSelecionado?.unPorCaixa ?? 1) > 1 && (
                  <div className="relative min-w-0">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={contagemCx}
                      onChange={(e) => setContagemCx(e.target.value)}
                      placeholder="0"
                      className="campo block w-full pr-10"
                    />
                    <span className="pointer-events-none absolute top-2.5 right-4 text-sm text-texto-suave">cx</span>
                  </div>
                )}
                <div className="relative min-w-0">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={quantidadeUn}
                    onChange={(e) => setQuantidadeUn(e.target.value)}
                    placeholder="0"
                    className="campo block w-full pr-10"
                  />
                  <span className="pointer-events-none absolute top-2.5 right-4 text-sm text-texto-suave">un</span>
                </div>
              </div>
              <p className="mt-1 text-xs text-texto-suave">
                Digite o total que tem no galpão agora (não o quanto somar).
              </p>
              {produtoSelecionado && contagem !== null && (
                <div className="mt-2 rounded-xl border border-borda bg-superficie-2 px-3 py-2 text-sm">
                  <p>
                    Estoque vai ficar em{" "}
                    <strong className="tabular-nums">{contagem} un</strong>
                    {produtoSelecionado.unPorCaixa > 1 && (
                      <span className="text-texto-suave">
                        {" "}({caixasEUnidades(contagem, produtoSelecionado.unPorCaixa)})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-texto-suave">
                    Hoje o sistema mostra {produtoSelecionado.estoqueUn} un — a correção é de{" "}
                    <strong
                      className={
                        contagem - produtoSelecionado.estoqueUn < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {contagem - produtoSelecionado.estoqueUn > 0 ? "+" : ""}
                      {contagem - produtoSelecionado.estoqueUn} un
                    </strong>
                    .
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Quantidade ({tipoMovimento === "PERDA" ? "Saída" : "Entrada"})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantidadeUn}
                    onChange={(e) => setQuantidadeUn(e.target.value)}
                    required
                    placeholder="0"
                    className="campo block w-full pr-12"
                  />
                  <span className="absolute right-4 top-2.5 text-sm text-texto-suave pointer-events-none">un</span>
                </div>
              </div>

              {tipoMovimento === "COMPRA" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">Custo Total (R$)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={custoTotal}
                    onChange={(e) => setCustoTotal(e.target.value)}
                    required
                    placeholder="0,00"
                    className="campo block w-full"
                  />
                </div>
              )}
            </div>
          )}

          {tipoMovimento === "COMPRA" && (
            <CamposPagamento
              podePrazo={permissoes.financeiro}
              pagamento={pagamento}
              setPagamento={setPagamento}
              vencimentos={vencimentos}
              setVencimentos={setVencimentos}
              valorTotal={Number(custoTotal) || 0}
            />
          )}

          {tipoMovimento === "COMPRA" && quantidadeUn && custoTotal && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg shrink-0">
                <RefreshCcw className="w-5 h-5" />
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                Isso atualizará o <strong>Custo Médio Ponderado</strong> do produto. <br />
                O custo unitário dessa compra saiu a{" "}
                <strong>{brl(Number(custoTotal) / Number(quantidadeUn))}</strong>.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold">Observação (Opcional)</label>
            <input
              type="text"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: Nota fiscal 1234, garrafa quebrada..."
              className="campo block w-full"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Histórico de um produto — com filtro de data, pra saber "quanto vendi em X". */
interface LinhaHistorico {
  chave: string;
  rotulo: string;
  detalhe: string;
  data: string;
  obs?: string;
  /** Positivo = entrou no galpão, negativo = saiu. */
  quantidade: number;
  dePedido?: boolean;
  /** Lançamento de compra — a linha abre a edição de fornecedor/pagamento. */
  compra?: EstoqueMovimento;
}

/** "a prazo, 3x · 1 paga · vence 10/11/2026" a partir das contas da compra. */
function resumoPrazo(m: EstoqueMovimento, contasPagar: ContaPagar[]): string {
  const contas = idsDasContas(m)
    .map((id) => contasPagar.find((c) => c.id === id))
    .filter((c): c is ContaPagar => !!c);
  if (contas.length === 0) return "a prazo";
  const partes = ["a prazo" + (contas.length > 1 ? `, ${contas.length}x` : "")];
  const pagas = contas.filter((c) => c.pago).length;
  if (pagas === contas.length) {
    partes.push("pago");
  } else {
    if (pagas > 0) partes.push(`${pagas} paga${pagas > 1 ? "s" : ""}`);
    const proxima = contas
      .filter((c) => !c.pago)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0];
    partes.push(`vence ${dataBR(proxima.vencimento)}`);
  }
  return partes.join(" · ");
}

function ModalHistorico({
  produto,
  movimentos,
  aoFechar,
}: {
  produto: Produto;
  movimentos: EstoqueMovimento[];
  aoFechar: () => void;
}) {
  const { pedidoPorId, fornecedores, contasPagar } = useDados();
  const [editandoCompra, setEditandoCompra] = useState<EstoqueMovimento | null>(null);
  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hojeISO());

  // Lançamentos de pedido (saída/devolução) são agrupados numa linha só por
  // pedido, com o saldo líquido. O salvamento automático do pedido lança um
  // movimento a cada ajuste de quantidade (digitou 100, corrigiu pra 81,
  // lançou devolução…), o que enchia o histórico de linhas que se anulam.
  // Compra, ajuste e perda continuam aparecendo um por um.
  const linhas = useMemo(() => {
    const doPeriodo = movimentos.filter((m) => {
      const data = m.data.slice(0, 10);
      return data >= de && data <= ate;
    });

    const resultado: LinhaHistorico[] = [];
    const porPedido = new Map<string, LinhaHistorico>();

    for (const m of doPeriodo) {
      const dePedido =
        (m.origem === "PEDIDO" || m.origem === "DEVOLUCAO") && m.referenciaId;
      if (!dePedido) {
        let detalhe = "";
        if (m.origem === "COMPRA") {
          const f = m.fornecedorId
            ? fornecedores.find((x) => x.id === m.fornecedorId)
            : undefined;
          detalhe = f ? f.nome : "sem fornecedor";
          if (m.custoUn) detalhe += (detalhe ? " · " : "") + brl(m.custoUn) + "/un";
          if (m.pagamento === "AVISTA") detalhe += " · à vista";
          if (m.pagamento === "PRAZO") detalhe += " · " + resumoPrazo(m, contasPagar);
        }
        resultado.push({
          chave: m.id,
          rotulo: ROTULO_ORIGEM[m.origem],
          detalhe,
          data: m.data,
          obs: m.obs,
          // Ajustes antigos têm tipo "AJUSTE" e sempre somavam; os novos
          // (por contagem) já vêm como ENTRADA ou SAIDA.
          quantidade: m.tipo === "SAIDA" ? -m.quantidadeUn : m.quantidadeUn,
          compra: m.origem === "COMPRA" ? m : undefined,
        });
        continue;
      }

      const sinal = m.tipo === "SAIDA" ? -1 : 1;
      const existente = porPedido.get(m.referenciaId!);
      if (existente) {
        existente.quantidade += sinal * m.quantidadeUn;
        if (m.data > existente.data) existente.data = m.data;
      } else {
        const pedido = pedidoPorId(m.referenciaId!);
        const linha: LinhaHistorico = {
          chave: m.referenciaId!,
          rotulo: pedido ? `Pedido #${String(pedido.numero).padStart(3, "0")}` : "Pedido excluído",
          detalhe: pedido
            ? pedido.clienteNome + (pedido.titulo ? ` · ${pedido.titulo}` : "")
            : "",
          data: m.data,
          quantidade: sinal * m.quantidadeUn,
          dePedido: true,
        };
        porPedido.set(m.referenciaId!, linha);
        resultado.push(linha);
      }
    }

    return resultado.sort((x, y) => y.data.localeCompare(x.data));
  }, [movimentos, de, ate, pedidoPorId, fornecedores, contasPagar]);

  const totalSaida = linhas.filter((l) => l.quantidade < 0).reduce((s, l) => s - l.quantidade, 0);
  const totalEntrada = linhas.filter((l) => l.quantidade > 0).reduce((s, l) => s + l.quantidade, 0);

  return (
    <Modal aberto aoFechar={aoFechar} titulo={produto.nome} largura="max-w-xl">
      <div className="space-y-4">
        {produto.unPorCaixa > 1 && (
          <p className="-mt-2 text-sm text-texto-suave">
            Quantidade por caixa: <strong className="text-texto">{produto.unPorCaixa} un</strong>
          </p>
        )}
        <div className="card flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-texto-suave">Estoque atual</span>
          <div className="text-right">
            <span
              className={`block text-xl font-black tabular-nums ${
                produto.estoqueUn < 0 ? "text-red-600 dark:text-red-400" : ""
              }`}
            >
              {produto.estoqueUn} un
            </span>
            {produto.unPorCaixa > 1 && (
              <span className="block text-[11px] font-semibold text-texto-suave uppercase">
                {caixasEUnidades(produto.estoqueUn, produto.unPorCaixa)}
              </span>
            )}
          </div>
        </div>
        {produto.estoqueUn < 0 && (
          <p className="-mt-2 text-xs text-red-600 dark:text-red-400">
            Negativo — venderam mais do que estava lançado. Faz um "Ajuste" pra
            corrigir com a contagem real do galpão.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="rotulo" htmlFor="hist-de">
              De
            </label>
            <input
              id="hist-de"
              type="date"
              className="campo w-full min-w-0"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div className="min-w-0">
            <label className="rotulo" htmlFor="hist-ate">
              Até
            </label>
            <input
              id="hist-ate"
              type="date"
              className="campo w-full min-w-0"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="card px-3 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
              <ArrowUp className="h-3 w-3 text-red-500" />
              Saiu no período
            </p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-red-600 dark:text-red-400">
              {totalSaida} un
            </p>
          </div>
          <div className="card px-3 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-texto-suave uppercase">
              <ArrowDown className="h-3 w-3 text-emerald-500" />
              Entrou no período
            </p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalEntrada} un
            </p>
          </div>
        </div>

        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-texto-suave">
            Nenhuma movimentação nesse período.
          </p>
        ) : (
          <ul className="card divide-y divide-borda overflow-hidden">
            {linhas.map((l) => {
              const entrada = l.quantidade > 0;
              const zerado = l.quantidade === 0;
              return (
                <li
                  key={l.chave}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    l.compra ? "cursor-pointer transition hover:bg-superficie-2" : ""
                  }`}
                  onClick={l.compra ? () => setEditandoCompra(l.compra!) : undefined}
                >
                  {zerado ? (
                    <span className="h-4 w-4 shrink-0" />
                  ) : entrada ? (
                    <ArrowDown className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowUp className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug font-semibold">
                      {l.rotulo}
                      {l.detalhe && (
                        <span className="ml-1 text-xs font-normal text-texto-suave">
                          {l.detalhe}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {dataBR(l.data)}
                      {l.dePedido &&
                        (zerado
                          ? " · tudo voltou"
                          : entrada
                            ? " · devolução líquida"
                            : " · saída líquida")}
                      {l.obs && ` · ${l.obs}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-black tabular-nums ${
                      zerado
                        ? "text-texto-suave"
                        : entrada
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {entrada ? "+" : ""}
                    {l.quantidade} un
                  </span>
                  {l.compra && <Pencil className="h-3.5 w-3.5 shrink-0 text-texto-suave" />}
                </li>
              );
            })}
          </ul>
        )}
        {linhas.some((l) => l.compra) && (
          <p className="-mt-2 text-center text-xs text-texto-suave">
            Toque numa compra pra mudar o fornecedor ou a forma de pagamento.
          </p>
        )}
      </div>

      {editandoCompra && (
        <ModalEditarCompra
          movimento={editandoCompra}
          aoFechar={() => setEditandoCompra(null)}
        />
      )}
    </Modal>
  );
}

/**
 * Corrige fornecedor e forma de pagamento de uma compra já lançada.
 * Quantidade e custo não mudam aqui (mexeriam no estoque e no custo médio).
 * Se já tem parcela paga, só o fornecedor pode mudar — refazer as parcelas
 * apagaria um pagamento já registrado.
 */
function ModalEditarCompra({
  movimento,
  aoFechar,
}: {
  movimento: EstoqueMovimento;
  aoFechar: () => void;
}) {
  const { permissoes } = useAuth();
  const {
    fornecedores,
    contasPagar,
    salvarFornecedor,
    salvarContaPagar,
    removerContaPagar,
    salvarMovimento,
  } = useDados();

  const contas = useMemo(
    () =>
      idsDasContas(movimento)
        .map((id) => contasPagar.find((c) => c.id === id))
        .filter((c): c is ContaPagar => !!c)
        .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [movimento, contasPagar],
  );
  const algumaPaga = contas.some((c) => c.pago);

  const inicial = {
    pagamento: (movimento.pagamento ?? "AVISTA") as FormaCompra,
    vencimentos:
      contas.length > 0
        ? contas.map((c) => c.vencimento)
        : [somarDias(movimento.data.slice(0, 10), 30)],
  };

  const [fornecedorId, setFornecedorId] = useState(movimento.fornecedorId ?? "");
  const [novoNome, setNovoNome] = useState<string | null>(null);
  const [pagamento, setPagamento] = useState<FormaCompra>(inicial.pagamento);
  const [vencimentos, setVencimentos] = useState<string[]>(inicial.vencimentos);
  const [salvando, setSalvando] = useState(false);

  const valorTotal = movimento.custoUn
    ? Math.round(movimento.custoUn * movimento.quantidadeUn * 100) / 100
    : 0;

  async function salvar() {
    setSalvando(true);
    try {
      const fornecedor = await resolverFornecedor(
        fornecedores,
        salvarFornecedor,
        fornecedorId,
        novoNome,
      );

      const mudouPagamento =
        pagamento !== inicial.pagamento ||
        (pagamento === "PRAZO" &&
          vencimentos.join() !== inicial.vencimentos.join());

      let ids = contas.map((c) => c.id);
      if (mudouPagamento && !algumaPaga) {
        // Refaz as parcelas do zero conforme a escolha nova.
        for (const id of ids) await removerContaPagar(id);
        ids = [];
        if (pagamento === "PRAZO" && valorTotal > 0) {
          ids = await criarContasPrazo(salvarContaPagar, {
            valorTotal,
            vencimentos,
            descricao: `Compra: ${movimento.quantidadeUn} un de ${movimento.produtoNome}`,
            fornecedor,
            obs: movimento.obs,
          });
        }
      } else {
        // Só o fornecedor mudou: atualiza nas contas que já existem (quem não
        // tem Financeiro não pode gravar lá — a conta fica com o nome antigo).
        for (const c of permissoes.financeiro ? contas : []) {
          await salvarContaPagar({
            ...c,
            fornecedorId: fornecedor.id,
            fornecedorNome: fornecedor.nome,
          });
        }
      }

      await salvarMovimento({
        ...movimento,
        fornecedorId: fornecedor.id,
        pagamento: algumaPaga ? movimento.pagamento : pagamento,
        contaPagarId: undefined,
        contaPagarIds: ids.length > 0 ? ids : undefined,
      });
      aoFechar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      aoFechar={() => !salvando && aoFechar()}
      titulo="Editar compra"
      rodape={
        <>
          <button className="btn-secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          <button className="btn-primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-texto-suave">
          {movimento.quantidadeUn} un de <strong className="text-texto">{movimento.produtoNome}</strong>{" "}
          em {dataBR(movimento.data)}
          {valorTotal > 0 && ` · total ${brl(valorTotal)}`}
        </p>

        <CampoFornecedor
          fornecedores={fornecedores}
          fornecedorId={fornecedorId}
          novoNome={novoNome}
          podeCadastrar={permissoes.fornecedores}
          aoMudar={(id, nome) => {
            setFornecedorId(id);
            setNovoNome(nome);
          }}
        />

        {valorTotal > 0 ? (
          <CamposPagamento
            podePrazo={permissoes.financeiro}
            pagamento={pagamento}
            setPagamento={setPagamento}
            vencimentos={vencimentos}
            setVencimentos={setVencimentos}
            valorTotal={valorTotal}
            bloqueado={
              algumaPaga
                ? "Já tem parcela paga no Financeiro — a forma de pagamento não pode mais mudar por aqui."
                : !permissoes.financeiro && movimento.pagamento === "PRAZO"
                  ? "Mudar o pagamento de uma compra a prazo exige acesso ao Financeiro."
                  : undefined
            }
          />
        ) : (
          <p className="text-xs text-texto-suave">
            Essa compra foi lançada sem custo, então não dá pra gerar conta a pagar.
          </p>
        )}
      </div>
    </Modal>
  );
}
