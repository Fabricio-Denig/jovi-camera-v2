# Jovi Camera V2 · SliD

Protótipo funcional da nova experiência da câmera Jovi — mobile-first, sem
backend, aberto no navegador do próprio celular.

**A tese, numa frase:** o estudante apoia o celular e continua prestando atenção
enquanto o SliD entende e organiza a aula.

O SliD (*See, Listen and Identify*) não é um scanner e não é um app à parte. É um
modo da câmera que acompanha uma aula inteira: **vê** o que está no quadro,
**ouve** o que está sendo dito, e **identifica** quais momentos merecem ser
guardados. No fim entrega a aula em ordem, com o que reconheceu — e com o áudio
ligado a cada momento.

**Publicado:** https://fabricio-denig.github.io/jovi-camera-v2/

---

## Como testar em 2 minutos

1. Abra o endereço no celular. Conceda acesso à câmera.
2. Aponte para um **slide, projetor, lousa ou caderno escrito**. Em ~4 segundos
   aparece **"Aula detectada · ativar SliD"** no topo, com uma moldura sobre o
   conteúdo.
3. Toque na pílula. Apoie o celular e assista.
4. Conforme o quadro muda, as miniaturas se empilham à direita — cada uma é um
   momento que a câmera decidiu guardar.
5. Toque na tela → **Encerrar** → a aula abre em **Resumo**.
6. Marque **como ficou a aula para você** e a **matéria**, e salve.
7. **Galeria → SliD** → a aula está lá, com status, matéria, duração e resumo.
8. Dentro da aula: **Imagens** mostra os momentos, **Texto** mostra o que a
   câmera leu, **Resumo** condensa a aula. Se o microfone foi autorizado, há um
   player — e **"Ouvir"** ao lado de cada momento salta o áudio para aquele
   instante.

Para ver o que ele **recusa**: aponte para parede, mesa, carpete, teclado ou
cortina. Nenhum deles pode dizer "Aula detectada".

---

## O que é real, o que é parcial, o que é futuro

Esta seção existe porque um protótipo que não distingue essas três coisas é um
protótipo em que não se pode confiar.

### Real — funciona de verdade, no navegador do celular

| | |
|---|---|
| **Câmera** | `getUserMedia`, foto e vídeo, traseira e frontal |
| **Detecção de aula** | análise própria de cada quadro, 100 % no dispositivo |
| **Captura automática** | decide sozinho o que é momento novo e o que é o mesmo tópico crescendo |
| **Zoom 1x/2x/3x** | do hardware quando o aparelho expõe, recorte digital quando não |
| **Temporizador** | 3 s e 10 s, com contagem na tela |
| **Proporção** | 4:3, 16:9 e 1:1 — a foto sai realmente naquela proporção |
| **Filtros** | sete, com intensidade contínua — a mesma aparência no visor **e** na foto salva |
| **Efeitos** | Raio de sol e Tremor, separados dos filtros porque não são a mesma coisa |
| **Leitura do conteúdo** | OCR local (Tesseract WASM), servido do próprio domínio |
| **Listen** | grava o áudio da aula com `MediaRecorder`, no aparelho, com indicador na tela |
| **Áudio na aula guardada** | player, e "ouvir deste ponto" em cada momento |
| **Resumo da aula** | três abas — Imagens, Texto, Resumo — montadas só do que foi capturado e lido |
| **Scanner / Documento** | detecta a folha, recorta, trata e extrai o texto sob demanda |
| **Intervalo (time-lapse)** | um quadro a cada N segundos, montado em vídeo real |
| **Noite** | média de N quadros — corta o ruído por √N, medido |
| **Copiar, compartilhar, PDF** | cada um só aparece onde o navegador realmente oferece |
| **Status e matéria** | escolhidos ao salvar, trocáveis depois, filtráveis |
| **Galeria** | fotos, vídeos, favoritos, aulas, lixeira com restaurar |
| **Persistência** | IndexedDB, sobrevive a fechar o navegador |

### Parcial — funciona, com limite conhecido

- **Lanterna** — é `torch`, não flash sincronizado com o obturador: a web não
  tem isso. E ela só aparece onde o navegador a expõe, que na prática é o
  Chrome no Android. No Safari o botão não aparece, de propósito.
- **Zoom nativo** — o Safari não expõe zoom de hardware. Lá o recorte digital
  assume, e ele chega ao visor, à foto **e** à análise.
- **Aula muito distante em sala clara** — um slide pequeno competindo com a luz
  do dia ainda pode não ser detectado em 1x. O zoom resolve.
- **OCR** — falha com frequência em letra cursiva e em foto tremida. Quando
  falha, o resumo diz que falhou em vez de inventar.

### Futuro — desenhado, não implementado

- **Transcrição da fala.** O Listen grava o áudio; transformá-lo em texto é
  outra coisa. A Web Speech API envia áudio para servidores do navegador e é
  instável no Safari — e o produto não vai dizer "processamento local" sobre
  algo que sai do aparelho. Fica de fora até dar para fazer honestamente.
- **Instalar como aplicativo** (PWA) e uso offline.
- **Oito modos do catálogo** — Retrato, Microfilme, Câmera lenta, Panorâmica,
  Profissional, Alta resolução, Superlua e Visualização dupla — são maquetes
  navegáveis,
  marcadas como **Prévia** na própria tela, com um cartão explicando o que
  fariam. Dois deles (**câmera lenta** e **superlua**) estão registrados como
  impossíveis no navegador, e não como pendências.

---

## Como o SliD decide

Duas perguntas, nesta ordem, a cada 1,2 segundo:

**1. Isto é uma aula?** Não por brilho nem por contraste — medimos, e uma
persiana tem mais contraste que um slide projetado. O que separa material de
estudo de uma parede é *escrita*: linhas com superfície limpa entre elas, feitas
de traços finos e não de barras.

**2. O conteúdo mudou?** E de que jeito. Conteúdo que *cresce* refina o momento
que já existe; conteúdo que é *substituído* cria um momento novo. É por isso que
um slide com bullets aparecendo vira um momento, e não seis.

Duas decisões de projeto que sustentam o resto:

- **A sugestão é mais exigente que a captura.** Oferecer uma aula é algo que o
  app faz sem ninguém ter pedido, então ele exige evidência maior. Dentro de uma
  sessão que o estudante escolheu começar, o critério afrouxa.
- **A câmera lê em várias escalas.** Uma linha de texto precisa de 3 % da altura
  do quadro para ser vista; um slide atravessado numa sala não tem isso. O mesmo
  classificador roda sobre janelas concêntricas e a vista aberta tem a última
  palavra — porque ampliar qualquer textura repetida acaba fazendo dela linhas.

Detalhes e medições em [`docs/auditoria-slid.md`](docs/auditoria-slid.md).

---

## O que este app nunca faz

- **Não inventa conteúdo.** Nenhuma frase do resumo descreve algo que não foi
  lido. Quando a leitura falha, ele diz isso.
- **Não mostra OCR como ferramenta.** Nem o nome, nem confiança em número, nem
  texto cru rotulado como extraído. O estudante vê uma aula, não um pipeline.
- **Não adivinha matéria nem status.** Os dois só existem se alguém disser.
- **Não aplica filtro sobre uma aula.** Material de estudo não carrega escolha
  estética.
- **Não apaga aula ao apagar matéria.** As aulas ficam sem matéria.
- **Não grava áudio escondido.** Não existe caminho no código que ligue o
  gravador sem o indicador aparecer, e a tela diz "Áudio desativado" quando não
  está gravando — ausência de gravação é informação, não silêncio.
- **Não promete IA que não existe.** A aba do resumo se chama "Resumo", e não
  "Resumo IA" como o wireframe sugere: nenhum modelo de linguagem é chamado. O
  que monta o resumo é OCR local, classificação de estrutura pela forma da
  linha, e títulos que o professor escreveu.
- **Não explica a matéria.** O wireframe desenha marcadores do tipo
  "Δ > 0 → duas raízes reais"; nenhum deles está escrito no slide desenhado.
  Isso é conhecimento sobre o assunto, não leitura da captura — e não entra.
- **Não desenha botão que não faz nada.** Compartilhar some onde não há
  `navigator.share`; Salvar PDF some onde não há `window.print`.

---

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · APIs Web nativas
(`getUserMedia`, `MediaRecorder`, `canvas.captureStream`, Canvas, IndexedDB,
Clipboard, Web Share) · Tesseract.js WASM servido da própria origem.

Sem backend, sem login, sem API externa. Tudo roda e persiste no dispositivo.

## Executar

```bash
npm install
npm run dev     # o endereço da rede local abre no celular
npm run build   # typecheck + build de produção
```

```bash
npm run build && npm run preview &   # o app em http://localhost:4173
node tests/render-fp.mjs             # as cenas (não vão para o repositório)
node tests/qa-demo-banca.mjs         # a jornada inteira, na ordem da apresentação
```

Publicação automática no GitHub Pages a cada merge em `main`.

## Como saber que funciona

A bateria roda **pela câmera do navegador**, não chamando funções: cada teste
abre o app num Chromium com um vídeo `.y4m` gerado no lugar da câmera. Quando a
chamada direta e o navegador discordam, **o navegador é o que vale** — o
decodificador, o redimensionador e o ruído por quadro mudam a classificação de
cenas de fronteira.

A suíte que mais importa é [`qa-demo-banca`](tests/qa-demo-banca.mjs): ela
percorre a jornada inteira três vezes — com áudio, sem microfone, e pelo
Scanner — em 38 passos. Os outros testes provam que cada peça funciona; este
prova que elas se encaixam.

## Documentação

- [`docs/auditoria-slid.md`](docs/auditoria-slid.md) — por que o SliD falhava em
  projetor real, com números, e o que mudou.
- [`docs/figma-gaps.md`](docs/figma-gaps.md) — o app contra o Figma, tela a tela.
- [`docs/matriz-telas.md`](docs/matriz-telas.md) — as sete telas v2 com
  fidelidade, funcionalidade, mobile e QA, e os gaps classificados P0/P1/P2.
- [`docs/modos-viabilidade.md`](docs/modos-viabilidade.md) — que modos podem
  virar reais, quais já viraram, e quais **não podem** no navegador.
- [`docs/checklist-aparelho.md`](docs/checklist-aparelho.md) — o que só um
  celular de verdade pode responder.
- [`tests/README.md`](tests/README.md) — a bateria de confiabilidade: onze
  suítes que rodam **pela câmera do navegador**, com cenas de vídeo geradas.
