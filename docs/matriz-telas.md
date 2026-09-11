# As sete telas, medidas

Todas as sete telas v2 do Figma estão lidas. Esta é a matriz de onde o app
está em relação a cada uma, e o que falta.

**Escala de cada coluna**

- **Fidelidade** — quanto da estrutura do wireframe existe no app.
- **Funcionalidade** — quanto do que a tela mostra faz alguma coisa de verdade.
- **Mobile** — testado a 375/390/430 px, e 320 px onde há teste.
- **QA** — que suíte cobre a tela.

**Prioridade dos gaps**

- **P0** — quebra a demonstração.
- **P1** — diferença perceptível do Figma, ou função importante faltando.
- **P2** — polimento.

---

| Tela | Figma | Fidelidade | Funcionalidade | Mobile | QA |
|---|---|---|---|---|---|
| Câmera | `298:136` | alta | **total** | ✅ 320–430 | `qa-filtros`, `qa-virar`, `qa-robustez` |
| Detecção | `312:322` | alta | **total** | ✅ | `qa-slid-realworld`, `qa-moldura`, `qa-dica` |
| SliD ativo | `321:296` | alta | **total** | ✅ | `qa-slid-dinamico`, `qa-slid-listen` |
| Modos | `337:443` | alta | parcial — 6 de 16 modos são prévia, e dizem isso | ✅ | `qa-modos`, `qa-intervalo`, `qa-noturno` |
| Filtros | `333:169` | alta | **total** | ✅ 375–430 | `qa-filtros` |
| Galeria | `339:540` | alta | **total** | ✅ | `qa-golden`, `qa-robustez` |
| Resumo | `339:611` | alta | **total** | ✅ 375–430 | `qa-resumo`, `qa-demo-banca` |

Nenhum **P0** aberto: a jornada inteira roda, e `qa-demo-banca` prova isso em
38 passos, três vezes — com áudio, sem microfone, e pelo Scanner.

---

## O que ainda difere do wireframe, por tela

### Câmera — `298:136`
Nada relevante. A tira de filtros e a porta "Mais" são adição nossa; o resto
segue o wireframe.

### Detecção — `312:322`
Nada relevante.

### SliD ativo — `321:296`
O selo do Listen e a linha `SEE · LISTEN · IDENTIFY` **não estão no
wireframe** — foram acrescentados porque o Listen passou a existir e uma
funcionalidade que grava sem aparecer é duas coisas ruins ao mesmo tempo: não
demonstra a promessa, e é um microfone aberto que a pessoa não vê.

### Modos — `337:443`
**P1 — seis modos ainda são prévia.** Eles dizem "Prévia" no card e abrem um
cartão explicando o que fariam, o que é honesto. Nove são reais: Foto, Vídeo,
SliD, Documento, **Intervalo** e **Noite** (11/set), mais os que o wireframe já
tratava como variações. O que ainda dá para tornar real está em
`modos-viabilidade.md`, com o esforço estimado — e o que **não** dá (câmera
lenta, superlua) está registrado como tal, para não custar um ciclo de
descoberta.

### Filtros — `333:169`
**P2 — a comparação partida com divisor arrastável.** Única peça do wireframe
que falta, e a mais cara. Com a intensidade contínua funcionando, dá para
comparar arrastando de 0 a 100.

### Galeria — `339:540`
Nada relevante. A ordem das abas (Fotos · SliD · Todas · Favoritos · Vídeos) é
decisão de produto e prevalece sobre o wireframe.

### Resumo — `339:611`
Três diferenças, todas deliberadas e registradas:

1. A aba se chama **"Resumo"**, não "Resumo IA" — o app não chama modelo de
   linguagem nenhum, e há teste que reprova se a palavra "IA" aparecer.
2. Os **marcadores interpretados** ("Δ > 0 → duas raízes reais") **não
   entraram** — nenhum está escrito no slide desenhado; é conhecimento sobre o
   assunto, não leitura da captura.
3. **"Adicionar" não entrou** — o wireframe não diz adicionar a quê. No lugar
   dele, excluir.

E quatro coisas que o wireframe **não tem** e ficam por decisão de produto:
status, favorito, excluir, e "Revisar a aula".

---

## O que só o aparelho real pode dizer

Nenhum item abaixo tem como ser respondido nesta bancada.

| o quê | por quê |
|---|---|
| **Listen inteiro** | qual formato cada navegador escolhe, se o áudio toca depois de fechar e reabrir o app, se o microfone é solto ao sair |
| Arraste da intensidade com o dedo | a bancada dispara eventos, não arrasta |
| Foto salva conferida na galeria | o teste mede saturação; o olho num slide real é outra prova |
| Raio de sol e Tremor num celular | GPU e térmico diferentes |
| Torch, zoom óptico, múltiplas câmeras | a câmera falsa expõe um dispositivo só e nenhuma capacidade |
| **Projetor real em 2x** | a regressão manual de ouro do SliD, já validada uma vez |

O checklist está em `docs/checklist-aparelho.md`.
