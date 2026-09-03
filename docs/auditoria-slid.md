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
