import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { getDb } from "../firebase";
import type { ColecaoAdapter, ComId, NomeColecao } from "./adapter";

/**
 * O Firestore rejeita `undefined` em qualquer nível do documento.
 * Campos opcionais em branco (telefone, obs...) chegam assim, então
 * a limpeza acontece aqui e não espalhada pelos formulários.
 */
function semUndefined<T>(valor: T): T {
  if (Array.isArray(valor)) {
    return valor.map((v) => semUndefined(v)) as unknown as T;
  }
  if (valor && typeof valor === "object") {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === undefined) continue;
      saida[k] = semUndefined(v);
    }
    return saida as T;
  }
  return valor;
}

export function criarAdaptadorFirestore<T extends ComId>(
  colecao: NomeColecao,
): ColecaoAdapter<T> {
  return {
    observar(callback) {
      const ref = collection(getDb(), colecao);
      return onSnapshot(
        ref,
        (snap) => {
          callback(
            snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T),
          );
        },
        (erro) => {
          console.error(`[${colecao}] falha ao escutar o Firestore:`, erro);
          callback([]);
        },
      );
    },

    async salvar(item) {
      const { id, ...resto } = item;
      await setDoc(doc(getDb(), colecao, id), semUndefined(resto));
    },

    async remover(id) {
      await deleteDoc(doc(getDb(), colecao, id));
    },
  };
}
