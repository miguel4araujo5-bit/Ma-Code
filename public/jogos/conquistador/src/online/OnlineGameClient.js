const API_URL = '/api/conquistador/game';
const CLIENT_VERSION = 'realtime-free-safe-1';
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 30000;
const MAX_FALLBACK_POLL_INTERVAL_MS = 120000;
const REALTIME_CONNECT_TIMEOUT_MS = 8000;
const REALTIME_REQUEST_TIMEOUT_MS = 10000;
const REALTIME_RECONNECT_MIN_MS = 5000;
const REALTIME_RECONNECT_MAX_MS = 60000;
const STORED_SESSION_KEY = 'conquistador-online-session-v1';
const PRESENCE_COUNTDOWN_ID = 'online-presence-countdown';
const TURN_COUNTDOWN_ID = 'online-turn-countdown';
const COUNTDOWN_TICK_MS = 250;
const TURN_TIMEOUT_CLIENT_GRACE_MS = 1100;

function normalizeId(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 96);
}

function normalizeReconnectToken(value) {
  const token = String(value ?? '').trim();

  return (
    token.length >= 32 &&
    token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  )
    ? token
    : '';
}

function normalizeRevision(value) {
  const revision = Number(value);

  return Number.isInteger(revision) && revision >= 0
    ? revision
    : null;
}

function getStoredReconnectToken(matchId, playerId) {
  try {
    const raw = localStorage.getItem(STORED_SESSION_KEY);

    if (!raw) {
      return '';
    }

    const stored = JSON.parse(raw);

    if (
      !stored ||
      typeof stored !== 'object' ||
      normalizeId(stored.matchId) !== matchId ||
      normalizeId(stored.playerId) !== playerId
    ) {
      return '';
    }

    return normalizeReconnectToken(stored.reconnectToken);
  } catch {
    return '';
  }
}

function clearStoredSession(matchId, playerId) {
  try {
    const raw = localStorage.getItem(STORED_SESSION_KEY);

    if (!raw) {
      return;
    }

    const stored = JSON.parse(raw);

    if (
      normalizeId(stored?.matchId) === matchId &&
      normalizeId(stored?.playerId) === playerId
    ) {
      localStorage.removeItem(STORED_SESSION_KEY);
    }
  } catch {
    return;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function removePresenceCountdown() {
  document
    .querySelector(`#${PRESENCE_COUNTDOWN_ID}`)
    ?.remove();
}

function restoreDiceMargin() {
  const dice =
    document.querySelector('.turn-banner .dice-result');

  if (
    !dice ||
    dice.dataset.turnTimerMarginAdjusted !== 'true'
  ) {
    return;
  }

  dice.style.marginLeft =
    dice.dataset.turnTimerOriginalMarginLeft || '';

  delete dice.dataset.turnTimerMarginAdjusted;
  delete dice.dataset.turnTimerOriginalMarginLeft;
}

function removeTurnCountdown() {
  document
    .querySelector(`#${TURN_COUNTDOWN_ID}`)
    ?.remove();

  restoreDiceMargin();
}

function getPresenceWarning(data) {
  const warnings = Array.isArray(data?.presenceWarnings)
    ? data.presenceWarnings
    : [];

  const valid = warnings
    .filter((warning) => {
      const expiresAt = Number(warning?.expiresAt);

      return (
        warning &&
        typeof warning === 'object' &&
        Number.isFinite(expiresAt) &&
        expiresAt > Date.now()
      );
    })
    .sort(
      (first, second) =>
        Number(first.expiresAt) -
        Number(second.expiresAt),
    );

  return valid[0] || null;
}

function normalizeTurnTimer(data) {
  const timer = data?.turnTimer;

  if (
    !timer ||
    typeof timer !== 'object' ||
    Array.isArray(timer)
  ) {
    return null;
  }

  const actorId =
    normalizeId(timer.actorId);

  const actorName =
    String(timer.actorName ?? '').trim();

  const sequence =
    Number(timer.sequence);

  const durationMs =
    Number(timer.durationMs);

  const remainingMs =
    Number(timer.remainingMs);

  const timeoutStrikes =
    Number(timer.timeoutStrikes);

  const maxTimeoutStrikes =
    Number(timer.maxTimeoutStrikes);

  if (
    !actorId ||
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(remainingMs) ||
    remainingMs < 0
  ) {
    return null;
  }

  return {
    actorId,

    actorName:
      actorName ||
      'Jogador',

    sequence,

    durationMs,

    remainingMs,

    timeoutStrikes:
      Number.isInteger(timeoutStrikes) &&
      timeoutStrikes >= 0
        ? timeoutStrikes
        : 0,

    maxTimeoutStrikes:
      Number.isInteger(maxTimeoutStrikes) &&
      maxTimeoutStrikes > 0
        ? maxTimeoutStrikes
        : 2,

    receivedAt:
      typeof performance !== 'undefined'
        ? performance.now()
        : Date.now(),
  };
}

function getLocalTurnRemainingMs(timer) {
  if (!timer) {
    return null;
  }

  const now =
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();

  const elapsedMs =
    Math.max(
      0,
      now -
      Number(timer.receivedAt || 0),
    );

  return (
    Number(timer.remainingMs || 0) -
    elapsedMs
  );
}

function renderPresenceCountdown(warning) {
  if (!warning) {
    removePresenceCountdown();
    return;
  }

  const turnBanner =
    document.querySelector('.turn-banner');

  if (!turnBanner) {
    return;
  }

  const expiresAt =
    Number(warning.expiresAt);

  const remainingMs =
    Math.max(
      0,
      expiresAt - Date.now(),
    );

  const seconds =
    Math.max(
      0,
      Math.ceil(
        remainingMs / 1000,
      ),
    );

  if (seconds <= 0) {
    removePresenceCountdown();
    return;
  }

  let element =
    document.querySelector(
      `#${PRESENCE_COUNTDOWN_ID}`,
    );

  if (!element) {
    element =
      document.createElement('div');

    element.id =
      PRESENCE_COUNTDOWN_ID;

    element.setAttribute(
      'role',
      'status',
    );

    element.setAttribute(
      'aria-live',
      'polite',
    );

    element.style.display =
      'flex';

    element.style.alignItems =
      'center';

    element.style.gap =
      '0.55rem';

    element.style.marginLeft =
      'auto';

    element.style.padding =
      '0.45rem 0.7rem';

    element.style.border =
      '1px solid rgba(11,64,85,0.22)';

    element.style.borderRadius =
      '0.8rem';

    element.style.color =
      '#0b4055';

    element.style.background =
      'rgba(255,253,247,0.96)';

    element.style.boxShadow =
      '0 5px 16px rgba(9,39,54,0.12)';

    element.style.whiteSpace =
      'nowrap';

    element.style.position =
      'relative';

    element.style.zIndex =
      '20';

    const dice =
      turnBanner.querySelector(
        '.dice-result',
      );

    if (dice) {
      turnBanner.insertBefore(
        element,
        dice,
      );
    } else {
      turnBanner.appendChild(
        element,
      );
    }
  }

  const playerName =
    String(
      warning.playerName ??
      'jogador',
    ).trim() ||
    'jogador';

  const safeName =
    escapeHtml(playerName);

  element.setAttribute(
    'aria-label',
    `A aguardar ${playerName}. ${seconds} segundos restantes.`,
  );

  element.innerHTML = `
    <span
      aria-hidden="true"
      style="font-size:1.05rem;line-height:1"
    >⏱</span>

    <span
      style="display:flex;flex-direction:column;line-height:1.05"
    >
      <small
        style="opacity:.78;font-size:.68rem"
      >
        A aguardar ${safeName}
      </small>

      <strong
        style="font-size:1.15rem"
      >
        ${seconds}
      </strong>
    </span>
  `;
}

function renderTurnCountdown(timer) {
  if (!timer) {
    removeTurnCountdown();
    return;
  }

  const turnBanner =
    document.querySelector('.turn-banner');

  if (!turnBanner) {
    return;
  }

  const rawRemainingMs =
    getLocalTurnRemainingMs(
      timer,
    );

  const remainingMs =
    Math.max(
      0,
      Number(rawRemainingMs) || 0,
    );

  const seconds =
    Math.max(
      0,
      Math.ceil(
        remainingMs / 1000,
      ),
    );

  let element =
    document.querySelector(
      `#${TURN_COUNTDOWN_ID}`,
    );

  if (!element) {
    element =
      document.createElement('div');

    element.id =
      TURN_COUNTDOWN_ID;

    element.setAttribute(
      'role',
      'timer',
    );

    element.setAttribute(
      'aria-live',
      'off',
    );

    element.style.display =
      'grid';

    element.style.placeItems =
      'center';

    element.style.flex =
      '0 0 auto';

    element.style.width =
      'clamp(32px, 9vw, 37px)';

    element.style.height =
      'clamp(32px, 9vw, 37px)';

    element.style.marginLeft =
      'auto';

    element.style.border =
      '1px solid rgba(11,64,85,0.18)';

    element.style.borderRadius =
      '9px';

    element.style.color =
      '#0b4055';

    element.style.background =
      '#fff';

    element.style.boxShadow =
      '0 4px 12px rgba(9,39,54,0.1)';

    element.style.fontSize =
      'clamp(.9rem, 4vw, 1.05rem)';

    element.style.fontWeight =
      '900';

    element.style.fontVariantNumeric =
      'tabular-nums';

    element.style.lineHeight =
      '1';

    element.style.position =
      'relative';

    element.style.zIndex =
      '20';

    const dice =
      turnBanner.querySelector(
        '.dice-result',
      );

    if (dice) {
      if (
        dice.dataset
          .turnTimerMarginAdjusted !==
        'true'
      ) {
        dice.dataset
          .turnTimerOriginalMarginLeft =
          dice.style.marginLeft ||
          '';

        dice.dataset
          .turnTimerMarginAdjusted =
          'true';
      }

      dice.style.marginLeft =
        '0';

      turnBanner.insertBefore(
        element,
        dice,
      );
    } else {
      turnBanner.appendChild(
        element,
      );
    }
  }

  const actorName =
    String(
      timer.actorName ||
      'Jogador',
    );

  const strike =
    Math.max(
      0,
      Number(
        timer.timeoutStrikes,
      ) || 0,
    );

  const maxStrikes =
    Math.max(
      1,
      Number(
        timer.maxTimeoutStrikes,
      ) || 2,
    );

  element.setAttribute(
    'aria-label',
    `${actorName} tem ${seconds} segundos para jogar.`,
  );

  element.title =
    strike > 0
      ? `${actorName}: ${seconds}s para jogar · ${strike}/${maxStrikes} avisos por inatividade`
      : `${actorName}: ${seconds}s para jogar`;

  const urgent =
    seconds <= 5;

  element.style.color =
    urgent
      ? '#7f1d2d'
      : '#0b4055';

  element.style.borderColor =
    urgent
      ? 'rgba(140,47,57,.42)'
      : 'rgba(11,64,85,.18)';

  element.style.background =
    urgent
      ? '#fff0f1'
      : '#fff';

  element.textContent =
    String(seconds);
}

async function readJsonResponse(response) {
  let data = null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  if (
    !response.ok ||
    !data?.success
  ) {
    const error =
      new Error(
        data?.message ||
        'Não foi possível comunicar com a partida online.',
      );

    error.status =
      response.status;

    error.data =
      data;

    throw error;
  }

  return data;
}

function createSocketError(
  message,
  status = 0,
  data = null,
) {
  const error =
    new Error(
      message ||
      'Não foi possível comunicar com a partida online.',
    );

  error.status =
    Number(status) || 0;

  error.data =
    data;

  return error;
}

function isTerminalStatus(status) {
  return [
    401,
    403,
    410,
  ].includes(
    Number(status),
  );
}

function isPlayerReplaced(
  data,
  status = 0,
) {
  return (
    Number(status) === 410 ||
    data?.kicked === true ||
    data?.status ===
      'player-replaced'
  );
}

function createWebSocketUrl(matchId) {
  const protocol =
    window.location.protocol ===
    'https:'
      ? 'wss:'
      : 'ws:';

  const url =
    new URL(
      API_URL,
      window.location.href,
    );

  url.protocol =
    protocol;

  url.searchParams.set(
    'matchId',
    matchId,
  );

  return url.toString();
}

export class OnlineGameClient {
  constructor({
    matchId,
    playerId,
    reconnectToken = '',
    pollIntervalMs =
      DEFAULT_FALLBACK_POLL_INTERVAL_MS,
  }) {
    this.matchId =
      normalizeId(
        matchId,
      );

    this.playerId =
      normalizeId(
        playerId,
      );

    this.reconnectToken =
      normalizeReconnectToken(
        reconnectToken,
      ) ||
      getStoredReconnectToken(
        this.matchId,
        this.playerId,
      );

    this.pollIntervalMs =
      Math.max(
        DEFAULT_FALLBACK_POLL_INTERVAL_MS,
        Number(
          pollIntervalMs,
        ) ||
        DEFAULT_FALLBACK_POLL_INTERVAL_MS,
      );

    if (
      !this.matchId ||
      !this.playerId
    ) {
      throw new Error(
        'A sessão online não possui identificação válida.',
      );
    }

    if (
      !this.reconnectToken
    ) {
      throw new Error(
        'A credencial de reconexão desta partida não está disponível.',
      );
    }

    this.revision =
      null;

    this.state =
      null;

    this.polling =
      false;

    this.closed =
      false;

    this.listeners =
      new Set();

    this.errorListeners =
      new Set();

    this.sessionEndListeners =
      new Set();

    this.sessionEnded =
      false;

    this.presenceWarning =
      null;

    this.turnTimer =
      null;

    this.turnTimeoutSentSequence =
      null;

    this.socket =
      null;

    this.socketAuthenticated =
      false;

    this.socketConnecting =
      null;

    this.connectWaiter =
      null;

    this.pendingRequests =
      new Map();

    this.requestSequence =
      0;

    this.reconnectTimer =
      null;

    this.reconnectDelayMs =
      REALTIME_RECONNECT_MIN_MS;

    this.fallbackTimer =
      null;

    this.fallbackDelayMs =
      this.pollIntervalMs;

    this.handleVisibilityChange =
      this.handleVisibilityChange.bind(
        this,
      );

    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );

    this.countdownTimer =
      window.setInterval(
        () =>
          this.renderCountdown(),
        COUNTDOWN_TICK_MS,
      );
  }

  async request(payload) {
    const response =
      await fetch(
        API_URL,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-Conquistador-Client':
              CLIENT_VERSION,
          },

          keepalive:
            payload?.action ===
            'leave',

          body:
            JSON.stringify({
              matchId:
                this.matchId,

              playerId:
                this.playerId,

              reconnectToken:
                this.reconnectToken,

              ...payload,

              clientVersion:
                CLIENT_VERSION,
            }),
        },
      );

    try {
      return await readJsonResponse(
        response,
      );
    } catch (error) {
      this.handleTerminalError(
        error,
      );

      throw error;
    }
  }

  updatePresenceWarning(data) {
    if (
      !data ||
      !Object.prototype.hasOwnProperty.call(
        data,
        'presenceWarnings',
      )
    ) {
      return;
    }

    this.presenceWarning =
      getPresenceWarning(
        data,
      );

    this.renderCountdown();
  }

  updateTurnTimer(data) {
    if (
      !data ||
      !Object.prototype.hasOwnProperty.call(
        data,
        'turnTimer',
      )
    ) {
      return;
    }

    const previousSequence =
      this.turnTimer?.sequence ??
      null;

    const nextTimer =
      normalizeTurnTimer(
        data,
      );

    this.turnTimer =
      nextTimer;

    if (
      !nextTimer ||
      nextTimer.sequence !==
        previousSequence
    ) {
      this.turnTimeoutSentSequence =
        null;
    }

    this.renderCountdown();
  }

  maybeSubmitTurnTimeout() {
    const timer =
      this.turnTimer;

    if (
      !timer ||
      timer.actorId !==
        this.playerId
    ) {
      return;
    }

    if (
      this.turnTimeoutSentSequence ===
      timer.sequence
    ) {
      return;
    }

    if (
      !this.socket ||
      this.socket.readyState !==
        WebSocket.OPEN ||
      !this.socketAuthenticated
    ) {
      return;
    }

    const remainingMs =
      getLocalTurnRemainingMs(
        timer,
      );

    if (
      remainingMs === null ||
      remainingMs >
        -TURN_TIMEOUT_CLIENT_GRACE_MS
    ) {
      return;
    }

    this.turnTimeoutSentSequence =
      timer.sequence;

    void this.sendRealtimeRequest(
      'turn-timeout',
      {
        sequence:
          timer.sequence,
      },
    )
      .catch(
        (error) => {
          if (
            this.closed
          ) {
            return;
          }

          if (
            error?.data?.game
          ) {
            this.applyRealtimeState(
              error.data,
            );
          }

          if (
            isTerminalStatus(
              error?.status,
            )
          ) {
            this.handleTerminalError(
              error,
            );
          }
        },
      );
  }

  renderCountdown() {
    if (this.closed) {
      removePresenceCountdown();
      removeTurnCountdown();
      return;
    }

    this.maybeSubmitTurnTimeout();

    if (
      this.presenceWarning &&
      Number(
        this.presenceWarning
          .expiresAt,
      ) <= Date.now()
    ) {
      this.presenceWarning =
        null;
    }

    if (
      this.presenceWarning
    ) {
      removeTurnCountdown();

      renderPresenceCountdown(
        this.presenceWarning,
      );

      return;
    }

    removePresenceCountdown();

    renderTurnCountdown(
      this.turnTimer,
    );
  }

  applyState(data) {
    if (
      this.handlePlayerReplaced(
        data,
      )
    ) {
      return this.state;
    }

    if (!data?.game) {
      this.updatePresenceWarning(
        data,
      );

      this.updateTurnTimer(
        data,
      );

      return this.state;
    }

    const revision =
      normalizeRevision(
        data.revision,
      );

    if (
      revision !== null &&
      this.revision !== null &&
      revision <
        this.revision
    ) {
      return this.state;
    }

    this.revision =
      revision;

    this.state =
      data;

    this.updatePresenceWarning(
      data,
    );

    this.updateTurnTimer(
      data,
    );

    for (
      const listener
      of this.listeners
    ) {
      try {
        listener(
          data,
        );
      } catch {
        continue;
      }
    }

    this.renderCountdown();

    return data;
  }

  applyRealtimeState(data) {
    if (
      data?.status ===
      'not-modified'
    ) {
      this.updatePresenceWarning(
        data,
      );

      this.updateTurnTimer(
        data,
      );

      this.renderCountdown();

      return this.state;
    }

    return this.applyState(
      data,
    );
  }

  notifyError(error) {
    for (
      const listener
      of this.errorListeners
    ) {
      try {
        listener(
          error,
        );
      } catch {
        continue;
      }
    }
  }

  onState(listener) {
    if (
      typeof listener !==
      'function'
    ) {
      return () => {};
    }

    this.listeners.add(
      listener,
    );

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }

  onError(listener) {
    if (
      typeof listener !==
      'function'
    ) {
      return () => {};
    }

    this.errorListeners.add(
      listener,
    );

    return () => {
      this.errorListeners.delete(
        listener,
      );
    };
  }

  onSessionEnd(listener) {
    if (
      typeof listener !==
      'function'
    ) {
      return () => {};
    }

    this.sessionEndListeners.add(
      listener,
    );

    return () => {
      this.sessionEndListeners.delete(
        listener,
      );
    };
  }

  endSession({
    reason =
      'session-ended',
    message =
      'A sua sessão nesta partida terminou.',
    status = 0,
    data = null,
  } = {}) {
    if (
      this.sessionEnded ||
      this.closed
    ) {
      return false;
    }

    this.sessionEnded =
      true;

    clearStoredSession(
      this.matchId,
      this.playerId,
    );

    this.stopPolling();

    const error =
      createSocketError(
        message,
        status,
        data,
      );

    this.clearConnectWaiter(
      error,
    );

    this.rejectPendingRequests(
      error,
    );

    this.closeSocket(
      false,
    );

    this.presenceWarning =
      null;

    this.turnTimer =
      null;

    this.turnTimeoutSentSequence =
      null;

    removePresenceCountdown();
    removeTurnCountdown();

    const detail = {
      reason,
      message,
      status:
        Number(status) || 0,
      data,
    };

    for (
      const listener
      of this.sessionEndListeners
    ) {
      try {
        listener(
          detail,
        );
      } catch {
        continue;
      }
    }

    return true;
  }

  handlePlayerReplaced(
    data,
    status = 0,
  ) {
    if (
      !isPlayerReplaced(
        data,
        status,
      )
    ) {
      return false;
    }

    return this.endSession({
      reason:
        'player-replaced',
      message:
        data?.message ||
        'O seu lugar passou para um jogador automático.',
      status:
        Number(status) || 410,
      data,
    });
  }

  handleTerminalError(error) {
    if (
      !isTerminalStatus(
        error?.status,
      )
    ) {
      return false;
    }

    this.endSession({
      reason:
        Number(
          error?.status,
        ) === 410
          ? 'player-replaced'
          : 'session-invalid',
      message:
        error?.message ||
        'A sua sessão nesta partida terminou.',
      status:
        error?.status,
      data:
        error?.data || null,
    });

    return true;
  }

  createRequestId(prefix) {
    this.requestSequence +=
      1;

    return `${prefix}-${Date.now()}-${this.requestSequence}`;
  }

  clearConnectWaiter(
    error = null,
  ) {
    const waiter =
      this.connectWaiter;

    this.connectWaiter =
      null;

    if (!waiter) {
      return;
    }

    window.clearTimeout(
      waiter.timer,
    );

    if (error) {
      waiter.reject(
        error,
      );
    } else {
      waiter.resolve(
        this.state,
      );
    }
  }

  rejectPendingRequests(error) {
    for (
      const pending
      of this.pendingRequests.values()
    ) {
      window.clearTimeout(
        pending.timer,
      );

      pending.reject(
        error,
      );
    }

    this.pendingRequests.clear();
  }

  resolvePendingRequest(message) {
    const requestId =
      normalizeId(
        message?.requestId,
      );

    if (!requestId) {
      return false;
    }

    const pending =
      this.pendingRequests.get(
        requestId,
      );

    if (!pending) {
      return false;
    }

    this.pendingRequests.delete(
      requestId,
    );

    window.clearTimeout(
      pending.timer,
    );

    const data =
      message?.data ||
      null;

    const ok =
      message?.ok ===
      true;

    const status =
      Number(
        message?.status,
      ) || 0;

    if (
      this.handlePlayerReplaced(
        data,
        status,
      )
    ) {
      pending.reject(
        createSocketError(
          data?.message ||
          'O seu lugar passou para um jogador automático.',
          status || 410,
          data,
        ),
      );

      return true;
    }

    if (data) {
      if (
        data.game ||
        data.status ===
          'not-modified'
      ) {
        this.applyRealtimeState(
          data,
        );
      } else {
        this.updatePresenceWarning(
          data,
        );

        this.updateTurnTimer(
          data,
        );
      }
    }

    if (ok) {
      pending.resolve(
        data?.game
          ? data
          : this.state,
      );

      return true;
    }

    const error =
      createSocketError(
        data?.message ||
        'Não foi possível concluir a ação online.',
        status,
        data,
      );

    this.handleTerminalError(
      error,
    );

    pending.reject(
      error,
    );

    return true;
  }

  handleSocketMessage(event) {
    let message =
      null;

    try {
      message =
        JSON.parse(
          String(
            event.data ||
            '',
          ),
        );
    } catch {
      return;
    }

    if (
      !message ||
      typeof message !==
        'object'
    ) {
      return;
    }

    if (
      message.type ===
      'state'
    ) {
      this.socketAuthenticated =
        true;

      this.reconnectDelayMs =
        REALTIME_RECONNECT_MIN_MS;

      this.fallbackDelayMs =
        this.pollIntervalMs;

      this.clearFallbackTimer();

      this.applyRealtimeState(
        message.data ||
        {},
      );

      this.clearConnectWaiter();

      return;
    }

    if (
      message.type ===
      'presence'
    ) {
      this.updatePresenceWarning(
        message.data ||
        {},
      );

      this.updateTurnTimer(
        message.data ||
        {},
      );

      return;
    }

    if (
      message.type ===
        'state-result' ||
      message.type ===
        'command-result' ||
      message.type ===
        'turn-timeout-result'
    ) {
      this.resolvePendingRequest(
        message,
      );

      return;
    }

    if (
      message.type ===
      'error'
    ) {
      const error =
        createSocketError(
          message.message,
          message.status,
          message.data ||
          null,
        );

      this.handleTerminalError(
        error,
      );

      this.clearConnectWaiter(
        error,
      );

      this.notifyError(
        error,
      );
    }
  }

  handleSocketClose(socket) {
    if (
      this.socket !==
      socket
    ) {
      return;
    }

    this.socket =
      null;

    this.socketAuthenticated =
      false;

    this.socketConnecting =
      null;

    this.turnTimer =
      null;

    this.turnTimeoutSentSequence =
      null;

    this.renderCountdown();

    const error =
      createSocketError(
        'A ligação realtime à partida foi interrompida.',
      );

    this.clearConnectWaiter(
      error,
    );

    this.rejectPendingRequests(
      error,
    );

    if (
      this.closed ||
      !this.polling
    ) {
      return;
    }

    if (
      !document.hidden
    ) {
      this.scheduleReconnect();
      this.scheduleFallbackPoll();
    }
  }

  async connectRealtime() {
    if (
      this.closed ||
      !this.polling
    ) {
      return this.state;
    }

    if (
      this.socket?.readyState ===
        WebSocket.OPEN &&
      this.socketAuthenticated
    ) {
      return this.state;
    }

    if (
      this.socketConnecting
    ) {
      return this.socketConnecting;
    }

    if (
      document.hidden
    ) {
      return this.state;
    }

    this.closeSocket(
      false,
    );

    const socket =
      new WebSocket(
        createWebSocketUrl(
          this.matchId,
        ),
      );

    this.socket =
      socket;

    this.socketAuthenticated =
      false;

    this.socketConnecting =
      new Promise(
        (
          resolve,
          reject,
        ) => {
          const timer =
            window.setTimeout(
              () => {
                const error =
                  createSocketError(
                    'A ligação realtime à partida demorou demasiado tempo.',
                  );

                this.clearConnectWaiter(
                  error,
                );

                this.closeSocket(
                  false,
                );
              },
              REALTIME_CONNECT_TIMEOUT_MS,
            );

          this.connectWaiter = {
            resolve,
            reject,
            timer,
          };
        },
      );

    socket.addEventListener(
      'open',
      () => {
        if (
          this.socket !==
            socket ||
          this.closed
        ) {
          return;
        }

        socket.send(
          JSON.stringify({
            type:
              'auth',

            playerId:
              this.playerId,

            reconnectToken:
              this.reconnectToken,

            knownRevision:
              this.revision,
          }),
        );
      },
    );

    socket.addEventListener(
      'message',
      (event) => {
        if (
          this.socket ===
          socket
        ) {
          this.handleSocketMessage(
            event,
          );
        }
      },
    );

    socket.addEventListener(
      'error',
      () => {
        if (
          this.socket !==
          socket
        ) {
          return;
        }

        const error =
          createSocketError(
            'Não foi possível estabelecer a ligação realtime à partida.',
          );

        this.clearConnectWaiter(
          error,
        );
      },
    );

    socket.addEventListener(
      'close',
      () => {
        this.handleSocketClose(
          socket,
        );
      },
    );

    try {
      return await this.socketConnecting;
    } finally {
      if (
        this.socket ===
        socket
      ) {
        this.socketConnecting =
          null;
      }
    }
  }

  sendRealtimeRequest(
    type,
    payload = {},
  ) {
    if (
      !this.socket ||
      this.socket.readyState !==
        WebSocket.OPEN ||
      !this.socketAuthenticated
    ) {
      return Promise.reject(
        createSocketError(
          'A ligação realtime ainda não está disponível.',
        ),
      );
    }

    const requestId =
      this.createRequestId(
        type,
      );

    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const timer =
          window.setTimeout(
            () => {
              this.pendingRequests.delete(
                requestId,
              );

              reject(
                createSocketError(
                  'A resposta da partida demorou demasiado tempo.',
                ),
              );
            },
            REALTIME_REQUEST_TIMEOUT_MS,
          );

        this.pendingRequests.set(
          requestId,
          {
            resolve,
            reject,
            timer,
          },
        );

        try {
          this.socket.send(
            JSON.stringify({
              type,
              requestId,
              ...payload,
            }),
          );
        } catch (error) {
          window.clearTimeout(
            timer,
          );

          this.pendingRequests.delete(
            requestId,
          );

          reject(
            error,
          );
        }
      },
    );
  }

  async getState() {
    if (
      this.socket?.readyState ===
        WebSocket.OPEN &&
      this.socketAuthenticated
    ) {
      return this.sendRealtimeRequest(
        'state',
        {
          knownRevision:
            this.revision,
        },
      );
    }

    const data =
      await this.request({
        action:
          'state',

        knownRevision:
          this.revision,
      });

    if (
      data.status ===
      'not-modified'
    ) {
      this.updatePresenceWarning(
        data,
      );

      this.updateTurnTimer(
        data,
      );

      this.renderCountdown();

      return this.state;
    }

    return this.applyState(
      data,
    );
  }

  async command(
    type,
    payload = {},
  ) {
    const commandType =
      String(
        type ??
        '',
      ).trim();

    if (
      !commandType
    ) {
      throw new Error(
        'A ação online não é válida.',
      );
    }

    if (
      this.socket?.readyState ===
        WebSocket.OPEN &&
      this.socketAuthenticated
    ) {
      return this.sendRealtimeRequest(
        'command',
        {
          revision:
            this.revision,

          command: {
            type:
              commandType,

            payload,
          },
        },
      );
    }

    try {
      const data =
        await this.request({
          action:
            'command',

          revision:
            this.revision,

          command: {
            type:
              commandType,

            payload,
          },
        });

      const result =
        this.applyState(
          data,
        );

      if (
        this.polling &&
        !document.hidden
      ) {
        void this.connectRealtime()
          .catch(
            () => {},
          );
      }

      return result;
    } catch (error) {
      if (
        error?.status ===
          409 &&
        error?.data?.game
      ) {
        this.applyState(
          error.data,
        );
      }

      throw error;
    }
  }

  async leave() {
    if (this.closed) {
      return null;
    }

    clearStoredSession(
      this.matchId,
      this.playerId,
    );

    this.stopPolling();

    try {
      return await this.request({
        action:
          'leave',
      });
    } finally {
      this.closeSocket(
        false,
      );
    }
  }

  clearFallbackTimer() {
    if (
      this.fallbackTimer
    ) {
      window.clearTimeout(
        this.fallbackTimer,
      );

      this.fallbackTimer =
        null;
    }
  }

  scheduleFallbackPoll(
    delay =
      this.fallbackDelayMs,
  ) {
    this.clearFallbackTimer();

    if (
      this.closed ||
      !this.polling ||
      document.hidden ||
      (
        this.socket?.readyState ===
          WebSocket.OPEN &&
        this.socketAuthenticated
      )
    ) {
      return;
    }

    this.fallbackTimer =
      window.setTimeout(
        () =>
          void this.fallbackPollOnce(),
        Math.max(
          DEFAULT_FALLBACK_POLL_INTERVAL_MS,
          Number(
            delay,
          ) ||
          this.pollIntervalMs,
        ),
      );
  }

  async fallbackPollOnce() {
    if (
      this.closed ||
      !this.polling ||
      document.hidden
    ) {
      return;
    }

    try {
      await this.getState();
    } catch (error) {
      this.notifyError(
        error,
      );

      if (
        this.handleTerminalError(
          error,
        )
      ) {
        return;
      }
    }

    this.fallbackDelayMs =
      Math.min(
        MAX_FALLBACK_POLL_INTERVAL_MS,
        Math.max(
          this.pollIntervalMs,
          this.fallbackDelayMs *
            2,
        ),
      );

    this.scheduleFallbackPoll();
  }

  clearReconnectTimer() {
    if (
      this.reconnectTimer
    ) {
      window.clearTimeout(
        this.reconnectTimer,
      );

      this.reconnectTimer =
        null;
    }
  }

  scheduleReconnect() {
    this.clearReconnectTimer();

    if (
      this.closed ||
      !this.polling ||
      document.hidden ||
      this.socket?.readyState ===
        WebSocket.OPEN
    ) {
      return;
    }

    const delay =
      this.reconnectDelayMs;

    this.reconnectDelayMs =
      Math.min(
        REALTIME_RECONNECT_MAX_MS,
        Math.max(
          REALTIME_RECONNECT_MIN_MS,
          this.reconnectDelayMs *
            2,
        ),
      );

    this.reconnectTimer =
      window.setTimeout(
        () => {
          this.reconnectTimer =
            null;

          void this.connectRealtime()
            .catch(
              (error) => {
                if (
                  !this.handleTerminalError(
                    error,
                  )
                ) {
                  this.scheduleReconnect();
                }
              },
            );
        },
        delay,
      );
  }

  handleVisibilityChange() {
    if (
      this.closed ||
      !this.polling
    ) {
      return;
    }

    if (
      document.hidden
    ) {
      this.clearFallbackTimer();
      this.clearReconnectTimer();

      return;
    }

    if (
      this.socket?.readyState ===
        WebSocket.OPEN &&
      this.socketAuthenticated
    ) {
      this.renderCountdown();

      return;
    }

    void this.connectRealtime()
      .catch(
        (error) => {
          if (
            !this.handleTerminalError(
              error,
            )
          ) {
            this.scheduleFallbackPoll();
            this.scheduleReconnect();
          }
        },
      );
  }

  async startPolling({
    immediate = true,
  } = {}) {
    if (
      this.closed
    ) {
      return null;
    }

    this.polling =
      true;

    if (
      document.hidden
    ) {
      return this.state;
    }

    try {
      const state =
        await this.connectRealtime();

      return state;
    } catch (error) {
      if (
        this.handleTerminalError(
          error,
        )
      ) {
        throw error;
      }

      this.scheduleReconnect();

      if (
        !immediate
      ) {
        this.scheduleFallbackPoll();

        return this.state;
      }

      try {
        const state =
          await this.getState();

        this.fallbackDelayMs =
          this.pollIntervalMs;

        this.scheduleFallbackPoll();

        return state;
      } catch (
        fallbackError
      ) {
        this.notifyError(
          fallbackError,
        );

        this.scheduleFallbackPoll();

        throw fallbackError;
      }
    }
  }

  stopPolling() {
    this.polling =
      false;

    this.clearFallbackTimer();
    this.clearReconnectTimer();
  }

  closeSocket(
    rejectPending = true,
  ) {
    const socket =
      this.socket;

    this.socket =
      null;

    this.socketAuthenticated =
      false;

    this.socketConnecting =
      null;

    if (
      rejectPending
    ) {
      const error =
        createSocketError(
          'A ligação realtime foi terminada.',
        );

      this.clearConnectWaiter(
        error,
      );

      this.rejectPendingRequests(
        error,
      );
    }

    if (!socket) {
      return;
    }

    try {
      socket.close(
        1000,
        'Cliente encerrado',
      );
    } catch {
      return;
    }
  }

  close() {
    this.stopPolling();

    this.closed =
      true;

    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );

    this.closeSocket(
      true,
    );

    if (
      this.countdownTimer
    ) {
      window.clearInterval(
        this.countdownTimer,
      );

      this.countdownTimer =
        null;
    }

    this.turnTimer =
      null;

    this.turnTimeoutSentSequence =
      null;

    removePresenceCountdown();
    removeTurnCountdown();

    this.listeners.clear();
    this.errorListeners.clear();
    this.sessionEndListeners.clear();
  }
}

export default OnlineGameClient;