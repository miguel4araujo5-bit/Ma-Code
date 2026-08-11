const API_URL = '/api/conquistador/game';
const DEFAULT_POLL_INTERVAL_MS = 700;
const STORED_SESSION_KEY = 'conquistador-online-session-v1';
const PRESENCE_COUNTDOWN_ID = 'online-presence-countdown';
const COUNTDOWN_TICK_MS = 250;

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

export class OnlineGameClient {
  constructor({
    matchId,
    playerId,
    reconnectToken = '',
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  }) {
    this.matchId =
      normalizeId(matchId);

    this.playerId =
      normalizeId(playerId);

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
        250,
        Number(pollIntervalMs) ||
        DEFAULT_POLL_INTERVAL_MS,
      );

    if (
      !this.matchId ||
      !this.playerId
    ) {
      throw new Error(
        'A sessão online não possui identificação válida.',
      );
    }

    if (!this.reconnectToken) {
      throw new Error(
        'A credencial de reconexão desta partida não está disponível.',
      );
    }

    this.revision =
      null;

    this.state =
      null;

    this.pollTimer =
      null;

    this.polling =
      false;

    this.closed =
      false;

    this.listeners =
      new Set();

    this.errorListeners =
      new Set();

    this.presenceWarning =
      null;

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
          },

          body:
            JSON.stringify({
              matchId:
                this.matchId,

              playerId:
                this.playerId,

              reconnectToken:
                this.reconnectToken,

              ...payload,
            }),
        },
      );

    try {
      return await readJsonResponse(
        response,
      );
    } catch (error) {
      if (
        error?.status === 401 ||
        error?.status === 403
      ) {
        clearStoredSession(
          this.matchId,
          this.playerId,
        );
      }

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
      getPresenceWarning(data);

    this.renderCountdown();
  }

  renderCountdown() {
    if (this.closed) {
      removePresenceCountdown();
      return;
    }

    if (
      this.presenceWarning &&
      Number(
        this.presenceWarning.expiresAt,
      ) <= Date.now()
    ) {
      this.presenceWarning =
        null;
    }

    renderPresenceCountdown(
      this.presenceWarning,
    );
  }

  applyState(data) {
    if (!data?.game) {
      this.updatePresenceWarning(data);
      return this.state;
    }

    const revision =
      normalizeRevision(
        data.revision,
      );

    if (
      revision !== null &&
      this.revision !== null &&
      revision < this.revision
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

    for (
      const listener
      of this.listeners
    ) {
      try {
        listener(data);
      } catch {
        continue;
      }
    }

    /*
     * O listener principal pode reconstruir o DOM.
     * Voltamos a montar o relógio depois dos listeners.
     */
    this.renderCountdown();

    return data;
  }

  notifyError(error) {
    for (
      const listener
      of this.errorListeners
    ) {
      try {
        listener(error);
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

  async getState() {
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
      /*
       * A presença muda com o tempo, mesmo quando a revisão
       * do jogo não muda. Por isso processamos sempre
       * presenceWarnings também numa resposta not-modified.
       */
      this.updatePresenceWarning(
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
        type ?? '',
      ).trim();

    if (!commandType) {
      throw new Error(
        'A ação online não é válida.',
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

      return this.applyState(
        data,
      );
    } catch (error) {
      if (
        error?.status === 409 &&
        error?.data?.game
      ) {
        this.applyState(
          error.data,
        );
      }

      throw error;
    }
  }

  schedulePoll() {
    if (
      this.closed ||
      !this.polling
    ) {
      return;
    }

    window.clearTimeout(
      this.pollTimer,
    );

    this.pollTimer =
      window.setTimeout(
        () =>
          this.pollOnce(),
        this.pollIntervalMs,
      );
  }

  async pollOnce() {
    if (
      this.closed ||
      !this.polling
    ) {
      return;
    }

    try {
      await this.getState();
    } catch (error) {
      this.notifyError(
        error,
      );
    } finally {
      this.schedulePoll();
    }
  }

  async startPolling({
    immediate = true,
  } = {}) {
    if (this.closed) {
      return null;
    }

    this.polling =
      true;

    if (immediate) {
      try {
        return await this.getState();
      } finally {
        this.schedulePoll();
      }
    }

    this.schedulePoll();

    return this.state;
  }

  stopPolling() {
    this.polling =
      false;

    if (this.pollTimer) {
      window.clearTimeout(
        this.pollTimer,
      );

      this.pollTimer =
        null;
    }
  }

  close() {
    this.stopPolling();

    if (
      this.countdownTimer
    ) {
      window.clearInterval(
        this.countdownTimer,
      );

      this.countdownTimer =
        null;
    }

    removePresenceCountdown();

    this.closed =
      true;

    this.listeners.clear();
    this.errorListeners.clear();
  }
}

export default OnlineGameClient;
