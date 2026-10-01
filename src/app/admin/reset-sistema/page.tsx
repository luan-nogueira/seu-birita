"use client";

import { useState } from "react";
import { Cabecalho } from "@/components/ui";
import { Protegido } from "@/components/Protegido";
import { useDados } from "@/lib/store";

export default function ResetSistemaPage() {
  return (
    <Protegido chave="excluir">
      <ResetSistemaPageInterno />
    </Protegido>
  );
}

function ResetSistemaPageInterno() {
  const {
    clientes, pedidos, pagamentos, movimentos, pedidosClientes, contasPagar, produtos,
    removerCliente, removerPedido, removerPagamento, removerMovimento, removerPedidoCliente, removerContaPagar, salvarProduto
  } = useDados();

  const [limpando, setLimpando] = useState(false);
  const [progresso, setProgresso] = useState("");

  async function limparTudo() {
    if (!window.confirm("ATENÇÃO: ISSO VAI APAGAR TODOS OS DADOS DO SISTEMA EXCETO O CADASTRO DE PRODUTOS E FORNECEDORES! DESEJA CONTINUAR?")) return;
    
    setLimpando(true);
    try {
      setProgresso("Apagando pedidos...");
      for (const p of pedidos) await removerPedido(p.id);

      setProgresso("Apagando pedidos de clientes (site)...");
      for (const pc of pedidosClientes) await removerPedidoCliente(pc.id);

      setProgresso("Apagando pagamentos...");
      for (const pg of pagamentos) await removerPagamento(pg.id);

      setProgresso("Apagando contas a pagar...");
      for (const cp of contasPagar) await removerContaPagar(cp.id);

      setProgresso("Apagando movimentos de estoque...");
      for (const m of movimentos) await removerMovimento(m.id);

      setProgresso("Apagando clientes...");
      for (const c of clientes) await removerCliente(c.id);

      setProgresso("Zerando estoque e custos dos produtos...");
      for (const pr of produtos) {
        if (pr.estoqueUn !== 0 || pr.precoCusto !== 0) {
          await salvarProduto({ ...pr, estoqueUn: 0, precoCusto: 0, atualizadoEm: new Date().toISOString() });
        }
      }

      setProgresso("LIMPEZA CONCLUÍDA!");
      window.alert("Sistema zerado com sucesso!");
    } catch (e) {
      console.error(e);
      window.alert("Erro ao limpar dados.");
      setProgresso("Erro!");
    } finally {
      setLimpando(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Zerar Sistema" subtitulo="Área de perigo" />
      <div className="px-4 md:px-6 mt-6">
        <div className="card p-6 border-red-500 border-2">
          <h2 className="text-xl font-bold text-red-600 mb-4">RESET COMPLETO</h2>
          <p className="mb-4">Isso irá apagar:</p>
          <ul className="list-disc ml-6 mb-6">
            <li>Todos os clientes ({clientes.length})</li>
            <li>Todos os pedidos internos ({pedidos.length}) e do site ({pedidosClientes.length})</li>
            <li>Todos os pagamentos ({pagamentos.length}) e contas a pagar ({contasPagar.length})</li>
            <li>Todos os históricos de estoque ({movimentos.length})</li>
            <li><strong>Zerar o estoque e o custo</strong> de todos os produtos ({produtos.length})</li>
          </ul>
          <button 
            className="btn-perigo w-full py-4 text-lg font-bold"
            onClick={limparTudo}
            disabled={limpando}
          >
            {limpando ? "Apagando..." : "APAGAR TUDO E ZERAR ESTOQUE"}
          </button>
          {progresso && <p className="mt-4 font-bold">{progresso}</p>}
        </div>
      </div>
    </>
  );
}
