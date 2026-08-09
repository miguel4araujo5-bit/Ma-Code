const TARGET_CARD_TITLES = new Set([
  'Mover Contrabandista',
  'Mover Tempestade Atlântica',
]);

let scheduled = false;

function findTargetGuide() {
  const existing = document.querySelector(
    '.action-panel [data-seven-target-guide="true"]',
  );

  if (existing) {
    return existing;
  }

  const cards = document.querySelectorAll(
    '.action-panel .instruction-card',
  );

  return [...cards].find((card) => {
    const title = card
      .querySelector('strong')
      ?.textContent
      ?.trim();

    return TARGET_CARD_TITLES.has(title);
  }) || null;
}

function enhanceGuide(card) {
  if (!card) {
    return false;
  }

  const title = card.querySelector('strong');
  const copy = card.querySelector('span');
  const currentTitle = title?.textContent?.trim();
  const threatKind =
    card.dataset.sevenThreatKind ||
    (currentTitle === 'Mover Tempestade Atlântica'
      ? 'storm'
      : 'contrabandist');
  const isStorm = threatKind === 'storm';

  card.dataset.sevenTargetGuide = 'true';
  card.dataset.sevenThreatKind = threatKind;
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');

  if (title) {
    title.textContent = 'Selecione diretamente no mapa';
  }

  if (copy) {
    copy.textContent = isStorm
      ? 'As regiões costeiras e ligações marítimas válidas já estão destacadas.'
      : 'Os territórios válidos para o Contrabandista já estão destacados.';
  }

  return true;
}

function enhanceTerritoryTargets() {
  const territories = document.querySelectorAll(
    '.territory[style*="cursor:pointer"]',
  );

  territories.forEach((territory) => {
    territory.classList.add(
      'seven-target-territory',
    );

    const group = territory.closest(
      '.territory-group',
    );

    if (!group) {
      return;
    }

    group.classList.add(
      'seven-target-territory-group',
    );

    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');

    if (group.dataset.sevenTargetBound === 'true') {
      return;
    }

    group.dataset.sevenTargetBound = 'true';

    group.addEventListener(
      'click',
      (event) => {
        if (
          event.target === territory ||
          event.target.closest?.('[data-territory-id]')
        ) {
          return;
        }

        territory.dispatchEvent(
          new MouseEvent('click', {
            bubbles: false,
            cancelable: true,
            view: window,
          }),
        );
      },
    );

    group.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key !== 'Enter' &&
          event.key !== ' '
        ) {
          return;
        }

        event.preventDefault();

        territory.dispatchEvent(
          new MouseEvent('click', {
            bubbles: false,
            cancelable: true,
            view: window,
          }),
        );
      },
    );
  });

  return territories.length;
}

function enhanceEdgeTargets() {
  const edges = document.querySelectorAll(
    '.board-edge.is-valid',
  );

  edges.forEach((edge) => {
    edge.classList.add(
      'seven-target-edge',
    );
  });

  return edges.length;
}

function clearMode() {
  document
    .querySelector('.board-panel')
    ?.classList.remove(
      'is-seven-target-mode',
    );
}

function applyEnhancement() {
  scheduled = false;

  const guide = findTargetGuide();

  if (!guide) {
    clearMode();
    return;
  }

  enhanceGuide(guide);

  const territoryCount =
    enhanceTerritoryTargets();

  const edgeCount =
    enhanceEdgeTargets();

  const board = document.querySelector(
    '.board-panel',
  );

  if (
    board &&
    territoryCount + edgeCount > 0
  ) {
    board.classList.add(
      'is-seven-target-mode',
    );
  }
}

function scheduleEnhancement() {
  if (scheduled) {
    return;
  }

  scheduled = true;

  requestAnimationFrame(
    applyEnhancement,
  );
}

const app = document.querySelector('#app');

if (app) {
  new MutationObserver(
    scheduleEnhancement,
  ).observe(
    app,
    {
      childList: true,
      subtree: true,
    },
  );

  scheduleEnhancement();
}
