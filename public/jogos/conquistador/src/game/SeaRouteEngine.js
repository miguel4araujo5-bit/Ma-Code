function findVertex(board, vertexId) {
  return board?.vertices?.find(
    (vertex) => vertex.id === vertexId,
  ) || null;
}

function getConnectedEdges(board, vertex) {
  const edgeIds = new Set(vertex?.edgeIds || []);

  return (board?.edges || []).filter(
    (edge) => edgeIds.has(edge.id),
  );
}

function endpointAllowsSeaConnection(
  board,
  playerId,
  vertex,
  ignoredEdgeId,
) {
  if (!vertex) {
    return false;
  }

  if (
    vertex.building &&
    vertex.ownerId !== playerId
  ) {
    return false;
  }

  if (
    vertex.isCoastal &&
    vertex.building &&
    vertex.ownerId === playerId
  ) {
    return true;
  }

  return getConnectedEdges(board, vertex).some(
    (edge) =>
      edge.id !== ignoredEdgeId &&
      edge.ownerId === playerId &&
      edge.segment === 'sea-route',
  );
}

export class SeaRouteEngine {
  isMaritimeEdge(edge) {
    return Boolean(
      edge?.isBoundary &&
      edge?.isCoastal,
    );
  }

  validatePlacement({
    board,
    playerId,
    edge,
    initialPlacement = false,
    requiredVertexId = null,
  }) {
    if (!board?.vertices || !board?.edges) {
      return {
        valid: false,
        reason: 'O tabuleiro ainda não possui vértices e arestas.',
      };
    }

    if (!edge) {
      return {
        valid: false,
        reason: 'A ligação marítima selecionada não existe.',
      };
    }

    if (!this.isMaritimeEdge(edge)) {
      return {
        valid: false,
        reason: 'Uma Rota Marítima só pode ocupar uma ligação marítima válida.',
      };
    }

    if (edge.segment || edge.ownerId) {
      return {
        valid: false,
        reason: 'Esta ligação já está ocupada.',
      };
    }

    if (initialPlacement) {
      if (!requiredVertexId) {
        return {
          valid: false,
          reason: 'A colocação inicial precisa da Vila costeira de origem.',
        };
      }

      if (!edge.vertexIds.includes(requiredVertexId)) {
        return {
          valid: false,
          reason: 'A Rota Marítima inicial deve estar ligada à Vila acabada de colocar.',
        };
      }

      const originVertex = findVertex(
        board,
        requiredVertexId,
      );

      if (
        !originVertex ||
        !originVertex.isCoastal ||
        originVertex.ownerId !== playerId ||
        originVertex.building !== 'village'
      ) {
        return {
          valid: false,
          reason: 'A Rota Marítima inicial precisa de partir de uma Vila costeira sua.',
        };
      }

      return {
        valid: true,
        reason: null,
      };
    }

    const connected = edge.vertexIds.some(
      (vertexId) =>
        endpointAllowsSeaConnection(
          board,
          playerId,
          findVertex(board, vertexId),
          edge.id,
        ),
    );

    if (!connected) {
      return {
        valid: false,
        reason: 'A Rota Marítima deve partir de presença costeira sua ou continuar outra Rota Marítima sua.',
      };
    }

    return {
      valid: true,
      reason: null,
    };
  }

  getValidEdgeIds({
    board,
    playerId,
    initialPlacement = false,
    requiredVertexId = null,
  }) {
    return (board?.edges || [])
      .filter((edge) =>
        this.validatePlacement({
          board,
          playerId,
          edge,
          initialPlacement,
          requiredVertexId,
        }).valid,
      )
      .map((edge) => edge.id);
  }
}

export default SeaRouteEngine;
