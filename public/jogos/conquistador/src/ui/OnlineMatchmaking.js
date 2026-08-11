const API_BASE = '/api/conquistador/matchmaking';
const GAME_API_URL = '/api/conquistador/game';
const POLL_INTERVAL_MS = 250;
const STORED_NAME_KEY = 'conquistador-online-name';
const STORED_SESSION_KEY = 'conquistador-online-session-v1';

let ticketId = null;
let playerId = null;
let reconnectToken = null;
let pollTimer = null;
let countdownTimer = null;
let deadlineAt = null;
let busy = false;
let readyMatchData = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getStoredName() {
  try {
    return localStorage.getItem(STORED_NAME_KEY) || '';
  } catch {
    return '';
  }
}

function storeName(name) {
  try {
    localStorage.setItem(STORED_NAME_KEY, name);
  } catch {
    return;
  }
}

function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORED_SESSION_KEY);

    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);

    if (
      !data ||
      typeof data !== 'object' ||
      typeof data.matchId !== 'string' ||
      typeof data.playerId !== 'string' ||
      typeof data.reconnectToken !== 'string' ||
      !Array.isArray(data.participants)
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function storeSession(data) {
  try {
    localStorage.setItem(
      STORED_SESSION_KEY,
      JSON.stringify(data),
    );
  } catch {
    return;
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(STORED_SESSION_KEY);
  } catch {
    return;
  }
}

function notifyVoluntaryGameLeave(session) {
  if (
    !session?.matchId ||
    !session?.playerId ||
    !session?.reconnectToken
  ) {
    return;
  }

  try {
    void fetch(GAME_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'leave',
        matchId: session.matchId,
        playerId: session.playerId,
        reconnectToken: session.reconnectToken,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    return;
  }
}

async function post(action, payload = {}) {
  const response = await fetch(`${API_BASE}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    throw new Error(
      data?.message || 'Não foi possível contactar o matchmaking.',
    );
  }

  return data;
}

function stopTimers() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function resetSession() {
  stopTimers();
  ticketId = null;
  playerId = null;
  reconnectToken = null;
  deadlineAt = null;
  busy = false;
  readyMatchData = null;
}

function removeOverlay() {
  document.querySelector('#online-matchmaking-overlay')?.remove();
}

function closeOverlay() {
  removeOverlay();
  resetSession();
}

function getOverlay() {
  return document.querySelector('#online-matchmaking-overlay');
}

function createOverlay() {
  removeOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'online-matchmaking-overlay';
  overlay.className = 'online-matchmaking-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'online-matchmaking-title');

  document.body.appendChild(overlay);

  return overlay;
}

function renderEntry() {
  resetSession();

  const overlay = createOverlay();
  const storedName = getStoredName();

  overlay.innerHTML = `
    <section class="online-matchmaking-card online-matchmaking-entry">
      <button
        type="button"
        class="online-matchmaking-close"
        data-online-close
        aria-label="Fechar"
      >
        ×
      </button>

      <p class="online-matchmaking-eyebrow">
        Conquistador Online
      </p>

      <h2 id="online-matchmaking-title">
        Encontrar adversários
      </h2>

      <p class="online-matchmaking-copy">
        Procuramos jogadores durante 5 segundos. Os lugares que ficarem livres são preenchidos automaticamente.
      </p>

      <form id="online-matchmaking-form" class="online-matchmaking-form">
        <label>
          <span>O seu nome</span>
          <input
            id="online-player-name"
            name="name"
            type="text"
            maxlength="24"
            autocomplete="nickname"
            value="${escapeHtml(storedName)}"
            placeholder="Ex.: Miguel"
            required
          />
        </label>

        <button
          type="submit"
          class="button button-primary button-large online-matchmaking-submit"
        >
          Jogar Online
        </button>
      </form>

      <p id="online-matchmaking-error" class="online-matchmaking-error" hidden></p>
    </section>
  `;

  overlay
    .querySelector('#online-player-name')
    ?.focus();
}

function renderWaiting() {
  const overlay = getOverlay() || createOverlay();

  overlay.innerHTML = `
    <section class="online-matchmaking-card online-matchmaking-waiting">
      <button
        type="button"
        class="online-matchmaking-close"
        data-online-cancel
        aria-label="Cancelar procura"
      >
        ×
      </button>

      <p class="online-matchmaking-eyebrow">
        A procurar jogadores
      </p>

      <div class="online-matchmaking-countdown" aria-live="polite">
        <strong id="online-countdown-value">5</strong>
        <span>segundos</span>
      </div>

      <h2 id="online-matchmaking-title">
        A reunir a expedição…
      </h2>

      <p class="online-matchmaking-copy">
        Se quatro jogadores estiverem disponíveis, a partida fica pronta imediatamente.
      </p>

      <div class="online-matchmaking-search-slots" aria-hidden="true">
        <span class="is-human">●</span>
        <span>●</span>
        <span>●</span>
        <span>●</span>
      </div>

      <button
        type="button"
        class="button button-secondary online-matchmaking-cancel"
        data-online-cancel
      >
        Cancelar
      </button>
    </section>
  `;

  updateCountdown();

  countdownTimer = window.setInterval(
    updateCountdown,
    100,
  );
}

function updateCountdown() {
  const value = document.querySelector('#online-countdown-value');

  if (!value || !deadlineAt) {
    return;
  }

  const remaining = Math.max(0, deadlineAt - Date.now());
  value.textContent = String(Math.max(0, Math.ceil(remaining / 1000)));
}

function participantMarkup(participant) {
  const isBot = participant.kind === 'bot';
  const isSelf = participant.id === playerId;
  const icon = isBot ? escapeHtml(participant.icon || '⚙') : '';

  return `
    <li class="online-participant ${isBot ? 'is-bot' : 'is-human'} ${isSelf ? 'is-self' : ''}">
      <span class="online-participant-marker" aria-hidden="true">
        ${isBot ? icon : '●'}
      </span>

      <span class="online-participant-name">
        ${escapeHtml(participant.name)}
      </span>

      ${isSelf ? '<small>Você</small>' : ''}
    </li>
  `;
}

function renderMatch(data) {
  stopTimers();
  busy = false;

  const overlay = getOverlay() || createOverlay();
  const participants = Array.isArray(data.participants)
    ? data.participants
    : [];

  playerId = data.playerId || playerId;
  reconnectToken = data.reconnectToken || reconnectToken;

  if (!data.matchId || !playerId || !reconnectToken) {
    throw new Error(
      'A partida foi encontrada, mas a credencial de reconexão não ficou disponível.',
    );
  }

  readyMatchData = {
    matchId: data.matchId,
    playerId,
    reconnectToken,
    participants,
    savedAt: Date.now(),
  };

  storeSession(readyMatchData);

  overlay.innerHTML = `
    <section class="online-matchmaking-card online-matchmaking-found">
      <p class="online-matchmaking-eyebrow">
        Partida encontrada
      </p>

      <div class="online-matchmaking-success" aria-hidden="true">
        ✓
      </div>

      <h2 id="online-matchmaking-title">
        A expedição está completa
      </h2>

      <p class="online-matchmaking-copy">
        ${Number(data.humanCount) || 0} jogador${Number(data.humanCount) === 1 ? '' : 'es'} online · ${Number(data.botCount) || 0} adversário${Number(data.botCount) === 1 ? '' : 's'} automático${Number(data.botCount) === 1 ? '' : 's'}
      </p>

      <ul class="online-participants">
        ${participants.map(participantMarkup).join('')}
      </ul>

      <div class="online-matchmaking-ready-note">
        <span>⚙</span>
        <p>
          O ícone identifica discretamente os adversários automáticos.
        </p>
      </div>

      <button
        type="button"
        class="button button-primary button-large"
        data-online-enter
      >
        Entrar na partida
      </button>

      <button
        type="button"
        class="text-button online-matchmaking-back"
        data-online-close
      >
        Voltar
      </button>
    </section>
  `;
}

function showError(message) {
  const element = document.querySelector('#online-matchmaking-error');

  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = false;
}

async function startSearch(name) {
  if (busy) {
    return;
  }

  busy = true;
  storeName(name);

  try {
    const response = await post('join', { name });

    ticketId = response.ticketId || null;
    playerId = response.playerId || playerId;
    reconnectToken = response.reconnectToken || reconnectToken;

    if (response.status === 'matched') {
      renderMatch(response);
      return;
    }

    deadlineAt = Number(response.deadlineAt) || (Date.now() + 5000);
    renderWaiting();
    schedulePoll();
  } catch (error) {
    busy = false;
    showError(
      error instanceof Error
        ? error.message
        : 'Não foi possível iniciar a procura.',
    );
  }
}

function schedulePoll() {
  if (!ticketId) {
    return;
  }

  pollTimer = window.setTimeout(
    pollStatus,
    POLL_INTERVAL_MS,
  );
}

async function pollStatus() {
  if (!ticketId) {
    return;
  }

  try {
    const response = await post('status', { ticketId });

    playerId = response.playerId || playerId;
    reconnectToken = response.reconnectToken || reconnectToken;

    if (response.status === 'matched') {
      renderMatch(response);
      return;
    }

    if (response.status === 'left') {
      renderEntry();
      return;
    }

    if (Number.isFinite(Number(response.deadlineAt))) {
      deadlineAt = Number(response.deadlineAt);
    }

    schedulePoll();
  } catch (error) {
    stopTimers();
    busy = false;

    const overlay = getOverlay();

    if (overlay) {
      overlay.innerHTML = `
        <section class="online-matchmaking-card online-matchmaking-entry">
          <p class="online-matchmaking-eyebrow">Conquistador Online</p>
          <h2 id="online-matchmaking-title">Ligação interrompida</h2>
          <p class="online-matchmaking-copy">
            ${escapeHtml(error instanceof Error ? error.message : 'Não foi possível continuar o matchmaking.')}
          </p>
          <button type="button" class="button button-primary" data-online-retry>
            Tentar novamente
          </button>
          <button type="button" class="text-button online-matchmaking-back" data-online-close>
            Voltar
          </button>
        </section>
      `;
    }
  }
}

async function cancelSearch() {
  const pendingTicketId = ticketId;

  resetSession();

  if (pendingTicketId) {
    try {
      await post('leave', { ticketId: pendingTicketId });
    } catch {
      return renderEntry();
    }
  }

  renderEntry();
}

function injectOnlineButton() {
  const heroActions = document.querySelector('.home-screen .hero-actions');

  if (!heroActions || heroActions.querySelector('#online-game-button')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'online-game-button';
  button.type = 'button';
  button.className = 'button button-secondary button-large online-game-button';
  button.innerHTML = '<span aria-hidden="true">◉</span> Jogar Online';

  heroActions.appendChild(button);
}

const app = document.querySelector('#app');

if (app) {
  new MutationObserver(injectOnlineButton).observe(app, {
    childList: true,
    subtree: true,
  });

  injectOnlineButton();
}

document.addEventListener('submit', (event) => {
  const form = event.target.closest('#online-matchmaking-form');

  if (!form) {
    return;
  }

  event.preventDefault();

  const formData = new FormData(form);
  const name = String(formData.get('name') || '').trim();

  if (!name) {
    showError('Indique o seu nome para entrar no matchmaking.');
    return;
  }

  startSearch(name);
});

document.addEventListener(
  'click',
  (event) => {
    if (!event.target.closest('#leave-game-button')) {
      return;
    }

    const sessionToLeave =
      readyMatchData ||
      getStoredSession();

    notifyVoluntaryGameLeave(sessionToLeave);
    clearStoredSession();
    readyMatchData = null;
  },
  true,
);

document.addEventListener('click', (event) => {
  const onlineButton = event.target.closest('#online-game-button');

  if (onlineButton) {
    renderEntry();
    return;
  }

  if (event.target.closest('[data-online-cancel]')) {
    cancelSearch();
    return;
  }

  if (event.target.closest('[data-online-retry]')) {
    renderEntry();
    return;
  }

  if (event.target.closest('[data-online-enter]')) {
    if (
      !readyMatchData?.matchId ||
      !readyMatchData?.playerId ||
      !readyMatchData?.reconnectToken
    ) {
      return;
    }

    const detail = {
      matchId: readyMatchData.matchId,
      playerId: readyMatchData.playerId,
      reconnectToken: readyMatchData.reconnectToken,
      participants: readyMatchData.participants,
    };

    window.dispatchEvent(
      new CustomEvent(
        'conquistador:online-match-ready',
        { detail },
      ),
    );

    closeOverlay();
    return;
  }

  if (event.target.closest('[data-online-close]')) {
    closeOverlay();
  }
});

window.addEventListener('pagehide', () => {
  if (!ticketId || readyMatchData?.matchId) {
    return;
  }

  const body = JSON.stringify({ ticketId });

  navigator.sendBeacon?.(
    `${API_BASE}/leave`,
    new Blob([body], { type: 'application/json' }),
  );
});

function restoreStoredSession() {
  const stored = getStoredSession();

  if (!stored) {
    return;
  }

  readyMatchData = stored;
  playerId = stored.playerId;
  reconnectToken = stored.reconnectToken;

  window.dispatchEvent(
    new CustomEvent(
      'conquistador:online-match-ready',
      {
        detail: {
          matchId: stored.matchId,
          playerId: stored.playerId,
          reconnectToken: stored.reconnectToken,
          participants: stored.participants,
          restored: true,
        },
      },
    ),
  );
}

restoreStoredSession();
