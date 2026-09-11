# Spike: transcrição sem depender do navegador

*11/set. Pergunta: vale embutir um modelo de reconhecimento de fala no app,
para as aulas em que a `SpeechRecognition` do navegador não existe ou não
funciona?*

**Resposta: não neste ciclo, e a decisão está medida abaixo.** Não é "não deu
tempo" — é que os números que consegui medir já derrubam a ideia para o caso
que ela deveria resolver.

## Por que a pergunta existe

Metade do valor do Listen depende de uma API que, medido aqui, é uma loteria:

```
Chromium desta bancada:
  typeof SpeechRecognition  → "function"
  eventos de uma sessão     → start, error:audio-capture, end
```

Firefox não a implementa. Safari implementa com limites próprios. Chrome
implementa mandando áudio para um serviço do Google. Um modelo rodando no
aparelho resolveria os três problemas de uma vez — cobertura, privacidade e
previsibilidade.

## O que foi medido

Baixei `@xenova/transformers@2.17.2` (Transformers.js) e medi o que ele
realmente entrega:

| peça | cru | gzip |
|---|---|---|
| `transformers.min.js` | 0,86 MB | **199 KB** |
| `ort-wasm-simd.wasm` (ONNX Runtime) | 9,55 MB | **2,74 MB** |
| `ort-wasm-simd-threaded.wasm` | 9,50 MB | — |

O runtime sozinho, no caminho SIMD, é **~2,9 MB comprimidos**, antes de
qualquer modelo.

**O modelo eu não consegui medir**, e é honesto dizer por quê: `huggingface.co`
é inalcançável desta máquina (a saída de rede recusa o CONNECT). Então não vou
citar o peso do `whisper-tiny` de memória num documento que existe para
sustentar uma decisão. O que dá para afirmar com número é o runtime, e o
runtime já é o problema.

### O termo de comparação que o projeto já tem

O SliD já carrega um WASM pesado sob demanda: o OCR.

| | o que o aparelho baixa |
|---|---|
| OCR atual (Tesseract SIMD + português compacto + worker) | **4,16 MB** |
| runtime do Transformers.js, sem modelo | ~2,9 MB gzip |
| runtime **+** modelo de fala | não medido — e maior, em qualquer hipótese |

Ou seja: só o runtime já é da ordem do que hoje é a peça mais pesada do
produto inteiro. Com modelo, passa dela.

## Por que isso decide a questão

O requisito era explícito: **nada de centenas de megabytes no carregamento
inicial; só sob demanda, quando a pessoa tocar em "Transcrever áudio", com
progresso.** Carregar sob demanda resolve o carregamento inicial e não resolve
o que interessa:

1. **O momento errado.** Sob demanda significa *depois* da aula. Mas a linha
   de fala durante o SliD, o selo "Ouvindo · Transcrevendo", a legenda de cada
   momento — tudo isso é em tempo real. Um modelo carregado depois não devolve
   nada disso; devolve um botão que processa um arquivo.
2. **O aparelho errado.** Quem apoia o celular numa aula de quarenta minutos
   tem o celular ocupando memória com a câmera, o `MediaRecorder`, o laço de
   análise e as miniaturas. Enfiar um runtime de ONNX e um modelo em cima
   disso, num Android mediano, é o caminho mais curto para a aba ser morta pelo
   sistema — e perder a aula, que é a pior falha possível deste app.
3. **A rede errada.** O OCR já teve de ser copiado para `public/` porque o CDN
   é inalcançável em redes restritas, e uma demonstração que depende do wi-fi
   do local para chegar ao clímax falha no palco. Um segundo download pesado
   herda esse problema inteiro.

E o mais importante: **o produto não fica sem resposta sem isso.** Onde o
reconhecimento não existe, o SliD grava o áudio, marca os momentos, lê o
quadro e salva a aula. A transcrição é uma camada a mais, não o alicerce.

> "Não adicione só para poder dizer que existe."

Um botão "Transcrever áudio" que baixa megabytes, ocupa memória e entrega
resultado pior que o reconhecimento do navegador quando ele funciona seria
exatamente isso.

## O que faria a resposta mudar

Não é um "não" permanente. Volto a medir se:

- der para medir o modelo de verdade (com acesso à rede que o hospeda), e o
  `whisper-tiny` quantizado couber em algo comparável ao OCR atual;
- WebGPU estiver disponível no aparelho alvo — sem ela, o custo de CPU numa
  aula de quarenta minutos precisa ser medido antes de qualquer promessa;
- aparecer um caso real, de um estudante de verdade, em que o navegador não
  transcreve e a aula depende disso. Hoje esse caso é hipotético; o caso real
  que temos é o oposto — quadro ilegível **com** fala reconhecível.

## O que fica registrado

- O runtime medido: 199 KB (js) + 2,74 MB (wasm SIMD), gzip.
- O modelo: **não medido aqui**, por rede bloqueada. Qualquer decisão futura
  precisa medir.
- A alternativa escolhida para este ciclo: usar bem a fala **quando** o
  navegador a entrega, e degradar honestamente quando não entrega.
