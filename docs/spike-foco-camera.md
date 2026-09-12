# Spike: por que slides passavam sem virar momento

*12/set. Um teste em aparelho real mostrou vários slides passando na frente da
câmera sem nenhum virar momento — e visualmente o quadro parecia desfocado, do
jeito que uma câmera de celular fica antes de tocar na tela para ela acertar.
Hipótese: má imagem → más bordas → mau OCR → sinal ruim para o detector →
nenhum momento. Ou seja, um problema de aquisição, não (ainda) do detector.*

**Esta suíte não mexe no detector.** `frameAnalysis.ts`, `useSlidSession.ts`,
os limiares, a multiescala, a curadoria e o guarda de reenquadramento continuam
exatamente como estavam. O objetivo aqui é só entregar ao detector a melhor
imagem que o navegador e o hardware conseguem dar — julgar o detector de novo
só faz sentido depois disso.

## O que foi medido nesta bancada

```
getCapabilities().focusMode              → ["manual", "continuous"]
applyConstraints({focusMode:"continuous"}) → resolve sem erro
getConstraints().focusMode                → "continuous"   (ecoa o pedido)
getSettings().focusMode                    → "manual"       (nunca muda)
"pointsOfInterest" in capabilities          → false
```

A câmera fake desta bancada **declara** foco contínuo, **aceita** o pedido sem
erro, e **não faz nada** — `getSettings()` nunca sai de `"manual"`. É a mesma
forma do achado do `SpeechRecognition` desta sessão: a API responde que aceitou
e isso não é prova de que o hardware obedeceu. Por isso todo o desenho do
`useFocus` trata a promise resolvida como "pedido feito", nunca como
"confirmado" — só `getSettings()` depois é prova.

`pointsOfInterest` (a constraint que tocar-para-focar precisaria) **não existe
nesta bancada**. Não dá para testar toque-para-focar contra hardware real
aqui — só contra um dublê que registra a chamada. Ver "O que não foi feito" mais
abaixo.

## Achado colateral, relevante para qualquer teste futuro de câmera neste repo

Chromium tem **dois perfis de capacidade** para a câmera fake, dependendo de
como ela é lançada:

| lançamento | `Object.keys(getCapabilities())` |
|---|---|
| `--use-fake-device-for-media-stream` (sem cena) | aspectRatio, deviceId, **exposureMode, exposureTime**, facingMode, **focusDistance, focusMode**, frameRate, groupId, height, resizeMode, width |
| `--use-file-for-fake-video-capture=<arquivo>.y4m` (com cena) | aspectRatio, deviceId, facingMode, frameRate, groupId, height, resizeMode, width |

Passar um arquivo de cena (`.y4m`) para simular conteúdo realista **troca o
dispositivo fake para um perfil sem foco, sem exposição** — nenhuma das duas
famílias de constraint existe nesse modo. Isto derrubou `qa-foco.mjs` na
primeira tentativa (o bloco de `?debug=device` pedia uma cena por hábito, sem
precisar de conteúdo real, e via um relatório vazio). A correção foi no teste,
não no produto: quando o teste só precisa de uma track viva para ler
capacidades, **não passar `cena`**; quando precisa de conteúdo real na imagem
(OCR, o detector, nitidez), a cena é necessária e o perfil pobre de foco é
esperado e não deve ser lido como regressão.

## O que foi implementado

- **`mediaCapabilities.ts`** — leitura seca de `getCapabilities()` /
  `getSettings()` / `getConstraints()`, nunca lançando exceção quando um campo
  não existe.
- **`advancedConstraints.ts`** — um único ponto que funde pedidos de
  `advanced` por track (`WeakMap<MediaStreamTrack, …>`), para que pedir zoom
  não apague um pedido de foco anterior nem vice-versa. `useZoom` e `useTorch`
  passaram a usar este caminho em vez de chamar `applyConstraints` cru.
- **`useFocus.ts`** — pede `focusMode: "continuous"` só quando a capacidade
  existe de verdade (nunca um pedido às cegas), e guarda o estado como
  `"pedido"` até `getSettings()` confirmar — que nesta bancada nunca acontece,
  e é isso que o estado deve dizer.
- **`?debug=device`** ganhou as seções "Câmeras disponíveis", "Câmera —
  captura", "Câmera — foco" e "Câmera — tudo cru", copiáveis, para que um
  teste em aparelho real vire um texto colável em vez de uma investigação do
  zero.
- **Nitidez (debug, manual)** — uma medida de energia de borda (Sobel) sobre
  uma janela central do quadro, sob um botão, nunca automática. Serve para
  comparar "aqui" com "ali", não para decidir nada sozinha — ver a ressalva
  abaixo.

## O que foi medido com a ferramenta de nitidez (não um limiar, uma amostra)

| cena | pontuação |
|---|---|
| mesa vazia | 3,4 |
| slide projetado (foco normal) | 46,8 |
| parede de tijolos | 97,8 |

**Ressalva importante, para não virar regra prematuramente:** energia de borda
não distingue "superfície com textura" de "texto nítido" — a parede de tijolos
pontua mais alto que o slide focado, e não é mais "nítida" no sentido que
importa para OCR, só tem mais bordas por área. Esta ferramenta ainda não deve
virar um limiar de produto; ela existe para juntar amostras em condições reais
(focado, desfocado, parede, papel, projetor) antes de qualquer regra.

## O que não foi feito, e por quê

**Toque-para-focar não ganhou uma interação visível nesta rodada.** A
matemática de mapear o toque para o ponto certo do quadro está pronta e testada
(`focusPoint.ts`, `qa-foco-matematica.mjs`, 10/10) — mas esta bancada não tem
`pointsOfInterest`, então não há como provar contra hardware real que o toque
resultaria em foco de verdade. Desenhar um anel visual e continuar usando
exatamente a mesma câmera por baixo seria prometer um controle que não existe
— a mesma armadilha que motivou toda esta investigação. A função e o teste da
matemática ficam prontos para quando um aparelho real confirmar a capacidade;
a interação de toque só deve aparecer no produto nesse dia.

**Seleção automática de câmera (ultrawide/wide/tele) não foi implementada.**
Não há, nesta bancada, um critério robusto para decidir entre lentes de um
telefone com múltiplas câmeras traseiras a partir só de `getCapabilities()` —
os rótulos variam por fabricante e não há convenção confiável para não
hardcodar por marca. `facingMode: "environment"` continua sendo o pedido, sem
tentativa de escolher uma lente específica.

## O que faria a resposta mudar

- Um aparelho real que responda `focusMode` mudando de fato em `getSettings()`
  depois de `applyConstraints` — aí o pedido de contínuo já está pronto para
  ligar por padrão.
- Um aparelho real com `pointsOfInterest` na capacidade — aí a interação de
  toque-para-focar (matemática já pronta) pode aparecer na tela.
- Amostras de nitidez suficientes, em condições reais variadas, para separar
  "textura" de "foco" com confiança — só então vale considerar um limiar ou um
  aviso na tela.

## O que fica registrado

- Nenhuma mudança em `frameAnalysis.ts`, `useSlidSession.ts`, limiares,
  multiescala, curadoria ou guarda de reenquadramento.
- `useZoom`/`useTorch` preservam o comportamento externo; zoom e torch
  continuam funcionando, agora fundidos com o pedido de foco em vez de correr
  o risco de se apagarem mutuamente.
- Toda alteração é aditiva e passa por checagem de capacidade — nenhum
  `applyConstraints` é enviado sem a capacidade correspondente existir.
