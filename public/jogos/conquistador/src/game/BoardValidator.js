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

    if (
      board?.shape !==
      GAME_CONFIG
        .board
        .shape
    ) {
      errors.push(
        'A forma do tabuleiro não corresponde à versão Portugal Continental.',
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

    const resourceCounts =
      countValues(
        territories.map(
          (territory) =>
            territory
              .resourceId,
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

    const abandoned =
      territories.filter(
        (territory) =>
          territory
            .resourceId ===
          'abandoned',
      );

    if (
      abandoned.length !==
        1 ||
      abandoned.some(
        (territory) =>
          territory.number !==
          null,
      )
    ) {
      errors.push(
        'As Terras Abandonadas devem ser únicas e não podem possuir marcador numérico.',
      );
    }

    const productive =
      territories.filter(
        (territory) =>
          territory
            .resourceId !==
          'abandoned',
      );

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

    const totalProbability =
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

    if (
      totalProbability !==
      GAME_CONFIG
        .totalProbabilityPoints
    ) {
      errors.push(
        `A produção global deve somar ${GAME_CONFIG.totalProbabilityPoints} pontos; soma ${totalProbability}.`,
      );
    }

    const byId =
      new Map(
        territories.map(
          (territory) => [
            territory.id,
            territory,
          ],
        ),
      );

    let adjacencyLinks = 0;

    for (
      const territory
      of territories
    ) {
      for (
        const neighborId
        of territory
          .neighborIds ??
        []
      ) {
        const neighbor =
          byId.get(
            neighborId,
          );

        if (!neighbor) {
          errors.push(
            `${territory.id}: referência a vizinho inexistente ${neighborId}.`,
          );

          continue;
        }

        if (
          !(
            neighbor
              .neighborIds ??
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
        `A máscara deve ter ${GAME_CONFIG.board.expectedHexAdjacencyCount} adjacências entre territórios; tem ${adjacencyLinks}.`,
      );
    }

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
        of territory.neighborIds
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

    const resourceProbability =
      calculateResourceProbability(
        territories,
      );

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
        'O Ferro está no limite inferior; deve ser acompanhado nas simulações económicas.',
      );
    }

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
     * Para uma máscara ligada e sem buracos:
     *
     * V - E + F = 2
     *
     * F inclui os 19 territórios
     * mais a face exterior.
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
        `O perímetro deve ter ${GAME_CONFIG.board.expectedBoundaryEdgeCount} arestas; tem ${boundaryEdgeCount}.`,
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
        errors.length === 0,

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
