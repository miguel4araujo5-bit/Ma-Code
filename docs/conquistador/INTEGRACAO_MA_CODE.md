# Conquistador — Integração no MA-CODE

## URL pública

`https://ma-code.pt/jogos/conquistador/`

## Ficheiros publicados

Os ficheiros do jogo ficam em:

`public/jogos/conquistador/`

O Vite copia o conteúdo de `public/` para `dist/` durante o build do MA-CODE.

## Teste técnico

A partir da raiz do repositório:

```bash
node tests/conquistador/phase1a.test.mjs
```

## Observações

- Não altera `package.json`.
- Não acrescenta dependências.
- Não altera `vite.config.ts`.
- Não altera `wrangler.jsonc`.
- Não utiliza D1 nesta fase.
- Os caminhos no jogo são relativos, por isso funcionam no subdiretório.
