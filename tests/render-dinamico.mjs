/* Grava as cenas dinâmicas como y4m, para o navegador rodar a aula em tempo
   real pela câmera falsa. */
import { writeFileSync } from "node:fs";
const { W, H, slide, comCursor, comReflexo, comPessoa, comTremor } = await import("./cenas-dinamicas.mjs");
import { join } from "node:path";
import { CENAS, ruido } from "./caminhos.mjs";

/** Ruído de sensor com semente: a mesma cena sai igual em qualquer máquina. */
const rnd16 = ruido();
// O Chromium toca o arquivo no ritmo do dispositivo falso — 30 quadros por
// segundo — e não no que o cabeçalho declara. Medido: um arquivo de 600
// quadros gerado como 15 fps volta ao começo a cada 20 s, e não a cada 40 s.
// O cabeçalho passa a dizer a verdade, e as fases são contadas em 30.
const FPS = 30;

function grava(nome, segundos, quadro) {
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F${FPS}:1 Ip A1:1 C420mpeg2\n`);
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const parts = [head];
  for (let f = 0; f < segundos * FPS; f++) {
    const g = quadro(f / FPS);
    const y = Buffer.alloc(W * H);
    for (let i = 0; i < y.length; i++)
      y[i] = Math.max(0, Math.min(255, Math.round(g[i] + (rnd16() - 0.5) * 4)));
    parts.push(Buffer.from("FRAME\n"), y, uv, uv);
  }
  writeFileSync(join(CENAS, `${nome}.y4m`), Buffer.concat(parts));
  console.log(nome, `${segundos}s`);
}

// Dois slides diferentes de verdade: sementes diferentes trocam a escrita toda.
const A = slide({ semente: 7 });
const B = slide({ semente: 91, layout: "diagrama" });
grava("din-troca-de-slide", 24, (t) => (t < 12 ? A : B).g);

// Um build: o mesmo slide com dois bullets, depois com cinco.
const P1 = slide({ semente: 7, linhas: 2 });
const P2 = slide({ semente: 7, linhas: 5 });
grava("din-build", 24, (t) => (t < 12 ? P1 : P2).g);

// O slide parado, e só o cursor do professor andando por cima.
grava("din-cursor", 20, (t) => comCursor(A, t));

// O slide parado num celular apoiado que treme.
grava("din-tremor", 20, (t) => comTremor(A, t));

// O reflexo do projetor no vidro, atravessando devagar.
grava("din-reflexo", 20, (t) => comReflexo(A, t));

// O professor atravessando a tela repetidas vezes, com o slide igual.
grava("din-professor", 20, (t) => comPessoa(A, t));

// Luz baixa: o mesmo slide com o contraste que uma sala escura entrega.
const Baixa = slide({ semente: 7, contraste: 0.45 });
grava("din-luz-baixa", 16, () => Baixa.g);

// E a troca de slide acontecendo enquanto o professor passa na frente.
grava("din-troca-com-professor", 24, (t) => comPessoa(t < 12 ? A : B, t));

// A sala inteira sendo reenquadrada: o controle da guarda de reenquadramento.
// Sem periferia com marcas a guarda é cega, então a sala ganha porta e janela.
const { salaComTela, deslocada } = await import("./cenas-dinamicas.mjs");
const Sala = salaComTela(slide({ semente: 7 }));
const SalaMexida = deslocada(Sala, 58, 34);
grava("din-reenquadra", 24, (t) => (t < 12 ? Sala : SalaMexida).g);
// E a mesma sala com porta e janela, parada, trocando de slide: é o caso que
// hoje falha, agora com periferia de verdade para a guarda olhar.
const SalaB = salaComTela(slide({ semente: 91, layout: "diagrama" }));
grava("din-troca-na-sala", 24, (t) => (t < 12 ? Sala : SalaB).g);
