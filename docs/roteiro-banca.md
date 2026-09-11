# Roteiro da demonstração

Escrito para ser seguido com o celular na mão, na frente da banca. Cada passo
diz **o que fazer**, **o que vai acontecer** e **o que dizer** — e, onde
importa, o que fazer se não acontecer.

**Endereço:** https://fabricio-denig.github.io/jovi-camera-v2/

**Antes de começar**

- [ ] abra o endereço no celular e conceda câmera **e microfone** uma vez, antes
      da apresentação — uma caixa de permissão no meio da demonstração rouba
      trinta segundos e o fio da conversa
- [ ] apague as aulas de teste (Galeria → SliD → abrir → Excluir)
- [ ] deixe o celular carregado e o brilho no máximo
- [ ] tenha **um slide projetado** ou uma lousa escrita à disposição
- [ ] tenha **uma folha escrita** sobre uma mesa, para o Scanner

---

## Ato 1 — a promessa, em quinze segundos

> "O nome é SliD: **See, Listen and Identify**. Ele vê, ouve e identifica uma
> aula. Vou mostrar as três coisas acontecendo."

**Faça:** aponte a câmera para o slide.

**Vai acontecer:** em ~4 segundos aparece **"Aula detectada · ativar SliD"** no
topo, com uma moldura sobre o conteúdo.

> "Ninguém pediu nada. Ele reconheceu que tem aula na frente."

**Se não detectar:** toque em **2x**. É o caso conhecido de slide pequeno em
sala clara — e vale dizer isso em voz alta, porque admitir o limite vale mais
que fingir que não existe.

---

## Ato 2 — a aula acontecendo sozinha

**Faça:** toque na pílula. **Apoie o celular** e deixe.

**Vai acontecer:** o topo mostra três coisas ao mesmo tempo:

- **Acompanhando a aula** com o relógio da sessão
- **Ouvindo** com a barrinha de nível mexendo — e, se este navegador
  transcrever, **Ouvindo · Transcrevendo** com uma linha do que você acabou de
  dizer
- **SEE · LISTEN · IDENTIFY**

> "Aqui estão as três letras do nome, acontecendo juntas. A barrinha mexe
> porque eu estou falando — é o microfone vivo, não um ícone."

**Faça:** troque o slide. Espere. Troque de novo.

**Vai acontecer:** miniaturas se empilham na direita, uma por momento.

> "Cada miniatura é um momento que ele decidiu guardar. Eu não toquei em nada."

**O que NÃO vai acontecer, e vale apontar:** passe a mão na frente da câmera,
ou balance um pouco o celular. Nenhum momento novo aparece.

> "Ele não guarda tudo. Guarda o que mudou de verdade."

---

## Ato 3 — a aula vira material

**Faça:** toque na tela → **Encerrar** → **Salvar aula**.

**Vai acontecer:** o resumo abre dizendo quantos momentos, quanto tempo, e
**quanto de áudio foi gravado**.

> "Ele diz o que guardou antes de eu decidir guardar."

**Faça:** escolha um **status** e uma **matéria**. Salve.

**Faça:** Galeria → **SliD** → abra a aula.

**Mostre, nesta ordem:**

1. O **cabeçalho**: qual aula, matéria, status, data, duração, quantos momentos.
2. **Imagens** — os momentos, com o horário de cada um.
3. **Texto** — o que a câmera leu, organizado por momento.
   > "Isto não é o texto bruto do reconhecimento. O que não foi lido com
   > confiança não aparece — e não fica guardado em lugar nenhum."
4. **Resumo** — a aula condensada.
   > "Repare que a aba se chama **Resumo**, e não 'Resumo IA'. Nenhum modelo de
   > linguagem é chamado aqui. Seria fácil escrever IA na tela; não seria
   > verdade."
5. **O player**, e o **"Ouvir"** ao lado de um momento.
   > "Este é o encontro das três letras: a imagem do momento, o que estava
   > escrito, e o que estava sendo dito naquele instante."

**Se a transcrição tiver funcionado neste navegador** — confira antes, no Ato
2, se o selo disse "Ouvindo · Transcrevendo":

6. Na aba **Texto**, troque o chip para **Transcrição da aula**.
   > "A aula tem duas fontes de texto: o que a câmera leu do quadro, e o que
   > foi falado. Numa aula de letra à mão, esta é a única que sobra."
7. Toque num **horário** da transcrição.
   > "O horário é um botão. Ele leva a gravação para aquele ponto."
8. Mostre **"O professor marcou"**.
   > "Estas frases não foram escolhidas por relevância. Elas existem porque
   > alguém disse 'isso cai na prova' — a expressão é a evidência, e ela está
   > guardada junto."
9. Na aba **Resumo**, mostre **"O que foi dito"**.
   > "Cada linha aqui foi dita, palavra por palavra. O ranking escolhe entre as
   > frases que existem; ele não escreve nenhuma."

**Faça:** toque em **Copiar a aula inteira**, e cole em qualquer lugar.

---

## Ato 4 — o que mais a câmera faz

Escolha **um ou dois**, conforme o tempo. Não passe dos dois.

**Scanner** — Modos → Documento, aponte para a folha, capture.
> "Ele acha a folha, recorta e trata. E **se eu pedir**, extrai o texto — não
> antes: são quatro megabytes de reconhecimento, e quem só quer a foto da
> página não paga por isso."

**Noite** — Modos → Noite, num canto escuro, celular **apoiado**.
> "Ele junta dezesseis quadros e tira a média. Isso corta o granulado por raiz
> de dezesseis, que é quatro vezes — medido. O que ele não faz é alinhar os
> quadros, e por isso a tela pede para apoiar o celular. Está escrito lá."

**Filtros** — a tira no rodapé, depois **Mais** → o painel.
> "A intensidade é contínua, e a foto salva sai exatamente como o visor
> mostrava. E aqui dá para ver antes e depois ao mesmo tempo."

---

## Se alguém perguntar

**"Isso usa IA?"**
> "Usa reconhecimento de texto rodando no próprio aparelho, e regras que eu
> escrevi para decidir o que é aula e o que mudou. Não chama nenhum modelo de
> linguagem, e a tela não diz que chama."

**"O áudio vai para algum servidor?"**
> "O **arquivo** não. É `MediaRecorder` do navegador, gravando para o IndexedDB
> do aparelho. Não tem backend neste projeto — nem para isso, nem para nada.
>
> A **transcrição** é outra coisa, e vale ser exato: quem transcreve é o
> reconhecimento de voz do próprio navegador, e no Chrome isso significa áudio
> indo para um serviço do Google. Eu não escolho isso e não tenho como impedir.
> O que dá para fazer é não chamar de local uma coisa que não controlo — e a
> tela do app diz exatamente isso."

**"E se o navegador não transcrever?"**
> "O SliD não sente. Ele grava o áudio igual, marca os momentos igual, salva a
> aula igual." — **e é o caso normal**: neste Chromium a API existe, responde
> `typeof === "function"`, e morre em `audio-capture` antes do primeiro
> resultado. Foi essa medição que definiu o desenho: o app só diz
> "Transcrevendo" **depois que um resultado chega**. Capacidade é evidência,
> não declaração.

**"E se a pessoa não der o microfone?"**
> "A aula acontece igual." — **e mostre**: negue o microfone e entre no SliD.
> A tela diz "Áudio desativado" e os momentos continuam sendo guardados.

**"Por que alguns modos dizem Prévia?"**
> "Porque eles não funcionam, e eu preferi dizer isso a fingir. Dois deles
> —câmera lenta e superlua— o navegador não permite fazer de jeito nenhum."

**"Quanto disso é o Figma?"**
> "As sete telas foram lidas e medidas. Onde o wireframe conflita com uma regra
> do produto, a regra ganha e o visual se adapta — e cada uma dessas decisões
> está escrita."

---

## Plano B

| se | então |
|---|---|
| a detecção não pega o slide | use **2x**, ou aponte para uma folha escrita de perto |
| o wi-fi do lugar cair | o app já está carregado; ele não precisa de rede depois de aberto |
| o microfone não abrir | siga sem — e aproveite: é a jornada "sem áudio", que é parte da demonstração |
| o selo não disser "Transcrevendo" | **não force**. Diga que este navegador não transcreve, que é verdade e é metade da história — e pule os passos 6 a 9 do Ato 3 |
| a bateria estiver baixa | pule o Ato 4 inteiro |
| algo travar | recarregue a página; as aulas salvas continuam lá (IndexedDB) |

**Nunca faça na frente da banca:** limpar os dados do site. As aulas salvas vão
junto.
