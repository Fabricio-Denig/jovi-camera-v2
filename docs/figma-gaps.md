# App atual contra o Figma

**Arquivo:** `Challenge-JOVI` · `bHDphaq16EgkBTHGsCRlDl` · página única **Wireframe**

O arquivo tem dois conjuntos de telas. Um mais antigo (`Modo SLID - Home`,
`- Câmera`, `- Capturas da Aula`, `- Resumo da Aula`, `- Galeria Organizada`) e
um conjunto **v2** (`Camera inicial v2`, `Reeconhecimento slid v2`, `Usando slid
v2`, `Resumo v2`, `Galeria v2`, `Modos v2`, `Filtros v2`). O v2 é o que estou
tomando como oficial, pelo nome e pela posição no canvas.

## O que eu li, e o que não li

| tela v2 | node | li? |
|---|---|---|
| Camera inicial | `298:136` | ✅ |
| Reeconhecimento slid | `312:322` | ✅ |
| Usando slid | `321:296` | ✅ |
| Resumo | `339:611` | ✅ **lida em 11/set** |
| Galeria | `339:540` | ✅ **lida em 5/set** |
| Modos | `337:443` | ✅ **lida em 6/set** |
| Filtros | `333:169` | ✅ **lida em 10/set** |

O limite do Starter libera **uma ou duas chamadas por janela**: em 5/set
consegui a Galeria e a chamada seguinte já voltou bloqueada; em 6/set consegui
Modos; Filtros saiu em 10/set. Em 11/set saiu o **Resumo** — e com ele
**todas as sete telas v2 estão lidas**.

Do Resumo eu tenho a estrutura medida (`get_metadata`: todos os nós, com
posição e tamanho) mas **não a captura**: a segunda chamada da janela devolveu
o bloqueio, e o proxy desta máquina recusa `figma.com`, então a imagem da
primeira chamada também não pôde ser baixada. O que está abaixo são medidas
reais, não impressão visual — e onde a medida não diz a cor ou o peso da
fonte, está escrito que não diz.

**Nada abaixo é palpite sobre tela que eu não abri.**

> **Como ler este documento.** As tabelas são registros datados de auditoria e
> **não** são atualizadas quando uma lacuna é fechada — reescrevê-las apagaria
> a razão de cada decisão. O estado atual está nos blocos **"Situação em
> 11/set"**, um depois das telas de câmera/SliD e outro depois da Galeria, com
> o arquivo onde cada item foi implementado. Uma linha marcada "falta" numa
> tabela pode estar feita; o bloco de situação é quem responde.

---

## Câmera — `Camera inicial v2`

*Revisada em 6/set contra captura do app. A tabela original desta seção estava
vencida: barra superior, zoom e tira de filtros entraram em ciclos posteriores
e continuavam marcados como ausentes.*

| elemento no Figma | no app hoje | situação |
|---|---|---|
| ⏱ temporizador · `4:3` proporção, em pílulas no topo | existe | ✅ |
| ⚙ configurações, à direita no topo | existe | ✅ |
| pílula de zoom acima dos filtros | trilho `1x 2x 3x` acima dos filtros | ✅ posição; forma é trilho, não pílula única |
| **tira de filtros** com miniaturas ao vivo sob "Filtros ˅" | existe, com as seis | ✅ |
| miniatura · obturador · **virar câmera** na fileira | **corrigido em 6/set** | ✅ |
| nav `Modos · Câmera · Galeria` | igual | ✅ |
| ⚡ flash, à esquerda no topo | lanterna existe em Ajustes | **falta no topo** |
| ✨ no topo | ausente | **falta** — sem função conhecida |
| abas `Retrato · Foto · Vídeo · SliD· · ⋯` | `Foto · Vídeo · SliD · ⋯` | **falta Retrato** |

## Detecção — `Reeconhecimento slid v2`

| elemento no Figma | no app hoje | lacuna |
|---|---|---|
| pílula no topo: `● Lousa detectada - ativar SliD ✕` | cartão no rodapé com texto de duas linhas + Ativar + ✕ | **forma e posição diferentes** |
| cartão informativo abaixo: "SliD - Captura inteligente das aulas / Captura automaticamente enquanto você assiste. Organiza por matéria. **Saiba mais**" | ausente | **falta** |
| moldura azul **com cantos em colchete** sobre a lousa | moldura de contorno fino, sem cantos | **conflito deliberado, ver abaixo** |

## SliD ativo — `Usando slid v2`

| elemento no Figma | no app hoje | lacuna |
|---|---|---|
| pílula no topo `● SliD 07:23 ✕` | pílula `● Acompanhando a aula 00:08` | próximo; falta o ✕ direto |
| **trilha de miniaturas dos momentos na borda direita** | ausente | **falta, e é a prova visível de que a aula está sendo guardada** |
| pílula de retorno `▣ Enquadre melhor` com botão ✓ | ausente | **falta** |
| moldura com cantos em colchete | contorno fino | conflito, abaixo |

---

## Um conflito que eu não resolvo sozinho

A moldura do Figma tem **cantos em colchete**. O código atual os recusa de
propósito, e o comentário no `ContentFrame.tsx` diz por quê: *"Deliberadamente
não é um scanner: sem cantos, sem linha varrendo, sem grade."* A ideia era que
colchetes de canto são a linguagem de um leitor de documentos, e o SliD passou a
fase anterior justamente por não parecer um scanner.

O Figma é a fonte visual oficial e você pediu fidelidade. Então eu implemento os
colchetes — mas registro que isso desfaz uma decisão que foi tomada com motivo,
para que a escolha seja sua e não um descuido meu.

## O que mais pesa para a banca

Por impacto visível, na ordem:

1. **Tira de filtros na câmera** — é a maior área da tela que existe no Figma e
   não existe no app. Um jurado que abrir a câmera vê a diferença antes de tudo.
2. **Trilha de miniaturas durante o SliD** — é o que mostra a aula sendo
   guardada enquanto acontece, em vez de só no fim.
3. **Barra superior** — flash, temporizador, proporção, configurações.
4. **Pílula de detecção no topo** em vez do cartão no rodapé.
5. **"Enquadre melhor"** — e essa não é só visual: é o retorno que faltava para
   o estudante ajustar o enquadramento em vez de descobrir depois que a aula
   saiu ruim.


---

## Situação em 11/set — as lacunas acima, conferidas no código

As tabelas desta seção são o registro da auditoria de **31/ago**, e ficam como
estão: um documento que se reescreve some com a história da decisão. O que
mudou desde então está aqui, e conferi cada linha no código antes de escrever.

**A lista "o que mais pesa para a banca" está inteira fechada.**

| lacuna de 31/ago | situação | onde |
|---|---|---|
| 1. Tira de filtros na câmera | **feito** (ciclo de 10/set) | `camera/FilterStrip.tsx`, `camera/FiltersSheet.tsx` |
| 2. Trilha de miniaturas durante o SliD | **feito** | `slid/SlidOverlay.tsx`, quatro últimas na borda direita |
| 3. Barra superior (lanterna, temporizador, proporção, ajustes) | **feito** | `camera/TopBar.tsx` |
| 4. Pílula de detecção no topo, não cartão no rodapé | **feito** | `slid/SlidSuggestion.tsx`, ancorada em `top-` |
| 5. "Enquadre melhor" | **feito** | `slid/FramingHint.tsx` |
| Cartão informativo com "Saiba mais" | **feito**, e abre ali mesmo | `slid/SlidSuggestion.tsx` |
| Moldura com cantos em colchete | **feito** | `slid/ContentFrame.tsx` |

Sobre os colchetes, que eram o conflito registrado acima: eles foram
implementados, e o comentário do `ContentFrame.tsx` passou a explicar por que
eles **não** fazem do SliD um scanner — um colchete que assenta e para é
confirmação, não varredura. A decisão que o texto de 31/ago pedia que fosse sua
foi tomada pela fidelidade ao Figma, e o motivo original ficou registrado no
código em vez de ser apagado.

**Duas lacunas continuam abertas, e de propósito:**

- **A aba `Retrato` na tira de modos da câmera.** O modo existe
  (`modes.ts`, `id: "portrait"`) e está no catálogo de Modos, mas fora das
  abas principais. Ele é `fidelity: "simulated"` — desfoque de fundo sem
  segmentação real —, e as abas de cima são o lugar dos modos que fazem o que
  prometem. Fica no catálogo, onde o cartão diz o que ele é.
- **O ✨ no topo.** Continua sem função conhecida, e essa é a razão de não
  existir: `TODO elemento visível deve fazer alguma coisa real`. Um botão de
  brilhos que não faz nada é o oposto disso.

---

## Galeria — `Galeria v2` (`339:540`)

Lida em 5 de setembro. Frame de **412 × 917**. Todas as medidas abaixo saem do
metadata do próprio nó, em pixels do frame — não são estimativas de captura.

### Estrutura da tela

O Figma mostra **uma página que rola, com seções**, e não um corpo que troca
inteiro conforme o chip. De cima para baixo: título · chips · `ÁLBUNS DE AULA`
(grade de 2 colunas) · `RECENTES` + "Ver tudo" (grade de 3 colunas) · rodapé de
contagem · navegação.

| Elemento | Figma | App atual | Diferença | Ação |
|---|---|---|---|---|
| Título "Galeria" | x=25, y=77, 76×27 | `text-2xl` em `px-5 pt-5` | próximo | manter |
| Sino (notificações) | x=360, y=77, 24×24 | não existe | falta ícone à direita do título | avaliar — pode não ter função real |
| Subtítulo | não existe | `<p>` com contagem | **app tem a mais** | avaliar remoção |
| **Chips** | 4: `SliD` · `Todas` · `Favoritos` · `Vídeos` | 6: Fotos · Vídeos · SliD · Favoritos · Todas · Lixeira | conjunto e ordem | ver nota abaixo |
| Chip: altura | 28 px | `min-h-9` = 36 px | 8 px a mais | manter 36 (alvo de toque) |
| Chip: espaçamento | 8 px | `gap-1.5` = 6 px | 2 px | ajustar para 8 |
| Chip: margem esquerda | x=29 | `px-5` = 20 px | 9 px | ajustar para 24 |
| Ponto no chip SliD | ellipse 6×6 em x=84 | não existe | indicador dentro do chip ativo | avaliar |
| **Seção `ÁLBUNS DE AULA`** | rótulo caixa alta, x=25, y=177, 13 px de altura | **não existe** | falta a seção inteira | **implementar** |
| **Cards de aula** | grade 2 col, **175×131**, gap 9 (col) / 28 (linha) | lista vertical, linha com miniatura de 68 px | **estrutura completamente diferente** | **implementar** |
| Card: ícone | vetor 27×23, 15 px do canto sup. esq. | não existe | falta | implementar |
| Card: menu "..." | 21×28, canto sup. dir. | não existe | falta | ver nota abaixo |
| Card: título | y=286 → **59 % da altura do card**, sobre a imagem | fora da imagem, ao lado | sobreposto vs. ao lado | implementar |
| Card: data · contagem | y=310 → 78 % da altura, com ponto de 3 px entre eles | mesma linha, com status e matéria juntos | app mostra mais | manter dados, ajustar forma |
| **Seção `RECENTES`** | rótulo + "Ver tudo" + chevron (x=312/384, y=527) | não existe | falta a seção | **implementar** |
| Grade de recentes | 3 col, altura 102, gap ≈ 19 | `grid-cols-3 gap-1` | próximo | ajustar altura/gap |
| Selo na miniatura | ellipse 12×12 no canto sup. dir. | não existe | falta | avaliar função |
| Rodapé | "120 captura SliD" + "Sincronizado com a galeria do sistema" | não existe | falta | ver nota abaixo |
| Navegação | Modos · Câmera · Galeria — ícones 32×32 em x≈70/190/310, rótulo 12 px em y=887 | existe | conferir medidas | conferir |

### Duas decisões que o Figma não resolve sozinho

**1. Não existe chip "Fotos" no Figma — e ele fica assim mesmo. `[decidido]`**
Os quatro chips do wireframe são SliD, Todas, Favoritos e Vídeos. A regra de
produto é mais forte: a galeria abre em Fotos, e Fotos são só as fotos tiradas
com o dedo — momento automático de aula nunca se mistura.

**Regra geral que sai daqui:** quando o wireframe conflita com uma regra de
produto já validada, a regra funcional prevalece e o visual se adapta. Ordem
final: `Fotos · SliD · Todas · Favoritos · Vídeos`.

**2. O "..." do card não tem comportamento no Figma.** É um nó de texto, sem
estado nem tela de destino. Implementar um menu agora seria inventar produto a
partir de três pontinhos. Fica registrado como pendente, e o card sai sem ele
até haver decisão — um botão que não faz nada é pior que um botão ausente.

**3. "Sincronizado com a galeria do sistema" é uma promessa que o app não
cumpre.** Um app web não escreve no rolo do sistema. A frase não entra: é a
única linha do Figma que, copiada, seria mentira na tela.

### Situação em 11/set

| lacuna de 31/ago | situação | onde |
|---|---|---|
| Seção `ÁLBUNS DE AULA` | **feito** | `GalleryPage.tsx`, rótulo "Álbuns de aula" |
| Cards de aula em grade 2 col, título sobre a imagem | **feito** | `ClassAlbumCard`, `grid-cols-2 gap-x-2 gap-y-4 px-6` |
| Seção de recentes em grade de 3 colunas | **feito** | `GalleryPage.tsx`, "Fotos e vídeos" em `grid-cols-3` |

O rótulo da segunda seção é **"Fotos e vídeos"** e não "Recentes", porque é o
que ela contém: fotos tiradas com o dedo e vídeos, nunca momentos de aula. É a
mesma regra que decidiu o chip "Fotos" logo acima — o nome do Figma descreveria
errado o conteúdo que a regra de produto põe ali.

**Continuam abertos, e cada um por um motivo escrito:** o sino (sem função
conhecida), o menu "..." do card (sem comportamento no Figma), o rodapé
"Sincronizado com a galeria do sistema" (seria mentira), e os ajustes finos de
2–9 px nos chips.

---

## Modos — `Modos v2` (`337:443`)

Lida em 6 de setembro. Frame de **412 × 917**. É um **painel sobre a câmera**,
não uma tela própria: a captura da câmera aparece por baixo até y=632, e o
painel (`Rectangle 39`) cobre de y=64 para baixo, com uma alça de 68 px em
y=85.

### Estrutura

| Elemento | Figma | App atual | Diferença | Ação |
|---|---|---|---|---|
| Forma | painel sobre a câmera, alça de arrastar em y=85 | painel de modos | conferir se é folha com alça | conferir |
| **Busca** | campo 357×31 em x=27, y=112, ícone 18×18, "Busque um modo da câmera..." | **não existe** | falta | avaliar — só vale com muitos modos |
| Título | "Todos os modos" x=27, y=165 | conferir | — | conferir |
| "Fechar" | texto x=338, y=166 | conferir | — | conferir |
| **`SUGERIDOS AGORA`** | rótulo caixa alta x=27, y=192 | não existe | falta a seção | **implementar** |
| Card do SliD | **163×134** em x=27, y=230 — o dobro dos outros | não existe | o SliD tem destaque próprio | **implementar** |
| … ícone | 35×31 em x=43, y=246 | — | — | — |
| … selo "Lousa detectada" | 90×19 em x=43, y=283 | não existe | **o selo é contextual** | ver nota |
| … descrição | "Captura inteligente de aulas com organização por matérias automática." | — | — | — |
| **`FREQUENTES`** | rótulo x=27, y=379 | não existe | falta a seção | **implementar** |
| Cards de modo | **105×113**, 3 colunas, gap ≈ 21, linhas em y=410 e y=536 (gap 13) | conferir | — | **implementar** |
| … conteúdo | ícone 32×32, nome a +46, descrição de 2 linhas a +68 | conferir | — | — |
| … modos | Foto · Vídeo · Retrato · Noturno · Food · `+ Editar` | Foto · Vídeo · SliD + simulados | conjunto diferente | avaliar |
| **`AVANÇADOS`** | rótulo x=27, y=675 | não existe | falta a seção | **implementar** |
| … modos | Pro (com selo `PRO` 50×24) · Time Lapse · Câmera lenta | simulados | — | manter simulado, deixar o estado claro |
| Navegação | igual à Galeria: x≈70/190/310, ícones 32×32, rótulos em y=887 | existe | conferir medidas | conferir |

### O que foi implementado em 6/set

| Elemento | Situação |
|---|---|
| painel sobre a câmera, alça de 68 px | ✅ — a câmera continua visível acima |
| busca "Busque um modo da câmera…" | ✅ — reaproveita a busca por apelido que já existia |
| `SUGERIDOS AGORA` com card grande | ✅ — 161 px contra 110 px dos comuns, medido |
| selo contextual | ✅ — **"Aula detectada"**, ver nota |
| `FREQUENTES` em grade de 3 colunas | ✅ |
| cards 105×113 com ícone, nome e 2 linhas | ✅ |
| `AVANÇADOS` | ✅ |
| seções extras `CRIATIVOS` e `FERRAMENTAS` | o app tem modos que o wireframe não lista; ficam depois de Avançados |
| "Fechar" como texto no topo | app usa ✕ redondo, com fechar por toque no fundo e por Escape |

### Notas

**O card do SliD é o dobro dos outros, e tem selo de estado.** 163×134 contra
105×113, dentro de `SUGERIDOS AGORA`, com o selo "Lousa detectada". Isso não é
hierarquia decorativa: o painel de modos do Figma **reage ao que a câmera está
vendo**. É o mesmo sinal que hoje acende a pílula de sugestão na câmera — dá
para alimentar o selo com ele, sem inventar nada.

**A busca só se justifica com muitos modos.** Com seis, um campo de busca é
mobília. Fica registrada e sai da fila até o conjunto de modos crescer.

**A descrição do card "Food" no wireframe diz "Capture paisagens amplas".** É
descuido do wireframe, não um modo. Não copiar.

**O selo diz "Aula detectada", não "Lousa detectada". `[decidido]`** É o mesmo
sinal que acende a pílula do visor, e ele reconhece lousa, slide projetado,
caderno e folha. Estreitar isso num selo que só fala de lousa contradiz o
produto e a própria pílula.

**A seção de sugestão só existe quando há detecção real.** O wireframe desenha
o SliD sempre em `SUGERIDOS AGORA`. Apontado para uma parede, isso seria uma
recomendação inventada — então sem detecção a seção não aparece e o SliD fica
na lista normal, com o selo de fidelidade. Não há detecção paralela: o painel
lê o mesmo `boardDetected` do visor.


---

## Filtros — `Filtros v2` (`333:169`)

Lida em 10 de setembro. Frame de **412 × 917**. Como a de Modos, é um **painel
sobre a câmera**: a captura aparece por baixo até y=632, o painel cobre de y=64
com alça de 68 px em y=85.

### Estrutura

| Elemento | Figma | App atual | Diferença | Ação |
|---|---|---|---|---|
| Forma | painel sobre a câmera, alça de 68 px | tira horizontal no rodapé da câmera | **forma completamente diferente** | ver nota |
| Título | "Filtros" x=27, y=105 · "Aplicar" à direita x=338 | rótulo "Filtros ⌄" que abre a tira | — | — |
| Subtítulo | "Aplique ao vivo no viewfinder" | não existe | falta | fácil |
| **Cards de filtro** | **84×134**, grade de 4 colunas, gap 8, linhas em y=160 e y=304 (gap 10) | miniaturas menores em fileira rolável | grade × tira | ver nota |
| … miniatura | 80×96 dentro do card, no topo | miniatura ao vivo | ✅ o app já mostra a cena real |
| … nome | y=260 (100 px do topo do card) | existe | ✅ |
| … **sublegenda** | y=276 — "Original", "Tons frios", "Cores fortes", "Clareza para texto", "Tom quente", "Sem cores" | **não existe** | falta | fácil, e vale |
| … selecionado | selo circular de 20 px no canto sup. dir. | borda/realce | conferir | — |
| **Filtros do wireframe** | Nenhum · Vivid · Cinema · **Leitura** · Suave · P&B + "Mais (6 filtros)" | Nenhum · Vivid · Cinema · Suave · P&B · **Quente** | **falta "Leitura"**, sobra "Quente" | ver nota |
| **`INTENSIDADE`** | rótulo x=28, y=462, com "70%" à direita e trilho de x=31 a x=386, botão de 22 px | **não existe** | falta — o app aplica o filtro em intensidade fixa | **maior lacuna funcional** |
| **`PREVIEW AO VIVO`** | comparação partida com divisor arrastável (alça de 30 px) — antes à esquerda, depois à direita | não existe | falta | avaliar |
| **`Filtros favoritos`** | 4 miniaturas de 78×78 com botão circular de 16 px (marcar favorito) e pílulas de rótulo | não existe | falta | avaliar |
| … os quatro | "Suave", "Automático", "Raio de sol", "Tremor" | — | **não são todos filtros** | ver nota |
| Navegação | igual às outras telas | existe | ✅ |

### Notas

**"Leitura — clareza para texto" é o achado da tela.** É um filtro que o
wireframe tem e o app não, e é justamente o que serve para material de estudo —
e para o modo Documento do Scanner. Os dois podem compartilhar a mesma
transformação: alto contraste com branco limpo.

**"Raio de sol" e "Tremor" não são filtros de cor.** São transformações
estilísticas — efeito, na distinção que o produto faz. Ficam registrados como
tal e não entram junto dos filtros de aparência.

**A intensidade é a maior lacuna funcional desta tela.** Hoje cada filtro é uma
string de CSS fixa; o Figma tem um controle contínuo com valor em porcentagem.
Como a pipeline já aplica a mesma string ao visor e à foto, interpolar
intensidade é mexer num lugar só.

**Grade × tira: decisão em aberto.** O wireframe põe os filtros num painel de
página inteira; o app tem uma tira no rodapé com miniaturas ao vivo, que é
mais rápida de usar durante uma captura e já foi validada em teste. A grade é
mais fiel; a tira interrompe menos. Fica registrada para decidir com o Fabricio
antes de trocar algo que funciona.

### Depois do ciclo de 10/set

A decisão sobre grade × tira foi **as duas**, e não uma no lugar da outra: elas
respondem a momentos diferentes. A tira troca de filtro durante a captura, sem
tirar a cena da frente; o painel é onde se ajusta. A porta entre elas é a
última posição da própria tira ("Mais"), que é onde a mão já está.

| Lacuna de 10/set | Estado | Onde |
|---|---|---|
| **Intensidade** — não existia | ✅ contínua, 0–100 %, entra em 70 % | `filters.ts` · `applyFilter(id, intensidade)` |
| … e a foto sai igual ao visor | ✅ provado com a foto medida, não com a string | `qa-filtros.mjs` |
| Filtro **"Leitura"** | ✅ existe, com a sublegenda do wireframe | `filters.ts` |
| **Sublegendas** dos cards | ✅ nos cards do painel | `FiltersSheet.tsx` |
| Subtítulo "Aplique ao vivo…" | ✅ | `FiltersSheet.tsx` |
| **Grade de 4 colunas**, cards com miniatura no topo | ✅ com a cena real, uma amostra para os dois | `FiltersSheet.tsx` · `useFrameSample.ts` |
| **Filtros favoritos** | ✅ com estrela por card e seção própria, em `localStorage` | `useFilterFavorites.ts` |
| "Raio de sol" e "Tremor" no meio dos favoritos | ✅ **corrigido**: são efeitos, e têm seção própria | `filters.ts` · `EffectLayer.tsx` |
| Selo circular de 20 px no card escolhido | ✅ com a estrela de favoritar movida para o canto de baixo, para os dois não dividirem o mesmo canto | `FiltersSheet.tsx` |
| Botão **"Aplicar"** no topo | ➖ **não vai existir** | ver nota |
| **`PREVIEW AO VIVO`** com divisor arrastável | ✅ **11/set** — duas cópias da mesma amostra, uma recortada por `clip-path` | `CompareSlider.tsx` |

**"Aplicar" não vai existir, e isso é uma regra de produto vencendo o
wireframe.** O filtro já é aplicado ao vivo no visor no instante do toque —
é o que a própria tela promete no subtítulo. Um botão "Aplicar" depois disso
só pode significar duas coisas: ou não faz nada, ou o que estava na tela ainda
não valia. As duas são piores que não ter o botão.

**A comparação partida entrou em 11/set, e saiu mais barata do que parecia.**
Não é um segundo canvas: são duas cópias da **mesma** amostra que a tira e os
cards já usam, a de cima recortada por `clip-path`. Nenhuma decodificação a
mais.

Ela justifica a própria existência ao lado da intensidade porque as duas
respondem a perguntas diferentes: a intensidade pergunta "quanto"; a
comparação pergunta "vale a pena?" — e responder isso exige ver as duas
versões **ao mesmo tempo**, não uma depois da outra.

Junto veio uma medida: a amostra subiu de 96×128 para 240×320. No tamanho
antigo ela alimentava miniaturas de 56 px; esticada para os 350 px da
comparação virava um borrão, o que anula o ponto de comparar. Quatro vezes mais
pixels num JPEG a cada dois segundos e meio não mudou nada no desempenho —
medido, o painel aberto passou de 13,4 para 14,2 fps e o arraste da intensidade
de 0,58 para 0,48 ms por passo.

**Com isso, o `Filtros v2` está inteiro** — menos o botão "Aplicar", que não vai
existir por decisão de produto.

### O que custa (medido, `perf-filtros.mjs`)

Chromium de mesa com câmera falsa. **Não é medida de aparelho real.**

| | |
|---|---|
| visor sem filtro | 15,2 fps |
| visor com P&B a 70 % | 15,2 fps |
| com P&B a 100 % + Raio de sol | 15,2 fps |
| com P&B a 100 % + Tremor | 15,2 fps |
| painel aberto, sete miniaturas | 13,4 fps |
| arrastar a intensidade | **0,58 ms por passo**, 60 passos sem perder nenhum |
| filtro na foto (640×480, uma vez) | +4 a 7 ms sobre os 0,2 ms do desenho cru |
| o SliD lendo o quadro 128×96 com filtro ligado | 0,60 ms (pior 1,50 ms) |

Os 15,2 fps são o teto da câmera falsa desta bancada, não um limite do app: o
que a tabela mostra é que **as quatro condições dão o mesmo número**. Filtro de
CSS é composto pela GPU e o efeito é uma camada a mais; nenhum dos dois disputa
a linha principal com a análise da aula. Zero tarefas longas em todas as
condições.

O custo do filtro na foto é real mas acontece **uma vez por disparo**, no
`ctx.filter` de um canvas de 640×480 — não por quadro.

---

## Resumo — `Resumo v2` (`339:611`)

Lida em 11 de setembro, a última das sete telas v2. Frame de **412 × 917**.
Estrutura medida com `get_metadata`; **sem captura** (o limite da janela e o
proxy impediram), então nada aqui fala de cor, peso de fonte ou sombra.

Esta tela corresponde ao **`ClassPage`** do app — a aula reaberta, não o
`SlidSummary` que fecha a sessão. Os dois compartilham conteúdo, mas o Figma
desenha a tela com "Voltar" e navegação inferior, que é a aula guardada.

### Estrutura medida

| Elemento | Figma v2 | App atual | Diferença | Ação |
|---|---|---|---|---|
| **Cabeçalho** | | | | |
| voltar | ícone 13×18 em x=36 y=43 + texto "Voltar" em x=57 y=45 | botão "✕ Fechar aula" de 44×44 à direita | posição e forma opostas | **adotar o Figma** |
| **cartão da aula** | `340×134` em x=36 y=94, com tudo dentro | não existe — cabeçalho é texto solto | estrutural | **adotar o Figma** |
| … miniatura | quadrada `103×103` em x=56 y=109 | **não existe** | falta | **adotar** — dá rosto à aula |
| … título | "Cálculo" em x=171 y=119, 57×19 | editável no lugar do título | ✅ mesma função | manter edição |
| … chip | `71×21` em x=171 y=151, rótulo "Funções" | chip de matéria | ✅ equivalente | — |
| … editar | ícone `pencil` 16×16 em x=334 y=109 (canto sup. dir. do cartão) | edição por toque no título | Figma explicita o gesto | **adotar o lápis** |
| … data | "13/04" em x=171 y=185 | `formatDate(savedAt)` | ✅ | — |
| … duração | "07 min" em x=215 y=185 | `formatClock(durationMs)` + "de aula" | ✅ | — |
| … contagem | "04 capturas" em x=265 y=185 | "N momentos capturados" (título de seção) | Figma põe no cabeçalho | **subir para o cabeçalho** |
| … separadores | duas elipses de 3×3 entre os três | "·" | ✅ equivalente | — |
| … **status** | **não existe** | chip de status ao lado da matéria | decisão de produto | **preservar** |
| … **favorito** | **não existe** | estrela de 44×44 no cabeçalho | decisão de produto | **preservar** |
| **Abas** | três, em y=270: `Imagens` x=51 · `Texto` x=186 · `Resumo IA` x=297 | **não existem** — tudo numa rolagem só | estrutural | **adotar** |
| … trilho | linha de 412 px em y=294 | — | — | — |
| … indicador | linha de 115 px em x=149 y=294 — centrada em 206,5, ou seja **sob "Texto"** | — | o wireframe mostra a aba **Texto** aberta | — |
| **Conteúdo (aba Texto)** | cartão `340×264` em x=37 y=312 | — | — | — |
| … título do trecho | "Função do 2° Grau" em x=56 y=339 | `moment.label`, que já vem do OCR | ✅ mesma ideia | — |
| … fórmulas | três linhas com Δ, radical e barra de fração desenhados | `moment.detail`, uma linha de texto | Figma trata fórmula como bloco | avaliar |
| … **imagem da captura** | `150×133` em x=220 y=333, **dentro do cartão de texto** | miniatura fica na linha do momento | Figma junta texto e imagem | **adotar** |
| … divisor | linha de 301 px em x=57 y=477 | — | — | fácil |
| … marcadores | três bullets de 6×6 com Δ ao lado, y=486/517/546 | — | — | ver nota |
| … texto dos marcadores | "> 0 → duas raízes reais" etc. | — | **interpretação de fórmula** | ver nota |
| **Copiar texto** | botão `340×39` em x=37 y=599, ícone `copy` 24×24 + rótulo | **não existe** | falta | **adotar** |
| **Ações rápidas** | título em x=37 y=655 + três cartões `102×93` em y=689 | rodapé com "Revisar a aula" + lixeira | estrutural | **adotar a grade** |
| … Salvar PDF | x=36, ícone `save` 28×28 em y=711, rótulo em y=752 | não existe | falta | ver nota |
| … Compartilhar | x=156, ícone `share-2` | não existe | falta | avaliar |
| … Adicionar | x=275, componente `Adicionar` | não existe | falta | avaliar |
| … **excluir** | **não existe** | lixeira no rodapé | decisão de produto | **preservar** |
| … **revisar a aula** | **não existe** | botão primário no rodapé | decisão de produto | **preservar** |
| Navegação inferior | Modos x=70 · Câmera x=188 · Galeria x=309, ícones 32×32 em y=855, rótulos em y=887 | igual | ✅ | — |

### Notas

**"Resumo IA" é o nome que não vamos usar como está.** O app não chama nenhum
LLM externo, e não vai fingir que chama. O que produz o resumo hoje é OCR
local (Tesseract WASM servido da própria origem), classificação de estrutura
por forma (`classifyContent`), escolha de título a partir de uma linha que o
professor escreveu (`pickHeading`), e organização dos momentos. É honesto
chamar isso de **"Resumo"** — a linguagem visual do Figma fica, o nome não.
Decisão registrada; a aba se chama **Resumo**.

**Os marcadores interpretados são o achado desta tela, e o mais arriscado.**
"Δ > 0 → duas raízes reais" não está escrito no slide do wireframe: é
conhecimento sobre o assunto. Isso é exatamente o que este produto não faz — a
regra é não inventar conteúdo que não está na captura. O que **dá** para fazer
com o que já temos é o mesmo formato aplicado ao que o OCR leu: quando a
captura traz uma lista, os itens dela viram marcadores; quando traz uma
definição, ela vira um bloco. A forma do Figma serve; a fonte do conteúdo
continua sendo a captura.

**"Salvar PDF" só entra se for real.** Gerar PDF no navegador sem dependência
pesada dá para fazer com `window.print()` e uma folha de impressão — o que sai
é um PDF de verdade, salvo pelo próprio sistema. Se isso não funcionar bem no
celular, **o botão não aparece**, em vez de aparecer e não fazer nada.

**As três abas resolvem um problema real que o app tem.** Hoje o `ClassPage` é
uma rolagem só: visão geral, conteúdo reconhecido, tópicos, e a linha do tempo
dos momentos. Numa aula de doze momentos, o resumo fica doze telas acima da
última captura. Separar em Imagens / Texto / Resumo é o que faz a tela
responder "o que eu preciso revisar" sem rolagem.

**O cabeçalho do Figma responde seis perguntas em 134 px.** Qual aula, de qual
matéria, quando, quanto durou, quantas capturas, e — pela miniatura — como ela
era. O app responde às mesmas menos a miniatura, em texto corrido. O cartão é
melhor, e a miniatura é o que falta.
