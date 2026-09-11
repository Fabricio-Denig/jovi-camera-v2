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
| **Instantâneo** | **real** *(11/set)* | — | o mesmo caminho da Foto, passando por cima do temporizador | — | — |
| **Vídeo** | real | — | `MediaRecorder` | — | — |
| **SliD** | real *(validado em projetor, 2x)* | — | análise de quadro própria | — | — |
| **Documento / Scanner** | **real** *(fase 1 e 2)* | — | canvas para detectar bordas por gradiente, transformação de perspectiva com `setTransform`, Tesseract já embarcado, filtro de contraste já existe | médio | **1ª** |
| **Noturno / Noite** | **real** *(11/set)* | — | média de N quadros em `Float32Array` | — | — |
| **Comida** | **real** *(11/set)* | — | a mesma máquina de aparência dos Filtros, com uma curva própria | — | — |
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

**Scanner** (10/set), **Intervalo**, **Noite** e **Comida** (11/set) saíram da
lista de prévias. Com o Instantâneo, **metade do catálogo é real**.

O Intervalo é o modo criativo mais honesto que dá para fazer no navegador, e
vale registrar por quê: um time-lapse **é** um quadro a cada N segundos tocados
em sequência — não há aproximação, nem efeito aplicado depois, nem
característica de hardware sendo imitada. `canvas.captureStream(0)` não produz
quadro sozinho; cada `requestFrame()` empurra exatamente um. Então o arquivo
final tem tantos quadros quantas capturas houve, e a aceleração é o quociente
entre o tempo real e a duração do vídeo, não um número escrito na tela.

Medido: 19 quadros em 9 segundos a 500 ms, virando 1 s de vídeo — 6× mais
rápido, em `video/webm;codecs=vp9`, 640×480, que o navegador abre.

Sobram **oito prévias**, e cada uma diz "Prévia" no card com um cartão
explicando o que faria. Das sete, as que ainda poderiam virar reais estão
acima com o esforço estimado; **câmera lenta** e **superlua** não podem, e
estão registradas como tal para não custarem um ciclo de descoberta.


### Noite: a metade honesta

Um celular faz foto noturna empilhando exposições **e alinhando-as**. Alinhar
exige casar características entre quadros, que é o que pediria OpenCV. A outra
metade — tirar a média de N quadros — é a que mais rende e não precisa de nada.

E ela não é aproximação: o ruído de sensor é aleatório e independente entre
quadros, o sinal não é. Somar N e dividir por N mantém o sinal e divide o
desvio do ruído por √N.

**Medido na bancada, contra o teórico:**

| quadros | ruído σ | ganho | teórico |
|---|---|---|---|
| 1 | 12,75 | — | — |
| 4 | 6,36 | **2,00×** | 2,00× |
| 8 | 4,52 | **2,82×** | 2,83× |
| 16 | 3,23 | **3,95×** | 4,00× |

E o sinal fica intacto: média 93,0 → 93,1. A conta limpa, não muda a exposição.

O que o modo **não** faz está escrito na tela, e não só no código: ele não
alinha nada, então celular tremendo borra. "Apoie o celular — este modo não
corrige tremor" é a diferença entre um modo que funciona e um que a pessoa acha
quebrado.

O acumulador é `Float32Array` e não um canvas, por um motivo prático: somar
dezesseis quadros de oito bits num canvas satura tudo acima de 255 no terceiro.


### Comida: um modo que já estava pronto e ninguém tinha visto

Ele é o caso mais barato da lista inteira, e vale registrar por quê: um modo de
comida **é** uma aparência, e a máquina que aplica a mesma string ao visor e à
foto existe desde os Filtros. A curva é a de qualquer celular — mais saturação
para a cor do prato, um empurrão de calor porque luz de restaurante é amarela e
a câmera compensa demais, e contraste para a textura aparecer.

O que o torna um modo, e não mais uma opção da tira, é ele **definir** a
aparência — do mesmo jeito que o SliD define "nenhuma". Pôr a curva na tira
daria ao `Filtros v2` uma oitava opção que o wireframe não tem.

Medido: a foto salva sai com saturação 0,624 contra 0,548 do quadro cru, com o
realce em 100 %.

### O que ainda dá, e o que não dá

Das oito prévias que sobram, duas ainda são viáveis com esforço — **Retrato**
(desfoque por distância do centro, honesto só para busto centralizado) e
**Profissional** (`applyConstraints` com o que o hardware declarar, que no
Android costuma existir e no iOS quase nunca). As outras seis precisam de
coisas que o navegador não dá.
