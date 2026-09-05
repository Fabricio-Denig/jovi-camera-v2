# Validação em aparelho real

Registro permanente do que foi testado em celular de verdade, contra projetor de
verdade. Tudo o mais no repositório passou pela câmera do navegador com cenas
gravadas — o que prova que a decisão é a certa quando os quadros chegam, e não o
que a câmera de um celular entrega numa sala.

Esta página é a única que fala de aparelho.

---

## ✅ 5 de setembro de 2026 — projetor real, celular real, zoom 2x

**Resultado: funcionou.**

| etapa | resultado |
|---|---|
| sugestão "Aula detectada" | apareceu com facilidade |
| projetor reconhecido | sim |
| ativar o SliD | funcionou |
| momento automático registrado | sim |
| impressão geral | convincente |

**Condição validada: projetor de sala + celular + 2x.**

### Por que isto importa mais que o resto da suíte

É a primeira evidência de que o caminho inteiro fecha fora do laboratório:
sensor real, luz real, distância real, mão real segurando o aparelho. As doze
suítes automatizadas nunca poderiam provar isso — elas provam que a regra decide
certo, não que a câmera entrega o que a regra espera.

### Regressão manual obrigatória, a partir de agora

Este cenário é um teste que não dá para automatizar: o projetor é físico.

> **Qualquer mudança relevante no detector, na curadoria ou na análise de quadro
> deve ser marcada com "precisa revalidar projetor real em 2x", e não deve ser
> publicada antes dessa revalidação.**

Mudança relevante quer dizer: limiares do classificador, escalas de análise,
regra de marcação, guarda de reenquadramento, amostragem de quadro. Mudança de
UI, texto, galeria ou resumo não entra nesta regra.

---

## O que ainda não foi validado em aparelho

| cenário | situação |
|---|---|
| projetor em **1x** | não testado |
| projetor em **3x** | não testado |
| aula longa (10 min +) com contagem de momentos | não testado |
| troca de slide em sequência real | não testado |
| lousa branca / quadro escrito | não testado |
| caderno e folha | não testado |
| negativos (parede, mesa, teclado, pessoa) | não testado |
| iPhone / Safari | não testado |

O roteiro para preencher isso está em `checklist-aparelho.md`.

---

## Problema conhecido, aguardando dado de aparelho

A **guarda de reenquadramento** pode interpretar ruído da borda do slide como
movimento da câmera e engolir uma troca de slide. Diagnosticado e medido no
navegador; a correção por densidade foi implementada, medida e **revertida**
porque regrediu no celular tremendo.

Está tudo em `auditoria-slid.md`, com os números. **Não atacar por tentativa e
erro.** A correção espera vídeo ou log de aparelho que reproduza o caso, para
que o critério saia de medição e não de palpite.
