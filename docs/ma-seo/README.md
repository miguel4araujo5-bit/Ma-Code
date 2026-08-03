# MA-SEO

A MA-SEO é uma ferramenta pessoal da MA-Code para criar briefs editoriais e comparar rascunhos com os termos e tópicos encontrados nos resultados mais relevantes para uma palavra-chave.

A página pública fica em:

```text
/produtos/ma-seo
```

## O que faz

### Gerar brief

1. Pesquisa os 10 principais resultados orgânicos através da Serper.
2. Descarrega cada página que permita acesso automático.
3. Extrai o título, os H2, os H3 e o texto principal através de regras compatíveis com Cloudflare Workers.
4. Calcula:
   - mediana do número de palavras;
   - intervalo de extensão recomendado;
   - tópicos H2/H3 recorrentes;
   - 30 termos significativos através de TF-IDF simples.
5. Envia apenas esse resumo para o modelo de IA.
6. Produz um brief em Markdown com estrutura, extensão, termos, perguntas e checklist.
7. Guarda a pesquisa, as páginas processadas e o brief numa Durable Object com armazenamento SQLite.

### Pontuar rascunho

1. Recebe texto colado ou um ficheiro `.md`, `.markdown` ou `.txt`.
2. Recupera o brief já guardado para a mesma palavra-chave.
3. Compara o rascunho com os termos e tópicos do brief.
4. Apresenta:
   - cobertura total;
   - cobertura de termos;
   - cobertura temática;
   - extensão atual e recomendada;
   - termos em falta;
   - tópicos em falta.

A pontuação é uma orientação editorial. Não garante posicionamento nos motores de pesquisa.

## Serviços externos

A ferramenta não tem contas, publicidade ou telemetria. O processamento e a cache pertencem ao Worker da MA-Code, mas existem três dependências externas:

- **Serper** para obter os resultados do Google;
- **sites encontrados na pesquisa** para descarregar o conteúdo público;
- **OpenAI** para transformar a análise calculada num brief editorial em Markdown.

## Chave Serper

A chave é criada no painel da Serper:

```text
https://serper.dev
```

A Serper anuncia 2 500 pesquisas gratuitas para novas contas. No preço inicial anunciado de 0,30 USD por 1 000 pesquisas, uma palavra-chave nova consome uma pesquisa e corresponde aproximadamente a 0,0003 USD de custo Serper. Os preços podem mudar e devem ser confirmados no painel antes de utilização comercial.

Uma repetição exata da mesma palavra-chave usa o brief guardado e não volta a consumir créditos Serper ou OpenAI.

## Chave OpenAI

A chave é criada na plataforma OpenAI:

```text
https://platform.openai.com/api-keys
```

O modelo predefinido é:

```text
gpt-4.1-mini
```

Pode ser alterado através da variável opcional `MA_SEO_LLM_MODEL`. O custo da IA depende do modelo escolhido e do volume do resumo enviado e recebido.

## Configuração no Cloudflare

No projeto `ma-code`, abra **Workers & Pages**, selecione o Worker e configure os seguintes secrets em **Settings > Variables and Secrets**:

```text
SERPER_API_KEY
OPENAI_API_KEY
MA_SEO_ACCESS_KEY
```

Opcionalmente, adicione:

```text
MA_SEO_LLM_MODEL
```

O valor de `MA_SEO_ACCESS_KEY` é o código que será introduzido na página. Não deve ser incluído no código do frontend nem no repositório.

## Cache SQLite

A binding usada pelo Worker é:

```text
MA_SEO_CACHE
```

A classe Durable Object é:

```text
MaSeoCacheDurableObject
```

A migração está declarada no `wrangler.jsonc`. O deploy cria o armazenamento SQLite automaticamente.

São guardados:

- resposta SERP por palavra-chave normalizada;
- resultado processado de cada URL;
- brief final por palavra-chave.

Não existe botão de atualização forçada nesta primeira versão. Para evitar consumo acidental, a mesma palavra-chave usa sempre a cache existente.

## Limitações assumidas

- Alguns sites bloqueiam bots, recusam pedidos do Worker ou exigem JavaScript para mostrar o conteúdo.
- A extração pode incluir texto de navegação ou omitir partes em páginas com HTML pouco convencional.
- São necessárias pelo menos três páginas úteis para criar um brief.
- A ferramenta não inclui editor com pontuação em direto.
- A ferramenta não faz auditorias técnicas ao site.
- A ferramenta não acompanha posições no Google.
- A ferramenta não substitui revisão humana, pesquisa factual ou estratégia editorial.

## Privacidade

- Não existem contas de utilizador.
- Não existe telemetria própria da MA-SEO.
- O código de acesso fica apenas em `sessionStorage`, desaparecendo quando a sessão do navegador termina.
- O rascunho é enviado ao Worker apenas quando o utilizador pede a pontuação.
- O rascunho não é enviado à OpenAI e não é guardado na cache.
