const SOURCE_ID = 'online-turn-countdown';
const CLOCK_ID = 'online-turn-voyage-clock';
const INTRO_ID = 'online-turn-voyage-intro';
const INTRO_HOLD_MS = 1050;
const INTRO_FADE_MS = 240;

let source = null;
let sourceObserver = null;
let clock = null;
let intro = null;
let introTimer = null;
let lastSeconds = null;
let duration = 15;

function readSeconds(element) {
  const value = Number(element?.textContent?.trim());

  return Number.isFinite(value)
    ? Math.max(0, Math.ceil(value))
    : null;
}

function getDuration(seconds) {
  return seconds > 15
    ? 30
    : 15;
}

function createClockFace() {
  const element =
    document.createElement('div');

  element.className =
    'turn-voyage-clock';

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

function applyClockState(
  element,
  seconds,
  total,
) {
  if (!element) {
    return;
  }

  const ratio =
    Math.max(
      0,
      Math.min(
        1,
        seconds /
          Math.max(
            1,
            total,
          ),
      ),
    );

  const angle =
    (1 - ratio) *
    360;

  element.style.setProperty(
    '--voyage-progress',
    `${ratio * 100}%`,
  );

  element.style.setProperty(
    '--voyage-hand-angle',
    `${angle}deg`,
  );

  element.classList.toggle(
    'is-urgent',
    seconds <= 5,
  );

  element.classList.toggle(
    'is-expired',
    seconds <= 0,
  );

  const number =
    element.querySelector(
      '.turn-voyage-clock__number',
    );

  if (number) {
    number.textContent =
      String(seconds);
  }
}

function createCompactClock() {
  const element =
    createClockFace();

  element.id =
    CLOCK_ID;

  element.setAttribute(
    'role',
    'timer',
  );

  element.setAttribute(
    'aria-live',
    'off',
  );

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
    createCompactClock();

  source.insertAdjacentElement(
    'beforebegin',
    element,
  );

  return element;
}

function removeIntro() {
  if (introTimer) {
    window.clearTimeout(
      introTimer,
    );

    introTimer =
      null;
  }

  intro?.remove();

  intro =
    null;
}

function showIntro(
  seconds,
  total,
) {
  removeIntro();

  const overlay =
    document.createElement('div');

  overlay.id =
    INTRO_ID;

  overlay.setAttribute(
    'aria-hidden',
    'true',
  );

  Object.assign(
    overlay.style,
    {
      position:
        'fixed',

      inset:
        '0',

      zIndex:
        '9995',

      display:
        'grid',

      placeItems:
        'center',

      pointerEvents:
        'none',

      background:
        'rgba(4,28,39,0.10)',

      backdropFilter:
        'blur(1px)',

      opacity:
        '1',

      transition:
        `opacity ${INTRO_FADE_MS}ms ease`,
    },
  );

  const stage =
    document.createElement('div');

  Object.assign(
    stage.style,
    {
      width:
        'min(300px, calc(100vw - 34px))',

      padding:
        '22px 28px 20px',

      border:
        '1px solid rgba(222,198,128,0.80)',

      borderRadius:
        '22px',

      background:
        'linear-gradient(145deg, rgba(11,64,85,.98), rgba(7,43,58,.99))',

      boxShadow:
        '0 22px 60px rgba(0,0,0,.34), inset 0 0 0 3px rgba(255,248,225,.06)',

      color:
        '#fff9e8',

      textAlign:
        'center',

      transform:
        'translateY(-1vh)',
    },
  );

  const kicker =
    document.createElement('span');

  kicker.textContent =
    'Tempo da Jornada';

  Object.assign(
    kicker.style,
    {
      display:
        'block',

      marginBottom:
        '22px',

      color:
        '#e3cd8a',

      fontSize:
        '.76rem',

      fontWeight:
        '800',

      letterSpacing:
        '.14em',

      textTransform:
        'uppercase',
    },
  );

  const clockSlot =
    document.createElement('div');

  Object.assign(
    clockSlot.style,
    {
      display:
        'grid',

      placeItems:
        'center',

      minHeight:
        '145px',
    },
  );

  const heroScale =
    document.createElement('div');

  Object.assign(
    heroScale.style,
    {
      width:
        '52px',

      height:
        '52px',

      transform:
        'scale(2.55)',

      transformOrigin:
        'center',
    },
  );

  const heroClock =
    createClockFace();

  heroClock.style.marginLeft =
    '0';

  applyClockState(
    heroClock,
    seconds,
    total,
  );

  heroScale.appendChild(
    heroClock,
  );

  clockSlot.appendChild(
    heroScale,
  );

  const caption =
    document.createElement('div');

  Object.assign(
    caption.style,
    {
      display:
        'flex',

      alignItems:
        'baseline',

      justifyContent:
        'center',

      gap:
        '10px',

      marginTop:
        '13px',
    },
  );

  caption.innerHTML = `
    <span
      style="
        color:rgba(255,249,232,.72);
        font-size:.76rem;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase
      "
    >
      Tempo para agir
    </span>

    <strong
      style="
        color:#fff1b0;
        font-size:1.55rem;
        line-height:1;
        font-variant-numeric:tabular-nums
      "
    >
      ${seconds}s
    </strong>
  `;

  stage.append(
    kicker,
    clockSlot,
    caption,
  );

  overlay.appendChild(
    stage,
  );

  document.body.appendChild(
    overlay,
  );

  intro =
    overlay;

  introTimer =
    window.setTimeout(
      () => {
        if (
          intro !==
          overlay
        ) {
          return;
        }

        overlay.style.opacity =
          '0';

        introTimer =
          window.setTimeout(
            () => {
              if (
                intro ===
                overlay
              ) {
                overlay.remove();

                intro =
                  null;
              }

              introTimer =
                null;
            },

            INTRO_FADE_MS,
          );
      },

      INTRO_HOLD_MS,
    );
}

function animateCompactReset() {
  if (!clock) {
    return;
  }

  clock.classList.remove(
    'is-new-turn',
  );

  void clock.offsetWidth;

  clock.classList.add(
    'is-new-turn',
  );
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

  if (
    seconds ===
    null
  ) {
    return;
  }

  const firstPaint =
    lastSeconds ===
    null;

  const newTurn =
    !firstPaint &&
    seconds >
      lastSeconds + 2;

  if (
    firstPaint ||
    newTurn
  ) {
    duration =
      getDuration(
        seconds,
      );
  }

  applyClockState(
    clock,
    seconds,
    duration,
  );

  clock.setAttribute(
    'aria-label',

    source.getAttribute(
      'aria-label',
    ) ||
      `${seconds} segundos restantes`,
  );

  if (firstPaint) {
    showIntro(
      seconds,
      duration,
    );
  } else if (
    newTurn
  ) {
    animateCompactReset();

    showIntro(
      seconds,
      duration,
    );
  }

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

  removeIntro();

  lastSeconds =
    null;

  duration =
    15;
}

function mount(element) {
  if (
    element ===
    source
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
    getDuration(
      readSeconds(
        element,
      ) || 15,
    );

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
