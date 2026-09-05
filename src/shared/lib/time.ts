/** mm:ss, for session timers and capture timestamps. */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** "13/04" — o formato dos cards no Figma (`339:540`), curto e sem ponto. */
export function formatDate(at: number): string {
  return new Date(at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
