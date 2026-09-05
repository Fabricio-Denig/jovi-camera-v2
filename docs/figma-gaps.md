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
| Resumo | `339:611` | ❌ limite do plano |
| Galeria | `339:540` | ✅ **lida em 5/set** |
| Modos | `337:443` | ❌ limite do plano |
| Filtros | `333:169` | ❌ limite do plano |

O limite do Starter libera **uma chamada por janela**: em 5/set consegui a
Galeria e a chamada seguinte já voltou bloqueada. As três restantes continuam
na fila, uma por vez.

O MCP do Figma corta as chamadas no plano Starter. As quatro que faltam ficam
para a próxima janela. **Nada abaixo é palpite sobre tela que eu não abri.**

---

## Câmera — `Camera inicial v2`

| elemento no Figma | no app hoje | lacuna |
|---|---|---|
| ⚡ flash, à esquerda no topo | ausente | **falta** |
| ⏱ temporizador · `4:3` proporção · ✨, em pílulas no topo | ausente | **falta** |
| ⚙ configurações, à direita no topo | ausente | **falta** |
| pílula de zoom `1x` única, centralizada acima dos filtros | trilho `1x 2x 3x` no rodapé | **posição e forma diferentes** |
| **tira de filtros** com miniaturas ao vivo — Nenhum, Vivid, Cinema, Suave, P&B, Quente — sob o rótulo "Filtros ˅" | ausente | **falta, e é o elemento mais visível da tela** |
| abas `Retrato · Foto · Vídeo · SliD· · ⋯` | `Foto · Vídeo · SliD · ⋯` | falta Retrato na fileira |
| miniatura · obturador · **botão de virar câmera** na fileira | miniatura · obturador · vazio | virar câmera está no topo |
| nav `Modos · Câmera · Galeria` | igual | ✅ |

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

**1. Não existe chip "Fotos" no Figma.** Os quatro chips são SliD, Todas,
Favoritos e Vídeos. Mas a regra de produto é explícita: a galeria abre em Fotos,
e Fotos são só as fotos tiradas com o dedo — momento automático de aula nunca se
mistura. As duas coisas não cabem juntas sem escolha. A leitura que respeita as
duas: manter **Fotos** (regra de produto) e usar a ordem relativa do Figma para
o resto → `Fotos · SliD · Todas · Favoritos · Vídeos`. **Fica marcado como
decisão em aberto.**

**2. O "..." do card não tem comportamento no Figma.** É um nó de texto, sem
estado nem tela de destino. Implementar um menu agora seria inventar produto a
partir de três pontinhos. Fica registrado como pendente, e o card sai sem ele
até haver decisão — um botão que não faz nada é pior que um botão ausente.

**3. "Sincronizado com a galeria do sistema" é uma promessa que o app não
cumpre.** Um app web não escreve no rolo do sistema. A frase não entra: é a
única linha do Figma que, copiada, seria mentira na tela.
