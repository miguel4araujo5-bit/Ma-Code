const ROLL_DURATION = 860;
const RESULT_HOLD_DURATION = 520;
const STEP_DURATION = 78;

let activeOverlay = null;
let activeTimer = null;
let activeRun = 0;
let releasingRealRoll = false;

function setRollingState(active) {
  document.documentElement.classList.toggle(
    'dice-roll-in-progress',
    active,
  );
}

function randomDieValue() {
  return Math.floor(Math.random() * 6) + 1;
}

function createPips(value) {
  const pipPositions = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ],
    5: [
      'top-left',
      'top-right',
      'center',
      'bottom-left',
      'bottom-right',
    ],
    6: [
      'top-left',
      'middle-left',
      'bottom-left',
      'top-right',
      'middle-right',
      'bottom-right',
    ],
  };

  return (pipPositions[value] || [])
    .map(
      (position) =>
        `<span class="dice-roll-pip dice-roll-pip--${position}"></span>`,
    )
    .join('');
}

function setDieValue(element, value) {
  element.dataset.value = String(value);

  element.setAttribute(
    'aria-label',
    `Dado ${value}`,
  );

  element.innerHTML = createPips(value);
}

function readFinalRoll() {
  const result =
    document.querySelector('.dice-result');

  if (!result) {
    return null;
  }

  const values = [
    ...result.querySelectorAll('span'),
  ]
    .slice(0, 2)
    .map(
      (element) =>
        Number(
          element.textContent?.trim(),
        ),
    );

  const total = Number(
    result
      .querySelector('strong')
      ?.textContent
      ?.trim(),
  );

  if (
    values.length !== 2 ||
    values.some(
      (value) =>
        !Number.isInteger(value) ||
        value < 1 ||
        value > 6,
    ) ||
    !Number.isInteger(total)
  ) {
    return null;
  }

  return {
    die1: values[0],
    die2: values[1],
    total,
  };
}

function removeOverlay() {
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }

  activeOverlay?.remove();
  activeOverlay = null;

  setRollingState(false);
}

function createOverlay() {
  removeOverlay();
  setRollingState(true);

  const overlay =
    document.createElement('div');

  overlay.className =
    'dice-roll-overlay';

  overlay.setAttribute(
    'role',
    'status',
  );

  overlay.setAttribute(
    'aria-live',
    'polite',
  );

  overlay.setAttribute(
    'aria-label',
    'A lançar os dados',
  );

  overlay.innerHTML = `
    <div class="dice-roll-stage">
      <span class="dice-roll-kicker">
        A sorte da Jornada
      </span>

      <div
        class="dice-roll-pair"
        aria-hidden="true"
      >
        <div
          class="dice-roll-die"
          data-die="1"
        ></div>

        <div
          class="dice-roll-die"
          data-die="2"
        ></div>
      </div>

      <div
        class="dice-roll-total"
        aria-hidden="true"
      >
        <span>Total</span>
        <strong>—</strong>
      </div>
    </div>
  `;

  document.body.appendChild(
    overlay,
  );

  activeOverlay = overlay;

  return overlay;
}

function executeRealRoll(button) {
  releasingRealRoll = true;

  try {
    button.click();
  } finally {
    releasingRealRoll = false;
  }

  return readFinalRoll();
}

function animateRoll(button) {
  const runId =
    ++activeRun;

  const overlay =
    createOverlay();

  const dice = [
    ...overlay.querySelectorAll(
      '.dice-roll-die',
    ),
  ];

  const totalElement =
    overlay.querySelector(
      '.dice-roll-total strong',
    );

  const reducedMotion =
    window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

  const updateRollingValues = () => {
    const first =
      randomDieValue();

    const second =
      randomDieValue();

    setDieValue(
      dice[0],
      first,
    );

    setDieValue(
      dice[1],
      second,
    );

    if (totalElement) {
      totalElement.textContent =
        String(
          first + second,
        );
    }
  };

  updateRollingValues();

  if (!reducedMotion) {
    activeTimer =
      window.setInterval(
        updateRollingValues,
        STEP_DURATION,
      );
  }

  window.setTimeout(
    () => {
      if (
        runId !== activeRun ||
        !activeOverlay
      ) {
        return;
      }

      if (activeTimer) {
        clearInterval(
          activeTimer,
        );

        activeTimer = null;
      }

      const finalRoll =
        executeRealRoll(
          button,
        );

      if (!finalRoll) {
        removeOverlay();
        return;
      }

      setDieValue(
        dice[0],
        finalRoll.die1,
      );

      setDieValue(
        dice[1],
        finalRoll.die2,
      );

      if (totalElement) {
        totalElement.textContent =
          String(
            finalRoll.total,
          );
      }

      overlay.classList.add(
        'is-result',
      );

      overlay.setAttribute(
        'aria-label',
        `Resultado dos dados: ${finalRoll.die1} e ${finalRoll.die2}, total ${finalRoll.total}`,
      );

      window.setTimeout(
        () => {
          if (
            runId !== activeRun ||
            !activeOverlay
          ) {
            return;
          }

          overlay.classList.add(
            'is-leaving',
          );

          window.setTimeout(
            () => {
              if (
                runId === activeRun
              ) {
                removeOverlay();
              }
            },
            reducedMotion
              ? 0
              : 220,
          );
        },
        reducedMotion
          ? 260
          : RESULT_HOLD_DURATION,
      );
    },
    reducedMotion
      ? 80
      : ROLL_DURATION,
  );
}

document.addEventListener(
  'click',
  (event) => {
    const button =
      event.target.closest(
        '#roll-dice-button',
      );

    if (
      !button ||
      button.disabled ||
      releasingRealRoll
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    animateRoll(
      button,
    );
  },
  true,
);
