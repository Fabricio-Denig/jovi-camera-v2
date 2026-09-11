import { melhorFormato } from "../../listen/useListen";
import { reconhecimentoDeclarado } from "../../listen/useTranscript";
import {
  espacoRestante,
  getAllCaptures,
  getSessionsWithAudio,
  getLessonAudio,
} from "./mediaStore";
import { podeCompartilhar, podeImprimir } from "../../slid/lessonSharing";

/**
 * O relatório do aparelho — o que a bancada não consegue responder.
 *
 * Metade do que este app faz depende de coisas que variam por celular e por
 * navegador: qual formato de áudio existe, se há reconhecimento de fala, se o
 * IndexedDB aceita megabytes, quantas câmeras o aparelho expõe. O Chromium
 * desta máquina responde uma coisa e um Android responde outra — e quando
 * alguém diz "não funcionou no meu celular", sem este relatório a investigação
 * começa do zero.
 *
 * A regra aqui é a mesma do resto do produto: **não afirmar o que não se
 * mediu**. `SpeechRecognition` declarado e `SpeechRecognition` que produziu
 * resultado são duas linhas separadas, porque medi um navegador em que a
 * primeira é verdadeira e a segunda é falsa.
 *
 * Isto não aparece no produto normal. Só com `?debug=device`.
 */

export interface LinhaDoRelatorio {
  rotulo: string;
  valor: string;
  /** Quando a resposta é boa/ruim de um jeito que dá para afirmar. */
  tom?: "bom" | "ruim" | "neutro";
}

export interface SecaoDoRelatorio {
  titulo: string;
  linhas: LinhaDoRelatorio[];
}

/** O que o app sabe de si mesmo, passado por quem tem os ganchos. */
export interface EstadoVivo {
  camera: {
    status: string;
    facing: string;
    trackState: string;
    trackLabel: string;
    videoSize: string;
    appliedFacing: string;
    canSwitchFacing: boolean;
  };
  zoom: { level: number; native: boolean };
  torch: { available: boolean; on: boolean };
  listen: {
    status: string;
    mimeType: string | null;
    microfone: { tracks: number; vivas: number; detalhe: string };
  };
  transcript: {
    status: string;
    houveResultado: boolean;
    ultimoErro: string | null;
    trechos: number;
  };
}

const sim = (b: boolean) => (b ? "sim" : "não");

/**
 * Quantas câmeras o aparelho expõe.
 *
 * `enumerateDevices` só devolve rótulos depois da permissão, mas a contagem
 * vem mesmo antes — e a contagem é o que decide se o botão de virar existe.
 */
async function contarCameras(): Promise<string> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((d) => d.kind === "videoinput");
    const micros = devices.filter((d) => d.kind === "audioinput");
    return `${cameras.length} câmera(s), ${micros.length} microfone(s)`;
  } catch (e) {
    return `falhou: ${e instanceof Error ? e.name : "erro"}`;
  }
}

/** O que está guardado, contado de verdade — não estimado. */
async function contarGuardado() {
  try {
    const capturas = await getAllCaptures();
    const comAudio = await getSessionsWithAudio();
    const aulas = new Set(
      capturas.filter((c) => c.session).map((c) => c.session!.id),
    );
    // A transcrição de uma aula qualquer, para provar que ela persiste — e
    // não só que o campo existe no tipo.
    let comTranscricao = 0;
    for (const id of comAudio) {
      const audio = await getLessonAudio(id);
      if (audio?.transcript && audio.transcript.length > 0) comTranscricao += 1;
    }
    return {
      capturas: capturas.length,
      aulas: aulas.size,
      audios: comAudio.size,
      transcricoes: comTranscricao,
      erro: null as string | null,
    };
  } catch (e) {
    return {
      capturas: 0,
      aulas: 0,
      audios: 0,
      transcricoes: 0,
      erro: e instanceof Error ? e.message : "erro",
    };
  }
}

/** O IndexedDB abre mesmo? Em aba privada de vários navegadores, não. */
async function testarIndexedDb(): Promise<string> {
  if (typeof indexedDB === "undefined") return "não existe";
  try {
    await new Promise<void>((resolve, reject) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => {
        q.result.close();
        resolve();
      };
      q.onerror = () => reject(q.error);
      q.onblocked = () => reject(new Error("bloqueado"));
    });
    return "abre";
  } catch (e) {
    return `recusado: ${e instanceof Error ? e.message : "erro"}`;
  }
}

export async function montarRelatorio(
  vivo: EstadoVivo,
): Promise<SecaoDoRelatorio[]> {
  const [cameras, guardado, idb, espaco] = await Promise.all([
    contarCameras(),
    contarGuardado(),
    testarIndexedDb(),
    espacoRestante().catch(() => null),
  ]);

  const formato = melhorFormato();
  const declarado = reconhecimentoDeclarado();

  return [
    {
      titulo: "Navegador",
      linhas: [
        { rotulo: "User agent", valor: navigator.userAgent },
        {
          rotulo: "Idioma",
          valor: `${navigator.language} (${(navigator.languages ?? []).join(", ")})`,
        },
        {
          rotulo: "Viewport",
          valor: `${window.innerWidth}×${window.innerHeight} css`,
        },
        { rotulo: "Tela", valor: `${screen.width}×${screen.height}` },
        { rotulo: "DPR", valor: String(window.devicePixelRatio) },
        {
          rotulo: "Orientação",
          valor: screen.orientation?.type ?? "não informada",
        },
        {
          rotulo: "Contexto seguro",
          valor: sim(window.isSecureContext),
          tom: window.isSecureContext ? "bom" : "ruim",
        },
      ],
    },
    {
      titulo: "Câmera",
      linhas: [
        { rotulo: "Dispositivos", valor: cameras },
        { rotulo: "Status", valor: vivo.camera.status },
        { rotulo: "Lado pedido", valor: vivo.camera.facing },
        { rotulo: "Lado aplicado", valor: vivo.camera.appliedFacing },
        {
          rotulo: "Track",
          valor: `${vivo.camera.trackState} — ${vivo.camera.trackLabel}`,
          tom: vivo.camera.trackState === "live" ? "bom" : "neutro",
        },
        { rotulo: "Resolução", valor: vivo.camera.videoSize },
        { rotulo: "Dá para virar", valor: sim(vivo.camera.canSwitchFacing) },
        {
          rotulo: "Zoom",
          valor: `${vivo.zoom.level}× (${vivo.zoom.native ? "óptico/nativo" : "digital"})`,
        },
        {
          rotulo: "Lanterna",
          valor: vivo.torch.available
            ? `existe, ${vivo.torch.on ? "acesa" : "apagada"}`
            : "não existe neste aparelho",
        },
      ],
    },
    {
      titulo: "Listen — gravação",
      linhas: [
        {
          rotulo: "MediaRecorder",
          valor: typeof MediaRecorder === "undefined" ? "não existe" : "existe",
          tom: typeof MediaRecorder === "undefined" ? "ruim" : "bom",
        },
        {
          rotulo: "Formato escolhido",
          valor:
            formato === null
              ? "nenhum suportado"
              : formato === ""
                ? "(o navegador escolhe)"
                : formato,
        },
        { rotulo: "Formato em uso", valor: vivo.listen.mimeType ?? "—" },
        { rotulo: "Estado do Listen", valor: vivo.listen.status },
        {
          // A linha que o P0 do microfone preso existe para responder.
          rotulo: "Mic track",
          valor:
            vivo.listen.microfone.tracks === 0
              ? "ended / sem track"
              : `${vivo.listen.microfone.vivas} live de ${vivo.listen.microfone.tracks} — ${vivo.listen.microfone.detalhe}`,
          tom:
            vivo.listen.microfone.vivas > 0 && vivo.listen.status !== "ouvindo"
              ? "ruim"
              : "neutro",
        },
      ],
    },
    {
      titulo: "Listen — transcrição",
      linhas: [
        {
          rotulo: "SpeechRecognition declarado",
          valor: sim(declarado),
        },
        {
          /*
           * As duas linhas acima e abaixo são separadas de propósito, e a
           * diferença entre elas é o achado que definiu o desenho do recurso:
           * nesta bancada a primeira diz "sim" e a segunda diz "não".
           */
          rotulo: "Produziu resultado de verdade",
          valor: sim(vivo.transcript.houveResultado),
          tom: vivo.transcript.houveResultado
            ? "bom"
            : declarado
              ? "ruim"
              : "neutro",
        },
        { rotulo: "Estado", valor: vivo.transcript.status },
        {
          rotulo: "Trechos nesta sessão",
          valor: String(vivo.transcript.trechos),
        },
        {
          rotulo: "Último erro",
          valor: vivo.transcript.ultimoErro ?? "nenhum",
          tom: vivo.transcript.ultimoErro ? "ruim" : "neutro",
        },
      ],
    },
    {
      titulo: "Armazenamento",
      linhas: [
        {
          rotulo: "IndexedDB",
          valor: idb,
          tom: idb === "abre" ? "bom" : "ruim",
        },
        {
          rotulo: "Espaço",
          valor: espaco
            ? `${espaco.usadoMB} MB usados de ~${espaco.totalMB} MB`
            : "o navegador não informa",
        },
        { rotulo: "Capturas", valor: String(guardado.capturas) },
        { rotulo: "Aulas", valor: String(guardado.aulas) },
        {
          rotulo: "Aulas com áudio guardado",
          valor: String(guardado.audios),
        },
        {
          rotulo: "Aulas com transcrição guardada",
          valor: String(guardado.transcricoes),
        },
        ...(guardado.erro
          ? [
              {
                rotulo: "Erro ao ler",
                valor: guardado.erro,
                tom: "ruim" as const,
              },
            ]
          : []),
      ],
    },
    {
      titulo: "Outras capacidades",
      linhas: [
        {
          rotulo: "Web Share",
          valor: podeCompartilhar() ? "existe e aceita texto" : "ausente",
        },
        { rotulo: "Imprimir / PDF", valor: sim(podeImprimir()) },
        {
          rotulo: "Clipboard API",
          valor:
            typeof navigator.clipboard?.writeText === "function"
              ? "existe"
              : "ausente (usa execCommand)",
        },
        {
          rotulo: "Storage estimate",
          valor:
            typeof navigator.storage?.estimate === "function"
              ? "existe"
              : "ausente",
        },
      ],
    },
  ];
}

/** O relatório como texto, que é a forma em que ele viaja. */
export function relatorioComoTexto(secoes: SecaoDoRelatorio[]): string {
  const partes: string[] = [
    "DIAGNÓSTICO DO APARELHO — SliD",
    new Date().toISOString(),
  ];
  for (const secao of secoes) {
    partes.push("", `== ${secao.titulo.toUpperCase()} ==`);
    for (const l of secao.linhas) partes.push(`${l.rotulo}: ${l.valor}`);
  }
  return partes.join("\n");
}
