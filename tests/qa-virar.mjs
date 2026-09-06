/* O botão de virar câmera está na fileira do obturador, como no Figma?
   O dispositivo falso do Chromium expõe uma câmera só, então o app esconde o
   botão — corretamente. Aqui a lista de dispositivos é forjada com duas, que
   é a única forma de exercitar a posição sem um celular na mão. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CHROMIUM } from "./caminhos.mjs";
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

const b = await chromium.launch({ executablePath: CHROMIUM,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
await ctx.addInitScript(() => {
  const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
  navigator.mediaDevices.enumerateDevices = async () => {
    const d = await real();
    const cam = d.find((x) => x.kind === "videoinput");
    if (!cam) return d;
    // Uma segunda câmera, frontal, com a mesma forma de objeto da primeira.
    return [...d, { deviceId: "fake_device_1", kind: "videoinput", label: "front camera", groupId: cam.groupId, toJSON: () => ({}) }];
  };
});
const p = await ctx.newPage();
const erros = []; p.on("pageerror", (e) => erros.push(String(e)));
await p.goto(APP + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(3500);

const virar = p.getByRole("button", { name: "Trocar câmera" });
check((await virar.count()) === 1, "existe um único botão de virar câmera", `${await virar.count()}`);

if (await virar.count()) {
  const geo = await p.evaluate(() => {
    const bt = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Trocar câmera");
    const ob = [...document.querySelectorAll("button")].find((x) => /Tirar foto|Gravar|obturador/i.test(x.getAttribute("aria-label") ?? ""));
    const r = bt.getBoundingClientRect();
    return { v: { x: r.x, y: r.y, w: r.width, h: r.height }, o: ob ? ob.getBoundingClientRect().y : null,
             tela: { w: innerWidth, h: innerHeight } };
  });
  // Figma: miniatura · obturador · virar, na mesma fileira, à direita.
  check(geo.o !== null && Math.abs(geo.v.y - geo.o) < 60, "está na fileira do obturador", `virar y=${geo.v.y.toFixed(0)} obturador y=${geo.o?.toFixed(0)}`);
  check(geo.v.x > geo.tela.w * 0.6, "e à direita do obturador", `x=${geo.v.x.toFixed(0)} de ${geo.tela.w}`);
  check(geo.v.w >= 40 && geo.v.h >= 40, "alvo de toque >= 40px", `${geo.v.w.toFixed(0)}x${geo.v.h.toFixed(0)}`);
  await virar.click();
  await p.waitForTimeout(1500);
  check(erros.length === 0, "trocar não quebra a câmera", erros[0] ?? "");
}
await b.close();
console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);
