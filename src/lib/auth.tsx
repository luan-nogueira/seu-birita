"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseConfigurado, getFirebaseAuth } from "./firebase";

interface Autenticacao {
  usuario: User | null;
  carregando: boolean;
  /** Falso no modo demonstração — sem Firebase não há o que proteger. */
  exigeLogin: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
  recuperarSenha: (email: string) => Promise<void>;
}

const AuthContext = createContext<Autenticacao | null>(null);

/** Traduz os códigos do Firebase pra algo que se entenda na tela. */
export function mensagemDeErro(erro: unknown): string {
  const codigo =
    typeof erro === "object" && erro && "code" in erro
      ? String((erro as { code: unknown }).code)
      : "";

  switch (codigo) {
    case "auth/invalid-email":
      return "E-mail inválido.";
    case "auth/user-disabled":
      return "Esta conta foi desativada.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente de novo.";
    case "auth/network-request-failed":
      return "Sem conexão. Verifique a internet.";
    case "auth/missing-password":
      return "Digite a senha.";
    default:
      return "Não foi possível entrar. Tente novamente.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(firebaseConfigurado);

  useEffect(() => {
    if (!firebaseConfigurado) return;
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUsuario(u);
      setCarregando(false);
    });
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), senha);
  }, []);

  const sair = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const valor = useMemo<Autenticacao>(
    () => ({
      usuario,
      carregando,
      exigeLogin: firebaseConfigurado,
      entrar,
      sair,
      recuperarSenha,
    }),
    [usuario, carregando, entrar, sair, recuperarSenha],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): Autenticacao {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
