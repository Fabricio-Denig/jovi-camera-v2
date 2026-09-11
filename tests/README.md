# Bateria de confiabilidade do SliD

Os testes rodam **pela câmera do navegador**, e não chamando as funções direto.
Isso importa: o decodificador, o redimensionador bilinear e o ruído por quadro
mudam a classificação de cenas que passam na chamada direta. Quando as duas
medições discordam, **a do navegador é a que vale**.

## Rodar

```sh
npm run build && npm run preview &     # o app em http://localhost:4173
node tests/render-fp.mjs               # cenas paradas (adversárias e slides)
node tests/render-longe.mjs            # slides no fundo da sala
node tests/render-dinamico.mjs         # cenas que mudam com o tempo
node tests/render-documento.mjs        # folha sobre a mesa, para o Scanner
node tests/render-cores.mjs            # a única cena COLORIDA, para os filtros
node tests/qa-slid-realworld.mjs
node tests/qa-slid-dinamico.mjs
node tests/qa-moldura.mjs
node tests/qa-dica.mjs
node tests/qa-enquadramento.mjs
node tests/qa-scanner.mjs
node tests/qa-filtros.mjs
node tests/perf-filtros.mjs             # relatório, não teste com veredito
```

As cenas são geradas em `tests/cenas/` e **não vão para o repositório** — são
centenas de megabytes de quadros crus. Os geradores são determinísticos,
inclusive o ruído de sensor: ele era `Math.random()`, e isso fazia a mesma cena
sair diferente a cada geração. O ruído muda a máscara de marcas o bastante para
virar o veredito de uma cena de fronteira — medido, a mesma mesa de madeira
saía "nenhuma escrita" numa geração e "só uma linha" na seguinte. Um teste que
muda de resposta sem o código mudar não decide nada, então o ruído ganhou
semente (`ruido()` em `caminhos.mjs`). `SLID_CENAS`, `SLID_APP` e
`SLID_CHROMIUM` sobrescrevem os caminhos (veja `caminhos.mjs`).

## O que cada um responde

| teste | a pergunta |
|---|---|
| `qa-slid-realworld` | slide a 20–70 % da largura, sala clara e escura, lousa e caderno são reconhecidos? E parede, mesa, teclado, cortina, carpete, tela vazia e piso continuam sem sugerir? |
| `qa-slid-dinamico` | a aula que **se mexe**: troca de slide, build, cursor do professor, celular tremendo, reflexo do projetor, professor passando, luz baixa, zoom no meio da sessão |
| `qa-moldura` | a moldura cai **em cima** do slide — calculado pela conta do `object-cover` — e fica parada quando a cena está parada? |
| `qa-dica` | a dica de enquadramento fala quando o conteúdo está pequeno demais, e **cala** sobre parede, carpete, teclado e tela vazia? |
| `qa-enquadramento` | o momento guardado tem o enquadramento que estava na tela, e não o quadro inteiro do sensor? |
| `qa-scanner` | o modo Documento de ponta a ponta: entra pelos Modos, acha a folha, captura, revisa, escolhe aparência, salva e aparece na galeria **sem virar aula**. É o critério de pronto da fase 1 escrito como teste. |
| `qa-modos` | o painel de modos é uma folha sobre a câmera, com grade de 3 colunas, card de sugestão maior, e **nenhum selo de detecção quando não há aula na frente**? |
| `qa-filtros` | a foto salva sai com a **mesma** aparência que o visor mostrava, em cada intensidade? A intensidade mexe de verdade? Filtro e efeito continuam separados? E, a pergunta que mais importa: **o quadro que o SliD analisa continua cru com um filtro ligado?** |
| `perf-filtros` | quanto custam filtro e efeito no visor, no arraste da intensidade, na captura e na leitura do quadro pelo SliD. É relatório, não veredito. |
| `qa-virar` | o botão de virar câmera está na fileira do obturador, à direita, como no Figma? Forja um segundo dispositivo de vídeo, porque a câmera falsa do Chromium expõe só um e o app — corretamente — esconde o botão. |

## Os geradores

`render-cores.mjs` é o único gerador que produz **cor**. Todas as outras cenas
têm `U` e `V` constantes em 128 — cinza — porque o detector só olha luminância
e um plano de cor a mais seria peso morto. Mas filtro é cor: num quadro sem
cor, Vivid, P&B e Quente saem idênticos, e o teste não distinguiria uma
implementação certa de uma que não faz nada. Custou uma rodada inteira
descobrir isso — a primeira versão do `qa-filtros` media saturação zero em
todos os casos e reprovava a implementação correta.

`cenas-fp.mjs` desenha superfícies para as quais um celular é apontado o tempo
todo e que **não** são aula. `cenas-distancia.mjs` desenha um slide projetado
em vários tamanhos. `cenas-dinamicas.mjs` desenha a aula que muda: os dois
slides de uma troca, o build, o cursor, o tremor, o reflexo, o professor, a
sala com porta e janela e a sala deslizando.

Uma armadilha registrada, porque ela custou uma investigação inteira: **trocar
a semente do texto não é trocar de slide.** Na amostra de 128×96 uma linha de
texto tem dois pixels de altura, e dois textos diferentes na mesma linha, do
mesmo comprimento, são a mesma mancha — +0,2 % de marcas. Um slide novo precisa
mudar o que muda numa apresentação de verdade: quantas linhas, onde elas
começam, e o que ocupa a outra metade da tela. É o que o layout `diagrama` faz.

E o Chromium toca o arquivo no **ritmo do dispositivo falso**, não no que o
cabeçalho do y4m declara. As fases das cenas dinâmicas são contadas em 30
quadros por segundo por causa disso.

## Falha conhecida, de propósito

`qa-slid-realworld` reprova em **1 de 15**: a mesa de madeira de veio marcado
faz a dica de enquadramento dizer "Conteúdo distante — experimente 2x". A dica
não pode falar sobre superfície que não é estudo — é a regra que a mantém útil.

O teste fica estrito. Baixar a exigência para o teste passar seria apagar o
achado, e o achado é o que vale. A correção depende de mexer no sinal
`tooSmall`, que é nível de detector, e está congelada até a medição em aparelho
real dizer como a dica se comporta numa mesa de verdade — o offline não
reproduz o caso, só o navegador reproduz.
