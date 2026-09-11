/* O modo Noite, que deixou de ser prévia — e a medida que autoriza isso.

   A regra que o Fabricio pôs neste modo foi explícita: "só manter se houver
   ganho mensurável". Então o arquivo mede, e o número é o veredito. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir() {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/noite-quarto-escuro.y4m`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2800);
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(900);
  await p.getByRole("dialog").getByRole("button", { name: /^Noite/ }).first().click();
  await p.waitForTimeout(2200);
  return { b, p, erros };
}

console.log("== a média de N quadros reduz ruído por √N ==");
{
  const { b, p, erros } = await abrir();

  /* A medida que autoriza o modo a existir. Numa região CHAPADA da cena, o
     desvio padrão é ruído puro — não há detalhe ali para confundi-lo. */
  const r = await p.evaluate(async () => {
    const v = document.querySelector("video");
    const w = v.videoWidth;
    const h = v.videoHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    const REG = { x: 400, y: 150, w: 120, h: 80 };
    const desvio = (data) => {
      let n = 0, s = 0, s2 = 0;
      for (let y = REG.y; y < REG.y + REG.h; y++)
        for (let x = REG.x; x < REG.x + REG.w; x++) {
          const g = data[(y * w + x) * 4];
          s += g; s2 += g * g; n++;
        }
      const m = s / n;
      return { media: m, sigma: Math.sqrt(s2 / n - m * m) };
    };
    ctx.drawImage(v, 0, 0, w, h);
    const um = desvio(ctx.getImageData(0, 0, w, h).data);

    const empilhar = async (N, ms) => {
      const soma = new Float32Array(w * h);
      for (let i = 0; i < N; i++) {
        ctx.drawImage(v, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h).data;
        for (let q = 0, pp = 0; pp < d.length; pp += 4, q++) soma[q] += d[pp];
        if (i < N - 1) await esperar(ms / N);
      }
      const out = new Uint8ClampedArray(w * h * 4);
      for (let q = 0, pp = 0; q < soma.length; q++, pp += 4) {
        const m = soma[q] / N;
        out[pp] = m; out[pp + 1] = m; out[pp + 2] = m; out[pp + 3] = 255;
      }
      return desvio(out);
    };

    return { um, q4: await empilhar(4, 600), q8: await empilhar(8, 1200), q16: await empilhar(16, 2400) };
  });

  for (const [N, med, teorico] of [[4, r.q4, 2], [8, r.q8, Math.sqrt(8)], [16, r.q16, 4]]) {
    const ganho = r.um.sigma / med.sigma;
    console.log(
      `        ${String(N).padStart(2)} quadros: σ ${r.um.sigma.toFixed(2)} → ${med.sigma.toFixed(2)} = ${ganho.toFixed(2)}× (teórico ${teorico.toFixed(2)}×)`,
    );
    // Dentro de 15 % do teórico: mais folga que isso deixaria passar uma
    // implementação que lê o mesmo quadro N vezes, que não melhora nada.
    check(
      Math.abs(ganho - teorico) / teorico < 0.15,
      `${N} quadros cortam o ruído como a estatística manda`,
      `${ganho.toFixed(2)}× vs ${teorico.toFixed(2)}×`,
    );
  }

  // E o sinal continua lá: a média não pode escurecer nem clarear a cena.
  check(
    Math.abs(r.q16.media - r.um.media) < 2,
    "e o sinal fica intacto — a média limpa, não muda a exposição",
    `${r.um.media.toFixed(1)} → ${r.q16.media.toFixed(1)}`,
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o modo, na tela ==");
{
  const { b, p, erros } = await abrir();
  const corpo = await p.locator("body").innerText();
  check(!/Prévia/i.test(corpo), "nenhum selo de prévia");
  check(/Tempo de exposição|Curto|Médio|Longo/i.test(corpo), "os níveis aparecem");

  /* A instrução não é conselho genérico: este modo não alinha quadros, então
     tremor vira borrão. Não dizer isso faria a pessoa achar o modo quebrado. */
  check(
    /Apoie o celular/i.test(corpo),
    "e a tela diz para apoiar o celular",
  );
  check(
    /não corrige tremor/i.test(corpo),
    "dizendo o que o modo NÃO faz",
  );

  const niveis = await p.getByRole("radio").count();
  check(niveis === 3, "três níveis de exposição", `${niveis}`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o disparo empilha e guarda uma foto ==");
{
  const { b, p, erros } = await abrir();
  // "Longo" e não "Curto": em 0,6 s o empilhamento acaba antes de dar tempo
  // de olhar, e o teste reprovava a tela certa.
  await p.getByRole("radio", { name: /Longo/ }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Tirar foto/i }).click();
  await p.waitForTimeout(700);
  check(
    /Segure firme|juntando/i.test(await p.locator("body").innerText()),
    "a tela mostra que está juntando quadros",
  );

  await p.waitForTimeout(5000);
  const fotos = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const all = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return all.filter((c) => c.kind === "photo").map((c) => ({ bytes: c.blob.size, w: c.width, h: c.height }));
  });
  console.log("        " + JSON.stringify(fotos));
  check(fotos.length === 1, "uma foto guardada");
  check(fotos[0]?.bytes > 3000, "com bytes de verdade", `${fotos[0]?.bytes} bytes`);
  check(fotos[0]?.w === 640 && fotos[0]?.h === 480, "na resolução do sensor", `${fotos[0]?.w}×${fotos[0]?.h}`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
