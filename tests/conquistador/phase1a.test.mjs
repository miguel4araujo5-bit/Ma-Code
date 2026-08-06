import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../../public/jogos/conquistador/src/data/gameConfig.js';
import { Bank } from '../../public/jogos/conquistador/src/game/Bank.js';
import { BoardGenerator } from '../../public/jogos/conquistador/src/game/BoardGenerator.js';
import { BoardValidator } from '../../public/jogos/conquistador/src/game/BoardValidator.js';
import { DiceEngine } from '../../public/jogos/conquistador/src/game/DiceEngine.js';
import { Simulator } from '../../public/jogos/conquistador/src/simulation/Simulator.js';

const generator = new BoardGenerator();
const validator = new BoardValidator();
const seed = 'CONQ-TEST-ATLANTICO';
const firstBoard = generator.generate(seed);
const secondBoard = generator.generate(seed);

assert.equal(firstBoard.territories.length, 19);
assert.equal(firstBoard.validation.valid, true);
assert.deepEqual(
  firstBoard.territories.map(({ resourceId, number }) => ({ resourceId, number })),
  secondBoard.territories.map(({ resourceId, number }) => ({ resourceId, number })),
  'A mesma seed deve produzir o mesmo tabuleiro.',
);

const validation = validator.validate(firstBoard);
assert.equal(validation.metrics.productiveTerritoryCount, 18);
assert.equal(validation.metrics.numberTokenCount, 18);
assert.equal(validation.metrics.totalProbability, GAME_CONFIG.totalProbabilityPoints);
assert.equal(validation.metrics.highNumberConflictCount, 0);
assert.equal(validation.valid, true);

const bank = new Bank();
const before = bank.snapshot();
assert.equal(before.cork, 19);
const production = bank.distributeProduction([
  { playerId: 'p1', resourceId: 'cork', quantity: 10 },
  { playerId: 'p2', resourceId: 'cork', quantity: 10 },
  { playerId: 'p1', resourceId: 'iron', quantity: 2 },
]);
assert.deepEqual(production.deniedResources, ['cork']);
assert.equal(production.granted.length, 1);
assert.equal(bank.get('cork'), 19, 'A Cortiça não deve ser paga parcialmente.');
assert.equal(bank.get('iron'), 17);

const dice = new DiceEngine('DICE-TEST');
for (let count = 0; count < 100; count += 1) {
  const result = dice.roll();
  assert.ok(result.die1 >= 1 && result.die1 <= 6);
  assert.ok(result.die2 >= 1 && result.die2 <= 6);
  assert.equal(result.total, result.die1 + result.die2);
}

const simulation = new Simulator().run({ quantity: 250, seedPrefix: 'CONQ-TEST-SIM' });
assert.equal(simulation.generatedBoards, 250);
assert.equal(simulation.failures, 0);
assert.ok(simulation.averageAttempts >= 1);

console.log('✓ Fase 1A validada com sucesso');
console.log(`✓ ${simulation.generatedBoards} tabuleiros simulados sem falhas`);
console.log(`✓ Média de tentativas: ${simulation.averageAttempts.toFixed(2)}`);
console.log(`✓ Tempo: ${simulation.elapsedMs.toFixed(1)} ms`);
