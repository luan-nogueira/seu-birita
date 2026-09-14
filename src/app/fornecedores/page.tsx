"use client";

import { Truck } from "lucide-react";
import { Cabecalho, Vazio } from "@/components/ui";

export default function FornecedoresPage() {
  return (
    <>
      <Cabecalho
        titulo="Fornecedores"
        subtitulo="Quem abastece o galpão"
      />
      <Vazio
        Icone={Truck}
        titulo="Próxima etapa"
        descricao="Cadastro de fornecedores com histórico de compras e custo por produto — entra junto com o módulo de estoque."
      />
    </>
  );
}
