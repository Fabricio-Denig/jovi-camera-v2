import { useCallback, useEffect, useState } from "react";

const CHAVE = "jovi.filtros.favoritos";

/**
 * Os filtros favoritos, guardados no próprio aparelho.
 *
 * `localStorage` e não IndexedDB: é uma lista de meia dúzia de textos curtos,
 * e a preferência de aparência não precisa sobreviver a nada além do próprio
 * navegador. Sem conta, sem servidor — como todo o resto deste app.
 *
 * A leitura é defensiva porque `localStorage` lança em janela privada e em
 * navegador com dados de site bloqueados. Favorito é conveniência: se não der
 * para guardar, a câmera continua inteira.
 */
export function useFilterFavorites() {
  const [favoritos, setFavoritos] = useState<string[]>([]);

  useEffect(() => {
    try {
      const cru = localStorage.getItem(CHAVE);
      if (cru) {
        const lido: unknown = JSON.parse(cru);
        if (Array.isArray(lido)) setFavoritos(lido.filter((x) => typeof x === "string"));
      }
    } catch {
      // Sem preferência guardada a lista nasce vazia, que é o estado certo.
    }
  }, []);

  const alternar = useCallback((id: string) => {
    setFavoritos((atual) => {
      const proximo = atual.includes(id)
        ? atual.filter((x) => x !== id)
        : [...atual, id];
      try {
        localStorage.setItem(CHAVE, JSON.stringify(proximo));
      } catch {
        // A sessão continua com a lista em memória.
      }
      return proximo;
    });
  }, []);

  return { favoritos, alternar };
}
