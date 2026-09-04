# Testar o SliD num celular de verdade

Tudo o que está medido no repositório passou pela câmera do navegador com
cenas gravadas. Isso prova que a decisão é a certa quando os quadros chegam;
não prova o que a câmera de um celular entrega numa sala com projetor. Este
roteiro existe para que **"não detectou" vire um relatório em vez de uma
impressão** — o que a gente pode corrigir, e não só lamentar.

## Antes de sair

1. Abra o app pelo endereço publicado (HTTPS — sem isso a câmera não liga).
2. Acrescente `?debug=slid` ao endereço. Um painel preto aparece no canto.
3. Dê permissão de câmera. Se o navegador perguntar de novo a cada vez,
   marque "permitir sempre" — durante a aula não dá para ficar respondendo.

O painel mostra, a cada 1,2 s:

| linha | o que ela responde |
|---|---|
| `estado` | procurando / SUGERINDO / sessão, e quantos tiques seguidos de aula |
| `veredito` | **por que** reprovou, quando reprovou |
| `janela` | qual das três janelas (1x, 1.7x, 2.6x) resolveu a cena |
| `zoom` | o zoom em uso, e se é do hardware ou digital |
| `tinta` | o limiar de contraste que a análise achou |
| `moldura` | onde a análise diz que o conteúdo está, em % do quadro |
| tabela | as três janelas lado a lado, com linhas, faixas, densidade e traços |

O botão **copiar** põe tudo isso na área de transferência, junto com o modelo
do aparelho e o tamanho da tela. É isso que resolve um relato.

## Na sala

Faça cada item e **copie o painel** quando o resultado for diferente do
esperado. Um print também serve.

### 1. Slide projetado, do fundo da sala

- [ ] Aponte para o projetor de onde você realmente senta.
- [ ] Espere até 5 s. Esperado: a pílula "Aula detectada · ativar SliD".
- [ ] Se não aparecer: o painel diz "conteúdo pequeno — 2x deve ajudar"?
      Então toque em 2x e espere mais 5 s.
- [ ] Se aparecer a linha **"Conteúdo distante — experimente 2x"** na tela,
      ela está fazendo o trabalho dela: toque no 2x.
- [ ] Se continuar sem detectar mesmo em 3x: **copie o painel**. O `veredito`
      é a informação que falta.

### 2. A moldura cai em cima do slide?

- [ ] Com a aula detectada, olhe os colchetes. Eles devem estar **sobre o
      slide**, não sobre a sala inteira.
- [ ] Deixe o celular parado 20 s. A moldura deve ficar quieta. Se ela pular,
      anote de quanto em quanto tempo e **copie o painel** — a linha `janela`
      diz se a análise está trocando de escala.

### 3. Lousa branca escrita

- [ ] Aponte para uma lousa com pelo menos três linhas escritas.
- [ ] Esperado: detecta, e a moldura fica na área escrita, não na lousa toda.

### 4. O que NÃO pode acontecer

- [ ] Parede lisa — não pode sugerir aula.
- [ ] Mesa, teclado, piso, cortina, tecido — não podem sugerir aula.
- [ ] O rosto de alguém — não pode sugerir aula.
- [ ] Nenhum desses pode mostrar a dica "conteúdo distante".

Se algum deles sugerir, **copie o painel na hora**. Um falso positivo é o pior
defeito que este produto pode ter, e o painel diz exatamente qual janela e qual
limiar deixaram passar.

### 5. A aula inteira

- [ ] Apoie o celular como você apoiaria de verdade, e ative o SliD.
- [ ] Deixe rodar **10 minutos** de aula real.
- [ ] Esperado: entre 5 e 10 momentos. Bem menos que isso é uma detecção que
      falhou; muito mais é rajada.
- [ ] Anote: cada troca de slide virou um momento? Um slide que foi crescendo
      virou **um** momento que foi ficando mais completo, ou virou vários?
- [ ] O professor passando na frente criou momento? Não deveria.

### 6. O momento guardado

- [ ] Encerre e olhe os momentos. Cada um deve estar **enquadrado como estava
      na tela** — sem parede e teto que você tinha tirado da mira.
- [ ] Se você usou zoom, o momento tem que estar com zoom também.

## O que fazer com o resultado

Mande os textos copiados. Cada um deles diz, sem adivinhação:

- qual janela leu a cena;
- qual limiar de tinta ela achou;
- qual condição reprovou;
- e como as três escalas se comportaram no mesmo quadro.

Sem isso, o único dado disponível é "às vezes não funciona", e não dá para
corrigir "às vezes".
