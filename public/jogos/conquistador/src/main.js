import { RESOURCES, RESOURCE_IDS } from './data/resources.js';
import { BoardGenerator } from './game/BoardGenerator.js';
import { DiceEngine } from './game/DiceEngine.js';
import { Simulator } from './simulation/Simulator.js';

const boardGenerator = new BoardGenerator();
let diceEngine = new DiceEngine('CONQ-DICE');

const elements = {
  seed: document.querySelector('#seed'),
  generate: document.querySelector('#generate-board'),
  randomSeed: document.querySelector('#random-seed'),
  rollDice: document.querySelector('#roll-dice'),
  simulate: document.querySelector('#run-simulation'),
  simulationQuantity: document.querySelector('#simulation-quantity'),
  board: document.querySelector('#board'),
  status: document.querySelector('#status'),
  metrics: document.querySelector('#metrics'),
  diceResult: document.querySelector('#dice-result'),
  simulationResult: document.querySelector('#simulation-result'),
};

function makeSeed() {
  const suffix = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
  return `CONQ-${new Date().getFullYear()}-${suffix}`;
}

function axialToPixel(q, r, size = 62) {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r,
  };
}

function renderBoard(board) {
  elements.board.replaceChildren();
  const positions = board.territories.map((territory) => ({
    territory,
    ...axialToPixel(territory.q, territory.r),
  }));
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x));
  const maxY = Math.max(...positions.map((position) => position.y));
  const padding = 76;
  elements.board.style.width = `${maxX - minX + padding * 2}px`;
  elements.board.style.height = `${maxY - minY + padding * 2}px`;

  for (const position of positions) {
    const { territory } = position;
    const resource = RESOURCES[territory.resourceId];
    const tile = document.createElement('article');
    tile.className = `hex ${resource.cssClass}`;
    tile.style.left = `${position.x - minX + padding - 58}px`;
    tile.style.top = `${position.y - minY + padding - 66}px`;
    tile.setAttribute(
      'aria-label',
      `${resource.territoryName}${territory.number ? `, número ${territory.number}` : ''}`,
    );
    tile.innerHTML = `
      <span class="hex-icon" aria-hidden="true">${resource.icon}</span>
      <span class="hex-name">${resource.shortName}</span>
      ${territory.number === null ? '' : `
        <span class="number-token ${[6, 8].includes(territory.number) ? 'number-token-hot' : ''}">
          <strong>${territory.number}</strong>
          <small>${'●'.repeat(territory.probabilityPoints)}</small>
        </span>
      `}
    `;
    elements.board.append(tile);
  }
}

function renderMetrics(board) {
  const validation = board.validation;
  const rows = RESOURCE_IDS.map((resourceId) => {
    const resource = RESOURCES[resourceId];
    const points = validation.metrics.resourceProbability[resourceId];
    return `<tr><td>${resource.shortName}</td><td>${points}</td></tr>`;
  }).join('');

  elements.metrics.innerHTML = `
    <dl class="summary-grid">
      <div><dt>Seed</dt><dd>${board.seed}</dd></div>
      <div><dt>Tentativas</dt><dd>${board.generationAttempts}</dd></div>
      <div><dt>Territórios</dt><dd>${validation.metrics.territoryCount}</dd></div>
      <div><dt>Marcadores</dt><dd>${validation.metrics.numberTokenCount}</dd></div>
      <div><dt>Produção total</dt><dd>${validation.metrics.totalProbability}</dd></div>
      <div><dt>Conflitos 6/8</dt><dd>${validation.metrics.highNumberConflictCount}</dd></div>
    </dl>
    <table>
      <thead><tr><th>Recurso</th><th>Pontos</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${validation.warnings.length ? `<div class="warning">${validation.warnings.join('<br>')}</div>` : ''}
  `;
}

function generateCurrentBoard() {
  const seed = elements.seed.value.trim() || makeSeed();
  elements.seed.value = seed;
  try {
    const board = boardGenerator.generate(seed);
    renderBoard(board);
    renderMetrics(board);
    elements.status.textContent = 'Tabuleiro válido';
    elements.status.className = 'status status-valid';
    diceEngine = new DiceEngine(`${seed}-DICE`);
  } catch (error) {
    elements.status.textContent = error.message;
    elements.status.className = 'status status-invalid';
  }
}

elements.generate.addEventListener('click', generateCurrentBoard);
elements.randomSeed.addEventListener('click', () => {
  elements.seed.value = makeSeed();
  generateCurrentBoard();
});
elements.rollDice.addEventListener('click', () => {
  const result = diceEngine.roll();
  elements.diceResult.textContent = `${result.die1} + ${result.die2} = ${result.total}`;
});
elements.simulate.addEventListener('click', () => {
  const quantity = Number.parseInt(elements.simulationQuantity.value, 10);
  elements.simulationResult.textContent = 'A executar…';
  requestAnimationFrame(() => {
    try {
      const simulator = new Simulator();
      const result = simulator.run({ quantity, seedPrefix: elements.seed.value || 'CONQ-SIM' });
      const resourceLines = RESOURCE_IDS.map((resourceId) => {
        const metric = result.resourceProbability[resourceId];
        return `${RESOURCES[resourceId].shortName}: média ${metric.average.toFixed(2)} (${metric.min}–${metric.max})`;
      }).join('\n');
      elements.simulationResult.textContent = [
        `${result.generatedBoards}/${result.requestedBoards} tabuleiros válidos`,
        `Falhas: ${result.failures}`,
        `Média de tentativas: ${result.averageAttempts.toFixed(2)}`,
        `Tempo: ${result.elapsedMs.toFixed(1)} ms`,
        '',
        resourceLines,
      ].join('\n');
    } catch (error) {
      elements.simulationResult.textContent = error.message;
    }
  });
});

elements.seed.value = 'CONQ-2026-ATLANTICO';
generateCurrentBoard();
