import type { Cliente, Produto } from "../types";

/**
 * Catálogo extraído do Kyte (Seu Birita).
 * Atualizado com 35 produtos extraídos.
 */
type SeedProduto = Omit<Produto, "id" | "criadoEm" | "atualizadoEm">;

const agora = () => new Date().toISOString();

const base = {
  precoCusto: 0,
  estoqueUn: 0,
  estoqueMinimo: 0,
  ativo: true,
  visivelCatalogo: true,
  unPorCaixa: 1, // default para simplificar
};

export const PRODUTOS_INICIAIS: SeedProduto[] = [
  // CERVEJA
  { ...base, nome: "Brahma lata 350ml", categoria: "Cerveja", precoUn: 3.5, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FBF011A98-1D0E-4C43-9D13-96DE868F152A.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Budweiser long neck 330ml", categoria: "Cerveja", precoUn: 5.5, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F8ADDB326-5623-44C2-9EF7-9C68CA2D7D47.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Corona Long neck 330ml", categoria: "Cerveja", precoUn: 6.9, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FE24B646A-5909-4787-93E0-13347D1AE89B.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Heineken Latao 473ml", categoria: "Cerveja", precoUn: 6.25, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F6DB4E07C-7CDE-4E00-88B6-FBB4D4997B2E.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Heineken long neck 330ml", categoria: "Cerveja", precoUn: 6.25, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FEA17CCED-5B05-426C-817E-DB123B787090.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Stella Pure Gold Long Neck 330ml", categoria: "Cerveja", precoUn: 6.9, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F583AF6B3-5EF6-4320-A082-8E8D04BBE58E.jpg?alt=media", unPorCaixa: 6 },

  // DIVERSOS
  { ...base, nome: "Agua com gás 500ml", categoria: "Diversos", precoUn: 1.9, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F74147D5C-A9FC-4B6B-8465-C755F7601F5D.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Agua mineral sem gás 500ml", categoria: "Diversos", precoUn: 1, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F816828D6-9B54-4CAC-BE45-8CB2441BABDB.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Agua tonica 350ml", categoria: "Diversos", precoUn: 4, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F3257381D-0EAC-4CE8-9913-659A753B2ED2.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Coca cola 310ml", categoria: "Diversos", precoUn: 4, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FA921E9DF-0BFF-4C15-AD53-C8EB758A7B0F.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Guarana Antarctica 350ml", categoria: "Diversos", precoUn: 4, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FA1E51662-473A-43B1-A267-4993C21111B1.jpg?alt=media", unPorCaixa: 12 },
  { ...base, nome: "Ice Kovak 275ml", categoria: "Diversos", precoUn: 4.5, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FA92DC93D-EBEB-488D-887D-A790C74029CB.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Skol beats senses lata 269ml", categoria: "Diversos", precoUn: 5.25, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FA179088B-F8C3-461A-8237-56BAB029EACE.jpg?alt=media", unPorCaixa: 8 },
  { ...base, nome: "St Pierre lata 270ml", categoria: "Diversos", precoUn: 5.25, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F79BCF1C3-7C1D-4633-986C-4ACA01429200.jpg?alt=media", unPorCaixa: 8 },
  { ...base, nome: "Suco del valle uva lata 290ml", categoria: "Diversos", precoUn: 4.5, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F2ACE0CC5-20CE-446C-A6D7-AC26DFE8D513.jpg?alt=media", unPorCaixa: 12 },

  // ENERGETICO
  { ...base, nome: "Red bull Melancia 250ml", categoria: "Energético", precoUn: 8, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F9F371E6F-74C6-4119-BC74-AE0847B6D466.jpg?alt=media", unPorCaixa: 24 },
  { ...base, nome: "Red bull Tradicional 250ml", categoria: "Energético", precoUn: 8, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F6056C957-DA67-4F57-B449-6E4423AB4BE2.jpg?alt=media", unPorCaixa: 24 },
  { ...base, nome: "Red bull Tropical 250ml", categoria: "Energético", precoUn: 8, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F46047537-887C-4CE5-AF25-43D14F9C4497.jpg?alt=media", unPorCaixa: 24 },

  // GIN
  { ...base, nome: "Gin Beefeater 750ml", categoria: "Gin", precoUn: 90, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FEDC4CFE9-D13C-4E72-A0CE-46C7A238E813.jpg?alt=media" },
  { ...base, nome: "Gin Gordons 750ml", categoria: "Gin", precoUn: 70, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F1D373F5E-84F9-4676-9E7F-5BB6D52E9D6A.jpg?alt=media" },
  { ...base, nome: "Gin Rocks 1l", categoria: "Gin", precoUn: 35 },
  { ...base, nome: "Gin Tanqueray 750ml", categoria: "Gin", precoUn: 110, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F633999B3-A927-48A4-8F1A-123A6D7418CB.jpg?alt=media" },

  // VODKA
  { ...base, nome: "Vodka Absolut 1l", categoria: "Vodka", precoUn: 90, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F2D6F8432-17BD-457C-B3EE-9B46F37DFFF3.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Vodka Ciroc 750ml", categoria: "Vodka", precoUn: 140, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F64F5D9AA-1764-4B78-8964-C0C180EF0596.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Vodka Ciroc red", categoria: "Vodka", precoUn: 160, unPorCaixa: 6 },
  { ...base, nome: "Vodka Grey Goose 750ml", categoria: "Vodka", precoUn: 140, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F5B35ECCB-F4AF-48B4-A61A-C2210CA1E7DC.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Vodka Kovak 1l", categoria: "Vodka", precoUn: 24, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F37C1791F-7B4A-43A8-A1DD-F4677FB4D4A3.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Vodka Krakovia", categoria: "Vodka", precoUn: 12, unPorCaixa: 6 },
  { ...base, nome: "Vodka Leonoff", categoria: "Vodka", precoUn: 17, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FE87703DF-D983-484B-8109-73FB569C0B6E.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Vodka Smirnoff 998ml", categoria: "Vodka", precoUn: 38, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2F5D3914FF-42A6-4B1E-A06B-E7E4EEA304BF.jpg?alt=media", unPorCaixa: 6 },

  // WHISKY
  { ...base, nome: "Black Label 1l", categoria: "Whisky", precoUn: 180, unPorCaixa: 6 },
  { ...base, nome: "Buchanans 1l", categoria: "Whisky", precoUn: 180, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FD207BEE5-7E3C-4FEE-8FD1-013955741421.jpg?alt=media", unPorCaixa: 6 },
  { ...base, nome: "Red Label 1l", categoria: "Whisky", precoUn: 100, imagemUrl: "https://firebasestorage.googleapis.com/v0/b/kyte-7c484.appspot.com/o/M0S6PQTuaITCMdsqWUMGW3LJLnE3%2FB07623C0-5620-4EF5-B9F4-69A614A2043F.jpg?alt=media", unPorCaixa: 6 },

  // Sem Categoria / Outros
  { ...base, nome: "Campari", categoria: "Diversos", precoUn: 54, unPorCaixa: 6 },
  { ...base, nome: "Gin Bombay", categoria: "Gin", precoUn: 90, unPorCaixa: 6 },
];

export const CATEGORIAS_PADRAO = [
  "Cerveja",
  "Energético",
  "Diversos",
  "Gin",
  "Vodka",
  "Whisky",
];

type SeedCliente = Omit<Cliente, "id" | "criadoEm">;

export const CLIENTES_INICIAIS: SeedCliente[] = [
  { nome: "Estação Lounge", tipo: "PJ", cidade: "Macaé", ativo: true },
  { nome: "Martins Lage", tipo: "PJ", cidade: "Macaé", ativo: true },
];

export function semearProdutos(): Produto[] {
  return PRODUTOS_INICIAIS.map((p, i) => ({
    ...p,
    id: `seed-produto-${i + 1}`,
    criadoEm: agora(),
    atualizadoEm: agora(),
  }));
}

export function semearClientes(): Cliente[] {
  return CLIENTES_INICIAIS.map((c, i) => ({
    ...c,
    id: `seed-cliente-${i + 1}`,
    criadoEm: agora(),
  }));
}
