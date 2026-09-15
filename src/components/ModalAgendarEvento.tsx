"use client";

import { useState } from "react";
import { Modal } from "./ui";
import { useDados, novoId } from "@/lib/store";
import { hojeISO } from "@/lib/format";
import type { PedidoCliente } from "@/lib/types";

interface Props {
  aberto: boolean;
  aoFechar: () => void;
}

function formVazio() {
  return {
    nomeCliente: "",
    telefone: "",
    localEvento: "",
    dataEvento: hojeISO(),
    obs: "",
  };
}

/**
 * Agenda um evento sem passar pelo fluxo completo de pedido — cria um
 * PedidoCliente sem itens, só pra reservar a data na Agenda. Depois dá pra
 * editar em "Online" e lançar os itens quando o pedido for fechado.
 */
export function ModalAgendarEvento({ aberto, aoFechar }: Props) {
  const { salvarPedidoCliente, proximoNumeroPedidoCliente } = useDados();
  const [form, setForm] = useState(formVazio());

  function fechar() {
    setForm(formVazio());
    aoFechar();
  }

  async function salvar() {
    const nomeCliente = form.nomeCliente.trim();
    if (!nomeCliente || !form.dataEvento) return;

    const agora = new Date().toISOString();
    const pedido: PedidoCliente = {
      id: novoId(),
      numero: proximoNumeroPedidoCliente(),
      nomeCliente,
      telefone: form.telefone.trim(),
      localEvento: form.localEvento.trim(),
      dataEvento: form.dataEvento,
      obs: form.obs.trim() || undefined,
      itens: [],
      valorTotal: 0,
      status: "CONFIRMADO",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    await salvarPedidoCliente(pedido);
    fechar();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Agendar evento"
      rodape={
        <>
          <button className="btn-secundario" onClick={fechar}>
            Cancelar
          </button>
          <button
            className="btn-primario"
            onClick={salvar}
            disabled={!form.nomeCliente.trim() || !form.dataEvento}
          >
            Agendar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="ae-nome">
            Nome do cliente
          </label>
          <input
            id="ae-nome"
            className="campo"
            autoFocus
            placeholder="Ex: Estação Lounge"
            value={form.nomeCliente}
            onChange={(e) => setForm({ ...form, nomeCliente: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="rotulo" htmlFor="ae-data">
              Data do evento
            </label>
            <input
              id="ae-data"
              type="date"
              className="campo"
              value={form.dataEvento}
              onChange={(e) => setForm({ ...form, dataEvento: e.target.value })}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="ae-tel">
              Telefone
            </label>
            <input
              id="ae-tel"
              className="campo"
              inputMode="tel"
              placeholder="(22) 99826-2835"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="rotulo" htmlFor="ae-local">
            Local do evento
          </label>
          <input
            id="ae-local"
            className="campo"
            placeholder="Endereço ou nome do espaço"
            value={form.localEvento}
            onChange={(e) => setForm({ ...form, localEvento: e.target.value })}
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="ae-obs">
            Observações
          </label>
          <textarea
            id="ae-obs"
            className="campo min-h-20"
            placeholder="Combinados, horário de montagem…"
            value={form.obs}
            onChange={(e) => setForm({ ...form, obs: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}
