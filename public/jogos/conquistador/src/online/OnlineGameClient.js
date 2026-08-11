const API_URL = '/api/conquistador/game';
const DEFAULT_POLL_INTERVAL_MS = 700;
const STORED_SESSION_KEY = 'conquistador-online-session-v1';

function normalizeId(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 96);
}

function normalizeReconnectToken(value) {
  const token = String(value ?? '');

  return (
    token.length >= 32 &&
    token.length <= 256 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  )
    ? token
    : '';
}

function getStoredReconnectToken(matchId, playerId) {
  try {
    const raw = localStorage.getItem(STORED_SESSION_KEY);

    if (!raw) {
      return '';
    }

    const data = JSON.parse(raw);

    if (
      normalizeId(data?.matchId) !== matchId ||
      normalizeId(data?.playerId) !== playerId
    ) {
      return '';
    }

    return normalizeReconnectToken(data?.reconnectToken);
  } catch {
    return '';
  }
}

function clearStoredReconnectToken(matchId, playerId) {
  try {
    const raw = localStorage.getItem(STORED_SESSION_KEY);

    if (!raw) {
      return;
    }

    const data = JSON.parse(raw);

    if (
      normalizeId(data?.matchId) === matchId &&
      normalizeId(data?.playerId) === playerId
    ) {
      localStorage.removeItem(STORED_SESSION_KEY);
    }
  } catch {
    return;
  }
}

function normalizeRevision(value) {
  const revision = Number(value);

  return Number.isInteger(revision) && revision >= 0
    ? revision
    : null;
}

function removePresenceCountdown() {
  document
    .querySelector('#online-presence-countdown')
    ?.remove();
}

function renderPresenceCountdown(data) {
  const warnings = Array.isArray(data?.presenceWarnings)
    ? data.presenceWarnings
    : [];

  const warning = warnings[0] || null;

  if (!warning) {
    removePresenceCountdown();
    return;
  }

  const turnBanner = document.querySelector('.turn-banner');

  if (!turnBanner) {
    return;
  }

  const seconds = Math.max(
    0,
    Math.min(
      15,
      Number(warning.secondsRemaining) || 0,
    ),
  );

  let element = document.querySelector('#online-presence-countdown');

  if (!element) {
    element = document.createElement('div');
    element.id = 'online-presence-countdown';
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.gap = '0.55rem';
    element.style.marginLeft = 'auto';
    element.style.padding = '0.45rem 0.7rem';
    element.style.border = '1px solid rgba(255,255,255,0.22)';
    element.style.borderRadius = '0.8rem';
    element.style.background = 'rgba(0,0,0,0.18)';
    element.style.whiteSpace = 'nowrap';

    const dice = turnBanner.querySelector('.dice-result');

    if (dice) {
      turnBanner.insertBefore(element, dice);
    } else {
      turnBanner.appendChild(element);
    }
  }

  const safeName = String(warning.playerName ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  element.setAttribute(
    'aria-label',
    `A aguardar ${warning.playerName}. ${seconds} segundos restantes.`,
  );

  element.innerHTML = `
    <span
      aria-hidden="true"
      style="font-size:1.05rem;line-height:1"
    >⏱</span>
    <span
      style="display:flex;flex-direction:column;line-height:1.05"
    >
      <small style="opacity:.78;font-size:.68rem">
        A aguardar ${safeName}
      </small>
      <strong style="font-size:1.15rem">
        ${seconds}
      </strong>
    </span>
  `;
}

async function readJsonResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok || !data?.success) {
    const error = new Error(
      data?.message || 'Não foi possível comunicar com a partida online.',
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

export class OnlineGameClient {
  constructor({
    matchId,
    playerId,
    reconnectToken = null,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  }) {
    this.matchId = normalizeId(matchId);
    this.playerId = normalizeId(playerId);
    this.reconnectToken = normalizeReconnectToken(reconnectToken) ||
      getStoredReconnectToken(this.matchId, this.playerId);

    this.pollIntervalMs = Math.max(
      250,
      Number(pollIntervalMs) || DEFAULT_POLL_INTERVAL_MS,
    );

    if (!this.matchId || !this.playerId || !this.reconnectToken) {
      throw new Error(
        'A sessão online não possui uma credencial de reconexão válida.',
      );
    }

    this.revision = null;
    this.state = null;
    this.pollTimer = null;
    this.polling = false;
    this.closed = false;
    this.listeners = new Set();
    this.errorListeners = new Set();
  }

  async request(payload) {
    const response = await fetch(API_URL, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        matchId: this.matchId,
        playerId: this.playerId,
        reconnectToken: this.reconnectToken,
        ...payload,
      }),
    });

    try {
      return await readJsonResponse(response);
    } catch (error) {
      if (
        error?.status === 401 ||
        error?.status === 403
      ) {
        clearStoredReconnectToken(
          this.matchId,
          this.playerId,
        );
      }

      throw error;
    }
  }

  applyState(data) {
    if (!data?.game) {
      return this.state;
    }

    const revision = normalizeRevision(data.revision);

    if (
      revision !== null &&
      this.revision !== null &&
      revision < this.revision
    ) {
      return this.state;
    }

    this.revision = revision;
    this.state = data;

    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch {
        continue;
      }
    }

    renderPresenceCountdown(data);

    return data;
  }

  notifyError(error) {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch {
        continue;
      }
    }
  }

  onState(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  onError(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.errorListeners.add(listener);

    return () => {
      this.errorListeners.delete(listener);
    };
  }

  async getState() {
    const data = await this.request({
      action: 'state',
      knownRevision: this.revision,
    });

    if (data.status === 'not-modified') {
      return this.state;
    }

    return this.applyState(data);
  }

  async command(type, payload = {}) {
    const commandType = String(type ?? '').trim();

    if (!commandType) {
      throw new Error(
        'A ação online não é válida.',
      );
    }

    try {
      const data = await this.request({
        action: 'command',
        revision: this.revision,

        command: {
          type: commandType,
          payload,
        },
      });

      return this.applyState(data);
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

    this.pollTimer = window.setTimeout(
      () => this.pollOnce(),
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
      this.notifyError(error);
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

    this.polling = true;

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
    this.polling = false;

    if (this.pollTimer) {
      window.clearTimeout(
        this.pollTimer,
      );

      this.pollTimer = null;
    }
  }

  close() {
    this.stopPolling();
    removePresenceCountdown();

    this.closed = true;

    this.listeners.clear();
    this.errorListeners.clear();
  }
}

export default OnlineGameClient;
