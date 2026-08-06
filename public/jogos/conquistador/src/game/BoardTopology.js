const SQRT3 = Math.sqrt(3);

function roundKey(value) {
  return Math.round(value * 1000) / 1000;
}

function pointKey(x, y) {
  return `${roundKey(x)},${roundKey(y)}`;
}

function edgeKey(firstVertexId, secondVertexId) {
  return [
    firstVertexId,
    secondVertexId,
  ]
    .sort()
    .join('|');
}

export function axialToPixel(
  q,
  r,
  size = 62,
) {
  return {
    x:
      size *
      SQRT3 *
      (q + r / 2),

    y:
      size *
      1.5 *
      r,
  };
}

function calculateCorner(
  center,
  size,
  index,
) {
  const angle =
    (
      (
        60 * index -
        30
      ) *
      Math.PI
    ) /
    180;

  return {
    x:
      center.x +
      size *
      Math.cos(angle),

    y:
      center.y +
      size *
      Math.sin(angle),
  };
}

export function buildBoardTopology(
  board,
  size = 62,
) {
  const verticesByPosition =
    new Map();

  const edgesByVertices =
    new Map();

  for (
    const territory
    of board.territories
  ) {
    const center =
      axialToPixel(
        territory.q,
        territory.r,
        size,
      );

    const territoryVertexIds = [];
    const territoryEdgeIds = [];

    for (
      let index = 0;
      index < 6;
      index += 1
    ) {
      const point =
        calculateCorner(
          center,
          size,
          index,
        );

      const positionKey =
        pointKey(
          point.x,
          point.y,
        );

      let vertex =
        verticesByPosition.get(
          positionKey,
        );

      if (!vertex) {
        vertex = {
          id:
            `vertex-${
              verticesByPosition.size +
              1
            }`,

          x:
            roundKey(point.x),

          y:
            roundKey(point.y),

          territoryIds: [],
          edgeIds: [],
          neighborVertexIds: [],

          building: null,
          ownerId: null,
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

    for (
      let index = 0;
      index < 6;
      index += 1
    ) {
      const firstVertexId =
        territoryVertexIds[index];

      const secondVertexId =
        territoryVertexIds[
          (index + 1) % 6
        ];

      const key =
        edgeKey(
          firstVertexId,
          secondVertexId,
        );

      let edge =
        edgesByVertices.get(key);

      if (!edge) {
        edge = {
          id:
            `edge-${
              edgesByVertices.size +
              1
            }`,

          vertexIds: [
            firstVertexId,
            secondVertexId,
          ],

          territoryIds: [],

          segment: null,
          ownerId: null,
          type: 'land',
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

  const vertices =
    [
      ...verticesByPosition.values(),
    ];

  const edges =
    [
      ...edgesByVertices.values(),
    ];

  const vertexMap =
    new Map(
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
  }

  return {
    ...board,

    vertices,
    edges,

    topology: {
      vertexCount:
        vertices.length,

      edgeCount:
        edges.length,
    },
  };
}
