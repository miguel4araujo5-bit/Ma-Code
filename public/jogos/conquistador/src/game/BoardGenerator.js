import {
  GAME_CONFIG,
  probabilityPointsFor,
} from '../data/gameConfig.js';

import {
  BoardValidator,
} from './BoardValidator.js';

import {
  SeededRandom,
} from '../utils/SeededRandom.js';

const DIRECTIONS =
  Object.freeze([
    Object.freeze({
      q: 1,
      r: 0,
    }),

    Object.freeze({
      q: 1,
      r: -1,
    }),

    Object.freeze({
      q: 0,
      r: -1,
    }),

    Object.freeze({
      q: -1,
      r: 0,
    }),

    Object.freeze({
      q: -1,
      r: 1,
    }),

    Object.freeze({
      q: 0,
      r: 1,
    }),
  ]);

function coordinateId(
  q,
  r,
) {
  return `hex-${q}-${r}`
    .replaceAll(
      '--',
      '-m',
    );
}

function createCoordinates() {
  return GAME_CONFIG
    .board
    .mask
    .map(
      (slot) => ({
        ...slot,

        s:
          -slot.q -
          slot.r,
      }),
    );
}

function expandDistribution(
  distribution,
) {
  const values = [];

  for (
    const [
      value,
      quantity,
    ]
    of Object.entries(
      distribution,
    )
  ) {
    for (
      let count = 0;
      count < quantity;
      count += 1
    ) {
      values.push(
        value,
      );
    }
  }

  return values;
}

function areAdjacent(
  left,
  right,
) {
  return DIRECTIONS.some(
    (direction) =>
      left.q +
        direction.q ===
        right.q &&
      left.r +
        direction.r ===
        right.r,
  );
}

function
selectNonAdjacentTerritories(
  territories,
  quantity,
  random,
) {
  const shuffled =
    random.shuffle(
      territories,
    );

  function search(
    startIndex,
    selected,
  ) {
    if (
      selected.length ===
      quantity
    ) {
      return selected;
    }

    const remainingNeeded =
      quantity -
      selected.length;

    if (
      shuffled.length -
        startIndex <
      remainingNeeded
    ) {
      return null;
    }

    for (
      let index =
        startIndex;
      index <
      shuffled.length;
      index += 1
    ) {
      const candidate =
        shuffled[index];

      if (
        selected.every(
          (territory) =>
            !areAdjacent(
              candidate,
              territory,
            ),
        )
      ) {
        const result =
          search(
            index + 1,
            [
              ...selected,
              candidate,
            ],
          );

        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  return search(
    0,
    [],
  );
}

function assignNumberTokens(
  territories,
  random,
) {
  const productive =
    territories.filter(
      (territory) =>
        territory
          .resourceId !==
        'abandoned',
    );

  const highTerritories =
    selectNonAdjacentTerritories(
      productive,
      4,
      random,
    );

  if (!highTerritories) {
    return null;
  }

  const highIds =
    new Set(
      highTerritories.map(
        (territory) =>
          territory.id,
      ),
    );

  const highTokens =
    random.shuffle([
      6,
      6,
      8,
      8,
    ]);

  const normalTokens =
    random.shuffle(
      GAME_CONFIG
        .numberTokens
        .filter(
          (numberToken) =>
            ![
              6,
              8,
            ].includes(
              numberToken,
            ),
        ),
    );

  let highIndex = 0;
  let normalIndex = 0;

  return territories.map(
    (territory) => {
      if (
        territory
          .resourceId ===
        'abandoned'
      ) {
        return {
          ...territory,
          number: null,
          probabilityPoints:
            0,
        };
      }

      const number =
        highIds.has(
          territory.id,
        )
          ? highTokens[
              highIndex++
            ]
          : normalTokens[
              normalIndex++
            ];

      return {
        ...territory,

        number,

        probabilityPoints:
          probabilityPointsFor(
            number,
          ),
      };
    },
  );
}

export class BoardGenerator {
  constructor({
    validator =
      new BoardValidator(),
  } = {}) {
    this.validator =
      validator;

    this.coordinates =
      createCoordinates();

    this.coordinateMap =
      new Map(
        this.coordinates.map(
          (coordinate) => [
            `${coordinate.q},${coordinate.r}`,
            coordinate,
          ],
        ),
      );
  }

  generate(
    seed =
      `CONQ-${Date.now()}`,
    options = {},
  ) {
    const normalizedSeed =
      String(seed).trim() ||
      `CONQ-${Date.now()}`;

    const maxAttempts =
      options.maxAttempts ??
      GAME_CONFIG
        .maxGenerationAttempts;

    const random =
      new SeededRandom(
        normalizedSeed,
      );

    const resources =
      expandDistribution(
        GAME_CONFIG
          .territoryDistribution,
      );

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt += 1
    ) {
      const shuffledResources =
        random.shuffle(
          resources,
        );

      const baseTerritories =
        this.coordinates.map(
          (
            coordinate,
            index,
          ) => {
            const id =
              coordinateId(
                coordinate.q,
                coordinate.r,
              );

            const neighborIds =
              DIRECTIONS
                .map(
                  (
                    direction,
                  ) => ({
                    q:
                      coordinate.q +
                      direction.q,

                    r:
                      coordinate.r +
                      direction.r,
                  }),
                )
                .filter(
                  (neighbor) =>
                    this.coordinateMap
                      .has(
                        `${neighbor.q},${neighbor.r}`,
                      ),
                )
                .map(
                  (neighbor) =>
                    coordinateId(
                      neighbor.q,
                      neighbor.r,
                    ),
                );

            return {
              id,

              slotId:
                coordinate
                  .slotId,

              zone:
                coordinate
                  .zone,

              q:
                coordinate.q,

              r:
                coordinate.r,

              s:
                coordinate.s,

              resourceId:
                shuffledResources[
                  index
                ],

              number: null,

              probabilityPoints:
                0,

              neighborIds,

              isCoastal:
                Boolean(
                  coordinate
                    .coastal,
                ),

              blocked:
                false,
            };
          },
        );

      const territories =
        assignNumberTokens(
          baseTerritories,
          random,
        );

      if (!territories) {
        continue;
      }

      const board = {
        id:
          `board-${normalizedSeed}`,

        seed:
          normalizedSeed,

        shape:
          GAME_CONFIG
            .board
            .shape,

        maskVersion:
          GAME_CONFIG
            .board
            .maskVersion,

        generatedAt:
          new Date()
            .toISOString(),

        generationAttempts:
          attempt,

        territories,
      };

      const validation =
        this.validator
          .validate(
            board,
          );

      if (
        validation.valid
      ) {
        return {
          ...board,
          validation,
        };
      }
    }

    throw new Error(
      `Não foi possível gerar um tabuleiro válido após ${maxAttempts} tentativas para a seed ${normalizedSeed}.`,
    );
  }
}
