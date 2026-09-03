# Jovi Camera V2 · SliD

Protótipo funcional da nova experiência da câmera Jovi — mobile-first, sem
backend, aberto no navegador do próprio celular.

**A tese, numa frase:** o estudante apoia o celular e continua prestando atenção
enquanto o SliD entende e organiza a aula.

O SliD (*See, Listen and Identify*) não é um scanner e não é um app à parte. É um
modo da câmera que acompanha uma aula inteira, decide sozinho quais momentos
merecem ser guardados, e no fim entrega a aula em ordem, com o que reconheceu.

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
| **Filtros** | seis, no visor e na foto salva |
| **Leitura do conteúdo** | OCR local (Tesseract WASM), servido do próprio domínio |
| **Resumo da aula** | frase montada só do que foi capturado e lido |
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

- **Áudio e voz** — o "Listen" do nome. Avaliado, não entregue: a Web Speech API
  envia áudio para a nuvem e é instável no Safari, e entregar isso pela metade
  valia menos que não entregar.
- **Modo Scanner/documento** com exportação em PDF.
- **Instalar como aplicativo** (PWA) e uso offline.
- **Sete modos do catálogo** (Retrato, Noite, Comida, Microfilme, Câmera Lenta,
  Timelapse) são maquetes navegáveis, marcadas como simulação na própria tela.

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

---

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · APIs Web nativas
(`getUserMedia`, `MediaRecorder`, Canvas, IndexedDB) · Tesseract.js WASM.

Sem backend, sem login, sem API externa. Tudo roda e persiste no dispositivo.

## Executar

```bash
npm install
npm run dev     # o endereço da rede local abre no celular
npm run build   # typecheck + build de produção
```

Publicação automática no GitHub Pages a cada merge em `main`.

## Documentação

- [`docs/auditoria-slid.md`](docs/auditoria-slid.md) — por que o SliD falhava em
  projetor real, com números, e o que mudou.
- [`docs/figma-gaps.md`](docs/figma-gaps.md) — o app contra o Figma, tela a tela.
