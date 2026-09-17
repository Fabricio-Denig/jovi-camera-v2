import { useEffect, useRef, useState } from "react";
import { CopyButton } from "../slid/CopyButton";
import {
  lerDeviceDiag,
  lerSnapshot,
  obterAudioReproduzivel,
  totaisPorFase,
  type ListenDiagSnapshot,
} from "./listenDiag";

/**
 * O diagnóstico do Listen, em tela cheia, atrás de `?debug=listen`.
 *
 * Mesma razão de existir que `DeviceReport.tsx`: um celular em teste de
 * campo não tem console alcançável, e "a transcrição falhou" sem dados é uma
 * investigação que recomeça do zero a cada vez. Esta tela transforma
 * `listenDiag.ts` — o que cada etapa (áudio, motor, download, inferência)
 * registrou — num texto colável, e deixa tocar o PCM exato que foi (ou
 * seria) enviado ao modelo.
 *
 * Fora do produto normal — nenhum caminho da interface leva aqui.
 */
export function ListenDebugReport({ onFechar }: { onFechar: () => void }) {
  const [snapshot, setSnapshot] = useState<ListenDiagSnapshot>(() => lerSnapshot());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState<number | null>(null);

  useEffect(() => {
    // O diagnóstico muda em segundo plano (o job roda fora desta tela) — um
    // intervalo curto mantém a tela viva sem precisar de "Reler" a cada
    // segundo durante uma transcrição em curso. Sem leitura síncrona aqui:
    // o `useState` acima já parte do valor atual no primeiro render.
    const id = window.setInterval(() => setSnapshot(lerSnapshot()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const device = lerDeviceDiag();

  const tocar = (index: number) => {
    const dado = obterAudioReproduzivel(index);
    if (!dado) return;
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx({ sampleRate: dado.sampleRate });
    const buffer = ctx.createBuffer(1, dado.amostras.length, dado.sampleRate);
    // `.set()`, não `copyToChannel`: aceita qualquer TypedArray, sem a
    // exigência estrita de `Float32Array<ArrayBuffer>` que o TS 6 impõe a
    // `copyToChannel` — e o Float32Array aqui já é sempre uma cópia
    // independente (ver `decodificarParaWhisper`), nunca uma view sobre um
    // buffer que outra coisa ainda usa.
    buffer.getChannelData(0).set(dado.amostras);
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.connect(ctx.destination);
    setTocando(index);
    fonte.onended = () => {
      setTocando(null);
      void ctx.close().catch(() => {});
    };
    fonte.start();
  };

  const texto = snapshotComoTexto(snapshot, device);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-ink">
            Diagnóstico do Listen
          </h1>
          <p className="text-[11.5px] text-ink-muted">
            Só com <code>?debug=listen</code>. Não faz parte do produto.
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar o diagnóstico"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink active:opacity-70"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {snapshot.error && (
          <section className="mb-4">
            <h2 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-danger">
              Última falha real (tentativa {snapshot.error.attempt})
            </h2>
            <div className="rounded-xl border border-danger/40 bg-surface-2 px-3 py-2">
              <p className="text-[12px] text-ink">
                <span className="font-mono text-danger">
                  [{snapshot.error.stage}] {snapshot.error.name}
                </span>
                : {snapshot.error.message}
              </p>
              {snapshot.error.stack && (
                <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[10px] text-ink-muted">
                  {snapshot.error.stack}
                </pre>
              )}
            </div>
          </section>
        )}

        <Secao titulo={`Aparelho (tentativa ${snapshot.attempt})`}>
          <Linha rotulo="User agent" valor={device.userAgent} />
          <Linha
            rotulo="deviceMemory"
            valor={device.deviceMemory != null ? `${device.deviceMemory} GB` : "indisponível"}
          />
          <Linha
            rotulo="hardwareConcurrency"
            valor={String(device.hardwareConcurrency ?? "indisponível")}
          />
          <Linha
            rotulo="crossOriginIsolated"
            valor={String(device.crossOriginIsolated)}
            tom={device.crossOriginIsolated ? "bom" : undefined}
          />
          <Linha rotulo="SharedArrayBuffer" valor={String(device.sharedArrayBuffer)} />
          <Linha rotulo="WebGPU (navigator.gpu)" valor={String(device.webgpu)} />
          <Linha rotulo="WebAssembly" valor={String(device.webassembly)} />
          <Linha rotulo="onLine" valor={String(device.onLine)} />
        </Secao>

        <Secao titulo="Motor (engine)">
          <Linha rotulo="Modelo" valor={snapshot.engine.modelId ?? "—"} />
          <Linha
            rotulo="Multilíngue"
            valor={snapshot.engine.multilingual == null ? "—" : String(snapshot.engine.multilingual)}
          />
          <Linha rotulo="Backend" valor={snapshot.engine.backend ?? "—"} />
          <Linha rotulo="Device" valor={snapshot.engine.device ?? "—"} />
          <Linha rotulo="numThreads" valor={String(snapshot.engine.numThreads ?? "—")} />
          <Linha
            rotulo="Estado"
            valor={snapshot.engine.estado}
            tom={
              snapshot.engine.estado === "pronto"
                ? "bom"
                : snapshot.engine.estado === "falhou"
                  ? "ruim"
                  : undefined
            }
          />
          <Linha rotulo="Cache" valor={snapshot.engine.cache} />
        </Secao>

        {snapshot.downloads.length > 0 && (
          <Secao titulo="Download dos pesos">
            {snapshot.downloads.map((d) => (
              <Linha
                key={d.arquivo}
                rotulo={d.arquivo}
                valor={
                  d.erro
                    ? `falhou: ${d.erro}`
                    : `${d.bytes != null ? `${(d.bytes / 1024).toFixed(0)} KB` : "?"} em ${d.duracaoMs ?? "?"}ms`
                }
                tom={d.erro ? "ruim" : "bom"}
              />
            ))}
          </Secao>
        )}

        {snapshot.audio.length > 0 && (
          <Secao titulo="Áudio decodificado (PCM real)">
            {snapshot.audio.map((a) => (
              <div key={a.index} className="border-b border-line px-3 py-2 last:border-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-ink">
                    Segmento {a.index} · {a.mimeType || "?"} · {(a.bytes / 1024).toFixed(0)} KB
                  </span>
                  {obterAudioReproduzivel(a.index) && (
                    <button
                      type="button"
                      onClick={() => tocar(a.index)}
                      className="min-h-8 shrink-0 rounded-full bg-surface-2 px-3 text-[11.5px] font-medium text-ink active:opacity-70"
                    >
                      {tocando === a.index
                        ? "Tocando…"
                        : obterAudioReproduzivel(a.index)?.truncado
                          ? // Dito, nunca escondido: o que toca é o começo, não
                            // o segmento inteiro (ver `registrarAudioReproduzivel`).
                            "▶ Tocar o início do que o modelo recebe"
                          : "▶ Tocar o que o modelo recebe"}
                    </button>
                  )}
                </div>
                {a.decoded ? (
                  <p className="font-mono text-[11px] text-ink-muted">
                    {a.decoded.durationS.toFixed(2)}s · {a.decoded.sampleRate}Hz ·{" "}
                    {a.decoded.frameCount} amostras · peak {a.decoded.peak.toFixed(3)} · RMS{" "}
                    {a.decoded.rms.toFixed(4)} · {a.decoded.silencioPercent.toFixed(0)}% silêncio
                  </p>
                ) : (
                  <p className="font-mono text-[11px] text-danger">
                    Falha ao decodificar: {a.decodeError ?? "motivo desconhecido"}
                  </p>
                )}
              </div>
            ))}
          </Secao>
        )}

        {/*
          As etapas, em primeiro lugar depois do erro — porque é a primeira
          pergunta depois de um teste em aparelho: ONDE foi o tempo. Um
          total por etapa (carregar o modelo, decodificar, inferir,
          sanitizar, resumir, gravar) e, logo abaixo, cada uma na ordem em
          que aconteceu, com o heap no fim dela. Ver `FaseDiag`.
        */}
        {snapshot.fases.length > 0 && (
          <Secao titulo="Etapas — onde foi o tempo">
            {totaisPorFase(snapshot).map((t) => (
              <Linha
                key={t.fase}
                rotulo={`${t.fase} (${t.vezes}×)`}
                valor={duracao(t.totalMs)}
              />
            ))}
            <div className="mt-2 max-h-64 overflow-y-auto rounded-xl bg-surface-2 px-3 py-2">
              {snapshot.fases.map((f, i) => (
                <p
                  key={`${f.fase}-${f.inicio}-${i}`}
                  className="border-b border-line/40 py-1 font-mono text-[10.5px] leading-snug text-ink-muted last:border-0"
                >
                  <span className="text-ink">{f.fase}</span>
                  {f.rotulo ? ` · ${f.rotulo}` : ""} · {duracao(f.duracaoMs)}
                  {f.heapMb != null ? ` · heap ${f.heapMb}MB` : ""}
                  {f.detalhe ? ` · ${f.detalhe}` : ""}
                </p>
              ))}
            </div>
          </Secao>
        )}

        {/*
          As travas da thread principal, logo ao lado do tempo por etapa —
          as duas juntas respondem a pergunta que o teste em aparelho
          deixou em aberto: o trabalho demorou porque tem trabalho a fazer,
          ou porque a interface e ele disputam a mesma thread? Ver
          `LongTaskDiag`.
        */}
        <Secao titulo="Thread principal (travas ≥50ms)">
          {snapshot.longTasks.disponivel ? (
            <>
              <Linha rotulo="Travas" valor={String(snapshot.longTasks.total)} />
              <Linha
                rotulo="Tempo travado"
                valor={duracao(snapshot.longTasks.somaMs)}
                tom={snapshot.longTasks.somaMs > 5000 ? "ruim" : undefined}
              />
              <Linha
                rotulo="Pior trava"
                valor={duracao(snapshot.longTasks.maiorMs)}
                tom={snapshot.longTasks.maiorMs > 1000 ? "ruim" : undefined}
              />
            </>
          ) : (
            <Linha
              rotulo="PerformanceObserver"
              valor="longtask não suportado neste navegador"
            />
          )}
        </Secao>

        {snapshot.inference.iniciouEm != null && (
          <Secao titulo="Inferência">
            <Linha rotulo="Samples enviados" valor={String(snapshot.inference.samples ?? "—")} />
            <Linha
              rotulo="Duração do áudio"
              valor={
                snapshot.inference.duracaoAudioS != null
                  ? `${snapshot.inference.duracaoAudioS.toFixed(2)}s`
                  : "—"
              }
            />
            <Linha
              rotulo="Duração da inferência"
              valor={
                snapshot.inference.duracaoInferenciaMs != null
                  ? `${snapshot.inference.duracaoInferenciaMs}ms`
                  : "em andamento…"
              }
            />
            <Linha rotulo="Blocos retornados" valor={String(snapshot.inference.chunks ?? "—")} />
          </Secao>
        )}

        {snapshot.audio.length === 0 && !snapshot.error && (
          <p className="pt-8 text-center text-sm text-ink-muted">
            Nenhuma transcrição rodou ainda nesta aba. Abra uma aula com áudio
            para ver o diagnóstico.
          </p>
        )}
      </div>

      <footer className="border-t border-line px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CopyButton texto={texto} rotulo="Copiar diagnóstico" />
          </div>
          <button
            type="button"
            onClick={() => setSnapshot(lerSnapshot())}
            className="min-h-11 shrink-0 rounded-xl bg-surface-2 px-4 text-[14px] font-medium text-ink active:opacity-70"
          >
            Reler
          </button>
        </div>
      </footer>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} hidden />
    </div>
  );
}

/** Milissegundos como alguém lê: `840ms`, `12,4s`, `9min42s`. Um job de dez
    minutos em milissegundos é um número que ninguém compara de cabeça. */
function duracao(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(".", ",")}s`;
  const min = Math.floor(ms / 60_000);
  const seg = Math.round((ms % 60_000) / 1000);
  return `${min}min${String(seg).padStart(2, "0")}s`;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {titulo}
      </h2>
      <dl className="overflow-hidden rounded-xl border border-line">{children}</dl>
    </section>
  );
}

function Linha({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: string;
  tom?: "bom" | "ruim";
}) {
  return (
    <div className="flex gap-3 px-3 py-2 odd:bg-surface-2">
      <dt className="w-[44%] shrink-0 text-[12px] text-ink-muted">{rotulo}</dt>
      <dd
        className={`min-w-0 flex-1 break-words font-mono text-[11.5px] ${
          tom === "bom" ? "text-accent" : tom === "ruim" ? "text-danger" : "text-ink"
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}

function snapshotComoTexto(
  s: ListenDiagSnapshot,
  device: ReturnType<typeof lerDeviceDiag>,
): string {
  const linhas = [
    `Diagnóstico do Listen — tentativa ${s.attempt}`,
    "",
    "Aparelho:",
    `  user agent: ${device.userAgent}`,
    `  deviceMemory: ${device.deviceMemory ?? "indisponível"}`,
    `  hardwareConcurrency: ${device.hardwareConcurrency ?? "indisponível"}`,
    `  crossOriginIsolated: ${device.crossOriginIsolated}`,
    `  SharedArrayBuffer: ${device.sharedArrayBuffer}`,
    `  WebGPU: ${device.webgpu}`,
    `  WebAssembly: ${device.webassembly}`,
    `  onLine: ${device.onLine}`,
    "",
    "Motor:",
    `  modelo: ${s.engine.modelId ?? "—"}`,
    `  backend/device: ${s.engine.backend ?? "—"}/${s.engine.device ?? "—"}`,
    `  numThreads: ${s.engine.numThreads ?? "—"}`,
    `  estado: ${s.engine.estado}`,
    `  cache: ${s.engine.cache}`,
    "",
    "Downloads:",
    ...s.downloads.map(
      (d) => `  ${d.arquivo}: ${d.erro ?? `${d.bytes ?? "?"} bytes em ${d.duracaoMs ?? "?"}ms`}`,
    ),
    "",
    "Áudio:",
    ...s.audio.map((a) =>
      a.decoded
        ? `  segmento ${a.index}: ${a.decoded.durationS.toFixed(2)}s, ${a.decoded.sampleRate}Hz, peak ${a.decoded.peak.toFixed(3)}, RMS ${a.decoded.rms.toFixed(4)}, ${a.decoded.silencioPercent.toFixed(0)}% silêncio`
        : `  segmento ${a.index}: falha ao decodificar (${a.decodeError ?? "?"})`,
    ),
    "",
    "Inferência:",
    `  samples: ${s.inference.samples ?? "—"}`,
    `  duração inferência: ${s.inference.duracaoInferenciaMs ?? "—"}ms`,
    `  blocos: ${s.inference.chunks ?? "—"}`,
    "",
    "Thread principal:",
    s.longTasks.disponivel
      ? `  travas ≥50ms: ${s.longTasks.total}, somando ${duracao(s.longTasks.somaMs)}, pior ${duracao(s.longTasks.maiorMs)}`
      : "  longtask não suportado neste navegador",
    "",
    "Etapas (total por etapa):",
    ...totaisPorFase(s).map(
      (t) => `  ${t.fase}: ${duracao(t.totalMs)} em ${t.vezes} vez(es)`,
    ),
    "",
    "Etapas (na ordem):",
    ...s.fases.map(
      (f) =>
        `  ${f.fase}${f.rotulo ? ` [${f.rotulo}]` : ""}: ${duracao(f.duracaoMs)}` +
        `${f.heapMb != null ? `, heap ${f.heapMb}MB` : ""}` +
        `${f.detalhe ? `, ${f.detalhe}` : ""}`,
    ),
  ];
  if (s.error) {
    linhas.push(
      "",
      `Última falha (tentativa ${s.error.attempt}):`,
      `  etapa: ${s.error.stage}`,
      `  ${s.error.name}: ${s.error.message}`,
      s.error.stack ?? "",
    );
  }
  return linhas.join("\n");
}
