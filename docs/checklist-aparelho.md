# Checklist do teste em aparelho real

Abra com **`?debug=slid`** no fim do endereço. Sempre que algo sair errado,
toque em **copiar** no painel e guarde o texto.

---

## A — Detecção

Para cada posição, anote **quantos segundos** até aparecer "Aula detectada" e
**onde a moldura caiu**.

| situação | detectou? | tempo | moldura em cima do slide? |
|---|---|---|---|
| projetor, 1x, meio da sala | | | |
| projetor, 1x, fundo da sala | | | |
| sala clara | | | |
| sala mais escura | | | |

Se não detectar: **copie o painel**. A linha `veredito` é o que falta saber.

---

## B — Marcação automática

Uma sequência só, com pelo menos 5 slides reais, nesta ordem:

1. slide 1 (deixe parado ~20 s)
2. **troca completa** para o slide 2
3. **bullet aparecendo** no slide 2
4. **troca completa** para o slide 3
5. **pessoa passando** na frente
6. **tremida pequena** no celular

Anote:

- momentos que **deveriam** existir: ______  (regra: 1 por slide + 1 por troca; bullet, pessoa e tremida **não** contam)
- momentos **criados**: ______
- **trocas perdidas** (troca que não virou momento): ______
- **momentos extras** (nasceram do bullet, da pessoa ou da tremida): ______

> Esta é a parte mais importante do teste. Já sabemos que trocas de slide são
> engolidas quando a sessão trava numa janela ampliada — o que preciso saber é
> **em que condição real** isso acontece, e quanto.

---

## C — Zoom

Repita **B** inteiro em 1x e depois em 2x, no mesmo lugar.

| | detectou? | momentos criados | trocas perdidas |
|---|---|---|---|
| 1x | | | |
| 2x | | | |

---

## D — Negativos

Nenhum destes pode sugerir aula, e nenhum pode mostrar dica de zoom.

- [ ] parede
- [ ] mesa
- [ ] teclado
- [ ] pessoa

**Já conhecida:** numa mesa de madeira com veio marcado a dica "Conteúdo
distante — experimente 2x" pode aparecer. Se acontecer, é o defeito que já
está mapeado — anote e siga.

---

## E — Diagnóstico

Sempre que houver comportamento errado: **copiar** no painel e guardar o texto,
junto com o que você estava apontando e o que esperava.

Um vídeo curto da tela durante o item **B** vale mais que qualquer descrição.

---

## F — Filtros (ciclo de 10/set)

Tudo aqui passou no navegador da bancada. O que falta é o dedo num celular de
verdade: o arraste do controle, o tamanho dos alvos e a tela estreita.

Em **Foto**, com a tira de filtros aberta:

- [ ] a porta **"Mais"** está visível sem arrastar a tira
- [ ] tocar em "Mais" abre o painel completo
- [ ] o painel sobe pelo rodapé (não nasce pronto na tela)
- [ ] **arrastar o controle de intensidade com o dedo** funciona — sem travar,
      sem rolar o painel junto, sem soltar no meio
- [ ] em **0 %** o visor volta ao original
- [ ] em **50 %** o filtro aparece pela metade
- [ ] em **100 %** o filtro aparece cheio
- [ ] **a foto salva corresponde ao que o visor mostrava** — tire uma em cada
      valor e confira na galeria; é o item mais importante desta seção
- [ ] **Leitura** deixa o texto mais legível numa folha ou num slide de verdade
- [ ] favoritar e desfavoritar acende e apaga a seção "Filtros favoritos"
- [ ] o favorito sobrevive a fechar e reabrir o app
- [ ] **Raio de sol** aparece no visor **e** na foto salva
- [ ] **Tremor** balança o visor — e **não** aparece na foto (é movimento, e
      foto não treme; se aparecer alguma coisa na foto, é defeito)
- [ ] com a câmera frontal, ligar o Tremor **não desespelha** a imagem
- [ ] nenhum card de filtro fica cortado na largura da sua tela
- [ ] a seção "Filtros favoritos" é alcançável rolando o painel

E a regra que não pode quebrar:

- [ ] **entrar no SliD com um filtro ligado deixa a imagem natural** — sem
      filtro, sem efeito, sem tira de filtros na tela

Anote a largura da sua tela (Ajustes → Sobre, ou o modelo do aparelho) se algum
item de corte falhar.

---

## G — Listen (ciclo de 11/set)

O Listen inteiro é a parte do produto com **menos** cobertura possível nesta
bancada: o Chromium de mesa grava webm/opus, e é só isso que ele sabe dizer.
Qual formato cada celular escolhe, se o áudio toca depois de fechar o app, e se
o microfone é solto de verdade — só o aparelho responde.

Entre no **SliD** e autorize o microfone:

- [ ] a caixa de permissão do microfone aparece **depois** da câmera, não junto
- [ ] o selo diz **"Ouvindo"** com o relógio andando
- [ ] **falar perto do celular mexe a barrinha de nível** (é a prova de que o
      microfone está vivo, e não congelado)
- [ ] o ✕ ao lado do selo desliga o áudio sem encerrar a aula
- [ ] encerrar a aula mostra, no resumo, **quanto de áudio foi gravado**
- [ ] depois de salvar, **o indicador de microfone do sistema apaga** (a bolinha
      laranja/verde no iPhone, o ícone na barra do Android) — se ficar aceso, é
      defeito e é o mais grave desta seção
- [ ] a aula na galeria mostra o **selo de microfone** no card
- [ ] abrir a aula mostra o player, e **ele toca**
- [ ] **"Ouvir" num momento salta o áudio para aquele ponto** — confira com o
      relógio do player
- [ ] feche o app por completo, reabra, abra a aula: **o áudio continua lá**

Agora **negue** o microfone (recuse a permissão, ou bloqueie nas configurações
do site) e entre no SliD de novo:

- [ ] o selo diz **"Áudio desativado"**
- [ ] a sessão continua: momentos são guardados normalmente
- [ ] a aula salva **não** mostra player nem botão de ouvir
- [ ] o botão "Ativar" no selo abre o pedido de permissão de novo

Anote qual navegador e qual sistema, e **qual formato o arquivo saiu** se
conseguir ver (o resumo não mostra, mas um vídeo compartilhado diria).

---

## H — Intervalo e Noite (ciclo de 11/set)

**Intervalo**, em Modos → Intervalo:

- [ ] escolha 1s, grave por ~30 s apontando para algo que muda
- [ ] a tela mostra quadros, tempo real e duração do vídeo enquanto grava
- [ ] parar salva um vídeo na galeria, e **ele toca**
- [ ] o vídeo está mesmo acelerado
- [ ] trocar de modo no meio **não perde** o que já foi capturado

**Noite**, em Modos → Noite, **num lugar realmente escuro**:

- [ ] escolha "Longo", apoie o celular numa superfície e dispare
- [ ] a tela diz que está juntando quadros
- [ ] compare a foto com uma tirada em modo Foto no mesmo lugar: **a do
      Noturno tem menos granulado**
- [ ] tire uma com o celular na mão e confirme que ela **borra** — é o
      comportamento esperado, e é por isso que a tela pede para apoiar

O granulado é o item que importa. Se não houver diferença visível num ambiente
escuro de verdade, anote — a medição da bancada diz que deveria haver.
