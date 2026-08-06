import { SeededRandom } from '../utils/SeededRandom.js';

export class DiceEngine {
  constructor(seed = `DICE-${Date.now()}`) {
    this.random = new SeededRandom(seed);
  }

  roll() {
    const die1 = this.random.integer(1, 6);
    const die2 = this.random.integer(1, 6);
    return {
      die1,
      die2,
      total: die1 + die2,
    };
  }

  static theoreticalDistribution() {
    const counts = {};
    for (let die1 = 1; die1 <= 6; die1 += 1) {
      for (let die2 = 1; die2 <= 6; die2 += 1) {
        const total = die1 + die2;
        counts[total] = (counts[total] ?? 0) + 1;
      }
    }
    return Object.fromEntries(
      Object.entries(counts).map(([total, combinations]) => [
        Number(total),
        {
          combinations,
          probability: combinations / 36,
        },
      ]),
    );
  }
}
