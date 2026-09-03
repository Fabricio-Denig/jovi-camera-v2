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
| Galeria | `339:540` | ❌ limite do plano |
| Modos | `337:443` | ❌ limite do plano |
| Filtros | `333:169` | ❌ limite do plano |

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
