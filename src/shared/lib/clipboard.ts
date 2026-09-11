/**
 * Copiar para a área de transferência, com o caminho de trás.
 *
 * `navigator.clipboard.writeText` é o caminho bom e falha de três jeitos
 * diferentes na vida real: não existe em contexto inseguro, é negado por
 * permissão, e em alguns navegadores só funciona dentro do gesto do usuário.
 * O caminho de trás é `document.execCommand("copy")` sobre um textarea fora da
 * tela — obsoleto, e ainda assim o que funciona quando o outro não funciona.
 *
 * Devolve se deu certo. Quem chama decide o que dizer; o que não pode
 * acontecer é o botão dizer "copiado" quando não copiou.
 */
export async function copyText(texto: string): Promise<boolean> {
  if (!texto) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // Cai para o caminho de trás em vez de desistir.
  }

  try {
    const area = document.createElement("textarea");
    area.value = texto;
    // Fora da vista, mas dentro do documento: um elemento com `display:none`
    // não pode receber seleção, e sem seleção não há cópia.
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, texto.length);
    const deu = document.execCommand("copy");
    document.body.removeChild(area);
    return deu;
  } catch {
    return false;
  }
}
