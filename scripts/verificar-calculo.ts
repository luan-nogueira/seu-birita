/**
 * Confere os cálculos do sistema contra a planilha real do acerto
 * "ESTAÇÃO LOUNGE", cujos totais são conhecidos:
 *
 *   VALOR PEDIDO ... R$ 15.018
 *   VALOR FINAL .... R$  3.556
 *   PENDÊNCIA ...... R$  4.617
 *   TOTAL .......... R$  8.173
 *
 * Rodar com:  node --experimental-strip-types scripts/verificar-calculo.ts
 */

import { calcularTotais } from "../src/lib/calc.ts";
import type { Pedido, PedidoItem } from "../src/lib/types.ts";

/** [nome, un/cx, preço, entregaCx, entregaUn, devCx, devUn] */
const PLANILHA: [string, number, number, number, number, number, number][] = [
  ["Corona LN", 24, 6.9, 25, 0, 18, 0],
  ["Stella Pure Gold", 24, 6.9, 5, 0, 5, 0],
  ["Red Bull", 24, 8, 7, 0, 2, 22],
  ["Red Bull Tropical", 24, 8, 5, 0, 1, 18],
  ["Red Bull Melancia", 24, 8, 0, 0, 0, 0],
  ["St Pierre", 24, 5, 2, 0, 0, 21],
  ["Grey Goose", 6, 140, 0, 0, 0, 0],
  ["Suco LT", 6, 4, 2, 0, 1, 2],
  ["Coca-Cola LT", 12, 4, 8, 0, 2, 18],
  ["Guaraná LT 350ml", 12, 4, 2, 0, 1, 10],
  ["Água Tônica", 12, 4, 0, 36, 1, 10],
  ["Vodka Absolut", 12, 90, 1, 0, 1, 0],
  ["Vodka Smirnoff", 12, 38, 1, 0, 1, 0],
  ["Vodka Cîroc", 6, 140, 0, 0, 0, 0],
  ["Black Label 1L", 6, 180, 0, 6, 0, 6],
  ["Red Label", 6, 100, 0, 6, 0, 6],
  ["Água 500ml", 12, 1, 20, 0, 0, 0],
  ["Água com Gás", 12, 1.9, 10, 0, 0, 0],
  ["Bags", 1, 30, 0, 100, 0, 100],
  ["Caixa Térmica", 1, 30, 0, 5, 0, 2],
];

const itens: PedidoItem[] = PLANILHA.map(
  ([nome, unPorCaixa, precoUn, eCx, eUn, dCx, dUn], i) => ({
    produtoId: `p${i}`,
    nome,
    unPorCaixa,
    precoUn,
    entregas: [{ numero: 1, cx: eCx, un: eUn }],
    devolucaoCx: dCx,
    devolucaoUn: dUn,
  }),
);

const pedido: Pedido = {
  id: "teste",
  numero: 1,
  clienteId: "c1",
  clienteNome: "Estação Lounge",
  tipo: "CONSIGNACAO",
  dataEvento: "2026-01-01",
  status: "ACERTO",
  pendenciaAnterior: 4617,
  desconto: 0,
  itens,
  valorPedido: 0,
  valorFinal: 0,
  valorPago: 0,
  criadoEm: "",
  atualizadoEm: "",
};

// Na planilha, bags e caixa térmica entram como item comum (sem regra de comodato).
const t = calcularTotais(pedido, () => false);

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const casos: [string, number, number][] = [
  ["Valor do pedido (mercadoria entregue)", t.valorPedido, 15018],
  ["Valor final (consumo)", t.valorFinal, 3556.2],
  ["Pendência anterior", t.pendenciaAnterior, 4617],
  ["Total a receber", t.totalReceber, 8173.2],
];

let falhou = false;

console.log("\n  Conferência contra a planilha do Estação Lounge\n");

for (const [rotulo, obtido, esperado] of casos) {
  const ok = Math.abs(obtido - esperado) < 0.01;
  if (!ok) falhou = true;
  console.log(
    `  ${ok ? "OK  " : "FALHA"}  ${rotulo.padEnd(38)} ` +
      `${brl(obtido).padStart(13)}` +
      (ok ? "" : `   esperado ${brl(esperado)}`),
  );
}

console.log(
  `\n  ${t.unidadesEntregues} un entregues · ` +
    `${t.unidadesDevolvidas} devolvidas · ` +
    `${t.unidadesConsumidas} consumidas\n`,
);

if (falhou) {
  console.error("  Os cálculos divergem da planilha.\n");
  process.exit(1);
}

console.log("  Todos os totais batem com a planilha original.\n");
