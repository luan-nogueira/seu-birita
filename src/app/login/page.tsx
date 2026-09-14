"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";
import { mensagemDeErro, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { entrar, recuperarSenha } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      await entrar(email, senha);
      router.replace("/");
    } catch (erro) {
      setErro(mensagemDeErro(erro));
      setEnviando(false);
    }
  }

  async function aoRecuperar() {
    if (!email.trim()) {
      setErro("Digite seu e-mail primeiro pra receber o link.");
      return;
    }
    setErro("");
    try {
      await recuperarSenha(email);
      setAviso("Enviamos um link de recuperação pro seu e-mail.");
    } catch (erro) {
      setErro(mensagemDeErro(erro));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-barra px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="h-32 w-auto" variante="clara" />
        </div>

        <form
          onSubmit={aoEnviar}
          className="rounded-2xl bg-superficie p-6 shadow-2xl"
        >
          <h1 className="text-xl font-black">Entrar no sistema</h1>
          <p className="mt-1 mb-5 text-sm text-texto-suave">
            Acesso restrito à equipe.
          </p>

          <div className="space-y-4">
            <div>
              <label className="rotulo" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="campo"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="rotulo" htmlFor="senha">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  className="campo pr-11"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-texto-suave transition hover:bg-superficie-2"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {erro && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-400">
              {erro}
            </p>
          )}

          {aviso && (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {aviso}
            </p>
          )}

          <button
            type="submit"
            className="btn-primario mt-5 w-full"
            disabled={enviando}
          >
            <LogIn className="h-4 w-4" />
            {enviando ? "Entrando…" : "Entrar"}
          </button>

          <button
            type="button"
            onClick={aoRecuperar}
            className="mt-3 w-full text-center text-xs font-semibold text-texto-suave underline-offset-4 hover:text-acento hover:underline"
          >
            Esqueci minha senha
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-creme/50">
          Seu Birita Distribuidora
        </p>
      </div>
    </div>
  );
}
