"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Loader2, Share2 } from "lucide-react";

/**
 * Volta pela história do navegador quando dá — reaproveita a tela do pedido
 * que já estava carregada, em vez de buscar tudo de novo (no iPhone isso
 * deixava a setinha lenta). Sem histórico (abriu o link direto), vai pelo href.
 */
export function BotaoVoltar({ href, rotulo }: { href: string; rotulo: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-white/10"
      aria-label={rotulo}
    >
      <ArrowLeft className="h-5 w-5" />
    </Link>
  );
}

/** Largura de uma folha A4 (210mm) em px CSS — a folha é montada nessa largura. */
const LARGURA_A4_PX = 794;
const MARGEM_MM = 10;
const LARGURA_UTIL_MM = 210 - 2 * MARGEM_MM;
const ALTURA_UTIL_MM = 297 - 2 * MARGEM_MM;
// 1.5x fica nítido no papel e mantém o canvas abaixo do limite de memória
// do iPhone mesmo em relatório comprido.
const ESCALA = 1.5;

/**
 * Gera o PDF da folha direto no aparelho (sem passar pela tela de impressão
 * do iOS, que é lenta). A folha é renderizada em largura A4 mesmo no
 * celular, e as quebras de página caem entre linhas da tabela.
 */
async function gerarPdf(alvo: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  let quebras: number[] = [];
  const canvas = await html2canvas(alvo, {
    scale: ESCALA,
    backgroundColor: "#ffffff",
    useCORS: true,
    windowWidth: LARGURA_A4_PX,
    onclone: (_doc, el) => {
      el.style.width = `${LARGURA_A4_PX}px`;
      el.style.maxWidth = "none";
      el.style.margin = "0";
      el.style.padding = "0";
      el.style.boxShadow = "none";
      // Onde dá pra cortar a página sem partir uma linha ao meio.
      const topo = el.getBoundingClientRect().top;
      quebras = Array.from(el.querySelectorAll("tr, header, section, footer, .evitar-quebra")).map(
        (n) => Math.round((n.getBoundingClientRect().bottom - topo) * ESCALA),
      );
    },
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pxPorMm = canvas.width / LARGURA_UTIL_MM;
  const alturaPaginaPx = Math.floor(ALTURA_UTIL_MM * pxPorMm);
  const pontos = Array.from(new Set(quebras))
    .filter((y) => y > 0 && y <= canvas.height)
    .sort((a, b) => a - b);

  let inicio = 0;
  let primeira = true;
  while (inicio < canvas.height - 1) {
    let fim = Math.min(inicio + alturaPaginaPx, canvas.height);
    if (fim < canvas.height) {
      // Último ponto de quebra que cabe na página (e que não deixe a página
      // quase vazia).
      const candidato = pontos.filter((y) => y > inicio + alturaPaginaPx * 0.5 && y <= fim).pop();
      if (candidato) fim = candidato;
    }
    const fatia = document.createElement("canvas");
    fatia.width = canvas.width;
    fatia.height = fim - inicio;
    fatia
      .getContext("2d")!
      .drawImage(canvas, 0, inicio, canvas.width, fim - inicio, 0, 0, canvas.width, fim - inicio);
    if (!primeira) pdf.addPage();
    pdf.addImage(
      fatia.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGEM_MM,
      MARGEM_MM,
      LARGURA_UTIL_MM,
      (fim - inicio) / pxPorMm,
    );
    primeira = false;
    inicio = fim;
  }
  return pdf.output("blob");
}

function nomeSeguro(nome: string) {
  return nome.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function baixar(arquivo: File) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");
  a.href = url;
  a.download = arquivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * No celular: gera o PDF e depois abre o Compartilhar (WhatsApp etc.). São
 * dois toques porque o iPhone só deixa abrir o Compartilhar logo após um
 * toque, e gerar o PDF leva alguns segundos. No computador: baixa o arquivo.
 */
export function BotaoEnviarPdf({ alvoId, nomeArquivo }: { alvoId: string; nomeArquivo: string }) {
  const [gerando, setGerando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  async function gerar() {
    const alvo = document.getElementById(alvoId);
    if (!alvo || gerando) return;
    setGerando(true);
    try {
      const blob = await gerarPdf(alvo);
      const f = new File([blob], `${nomeSeguro(nomeArquivo)}.pdf`, { type: "application/pdf" });
      const celular = window.matchMedia("(pointer: coarse)").matches;
      if (celular && typeof navigator.canShare === "function" && navigator.canShare({ files: [f] })) {
        setArquivo(f);
      } else {
        baixar(f);
      }
    } catch (erro) {
      console.error("Erro ao gerar PDF", erro);
      window.alert("Não deu pra gerar o PDF. Tente pelo botão Imprimir.");
    } finally {
      setGerando(false);
    }
  }

  async function compartilhar() {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo], title: arquivo.name });
    } catch (erro) {
      // Cancelar o Compartilhar não é erro.
      if ((erro as Error).name !== "AbortError") {
        console.error("Erro ao compartilhar", erro);
        baixar(arquivo);
      }
    }
  }

  if (arquivo) {
    return (
      <button className="btn-primario" onClick={compartilhar}>
        <Share2 className="h-4 w-4" />
        Compartilhar
      </button>
    );
  }

  return (
    <button className="btn-primario" onClick={gerar} disabled={gerando}>
      {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {gerando ? "Gerando…" : "Enviar PDF"}
    </button>
  );
}
