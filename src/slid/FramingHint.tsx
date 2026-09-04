/**
 * A única coisa que a câmera pede ao estudante.
 *
 * Ela aparece num caso só: a análise reconheceu escrita numa janela ampliada
 * mas não o suficiente para afirmar que é aula — o retrato de um slide longe
 * demais. Não é um aviso de erro, é o botão de zoom explicando por que existe,
 * no segundo em que ele resolveria alguma coisa.
 *
 * O texto muda com o zoom em uso, porque "tente 2x" para quem já está em 3x é
 * ruído com aparência de ajuda.
 */
export function FramingHint({ zoomLevel }: { zoomLevel: number }) {
  const recado =
    zoomLevel >= 3
      ? "Conteúdo distante — chegue um pouco mais perto"
      : zoomLevel >= 2
        ? "Ainda distante — experimente 3x"
        : "Conteúdo distante — experimente 2x";

  return (
    <p
      role="status"
      className="pointer-events-none animate-[slid-rise_240ms_ease-out] rounded-full bg-black/60 px-3.5 py-1.5 text-center text-[11.5px] font-medium leading-snug text-white/90 backdrop-blur"
    >
      {recado}
    </p>
  );
}
