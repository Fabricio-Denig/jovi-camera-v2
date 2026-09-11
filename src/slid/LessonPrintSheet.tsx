import { createPortal } from "react-dom";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { linesWithoutTitle } from "./classText";
import { overviewWithStatus } from "./readContent";
import { STATUS_STYLES } from "./status";
import { formatClock, formatDate } from "../shared/lib/time";
import type { ClassMoment, ClassRecord } from "./classes";

/**
 * A aula em folha, para o "Salvar PDF" do `Resumo v2` (`339:662`).
 *
 * Sem biblioteca de PDF: `window.print()` mais uma folha de impressão produz
 * um PDF de verdade, gerado pelo próprio sistema, que o iOS e o Android já
 * sabem salvar e compartilhar. Um jsPDF custaria centenas de kilobytes e
 * desenharia pior — sem quebra de página inteligente, sem fonte do sistema,
 * sem seleção de texto no arquivo final.
 *
 * Esta folha vive fora da tela o tempo todo e só existe na impressão. O
 * conteúdo é o mesmo da aula: nada é gerado aqui que não esteja lá.
 *
 * Ela é levada para fora do `#root` por um portal, e isso não é detalhe: a
 * folha de impressão esconde o `#root` inteiro, e um elemento dentro de um
 * `display:none` não pode ser mostrado de volta por regra nenhuma. Com a
 * folha dentro do app, "Salvar PDF" gerava um arquivo em branco — medido.
 *
 * O áudio não entra no arquivo — um PDF não toca som, e enfiar dezenas de
 * megabytes de gravação num anexo seria produzir um arquivo que ninguém abre.
 * A folha diz que a aula tem gravação, que é o que dá para dizer com verdade.
 */
export function LessonPrintSheet({
  record,
  temAudio,
}: {
  record: ClassRecord;
  temAudio: boolean;
}) {
  return createPortal(
    <div className="folha-de-impressao" aria-hidden="true">
      <h1>{record.subject}</h1>
      <p className="folha-meta">
        {[
          record.discipline,
          record.status ? STATUS_STYLES[record.status].label : null,
          formatDate(record.savedAt),
          `${formatClock(record.durationMs)} de aula`,
          `${record.moments.length} ${record.moments.length === 1 ? "momento" : "momentos"}`,
          temAudio ? "com gravação de áudio" : null,
        ]
          .filter(Boolean)
          .join("  ·  ")}
      </p>

      {record.overview && (
        <p className="folha-resumo">
          {overviewWithStatus(
            record.overview,
            record.status,
            record.status ? STATUS_STYLES[record.status].label : null,
          )}
        </p>
      )}

      {record.topics.length > 0 && (
        <>
          <h2>Nesta aula</h2>
          <ul>
            {record.topics.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Momentos</h2>
      {record.moments.map((momento) => (
        <MomentoImpresso key={momento.media.id} momento={momento} />
      ))}

      <p className="folha-rodape">
        Gerado pelo SliD · {formatDate(Date.now())} · o conteúdo vem do que a
        câmera leu durante a aula
      </p>
    </div>,
    document.body,
  );
}

function MomentoImpresso({ momento }: { momento: ClassMoment }) {
  const url = useObjectUrl(momento.media.blob);
  const linhas = linesWithoutTitle(momento);

  return (
    <div className="folha-momento">
      {url && <img src={url} alt="" />}
      <div>
        <h3>
          <span className="folha-tempo">{formatClock(momento.atMs)}</span>{" "}
          {momento.label}
          {momento.category && (
            <span className="folha-tipo"> — {momento.category}</span>
          )}
        </h3>
        {linhas.length > 0 && (
          <ul>
            {linhas.map((linha, i) => (
              <li key={`${i}-${linha}`}>{linha}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
