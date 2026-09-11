# A fala da aula, e o que o SliD faz com ela

*11/set — o ciclo que veio depois do teste no celular.*

## O problema, como ele apareceu

O teste no aparelho provou que o Listen funciona: a tela diz "Ouvindo", o
relógio anda, o arquivo é gravado, um por aula, e "ouvir deste ponto" cai no
lugar certo. Também mostrou o limite disso. O quadro daquela aula deu OCR
insuficiente, o Resumo saiu genérico — e havia áudio o tempo todo.

Ou seja: o SliD escutava quarenta minutos de aula e não usava nada do que
ouviu. O arquivo era um anexo, não conteúdo.

> Hoje o vídeo prova: **SliD escuta**.
> O próximo checkpoint precisa provar: **SliD entende o que escutou** e usa
> isso para organizar a aula.

## A medição que definiu o desenho

Antes de escrever qualquer coisa, rodei o reconhecimento de fala no Chromium
da bancada. O resultado:

```
{ SpeechRecognition: 'function', webkitSpeechRecognition: 'function' }
{ existe: true, eventos: [ 'start', 'error:audio-capture', 'end' ] }
```

A API é declarada. O objeto constrói. `start()` funciona. E um instante depois
vem `audio-capture` e a sessão morre.

Isso invalida o desenho óbvio. **Detecção de recurso não prova nada aqui**: um
app que mostrasse "Transcrevendo" porque `typeof SpeechRecognition ===
"function"` mostraria a palavra nesta bancada e nunca transcreveria uma
sílaba. Então a regra do gancho é outra:

> **Capacidade é evidência, não declaração.** O estado só vira `transcrevendo`
> depois que um resultado chega.

É uma linha de código e é a decisão mais importante do ciclo.

## As duas camadas, e por que são duas

| | `MediaRecorder` | `SpeechRecognition` |
|---|---|---|
| produz | o arquivo de áudio | o texto do que foi dito |
| onde roda | no aparelho, sem rede | serviço do navegador |
| sobrevive a | qualquer navegador | quase nenhum, com sorte |
| se falhar | a aula perde o áudio | a aula perde o texto |

Uma não substitui a outra. O arquivo é a prova e o que sempre existe; o texto é
o que deixa a aula ser lida, procurada e resumida. As duas nascem do mesmo
microfone e morrem juntas quando a pessoa desliga o áudio.

## O que é feito com o texto — e o que não é

Tudo determinístico, tudo no aparelho, **nada de modelo de linguagem**:

- **Marcadores de ênfase.** Uma lista curta de expressões com que se avisa que
  algo importa — "isso cai na prova", "prestem atenção", "anotem",
  "resumindo". Não são palavras de assunto: funcionam em Direito e em Cálculo
  igual, porque é assim que um professor fala quando quer que alguém anote.
- **Contagem de termos.** Palavras vazias fora, três letras ou mais, duas
  ocorrências ou mais. É o que separa "useState" de "então".
- **Janela temporal fala↔momento.** Doze segundos para trás, vinte para a
  frente. Assimétrica porque quem explica um slide começa a falar dele antes
  de ele estar pronto na tela.
- **Ranking extrativo de frases.** Termos recorrentes, proximidade de um
  momento guardado, marcação de ênfase. Escolhe entre frases que existem.

A regra que governa o arquivo inteiro: **nada é inventado**. Um destaque só
existe se a frase foi dita; um tópico só existe se a palavra foi dita; um
título só troca o genérico se houver texto que o sustente. Se a fala disser só
"isso aqui é importante" sem dizer o quê, o resumo mostra a frase como foi dita
e não descobre o assunto.

E o nome disso continua sendo o que é. A aba é **"Resumo"**, não "Resumo IA":
OCR local, reconhecimento de fala do navegador e heurística de texto. A
primeira pergunta de uma banca sobre um rótulo de IA é "qual modelo?", e a
resposta honesta é "nenhum".

## Privacidade, dita com precisão

Duas coisas, e juntá-las seria mentir:

- **O arquivo de áudio** é gravado pelo app e guardado no IndexedDB deste
  aparelho. Nenhuma rede.
- **A transcrição** é feita pelo reconhecimento de voz do navegador. No Chrome,
  isso significa áudio indo para um serviço do Google. O app não escolhe e não
  tem como impedir.

Por isso a tela nunca diz "transcrição local". Diz o que é: *"A transcrição é
feita pelo reconhecimento de voz do navegador; o que ele faz com o som é
decisão dele."*

## A intenção do usuário vence

O navegador encerra o turno de reconhecimento sozinho — por silêncio, por
tempo, por decisão própria. Religar é o que mantém a transcrição viva numa aula
de quarenta minutos. Mas o religamento é exatamente o mecanismo que traria de
volta algo que a pessoa desligou, que é um defeito que este projeto já teve uma
vez (o microfone voltava sozinho ao trocar de câmera).

Duas travas: `queridoRef` governa todo religamento e só é ligado por gesto
explícito; e seis religamentos sem nenhum resultado desistem, em vez de um laço
queimando bateria. O teste `qa-slid-listen` cobre os dois lados — que religa
quando o navegador encerra, e que **não** religa quando a pessoa desliga.

## Como isto é testado, já que não dá para testar

O reconhecimento real não roda em CI: não há microfone e o serviço recusa.
Então a cobertura é em três camadas, e cada uma diz o que cobre:

1. **A API real, como ela é aqui.** O bloco "API declarada que não funciona"
   roda contra o Chromium de verdade e verifica o que mais importa: que o SliD
   grava, marca momentos e **não** promete transcrição.
2. **O protocolo, com dublê.** Um `SpeechRecognition` falso que emite parcial,
   final e o fim do turno. Não simula o acerto do reconhecimento — simula o
   ciclo que a Web Speech executa numa aula longa.
3. **O produto, com transcrição semeada.** `qa-fala` escreve uma transcrição
   determinística no mesmo armazém em que o app a grava, e verifica tudo o que
   vem depois: abas, horários clicáveis, destaques, resumo, persistência.

O que sobra — se o reconhecimento acerta uma aula de verdade, em qual
navegador, com qual qualidade — é verificação de aparelho, e está na seção I do
`checklist-aparelho.md`.
