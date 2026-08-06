# CONQUISTADOR  
## Terras e Rotas do Atlântico

**Documento Mestre do Projeto**  
**Versão:** 1.0  
**Estado:** Especificação consolidada para prototipagem  
**Idioma:** Português europeu  
**Plataforma inicial:** Navegador — HTML, CSS e JavaScript  
**Modo inicial:** 2 a 4 jogadores locais no mesmo dispositivo  

---

# 1. Finalidade deste documento

Este ficheiro é a fonte oficial de verdade do projeto **Conquistador: Terras e Rotas do Atlântico**.

Todas as regras, custos, nomes, elementos visuais, critérios técnicos e decisões de equilíbrio devem partir deste documento. Sempre que existir uma contradição entre ideias anteriores e esta especificação, prevalece esta versão.

Qualquer alteração futura deve:

1. Ser registada neste documento.
2. Indicar a versão em que foi introduzida.
3. Ser validada através de testes ou simulações.
4. Evitar alterações isoladas que prejudiquem a economia global do jogo.

---

# 2. Visão do jogo

**Conquistador: Terras e Rotas do Atlântico** é um jogo original de estratégia, expansão territorial, comércio e desenvolvimento de povoações.

Cada jogador representa uma Casa Portuguesa fictícia que procura aumentar a sua influência através de:

- Produção de recursos.
- Construção de Caminhos Reais.
- Criação de Rotas Marítimas.
- Fundação de Vilas.
- Desenvolvimento de Cidades Muralhadas.
- Estabelecimento de Feitorias.
- Cumprimento de Contratos da Coroa.
- Construção de Monumentos.
- Utilização estratégica de Cartas da Coroa.
- Disputa de prémios de Prestígio.

O primeiro jogador a alcançar **12 pontos de Prestígio durante o próprio turno** vence imediatamente.

---

# 3. Princípios de design

O jogo deve respeitar estes princípios:

- Regras fáceis de compreender e difíceis de dominar.
- Economia equilibrada entre cinco recursos.
- Várias estratégias de vitória.
- Identidade portuguesa integrada nas mecânicas.
- Aleatoriedade controlada.
- Informação privada limitada.
- Comércio entre jogadores.
- Partidas diferentes em cada utilização.
- Interface clara, responsiva e acessível.
- Grafismo original, sem copiar tabuleiros, ilustrações, ícones ou composição visual de produtos existentes.
- Funcionalidade prioritária sobre decoração.
- Todas as ações devem ser validadas pelo motor do jogo.

---

# 4. Tema e enquadramento

O jogo decorre num reino atlântico fictício inspirado nas paisagens, tradições comerciais, arquitetura e cultura material portuguesas.

O território combina:

- Montados de sobro.
- Planícies agrícolas.
- Regiões costeiras.
- Pedreiras.
- Serras mineiras.
- Portos e Feitorias.
- Vilas caiadas.
- Cidades muralhadas.
- Rotas marítimas.
- Monumentos fictícios de inspiração portuguesa.

O jogo não representa diretamente uma época, guerra, personagem ou campanha histórica real.

---

# 5. Número de jogadores

## 5.1 Modo base

- 2 a 4 jogadores.
- Todos podem jogar no mesmo dispositivo.
- Cada jogador possui uma cor, símbolo, nome e Casa.

## 5.2 Modos futuros

- Jogadores controlados pelo computador.
- Partida online.
- Partida privada por código.
- Modo competitivo.
- Modo tutorial.
- Modo rápido.

Estes modos não são obrigatórios no primeiro protótipo.

---

# 6. Estrutura do tabuleiro

## 6.1 Territórios principais

O tabuleiro possui **19 territórios hexagonais**, dispostos da seguinte forma:

- Primeira linha: 3 hexágonos.
- Segunda linha: 4 hexágonos.
- Terceira linha: 5 hexágonos.
- Quarta linha: 4 hexágonos.
- Quinta linha: 3 hexágonos.

A composição deve evocar Portugal e o Atlântico, sem reproduzir rigorosamente um mapa real.

## 6.2 Moldura marítima

À volta dos 19 territórios existe uma zona oceânica composta por:

- Costa.
- Portos.
- Feitorias potenciais.
- Ligações marítimas.
- Elementos decorativos.
- Rosa dos ventos.
- Pequenas ilhas ou rochedos sem produção.

## 6.3 Distribuição dos territórios

| Região | Recurso | Quantidade |
|---|---|---:|
| Montados de Sobro | Cortiça | 4 |
| Planícies Alentejanas | Trigo | 4 |
| Costa Atlântica | Bacalhau | 4 |
| Pedreiras | Pedra | 3 |
| Serras Mineiras | Ferro | 3 |
| Terras Abandonadas | Nenhum | 1 |

Total: **19 territórios**.

---

# 7. Recursos

Existem cinco recursos principais.

## 7.1 Cortiça do Montado

Funções:

- Expansão.
- Construção ligeira.
- Caminhos.
- Navegação.
- Comércio.
- Feitorias.

Ícone:

- Rolo de cortiça.
- Folha de sobreiro.
- Textura pontilhada.

Cor principal:

- Castanho-cobre.

## 7.2 Pedra de Cantaria

Funções:

- Caminhos.
- Vilas.
- Muralhas.
- Monumentos.
- Infraestruturas.

Ícone:

- Dois blocos de pedra.
- Arco de cantaria.

Cor principal:

- Bege-cinza.

## 7.3 Trigo do Alentejo

Funções:

- Alimentação.
- Crescimento populacional.
- Desenvolvimento urbano.
- Cartas da Coroa.
- Contratos.

Ícone:

- Três espigas.
- Feixe de cereal.

Cor principal:

- Amarelo-dourado.

## 7.4 Bacalhau do Atlântico

Funções:

- Abastecimento.
- Expedições.
- Comércio marítimo.
- Fundação de povoações.
- Cartas da Coroa.
- Contratos.

Ícone:

- Silhueta prateada de bacalhau.
- Onda ou rede.

Cor principal:

- Azul-atlântico.

## 7.5 Ferro das Minas

Funções:

- Ferramentas.
- Rotas Marítimas.
- Fortificações.
- Feitorias.
- Cartas da Coroa.
- Monumentos.

Ícone:

- Lingote.
- Picareta e martelo.

Cor principal:

- Cinzento-azulado.

---

# 8. Reserva de recursos

A Reserva da Coroa possui:

- 19 cartas de Cortiça.
- 19 cartas de Pedra.
- 19 cartas de Trigo.
- 19 cartas de Bacalhau.
- 19 cartas de Ferro.

Quando uma produção não pode ser paga integralmente a todos os jogadores elegíveis:

- Nenhum jogador recebe esse recurso nessa produção.
- Os restantes recursos continuam a ser distribuídos normalmente.

Os recursos de cada jogador são privados.

Os adversários veem apenas:

- Número total de cartas de recurso.
- Número total de Cartas da Coroa.

---

# 9. Marcadores numéricos e probabilidades

## 9.1 Distribuição dos números

| Número | Quantidade |
|---|---:|
| 2 | 1 |
| 3 | 2 |
| 4 | 2 |
| 5 | 2 |
| 6 | 2 |
| 8 | 2 |
| 9 | 2 |
| 10 | 2 |
| 11 | 2 |
| 12 | 1 |

O número 7 não aparece nos territórios.

## 9.2 Probabilidade com dois dados

| Resultado | Probabilidade |
|---|---:|
| 2 ou 12 | 2,78% cada |
| 3 ou 11 | 5,56% cada |
| 4 ou 10 | 8,33% cada |
| 5 ou 9 | 11,11% cada |
| 6 ou 8 | 13,89% cada |
| 7 | 16,67% |

## 9.3 Pontos de probabilidade

- 2 e 12: 1 ponto.
- 3 e 11: 2 pontos.
- 4 e 10: 3 pontos.
- 5 e 9: 4 pontos.
- 6 e 8: 5 pontos.

Total global: **58 pontos de probabilidade**.

## 9.4 Regras de geração

O gerador deve impedir:

- Dois marcadores 6 e 8 adjacentes.
- Concentração excessiva de números fortes no mesmo recurso.
- Pedra ou Ferro com produção global demasiado baixa.
- Um recurso abaixo de 8 pontos de probabilidade.
- Um recurso acima de 14 pontos de probabilidade.
- Vértices iniciais excessivamente dominantes.

Intervalos recomendados:

| Recurso | Pontos recomendados |
|---|---:|
| Cortiça | 11–13 |
| Trigo | 11–13 |
| Bacalhau | 11–13 |
| Pedra | 9–11 |
| Ferro | 9–11 |

---

# 10. Estrutura lógica do tabuleiro

## 10.1 Território

Cada território possui:

- `id`
- Coordenadas axiais ou cúbicas.
- Tipo.
- Recurso.
- Número.
- Pontos de probabilidade.
- Estado de bloqueio.
- Lista de vértices.
- Lista de arestas.
- Indicação costeira.

## 10.2 Vértice

Cada vértice possui:

- `id`
- Coordenadas visuais.
- Territórios adjacentes.
- Vértices vizinhos.
- Arestas ligadas.
- Construção existente.
- Proprietário.
- Porto associado.
- Estado válido ou inválido para construção.

## 10.3 Aresta

Cada aresta possui:

- `id`
- Dois vértices.
- Territórios adjacentes.
- Tipo permitido.
- Segmento existente.
- Proprietário.
- Estado terrestre ou marítimo.

Não podem existir vértices ou arestas duplicados entre hexágonos adjacentes.

---

# 11. Peças por jogador

Cada jogador possui:

- 15 segmentos de ligação no total.
- 5 Vilas.
- 4 Cidades Muralhadas.
- 1 Feitoria.
- 1 Monumento.

Os 15 segmentos podem ser distribuídos livremente entre:

- Caminhos Reais.
- Rotas Marítimas.

Exemplos:

- 15 Caminhos Reais.
- 10 Caminhos Reais e 5 Rotas Marítimas.
- 7 Caminhos Reais e 8 Rotas Marítimas.

---

# 12. Construções e custos

## 12.1 Caminho Real

Custo:

- 1 Pedra.
- 1 Cortiça.

Regras:

- Deve ocupar uma aresta terrestre livre.
- Deve estar ligado a uma construção ou segmento do próprio jogador.
- Não pode atravessar uma Vila ou Cidade adversária.
- Conta para a Maior Rede do Reino.

Representação visual:

- Calçada portuguesa.
- Pequenos marcos.
- Símbolo da Casa.

## 12.2 Rota Marítima

Custo:

- 1 Cortiça.
- 1 Ferro.

Regras:

- Deve ocupar uma ligação marítima livre.
- Deve começar ou continuar a partir de uma Vila costeira, Cidade costeira, Porto, Feitoria ou Rota Marítima própria.
- Não pode atravessar uma zona bloqueada pela Tempestade.
- Conta para a Maior Rede do Reino.
- Utiliza o mesmo limite de 15 segmentos.

Representação visual:

- Linha de ondas.
- Pequena embarcação.
- Boias ou bandeira da Casa.

## 12.3 Fundar Vila

Custo:

- 1 Pedra.
- 1 Cortiça.
- 1 Trigo.
- 1 Bacalhau.

Regras:

- Deve ocupar um vértice vazio.
- Deve respeitar a regra de distância.
- Deve estar ligada a uma rede própria, exceto durante a preparação inicial.
- Produz um recurso por território adjacente elegível.
- Vale 1 ponto de Prestígio.

## 12.4 Erguer Cidade Muralhada

Custo:

- 3 Ferros.
- 2 Trigos.

Regras:

- Apenas pode substituir uma Vila própria.
- A peça de Vila regressa à reserva do jogador.
- Produz dois recursos por território adjacente elegível.
- Vale 2 pontos no total, não 2 pontos adicionais.

## 12.5 Construir Feitoria

Custo:

- 1 Cortiça.
- 1 Ferro.
- 1 Bacalhau.

Regras:

- Apenas pode ser construída num Porto controlado pelo jogador.
- Máximo de uma Feitoria por jogador.
- Vale 1 ponto.
- Permite cumprir Contratos Marítimos.
- Uma vez por turno, permite trocar:
  - 2 Cortiças por 1 recurso à escolha; ou
  - 2 Bacalhaus por 1 recurso à escolha.

## 12.6 Construir Monumento

Regras:

- Máximo de um Monumento por jogador.
- Máximo de dois Monumentos construídos em toda a partida.
- Cada Monumento custa seis recursos.
- Cada Monumento vale 2 pontos.
- Cada Monumento concede uma vantagem pequena e permanente.
- A construção deve ocorrer numa Cidade Muralhada própria.

---

# 13. Regra de distância

Não é permitido fundar uma Vila num vértice diretamente ligado a outra Vila ou Cidade Muralhada.

Entre duas povoações deve existir, no mínimo, um vértice vazio.

A interface deve:

- Destacar vértices válidos.
- Impedir cliques inválidos.
- Explicar o motivo da invalidação.

---

# 14. Portos

Os Portos existem no mapa desde o início.

Distribuição recomendada:

- 4 Portos Gerais de 3:1.
- 1 Porto de Cortiça de 2:1.
- 1 Porto de Pedra de 2:1.
- 1 Porto de Trigo de 2:1.
- 1 Porto de Bacalhau de 2:1.
- 1 Porto de Ferro de 2:1.

Um jogador utiliza um Porto quando possui uma Vila ou Cidade Muralhada num dos vértices associados.

## 14.1 Porto Geral

- Entregar 3 recursos iguais.
- Receber 1 recurso à escolha.

## 14.2 Porto Especializado

- Entregar 2 unidades do recurso indicado.
- Receber 1 recurso à escolha.

---

# 15. Comércio

## 15.1 Comércio entre jogadores

Durante o próprio turno, o jogador ativo pode:

- Oferecer recursos.
- Pedir recursos.
- Receber propostas alternativas.
- Aceitar ou rejeitar.

Regras:

- Um dos intervenientes tem de ser o jogador ativo.
- Ambas as partes devem confirmar.
- O motor valida a posse dos recursos antes de concluir.
- Não são permitidos empréstimos ou promessas futuras.

## 15.2 Comércio com a Reserva da Coroa

Taxa normal:

- 4 recursos iguais por 1 recurso à escolha.

Portos e Feitorias podem melhorar a taxa.

---

# 16. Preparação inicial

## 16.1 Ordem

A ordem dos jogadores é sorteada.

A colocação inicial segue o formato serpente:

1. Jogador 1.
2. Jogador 2.
3. Jogador 3.
4. Jogador 4.
5. Jogador 4 novamente.
6. Jogador 3.
7. Jogador 2.
8. Jogador 1.

Com menos jogadores, mantém-se o mesmo princípio de ida e volta.

## 16.2 Colocação

Em cada colocação, o jogador coloca:

- 1 Vila.
- 1 segmento ligado à Vila.

O segmento pode ser:

- Caminho Real; ou
- Rota Marítima, caso a Vila seja costeira e a ligação seja válida.

## 16.3 Recursos iniciais

Depois de colocar a segunda Vila, o jogador recebe:

- 1 recurso de cada território produtivo adjacente.

Terras Abandonadas não produzem.

---

# 17. Estrutura de um turno

## Fase 1 — Carta antes dos dados

O jogador pode utilizar uma Carta da Coroa elegível antes de lançar os dados.

Regras:

- Máximo de uma carta ativada por turno.
- Cartas compradas no mesmo turno não podem ser utilizadas.
- Cartas de Prestígio não são ativadas.

## Fase 2 — Lançamento dos dados

- O jogador lança dois dados de seis faces.
- O resultado total é apresentado.
- Os territórios correspondentes ficam destacados.
- A interface bloqueia lançamentos repetidos.

## Fase 3 — Produção ou evento 7

Se o resultado não for 7:

- Os territórios com o número lançado produzem.
- Vilas recebem 1 recurso.
- Cidades Muralhadas recebem 2 recursos.
- Territórios bloqueados não produzem.

Se o resultado for 7:

- Aplicar as regras da secção 18.

## Fase 4 — Comércio e ações

O jogador pode, em qualquer ordem:

- Negociar.
- Construir Caminhos Reais.
- Construir Rotas Marítimas.
- Fundar Vilas.
- Erguer Cidades Muralhadas.
- Construir uma Feitoria.
- Construir um Monumento.
- Comprar uma Carta da Coroa.
- Cumprir um Contrato.
- Utilizar uma Carta da Coroa, caso ainda não tenha utilizado uma.

## Fase 5 — Verificação de vitória

Depois de cada ação que conceda Prestígio:

- Recalcular pontuação.
- Revelar Prestígio secreto apenas se necessário.
- Terminar imediatamente a partida se o jogador atingir 12 pontos no próprio turno.

## Fase 6 — Concluir Jornada

- Guardar automaticamente.
- Ocultar informação privada.
- Passar o controlo ao jogador seguinte.

---

# 18. Evento do resultado 7

Quando os dados totalizam 7:

## 18.1 Descartes

Todos os jogadores com mais de 7 recursos descartam metade.

Arredondamento:

- Sempre para baixo.

Exemplos:

- 8 cartas: descarta 4.
- 9 cartas: descarta 4.
- 11 cartas: descarta 5.

Cada jogador escolhe os recursos a descartar.

## 18.2 Escolha da ameaça

O jogador ativo escolhe uma das ações:

- Mover o Contrabandista.
- Mover a Tempestade Atlântica.

Apenas uma ameaça pode estar ativa.

Quando uma ameaça entra em jogo:

- A outra regressa à respetiva zona neutra.

## 18.3 Contrabandista

- É colocado num território terrestre diferente.
- Bloqueia a produção desse território.
- O jogador ativo escolhe um adversário com uma construção adjacente.
- Retira aleatoriamente 1 recurso desse adversário.

## 18.4 Tempestade Atlântica

Pode ser colocada:

- Numa região costeira; ou
- Numa ligação marítima.

Efeitos:

- Região costeira: bloqueia a produção.
- Ligação marítima: interrompe temporariamente a continuidade dessa ligação.
- O jogador ativo pode retirar aleatoriamente 1 recurso de um adversário com presença costeira adjacente à zona afetada, representando perda de carga.

A Tempestade nunca bloqueia várias regiões ou ligações em simultâneo.

---

# 19. Cartas da Coroa

## 19.1 Custo

Comprar uma Carta da Coroa custa:

- 1 Ferro.
- 1 Trigo.
- 1 Bacalhau.

## 19.2 Baralho

| Carta | Quantidade |
|---|---:|
| Capitão da Guarda | 14 |
| Prestígio | 5 |
| Mestres das Rotas | 2 |
| Abastecimento do Reino | 2 |
| Monopólio da Coroa | 2 |

Total: **25 cartas**.

## 19.3 Capitão da Guarda

- Permite mover o Contrabandista ou a Tempestade.
- Aplica o respetivo efeito.
- Conta para o prémio Maior Poder Militar.

## 19.4 Mestres das Rotas

Permite construir gratuitamente dois segmentos:

- Dois Caminhos Reais.
- Duas Rotas Marítimas.
- Um de cada tipo.

Todas as regras normais de ligação continuam a aplicar-se.

## 19.5 Abastecimento do Reino

O jogador escolhe dois recursos da Reserva da Coroa.

Podem ser:

- Iguais.
- Diferentes.

## 19.6 Monopólio da Coroa

O jogador escolhe um recurso.

Todos os adversários entregam-lhe todas as cartas desse recurso.

## 19.7 Prestígio

- Vale 1 ponto secreto.
- Não precisa de ser ativada.
- Pode ser revelada apenas quando necessária para vencer.

---

# 20. Contratos da Coroa

## 20.1 Estrutura

- Existem sempre 3 Contratos visíveis.
- Quando um é concluído, revela-se outro.
- Cada jogador pode obter, no máximo, 3 pontos através de Contratos.

## 20.2 Tipos

### Contrato simples

- Custa 3 recursos.
- Concede uma vantagem imediata.
- Não concede Prestígio.

### Contrato médio

- Custa 4 recursos.
- Concede 1 ponto.

### Contrato importante

- Custa 5 ou 6 recursos.
- Concede 2 pontos.

## 20.3 Composição recomendada

- 6 Contratos simples.
- 8 Contratos médios.
- 4 Contratos importantes.

Total: **18 Contratos**.

## 20.4 Exemplos

### Abastecer a Capital

Custo:

- 2 Trigos.
- 2 Bacalhaus.

Recompensa:

- 1 ponto.

### Reconstruir a Fortaleza

Custo:

- 2 Pedras.
- 2 Ferros.
- 1 Cortiça.

Recompensa:

- 2 pontos.

### Exportação de Cortiça

Custo:

- 3 Cortiças.
- 1 Bacalhau.

Recompensa:

- 1 ponto.
- Uma troca imediata de 2:1.

### Abrir uma Rota Comercial

Condição:

- Possuir pelo menos 3 Rotas Marítimas contínuas e uma Feitoria.

Recompensa:

- 1 ponto.

---

# 21. Monumentos

Criar um baralho ou conjunto de cinco Monumentos fictícios.

## 21.1 Torre do Atlântico

Custo:

- 2 Pedras.
- 2 Ferros.
- 1 Cortiça.
- 1 Bacalhau.

Efeito:

- Uma troca marítima 3:1 permanente.

## 21.2 Mosteiro das Quinas

Custo:

- 3 Pedras.
- 1 Ferro.
- 1 Trigo.
- 1 Cortiça.

Efeito:

- Uma vez por partida, recuperar uma Carta da Coroa utilizada que não seja Prestígio.

## 21.3 Farol das Ilhas

Custo:

- 2 Pedras.
- 1 Ferro.
- 2 Cortiças.
- 1 Bacalhau.

Efeito:

- Uma Rota Marítima própria ignora a Tempestade uma vez por turno.

## 21.4 Paço do Montado

Custo:

- 2 Pedras.
- 2 Cortiças.
- 1 Trigo.
- 1 Ferro.

Efeito:

- Uma vez por turno, trocar 2 Cortiças por 1 recurso.

## 21.5 Fortaleza do Tejo

Custo:

- 3 Pedras.
- 2 Ferros.
- 1 Trigo.

Efeito:

- A Cidade onde foi construída não pode ser alvo de roubo.

Todos os Monumentos:

- Valem 2 pontos.
- Exigem uma Cidade Muralhada.
- Devem ter efeitos moderados.
- Devem ser testados por simulação.

---

# 22. Prémios

## 22.1 Maior Rede do Reino

O primeiro jogador a possuir uma rede contínua de, pelo menos, 5 segmentos recebe:

- 2 pontos.

A rede pode incluir:

- Caminhos Reais.
- Rotas Marítimas.
- Combinações dos dois, desde que exista continuidade válida.

Regras:

- Uma aresta não pode ser contada duas vezes.
- Uma construção adversária interrompe a rede.
- Ramificações não podem ser somadas de forma inválida.
- Ciclos são permitidos.
- Em empate, o prémio permanece com o atual detentor.
- Outro jogador deve possuir uma rede estritamente maior para conquistar o prémio.

## 22.2 Maior Poder Militar

O primeiro jogador a utilizar 3 cartas Capitão da Guarda recebe:

- 2 pontos.

Outro jogador precisa de ter utilizado mais cartas do que o detentor atual.

Em empate, o prémio não muda.

---

# 23. Pontuação

| Fonte | Prestígio |
|---|---:|
| Vila | 1 |
| Cidade Muralhada | 2 no total |
| Feitoria | 1 |
| Monumento | 2 |
| Maior Rede do Reino | 2 |
| Maior Poder Militar | 2 |
| Contratos | 1 ou 2 |
| Carta de Prestígio | 1 |

Limites:

- Máximo de 3 pontos por jogador através de Contratos.
- Máximo de 1 Feitoria por jogador.
- Máximo de 1 Monumento por jogador.
- Máximo de 2 Monumentos construídos na partida.

Vitória:

- 12 pontos durante o próprio turno.

---

# 24. Casas dos jogadores

## 24.1 Casas base

### Casa do Atlântico

- Cor: azul-marinho.
- Símbolo: onda.
- Padrão: linhas onduladas.

### Casa da Serra

- Cor: verde-esmeralda.
- Símbolo: montanha.
- Padrão: triângulos.

### Casa do Sol

- Cor: ocre.
- Símbolo: sol.
- Padrão: raios.

### Casa do Tejo

- Cor: bordô.
- Símbolo: embarcação.
- Padrão: linhas diagonais.

## 24.2 Habilidades assimétricas

As habilidades próprias das Casas pertencem ao **Modo Avançado**.

No Modo Base:

- Todas as Casas são mecanicamente iguais.
- Apenas cor, símbolo e identidade visual mudam.

No Modo Avançado, podem existir pequenas vantagens, mas só devem ser ativadas após testes de equilíbrio.

---

# 25. Privacidade no mesmo dispositivo

No início de cada turno:

1. Mostrar o nome do jogador seguinte.
2. Pedir para passar o dispositivo.
3. Ocultar recursos e cartas.
4. Exibir o botão “Iniciar Jornada”.
5. Só depois revelar o painel privado.

Ao terminar:

- Ocultar novamente a informação.
- Guardar automaticamente.
- Preparar o próximo jogador.

---

# 26. Registo da partida

O histórico deve apresentar:

- Lançamentos.
- Produção.
- Construções.
- Trocas.
- Contratos.
- Cartas públicas.
- Prémios.
- Tempestade.
- Contrabandista.
- Pontuação pública.

Exemplos:

- “A Casa do Atlântico lançou 8.”
- “Os Montados produziram Cortiça.”
- “A Casa da Serra fundou uma Vila.”
- “Foi construída uma Rota Marítima.”
- “A Tempestade interrompeu uma rota.”
- “A Casa do Tejo concluiu um Contrato da Coroa.”
- “A Casa do Sol conquistou a Maior Rede do Reino.”

Não revelar:

- Recurso roubado.
- Recursos privados.
- Cartas privadas.
- Prestígio secreto antes da vitória.

---

# 27. Direção artística

## 27.1 Estilo principal

- Ilustração digital pintada à mão.
- Jogo de tabuleiro premium.
- Perspetiva ligeiramente isométrica.
- Formas limpas.
- Sombras suaves.
- Texturas discretas.
- Cores naturais.
- Leitura clara em tamanhos reduzidos.
- Identidade portuguesa sofisticada.

Evitar:

- Fotografia.
- 3D genérico.
- Visual infantil.
- Excesso de ornamentos.
- Interface demasiado escura.
- Cópia visual de jogos existentes.
- Monumentos reais reproduzidos diretamente.

## 27.2 Tabuleiro

O tabuleiro deve parecer um mapa marítimo ilustrado sobre uma mesa.

Elementos:

- Pergaminho.
- Oceano azul profundo.
- Ondas desenhadas.
- Rosa dos ventos original.
- Embarcações decorativas.
- Moldura subtil de azulejo.
- Relevo visual dos territórios.

## 27.3 Territórios

### Montados de Sobro

- Sobreiros de copa larga.
- Troncos parcialmente descortiçados.
- Pilhas de cortiça.
- Solo dourado.
- Muros de pedra.

### Planícies Alentejanas

- Campos dourados.
- Quinta caiada.
- Moinho.
- Caminho de terra.
- Luz quente.

### Costa Atlântica

- Porto piscatório.
- Barcos.
- Redes.
- Estruturas de secagem.
- Farol.
- Gaivotas.
- Espuma do mar.

### Pedreiras

- Granito.
- Blocos cortados.
- Arco em construção.
- Ferramentas.
- Carroça.

### Serras Mineiras

- Montanhas.
- Entrada de mina.
- Carrinho.
- Forja.
- Minério.

### Terras Abandonadas

- Torre em ruínas.
- Estrada invadida por vegetação.
- Árvore seca.
- Casas vazias.
- Cores desaturadas.

---

# 28. Construções visuais

## Caminho Real

- Calçada portuguesa.
- Pequenos marcos.
- Faixa da Casa.

## Rota Marítima

- Ondas.
- Miniatura de embarcação.
- Boias ou bandeira.

## Vila

- Casas caiadas.
- Telhados de barro.
- Pequena torre.
- Bandeira.

## Cidade Muralhada

- Muralha.
- Torre central.
- Portão.
- Casas interiores.
- Bandeiras.

## Feitoria

- Cais.
- Armazém.
- Barris.
- Caixas.
- Grua de madeira.
- Barco atracado.

## Monumento

- Arquitetura fictícia portuguesa.
- Silhueta única.
- Grande presença visual.
- Sem copiar monumentos reais.

---

# 29. Marcadores e interface visual

## 29.1 Marcadores numéricos

- Medalhões inspirados em azulejo.
- Fundo marfim.
- Moldura azul.
- Número central grande.
- Pontos de probabilidade.
- 6 e 8 com moldura bordô ou cobre.

## 29.2 Painéis

Utilizar:

- Madeira escura.
- Pergaminho.
- Pedra clara.
- Azulejo como acento.

Não utilizar padrões fortes em todas as áreas.

## 29.3 Casas e acessibilidade

Cada Casa deve ser identificável por:

- Cor.
- Símbolo.
- Padrão.
- Forma visual.

O jogo não pode depender apenas da cor.

---

# 30. Contrabandista e Tempestade — imagem

## Contrabandista

- Capa castanha.
- Chapéu largo.
- Lanterna.
- Saco de mercadorias.
- Sem armas em destaque.

## Tempestade

- Nuvem translúcida.
- Ondas elevadas.
- Relâmpago branco.
- Redemoinho.
- Efeito animado discreto.

---

# 31. Cartas e Contratos — imagem

## Cartas da Coroa

- Fundo de pergaminho.
- Moldura inspirada em azulejo.
- Selo de cera original.
- Ilustração central.
- Título curto.
- Texto objetivo.

Cores:

- Capitão da Guarda: bordô.
- Mestres das Rotas: cinzento-pedra.
- Abastecimento: verde.
- Monopólio: dourado.
- Prestígio: azul-real.

## Contratos

- Documento comercial.
- Recursos necessários.
- Recompensa destacada.
- Ilustração do destino.
- Selo e assinatura fictícios.

---

# 32. Animações

## Produção

- Território ganha brilho.
- Ícone do recurso sobe.
- Ícone desloca-se para o painel do jogador.

## Construção

- Estrutura surge progressivamente.
- Poeira subtil.
- Bandeira abre no final.

## Rota Marítima

- Ondas aparecem.
- Pequena embarcação percorre a ligação.

## Tempestade

- Céu escurece brevemente.
- Ondas aumentam.
- Ligação afetada perde brilho.

## Vitória

- Brasão da Casa.
- Luz sobre o tabuleiro.
- Resumo estatístico.
- Música original discreta.

---

# 33. Som

Sons opcionais:

- Dados.
- Construção.
- Sino de Vila.
- Pedra e martelo.
- Ondas.
- Gaivotas.
- Comércio.
- Tempestade.
- Contrabandista.
- Vitória.

Requisitos:

- Botão para desligar.
- Volume configurável.
- Sem músicas ou gravações protegidas.
- Respeitar a preferência de redução de estímulos.

---

# 34. Interface principal

## Centro

- Tabuleiro.
- Construções.
- Ligações.
- Ameaça ativa.
- Produção.

## Lado esquerdo

- Custos.
- Contratos.
- Reserva de peças.
- Ações possíveis.

## Lado direito

- Jogadores.
- Prestígio.
- Prémios.
- Histórico.

## Barra inferior

- Recursos privados.
- Cartas da Coroa.
- Botões de ação.
- “Concluir Jornada”.

---

# 35. Ecrãs necessários

1. Menu principal.
2. Nova partida.
3. Configuração de jogadores.
4. Tutorial.
5. Preparação inicial.
6. Tabuleiro principal.
7. Comércio.
8. Descartes.
9. Escolha da ameaça.
10. Seleção de alvo.
11. Cartas da Coroa.
12. Contratos.
13. Monumentos.
14. Pausa.
15. Definições.
16. Vitória.
17. Histórico de partidas.

---

# 36. Requisitos técnicos

## 36.1 Primeira versão

Criar inicialmente com:

- HTML.
- CSS.
- JavaScript.
- SVG inline.
- Canvas apenas quando necessário.
- `localStorage` ou IndexedDB para gravação.
- Sem servidor obrigatório.
- Sem API paga.
- Sem dependências externas obrigatórias.

## 36.2 Arquitetura recomendada

```text
conquistador/
├── index.html
├── README.md
├── docs/
│   └── CONQUISTADOR_MASTER_SPEC.md
├── src/
│   ├── main.js
│   ├── game/
│   │   ├── Game.js
│   │   ├── Board.js
│   │   ├── Player.js
│   │   ├── Bank.js
│   │   ├── RulesEngine.js
│   │   ├── ScoreEngine.js
│   │   ├── RouteEngine.js
│   │   ├── TradeManager.js
│   │   ├── ContractManager.js
│   │   ├── CrownDeck.js
│   │   └── MonumentManager.js
│   ├── ui/
│   │   ├── UIManager.js
│   │   ├── BoardRenderer.js
│   │   ├── ModalManager.js
│   │   └── AnimationManager.js
│   ├── data/
│   │   ├── resources.js
│   │   ├── cards.js
│   │   ├── contracts.js
│   │   ├── monuments.js
│   │   └── houses.js
│   ├── storage/
│   │   └── SaveManager.js
│   └── simulation/
│       ├── Simulator.js
│       └── Metrics.js
├── styles/
│   ├── base.css
│   ├── board.css
│   ├── components.css
│   └── responsive.css
└── assets/
    ├── icons/
    ├── territories/
    ├── buildings/
    ├── cards/
    └── audio/
```

O primeiro protótipo pode começar num único `index.html`, mas a versão de desenvolvimento deve evoluir para esta estrutura.

---

# 37. Estado do jogo

O estado persistente deve incluir:

- Versão do formato.
- Identificador da partida.
- Data de criação.
- Jogadores.
- Ordem.
- Jogador atual.
- Fase.
- Dados lançados.
- Territórios.
- Vértices.
- Arestas.
- Construções.
- Recursos.
- Cartas.
- Contratos.
- Monumentos.
- Portos.
- Feitorias.
- Contrabandista.
- Tempestade.
- Prémios.
- Pontuação.
- Histórico.
- Configurações.
- Estado de vitória.

---

# 38. Validações obrigatórias

Antes de qualquer ação:

- Confirmar o jogador ativo.
- Confirmar a fase.
- Confirmar os recursos.
- Confirmar peças disponíveis.
- Confirmar localização válida.
- Confirmar ligação à rede.
- Confirmar regra de distância.
- Confirmar tipo de aresta.
- Confirmar estado da Tempestade.
- Confirmar limite de Feitoria.
- Confirmar limite de Monumento.
- Confirmar limite de Contratos.
- Confirmar elegibilidade da Carta.
- Confirmar que o jogo ainda não terminou.

Nunca permitir:

- Recursos negativos.
- Peças duplicadas.
- Construções sobrepostas.
- Duplo clique que replique uma ação.
- Cartas utilizadas no turno de compra.
- Vitória fora do turno do jogador.
- Alteração do estado durante animações críticas.

---

# 39. Gravação

## 39.1 Automática

Guardar:

- No fim de cada ação importante.
- No fim de cada turno.
- Antes de fechar ou recarregar, quando possível.

## 39.2 Manual

Botões:

- Guardar partida.
- Exportar partida.
- Importar partida.
- Reiniciar.
- Duplicar para teste.

## 39.3 Compatibilidade

O ficheiro guardado deve incluir:

- `saveVersion`
- Migrações entre versões.
- Validação de integridade.
- Tratamento de erros.

---

# 40. Acessibilidade

Implementar:

- Navegação por teclado.
- `aria-label`.
- Contraste adequado.
- Padrões para distinguir jogadores.
- Ícones além da cor.
- Redução de animações.
- Alto contraste.
- Tamanho de texto configurável.
- Sons opcionais.
- Mensagens de erro claras.
- Alvos táteis adequados.

---

# 41. Inteligência artificial futura

## Fácil

- Ações válidas aleatórias.
- Prioridade básica a recursos em falta.
- Comércio pouco eficiente.

## Normal

- Avaliação de probabilidades.
- Diversificação de recursos.
- Expansão coerente.
- Utilização racional de Portos.

## Difícil

- Avaliação de produção esperada.
- Gestão de contratos.
- Bloqueio do líder.
- Planeamento de custos.
- Comparação de valor marginal.
- Sem acesso a informação privada.

A IA não deve ser usada para validar o protótipo até o motor de regras estar estável.

---

# 42. Simulação e equilíbrio

Antes de considerar o jogo equilibrado, executar pelo menos:

- 1.000 partidas simuladas na fase inicial.
- 10.000 partidas antes da versão pública.

Métricas:

- Taxa de vitória por posição.
- Taxa de vitória por Casa.
- Duração média.
- Número médio de turnos.
- Valor médio de cada recurso.
- Recursos em falta na Reserva.
- Frequência de cada construção.
- Frequência de Contratos.
- Frequência de Monumentos.
- Vantagem da Maior Rede.
- Vantagem do Poder Militar.
- Vitórias por estratégia.
- Impacto do Contrabandista.
- Impacto da Tempestade.

Objetivos:

- Nenhuma posição inicial com vantagem superior a 5–7%.
- Nenhuma Casa dominante.
- Nenhum recurso inútil.
- Nenhum recurso permanentemente bloqueante.
- Contratos úteis, mas não dominantes.
- Monumentos raros e relevantes.
- Partidas entre aproximadamente 60 e 100 turnos totais.

---

# 43. Fases de desenvolvimento

## Fase 1 — Motor matemático

Implementar:

- Dados.
- Produção.
- Custos.
- Reserva.
- Construções.
- Pontuação.
- Simulações.

Sem grafismo final.

## Fase 2 — Núcleo jogável

Implementar:

- Tabuleiro.
- Colocação inicial.
- Turnos.
- Comércio.
- Vilas.
- Cidades.
- Caminhos.
- Resultado 7.
- Vitória.

## Fase 3 — Identidade original

Adicionar:

- Rotas Marítimas.
- Tempestade.
- Feitorias.
- Contratos.
- Monumentos.
- Cartas da Coroa.
- Maior Rede combinada.

## Fase 4 — Grafismo

Adicionar:

- Territórios ilustrados.
- Ícones SVG.
- Construções.
- Cartas.
- Animações.
- Sons.
- Interface premium.

## Fase 5 — Testes e equilíbrio

Executar:

- Testes unitários.
- Testes de integração.
- Simulações.
- Partidas humanas.
- Correções de economia.
- Testes de acessibilidade.
- Testes em telemóvel.

---

# 44. Critérios de conclusão da primeira versão

A primeira versão só está concluída quando:

- É possível iniciar uma partida.
- A colocação inicial funciona.
- Os números são distribuídos de forma válida.
- Os dados produzem corretamente.
- O resultado 7 funciona.
- Caminhos e Rotas são validados.
- Vilas e Cidades funcionam.
- O comércio funciona.
- Portos funcionam.
- Feitorias funcionam.
- Cartas funcionam.
- Contratos funcionam.
- Monumentos funcionam.
- Os prémios são calculados.
- A vitória é detetada.
- A partida pode ser guardada e retomada.
- Não existem recursos negativos.
- Não existem peças duplicadas.
- A interface funciona em computador e telemóvel.
- O jogo pode ser concluído sem intervenção técnica.

---

# 45. Decisões bloqueadas para a versão 1.0

Estas decisões estão fechadas:

- Nome: **Conquistador: Terras e Rotas do Atlântico**.
- 5 recursos.
- Cortiça obrigatória.
- Bacalhau obrigatório.
- Pedra em vez de Barro como recurso principal.
- 19 territórios.
- Distribuição 4–4–4–3–3–1.
- Vitória aos 12 pontos.
- 15 segmentos partilhados entre terra e mar.
- Uma Feitoria por jogador.
- Um Monumento por jogador.
- Dois Monumentos no máximo por partida.
- Máximo de 3 pontos de Contratos por jogador.
- Apenas uma ameaça ativa.
- Casas sem poderes no Modo Base.
- Grafismo português original.
- Desenvolvimento sem API paga obrigatória.

---

# 46. Próximo passo operacional

O próximo passo é criar o **protótipo do motor matemático**, antes do grafismo final.

Primeiros módulos:

1. Modelo de dados do tabuleiro.
2. Gerador dos 19 territórios.
3. Distribuição validada dos números.
4. Jogadores e recursos.
5. Lançamento dos dados.
6. Produção.
7. Reserva da Coroa.
8. Custos e validações.
9. Pontuação.
10. Simulador automático.

Só depois de estes módulos funcionarem deve ser criado o tabuleiro visual completo.

---

# 47. Registo de versões

## 1.0

- Consolidação inicial.
- Tema português final.
- Recursos finais definidos.
- Economia principal fechada.
- Mecânicas terrestres e marítimas consolidadas.
- Direção artística consolidada.
- Estrutura técnica e plano de testes definidos.

---

**Fim do Documento Mestre — versão 1.0**
