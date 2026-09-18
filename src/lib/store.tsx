"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { colecao, modoDemonstracao, novoId } from "./db";
import { calcularTotais } from "./calc";
import { useAuth } from "./auth";
import type {
  Cliente,
  ContaPagar,
  EstoqueMovimento,
  Fornecedor,
  Pagamento,
  Pedido,
  PedidoCliente,
  Produto,
  Usuario,
} from "./types";

interface Dados {
  produtos: Produto[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
  pedidos: Pedido[];
  pagamentos: Pagamento[];
  movimentos: EstoqueMovimento[];
  pedidosClientes: PedidoCliente[];
  contasPagar: ContaPagar[];
  /** Quantidade de pedidos com status NOVO — para o badge da navegação */
  pedidosClientesNovos: number;
  usuarios: Usuario[];
  carregando: boolean;
  modoDemonstracao: boolean;

  salvarProduto: (p: Produto) => Promise<void>;
  removerProduto: (id: string) => Promise<void>;
  salvarCliente: (c: Cliente) => Promise<void>;
  removerCliente: (id: string) => Promise<void>;
  salvarFornecedor: (f: Fornecedor) => Promise<void>;
  removerFornecedor: (id: string) => Promise<void>;
  salvarPedido: (p: Pedido) => Promise<void>;
  removerPedido: (id: string) => Promise<void>;
  salvarPagamento: (p: Pagamento) => Promise<void>;
  removerPagamento: (id: string) => Promise<void>;
  salvarMovimento: (m: EstoqueMovimento) => Promise<void>;
  salvarPedidoCliente: (p: PedidoCliente) => Promise<void>;
  removerPedidoCliente: (id: string) => Promise<void>;
  salvarContaPagar: (c: ContaPagar) => Promise<void>;
  removerContaPagar: (id: string) => Promise<void>;
  salvarUsuario: (u: Usuario) => Promise<void>;
  removerUsuario: (id: string) => Promise<void>;

  proximoNumeroPedido: () => number;
  proximoNumeroPedidoCliente: () => number;
  produtoPorId: (id: string) => Produto | undefined;
  clientePorId: (id: string) => Cliente | undefined;
  pedidoPorId: (id: string) => Pedido | undefined;
  /** Soma do que o cliente ainda deve em pedidos não finalizados. */
  pendenciaDoCliente: (clienteId: string, ignorarPedidoId?: string) => number;
}

const DadosContext = createContext<Dados | null>(null);

/** Escuta uma coleção pública (sem exigir login) e devolve os itens. */
function useColecao<T extends { id: string }>(
  nome: Parameters<typeof colecao>[0],
  aoCarregar: () => void,
) {
  const [itens, setItens] = useState<T[]>([]);

  useEffect(() => {
    let primeiro = true;
    const parar = colecao<T>(nome).observar((novos) => {
      setItens(novos);
      if (primeiro) {
        primeiro = false;
        aoCarregar();
      }
    });
    return parar;
    // aoCarregar é estável (vem de useCallback no provider)
  }, [nome, aoCarregar]);

  return itens;
}

/**
 * Escuta uma coleção protegida — só inicia a subscription quando `ativo`
 * é verdadeiro (i.e. o usuário está autenticado).
 * Enquanto inativo, devolve [] e notifica aoCarregar() imediatamente,
 * para o contador de "prontas" não travar o carregando.
 */
function useColecaoProtegida<T extends { id: string }>(
  nome: Parameters<typeof colecao>[0],
  aoCarregar: () => void,
  ativo: boolean,
) {
  const [itens, setItens] = useState<T[]>([]);

  // Quando passa de inativo → ativo, reseta para não acumular dados stale.
  useEffect(() => {
    if (!ativo) {
      setItens([]);
      // Notifica imediatamente para que "prontas" avance mesmo sem auth.
      aoCarregar();
      return;
    }

    let primeiro = true;
    const parar = colecao<T>(nome).observar((novos) => {
      setItens(novos);
      if (primeiro) {
        primeiro = false;
        aoCarregar();
      }
    });
    return parar;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, ativo]);
  // Nota: aoCarregar intencionalmente omitido das deps — é estável via useCallback.

  return itens;
}

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const [prontas, setProntas] = useState(0);
  const marcarPronta = useCallback(() => setProntas((n) => n + 1), []);

  const { usuario, exigeLogin, ehAdmin, carregando: authCarregando } = useAuth();
  // Só escuta coleções protegidas quando está logado (ou em modo demonstração
  // sem Firebase, onde não há autenticação — exigeLogin === false).
  const logado = !exigeLogin || !!usuario;

  // Coleção pública: qualquer um lê.
  const produtos = useColecao<Produto>("produtos", marcarPronta);

  // Coleções protegidas: só observam com login.
  const clientes = useColecaoProtegida<Cliente>("clientes", marcarPronta, logado);
  const fornecedores = useColecaoProtegida<Fornecedor>("fornecedores", marcarPronta, logado);
  const pedidos = useColecaoProtegida<Pedido>("pedidos", marcarPronta, logado);
  const pagamentos = useColecaoProtegida<Pagamento>("pagamentos", marcarPronta, logado);
  const movimentos = useColecaoProtegida<EstoqueMovimento>("movimentos", marcarPronta, logado);
  const pedidosClientes = useColecaoProtegida<PedidoCliente>("pedidosClientes", marcarPronta, logado);
  const contasPagar = useColecaoProtegida<ContaPagar>("contasPagar", marcarPronta, logado);
  // Só admin pode listar a coleção inteira de usuários (a regra do Firestore
  // só libera "list" pra admin — um funcionário só lê o próprio documento,
  // isso é feito à parte em auth.tsx).
  const usuarios = useColecaoProtegida<Usuario>("usuarios", marcarPronta, logado && ehAdmin);

  const valor = useMemo<Dados>(() => {
    const produtosOrdenados = [...produtos].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    const clientesOrdenados = [...clientes].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
    const pedidosOrdenados = [...pedidos].sort((a, b) =>
      b.dataEvento.localeCompare(a.dataEvento) || b.numero - a.numero,
    );

    const salvarEm =
      <T extends { id: string }>(nome: Parameters<typeof colecao>[0]) =>
      (item: T) =>
        colecao<T>(nome).salvar(item);
    const removerDe =
      (nome: Parameters<typeof colecao>[0]) => (id: string) =>
        colecao(nome).remover(id);

    return {
      produtos: produtosOrdenados,
      clientes: clientesOrdenados,
      fornecedores,
      pedidos: pedidosOrdenados,
      pagamentos,
      movimentos,
      pedidosClientes: [...pedidosClientes].sort(
        (a, b) => b.criadoEm.localeCompare(a.criadoEm),
      ),
      pedidosClientesNovos: pedidosClientes.filter((p) => p.status === "NOVO")
        .length,
      contasPagar: [...contasPagar].sort((a, b) =>
        a.vencimento.localeCompare(b.vencimento),
      ),
      usuarios: [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      // Aguarda: auth resolvida + 9 coleções respondidas.
      // Em modo demonstração authCarregando é sempre false.
      carregando: authCarregando || prontas < 9,
      modoDemonstracao,

      salvarProduto: salvarEm<Produto>("produtos"),
      removerProduto: removerDe("produtos"),
      salvarCliente: salvarEm<Cliente>("clientes"),
      removerCliente: removerDe("clientes"),
      salvarFornecedor: salvarEm<Fornecedor>("fornecedores"),
      removerFornecedor: removerDe("fornecedores"),
      salvarPedido: salvarEm<Pedido>("pedidos"),
      removerPedido: removerDe("pedidos"),
      salvarPagamento: salvarEm<Pagamento>("pagamentos"),
      removerPagamento: removerDe("pagamentos"),
      salvarMovimento: salvarEm<EstoqueMovimento>("movimentos"),
      salvarPedidoCliente: salvarEm<PedidoCliente>("pedidosClientes"),
      removerPedidoCliente: removerDe("pedidosClientes"),
      salvarContaPagar: salvarEm<ContaPagar>("contasPagar"),
      removerContaPagar: removerDe("contasPagar"),
      salvarUsuario: salvarEm<Usuario>("usuarios"),
      removerUsuario: removerDe("usuarios"),

      proximoNumeroPedido: () =>
        pedidos.reduce((max, p) => Math.max(max, p.numero || 0), 0) + 1,
      proximoNumeroPedidoCliente: () =>
        pedidosClientes.reduce((max, p) => Math.max(max, p.numero || 0), 0) + 1,
      produtoPorId: (id) => produtos.find((p) => p.id === id),
      clientePorId: (id) => clientes.find((c) => c.id === id),
      pedidoPorId: (id) => pedidos.find((p) => p.id === id),

      // Rascunho não fica de fora daqui — um pedido pode ter saldo real
      // (ex: pendência anterior lançada nele) mesmo antes de sair do estágio
      // de rascunho, e essa dívida não pode desaparecer do cálculo.
      pendenciaDoCliente: (clienteId, ignorarPedidoId) =>
        pedidos
          .filter(
            (p) =>
              p.clienteId === clienteId &&
              p.id !== ignorarPedidoId &&
              p.status !== "CANCELADO",
          )
          .reduce((soma, p) => soma + calcularTotais(p).saldoAberto, 0),
    };
  }, [authCarregando, produtos, clientes, fornecedores, pedidos, pagamentos, movimentos, pedidosClientes, contasPagar, usuarios, prontas]);

  return <DadosContext.Provider value={valor}>{children}</DadosContext.Provider>;
}

export function useDados(): Dados {
  const ctx = useContext(DadosContext);
  if (!ctx) throw new Error("useDados precisa estar dentro de <DadosProvider>");
  return ctx;
}

export { novoId };
