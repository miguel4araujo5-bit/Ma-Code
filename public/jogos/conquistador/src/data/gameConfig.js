export const GAME_CONFIG = Object.freeze({
  saveVersion: 1,
  board: Object.freeze({
    radius: 2,
    territoryCount: 19,
    productiveTerritoryCount: 18,
    layoutRows: Object.freeze([3, 4, 5, 4, 3]),
  }),
  territoryDistribution: Object.freeze({
    cork: 4,
    wheat: 4,
    cod: 4,
    stone: 3,
    iron: 3,
    abandoned: 1,
  }),
  numberTokens: Object.freeze([
    2,
    3, 3,
    4, 4,
    5, 5,
    6, 6,
    8, 8,
    9, 9,
    10, 10,
    11, 11,
    12,
  ]),
  probabilityPoints: Object.freeze({
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
  totalProbabilityPoints: 58,
  recommendedProbabilityRanges: Object.freeze({
    cork: Object.freeze({ min: 11, max: 13 }),
    wheat: Object.freeze({ min: 11, max: 13 }),
    cod: Object.freeze({ min: 11, max: 13 }),
    stone: Object.freeze({ min: 9, max: 11 }),
    iron: Object.freeze({ min: 9, max: 11 }),
  }),
  absoluteProbabilityRange: Object.freeze({ min: 8, max: 14 }),
  bankCardsPerResource: 19,
  victoryPrestige: 12,
  maxGenerationAttempts: 20_000,
});

export function probabilityPointsFor(numberToken) {
  const points = GAME_CONFIG.probabilityPoints[numberToken];
  if (!points) {
    throw new Error(`Marcador numérico inválido: ${numberToken}`);
  }
  return points;
}
