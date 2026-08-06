import { RESOURCE_IDS } from '../data/resources.js';

export function createEmptySimulationMetrics(requestedBoards) {
  return {
    requestedBoards,
    generatedBoards: 0,
    failures: 0,
    totalAttempts: 0,
    minAttempts: Number.POSITIVE_INFINITY,
    maxAttempts: 0,
    resourceProbability: Object.fromEntries(
      RESOURCE_IDS.map((resourceId) => [resourceId, {
        total: 0,
        min: Number.POSITIVE_INFINITY,
        max: Number.NEGATIVE_INFINITY,
      }]),
    ),
  };
}

export function addBoardToMetrics(metrics, board) {
  metrics.generatedBoards += 1;
  metrics.totalAttempts += board.generationAttempts;
  metrics.minAttempts = Math.min(metrics.minAttempts, board.generationAttempts);
  metrics.maxAttempts = Math.max(metrics.maxAttempts, board.generationAttempts);

  for (const resourceId of RESOURCE_IDS) {
    const value = board.validation.metrics.resourceProbability[resourceId];
    const resourceMetrics = metrics.resourceProbability[resourceId];
    resourceMetrics.total += value;
    resourceMetrics.min = Math.min(resourceMetrics.min, value);
    resourceMetrics.max = Math.max(resourceMetrics.max, value);
  }
}

export function finalizeSimulationMetrics(metrics, elapsedMs) {
  const generated = metrics.generatedBoards;
  return {
    ...metrics,
    elapsedMs,
    averageAttempts: generated > 0 ? metrics.totalAttempts / generated : 0,
    minAttempts: generated > 0 ? metrics.minAttempts : 0,
    resourceProbability: Object.fromEntries(
      Object.entries(metrics.resourceProbability).map(([resourceId, values]) => [
        resourceId,
        {
          min: generated > 0 ? values.min : 0,
          max: generated > 0 ? values.max : 0,
          average: generated > 0 ? values.total / generated : 0,
        },
      ]),
    ),
  };
}
