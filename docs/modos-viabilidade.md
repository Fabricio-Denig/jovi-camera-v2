# Que modos podem virar funcionalidade de verdade

Mapa para decidir o que implementar sem começar nada do zero à toa. Cada linha
diz o que já existe no projeto e o que faltaria — a coluna que mais importa é
"o que já temos", porque quase tudo aqui é combinação de peças que já estão no
repositório.

**O que o projeto já tem:** `getUserMedia` com troca de câmera, `applyConstraints`
e `getCapabilities` (zoom e lanterna), `MediaRecorder` (vídeo com áudio),
captura por canvas com janela de recorte (`capturePhoto.ts` + `aspect.ts`),
pipeline de filtros CSS aplicada ao visor **e** à foto (`filters.ts`),
Tesseract.js rodando local, IndexedDB, e a análise de quadro do SliD.

| Modo | Hoje | Pode virar real? | API / peça | Esforço | Prioridade |
|---|---|---|---|---|---|
| **Foto** | real | — | canvas + `capturePhoto` | — | — |
| **Vídeo** | real | — | `MediaRecorder` | — | — |
| **SliD** | real *(validado em projetor, 2x)* | — | análise de quadro própria | — | — |
| **Documento / Scanner** | **real** *(fase 1 e 2)* | — | canvas para detectar bordas por gradiente, transformação de perspectiva com `setTransform`, Tesseract já embarcado, filtro de contraste já existe | médio | **1ª** |
| **Noturno** | prévia | **Sim, versão honesta** | empilhar N quadros do vídeo em canvas e tirar a média — reduz ruído de verdade; `exposureCompensation` via `applyConstraints` quando o aparelho expõe | baixo | **2ª** |
| **Time-lapse / Intervalo** | **real** *(11/set)* | — | `canvas.captureStream(0)` + `requestFrame()` + `MediaRecorder` | — | — |
| **Retrato** | prévia | Parcial e arriscado | separar pessoa do fundo pede segmentação; sem biblioteca pesada, só dá para desfocar por distância do centro — o que erra em qualquer foto que não seja um busto centralizado | alto para ficar honesto | 4ª |
| **Panorâmica** | prévia | Difícil | costura de quadros pede casamento de características; sem OpenCV vira colagem com emenda visível | alto | baixa |
| **Câmera lenta** | prévia | **Não, no navegador** | precisa capturar a 120–240 fps; `getUserMedia` raramente entrega isso e `MediaRecorder` não controla a taxa de reprodução | — | — |
| **Pro** | prévia | Parcial, depende do aparelho | `applyConstraints` expõe `iso`, `exposureTime`, `focusDistance` e `whiteBalanceMode` **quando o hardware declara** — no Android costuma existir, no iOS quase nunca | baixo por controle, alto para ficar previsível | 5ª |
| **Alta resolução** | prévia | Parcial | `applyConstraints({ width: { ideal: … } })` — mas mexer na resolução reinicia o fluxo, e foi isso que já produziu preview preto uma vez | baixo, risco alto | baixa |
| **Superlua / Visualização dupla** | prévia | Não sem duas trilhas simultâneas / processamento dedicado | — | alto | baixa |

## Por que Scanner é o primeiro

Ele é o único da lista em que **todas as peças já estão no repositório**: canvas
para achar as bordas do papel, a mesma matemática de janela que a foto já usa
para recortar, a pipeline de filtro para realçar contraste, e o Tesseract que
já roda local para extrair texto. Nada de biblioteca nova, nada de OpenCV.

E ele resolve um caso que o SliD deliberadamente **não** cobre: captura pontual
de um documento, contra sessão contínua de aula. Os dois não se misturam.

## Por que câmera lenta não entra

Não é falta de esforço: o navegador não entrega o que o modo precisa. Registrar
isso evita gastar um ciclo descobrindo de novo. Ele continua como prévia, com o
card dizendo o que faria — que é honesto e é o que o Figma desenha.


## O que virou real, e por quê

**Scanner** (10/set) e **Intervalo** (11/set) saíram da lista de prévias.

O Intervalo é o modo criativo mais honesto que dá para fazer no navegador, e
vale registrar por quê: um time-lapse **é** um quadro a cada N segundos tocados
em sequência — não há aproximação, nem efeito aplicado depois, nem
característica de hardware sendo imitada. `canvas.captureStream(0)` não produz
quadro sozinho; cada `requestFrame()` empurra exatamente um. Então o arquivo
final tem tantos quadros quantas capturas houve, e a aceleração é o quociente
entre o tempo real e a duração do vídeo, não um número escrito na tela.

Medido: 19 quadros em 9 segundos a 500 ms, virando 1 s de vídeo — 6× mais
rápido, em `video/webm;codecs=vp9`, 640×480, que o navegador abre.

Sobram **sete prévias**, e cada uma diz "Prévia" no card com um cartão
explicando o que faria. Das sete, as que ainda poderiam virar reais estão
acima com o esforço estimado; **câmera lenta** e **superlua** não podem, e
estão registradas como tal para não custarem um ciclo de descoberta.
