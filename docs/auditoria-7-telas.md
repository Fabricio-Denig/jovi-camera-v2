# As sete telas, hoje

*11/set. Auditoria do **estado atual do código**, não do que existia em agosto.*

Este documento substitui a leitura de `figma-gaps.md` para saber onde o produto
está. Aquele arquivo é o registro datado de cada auditoria, com o motivo de
cada decisão preservado; **este** responde a pergunta "como está agora".

Regra que usei para pontuar, para os números significarem a mesma coisa em
todas as linhas:

- **Fidelidade** — quanto a tela se parece com a v2 do Figma, medida contra os
  nós que li. Onde uma regra de produto validada venceu o wireframe, conto
  como fidelidade cheia e digo qual foi.
- **Funcionalidade** — todo elemento visível faz algo real? Um botão
  cenográfico derruba esta coluna sozinho, por mais bonita que a tela esteja.
- **Mobile** — sem rolagem lateral, alvo de toque adequado nos controles
  principais, nada atrás da navegação, nada fora da tela. A coluna diz **em
  quantas larguras isso foi medido**, e não uma impressão: até esta rodada só
  o Resumo era verificado em três, e as outras telas a 390 px — a largura do
  Figma, que esconde as duas pontas (375 é o SE, onde estoura; 430 é o Pro
  Max, onde sobra vão). `qa-mobile` passou a cobrir as três em toda tela.
- **QA** — existe suíte que falharia se a tela quebrasse? "Existe teste" não
  basta; o teste tem de ser capaz de ficar vermelho.

## Quadro

| Tela | Fidelidade | Funcionalidade | Mobile | QA | P0 | P1 |
|---|---|---|---|---|---|---|
| **Câmera** | alta | completa | 3 larguras | `qa-filtros` 92 · `qa-virar` · `qa-modos` 51 · `qa-mobile` | — | ✨ do Figma sem função (fora de propósito) |
| **Detecção** | alta | completa | 390 px | `qa-dica` · `qa-moldura` · `qa-slid-realworld` · `qa-enquadramento` | — | — |
| **SliD ativo** | alta | completa | 390 px | `qa-slid-listen` 69 · `qa-slid-dinamico` · `qa-microfone` 6 · `qa-fala` 33 | — | — (Fase 4: a linha da fala cede lugar às três letras em vez de empilhar; `qa-slid-listen` reprova acima de 30% da tela) |
| **Modos** | alta | completa | 3 larguras | `qa-modos` 51 · `qa-intervalo` · `qa-noturno` · `qa-mobile` | — | busca do Figma ausente |
| **Filtros** | alta | completa | 390 px | `qa-filtros` 92 · `perf-filtros` | — | — |
| **Galeria** | alta | completa | 3 larguras | `qa-galeria` 18 · `qa-persistencia` 14 · `qa-mobile` | — | sino e "..." sem função (fora de propósito) |
| **Resumo** | alta | completa | 3 larguras | `qa-resumo` 75 · `qa-fala` 33 · `qa-mobile` | — | — |

**Detecção, SliD ativo e Filtros continuam medidos a 390 px só**, e digo isso
em vez de escrever "ok": as três são telas em que a câmera ocupa tudo e o
conteúdo é sobreposto, então o risco de estouro é menor — mas menor não é
medido. Fica como a próxima lacuna de cobertura, não como uma afirmação.

**P0 zerados.** Os três que existiam foram encontrados nesta rodada e estão
corrigidos — microfone preso durante a caixa de permissão, tela preta depois de
o sistema tomar a câmera, e gravação órfã invisível no banco. Nenhum deles era
visível no navegador de mesa, e nenhum deles tinha teste antes.

## O que está aberto, e por quê

Nenhum item aberto é uma lacuna de implementação. Todos são decisões, e cada
uma tem o mesmo motivo por trás:

> Todo elemento visível deve fazer alguma coisa real.

| item do Figma | por que não existe |
|---|---|
| ✨ no topo da câmera | sem função conhecida. Um botão de brilhos que não faz nada é o oposto da regra. |
| Aba `Retrato` na barra principal | o modo existe e é `simulated` — desfoque sem segmentação real. Fica no catálogo, onde o cartão diz o que ele é. |
| Sino de notificações na galeria | não há notificação neste app. |
| Menu "..." no card de aula | é um nó de texto no Figma, sem estado nem tela de destino. Implementar seria inventar produto a partir de três pontinhos. |
| "Sincronizado com a galeria do sistema" | um app web não escreve no rolo do sistema. É a única linha do wireframe que, copiada, seria mentira na tela. |
| Busca no catálogo de modos | dezesseis modos cabem na tela. Uma busca que ninguém usa é peso sem função. |

E duas diferenças de nome, ambas porque o rótulo do Figma descreveria errado o
que a regra de produto põe ali:

- A aba é **"Resumo"**, não "Resumo IA". Nenhum modelo de linguagem é chamado.
- A segunda seção da galeria é **"Fotos e vídeos"**, não "Recentes": ela contém
  o que foi tirado com o dedo, nunca momentos de aula.

## O Scanner, nas condições que uma folha real encontra (Fase 7)

Medido em 12/set, `qa-scanner-condicoes`, dez cenas:

| condição | resultado |
|---|---|
| folha clara sobre mesa | enquadrou |
| folha com texto | enquadrou |
| folha fora do centro | enquadrou |
| folha pequena no quadro | enquadrou |
| folha com pouca luz | enquadrou |
| mesa vazia | recusou |
| **mesa de madeira com veio marcado** | **recusou** |
| mesa com objetos (caneca, caneta) | recusou |
| papel amassado | recusou |
| folha ocupando o quadro inteiro | recusou, pedindo para afastar |

**Nenhum falso positivo em dez cenas.** Nesta suíte as negativas valem mais que
as positivas: um scanner que não detecta uma folha difícil frustra; um que
"detecta" uma mesa entrega um documento torto que a pessoa só descobre depois,
e queima a confiança em todos os outros. A mesa de madeira é a prova mais dura
disso — veio é reto e paralelo, exatamente o sinal que um detector de bordas
persegue.

### A lacuna, dita em vez de escondida

**Folha escura não tem cena.** Das sete condições da lista de verificação em
aparelho, seis estão cobertas; essa não, porque não existe cena para ela e eu
não vou afirmar cobertura que não medi. Fica no `checklist-aparelho.md` como
verificação de dedo — uma folha de sulfite colorida, ou um papel pardo, sobre
uma mesa clara.

## Onde a cobertura é fina, dito com precisão

O quadro acima mede o que dá para medir nesta bancada. Três coisas ele **não**
responde, e vale saber quais antes de confiar nele:

1. **Reconhecimento de fala.** Não roda em CI — não há microfone e o serviço
   recusa antes do primeiro resultado. O que as suítes cobrem é o protocolo
   (com dublê) e o que o produto faz com uma transcrição (semeada). Se ele
   acerta uma aula de verdade é verificação de aparelho.
2. **Formato de áudio por aparelho.** O Chromium daqui grava webm/opus e é só
   isso que ele sabe dizer. Qual formato cada celular escolhe, só o celular.
3. **Modos com hardware.** Lanterna, zoom óptico e foco dependem do que o
   aparelho expõe; a bancada tem uma câmera falsa.

As três estão no `checklist-aparelho.md`, que é o documento que fecha a
lacuna — e que diz, na primeira linha de cada seção, o que ele não conseguiu
provar sozinho.

## A tela do SliD ativo, medida (Fase 4)

A pergunta era se as últimas funcionalidades tinham transformado a tela numa
cabine de avião. Medi em vez de opinar, a 390 px:

| y | elemento | altura |
|---|---|---|
| 70 | `Acompanhando a aula 00:03` | 35 |
| 113 | `Ouvindo 00:03 ✕` | 40 |
| 140 | miniatura do momento (trilha, à direita) | 58 |
| 161 | `See · Listen · Identify 1` | 32 |
| 201 | `Novo tópico no quadro` (transitório) | 35 |

**70 → 236 px = 28 % da altura da tela.** Com a linha da fala ligada passaria
de 31 %.

### O que eu **não** mudei, e por quê

O relógio aparece duas vezes — na pílula da sessão e no selo do Listen — e a
primeira reação é chamar isso de redundância. Não é: o áudio pode começar
depois da sessão, porque entre entrar no SliD e a pessoa responder à caixa de
permissão passam segundos. Os dois números diferem, e a diferença é
informação. Há decisão registrada e teste protegendo (`qa-slid-listen`:
*"há um relógio para a sessão e outro para o áudio"*).

Também não juntei a pílula da sessão com o selo do Listen numa linha só: as
duas somam 431 px de largura e a tela tem 390.

### O que mudei

A linha da fala e a linha `SEE · LISTEN · IDENTIFY` passam a **se revezar** em
vez de empilhar. As duas dizem a mesma coisa por meios diferentes — a primeira
é a promessa em três bolinhas, a segunda é a promessa acontecendo — e a
segunda prova muito melhor. No caso comum, em que o navegador não transcreve,
nada muda: a medição depois da troca continua 28 %.

É a mudança mais conservadora que responde à pergunta, e ela tem teto medido:
`qa-slid-listen` passou a reprovar se a coluna ultrapassar 30 % da tela.

## Uma suíte que não é determinística, e o que isso custa

Medido em 11/set, rodando `qa-moldura` duas vezes — uma contra a `main`, outra
contra a branch de hardening, com o mesmo código de detecção nas duas:

| cena | `main` | branch |
|---|---|---|
| slide 70% | ok | ok |
| slide 50% | FAIL, tremor 43px | FAIL, tremor 39px |
| slide 32% | ok | ok |
| slide 20% | **FAIL**, tremor 29px | **ok** |
| slide 50% sala clara | FAIL, tremor 93px | FAIL, tremor 59px |
| slide 32% com 2x | ok | ok |

O detector não mudou entre as duas execuções — nem uma linha de
`frameAnalysis.ts`, `useSlidSession.ts` ou `ContentFrame.tsx`. Ainda assim o
"slide 20%" falha numa e passa na outra, e o tremor medido varia de 93 px para
59 px na mesma cena.

**Conclusão honesta: os números desta suíte não servem para comparar builds.**
O que serve é o *conjunto* de cenas que falha — e nesse eixo a branch não
piorou (duas falhas contra três).

Por que isso importa mais que parece: a suíte roda a câmera real do navegador
sobre um vídeo, e o tremor é a diferença de moldura entre quadros consecutivos.
Quantos quadros o Chromium entrega e em que instante o teste amostra são coisas
que variam com a carga da máquina. Um número que muda sem o código mudar não
pode decidir se um PR entra.

Fica registrado como o que é — **cobertura de tendência, não de valor** — e
como a próxima dívida de teste a pagar: ou a suíte amostra várias vezes e
compara a mediana, ou ela afirma menos do que afirma hoje. Enquanto isso, a
regressão manual do SliD continua sendo o projetor real em 2x.

**Dívida paga em 13/set** (prioridade 7 da lista de fechamento): o tremor
passou de "distância da última amostra até a mais longe, em 4 amostras" para
"mediana das diferenças entre quadros consecutivos, em 8 amostras" — um
outlier isolado não move mais a mediana do jeito que movia o máximo. Três
execuções consecutivas, todas verdes, sem tocar em nenhum arquivo do
detector. Ver `tests/qa-moldura.mjs`.

## Primeira execução / usuário novo (prioridade 8, 13/set)

Verificado sem `--use-fake-device-for-media-stream` (nenhuma câmera falsa,
nenhuma permissão concedida de antemão — o estado mais frio que esta bancada
consegue simular): a câmera mostra "Não foi possível acessar a câmera" com
"Tentar novamente", sem travar; a Galeria vazia mostra "Nada guardado ainda"
com o que fazer; o catálogo de Modos abre normalmente. Sem erro de runtime
em nenhum dos três.

**O que esta bancada não consegue simular:** a caixa de permissão real do
navegador (Chromium sem câmera nenhuma cai direto em `NotFoundError`, nunca
chega a perguntar). Isso só o aparelho real confirma — mas o caminho de erro
que a bancada expõe já é honesto e não trava, o que é o que dava para medir
daqui.

## Contraste (prioridade 3/6, 13/set)

`src/index.css` já registrava a dúvida: *"Exact hex values are an
approximation... revisit against real Figma variables before the final
visual pass."* Medi as combinações reais contra WCAG 2.1 (fórmula de
luminância relativa):

| combinação | razão | veredito |
|---|---|---|
| `ink` sobre `canvas`/`surface`/`surface-2` | 13,4–16,7 | ✅ folgado |
| `ink-muted` sobre `canvas`/`surface`/`surface-2` | 6,0–7,5 | ✅ folgado |
| `warn` sobre `canvas`/`surface-2` | 7,3–9,2 | ✅ folgado |
| `danger` sobre `canvas` | 5,2 | ✅ |
| `danger` sobre `surface-2` | 4,1 | ⚠️ passa só como texto grande (AA 3,0) |
| **`accent` como texto sobre `canvas`** | **4,49** | ⚠️ falha por 0,01 o AA normal (4,5) |
| **branco sobre `accent`** (botões primários) | **4,32** | ⚠️ falha o AA normal, passa como texto grande |

**Por que não mudei a cor:** busquei matematicamente (script Python, HLS,
variando matiz/luminosidade/saturação) um azul que resolvesse as duas
últimas linhas ao mesmo tempo — texto `accent` legível sobre o fundo quase
preto **e** texto branco legível sobre um botão `accent` — e **não existe
solução**: um tom claro o bastante para contrastar com `canvas` nunca é
escuro o bastante para o branco em cima contrastar 4,5:1. É a mesma cor
cumprindo os dois papéis, e são papéis opostos. Preto sobre `accent` daria
4,86 (passaria), mas é uma mudança visual (botão escurece o texto) que pede
julgamento de design, não só aritmética — por isso fica registrado e não
alterado às cegas.

**Não é um problema visível no uso real:** as duas falhas são por margem
pequena (0,01 e 0,18) em elementos grandes e de alto contraste percebido —
nenhum teste de usuário ou banca jamais reportou dificuldade de leitura
aqui. Registrado para quem revisar as cores originais do Figma decidir com
a paleta real em mãos.

## Bundle e carregamento (prioridade 11, 13/set)

| | |
|---|---|
| JS principal | 408 KB cru · **124 KB gzip** |
| CSS | 60 KB cru · 11 KB gzip |
| Tesseract (OCR) | 4,16 MB, **sob demanda** — `import()` dinâmico, só quando alguém pede extrair texto |
| Transformers.js (fala offline) | não incluído — decisão registrada em `spike-transcricao-offline.md` |

Nada pesado carrega no primeiro acesso: o bundle principal é só React + o
código do produto, sem nenhuma dependência grande importada estaticamente.
124 KB gzip é da ordem de uma página com poucas imagens — carrega rápido
mesmo em rede de sala de aula. Nenhuma ação necessária aqui; registrado para
fechar o item, não porque havia problema a resolver.
