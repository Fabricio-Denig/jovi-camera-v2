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
