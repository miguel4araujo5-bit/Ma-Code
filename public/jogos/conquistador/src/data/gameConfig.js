export const PORTUGAL_MAINLAND_MASK =
  Object.freeze([
    /*
     * NORTE
     *
     *        PT01 PT02 PT03
     *         PT04 PT05 PT06
     */

    Object.freeze({
      slotId: 'PT01',
      q: 1,
      r: -4,
      zone: 'north-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT02',
      q: 2,
      r: -4,
      zone: 'north',
      coastal: false,
      coast: null,
    }),

    Object.freeze({
      slotId: 'PT03',
      q: 3,
      r: -4,
      zone: 'north-east',
      coastal: false,
      coast: null,
    }),

    Object.freeze({
      slotId: 'PT04',
      q: 1,
      r: -3,
      zone: 'north-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT05',
      q: 2,
      r: -3,
      zone: 'north',
      coastal: false,
      coast: null,
    }),

    Object.freeze({
      slotId: 'PT06',
      q: 3,
      r: -3,
      zone: 'north-east',
      coastal: false,
      coast: null,
    }),

    /*
     * CENTRO-NORTE
     *
     *          PT07 PT08
     */

    Object.freeze({
      slotId: 'PT07',
      q: 1,
      r: -2,
      zone: 'center-north-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT08',
      q: 2,
      r: -2,
      zone: 'center-north-east',
      coastal: false,
      coast: null,
    }),

    /*
     * CENTRO
     *
     *         PT09 PT10
     *        PT11 PT12
     */

    Object.freeze({
      slotId: 'PT09',
      q: 0,
      r: -1,
      zone: 'center-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT10',
      q: 1,
      r: -1,
      zone: 'center-east',
      coastal: false,
      coast: null,
    }),

    Object.freeze({
      slotId: 'PT11',
      q: -1,
      r: 0,
      zone: 'center-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT12',
      q: 0,
      r: 0,
      zone: 'center-east',
      coastal: false,
      coast: null,
    }),

    /*
     * ALENTEJO
     *
     *         PT13 PT14
     *          PT15 PT16
     */

    Object.freeze({
      slotId: 'PT13',
      q: -1,
      r: 1,
      zone: 'alentejo-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT14',
      q: 0,
      r: 1,
      zone: 'alentejo-east',
      coastal: false,
      coast: null,
    }),

    Object.freeze({
      slotId: 'PT15',
      q: -1,
      r: 2,
      zone: 'alentejo-south-west',
      coastal: true,
      coast: 'atlantic',
    }),

    Object.freeze({
      slotId: 'PT16',
      q: 0,
      r: 2,
      zone: 'alentejo-south-east',
      coastal: false,
      coast: null,
    }),

    /*
     * ALGARVE
     *
     *        PT17 PT18 PT19
     */

    Object.freeze({
      slotId: 'PT17',
      q: -2,
      r: 3,
      zone: 'algarve-west',
      coastal: true,
      coast: 'algarve',
    }),

    Object.freeze({
      slotId: 'PT18',
      q: -1,
      r: 3,
      zone: 'algarve-center',
      coastal: true,
      coast: 'algarve',
    }),

    Object.freeze({
      slotId: 'PT19',
      q: 0,
      r: 3,
      zone: 'algarve-east',
      coastal: true,
      coast: 'algarve',
    }),
  ]);

export const GAME_CONFIG =
  Object.freeze({
    saveVersion: 2,

    board: Object.freeze({
      shape:
        'portugal-mainland',

      /*
       * Versão 2:
       * silhueta Portugal Continental
       * definitivamente afinada.
       *
       * Alterar esta máscara no futuro
       * exige nova validação matemática.
       */
      maskVersion: 2,

      territoryCount: 19,

      productiveTerritoryCount:
        18,

      /*
       * Norte -> Sul
       *
       * 3
       * 3
       * 2
       * 2
       * 2
       * 2
       * 2
       * 3
       *
       * Total = 19
       */
      rowLengthsNorthToSouth:
        Object.freeze([
          3,
          3,
          2,
          2,
          2,
          2,
          2,
          3,
        ]),

      mask:
        PORTUGAL_MAINLAND_MASK,

      expectedHexAdjacencyCount:
        36,

      expectedBoundaryEdgeCount:
        42,

      expectedVertexCount:
        60,

      expectedEdgeCount:
        78,

      minimumTerritoryNeighbors:
        2,

      maximumTerritoryNeighbors:
        6,
    }),

    territoryDistribution:
      Object.freeze({
        cork: 4,
        wheat: 4,
        cod: 4,
        stone: 3,
        iron: 3,
        abandoned: 1,
      }),

    numberTokens:
      Object.freeze([
        2,
        3,
        3,
        4,
        4,
        5,
        5,
        6,
        6,
        8,
        8,
        9,
        9,
        10,
        10,
        11,
        11,
        12,
      ]),

    probabilityPoints:
      Object.freeze({
        2: 1,
        3: 2,
        4: 3,
        5: 4,
        6: 5,
        8: 5,
        9: 4,
        10: 3,
        11: 2,
        12: 1,
      }),

    totalProbabilityPoints:
      58,

    recommendedProbabilityRanges:
      Object.freeze({
        cork:
          Object.freeze({
            min: 11,
            max: 13,
          }),

        wheat:
          Object.freeze({
            min: 11,
            max: 13,
          }),

        cod:
          Object.freeze({
            min: 11,
            max: 13,
          }),

        stone:
          Object.freeze({
            min: 9,
            max: 11,
          }),

        iron:
          Object.freeze({
            min: 9,
            max: 11,
          }),
      }),

    absoluteProbabilityRange:
      Object.freeze({
        min: 8,
        max: 14,
      }),

    bankCardsPerResource:
      19,

    victoryPrestige:
      12,

    maxGenerationAttempts:
      20_000,
  });

export function
probabilityPointsFor(
  numberToken,
) {
  const points =
    GAME_CONFIG
      .probabilityPoints[
      numberToken
    ];

  if (!points) {
    throw new Error(
      `Marcador numérico inválido: ${numberToken}`,
    );
  }

  return points;
}
