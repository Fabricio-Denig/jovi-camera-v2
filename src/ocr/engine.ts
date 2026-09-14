/**
 * O motor de leitura, num lugar só.
 *
 * Dois recursos precisam ler texto de uma imagem — o SliD, que lê os momentos
 * de uma aula quando ela termina, e o Scanner, que lê uma folha quando alguém
 * pede. Antes da camada compartilhada, a configuração do Tesseract estava
 * escrita num lugar; duplicá-la seria garantir que um dia os dois carregariam
 * versões diferentes do mesmo WASM.
 *
 * Os caminhos são todos desta origem, e isso é decisão de produto, não
 * detalhe: o CDN padrão do Tesseract foi medido inalcançável atrás de uma rede
 * restrita, e a leitura é o clímax da demonstração. Ela não pode depender do
 * wi-fi do lugar.
 */

/** Uma página lida, com o quanto o motor confia no que leu. */
export interface LeituraDeImagem {
  text: string;
  confidence: number;
}

/**
 * Cria o trabalhador do Tesseract.
 *
 * A importação é dinâmica de propósito: são cerca de quatro megabytes de
 * runtime, e nenhum deles pode entrar no caminho de abertura da câmera.
 */
export async function criarLeitor() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("por", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/",
    langPath: "/tesseract/",
    gzip: true,
  });
}

type Leitor = Awaited<ReturnType<typeof criarLeitor>>;

/**
 * O trabalhador do Scanner, vivo entre uma folha e outra.
 *
 * Antes, `lerImagem` criava e desligava um `criarLeitor()` a cada folha — e a
 * cada "Tentar de novo" depois de uma falha. No celular, isso é carregar de
 * novo ~4 MB de WASM e o dicionário do idioma toda vez, com a mesma rede e o
 * mesmo processador que acabaram de falhar em fazer isso uma vez. Um
 * trabalhador só, criado na primeira folha e reaproveitado nas seguintes —
 * inclusive nas tentativas de novo —, tira essa repetição do caminho mais
 * provável de dar errado.
 *
 * Fica módulo, não estado de componente: o Scanner é fechado e reaberto entre
 * uma folha e outra, e um trabalhador que morresse com o componente
 * devolveria o mesmo custo de carregar tudo de novo.
 */
let leitorRef: Promise<Leitor> | null = null;

async function leitorCompartilhado(): Promise<Leitor> {
  if (!leitorRef) {
    // Se a criação falhar, a próxima chamada tenta de novo — um trabalhador
    // que nunca terminou de carregar não pode ficar "reservado" para sempre.
    leitorRef = criarLeitor().catch((erro) => {
      leitorRef = null;
      throw erro;
    });
  }
  return leitorRef;
}

/**
 * Devolve o motor para o estado inicial — só quando ele reagiu mal.
 *
 * `recognize()` que trava ou lança deixa o trabalhador num estado que não dá
 * para confiar; a próxima leitura merece um motor novo, não um que já falhou
 * uma vez. Fora daí, nunca é chamada: o trabalhador que funciona continua de
 * pé entre folhas.
 */
async function descartarLeitor(leitor: Leitor | null): Promise<void> {
  leitorRef = null;
  await leitor?.terminate().catch(() => {});
}

/**
 * Um teto para o reconhecimento em si — não para o carregamento do motor.
 *
 * "A leitura não terminou neste aparelho" é o estado que esta suíte foi
 * escrita para nunca mais deixar acontecer em silêncio: sem um teto, um
 * `recognize()` preso deixava a barra de progresso parada para sempre, sem
 * nunca chegar ao "falhou" que oferece tentar de novo. 35 s é generoso para
 * uma folha só — o dobro do que uma leitura normal leva neste app — e curto
 * o bastante para a pessoa não esperar o resto da demonstração por ele.
 */
const TETO_MS = 35_000;

/**
 * Lê uma imagem só, do começo ao fim.
 *
 * Para o Scanner, que lê uma folha por vez e sob demanda. O SliD não usa esta
 * função porque lê várias imagens de uma vez com um trabalhador próprio, do
 * jeito que `useOcr` já fazia antes desta mudança.
 */
export async function lerImagem(
  imagem: Blob,
  aoProgredir?: (fracao: number) => void,
): Promise<LeituraDeImagem> {
  aoProgredir?.(0.1);
  const leitor = await leitorCompartilhado();
  aoProgredir?.(0.4);
  // Se o teto vencer, este reconhecimento continua rodando por baixo até o
  // `terminate()` de `descartarLeitor` cortar o worker — sem ninguém mais
  // ouvindo o resultado. O `catch` aqui é só para essa rejeição não sobrar
  // como promise sem tratamento; o `race` abaixo é quem decide o que a
  // função devolve.
  const reconhecimento = leitor.recognize(imagem).then((r) => r.data);
  reconhecimento.catch(() => {});
  try {
    const data = await Promise.race([
      reconhecimento,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("tesseract-timeout")), TETO_MS);
      }),
    ]);
    aoProgredir?.(1);
    return { text: data.text.trim(), confidence: data.confidence ?? 0 };
  } catch (erro) {
    // Um trabalhador que estourou o teto pode continuar "reconhecendo" a
    // folha antiga em segundo plano; reaproveitá-lo na próxima leitura
    // misturaria as duas. Uma falha comum (rede, memória) também é motivo
    // suficiente para recomeçar do zero — barato pelo `leitorRef` já não
    // valer nada de qualquer forma depois de um erro real.
    await descartarLeitor(leitor);
    throw erro;
  }
}
