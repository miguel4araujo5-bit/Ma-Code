import {
  GAME_CONFIG,
  probabilityPointsFor,
} from '../data/gameConfig.js';

function countValues(
  values,
) {
  return values.reduce(
    (
      counts,
      value,
    ) => {
      counts[value] =
        (
          counts[value] ??
          0
        ) + 1;

      return counts;
    },
    {},
  );
}

function sameCounts(
  actualValues,
  expectedValues,
) {
  const actual =
    countValues(
      actualValues,
    );

  const expected =
    countValues(
      expectedValues,
    );

  const keys =
    new Set([
      ...Object.keys(
        actual,
      ),

      ...Object.keys(
        expected,
      ),
    ]);

  return [
    ...keys,
  ].every(
    (key) =>
      actual[key] ===
      expected[key],
  );
}

function coordinateKey(
  q,
  r,
) {
  return `${q},${r}`;
}

function buildAdjacencyMap(
  territories,
) {
  const byId =
    new Map(
      territories.map(
        (territory) => [
          territory.id,
          territory,
        ],
      ),
    );

  const adjacency =
    new Map();

  for (
    const territory
    of territories
  ) {
    adjacency.set(
      territory.id,
      new Set(
        (
          territory
            .neighborIds ||
          []
        ).filter(
          (neighborId) =>
            byId.has(
              neighborId,
            ),
        ),
      ),
    );
  }

  return {
    byId,
    adjacency,
  };
}

function isConnected(
  territories,
  adjacency,
) {
  if (
    territories.length ===
    0
  ) {
    return false;
  }

  const visited =
    new Set();

  const queue = [
    territories[0].id,
  ];

  while (
    queue.length > 0
  ) {
    const currentId =
      queue.shift();

    if (
      visited.has(
        currentId,
      )
    ) {
      continue;
    }

    visited.add(
      currentId,
    );

    for (
      const neighborId
      of adjacency.get(
        currentId,
      ) || []
    ) {
      if (
        !visited.has(
          neighborId,
        )
      ) {
        queue.push(
          neighborId,
        );
      }
    }
  }

  return (
    visited.size ===
    territories.length
  );
}

function findArticulationPoints(
  territories,
  adjacency,
) {
  let time = 0;

  const discovery =
    new Map();

  const low =
    new Map();

  const parent =
    new Map();

  const articulation =
    new Set();

  function visit(
    vertexId,
  ) {
    time += 1;

    discovery.set(
      vertexId,
      time,
    );

    low.set(
      vertexId,
      time,
    );

    let children = 0;

    for (
      const neighborId
      of adjacency.get(
        vertexId,
      ) || []
    ) {
      if (
        !discovery.has(
          neighborId,
        )
      ) {
        children += 1;

        parent.set(
          neighborId,
          vertexId,
        );

        visit(
          neighborId,
        );

        low.set(
          vertexId,
          Math.min(
            low.get(
              vertexId,
            ),
            low.get(
              neighborId,
            ),
          ),
        );

        const hasParent =
          parent.has(
            vertexId,
          );

        if (
          !hasParent &&
          children > 1
        ) {
          articulation.add(
            vertexId,
          );
        }

        if (
          hasParent &&
          low.get(
            neighborId,
          ) >=
            discovery.get(
              vertexId,
            )
        ) {
          articulation.add(
            vertexId,
          );
        }
      } else if (
        neighborId !==
        parent.get(
          vertexId,
        )
      ) {
        low.set(
          vertexId,
          Math.min(
            low.get(
              vertexId,
            ),
            discovery.get(
              neighborId,
            ),
          ),
        );
      }
    }
  }

  for (
    const territory
    of territories
  ) {
    if (
      !discovery.has(
        territory.id,
      )
    ) {
      visit(
        territory.id,
      );
    }
  }

  return [
    ...articulation,
  ];
}

function getRowLengths(
  territories,
) {
  const rows =
    new Map();

  for (
    const territory
    of territories
  ) {
    rows.set(
      territory.r,
      (
        rows.get(
          territory.r,
        ) || 0
      ) + 1,
    );
  }

  return [
    ...rows.entries(),
  ]
    .sort(
      (
        [firstR],
        [secondR],
      ) =>
        firstR -
        secondR,
    )
    .map(
      (
        [
          ,
          quantity,
        ],
      ) =>
        quantity,
    );
}

export function
calculateResourceProbability(
  territories,
) {
  const totals = {
    cork: 0,
    wheat: 0,
    cod: 0,
    stone: 0,
    iron: 0,
  };

  for (
    const territory
    of territories
  ) {
    if (
      territory.resourceId ===
      'abandoned'
    ) {
      continue;
    }

    totals[
      territory.resourceId
    ] +=
      probabilityPointsFor(
        territory.number,
      );
  }

  return totals;
}

export class BoardValidator {
  validate(
    board,
  ) {
    const errors = [];
    const warnings = [];

    const territories =
      board?.territories ??
      [];

    /*
     * 1. Quantidade total
     */

    if (
      territories.length !==
      GAME_CONFIG
        .board
        .territoryCount
    ) {
      errors.push(
        `Esperavam-se ${GAME_CONFIG.board.territoryCount} territórios; existem ${territories.length}.`,
      );
    }

    /*
     * 2. Coordenadas únicas
     */

    const coordinateKeys =
      territories.map(
        ({
          q,
          r,
        }) =>
          coordinateKey(
            q,
            r,
          ),
      );

    if (
      new Set(
        coordinateKeys,
      ).size !==
      coordinateKeys.length
    ) {
      errors.push(
        'Existem coordenadas de território duplicadas.',
      );
    }

    /*
     * 3. Máscara oficial
     */

    const expectedMaskKeys =
      new Set(
        GAME_CONFIG
          .board
          .mask
          .map(
            ({
              q,
              r,
            }) =>
              coordinateKey(
                q,
                r,
              ),
          ),
      );

    const actualMaskKeys =
      new Set(
        coordinateKeys,
      );

    if (
      expectedMaskKeys.size !==
        actualMaskKeys.size ||
      [
        ...expectedMaskKeys,
      ].some(
        (key) =>
          !actualMaskKeys
            .has(
              key,
            ),
      )
    ) {
      errors.push(
        'Os territórios não correspondem à máscara oficial de Portugal Continental.',
      );
    }

    /*
     * 4. Versão do mapa
     */

    if (
      board?.shape !==
      GAME_CONFIG
        .board
        .shape
    ) {
      errors.push(
        'A forma do tabuleiro não corresponde a Portugal Continental.',
      );
    }

    if (
      board?.maskVersion !==
      GAME_CONFIG
        .board
        .maskVersion
    ) {
      errors.push(
        'A versão da máscara do tabuleiro é incompatível.',
      );
    }

    /*
     * 5. Forma Norte -> Sul
     */

    const rowLengths =
      getRowLengths(
        territories,
      );

    if (
      !sameCounts(
        rowLengths,
        GAME_CONFIG
          .board
          .rowLengthsNorthToSouth,
      ) ||
      rowLengths.some(
        (
          quantity,
          index,
        ) =>
          quantity !==
          GAME_CONFIG
            .board
            .rowLengthsNorthToSouth[
            index
          ],
      )
    ) {
      errors.push(
        `A silhueta Norte-Sul deve seguir ${GAME_CONFIG.board.rowLengthsNorthToSouth.join('–')}; foi encontrada ${rowLengths.join('–')}.`,
      );
    }

    /*
     * 6. Recursos
     */

    const resourceCounts =
      countValues(
        territories.map(
          (territory) =>
            territory.resourceId,
        ),
      );

    for (
      const [
        resourceId,
        expectedCount,
      ]
      of Object.entries(
        GAME_CONFIG
          .territoryDistribution,
      )
    ) {
      const actualCount =
        resourceCounts[
          resourceId
        ] ?? 0;

      if (
        actualCount !==
        expectedCount
      ) {
        errors.push(
          `${resourceId}: esperavam-se ${expectedCount} territórios; existem ${actualCount}.`,
        );
      }
    }

    /*
     * 7. Terras Ermas
     */

    const abandoned =
      territories.filter(
        (territory) =>
          territory.resourceId ===
          'abandoned',
      );

    if (
      abandoned.length !== 1
    ) {
      errors.push(
        'Deve existir exatamente um território de Terras Ermas.',
      );
    }

    if (
      abandoned.some(
        (territory) =>
          territory.number !==
          null,
      )
    ) {
      errors.push(
        'As Terras Ermas não podem possuir marcador numérico.',
      );
    }

    /*
     * 8. Marcadores
     */

    const productive =
      territories.filter(
        (territory) =>
          territory.resourceId !==
          'abandoned',
      );

    if (
      productive.length !==
      GAME_CONFIG
        .board
        .productiveTerritoryCount
    ) {
      errors.push(
        `Esperavam-se ${GAME_CONFIG.board.productiveTerritoryCount} territórios produtivos; existem ${productive.length}.`,
      );
    }

    const numberTokens =
      productive.map(
        (territory) =>
          territory.number,
      );

    if (
      !sameCounts(
        numberTokens,
        GAME_CONFIG
          .numberTokens,
      )
    ) {
      errors.push(
        'A distribuição dos marcadores numéricos não corresponde à especificação.',
      );
    }

    /*
     * 9. Probabilidade global
     */

    let totalProbability =
      0;

    try {
      totalProbability =
        productive.reduce(
          (
            total,
            territory,
          ) =>
            total +
            probabilityPointsFor(
              territory.number,
            ),
          0,
        );
    } catch (
      error
    ) {
      errors.push(
        error instanceof Error
          ? error.message
          : 'Existe um marcador numérico inválido.',
      );
    }

    if (
      totalProbability !==
      GAME_CONFIG
        .totalProbabilityPoints
    ) {
      errors.push(
        `A produção global deve somar ${GAME_CONFIG.totalProbabilityPoints} pontos; soma ${totalProbability}.`,
      );
    }

    /*
     * 10. Grafo territorial
     */

    const {
      byId,
      adjacency,
    } =
      buildAdjacencyMap(
        territories,
      );

    let adjacencyLinks = 0;

    for (
      const territory
      of territories
    ) {
      const neighborIds =
        territory.neighborIds ||
        [];

      const uniqueNeighborIds =
        new Set(
          neighborIds,
        );

      if (
        uniqueNeighborIds.size !==
        neighborIds.length
      ) {
        errors.push(
          `${territory.id}: possui vizinhos duplicados.`,
        );
      }

      if (
        neighborIds.length <
        GAME_CONFIG
          .board
          .minimumTerritoryNeighbors
      ) {
        errors.push(
          `${territory.id}: possui apenas ${neighborIds.length} vizinho(s).`,
        );
      }

      if (
        neighborIds.length >
        GAME_CONFIG
          .board
          .maximumTerritoryNeighbors
      ) {
        errors.push(
          `${territory.id}: possui demasiados vizinhos.`,
        );
      }

      for (
        const neighborId
        of neighborIds
      ) {
        const neighbor =
          byId.get(
            neighborId,
          );

        if (!neighbor) {
          errors.push(
            `${territory.id}: referencia o vizinho inexistente ${neighborId}.`,
          );

          continue;
        }

        if (
          !(
            neighbor
              .neighborIds ||
            []
          ).includes(
            territory.id,
          )
        ) {
          errors.push(
            `${territory.id} e ${neighborId}: adjacência não recíproca.`,
          );
        }

        if (
          territory.id <
          neighbor.id
        ) {
          adjacencyLinks +=
            1;
        }
      }
    }

    if (
      adjacencyLinks !==
      GAME_CONFIG
        .board
        .expectedHexAdjacencyCount
    ) {
      errors.push(
        `A máscara deve possuir ${GAME_CONFIG.board.expectedHexAdjacencyCount} adjacências; possui ${adjacencyLinks}.`,
      );
    }

    /*
     * 11. Todo o país tem de estar ligado
     */

    const connected =
      isConnected(
        territories,
        adjacency,
      );

    if (!connected) {
      errors.push(
        'A máscara de Portugal Continental contém territórios desligados.',
      );
    }

    /*
     * 12. Não permitir gargalos de um único território
     *
     * Remover um território não deve partir
     * o mapa em dois blocos independentes.
     */

    const articulationPoints =
      connected
        ? findArticulationPoints(
            territories,
            adjacency,
          )
        : [];

    if (
      articulationPoints.length >
      0
    ) {
      errors.push(
        `A máscara contém ${articulationPoints.length} ponto(s) de articulação: ${articulationPoints.join(', ')}.`,
      );
    }

    /*
     * 13. 6 e 8 nunca adjacentes
     */

    const highNumberConflicts =
      [];

    for (
      const territory
      of productive
    ) {
      if (
        ![
          6,
          8,
        ].includes(
          territory.number,
        )
      ) {
        continue;
      }

      for (
        const neighborId
        of territory
          .neighborIds
      ) {
        const neighbor =
          byId.get(
            neighborId,
          );

        if (
          neighbor &&
          [
            6,
            8,
          ].includes(
            neighbor.number,
          ) &&
          territory.id <
            neighbor.id
        ) {
          highNumberConflicts.push(
            [
              territory.id,
              neighbor.id,
            ],
          );
        }
      }
    }

    if (
      highNumberConflicts.length >
      0
    ) {
      errors.push(
        `Existem ${highNumberConflicts.length} pares adjacentes com marcadores 6/8.`,
      );
    }

    /*
     * 14. Equilíbrio por recurso
     */

    let resourceProbability = {
      cork: 0,
      wheat: 0,
      cod: 0,
      stone: 0,
      iron: 0,
    };

    try {
      resourceProbability =
        calculateResourceProbability(
          territories,
        );
    } catch {
      errors.push(
        'Não foi possível calcular a produção dos recursos.',
      );
    }

    for (
      const [
        resourceId,
        total,
      ]
      of Object.entries(
        resourceProbability,
      )
    ) {
      const absolute =
        GAME_CONFIG
          .absoluteProbabilityRange;

      const recommended =
        GAME_CONFIG
          .recommendedProbabilityRanges[
          resourceId
        ];

      if (
        total <
          absolute.min ||
        total >
          absolute.max
      ) {
        errors.push(
          `${resourceId}: ${total} pontos, fora do intervalo absoluto ${absolute.min}–${absolute.max}.`,
        );
      }

      if (
        total <
          recommended.min ||
        total >
          recommended.max
      ) {
        errors.push(
          `${resourceId}: ${total} pontos, fora do intervalo recomendado ${recommended.min}–${recommended.max}.`,
        );
      }
    }

    if (
      resourceProbability
        .iron <= 9
    ) {
      warnings.push(
        'O Ferro está no limite inferior recomendado.',
      );
    }

    /*
     * 15. Topologia prevista
     */

    const boundaryEdgeCount =
      (
        6 *
        territories.length
      ) -
      (
        2 *
        adjacencyLinks
      );

    const uniqueEdgeCount =
      (
        6 *
        territories.length
      ) -
      adjacencyLinks;

    /*
     * Euler para um mapa ligado e sem buracos:
     *
     * V - E + F = 2
     *
     * F = 19 territórios + exterior.
     */
    const uniqueVertexCount =
      uniqueEdgeCount -
      territories.length +
      1;

    if (
      boundaryEdgeCount !==
      GAME_CONFIG
        .board
        .expectedBoundaryEdgeCount
    ) {
      errors.push(
        `O perímetro deve possuir ${GAME_CONFIG.board.expectedBoundaryEdgeCount} arestas; possui ${boundaryEdgeCount}.`,
      );
    }

    if (
      uniqueEdgeCount !==
      GAME_CONFIG
        .board
        .expectedEdgeCount
    ) {
      errors.push(
        `A topologia deve produzir ${GAME_CONFIG.board.expectedEdgeCount} arestas únicas; produz ${uniqueEdgeCount}.`,
      );
    }

    if (
      uniqueVertexCount !==
      GAME_CONFIG
        .board
        .expectedVertexCount
    ) {
      errors.push(
        `A topologia deve produzir ${GAME_CONFIG.board.expectedVertexCount} vértices únicos; produz ${uniqueVertexCount}.`,
      );
    }

    return {
      valid:
        errors.length ===
        0,

      errors,

      warnings,

      metrics: {
        territoryCount:
          territories.length,

        productiveTerritoryCount:
          productive.length,

        numberTokenCount:
          numberTokens.length,

        totalProbability,

        highNumberConflictCount:
          highNumberConflicts
            .length,

        resourceCounts,

        resourceProbability,

        rowLengths,

        connected,

        articulationPointCount:
          articulationPoints
            .length,

        articulationPoints,

        hexAdjacencyCount:
          adjacencyLinks,

        boundaryEdgeCount,

        expectedVertexCount:
          uniqueVertexCount,

        expectedEdgeCount:
          uniqueEdgeCount,
      },
    };
  }
}
