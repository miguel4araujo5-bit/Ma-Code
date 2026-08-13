const SOURCE_ID = 'online-turn-countdown';
const CLOCK_ID = 'online-turn-voyage-clock';

let source = null;
let sourceObserver = null;
let clock = null;
let lastSeconds = null;
let duration = 15;

function readSeconds(element) {
  const value = Number(
    element?.textContent?.trim(),
  );

  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.ceil(value),
      )
    : null;
}

function createClock() {
  const element =
    document.createElement('div');

  element.id =
    CLOCK_ID;

  element.className =
    'turn-voyage-clock';

  element.setAttribute(
    'role',
    'timer',
  );

  element.setAttribute(
    'aria-live',
    'off',
  );

  element.innerHTML = `
    <span
      class="turn-voyage-clock__crown"
      aria-hidden="true"
    ></span>

    <span
      class="turn-voyage-clock__case"
      aria-hidden="true"
    >
      <span
        class="turn-voyage-clock__dial"
      >
        <span
          class="turn-voyage-clock__rose"
        ></span>

        <span
          class="turn-voyage-clock__ticks"
        ></span>

        <span
          class="turn-voyage-clock__hand"
        ></span>

        <span
          class="turn-voyage-clock__pin"
        ></span>
      </span>
    </span>

    <strong
      class="turn-voyage-clock__number"
    >—</strong>
  `;

  return element;
}

function ensureClock() {
  if (
    !source?.isConnected
  ) {
    return null;
  }

  const existing =
    document.getElementById(
      CLOCK_ID,
    );

  if (existing) {
    return existing;
  }

  const element =
    createClock();

  source.insertAdjacentElement(
    'beforebegin',
    element,
  );

  return element;
}

function updateClock() {
  if (
    !source?.isConnected
  ) {
    unmount();
    return;
  }

  clock =
    ensureClock();

  if (!clock) {
    return;
  }

  const seconds =
    readSeconds(
      source,
    );

  if (seconds === null) {
    return;
  }

  if (
    seconds > 15
  ) {
    duration = 30;
  } else if (
    lastSeconds !== null &&
    seconds >
      lastSeconds + 2
  ) {
    duration = 15;
  }

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        seconds /
          Math.max(
            1,
            duration,
          ),
      ),
    );

  const angle =
    (1 - ratio) *
    360;

  clock.style.setProperty(
    '--voyage-progress',
    `${ratio * 100}%`,
  );

  clock.style.setProperty(
    '--voyage-hand-angle',
    `${angle}deg`,
  );

  clock.classList.toggle(
    'is-urgent',
    seconds <= 5,
  );

  clock.classList.toggle(
    'is-expired',
    seconds <= 0,
  );

  const number =
    clock.querySelector(
      '.turn-voyage-clock__number',
    );

  if (number) {
    number.textContent =
      String(seconds);
  }

  if (
    lastSeconds !== null &&
    seconds >
      lastSeconds + 2
  ) {
    clock.classList.remove(
      'is-new-turn',
    );

    void clock.offsetWidth;

    clock.classList.add(
      'is-new-turn',
    );
  }

  clock.setAttribute(
    'aria-label',
    source.getAttribute(
      'aria-label',
    ) ||
      `${seconds} segundos restantes`,
  );

  lastSeconds =
    seconds;
}

function unmount() {
  sourceObserver
    ?.disconnect();

  sourceObserver =
    null;

  source =
    null;

  clock?.remove();

  clock =
    null;

  lastSeconds =
    null;

  duration =
    15;
}

function mount(element) {
  if (
    element === source
  ) {
    updateClock();
    return;
  }

  sourceObserver
    ?.disconnect();

  source =
    element;

  lastSeconds =
    null;

  duration =
    readSeconds(
      element,
    ) > 15
      ? 30
      : 15;

  clock =
    ensureClock();

  updateClock();

  sourceObserver =
    new MutationObserver(
      updateClock,
    );

  sourceObserver.observe(
    element,
    {
      childList:
        true,

      characterData:
        true,

      subtree:
        true,

      attributes:
        true,

      attributeFilter: [
        'aria-label',
        'title',
      ],
    },
  );
}

function discover() {
  const element =
    document.getElementById(
      SOURCE_ID,
    );

  if (element) {
    mount(
      element,
    );

    return;
  }

  if (source) {
    unmount();
  }
}

const pageObserver =
  new MutationObserver(
    discover,
  );

pageObserver.observe(
  document.documentElement,
  {
    childList:
      true,

    subtree:
      true,
  },
);

discover();
