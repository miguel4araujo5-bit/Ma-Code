import { SeaRouteEngine } from './SeaRouteEngine.js';

export const BUILD_COSTS = Object.freeze({
  road: Object.freeze({
    stone: 1,
    cork: 1,
  }),
  village: Object.freeze({
    stone: 1,
    cork: 1,
    wheat: 1,
    cod: 1,
  }),
  city: Object.freeze({
    iron: 3,
    wheat: 2,
  }),
  seaRoute: Object.freeze({
    cork: 1,
    iron: 1,
  }),
  tradingPost: Object.freeze({
    cork: 1,
    iron: 1,
    cod: 1,
  }),
  crownCard: Object.freeze({
    iron: 1,
    wheat: 1,
    cod: 1,
  }),
});

function validResult(extra = {}) {
  return {
    valid: true,
    reason: null,
    ...extra,
  };
}

function invalidResult(reason, extra = {}) {
  return {
    valid: false,
    reason,
    ...extra,
  };
}

function findVertex(board, vertexId) {
  return board.vertices.find(
    (vertex) => vertex.id === vertexId,
  );
}

function findEdge(board, edgeId) {
  return board.edges.find(
    (edge) => edge.id === edgeId,
  );
}

function getConnectedEdges(board, vertex) {
  const edgeIds = new Set(vertex.edgeIds || []);

  return board.edges.filter(
    (edge) => edgeIds.has(edge.id),
  );
}

function hasAdjacentBuilding(board, vertex) {
  return (vertex.neighborVertexIds || []).some(
    (neighborVertexId) => {
      const neighbor = findVertex(
        board,
        neighborVertexId,
      );

      return Boolean(
        neighbor?.building,
      );
    },
  );
}

function isUsablePlayerSegment(
  edge,
  playerId,
) {
  if (
    edge.ownerId !==
    playerId
  ) {
    return false;
  }

  if (
    edge.segment ===
    'road'
  ) {
    return true;
  }

  if (
    edge.segment ===
    'sea-route'
  ) {
    return !edge.stormBlocked;
  }

  return false;
}

function hasPlayerNetworkAtVertex(
  board,
  playerId,
  vertex,
) {
  return getConnectedEdges(
    board,
    vertex,
  ).some(
    (edge) =>
      isUsablePlayerSegment(
        edge,
        playerId,
      ),
  );
}

function endpointAllowsRoadConnection(
  board,
  playerId,
  vertex,
  ignoredEdgeId,
) {
  if (
    vertex.building &&
    vertex.ownerId === playerId
  ) {
    return true;
  }

  if (
    vertex.building &&
    vertex.ownerId !== playerId
  ) {
    return false;
  }

  return getConnectedEdges(
    board,
    vertex,
  ).some(
    (edge) =>
      edge.id !== ignoredEdgeId &&
      edge.ownerId === playerId &&
      edge.segment === 'road',
  );
}

export class RulesEngine {
  constructor() {
    this.seaRoutes =
      new SeaRouteEngine();
  }

  validateInitialVillage({
    board,
    player,
    vertexId,
  }) {
    return this.validateVillage({
      board,
      player,
      vertexId,
      initialPlacement: true,
    });
  }

  validateVillage({
    board,
    player,
    vertexId,
    initialPlacement = false,
  }) {
    if (
      !board?.vertices ||
      !board?.edges
    ) {
      return invalidResult(
        'O tabuleiro ainda não possui vértices e arestas.',
      );
    }

    const vertex =
      findVertex(
        board,
        vertexId,
      );

    if (!vertex) {
      return invalidResult(
        'O vértice selecionado não existe.',
      );
    }

    if (vertex.building) {
      return invalidResult(
        'Este local já possui uma construção.',
      );
    }

    if (
      hasAdjacentBuilding(
        board,
        vertex,
      )
    ) {
      return invalidResult(
        'Deve existir pelo menos um vértice vazio entre duas povoações.',
      );
    }

    if (
      !player.hasPiece(
        'villages',
      )
    ) {
      return invalidResult(
        'Já não possui peças de Vila disponíveis.',
      );
    }

    if (!initialPlacement) {
      if (
        !hasPlayerNetworkAtVertex(
          board,
          player.id,
          vertex,
        )
      ) {
        return invalidResult(
          'A nova Vila deve estar ligada à sua rede.',
        );
      }

      if (
        !player.canAfford(
          BUILD_COSTS.village,
        )
      ) {
        return invalidResult(
          'Não possui recursos suficientes para fundar uma Vila.',
          {
            cost:
              BUILD_COSTS.village,
          },
        );
      }
    }

    return validResult({
      vertex,
      cost:
        initialPlacement
          ? {}
          : BUILD_COSTS.village,
    });
  }

  validateInitialRoad({
    board,
    player,
    edgeId,
    requiredVertexId,
  }) {
    return this.validateRoad({
      board,
      player,
      edgeId,
      initialPlacement: true,
      requiredVertexId,
    });
  }

  validateRoad({
    board,
    player,
    edgeId,
    initialPlacement = false,
    requiredVertexId = null,
  }) {
    if (
      !board?.vertices ||
      !board?.edges
    ) {
      return invalidResult(
        'O tabuleiro ainda não possui vértices e arestas.',
      );
    }

    const edge =
      findEdge(
        board,
        edgeId,
      );

    if (!edge) {
      return invalidResult(
        'A ligação selecionada não existe.',
      );
    }

    if (
      edge.segment ||
      edge.ownerId
    ) {
      return invalidResult(
        'Esta ligação já está ocupada.',
      );
    }

    if (edge.isCoastal) {
      return invalidResult(
        'Um Caminho Real não pode ocupar uma ligação marítima.',
      );
    }

    if (
      edge.type !==
      'land'
    ) {
      return invalidResult(
        'Um Caminho Real só pode ser construído numa ligação terrestre.',
      );
    }

    if (
      !player.hasPiece(
        'segments',
      )
    ) {
      return invalidResult(
        'Já não possui segmentos disponíveis.',
      );
    }

    if (initialPlacement) {
      if (!requiredVertexId) {
        return invalidResult(
          'A colocação inicial precisa da Vila de origem.',
        );
      }

      if (
        !edge.vertexIds.includes(
          requiredVertexId,
        )
      ) {
        return invalidResult(
          'O Caminho inicial deve estar ligado à Vila acabada de colocar.',
        );
      }

      const originVertex =
        findVertex(
          board,
          requiredVertexId,
        );

      if (
        !originVertex ||
        originVertex.ownerId !==
          player.id ||
        originVertex.building !==
          'village'
      ) {
        return invalidResult(
          'A Vila de origem não pertence ao jogador ativo.',
        );
      }

      return validResult({
        edge,
        cost: {},
      });
    }

    const connected =
      edge.vertexIds.some(
        (vertexId) => {
          const vertex =
            findVertex(
              board,
              vertexId,
            );

          if (!vertex) {
            return false;
          }

          return endpointAllowsRoadConnection(
            board,
            player.id,
            vertex,
            edge.id,
          );
        },
      );

    if (!connected) {
      return invalidResult(
        'O Caminho deve estar ligado a uma construção ou Caminho seu.',
      );
    }

    if (
      !player.canAfford(
        BUILD_COSTS.road,
      )
    ) {
      return invalidResult(
        'Não possui recursos suficientes para construir um Caminho Real.',
        {
          cost:
            BUILD_COSTS.road,
        },
      );
    }

    return validResult({
      edge,
      cost:
        BUILD_COSTS.road,
    });
  }

  validateInitialSeaRoute({
    board,
    player,
    edgeId,
    requiredVertexId,
  }) {
    return this.validateSeaRoute({
      board,
      player,
      edgeId,
      initialPlacement: true,
      requiredVertexId,
    });
  }

  validateSeaRoute({
    board,
    player,
    edgeId,
    initialPlacement = false,
    requiredVertexId = null,
  }) {
    if (
      !board?.vertices ||
      !board?.edges
    ) {
      return invalidResult(
        'O tabuleiro ainda não possui vértices e arestas.',
      );
    }

    const edge =
      findEdge(
        board,
        edgeId,
      );

    if (!edge) {
      return invalidResult(
        'A ligação marítima selecionada não existe.',
      );
    }

    if (
      !player.hasPiece(
        'segments',
      )
    ) {
      return invalidResult(
        'Já não possui segmentos disponíveis.',
      );
    }

    const placement =
      this.seaRoutes
        .validatePlacement({
          board,
          playerId:
            player.id,
          edge,
          initialPlacement,
          requiredVertexId,
        });

    if (!placement.valid) {
      return invalidResult(
        placement.reason,
      );
    }

    if (
      !initialPlacement &&
      !player.canAfford(
        BUILD_COSTS
          .seaRoute,
      )
    ) {
      return invalidResult(
        'Não possui recursos suficientes para construir uma Rota Marítima.',
        {
          cost:
            BUILD_COSTS
              .seaRoute,
        },
      );
    }

    return validResult({
      edge,
      cost:
        initialPlacement
          ? {}
          : BUILD_COSTS
              .seaRoute,
    });
  }

  validateCity({
    board,
    player,
    vertexId,
  }) {
    const vertex =
      findVertex(
        board,
        vertexId,
      );

    if (!vertex) {
      return invalidResult(
        'O vértice selecionado não existe.',
      );
    }

    if (
      vertex.ownerId !==
        player.id ||
      vertex.building !==
        'village'
    ) {
      return invalidResult(
        'Uma Cidade Muralhada só pode substituir uma Vila sua.',
      );
    }

    if (
      !player.hasPiece(
        'cities',
      )
    ) {
      return invalidResult(
        'Já não possui peças de Cidade Muralhada.',
      );
    }

    if (
      !player.canAfford(
        BUILD_COSTS.city,
      )
    ) {
      return invalidResult(
        'Não possui recursos suficientes para erguer uma Cidade Muralhada.',
        {
          cost:
            BUILD_COSTS.city,
        },
      );
    }

    return validResult({
      vertex,
      cost:
        BUILD_COSTS.city,
    });
  }

  getValidVillageVertexIds({
    board,
    player,
    initialPlacement = false,
  }) {
    return board.vertices
      .filter(
        (vertex) =>
          this.validateVillage({
            board,
            player,
            vertexId:
              vertex.id,
            initialPlacement,
          }).valid,
      )
      .map(
        (vertex) =>
          vertex.id,
      );
  }

  getValidRoadEdgeIds({
    board,
    player,
    initialPlacement = false,
    requiredVertexId = null,
  }) {
    return board.edges
      .filter(
        (edge) =>
          this.validateRoad({
            board,
            player,
            edgeId:
              edge.id,
            initialPlacement,
            requiredVertexId,
          }).valid,
      )
      .map(
        (edge) =>
          edge.id,
      );
  }

  getValidSeaRouteEdgeIds({
    board,
    player,
    initialPlacement = false,
    requiredVertexId = null,
  }) {
    return board.edges
      .filter(
        (edge) =>
          this.validateSeaRoute({
            board,
            player,
            edgeId:
              edge.id,
            initialPlacement,
            requiredVertexId,
          }).valid,
      )
      .map(
        (edge) =>
          edge.id,
      );
  }

  getBuildCost(action) {
    const cost =
      BUILD_COSTS[action];

    if (!cost) {
      throw new Error(
        `Ação de construção desconhecida: ${action}`,
      );
    }

    return {
      ...cost,
    };
  }
}
