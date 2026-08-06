import { GAME_CONFIG, probabilityPointsFor } from '../data/gameConfig.js';

function countValues(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function sameCounts(actualValues, expectedValues) {
  const actual = countValues(actualValues);
  const expected = countValues(expectedValues);
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  return [...keys].every((key) => actual[key] === expected[key]);
}

export function calculateResourceProbability(territories) {
  const totals = {
    cork: 0,
    wheat: 0,
    cod: 0,
    stone: 0,
    iron: 0,
  };

  for (const territory of territories) {
    if (territory.resourceId === 'abandoned') continue;
    totals[territory.resourceId] += probabilityPointsFor(territory.number);
  }

  return totals;
}

export class BoardValidator {
  validate(board) {
    const errors = [];
    const warnings = [];
    const territories = board?.territories ?? [];

    if (territories.length !== GAME_CONFIG.board.territoryCount) {
      errors.push(`Esperavam-se 19 territórios; existem ${territories.length}.`);
    }

    const coordinateKeys = territories.map(({ q, r }) => `${q},${r}`);
    if (new Set(coordinateKeys).size !== coordinateKeys.length) {
      errors.push('Existem coordenadas de território duplicadas.');
    }

    const resourceCounts = countValues(territories.map((territory) => territory.resourceId));
    for (const [resourceId, expectedCount] of Object.entries(GAME_CONFIG.territoryDistribution)) {
      const actualCount = resourceCounts[resourceId] ?? 0;
      if (actualCount !== expectedCount) {
        errors.push(`${resourceId}: esperavam-se ${expectedCount} territórios; existem ${actualCount}.`);
      }
    }

    const abandoned = territories.filter((territory) => territory.resourceId === 'abandoned');
    if (abandoned.length !== 1 || abandoned.some((territory) => territory.number !== null)) {
      errors.push('As Terras Abandonadas devem ser únicas e não podem possuir marcador numérico.');
    }

    const productive = territories.filter((territory) => territory.resourceId !== 'abandoned');
    const numberTokens = productive.map((territory) => territory.number);
    if (!sameCounts(numberTokens, GAME_CONFIG.numberTokens)) {
      errors.push('A distribuição dos marcadores numéricos não corresponde à especificação.');
    }

    const totalProbability = productive.reduce(
      (total, territory) => total + probabilityPointsFor(territory.number),
      0,
    );
    if (totalProbability !== GAME_CONFIG.totalProbabilityPoints) {
      errors.push(`A produção global deve somar 58 pontos; soma ${totalProbability}.`);
    }

    const byId = new Map(territories.map((territory) => [territory.id, territory]));
    const highNumberConflicts = [];
    for (const territory of productive) {
      if (![6, 8].includes(territory.number)) continue;
      for (const neighborId of territory.neighborIds) {
        const neighbor = byId.get(neighborId);
        if (neighbor && [6, 8].includes(neighbor.number) && territory.id < neighbor.id) {
          highNumberConflicts.push([territory.id, neighbor.id]);
        }
      }
    }
    if (highNumberConflicts.length > 0) {
      errors.push(`Existem ${highNumberConflicts.length} pares adjacentes com marcadores 6/8.`);
    }

    const resourceProbability = calculateResourceProbability(territories);
    for (const [resourceId, total] of Object.entries(resourceProbability)) {
      const absolute = GAME_CONFIG.absoluteProbabilityRange;
      const recommended = GAME_CONFIG.recommendedProbabilityRanges[resourceId];
      if (total < absolute.min || total > absolute.max) {
        errors.push(`${resourceId}: ${total} pontos, fora do intervalo absoluto ${absolute.min}–${absolute.max}.`);
      }
      if (total < recommended.min || total > recommended.max) {
        errors.push(`${resourceId}: ${total} pontos, fora do intervalo recomendado ${recommended.min}–${recommended.max}.`);
      }
    }

    const ironTotal = resourceProbability.iron;
    if (ironTotal <= 9) {
      warnings.push('O Ferro está no limite inferior; deve ser acompanhado nas simulações económicas.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        territoryCount: territories.length,
        productiveTerritoryCount: productive.length,
        numberTokenCount: numberTokens.length,
        totalProbability,
        highNumberConflictCount: highNumberConflicts.length,
        resourceCounts,
        resourceProbability,
      },
    };
  }
}
