import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../../public/jogos/conquistador/src/data/gameConfig.js';
import { Bank } from '../../public/jogos/conquistador/src/game/Bank.js';
import { BoardGenerator } from '../../public/jogos/conquistador/src/game/BoardGenerator.js';
import { BoardValidator } from '../../public/jogos/conquistador/src/game/BoardValidator.js';
import { DiceEngine } from '../../public/jogos/conquistador/src/game/DiceEngine.js';
import { Simulator } from '../../public/jogos/conquistador/src/simulation/Simulator.js';

const generator = new BoardGenerator();
const validator = new BoardValidator();
const seed = 'CONQ-TEST-ATLANTICO';

const firstBoard =
  generator.generate(seed);

const secondBoard =
  generator.generate(seed);

assert.equal(
  firstBoard.territories.length,
  19,
);

assert.equal(
  firstBoard.validation.valid,
  true,
);

assert.deepEqual(
  firstBoard.territories.map(
    ({
      resourceId,
      number,
    }) => ({
      resourceId,
      number,
    }),
  ),
  secondBoard.territories.map(
    ({
      resourceId,
      number,
    }) => ({
      resourceId,
      number,
    }),
  ),
  'A mesma seed deve produzir o mesmo tabuleiro.',
);

const validation =
  validator.validate(
    firstBoard,
  );

assert.equal(
  validation.metrics
    .productiveTerritoryCount,
  18,
);

assert.equal(
  validation.metrics
    .numberTokenCount,
  18,
);

assert.equal(
  validation.metrics
    .totalProbability,
  GAME_CONFIG
    .totalProbabilityPoints,
);

assert.equal(
  validation.metrics
    .highNumberConflictCount,
  0,
);

assert.equal(
  validation.valid,
  true,
);

const bank =
  new Bank();

const before =
  bank.snapshot();

assert.equal(
  before.cork,
  19,
);

const production =
  bank.distributeProduction([
    {
      playerId: 'p1',
      resourceId: 'cork',
      quantity: 10,
    },
    {
      playerId: 'p2',
      resourceId: 'cork',
      quantity: 10,
    },
    {
      playerId: 'p1',
      resourceId: 'iron',
      quantity: 2,
    },
  ]);

assert.deepEqual(
  production.deniedResources,
  ['cork'],
);

assert.equal(
  production.granted.length,
  1,
);

assert.equal(
  bank.get('cork'),
  19,
  'A Cortiça não deve ser paga parcialmente.',
);

assert.equal(
  bank.get('iron'),
  17,
);

const dice =
  new DiceEngine(
    'DICE-TEST',
  );

for (
  let count = 0;
  count < 100;
  count += 1
) {
  const result =
    dice.roll();

  assert.ok(
    result.die1 >= 1 &&
      result.die1 <= 6,
  );

  assert.ok(
    result.die2 >= 1 &&
      result.die2 <= 6,
  );

  assert.equal(
    result.total,
    result.die1 +
      result.die2,
  );
}

const simulation =
  new Simulator().run({
    quantity: 250,
    seedPrefix:
      'CONQ-TEST-SIM',
  });

assert.equal(
  simulation.generatedBoards,
  250,
);

assert.equal(
  simulation.failures,
  0,
);

assert.ok(
  simulation.averageAttempts >=
    1,
);

const matchmakingSource =
  readFileSync(
    new URL(
      '../../public/jogos/conquistador/src/ui/OnlineMatchmaking.js',
      import.meta.url,
    ),
    'utf8',
  );

const gameClientSource =
  readFileSync(
    new URL(
      '../../public/jogos/conquistador/src/online/OnlineGameClient.js',
      import.meta.url,
    ),
    'utf8',
  );

const wranglerSource =
  readFileSync(
    new URL(
      '../../wrangler.jsonc',
      import.meta.url,
    ),
    'utf8',
  );

assert.doesNotMatch(
  matchmakingSource,
  /scheduleFallbackStatus|fallbackStatusOnce|FALLBACK_STATUS_INTERVAL_MS|MAX_FALLBACK_STATUS_INTERVAL_MS/,
  'O matchmaking não pode voltar a fazer polling HTTP de estado.',
);

assert.doesNotMatch(
  matchmakingSource,
  /post\(\s*['"]status['"]/,
  'O estado do matchmaking deve chegar por WebSocket, não por POST periódico.',
);

assert.match(
  matchmakingSource,
  /REALTIME_RECONNECT_MAX_ATTEMPTS/,
  'O matchmaking deve manter um limite explícito de reconexões automáticas.',
);

assert.match(
  matchmakingSource,
  /navigator\.onLine === false/,
  'O matchmaking deve suspender reconexões quando o browser está offline.',
);

assert.doesNotMatch(
  gameClientSource,
  /scheduleFallbackPoll|fallbackPollOnce|DEFAULT_FALLBACK_POLL_INTERVAL_MS|MAX_FALLBACK_POLL_INTERVAL_MS/,
  'A partida online não pode voltar a fazer polling HTTP de estado.',
);

assert.match(
  gameClientSource,
  /REALTIME_RECONNECT_MAX_ATTEMPTS/,
  'A partida deve manter um limite explícito de reconexões automáticas.',
);

assert.match(
  gameClientSource,
  /navigator\.onLine === false/,
  'A partida deve suspender reconexões quando o browser está offline.',
);

assert.match(
  gameClientSource,
  /return this\.startRealtime\(\s*options,\s*\);/,
  'A API legada startPolling deve ser apenas um alias do transporte realtime.',
);

assert.match(
  wranglerSource,
  /["']web_socket_auto_reply_to_close["']/,
  'O Worker deve manter o auto-reply de Close para WebSockets hibernáveis.',
);

console.log(
  '✓ Fase 1A validada com sucesso',
);

console.log(
  `✓ ${simulation.generatedBoards} tabuleiros simulados sem falhas`,
);

console.log(
  `✓ Média de tentativas: ${simulation.averageAttempts.toFixed(2)}`,
);

console.log(
  `✓ Tempo: ${simulation.elapsedMs.toFixed(1)} ms`,
);

console.log(
  '✓ Multiplayer validado sem polling HTTP periódico',
);
