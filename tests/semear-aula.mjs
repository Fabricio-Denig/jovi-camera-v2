/**
 * Semeia uma aula pronta no banco do app.
 *
 * Rodar uma sessão de SliD inteira para testar a tela da aula custaria minutos
 * por teste e faria a tela do resumo reprovar quando o defeito fosse do
 * detector. A aula entra pelo mesmo caminho que a sessão usa — o object store
 * `captures`, com o objeto `session` que a sessão grava — então o que o teste
 * exercita é o código de leitura de verdade, não um atalho.
 */
export const AULA = {
  id: "aula-de-teste",
  subject: "Cálculo — funções quadráticas",
  discipline: "Cálculo",
  status: "revisar",
  durationMs: 640000,
  momentos: [
    {
      t: 3000,
      label: "Função do 2° Grau",
      cat: "Fórmula",
      cor: "#2b3a55",
      lines: ["Função do 2° Grau", "f(x) = ax² + bx + c", "Δ = b² - 4ac"],
    },
    {
      t: 128000,
      label: "Raízes da equação",
      cat: "Fórmula",
      cor: "#3a2b55",
      lines: ["Raízes da equação", "x = (-b ± √Δ) / 2a"],
    },
    {
      t: 332000,
      label: "Exercícios propostos",
      cat: "Lista",
      cor: "#553a2b",
      lines: [
        "Exercícios propostos",
        "Resolver as equações do quadro",
        "Entregar na próxima aula",
      ],
    },
    // O quarto não leu nada: é o caso que a aba Texto tem de omitir em vez de
    // mostrar vazio, e o que prova que a contagem da aba conta leitura.
    { t: 540000, label: "Conteúdo acrescentado", cat: null, cor: "#2b553a", lines: [] },
  ],
};

/** Escreve a aula no IndexedDB da página e devolve quantos momentos entraram. */
export async function semearAula(page, aula = AULA) {
  return page.evaluate(async (a) => {
    const desenhar = (texto, cor) =>
      new Promise((r) => {
        const c = document.createElement("canvas");
        c.width = 480;
        c.height = 360;
        const x = c.getContext("2d");
        x.fillStyle = cor;
        x.fillRect(0, 0, 480, 360);
        x.fillStyle = "#fff";
        x.fillRect(30, 30, 420, 300);
        x.fillStyle = "#1a1a2e";
        x.font = "bold 28px sans-serif";
        x.fillText(texto, 50, 90);
        x.font = "18px sans-serif";
        for (let i = 0; i < 5; i++) x.fillText("linha de conteudo " + (i + 1), 50, 140 + i * 32);
        c.toBlob(r, "image/jpeg", 0.9);
      });

    /*
     * Sem número de versão, de propósito: o app subiu o banco para v2 quando
     * o Listen entrou, e abrir pedindo v1 devolve `VersionError` — o teste
     * inteiro morria com "execution context destroyed" por causa disso.
     * Sem versão, anexa ao que existe, qualquer que seja.
     */
    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });

    // Os blobs antes da transação: um `await` no meio dela a fecha sozinha.
    const blobs = [];
    for (const m of a.momentos) blobs.push(await desenhar(m.label, m.cor));

    const savedAt = Date.now();
    const tx = db.transaction("captures", "readwrite");
    const store = tx.objectStore("captures");
    for (let i = 0; i < a.momentos.length; i++) {
      const m = a.momentos[i];
      store.put({
        id: `${a.id}-${i}`,
        kind: "photo",
        blob: blobs[i],
        mimeType: "image/jpeg",
        createdAt: savedAt,
        width: 480,
        height: 360,
        session: {
          id: a.id,
          subject: a.subject,
          discipline: a.discipline,
          status: a.status,
          atMs: m.t,
          label: m.label,
          detail: m.lines[1] ?? null,
          category: m.cat,
          lines: m.lines,
          spanMs: 0,
          durationMs: a.durationMs,
          skippedDuplicates: 7,
          savedAt,
          topics: a.momentos.filter((x) => x.lines.length > 0).map((x) => x.label),
          kinds: [
            ["formula", 2],
            ["lista", 1],
          ],
          /*
           * A visão geral que a sessão teria escrito. `overview: ""` na
           * fixture reproduz a aula em que a leitura não deu nada — o estado
           * em que a tela diz, com razão, que não deu para montar um resumo.
           * Sem isto o seeder sempre escrevia um texto, e o estado vazio de
           * verdade ficava impossível de testar.
           */
          overview:
            a.overview !== undefined
              ? a.overview
              : `Esta aula de ${a.discipline} teve ${a.momentos.length} momentos em 10 min, com 2 fórmulas.`,
          favorite: false,
        },
      });
    }
    await new Promise((r) => {
      tx.oncomplete = r;
    });
    db.close();
    return a.momentos.length;
  }, aula);
}

/** Navega até a aula semeada, do zero. */
export async function abrirAula(page) {
  await page.getByRole("button", { name: "Galeria", exact: true }).click();
  await page.waitForTimeout(900);
  await page
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Cálculo/i }).first().click();
  await page.waitForTimeout(900);
}
