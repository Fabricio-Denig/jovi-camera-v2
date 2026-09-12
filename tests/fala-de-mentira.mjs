/**
 * O dublê do reconhecimento de fala.
 *
 * Existe porque medi o contrário do que a documentação sugere. No Chromium
 * desta bancada:
 *
 *     typeof SpeechRecognition  → "function"
 *     eventos de uma sessão     → start, error:audio-capture, end
 *
 * A API é declarada e não funciona — não há microfone e o serviço recusa antes
 * do primeiro resultado. Sem dublê, o caminho feliz do recurso nunca seria
 * exercitado por teste nenhum, e a única coisa que a bancada conseguiria
 * provar é que ele não quebra quando falha.
 *
 * Ele **não** simula o acerto do reconhecimento — simula o **protocolo**: um
 * parcial, um final, e o navegador encerrando o turno por conta própria, que é
 * o ciclo que a Web Speech realmente executa numa aula longa. O que se verifica
 * é o que o app faz com esse ciclo.
 *
 * `window.__iniciadas` conta os `start()`. É por esse contador que se distingue
 * um religamento controlado (o navegador encerrou, o app volta) de um
 * religamento indevido (a pessoa desligou, e volta mesmo assim).
 */
export function instalarFalaDeMentira(frases) {
  return (lista) => {
    window.__iniciadas = 0;
    const resultado = (texto, final) => ({
      resultIndex: 0,
      results: Object.assign(
        [
          Object.assign([{ transcript: texto, confidence: 0.9 }], {
            isFinal: final,
          }),
        ],
        { length: 1 },
      ),
    });
    class FalaDeMentira {
      constructor() {
        this.lang = "";
        this.continuous = false;
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.onstart = null;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
        this._t = [];
      }
      start() {
        const i = window.__iniciadas % lista.length;
        window.__iniciadas += 1;
        const frase = lista[i];
        this._t.push(setTimeout(() => this.onstart && this.onstart(), 60));
        // Um parcial primeiro: é ele que prova, antes de qualquer final, que o
        // reconhecimento está vivo.
        this._t.push(
          setTimeout(
            () =>
              this.onresult &&
              this.onresult(resultado(frase.split(" ").slice(0, 4).join(" "), false)),
            400,
          ),
        );
        this._t.push(
          setTimeout(() => this.onresult && this.onresult(resultado(frase, true)), 1200),
        );
        // O navegador encerrando o turno sozinho: o evento que exige o
        // religamento controlado.
        this._t.push(setTimeout(() => this.onend && this.onend(), 2200));
      }
      stop() {
        this.abort();
      }
      abort() {
        for (const t of this._t) clearTimeout(t);
        this._t = [];
      }
    }
    window.SpeechRecognition = FalaDeMentira;
    window.webkitSpeechRecognition = FalaDeMentira;
  };
}

/**
 * Uma aula de React falada, com as marcas de ênfase que o produto reconhece.
 *
 * Não é texto de enfeite: "prestem atenção" e "isso cai na prova" são duas das
 * expressões que viram destaque, e "resumindo" é a terceira. Uma fala de teste
 * sem elas provaria que a transcrição aparece, e não que o app entende o que
 * ouviu.
 */
export const AULA_FALADA = [
  "hoje a gente vai falar sobre estado no React e sobre o useState",
  "prestem atenção nessa parte porque o useState devolve sempre um par",
  "isso cai na prova o estado no React é imutável e nunca se altera direto",
  "resumindo o useState guarda estado e o useEffect reage a mudanças de estado",
];
