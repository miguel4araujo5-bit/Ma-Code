import { BoardGenerator } from '../game/BoardGenerator.js';
import {
  addBoardToMetrics,
  createEmptySimulationMetrics,
  finalizeSimulationMetrics,
} from './Metrics.js';

export class Simulator {
  constructor({ boardGenerator = new BoardGenerator() } = {}) {
    this.boardGenerator = boardGenerator;
  }

  run({ quantity = 100, seedPrefix = 'CONQ-SIM' } = {}) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error('A quantidade de simulações deve ser um inteiro positivo.');
    }

    const metrics = createEmptySimulationMetrics(quantity);
    const startedAt = performance.now();

    for (let index = 0; index < quantity; index += 1) {
      try {
        const board = this.boardGenerator.generate(`${seedPrefix}-${index + 1}`);
        addBoardToMetrics(metrics, board);
      } catch (error) {
        metrics.failures += 1;
        console.error(error);
      }
    }

    return finalizeSimulationMetrics(metrics, performance.now() - startedAt);
  }
}
