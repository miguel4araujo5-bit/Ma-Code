import { GAME_CONFIG } from '../data/gameConfig.js';

const SQRT3 = Math.sqrt(3);
const DEFAULT_HEX_SIZE = 62;

function roundCoordinate(value) {
  return Math.round(value * 1000) / 1000;
}

function pointKey(x, y) {
  return `${roundCoordinate(x)},${roundCoordinate(y)}`;
}

function edgeKey(firstVertexId, secondVertexId) {
  return [firstVertexId, secondVertexId].sort().join('|');
}

export function axialToPixel(q, r, size = DEFAULT_HEX_SIZE) {
  return {
    x: size * SQRT3 * (q + r / 2),
    y: size * 1.5 * r,
  };
}

function calculateCorner(center, size, index) {
  const angle = ((60 * index - 30) * Math.PI) / 180;

  return {
    x: center.x + size * Math.cos(angle),
    y: center.y + size * Math.sin(angle),
  };
}

function assertBoardTopology(vertices, edges) {
  const expectedVertices = GAME_CONFIG.board.expectedVertexCount;
  const expectedEdges = GAME_CONFIG.board.expectedEdgeCount;

  if (vertices.length !== expectedVertices) {
    throw new Error(
      `Topologia inválida: esperavam-se ${expectedVertices} vértices e foram gerados ${vertices.length}.`,
    );
  }

  if (edges.length !== expectedEdges) {
    throw new Error(
      `Topologia inválida: esperavam-se ${expectedEdges} arestas e foram geradas ${edges.length}.`,
    );
  }
}

export function buildBoardTopology(board, size = DEFAULT_HEX_SIZE) {
  if (!board?.territories?.length) {
    throw new Error(
      'Não é possível criar a topologia de um tabuleiro sem territórios.',
    );
  }

  const verticesByPosition = new Map();
  const edgesByVertices = new Map();

  for (const territory of board.territories) {
    const center = axialToPixel(
      territory.q,
      territory.r,
      size,
    );

    const territoryVertexIds = [];
    const territoryEdgeIds = [];

    territory.center = {
      x: roundCoordinate(center.x),
      y: roundCoordinate(center.y),
    };

    for (let index = 0; index < 6; index += 1) {
      const point = calculateCorner(
        center,
        size,
        index,
      );

      const positionKey = pointKey(
        point.x,
        point.y,
      );

      let vertex =
        verticesByPosition.get(positionKey);

      if (!vertex) {
        vertex = {
          id: `vertex-${verticesByPosition.size + 1}`,
          x: roundCoordinate(point.x),
          y: roundCoordinate(point.y),
          territoryIds: [],
          edgeIds: [],
          neighborVertexIds: [],
          building: null,
          ownerId: null,
          isBoundary: false,
        };

        verticesByPosition.set(
          positionKey,
          vertex,
        );
      }

      if (
        !vertex.territoryIds.includes(
          territory.id,
        )
      ) {
        vertex.territoryIds.push(
          territory.id,
        );
      }

      territoryVertexIds.push(
        vertex.id,
      );
    }

    for (let index = 0; index < 6; index += 1) {
      const firstVertexId =
        territoryVertexIds[index];

      const secondVertexId =
        territoryVertexIds[
          (index + 1) % 6
        ];

      const key = edgeKey(
        firstVertexId,
        secondVertexId,
      );

      let edge =
        edgesByVertices.get(key);

      if (!edge) {
        edge = {
          id: `edge-${edgesByVertices.size + 1}`,
          vertexIds: [
            firstVertexId,
            secondVertexId,
          ],
          territoryIds: [],
          segment: null,
          ownerId: null,
          type: 'land',
          isBoundary: false,
        };

        edgesByVertices.set(
          key,
          edge,
        );
      }

      if (
        !edge.territoryIds.includes(
          territory.id,
        )
      ) {
        edge.territoryIds.push(
          territory.id,
        );
      }

      territoryEdgeIds.push(
        edge.id,
      );
    }

    territory.vertexIds =
      territoryVertexIds;

    territory.edgeIds =
      territoryEdgeIds;
  }

  const vertices = [
    ...verticesByPosition.values(),
  ];

  const edges = [
    ...edgesByVertices.values(),
  ];

  const vertexMap = new Map(
    vertices.map(
      (vertex) => [
        vertex.id,
        vertex,
      ],
    ),
  );

  for (const edge of edges) {
    const [
      firstVertexId,
      secondVertexId,
    ] = edge.vertexIds;

    const firstVertex =
      vertexMap.get(
        firstVertexId,
      );

    const secondVertex =
      vertexMap.get(
        secondVertexId,
      );

    if (
      !firstVertex ||
      !secondVertex
    ) {
      throw new Error(
        `A aresta ${edge.id} referencia um vértice inexistente.`,
      );
    }

    firstVertex.edgeIds.push(
      edge.id,
    );

    secondVertex.edgeIds.push(
      edge.id,
    );

    if (
      !firstVertex
        .neighborVertexIds
        .includes(
          secondVertexId,
        )
    ) {
      firstVertex
        .neighborVertexIds
        .push(
          secondVertexId,
        );
    }

    if (
      !secondVertex
        .neighborVertexIds
        .includes(
          firstVertexId,
        )
    ) {
      secondVertex
        .neighborVertexIds
        .push(
          firstVertexId,
        );
    }

    edge.isBoundary =
      edge.territoryIds.length === 1;

    if (edge.isBoundary) {
      firstVertex.isBoundary = true;
      secondVertex.isBoundary = true;
    }
  }

  assertBoardTopology(
    vertices,
    edges,
  );

  return {
    ...board,

    vertices,
    edges,

    topology: {
      version: 2,
      hexSize: size,
      vertexCount:
        vertices.length,
      edgeCount:
        edges.length,
      boundaryEdgeCount:
        edges.filter(
          (edge) =>
            edge.isBoundary,
        ).length,
    },
  };
}

export {
  DEFAULT_HEX_SIZE,
};
