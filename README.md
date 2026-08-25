# Jovi Camera V2

Protótipo funcional da nova experiência da câmera Jovi — demonstração explorável,
mobile-first, sem backend.

Dois pilares:

- **Descoberta** — tornar modos, filtros, efeitos e configurações fáceis de encontrar,
  entender e experimentar.
- **Câmera contextual** — a câmera reconhece o contexto enquadrado e sugere o recurso
  adequado no momento certo (lousa → SliD, ambiente escuro → Noite, etc.).

O caso de uso principal é o **SliD** (*See, Listen and Identify*): um modo nativo de
sessão contínua de aula — não um app separado e não um scanner de documento pontual.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · APIs Web nativas (getUserMedia,
MediaRecorder, Canvas, IndexedDB).

Sem backend: tudo roda no cliente e persiste localmente no dispositivo.

## Como executar

```bash
npm install
npm run dev
```

O Vite sobe com `host: true`, então o endereço da rede local impresso no terminal
(`http://192.168.x.x:5173`) pode ser aberto direto no celular, desde que esteja
na mesma rede.

> **Câmera exige contexto seguro.** Navegadores só liberam `getUserMedia` em
> `localhost` ou HTTPS. Para testar em um celular real via IP da rede local, use um
> túnel HTTPS (`npx localtunnel --port 5173`) ou acesse o deploy publicado.

Outros comandos:

```bash
npm run build     # typecheck + build de produção
npm run lint      # oxlint
npm run preview   # serve o build local
```

## Estrutura

```
src/
├─ camera/     Câmera: permissão, preview, captura de foto e vídeo
├─ shared/
│  ├─ hooks/   Hooks reutilizáveis
│  ├─ lib/     Persistência (IndexedDB)
│  └─ ui/      Primitivos de UI
├─ types/      Tipos de domínio
└─ app/        Composição da aplicação
```

## Status

Fundação (Dia 1) — câmera real funcionando: permissão, preview traseiro/frontal,
troca de câmera, captura de foto e gravação básica de vídeo, com persistência local
e visualização das capturas.

Ainda não implementados: filtros, catálogo de modos, motor contextual, SliD e galeria.
