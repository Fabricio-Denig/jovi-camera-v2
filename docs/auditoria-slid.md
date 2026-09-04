# Auditoria do SliD — por que ele falha no projetor real

*Medido em 27 de agosto, antes de qualquer correção desta fase.*

## O relato

Em teste de celular o SliD "às vezes não identifica o projetor", "às vezes não
entende que há slide" e "às vezes não marca momentos que deveria". As suítes
sintéticas estavam todas verdes, o que significa que elas não cobriam o caso.

## A hipótese

O classificador trabalha sobre uma amostra de 128×96 do **quadro inteiro**. Uma
linha de texto precisa de pelo menos 3 dessas 96 fileiras para formar uma faixa
(`MIN_BAND = 3`), ou seja **3,1 % da altura do quadro**. Um slide projetado
visto do meio de uma sala ocupa talvez 30 % da largura; suas seis linhas de
texto ficam com menos de 1 % da altura do quadro cada. Nenhuma faixa se forma, e
o classificador responde honestamente que não há escrita — porque, na resolução
em que ele olha, não há mesmo.

## A medição

O mesmo slide — título e cinco bullets — em tamanhos diferentes dentro do
quadro, com ruído de sensor e desfoque de lente:

| slide ocupa | linhas | faixas | densidade | traços finos | captura | sugere |
|---|---|---|---|---|---|---|
| 95 % da largura | 58 | **1** | 16.3 | 0.69 | SIM | **não** |
| 70 % da largura | 27 | 6 | 16.9 | 0.79 | SIM | SIM |
| 50 % da largura | 4 | 1 | 11.5 | 0.59 | SIM | **não** |
| 35 % da largura | 18 | 1 | 6.1 | 0.24 | SIM | **não** |
| 25 % da largura | 3 | 1 | 5.7 | 0.53 | **não** | **não** |
| 18 % da largura | 3 | 1 | 5.3 | 0.38 | **não** | **não** |

**Só uma faixa estreita de escala funciona.** Longe demais, as linhas somem;
perto demais, elas se fundem numa faixa só e `SUGGEST_MIN_LINES = 2` reprova.
O classificador não está errado sobre o que vê — ele está olhando na escala
errada.

Contraste, com o slide em 50 % da largura:

| contraste do projetor | linhas | densidade | captura |
|---|---|---|---|
| 100 % | 4 | 11.5 | SIM |
| 75 % | 4 | 10.8 | SIM |
| 50 % | 5 | 6.2 | SIM |
| **35 %** (sala clara) | **0** | 0.0 | **não** |

`MARK_DELTA = 22` sobre 255 é muito para um projetor competindo com a luz da
sala.

## O que já ajuda: o zoom

O mesmo slide em 25 % da largura, com o recorte que o controle de zoom aplica:

| zoom | linhas | faixas | densidade | sugere |
|---|---|---|---|---|
| 1x | 3 | 1 | 5.7 | não |
| **2x** | 21 | 5 | 7.2 | **SIM** |
| **3x** | 37 | 3 | 10.7 | **SIM** |

O zoom entregue na fase anterior resolve o caso do fundo da sala — **desde que
o estudante saiba que precisa usá-lo**. Ele não deveria precisar saber.

## A correção proposta: analisar em várias escalas

Recortar a região do slide e analisar em cheio resolve os casos intermediários:

| slide ocupa | recortado, sugere |
|---|---|
| 50 % | **SIM** (era não) |
| 35 % | **SIM** (era não) |
| 25 % | não — vira 50 linhas em 2 faixas |
| 18 % | não — mesma coisa |

Recortar demais reproduz o problema do outro lado: o texto fica alto e as linhas
colam. Então a correção não é escolher uma escala melhor, é **não escolher uma
só**: amostrar o quadro em algumas janelas concêntricas, rodar o mesmo
classificador em cada uma e ficar com a leitura mais forte. O custo é 3× uma
análise de 128×96 por tique de 1,2 s, que é irrelevante.

Isso mantém intacto tudo que já funciona — o classificador, os limiares, a
política de momentos — e ataca a única coisa que a medição mostra estar errada.

## O que isto NÃO prova

Tudo acima é cena gerada em código. Vale como diagnóstico da geometria, não como
prova de comportamento em sala. Continua valendo o critério: só é "validado em
device real" quando o teste no celular confirmar.

---

# Curadoria — o que se verificou, e o que não precisou mudar

*Medido depois das correções de escala e contraste.*

A outra metade do relato era "às vezes não marca momentos que deveria". Isso
podia estar na detecção ou na curadoria — na regra que decide se o que mudou
merece virar momento. Testei a curadoria isoladamente, com a política do app
importada, sobre uma aula gravada de 24 slides.

| cenário | esperado | medido |
|---|---|---|
| slide parado por 1 minuto | 1 momento (a abertura) | 1 |
| professor atravessa na frente | 0 extras | 0 |
| cursor percorre o slide | 0 extras | 0 |
| reflexo desliza na tela | 0 extras | 0 |
| animação pisca no canto | 0 extras | 0 |
| **troca de slide** | **cria momento** | 2º momento criado |
| **build no mesmo slide** | **refina, não cria** | 1 momento, 1 refinamento |
| plateia discreta se mexendo | troca ainda é vista | 2 momentos |
| plateia agitada | troca ainda é vista | 2 momentos |

As duas últimas eram a hipótese mais provável para o relato: ninguém assiste
aula numa sala parada, e se o movimento de fundo mantivesse a diferença entre
quadros acima do limiar, a sessão nunca chegaria aos dois tiques estáveis que
exige, e a troca de slide passaria sem ser vista. Não é o que acontece — a
comparação é feita sobre as marcas dentro da região do conteúdo, e a plateia
está fora dela.

**Nenhuma linha de código mudou nesta etapa.** A curadoria já estava certa; o
que falhava era a detecção, e isso foi corrigido nos dois commits anteriores.
Registrar isso é mais útil do que inventar uma correção para parecer trabalho.

E a aula longa foi remedida depois das mudanças, que é o risco real de aumentar
sensibilidade: **49 minutos, 24 slides, 24 momentos criados, 0 falsos
positivos, 46 builds absorvidos como refinamento, 108 tremores absorvidos.**

## Continua sem validação em aparelho

Tudo acima é quadro gravado processado fora do navegador. Prova que a regra
decide certo quando recebe os quadros; não prova o que a câmera de um celular
entrega numa sala de aula.

---

# Segunda rodada — a moldura, o enquadramento e a dica

*Medido em 3 e 4 de setembro, com o modo de diagnóstico já no ar.*

## A moldura estava dançando, e por três motivos diferentes

O sintoma era um só — "a moldura fica pulando" — e por isso parecia um
problema só. O `qa-moldura` separou os três: ele calcula, pela conta do
`object-cover`, onde um slide de largura conhecida **deveria** cair na tela, e
compara com o retângulo que foi de fato desenhado. Mede duas coisas:
sobreposição e tremor entre quadros parados.

| cena | sobreposição | tremor antes | tremor depois |
|---|---|---|---|
| slide 70 % | 100 % | — | 0 px |
| slide 50 % | 100 % | — | 0 px |
| slide 32 % | 90 % | — | 0 px |
| slide 20 % | 84 % | *sem moldura* | 1 px |
| slide 50 % sala clara | 100 % | 159 px | **7 px** |
| slide 32 % com 2x | 100 % | — | 6 px |

As três causas:

1. **A janela mudava sozinha.** Um quadro parado era resolvido por 1x num tique
   e por 2,6x no seguinte. As duas leituras estão certas; elas só descrevem a
   mesma escrita com caixas diferentes.
2. **Uma faixa fina sumia.** O slide a 20 % remapeava para 59,7 px de altura
   contra um mínimo de 64 px, e a moldura simplesmente não era desenhada — a
   câmera dizia ter achado uma aula e não mostrava onde.
3. **A leitura oscilava.** Na sala clara a altura alternava entre 29 % e 80 %
   do quadro **a cada tique**, sobre um slide parado.

A terceira foi a que ensinou mais. A saída óbvia é suavizar, e suavizar estava
errado: a média fica no meio das duas leituras, que é justamente onde a escrita
não está. As duas leituras não valem o mesmo. A geometria diz qual: um slide
centrado ocupa quase toda a janela de 2,6x, então a leitura de 80 % era a certa
e a de 29 % era a análise perdendo faixas no pouco contraste. **Perder faixa é
o erro que o pouco contraste comete; inventar faixa, não.** Por isso a caixa
guarda a extensão dos últimos três tiques em vez da do último.

## O momento saía com um enquadramento que ninguém tinha visto

Achado ao auditar a pergunta "o momento do SliD usa o mesmo enquadramento que o
usuário vê?". A resposta era **não**, e a diferença era grande.

O visor usa `object-cover`: ele preenche a tela e descarta o resto. Num celular
em pé recebendo um quadro deitado, o que fica de fora chega a dois terços da
largura. A foto manual já compunha esse recorte — foi corrigido numa rodada
anterior — mas o momento do SliD continuava salvando o **quadro inteiro do
sensor**.

| | antes | depois |
|---|---|---|
| momento salvo | 640×480 (paisagem) | 240×480 (retrato) |
| proporção | 1.333 | 0.500 |
| proporção do visor | 0.499 | 0.499 |

Na prática: o estudante enquadrava o slide na tela e guardava uma imagem mais
larga, com a parede e o teto que ele tinha tirado da mira de propósito.

### O que ficou de fora, de propósito

A **análise** continua lendo o quadro inteiro do sensor, e não a janela do
visor. Isso é uma diferença conhecida, não um esquecimento: todos os limiares
do classificador foram calibrados sobre essa amostra, e mexer na região lida
recalibra a suíte inteira de falsos positivos. Para conteúdo centrado — que é
como um slide ou uma lousa são enquadrados — as duas janelas concordam, e as
seis cenas do `qa-moldura` confirmam. Para conteúdo encostado na borda do
sensor, a análise enxerga o que a tela não mostra, e a moldura correspondente
cai fora da vista (onde agora ela é descartada, em vez de desenhada no vazio).

## A dica de enquadramento

O `tooSmall` já existia e só aparecia no painel de diagnóstico. Agora ele vira
uma linha na tela, ao lado do próprio botão de zoom que ela manda usar, e o
texto acompanha o zoom em uso — "experimente 2x" para quem está em 1x, "3x"
para quem já está em 2x, "chegue mais perto" para quem já esgotou o zoom.

A regra que a mantém honesta: ela só fala quando a análise **viu escrita numa
janela ampliada e não conseguiu concluir**. Sobre parede, carpete, teclado ou
tela vazia não há sinal nenhum, e ela fica calada. Uma dica que aparece sobre
qualquer coisa ensina o estudante a ignorá-la.

## Continua sem validação em aparelho

Vale o mesmo aviso da primeira rodada, com uma diferença: agora tudo acima
passou **pela câmera do navegador**, com as cenas entrando por
`--use-file-for-fake-video-capture`, e não por chamada direta às funções. É o
mais perto de uma sala que dá para chegar sem uma sala. Não substitui apontar
um celular para um projetor.

---

# Terceira rodada — a guarda de reenquadramento está engolindo trocas de slide

*Medido em 4 de setembro. **Este defeito está diagnosticado e NÃO está
corrigido.** A correção existe, foi medida, e reprovou numa cena de controle.
Ela precisa da sua decisão, e está descrita no fim.*

Este é o defeito mais sério encontrado até agora, e ele explica a metade do
relato original que nunca teve explicação: **"às vezes não marca momentos que
deveria"**.

## Duas hipóteses erradas antes da certa

Vale registrar as duas, porque acreditar numa medição feita na configuração
errada é o erro que este documento existe para não repetir.

**Primeira:** gerei os dois slides trocando só a semente do texto — mesmo
retângulo, mesmas seis linhas nas mesmas alturas. Na amostra de 128×96 uma
linha de texto tem dois pixels, e dois textos diferentes na mesma linha são a
mesma mancha: **+0,2 % de marcas, −0,1 %**. O classificador estava certo e o
teste é que pedia o impossível.

**Segunda:** de uma medição forçada na janela de 1x, concluí que existia uma
faixa cega entre 32 % e 70 % de largura de slide, e cheguei a escrever um aviso
de zoom na tela por causa disso. Não existe faixa cega: a sessão não lê em 1x,
ela trava na janela que reconheceu a cena, e nessa janela a troca aparece
inteira. O aviso foi removido.

## O defeito

Antes de decidir se algo virou momento, a sessão pergunta se a **câmera** foi
mexida — mexer o celular e trocar de slide produzem a mesma mudança de
conteúdo. A prova usada é: mudou mais de 0,6 % do quadro *fora* da caixa do
conteúdo? Então foi reenquadramento, e o tique é descartado.

Esse limiar é uma fração do **quadro inteiro**, mas a região que ele mede varia
de 5 % a 95 % do quadro. Quando a sessão trava numa janela ampliada — que é
como um projetor distante é lido — a caixa do conteúdo ocupa quase toda a
janela, e "fora" vira uma tira fina que contém a **borda iluminada do próprio
slide**, cuja máscara de marcas pisca com o ruído do sensor a cada quadro.

Medido sobre os quadros que o navegador realmente amostrou, sessão travada em
2,6x, câmera absolutamente parada:

```
 s   dentro: +marcas -marcas   decisão de conteúdo   guarda
 4          0.9%     0.9%      nada                  ACUSOU
 8         24.7%    11.3%      novo-slide            ACUSOU
11         24.7%    11.4%      novo-slide            ACUSOU
14         24.7%    11.4%      novo-slide            ACUSOU
18         24.7%    11.4%      novo-slide            ACUSOU
19          0.8%     0.8%      nada                  ACUSOU
```

**A guarda acusa em todos os tiques, inclusive com a cena idêntica.** Os onze
segundos em que o slide novo esteve na tela foram descartados um a um como "o
estudante mexeu no celular". E como a guarda re-ancora a referência a cada três
tiques, a comparação anda junto com a cena: a aula passa sem gerar o segundo
momento.

Confirmado no navegador, aula inteira: **1 momento onde deveriam ser 3.**

## A correção medida — e por que ela ainda não foi para o ar

O limiar absoluto não separa as duas coisas. O que separa é físico: **mexer a
câmera mexe tudo, na mesma proporção; trocar o slide mexe só o que está no
slide.** Por densidade de mudança (mudança ÷ área da região medida):

| cena | dentro | fora | fora/dentro |
|---|---|---|---|
| troca de slide, câmera parada | 42,7 % | 32,4 % | **0,76** |
| troca de slide, sala com porta e janela | 42,7 % | 32,2 % | **0,75** |
| a sala inteira deslizando | 41,8 % | 73,5 % | **1,76** |

Exigir que "fora" tenha mudado pelo menos tanto quanto "dentro" resolve o caso:
implementado e verificado no navegador, a troca de slide a 1x passou de **1
para 3 momentos**, com o build ainda refinando, o cursor, o reflexo e o
professor ainda sem gerar nada, e a bateria inteira verde — adversárias,
curadoria (3 trocas = 3 momentos), contexto, campo, interferência.

**Reprovou numa cena só, e ela basta para segurar a mudança: o celular apoiado
tremendo.** 4 momentos onde a regra antiga dava 1. O motivo é que a razão
fora/dentro do tremor **oscila**:

| tique | 5 | 8 | 10 | 13 | 16 | 19 | 21 | 24 |
|---|---|---|---|---|---|---|---|---|
| fora/dentro | 2,91 | 2,02 | 1,65 | 3,27 | 2,39 | 2,70 | 4,34 | **0,10** |

Nenhum limiar de razão segura isso: basta um tique vazando para nascer um
momento falso. A razão é o instrumento certo para a troca de slide e o
instrumento errado para o tremor — tremor é *movimento*, e quem deveria pegá-lo
é o portão de movimento (`MOTION_THRESHOLD`), que hoje deixa passar um
deslocamento de 3 px.

A correção completa são **duas** mudanças no núcleo, não uma. Uma delas mexe na
sensibilidade a movimento, que é o que segura a rajada — o defeito que este
produto mais não pode ter, e que a banca vai testar com o celular na mão. Não
faço isso sozinho no fim de um ciclo.

**O que está no ar continua sendo a regra antiga**: trocas de slide são
engolidas quando a sessão trava numa janela ampliada. É o custo conhecido, e
ele é menor que o de uma rajada.

### O que eu recomendo

Fazer as duas mudanças juntas, num ciclo próprio, com a bateria dinâmica
(`qa-slid-dinamico`) como critério de aceite: troca de slide gera momento,
tremor não gera, sala deslizando não gera. As cenas já existem e estão
gravadas; a medição acima é o ponto de partida.

