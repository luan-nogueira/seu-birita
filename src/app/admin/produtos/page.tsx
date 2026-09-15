"use client";

import { useMemo, useState } from "react";
import {
  Boxes,
  Download,
  Eye,
  EyeOff,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { Cabecalho, Modal, Vazio } from "@/components/ui";
import { useDados, novoId } from "@/lib/store";
import { firebaseConfigurado } from "@/lib/firebase";
import { brl, normalizar, paraCampo, paraNumero } from "@/lib/format";
import { CATEGORIAS_PADRAO, semearProdutos } from "@/lib/db/seed";
import type { Produto } from "@/lib/types";

type Formulario = {
  nome: string;
  categoria: string;
  unPorCaixa: string;
  precoUn: string;
  precoTabela2: string;
  precoTabela3: string;
  precoCusto: string;
  estoqueMinimo: string;
  imagemUrl: string;
  imagemCenario: boolean;
  ativo: boolean;
  visivelCatalogo: boolean;
};

const FORM_VAZIO: Formulario = {
  nome: "",
  categoria: CATEGORIAS_PADRAO[0],
  unPorCaixa: "1",
  precoUn: "",
  precoTabela2: "",
  precoTabela3: "",
  precoCusto: "",
  estoqueMinimo: "0",
  imagemUrl: "",
  imagemCenario: false,
  ativo: true,
  visivelCatalogo: true,
};

export default function ProdutosPage() {
  const { produtos, salvarProduto, removerProduto, carregando } = useDados();

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState<Formulario>(FORM_VAZIO);
  const [modalAberto, setModalAberto] = useState(false);
  const [importAberto, setImportAberto] = useState(false);
  const [fazendoUpload, setFazendoUpload] = useState(false);
  const [excluindoProduto, setExcluindoProduto] = useState<Produto | null>(null);
  const [recuperando, setRecuperando] = useState(false);

  async function recuperarIniciais() {
    if (!confirm("Isso vai adicionar as 35 bebidas da versão de demonstração. Continuar?")) return;
    setRecuperando(true);
    try {
      const iniciais = semearProdutos();
      for (const p of iniciais) {
        await salvarProduto(p);
      }
      alert("Produtos recuperados com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao recuperar produtos.");
    } finally {
      setRecuperando(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFazendoUpload(true);
    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim();
      if (cloudName && uploadPreset) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: formData },
        );

        const data = await response.json();

        if (data.secure_url) {
          setForm({ ...form, imagemUrl: data.secure_url });
        } else {
          throw new Error(data.error?.message || "Erro no Cloudinary");
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setForm({ ...form, imagemUrl: reader.result as string });
          setFazendoUpload(false);
        };
        reader.readAsDataURL(file);
        return; 
      }
    } catch (error) {
      console.error("Erro no upload", error);
      const motivo = error instanceof Error ? error.message : "";
      alert(`Erro ao fazer upload da imagem.${motivo ? ` (${motivo})` : ""}`);
    }
    setFazendoUpload(false);
  }

  const categorias = useMemo(() => {
    const doBanco = produtos.map((p) => p.categoria).filter(Boolean);
    return Array.from(new Set([...CATEGORIAS_PADRAO, ...doBanco]));
  }, [produtos]);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    if (!termo) return produtos;
    return produtos.filter(
      (p) =>
        normalizar(p.nome).includes(termo) ||
        normalizar(p.categoria).includes(termo),
    );
  }, [produtos, busca]);

  const agrupados = useMemo(() => {
    const mapa = new Map<string, Produto[]>();
    for (const p of filtrados) {
      const chave = p.categoria || "Sem categoria";
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(p);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [filtrados]);

  function abrirNovo() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  }

  function abrirEdicao(p: Produto) {
    setEditando(p);
    setForm({
      nome: p.nome,
      categoria: p.categoria,
      unPorCaixa: String(p.unPorCaixa),
      precoUn: paraCampo(p.precoUn),
      precoTabela2: p.precoTabela2 ? paraCampo(p.precoTabela2) : "",
      precoTabela3: p.precoTabela3 ? paraCampo(p.precoTabela3) : "",
      precoCusto: paraCampo(p.precoCusto),
      estoqueMinimo: String(p.estoqueMinimo ?? 0),
      imagemUrl: p.imagemUrl ?? "",
      imagemCenario: p.imagemCenario ?? false,
      ativo: p.ativo,
      visivelCatalogo: p.visivelCatalogo,
    });
    setModalAberto(true);
  }

  async function salvar() {
    const nome = form.nome.trim();
    if (!nome) return;

    const agora = new Date().toISOString();
    await salvarProduto({
      id: editando?.id ?? novoId(),
      nome,
      categoria: form.categoria || "Sem categoria",
      // Uma caixa nunca tem zero unidade; o mínimo é o produto avulso.
      unPorCaixa: Math.max(1, Math.round(paraNumero(form.unPorCaixa))),
      precoUn: paraNumero(form.precoUn),
      precoTabela2: form.precoTabela2 ? paraNumero(form.precoTabela2) : undefined,
      precoTabela3: form.precoTabela3 ? paraNumero(form.precoTabela3) : undefined,
      precoCusto: paraNumero(form.precoCusto),
      estoqueUn: editando?.estoqueUn ?? 0,
      estoqueMinimo: Math.max(0, Math.round(paraNumero(form.estoqueMinimo))),
      imagemUrl: form.imagemUrl.trim() || undefined,
      imagemCenario: form.imagemCenario,
      ativo: form.ativo,
      visivelCatalogo: form.visivelCatalogo,
      criadoEm: editando?.criadoEm ?? agora,
      atualizadoEm: agora,
    });
    setModalAberto(false);
  }

  function solicitarExclusao(p: Produto) {
    setExcluindoProduto(p);
  }

  async function confirmarExclusao() {
    if (!excluindoProduto) return;
    await removerProduto(excluindoProduto.id);
    setExcluindoProduto(null);
  }

  return (
    <>
      <Cabecalho
        titulo="Produtos"
        subtitulo={
          carregando
            ? "Carregando…"
            : `${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"} no catálogo`
        }
        acao={
          <div className="flex gap-2">
            <button
              className="btn-secundario"
              onClick={recuperarIniciais}
              disabled={recuperando}
              title="Recuperar 35 produtos iniciais (demonstração)"
            >
              {recuperando ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-acento border-t-transparent" />
              ) : (
                <Boxes className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Recuperar</span>
            </button>
            <button
              className="btn-secundario"
              onClick={() => setImportAberto(true)}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Importar</span>
            </button>
            <button className="btn-primario" onClick={abrirNovo}>
              <Plus className="h-4 w-4" />
              Novo
            </button>
          </div>
        }
      />

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
      </div>

      {!carregando && filtrados.length === 0 && (
        <Vazio
          Icone={Package}
          titulo={busca ? "Nada encontrado" : "Nenhum produto ainda"}
          descricao={
            busca
              ? "Tente outro termo de busca."
              : "Cadastre um produto ou importe a lista de uma vez."
          }
          acao={
            !busca ? (
              <button className="btn-primario" onClick={abrirNovo}>
                <Plus className="h-4 w-4" />
                Cadastrar produto
              </button>
            ) : undefined
          }
        />
      )}

      <div className="space-y-6 px-4 md:px-6">
        {agrupados.map(([categoria, itens]) => (
          <section key={categoria}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-texto-suave uppercase">
              <Boxes className="h-3.5 w-3.5" />
              {categoria}
              <span className="font-normal normal-case">({itens.length})</span>
            </h2>

            <ul className="card divide-y divide-borda overflow-hidden">
              {itens.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-superficie-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`truncate font-semibold ${!p.ativo ? "text-texto-suave line-through" : ""}`}
                      >
                        {p.nome}
                      </p>
                      {p.visivelCatalogo ? (
                        <Eye
                          className="h-3.5 w-3.5 shrink-0 text-texto-suave"
                          aria-label="Aparece na tabela pública"
                        />
                      ) : (
                        <EyeOff
                          className="h-3.5 w-3.5 shrink-0 text-texto-suave"
                          aria-label="Oculto na tabela pública"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-texto-suave">
                      {p.unPorCaixa > 1
                        ? `${p.unPorCaixa} un/cx · caixa ${brl(p.precoUn * p.unPorCaixa)}`
                        : "Vendido por unidade"}
                    </p>
                  </div>

                  <p className="shrink-0 text-right font-bold tabular-nums">
                    {brl(p.precoUn)}
                    <span className="block text-[11px] font-normal text-texto-suave">
                      por un
                    </span>
                  </p>

                  <div className="flex shrink-0 gap-1">
                    <button
                      className="grid h-9 w-9 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-2 hover:text-texto"
                      onClick={() => abrirEdicao(p)}
                      aria-label={`Editar ${p.nome}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="grid h-9 w-9 place-items-center rounded-lg text-texto-suave transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      onClick={() => solicitarExclusao(p)}
                      aria-label={`Excluir ${p.nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Modal
        aberto={modalAberto}
        aoFechar={() => setModalAberto(false)}
        titulo={editando ? "Editar produto" : "Novo produto"}
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setModalAberto(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-primario"
              onClick={salvar}
              disabled={!form.nome.trim()}
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="nome">
              Nome
            </label>
            <input
              id="nome"
              className="campo"
              autoFocus
              placeholder="Ex: Corona LN"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>

          <div>
            <label className="rotulo" htmlFor="categoria">
              Categoria
            </label>
            <select
              id="categoria"
              className="campo"
              value={categorias.includes(form.categoria) ? form.categoria : "__nova__"}
              onChange={(e) =>
                setForm({
                  ...form,
                  categoria: e.target.value === "__nova__" ? "" : e.target.value,
                })
              }
            >
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="__nova__">+ Nova categoria…</option>
            </select>
            {!categorias.includes(form.categoria) && (
              <input
                className="campo mt-2"
                autoFocus
                placeholder="Nome da nova categoria"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
            )}
          </div>

          <div>
            <label className="rotulo" htmlFor="imagemUrl">
              Imagem do Produto
            </label>
            <div className="mt-1 flex gap-4 items-start">
              {/* Prévia idêntica ao site público */}
              <div
                className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-borda"
                style={{ background: "radial-gradient(circle at center, #ffffff 0%, #e2e8f0 100%)" }}
              >
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
                <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.04)] pointer-events-none" />
                <div className="absolute inset-0 border-b border-black/5 pointer-events-none" />
                {form.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.imagemUrl}
                    alt="Prévia"
                    className={`relative z-10 h-full w-full ${form.imagemCenario ? "object-cover" : "object-contain p-2 mix-blend-multiply"}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = ""; // fallback visual
                    }}
                  />
                ) : (
                  <span className="text-2xl select-none relative z-10">🍺</span>
                )}
              </div>
              
              {/* Input */}
              <div className="flex-1 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="imagemUrl"
                    className="campo flex-1"
                    placeholder="Cole um link https://..."
                    value={form.imagemUrl}
                    onChange={(e) => setForm({ ...form, imagemUrl: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-texto-suave">OU</span>
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-borda bg-superficie-2 px-4 text-sm font-semibold transition hover:bg-superficie-3 hover:text-acento" title="Upload do Computador">
                      {fazendoUpload ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-acento border-t-transparent" /> : <Upload className="h-4 w-4" />}
                      <span className="hidden sm:inline">Arquivo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={fazendoUpload} />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-texto-suave">
                  Faça o upload do seu computador ou cole um link. A prévia aplica a iluminação de estúdio que esconde o fundo branco.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="unpcx">
                Unidades por caixa
              </label>
              <input
                id="unpcx"
                className="campo"
                inputMode="numeric"
                value={form.unPorCaixa}
                onChange={(e) =>
                  setForm({ ...form, unPorCaixa: e.target.value })
                }
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="preco">
                Preço · Tabela 1
              </label>
              <input
                id="preco"
                className="campo"
                inputMode="decimal"
                placeholder="6,90"
                value={form.precoUn}
                onChange={(e) => setForm({ ...form, precoUn: e.target.value })}
              />
            </div>
          </div>

          {paraNumero(form.unPorCaixa) > 1 && paraNumero(form.precoUn) > 0 && (
            <p className="rounded-xl bg-superficie-2 px-3 py-2 text-sm text-texto-suave">
              Caixa fechada sai por{" "}
              <strong className="text-texto">
                {brl(paraNumero(form.precoUn) * paraNumero(form.unPorCaixa))}
              </strong>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="preco2">
                Preço · Tabela 2 (opcional)
              </label>
              <input
                id="preco2"
                className="campo"
                inputMode="decimal"
                placeholder="sem tabela 2"
                value={form.precoTabela2}
                onChange={(e) => setForm({ ...form, precoTabela2: e.target.value })}
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="preco3">
                Preço · Tabela 3 (opcional)
              </label>
              <input
                id="preco3"
                className="campo"
                inputMode="decimal"
                placeholder="sem tabela 3"
                value={form.precoTabela3}
                onChange={(e) => setForm({ ...form, precoTabela3: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-texto-suave">
            Preencha só se este produto tiver mais de um preço pra escolher na
            hora de montar o pedido (ex: cliente VIP, evento fechado...).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="rotulo" htmlFor="custo">
                Custo por unidade
              </label>
              <input
                id="custo"
                className="campo"
                inputMode="decimal"
                placeholder="opcional"
                value={form.precoCusto}
                onChange={(e) =>
                  setForm({ ...form, precoCusto: e.target.value })
                }
              />
            </div>
            <div>
              <label className="rotulo" htmlFor="minimo">
                Estoque mínimo
              </label>
              <input
                id="minimo"
                className="campo"
                inputMode="numeric"
                value={form.estoqueMinimo}
                onChange={(e) =>
                  setForm({ ...form, estoqueMinimo: e.target.value })
                }
              />
            </div>
          </div>

          {paraNumero(form.precoCusto) > 0 && paraNumero(form.precoUn) > 0 && (
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              Margem de{" "}
              <strong>
                {brl(paraNumero(form.precoUn) - paraNumero(form.precoCusto))}
              </strong>{" "}
              por unidade (
              {Math.round(
                ((paraNumero(form.precoUn) - paraNumero(form.precoCusto)) /
                  paraNumero(form.precoUn)) *
                  100,
              )}
              %)
            </p>
          )}

          <div className="space-y-2 border-t border-borda pt-3">
            <Interruptor
              rotulo="Produto ativo"
              descricao="Produtos inativos não aparecem ao montar um pedido."
              valor={form.ativo}
              aoMudar={(v) => setForm({ ...form, ativo: v })}
            />
            <Interruptor
              rotulo="Mostrar na tabela pública"
              descricao="A tabela de preços que o cliente recebe por link."
              valor={form.visivelCatalogo}
              aoMudar={(v) => setForm({ ...form, visivelCatalogo: v })}
            />
            <Interruptor
              rotulo="Imagem de cenário"
              descricao="Marca a imagem para cobrir toda a área, ideal para fotos reais sem fundo branco."
              valor={form.imagemCenario}
              aoMudar={(v) => setForm({ ...form, imagemCenario: v })}
            />
          </div>
        </div>
      </Modal>

      <ModalImportar
        aberto={importAberto}
        aoFechar={() => setImportAberto(false)}
      />

      <Modal
        aberto={!!excluindoProduto}
        aoFechar={() => setExcluindoProduto(null)}
        titulo="Excluir Produto"
        rodape={
          <>
            <button
              className="btn-secundario"
              onClick={() => setExcluindoProduto(null)}
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
          {excluindoProduto && `Tem certeza que deseja excluir "${excluindoProduto.nome}"? Pedidos antigos não serão afetados.`}
        </p>
      </Modal>
    </>
  );
}

function Interruptor({
  rotulo,
  descricao,
  valor,
  aoMudar,
}: {
  rotulo: string;
  descricao?: string;
  valor: boolean;
  aoMudar: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 accent-[var(--acento)]"
        checked={valor}
        onChange={(e) => aoMudar(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{rotulo}</span>
        {descricao && (
          <span className="block text-xs text-texto-suave">{descricao}</span>
        )}
      </span>
    </label>
  );
}

/**
 * Importação em massa: o Luifer cola a lista de preços que ele já tem
 * (do site, do WhatsApp, da planilha) em vez de digitar produto por produto.
 */
function ModalImportar({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const { salvarProduto, produtos } = useDados();
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_PADRAO[0]);
  const [salvando, setSalvando] = useState(false);

  const linhas = useMemo(() => interpretarLista(texto), [texto]);
  const nomesExistentes = useMemo(
    () => new Set(produtos.map((p) => normalizar(p.nome))),
    [produtos],
  );
  const categorias = useMemo(() => {
    const doBanco = produtos.map((p) => p.categoria).filter(Boolean);
    return Array.from(new Set([...CATEGORIAS_PADRAO, ...doBanco]));
  }, [produtos]);

  async function importar() {
    setSalvando(true);
    const agora = new Date().toISOString();
    for (const linha of linhas) {
      const jaExiste = produtos.find(
        (p) => normalizar(p.nome) === normalizar(linha.nome),
      );
      await salvarProduto({
        id: jaExiste?.id ?? novoId(),
        nome: linha.nome,
        categoria: jaExiste?.categoria ?? categoria,
        unPorCaixa: linha.unPorCaixa ?? jaExiste?.unPorCaixa ?? 1,
        precoUn: linha.preco,
        precoCusto: jaExiste?.precoCusto ?? 0,
        estoqueUn: jaExiste?.estoqueUn ?? 0,
        estoqueMinimo: jaExiste?.estoqueMinimo ?? 0,
        ativo: true,
        visivelCatalogo: jaExiste?.visivelCatalogo ?? true,
        criadoEm: jaExiste?.criadoEm ?? agora,
        atualizadoEm: agora,
      });
    }
    setSalvando(false);
    setTexto("");
    aoFechar();
  }

  const novos = linhas.filter((l) => !nomesExistentes.has(normalizar(l.nome)));
  const atualizados = linhas.length - novos.length;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Importar lista de preços"
      largura="max-w-2xl"
      rodape={
        <>
          <button className="btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            className="btn-primario"
            onClick={importar}
            disabled={linhas.length === 0 || salvando}
          >
            {salvando
              ? "Importando…"
              : `Importar ${linhas.length} ${linhas.length === 1 ? "item" : "itens"}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="rotulo" htmlFor="colar">
            Cole a lista aqui
          </label>
          <textarea
            id="colar"
            className="campo min-h-44 font-mono text-sm"
            placeholder={
              "Um produto por linha. Exemplos que funcionam:\n\n" +
              "Corona LN 6,90\n" +
              "Coca-Cola LT - R$ 4,00\n" +
              "Red Bull; 8,00; 24\n" +
              "Vodka Absolut | 90 | 12"
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-texto-suave">
            O último número da linha vira o preço. Se houver um terceiro campo,
            ele é lido como unidades por caixa.
          </p>
        </div>

        <div>
          <label className="rotulo" htmlFor="cat-import">
            Categoria dos produtos novos
          </label>
          <select
            id="cat-import"
            className="campo"
            value={categorias.includes(categoria) ? categoria : "__nova__"}
            onChange={(e) =>
              setCategoria(e.target.value === "__nova__" ? "" : e.target.value)
            }
          >
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__nova__">+ Nova categoria…</option>
          </select>
          {!categorias.includes(categoria) && (
            <input
              className="campo mt-2"
              autoFocus
              placeholder="Nome da nova categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            />
          )}
        </div>

        {linhas.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">
              Prévia — {novos.length} novo(s)
              {atualizados > 0 && `, ${atualizados} atualizado(s)`}
            </p>
            <ul className="card max-h-60 divide-y divide-borda overflow-y-auto">
              {linhas.map((l, i) => {
                const existe = nomesExistentes.has(normalizar(l.nome));
                return (
                  <li
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                    {l.unPorCaixa && (
                      <span className="shrink-0 text-xs text-texto-suave">
                        {l.unPorCaixa} un/cx
                      </span>
                    )}
                    <span className="shrink-0 font-semibold tabular-nums">
                      {brl(l.preco)}
                    </span>
                    <span
                      className={`chip shrink-0 ${
                        existe
                          ? "bg-ouro-100 text-ouro-900 dark:bg-ouro-900/40 dark:text-ouro-200"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {existe ? "atualiza" : "novo"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface LinhaImportada {
  nome: string;
  preco: number;
  unPorCaixa?: number;
}

/**
 * Lê listas coladas de qualquer jeito. Tenta primeiro separadores explícitos
 * (`;`, `|`, tab), e cai pro "último número da linha é o preço" — que cobre
 * o formato solto de lista de WhatsApp.
 */
export function interpretarLista(texto: string): LinhaImportada[] {
  const saida: LinhaImportada[] = [];

  for (const bruta of (texto || "").split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;

    const partes = linha.split(/\s*[;|\t]\s*/).filter(Boolean);
    if (partes.length >= 2) {
      const nome = partes[0].trim();
      const preco = paraNumero(partes[1]);
      const un = partes[2] ? Math.round(paraNumero(partes[2])) : undefined;
      if (nome && preco > 0) {
        saida.push({ nome, preco, unPorCaixa: un && un > 0 ? un : undefined });
      }
      continue;
    }

    // Formato solto: "Corona LN R$ 6,90" ou "Corona LN - 6,90"
    const numeros = [...linha.matchAll(/(\d+(?:[.,]\d+)?)/g)];
    if (numeros.length === 0) continue;

    const ultimo = numeros[numeros.length - 1];
    const preco = paraNumero(ultimo[1]);
    if (preco <= 0) continue;

    const nome = linha
      .slice(0, ultimo.index)
      .replace(/(r\$|rs)\s*$/i, "")
      .replace(/[\s\-–—:.=]+$/, "")
      .trim();

    if (nome) saida.push({ nome, preco });
  }

  return saida;
}
